/**
 * POST DRIVER BEHAVIOR TO SUPABASE — Reads from "DriverBehaviour" sheet
 *
 * Reads enriched data from Sheet "DriverBehaviour", posts { records: [...] } to
 * the import-driver-behavior edge function.
 *
 * Sheet Column Layout:
 *   A(0): ID (date)        B(1): Vehicle ID     C(2): Driver
 *   D(3): Event Type       E(4): Event Time     F(5): Location URL
 *   G(6): Sync Status
 *
 * Rules enforced here (mirrored in edge function):
 *   - No driver → skip (event not posted)
 *   - UNKNOWN eventType → skip (SYNCED_IGNORED)
 *   - Dedup within same session via composite key
 *   - Batch posting in chunks of 50
 */

function postDriverBehaviorToSupabase() {
    // ── CONFIGURATION ──────────────────────────────────────────────────
    const SUPABASE_URL = 'https://wxvhkljrbcpcgpgdqhsp.supabase.co/functions/v1/import-driver-behavior';
    const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4dmhrbGpyYmNwY2dwZ2RxaHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MjYzMTEsImV4cCI6MjA3NDIwMjMxMX0.8VTE9TMQYAu2kMLpHX8EzBlCspBWddNW-FYOnDZSkHU';


    const SHEET_NAME = 'DriverBehaviour';

    // Column indices (0-based for row array)
    const COL_ID = 0;          // A: ID (date, e.g. "24/03/2026")
    const COL_FLEET = 1;       // B: Vehicle ID (e.g. "28H")
    const COL_DRIVER = 2;      // C: Driver name
    const COL_EVENT_TYPE = 3;  // D: Event Type (e.g. "Seatbelt Violation")
    const COL_EVENT_TIME = 4;  // E: Event Time (full datetime, e.g. "24/03/2026 07:34:00")
    const COL_LOCATION = 5;    // F: Location URL
    const SYNC_COL = 7;        // G: Sync Status (1-based column number)
    const TOTAL_COLS = SYNC_COL; // read up to sync col

    // Batch settings
    const BATCH_SIZE = 200;
    const MAX_ROWS = 1000;
    const POST_CHUNK = 50;

    // ── LOCKING ────────────────────────────────────────────────────────
    const lock = LockService.getScriptLock();
    try { lock.waitLock(30000); } catch (_) {
        Logger.log('⚠️ Could not obtain lock.');
        SpreadsheetApp.getUi().alert('Another sync is already running. Please wait.');
        return;
    }

    Logger.log('🚀 Starting driver behavior import (Sheet "DriverBehaviour" → Supabase)…');
    const t0 = new Date();

    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
        if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found.");

        const totalRows = sheet.getLastRow();
        if (totalRows <= 1) {
            SpreadsheetApp.getUi().alert('No data found in sheet.');
            return;
        }

        const rowsToProcess = Math.min(totalRows - 1, MAX_ROWS);
        Logger.log('📊 ' + rowsToProcess + ' rows to process (batch=' + BATCH_SIZE + ')');

        // ── 1. Build index of already-synced rows ────────────────────────
        const syncedKeys = new Set();
        const syncRange = sheet.getRange(2, SYNC_COL, rowsToProcess, 1).getValues();
        const keyColRange = sheet.getRange(2, COL_EVENT_TYPE + 1, rowsToProcess, 2).getValues(); // D(EventType), E(EventTime)

        for (var i = 0; i < syncRange.length; i++) {
            if (syncRange[i][0] === 'SYNCED') {
                var kType = String(keyColRange[i][0]).trim();        // Event Type
                var kDate = formatDateSafe(keyColRange[i][1]);       // date from Event Time
                var kTime = formatTimeSafe(keyColRange[i][1]);       // time from Event Time
                syncedKeys.add(kType + '|' + kDate + '|' + kTime);
            }
        }
        Logger.log('🔍 Already synced: ' + syncedKeys.size);

        // Pre-load location hyperlinks (Column F)
        const locationLinks = getLocationHyperlinks(sheet, rowsToProcess);

        var recordsToPost = [];
        var rowUpdates = [];
        var stats = { processed: 0, dupes: 0, errors: 0, noDriver: 0, unknown: 0 };

        // ── 2. Read & filter rows in batches ─────────────────────────────
        for (var start = 0; start < rowsToProcess; start += BATCH_SIZE) {
            var end = Math.min(start + BATCH_SIZE, rowsToProcess);
            var data = sheet.getRange(start + 2, 1, end - start, TOTAL_COLS).getValues();

            for (var bi = 0; bi < data.length; bi++) {
                var ri = start + bi;           // 0-based data index
                var row = data[bi];
                var syncStatus = row[SYNC_COL - 1]; // 0-based

                if (syncStatus === 'SYNCED' || syncStatus === 'SYNCED_IGNORED') continue;

                var driverName = row[COL_DRIVER] ? String(row[COL_DRIVER]).trim() : '';
                var eventTimeFull = row[COL_EVENT_TIME]; // Full datetime e.g. "24/03/2026 07:34:00"
                var eventType = row[COL_EVENT_TYPE] ? String(row[COL_EVENT_TYPE]).trim() : '';
                var fleetNumber = row[COL_FLEET] ? String(row[COL_FLEET]).trim() : '';
                var idDate = row[COL_ID]; // Date from ID column

                // No driver → skip entirely (not posted)
                if (!driverName) {
                    rowUpdates.push({ r: ri + 2, s: 'SKIPPED_NO_DRIVER' });
                    stats.noDriver++;
                    continue;
                }

                // Missing event time or event type → error
                if (!eventTimeFull || !eventType) {
                    rowUpdates.push({ r: ri + 2, s: 'ERROR_MISSING_DATA' });
                    stats.errors++;
                    continue;
                }

                // UNKNOWN events → ignore
                if (eventType.toUpperCase() === 'UNKNOWN') {
                    rowUpdates.push({ r: ri + 2, s: 'SYNCED_IGNORED' });
                    stats.unknown++;
                    continue;
                }

                var fDate = formatDateSafe(eventTimeFull);
                var fTime = formatTimeSafe(eventTimeFull);
                var key = eventType + '|' + fDate + '|' + fTime;

                // Session dedup
                if (syncedKeys.has(key)) {
                    rowUpdates.push({ r: ri + 2, s: 'SYNCED' });
                    stats.dupes++;
                    continue;
                }
                syncedKeys.add(key);

                // Resolve location hyperlink (fall back to cell value)
                var locationUrl = (ri < locationLinks.length && locationLinks[ri]) ? locationLinks[ri] : null;
                if (!locationUrl) {
                    locationUrl = row[COL_LOCATION] ? String(row[COL_LOCATION]).trim() : null;
                }

                // Build record matching exact sheet field names
                var eventTimeFormatted = fDate + ' ' + fTime;  // "DD/MM/YYYY HH:mm"
                recordsToPost.push({
                    'ID': formatDateSafe(idDate),
                    'Vehicle ID': fleetNumber || null,
                    'Driver': driverName,
                    'Event Type': eventType,
                    'Event Time': eventTimeFormatted,
                    'Location URL': locationUrl || 'View on Map'
                });

                rowUpdates.push({ r: ri + 2, s: 'SYNCED' });
                stats.processed++;

                if (stats.processed % 50 === 0) Logger.log('📈 Prepared: ' + stats.processed);
            }
        }

        Logger.log('🎯 Ready: ' + stats.processed + ' to send | dupes=' + stats.dupes +
            ' | noDriver=' + stats.noDriver + ' | unknown=' + stats.unknown +
            ' | errors=' + stats.errors);

        // ── 3. Write sync status back to sheet ───────────────────────────
        if (rowUpdates.length > 0) {
            var uBatch = 100;
            for (var u = 0; u < rowUpdates.length; u += uBatch) {
                var slice = rowUpdates.slice(u, u + uBatch);
                slice.forEach(function (item) {
                    sheet.getRange(item.r, SYNC_COL).setValue(item.s);
                });
                SpreadsheetApp.flush();
            }
        }

        // ── 4. POST to Supabase in chunks ────────────────────────────────
        if (recordsToPost.length === 0) {
            var msg = stats.processed === 0 && stats.dupes === 0
                ? '✅ All events are already synced!'
                : '📊 Sync Summary:\n\n' +
                '🚫 Duplicates: ' + stats.dupes + '\n' +
                '❓ Unknown ignored: ' + stats.unknown + '\n' +
                '🙈 No driver: ' + stats.noDriver + '\n' +
                '❌ Errors: ' + stats.errors;
            SpreadsheetApp.getUi().alert(msg);
            return;
        }

        Logger.log('🔄 Posting ' + recordsToPost.length + ' records…');
        var ok = 0, fail = 0;

        for (var c = 0; c < recordsToPost.length; c += POST_CHUNK) {
            var chunk = recordsToPost.slice(c, c + POST_CHUNK);
            Logger.log('📤 Chunk ' + (Math.floor(c / POST_CHUNK) + 1) + '/' +
                Math.ceil(recordsToPost.length / POST_CHUNK));

            var result = sendToSupabase(chunk, SUPABASE_URL, SUPABASE_API_KEY);
            if (result.success) {
                ok += chunk.length;
            } else {
                fail += chunk.length;
                Logger.log('❌ Chunk failed: ' + result.error);
            }
            if (c + POST_CHUNK < recordsToPost.length) Utilities.sleep(500);
        }

        // ── 5. Report ────────────────────────────────────────────────────
        var elapsed = Math.round((new Date() - t0) / 1000);
        SpreadsheetApp.getUi().alert(
            (fail === 0 ? '🎉 Sync Successful!' : '⚠️ Partial Sync') + '\n\n' +
            '✅ Sent: ' + ok + '\n' +
            (fail > 0 ? '❌ Failed: ' + fail + '\n' : '') +
            '🚫 Duplicates: ' + stats.dupes + '\n' +
            '❓ Unknown ignored: ' + stats.unknown + '\n' +
            '🙈 No driver: ' + stats.noDriver + '\n' +
            '❌ Errors: ' + stats.errors + '\n\n' +
            '⏱️ ' + elapsed + 's'
        );

    } catch (error) {
        Logger.log('❌ CRITICAL: ' + error.message + '\n' + error.stack);
        SpreadsheetApp.getUi().alert('❌ Error: ' + error.message);
    } finally {
        lock.releaseLock();
    }
}

// ── HELPERS ──────────────────────────────────────────────────────────

/** Extract actual URLs from HYPERLINK formulas in Column F */
function getLocationHyperlinks(sheet, rowsToProcess) {
    var links = new Array(rowsToProcess).fill(null);
    try {
        var range = sheet.getRange(2, 6, rowsToProcess, 1); // Column F
        var formulas = range.getFormulas();
        var values = range.getValues();
        var richTexts = null;
        try { richTexts = range.getRichTextValues(); } catch (_) { }

        for (var i = 0; i < rowsToProcess; i++) {
            var f = formulas[i][0];
            var v = values[i][0];
            // 1. Try HYPERLINK formula
            if (f && f.indexOf('HYPERLINK') !== -1) {
                var m = f.match(/HYPERLINK\("([^"]+)"/);
                if (m && m[1]) { links[i] = m[1]; continue; }
            }
            // 2. Try RichText link (handles cells with display text like "Video Link" that have an embedded URL)
            if (richTexts && richTexts[i] && richTexts[i][0]) {
                var rt = richTexts[i][0];
                var linkUrl = rt.getLinkUrl();
                if (linkUrl) { links[i] = linkUrl; continue; }
                // Check runs for partial links
                var runs = rt.getRuns();
                for (var r = 0; r < runs.length; r++) {
                    var runLink = runs[r].getLinkUrl();
                    if (runLink) { links[i] = runLink; break; }
                }
                if (links[i]) continue;
            }
            // 3. Fallback: only use cell value if it looks like a URL
            if (v) {
                var str = String(v).trim();
                if (/^https?:\/\//i.test(str)) { links[i] = str; }
            }
        }
    } catch (e) {
        Logger.log('⚠️ Hyperlink read error: ' + e.message);
    }
    return links;
}

/** Post records to the edge function */
function sendToSupabase(records, url, apiKey) {
    try {
        var options = {
            method: 'POST',
            contentType: 'application/json',
            payload: JSON.stringify({ records: records }),
            muteHttpExceptions: true,
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'apikey': apiKey,
                'Content-Type': 'application/json'
            }
        };
        var resp = UrlFetchApp.fetch(url, options);
        var code = resp.getResponseCode();
        var text = resp.getContentText();

        if (code >= 200 && code < 300) {
            return { success: true, data: JSON.parse(text) };
        }
        return { success: false, error: 'HTTP ' + code + ': ' + text.substring(0, 300) };
    } catch (e) {
        return { success: false, error: 'Network: ' + e.message };
    }
}

/** Format any date value → DD/MM/YYYY (edge function parses both DD/MM/YYYY and YYYY-MM-DD) */
function formatDateSafe(dateVal) {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
    var str = String(dateVal).trim();

    // Already DD/MM/YYYY
    var dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
        return dmyMatch[1].padStart(2, '0') + '/' + dmyMatch[2].padStart(2, '0') + '/' + dmyMatch[3];
    }

    // YYYY-MM-DD or YYYY/MM/DD → DD/MM/YYYY
    var isoMatch = str.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (isoMatch) {
        return isoMatch[3].padStart(2, '0') + '/' + isoMatch[2].padStart(2, '0') + '/' + isoMatch[1];
    }
    return str;
}

/** Format any time value → HH:mm */
function formatTimeSafe(timeVal) {
    if (!timeVal) return '00:00';
    if (timeVal instanceof Date) {
        return Utilities.formatDate(timeVal, Session.getScriptTimeZone(), 'HH:mm');
    }
    var str = String(timeVal).trim();
    if (str === '') return '00:00';

    // Extract HH:mm(:ss)
    var m = str.match(/(\d{1,2}):(\d{2})/);
    if (m) return m[1].padStart(2, '0') + ':' + m[2];
    return str;
}

// ── MENU ─────────────────────────────────────────────────────────────

function onOpen() {
    SpreadsheetApp.getUi().createMenu('Driver Behavior')
        .addItem('📤 Post Events to Supabase', 'postDriverBehaviorToSupabase')
        .addSeparator()
        .addItem('🔄 Mark Selected as Unsynced', 'markSelectedAsUnsynced')
        .addItem('📊 Count Unsynced Events', 'countUnsyncedEvents')
        .addItem('⚡ Clear All Sync Status', 'clearAllSyncStatus')
        .addToUi();
}

function markSelectedAsUnsynced() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var sel = sheet.getSelection().getActiveRange();
    if (!sel) { SpreadsheetApp.getUi().alert('Select rows first.'); return; }
    sheet.getRange(sel.getRowIndex(), 7, sel.getNumRows(), 1).clearContent();
    SpreadsheetApp.getUi().alert('✅ ' + sel.getNumRows() + ' row(s) marked as Unsynced.');
}

function countUnsyncedEvents() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DriverBehaviour');
    if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "DriverBehaviour" not found.'); return; }
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { SpreadsheetApp.getUi().alert('No data.'); return; }

    var vals = sheet.getRange(2, 7, lastRow - 1, 1).getValues();
    var s = 0, ig = 0, er = 0, un = 0;
    vals.forEach(function (r) {
        var v = r[0];
        if (v === 'SYNCED') s++;
        else if (v === 'SYNCED_IGNORED') ig++;
        else if (String(v).indexOf('ERROR') === 0 || String(v).indexOf('SKIPPED') === 0) er++;
        else un++;
    });
    SpreadsheetApp.getUi().alert(
        '📊 Sync Status\n\n✅ Synced: ' + s + '\n⏭️ Ignored: ' + ig +
        '\n❌ Errors/Skipped: ' + er + '\n⏳ Unsynced: ' + un +
        '\n\nTotal: ' + (lastRow - 1)
    );
}

function clearAllSyncStatus() {
    var ui = SpreadsheetApp.getUi();
    if (ui.alert('Clear All Sync Status', 'Reset all? Events may be re-sent.', ui.ButtonSet.YES_NO) !== ui.YES) return;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DriverBehaviour');
    if (!sheet) { ui.alert('Sheet "DriverBehaviour" not found.'); return; }
    var last = sheet.getLastRow();
    if (last > 1) {
        sheet.getRange(2, 7, last - 1, 1).clearContent();
        ui.alert('✅ Cleared ' + (last - 1) + ' rows.');
    }
}