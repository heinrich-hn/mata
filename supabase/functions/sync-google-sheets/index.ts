// Trip & Diesel Reports - Google Sheets Sync
// Pushes trip report and diesel consumption data to Google Sheets on a schedule

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google Sheets API helper
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson)

  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  // Create JWT claims
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  // Base64url encode
  const base64url = (obj: object) => {
    const json = JSON.stringify(obj)
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  const unsignedToken = `${base64url(header)}.${base64url(claims)}`

  // Sign with private key
  const privateKey = serviceAccount.private_key
  const encoder = new TextEncoder()
  const data = encoder.encode(unsignedToken)

  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKey.substring(
    privateKey.indexOf(pemHeader) + pemHeader.length,
    privateKey.indexOf(pemFooter)
  ).replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data)
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${unsignedToken}.${signatureBase64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

// Rate limiting: sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Fetch with retry on 429 rate limit errors
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options)
    if (res.status === 429 && attempt < maxRetries) {
      const backoffMs = Math.min(2000 * Math.pow(2, attempt), 60000)
      console.log(`Rate limited (429), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`)
      await sleep(backoffMs)
      continue
    }
    return res
  }
  return fetch(url, options)
}

// Ensure multiple sheet tabs exist in a single batchUpdate call
async function ensureSheetsExist(
  accessToken: string,
  spreadsheetId: string,
  sheetNames: string[]
): Promise<void> {
  if (sheetNames.length === 0) return

  // First, get existing sheet names
  const metaRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const meta = await metaRes.json()
  const existingSheets = new Set(
    (meta.sheets || []).map((s: any) => s.properties?.title)
  )

  const newSheets = sheetNames.filter(name => !existingSheets.has(name))
  if (newSheets.length === 0) return

  // Create all missing sheets in a single batchUpdate
  const requests = newSheets.map(name => ({
    addSheet: { properties: { title: name } }
  }))

  const res = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    console.error(`Failed to batch-create sheets:`, body)
  }
}

// Batch clear and write multiple sheets at once (2 API calls instead of 2×N)
async function batchUpdateSheets(
  accessToken: string,
  spreadsheetId: string,
  sheetData: { name: string; data: any[][] }[]
): Promise<void> {
  if (sheetData.length === 0) return

  // Ensure all sheet tabs exist first (1 read + maybe 1 write)
  await ensureSheetsExist(accessToken, spreadsheetId, sheetData.map(s => s.name))

  // Batch clear all sheets (1 API call)
  const clearRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: sheetData.map(s => s.name),
      }),
    }
  )
  if (!clearRes.ok) {
    console.error('Batch clear failed:', await clearRes.text())
  }

  // Batch write all sheets (1 API call)
  const writeRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: sheetData.map(s => ({
          range: s.name,
          majorDimension: 'ROWS',
          values: s.data,
        })),
      }),
    }
  )
  if (!writeRes.ok) {
    console.error('Batch write failed:', await writeRes.text())
  }

  // Apply professional formatting (1 API call)
  await formatSheets(accessToken, spreadsheetId, sheetData)
}

// Apply professional formatting: bold headers, colored background, frozen rows, auto-resize
async function formatSheets(
  accessToken: string,
  spreadsheetId: string,
  sheetData: { name: string; data: any[][] }[]
): Promise<void> {
  // Get sheet metadata to map names → sheetIds, and find existing banded ranges
  const metaRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title),bandedRanges(bandedRangeId))`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const meta = await metaRes.json()
  const sheetIdMap = new Map<string, number>()
  const existingBandIds: number[] = []
  const sheetNamesSet = new Set(sheetData.map(s => s.name))

  for (const s of (meta.sheets || [])) {
    if (s.properties?.title && s.properties?.sheetId !== undefined) {
      sheetIdMap.set(s.properties.title, s.properties.sheetId)
      // Collect existing banded ranges on sheets we're updating
      if (sheetNamesSet.has(s.properties.title) && s.bandedRanges) {
        for (const br of s.bandedRanges) {
          if (br.bandedRangeId !== undefined) existingBandIds.push(br.bandedRangeId)
        }
      }
    }
  }

  const requests: any[] = []

  // Remove existing banded ranges first to avoid conflicts on re-runs
  for (const bandId of existingBandIds) {
    requests.push({ deleteBanding: { bandedRangeId: bandId } })
  }

  // Dark navy header: RGB(26, 35, 56) = #1A2338
  const headerBg = { red: 0.102, green: 0.137, blue: 0.22, alpha: 1 }
  const headerFg = { red: 1, green: 1, blue: 1, alpha: 1 }

  for (const sheet of sheetData) {
    const sheetId = sheetIdMap.get(sheet.name)
    if (sheetId === undefined) continue
    const colCount = sheet.data.length > 0 ? Math.max(...sheet.data.map(r => r.length)) : 1
    const rowCount = sheet.data.length

    // 1. Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    })

    // 2. Bold white text on dark header background
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBg,
            textFormat: { bold: true, fontSize: 11, foregroundColor: headerFg, fontFamily: 'Arial' },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            padding: { top: 4, bottom: 4, left: 6, right: 6 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
      },
    })

    // 3. Body text formatting (consistent font & size)
    if (rowCount > 1) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: colCount },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, fontFamily: 'Arial' },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(textFormat,verticalAlignment)',
        },
      })
    }

    // 4. Alternating row colors (light grey stripes)
    requests.push({
      addBanding: {
        bandedRange: {
          sheetId,
          range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: colCount },
          rowProperties: {
            headerColor: headerBg,
            firstBandColor: { red: 1, green: 1, blue: 1, alpha: 1 }, // white
            secondBandColor: { red: 0.95, green: 0.96, blue: 0.97, alpha: 1 }, // light grey #F2F5F8
          },
        },
      },
    })

    // 5. Auto-resize columns to fit content
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: colCount },
      },
    })

    // 6. Set header row height
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    })

    // 7. Thin border under header
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        bottom: {
          style: 'SOLID_MEDIUM',
          color: { red: 0.3, green: 0.35, blue: 0.45, alpha: 1 },
        },
      },
    })
  }

  if (requests.length === 0) return

  const fmtRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  )
  if (!fmtRes.ok) {
    console.error('Format sheets failed:', await fmtRes.text())
  }
}

// Legacy single-sheet update (uses batch internally for compatibility)
async function updateSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  data: any[][]
): Promise<void> {
  await batchUpdateSheets(accessToken, spreadsheetId, [{ name: sheetName, data }])
}

// Sync Diesel Reports to Google Sheets
async function syncDieselReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  // Fetch diesel records
  let dieselQuery = supabase
    .from('diesel_records')
    .select('*')
    .order('date', { ascending: false })

  if (startDate) {
    dieselQuery = dieselQuery.gte('date', startDate.toISOString().split('T')[0])
  }

  const { data: dieselRecords, error: dieselError } = await dieselQuery
  if (dieselError) throw new Error(`Failed to fetch diesel records: ${dieselError.message}`)

  // Fetch diesel norms
  const { data: dieselNorms } = await supabase
    .from('diesel_norms')
    .select('*')
    .order('fleet_number')

  const normsMap = new Map((dieselNorms || []).map((n: any) => [n.fleet_number, n]))

  // Build aggregated data
  const fleetMap = new Map<string, any>()
  const driverMap = new Map<string, any>()
  const stationMap = new Map<string, any>()
  const weeklyMap = new Map<string, any>()
  const monthlyMap = new Map<string, any>()

  let totalLitres = 0
  let totalCostUSD = 0
  let totalKm = 0
  let totalPendingDebriefs = 0
  let totalCompletedDebriefs = 0

  const allDieselRecords = dieselRecords || []

  // Helper to identify reefer fleets (fleet numbers ending in 'F')
  const isReeferFleet = (fleet: string) => !!fleet && fleet.toUpperCase().trim().endsWith('F')

  // Split: truck records only (exclude reefer fleets)
  const records = allDieselRecords.filter((r: any) => !isReeferFleet(r.fleet_number || ''))

  // Fetch reefer diesel records from dedicated table
  let reeferQuery = supabase
    .from('reefer_diesel_records')
    .select('*')
    .order('date', { ascending: false })

  if (startDate) {
    reeferQuery = reeferQuery.gte('date', startDate.toISOString().split('T')[0])
  }

  const { data: reeferDieselRecords, error: reeferError } = await reeferQuery
  if (reeferError) console.error('Failed to fetch reefer records:', reeferError.message)

  // Also include any legacy reefer records from diesel_records that haven't been migrated
  const legacyReeferRecords = allDieselRecords.filter((r: any) => isReeferFleet(r.fleet_number || ''))
  const reeferFromTable = reeferDieselRecords || []

  // Merge: reefer_diesel_records take precedence, then legacy
  const reeferIdSet = new Set(reeferFromTable.map((r: any) => r.id))
  const mergedReeferRecords = [
    ...reeferFromTable,
    ...legacyReeferRecords.filter((r: any) => !reeferIdSet.has(r.id))
  ]

  records.forEach((record: any) => {
    const litres = record.litres_filled || 0
    const cost = record.total_cost || 0
    const km = record.distance_travelled || 0
    const fleetNumber = (record.fleet_number || '').toUpperCase().trim()
    const driverName = record.driver_name || 'Unknown'
    const station = record.fuel_station || 'Unknown'
    const kmPerLitre = record.km_per_litre || (litres > 0 && km > 0 ? km / litres : null)

    // Check if debrief required
    const norm = normsMap.get(fleetNumber)
    const requiresDebrief = kmPerLitre !== null && norm && kmPerLitre < norm.min_acceptable

    if (requiresDebrief && !record.debrief_signed) totalPendingDebriefs++
    if (record.debrief_signed) totalCompletedDebriefs++

    // Overall totals
    totalLitres += litres
    totalCostUSD += cost
    totalKm += km

    // Fleet summary
    if (fleetNumber) {
      const fleet = fleetMap.get(fleetNumber) || {
        fills: 0, litres: 0, km: 0, cost_usd: 0, pending_debriefs: 0
      }
      fleet.fills += 1
      fleet.litres += litres
      fleet.km += km
      fleet.cost_usd += cost
      if (requiresDebrief && !record.debrief_signed) fleet.pending_debriefs++
      fleetMap.set(fleetNumber, fleet)
    }

    // Driver summary
    const driver = driverMap.get(driverName) || {
      fills: 0, litres: 0, km: 0, cost_usd: 0, fleets: new Set()
    }
    driver.fills += 1
    driver.litres += litres
    driver.km += km
    driver.cost_usd += cost
    if (fleetNumber) driver.fleets.add(fleetNumber)
    driverMap.set(driverName, driver)

    // Station summary
    const stationData = stationMap.get(station) || {
      fills: 0, litres: 0, cost_usd: 0, fleets: new Set()
    }
    stationData.fills += 1
    stationData.litres += litres
    stationData.cost_usd += cost
    if (fleetNumber) stationData.fleets.add(fleetNumber)
    stationMap.set(station, stationData)

    // Weekly summary
    if (record.date) {
      const date = new Date(record.date)
      const weekNum = getISOWeek(date)
      const year = getISOWeekYear(date)
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

      const week = weeklyMap.get(weekKey) || {
        week: weekNum, year, fills: 0, litres: 0, km: 0, cost_usd: 0
      }
      week.fills += 1
      week.litres += litres
      week.km += km
      week.cost_usd += cost
      weeklyMap.set(weekKey, week)

      // Monthly summary
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      const month = monthlyMap.get(monthKey) || {
        month: monthNames[date.getMonth()], year: date.getFullYear(), fills: 0, litres: 0, km: 0, cost_usd: 0
      }
      month.fills += 1
      month.litres += litres
      month.km += km
      month.cost_usd += cost
      monthlyMap.set(monthKey, month)
    }
  })

  // Prepare sheet data

  // Diesel Summary sheet
  const avgKmPerLitre = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : '0'
  const avgCostPerLitreUSD = totalLitres > 0 && totalCostUSD > 0 ? (totalCostUSD / totalLitres).toFixed(2) : 'N/A'

  const summaryData = [
    ['Diesel Consumption Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Records', records.length],
    ['Total Litres Filled', totalLitres.toFixed(2)],
    ['Total Distance (km)', totalKm.toFixed(0)],
    ['Average km/L', avgKmPerLitre],
    [''],
    ['Financial Summary'],
    ['Total Cost (USD)', totalCostUSD.toFixed(2)],
    ['Avg Cost/Litre (USD)', avgCostPerLitreUSD],
    [''],
    ['Debrief Status'],
    ['Pending Debriefs', totalPendingDebriefs],
    ['Completed Debriefs', totalCompletedDebriefs],
    [''],
    ['Unique Trucks', fleetMap.size],
    ['Unique Drivers', driverMap.size],
    ['Unique Stations', stationMap.size],
  ]

  // Diesel by Fleet sheet
  const fleetData = [
    ['Fleet', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (USD)', 'Pending Debriefs'],
    ...Array.from(fleetMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([fleet, d]) => [
        fleet,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2),
        d.pending_debriefs
      ])
  ]

  // Diesel by Driver sheet
  const driverData = [
    ['Driver', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (USD)', 'Fleets Used'],
    ...Array.from(driverMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([driver, d]) => [
        driver,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2),
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Diesel by Station sheet
  const stationData = [
    ['Station', 'Fill Count', 'Litres', 'Cost (USD)', 'Avg Cost/L (USD)', 'Fleets Served'],
    ...Array.from(stationMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([station, d]) => [
        station,
        d.fills,
        d.litres.toFixed(2),
        d.cost_usd.toFixed(2),
        d.litres > 0 && d.cost_usd > 0 ? (d.cost_usd / d.litres).toFixed(2) : 'N/A',
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Diesel Weekly sheet
  const weeklyData = [
    ['Week', 'Year', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (USD)'],
    ...Array.from(weeklyMap.values())
      .sort((a, b) => `${a.year}-${String(a.week).padStart(2, '0')}`.localeCompare(`${b.year}-${String(b.week).padStart(2, '0')}`))
      .map(d => [
        d.week,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2)
      ])
  ]

  // Diesel Monthly sheet
  const monthlyData = [
    ['Month', 'Year', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (USD)'],
    ...Array.from(monthlyMap.values())
      .sort((a, b) => `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`))
      .map(d => [
        d.month,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2)
      ])
  ]

  // Diesel Transactions (raw data) sheet
  const transactionsData = [
    ['Date', 'Fleet', 'Driver', 'Station', 'Litres', 'Cost', 'Currency', 'KM Reading', 'Distance', 'km/L', 'Debrief Status'],
    ...records.slice(0, 1000).map((r: any) => [
      r.date,
      r.fleet_number,
      r.driver_name || '',
      r.fuel_station,
      r.litres_filled,
      r.total_cost,
      r.currency || 'ZAR',
      r.km_reading,
      r.distance_travelled || '',
      r.km_per_litre ? r.km_per_litre.toFixed(2) : '',
      r.debrief_signed ? 'Completed' : (r.requires_debrief ? 'Pending' : 'N/A')
    ])
  ]

  // --- REEFER REPORTS ---
  // Aggregate reefer data
  const reeferFleetMap = new Map<string, any>()
  const reeferDriverMap = new Map<string, any>()
  const reeferStationMap = new Map<string, any>()
  const reeferWeeklyMap = new Map<string, any>()
  const reeferMonthlyMap = new Map<string, any>()
  let reeferTotalLitres = 0
  let reeferTotalCostUSD = 0
  let reeferTotalHours = 0

  mergedReeferRecords.forEach((record: any) => {
    // Records from reefer_diesel_records use reefer_unit; legacy use fleet_number
    const reeferUnit = (record.reefer_unit || record.fleet_number || '').toUpperCase().trim()
    const litres = record.litres_filled || 0
    const cost = record.total_cost || 0
    const driverName = record.driver_name || 'Unknown'
    const station = record.fuel_station || 'Unknown'

    // For legacy diesel_records, km_reading was actually operating_hours
    const opHours = record.operating_hours ?? record.km_reading ?? null
    const prevHours = record.previous_operating_hours ?? record.previous_km_reading ?? null
    const hoursOp = record.hours_operated ?? (
      (opHours != null && prevHours != null && opHours > prevHours) ? opHours - prevHours : (record.distance_travelled ?? null)
    )
    const lph = record.litres_per_hour ?? (
      (hoursOp && hoursOp > 0 && litres > 0) ? litres / hoursOp : null
    )

    reeferTotalLitres += litres
    reeferTotalCostUSD += cost
    if (hoursOp && hoursOp > 0) reeferTotalHours += hoursOp

    // Fleet aggregation
    if (reeferUnit) {
      const fleet = reeferFleetMap.get(reeferUnit) || {
        fills: 0, litres: 0, cost_usd: 0, total_hours: 0, lph_sum: 0, lph_count: 0
      }
      fleet.fills += 1
      fleet.litres += litres
      fleet.cost_usd += cost
      if (hoursOp && hoursOp > 0) fleet.total_hours += hoursOp
      if (lph && lph > 0) { fleet.lph_sum += lph; fleet.lph_count += 1 }
      reeferFleetMap.set(reeferUnit, fleet)
    }

    // Driver aggregation
    const driver = reeferDriverMap.get(driverName) || {
      fills: 0, litres: 0, cost_usd: 0, total_hours: 0, lph_sum: 0, lph_count: 0, fleets: new Set()
    }
    driver.fills += 1
    driver.litres += litres
    driver.cost_usd += cost
    if (hoursOp && hoursOp > 0) driver.total_hours += hoursOp
    if (lph && lph > 0) { driver.lph_sum += lph; driver.lph_count += 1 }
    if (reeferUnit) driver.fleets.add(reeferUnit)
    reeferDriverMap.set(driverName, driver)

    // Station aggregation
    const stData = reeferStationMap.get(station) || {
      fills: 0, litres: 0, cost_usd: 0, total_hours: 0, lph_sum: 0, lph_count: 0, fleets: new Set()
    }
    stData.fills += 1
    stData.litres += litres
    stData.cost_usd += cost
    if (hoursOp && hoursOp > 0) stData.total_hours += hoursOp
    if (lph && lph > 0) { stData.lph_sum += lph; stData.lph_count += 1 }
    if (reeferUnit) stData.fleets.add(reeferUnit)
    reeferStationMap.set(station, stData)

    // Reefer weekly aggregation
    if (record.date) {
      const date = new Date(record.date)
      const weekNum = getISOWeek(date)
      const year = getISOWeekYear(date)
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

      const week = reeferWeeklyMap.get(weekKey) || {
        week: weekNum, year, fills: 0, litres: 0, total_hours: 0, cost_usd: 0
      }
      week.fills += 1
      week.litres += litres
      if (hoursOp && hoursOp > 0) week.total_hours += hoursOp
      week.cost_usd += cost
      reeferWeeklyMap.set(weekKey, week)

      // Reefer monthly aggregation
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const month = reeferMonthlyMap.get(monthKey) || {
        month: monthNames[date.getMonth()], year: date.getFullYear(), fills: 0, litres: 0, total_hours: 0, cost_usd: 0
      }
      month.fills += 1
      month.litres += litres
      if (hoursOp && hoursOp > 0) month.total_hours += hoursOp
      month.cost_usd += cost
      reeferMonthlyMap.set(monthKey, month)
    }
  })

  // Reefer Summary sheet
  const avgLph = reeferTotalHours > 0 ? (reeferTotalLitres / reeferTotalHours).toFixed(2) : 'N/A'
  const reeferSummaryData = [
    ['Reefer Diesel Report (L/hr)'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Reefer Fill Records', mergedReeferRecords.length],
    ['Total Litres Filled', reeferTotalLitres.toFixed(2)],
    ['Total Hours Operated', reeferTotalHours.toFixed(1)],
    ['Average L/hr', avgLph],
    [''],
    ['Financial Summary'],
    ['Total Cost (USD)', reeferTotalCostUSD.toFixed(2)],
    [''],
    ['Unique Reefer Units', reeferFleetMap.size],
    ['Unique Drivers', reeferDriverMap.size],
    ['Unique Stations', reeferStationMap.size],
  ]

  // Reefer by Fleet sheet
  const reeferFleetData = [
    ['Reefer Unit', 'Fill Count', 'Litres', 'Hours Operated', 'Avg L/hr', 'Cost (USD)'],
    ...Array.from(reeferFleetMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([fleet, d]) => [
        fleet,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.lph_count > 0 ? (d.lph_sum / d.lph_count).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2),
      ])
  ]

  // Reefer by Driver sheet
  const reeferDriverData = [
    ['Driver', 'Fill Count', 'Litres', 'Hours Operated', 'Avg L/hr', 'Cost (USD)', 'Reefer Units'],
    ...Array.from(reeferDriverMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([driver, d]) => [
        driver,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.lph_count > 0 ? (d.lph_sum / d.lph_count).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2),
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Reefer by Station sheet
  const reeferStationData = [
    ['Station', 'Fill Count', 'Litres', 'Hours Operated', 'Avg L/hr', 'Cost (USD)', 'Avg Cost/L (USD)', 'Reefer Units'],
    ...Array.from(reeferStationMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([station, d]) => [
        station,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.lph_count > 0 ? (d.lph_sum / d.lph_count).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2),
        d.litres > 0 && d.cost_usd > 0 ? (d.cost_usd / d.litres).toFixed(2) : 'N/A',
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Reefer Transactions (raw data) sheet
  const reeferTransactionsData = [
    ['Date', 'Reefer Unit', 'Driver', 'Station', 'Litres', 'Cost', 'Currency', 'Cost/L', 'Op Hours', 'Prev Hours', 'Hours Operated', 'L/hr', 'Linked Horse', 'Notes'],
    ...mergedReeferRecords.slice(0, 1000).map((r: any) => {
      const opH = r.operating_hours ?? r.km_reading ?? ''
      const prevH = r.previous_operating_hours ?? r.previous_km_reading ?? ''
      const hrsOp = r.hours_operated ?? (
        (opH && prevH && Number(opH) > Number(prevH)) ? (Number(opH) - Number(prevH)).toFixed(1) : ''
      )
      const computedLph = r.litres_per_hour ?? (
        (hrsOp && Number(hrsOp) > 0 && r.litres_filled > 0) ? (r.litres_filled / Number(hrsOp)).toFixed(2) : ''
      )
      const costPerL = r.cost_per_litre ?? (
        (r.litres_filled > 0 && r.total_cost > 0) ? (r.total_cost / r.litres_filled).toFixed(2) : ''
      )
      return [
        r.date,
        r.reefer_unit || r.fleet_number || '',
        r.driver_name || '',
        r.fuel_station || '',
        r.litres_filled || 0,
        r.total_cost || 0,
        r.currency || 'ZAR',
        costPerL,
        opH,
        prevH,
        hrsOp,
        computedLph,
        r.linked_horse || '',
        r.notes || ''
      ]
    })
  ]

  // Reefer Weekly sheet
  const reeferWeeklyData = [
    ['Week', 'Year', 'Fill Count', 'Litres', 'Hours Operated', 'L/hr', 'Cost (USD)'],
    ...Array.from(reeferWeeklyMap.values())
      .sort((a, b) => `${a.year}-${String(a.week).padStart(2, '0')}`.localeCompare(`${b.year}-${String(b.week).padStart(2, '0')}`))
      .map(d => [
        d.week,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.total_hours > 0 ? (d.litres / d.total_hours).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2)
      ])
  ]

  // Reefer Monthly sheet
  const reeferMonthlyData = [
    ['Month', 'Year', 'Fill Count', 'Litres', 'Hours Operated', 'L/hr', 'Cost (USD)'],
    ...Array.from(reeferMonthlyMap.values())
      .sort((a, b) => `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`))
      .map(d => [
        d.month,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.total_hours > 0 ? (d.litres / d.total_hours).toFixed(2) : 'N/A',
        d.cost_usd.toFixed(2)
      ])
  ]

  // Batch update all diesel + reefer sheets (3 API calls instead of 42)
  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Diesel Summary', data: summaryData },
    { name: 'Diesel by Fleet', data: fleetData },
    { name: 'Diesel by Driver', data: driverData },
    { name: 'Diesel by Station', data: stationData },
    { name: 'Diesel Weekly', data: weeklyData },
    { name: 'Diesel Monthly', data: monthlyData },
    { name: 'Diesel Transactions', data: transactionsData },
    { name: 'Reefer Summary', data: reeferSummaryData },
    { name: 'Reefer by Fleet', data: reeferFleetData },
    { name: 'Reefer by Driver', data: reeferDriverData },
    { name: 'Reefer by Station', data: reeferStationData },
    { name: 'Reefer Weekly', data: reeferWeeklyData },
    { name: 'Reefer Monthly', data: reeferMonthlyData },
    { name: 'Reefer Transactions', data: reeferTransactionsData },
  ])

  const allSheets = [
    'Diesel Summary', 'Diesel by Fleet', 'Diesel by Driver', 'Diesel by Station', 'Diesel Weekly', 'Diesel Monthly', 'Diesel Transactions',
    'Reefer Summary', 'Reefer by Fleet', 'Reefer by Driver', 'Reefer by Station', 'Reefer Weekly', 'Reefer Monthly', 'Reefer Transactions'
  ]

  return new Response(JSON.stringify({
    success: true,
    message: 'Diesel & Reefer reports synced to Google Sheet successfully',
    updated_at: new Date().toISOString(),
    period: period,
    records_processed: records.length,
    reefer_records_processed: mergedReeferRecords.length,
    sheets_updated: allSheets,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Sync Tyre Reports to Google Sheets
async function syncTyreReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string
): Promise<Response> {
  // Fetch all tyres with vehicle info
  const { data: tyres, error: tyresError } = await supabase
    .from('tyres')
    .select('*')
    .order('created_at', { ascending: false })

  if (tyresError) throw new Error(`Failed to fetch tyres: ${tyresError.message}`)

  // Fetch tyre inventory
  const { data: inventory, error: invError } = await supabase
    .from('tyre_inventory')
    .select('*')
    .order('brand')

  if (invError) throw new Error(`Failed to fetch tyre inventory: ${invError.message}`)

  const tyreRecords = tyres || []
  const inventoryRecords = inventory || []

  // Build aggregations
  const conditionMap = new Map<string, number>()
  const sizeMap = new Map<string, number>()
  const positionMap = new Map<string, number>()
  const totalTyres = tyreRecords.length
  let totalKm = 0
  let totalCostUSD = 0
  let installedCount = 0
  let removedCount = 0

  tyreRecords.forEach((tyre: any) => {
    // Condition counts
    const condition = tyre.condition || 'Unknown'
    conditionMap.set(condition, (conditionMap.get(condition) || 0) + 1)

    // Size counts
    const size = tyre.size || 'Unknown'
    sizeMap.set(size, (sizeMap.get(size) || 0) + 1)

    // Position counts
    const position = tyre.current_fleet_position || tyre.position || 'Unassigned'
    positionMap.set(position, (positionMap.get(position) || 0) + 1)

    // Totals
    totalKm += tyre.km_travelled || 0
    totalCostUSD += tyre.purchase_cost_usd || 0
    if (tyre.installation_date && !tyre.removal_date) installedCount++
    if (tyre.removal_date) removedCount++
  })

  // Tyre Summary sheet
  const summaryData = [
    ['Tyre Management Report'],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Tyres Tracked', totalTyres],
    ['Currently Installed', installedCount],
    ['Removed / In Stock', removedCount],
    ['Total KM Travelled (all tyres)', totalKm.toFixed(0)],
    [''],
    ['Financial Summary'],
    ['Total Purchase Cost (USD)', totalCostUSD.toFixed(2)],
    ['Average Cost/Tyre (USD)', totalTyres > 0 ? (totalCostUSD / totalTyres).toFixed(2) : '0'],
    [''],
    ['Condition Breakdown'],
    ...Array.from(conditionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([condition, count]) => [condition, count]),
    [''],
    ['Unique Sizes', sizeMap.size],
  ]

  // Tyre by Size sheet
  const sizeData = [
    ['Size', 'Count', '% of Total'],
    ...Array.from(sizeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([size, count]) => [
        size,
        count,
        totalTyres > 0 ? (count / totalTyres * 100).toFixed(1) + '%' : '0%',
      ])
  ]

  // Tyre by Position sheet
  const positionData = [
    ['Position', 'Count'],
    ...Array.from(positionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pos, count]) => [pos, count])
  ]

  // Tyre Inventory sheet
  const inventoryData = [
    ['Model', 'Size', 'Type', 'Quantity', 'Min Quantity', 'Reorder Needed', 'Unit Price (USD)', 'Supplier', 'Vendor', 'Location', 'Status'],
    ...inventoryRecords.map((inv: any) => [
      inv.model || '',
      inv.size || '',
      inv.type || '',
      inv.quantity || 0,
      inv.min_quantity || 0,
      (inv.quantity || 0) <= (inv.min_quantity || 0) ? 'YES' : 'No',
      inv.purchase_cost_usd || '',
      inv.supplier || '',
      inv.vendor || '',
      inv.location || '',
      inv.status || '',
    ])
  ]

  // Tyre Details (raw data) sheet - limit to 1000
  const detailsData = [
    ['Serial Number', 'Model', 'Size', 'Type', 'Condition', 'Position', 'Fleet Position', 'Current Tread', 'Initial Tread', 'KM Travelled', 'Install Date', 'Removal Date', 'Removal Reason', 'Cost (USD)', 'Notes'],
    ...tyreRecords.slice(0, 1000).map((t: any) => [
      t.serial_number || '',
      t.model || '',
      t.size || '',
      t.type || '',
      t.condition || '',
      t.position || '',
      t.current_fleet_position || '',
      t.current_tread_depth != null ? t.current_tread_depth : '',
      t.initial_tread_depth != null ? t.initial_tread_depth : '',
      t.km_travelled || 0,
      t.installation_date || '',
      t.removal_date || '',
      t.removal_reason || '',
      t.purchase_cost_usd || '',
      t.notes || '',
    ])
  ]

  // Batch update all tyre sheets (3 API calls instead of 15)
  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Tyre Summary', data: summaryData },
    { name: 'Tyres by Size', data: sizeData },
    { name: 'Tyres by Position', data: positionData },
    { name: 'Tyre Inventory', data: inventoryData },
    { name: 'Tyre Details', data: detailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Tyre reports synced to Google Sheet successfully',
    updated_at: new Date().toISOString(),
    tyres_processed: tyreRecords.length,
    inventory_items: inventoryRecords.length,
    sheets_updated: ['Tyre Summary', 'Tyres by Size', 'Tyres by Position', 'Tyre Inventory', 'Tyre Details'],
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Sync Workshop (Job Cards) Reports to Google Sheets
async function syncWorkshopReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  // Fetch job cards
  let jobCardsQuery = supabase
    .from('job_cards')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    jobCardsQuery = jobCardsQuery.gte('created_at', startDate.toISOString())
  }

  const { data: jobCards, error: jcError } = await jobCardsQuery
  if (jcError) throw new Error(`Failed to fetch job cards: ${jcError.message}`)

  const jobCardRecords = jobCards || []

  // Fetch vehicle info for fleet numbers
  const vehicleIds = [...new Set(jobCardRecords.map((jc: any) => jc.vehicle_id).filter(Boolean))]
  const vehicleMap2 = new Map<string, any>()
  if (vehicleIds.length > 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, fleet_number, registration_number')
      .in('id', vehicleIds)
      ; (vehicles || []).forEach((v: any) => vehicleMap2.set(v.id, v))
  }

  const jobCardIds = jobCardRecords.map((jc: any) => jc.id)

  // Fetch labor entries for these job cards
  let laborEntries: any[] = []
  if (jobCardIds.length > 0) {
    const { data: labor } = await supabase
      .from('labor_entries')
      .select('*')
      .in('job_card_id', jobCardIds)
    laborEntries = labor || []
  }

  // Fetch parts requests for these job cards
  let partsRequests: any[] = []
  if (jobCardIds.length > 0) {
    const { data: parts } = await supabase
      .from('parts_requests')
      .select('*')
      .in('job_card_id', jobCardIds)
    partsRequests = parts || []
  }

  // Fetch job card notes
  let jobCardNotes: any[] = []
  if (jobCardIds.length > 0) {
    const { data: notes } = await supabase
      .from('job_card_notes')
      .select('*')
      .in('job_card_id', jobCardIds)
    jobCardNotes = notes || []
  }

  // Build aggregations
  const statusMap = new Map<string, number>()
  const priorityMap = new Map<string, number>()
  const assigneeMap = new Map<string, { cards: number; labor_hours: number; labor_cost: number; parts_count: number; parts_cost: number }>()
  const vehicleMap = new Map<string, { cards: number; labor_cost: number; parts_cost: number }>()
  const monthlyMap = new Map<string, { month: string; year: number; cards: number; labor_hours: number; labor_cost: number; parts_cost: number }>()

  let totalLaborHours = 0
  let totalLaborCost = 0
  let totalPartsCost = 0
  let totalPartsQty = 0

  // Labor by job card
  const laborByJC = new Map<string, { hours: number; cost: number }>()
  laborEntries.forEach((le: any) => {
    const jcId = le.job_card_id
    const entry = laborByJC.get(jcId) || { hours: 0, cost: 0 }
    entry.hours += le.hours_worked || 0
    entry.cost += le.total_cost || 0
    laborByJC.set(jcId, entry)
    totalLaborHours += le.hours_worked || 0
    totalLaborCost += le.total_cost || 0
  })

  // Parts by job card
  const partsByJC = new Map<string, { count: number; cost: number }>()
  partsRequests.forEach((pr: any) => {
    const jcId = pr.job_card_id
    const entry = partsByJC.get(jcId) || { count: 0, cost: 0 }
    entry.count += pr.quantity || 0
    entry.cost += pr.total_price || (pr.unit_price || 0) * (pr.quantity || 0)
    partsByJC.set(jcId, entry)
    totalPartsQty += pr.quantity || 0
    totalPartsCost += pr.total_price || (pr.unit_price || 0) * (pr.quantity || 0)
  })

  // Notes count by job card
  const notesByJC = new Map<string, number>()
  jobCardNotes.forEach((n: any) => {
    notesByJC.set(n.job_card_id, (notesByJC.get(n.job_card_id) || 0) + 1)
  })

  jobCardRecords.forEach((jc: any) => {
    const status = jc.status || 'Unknown'
    statusMap.set(status, (statusMap.get(status) || 0) + 1)

    const priority = jc.priority || 'Unknown'
    priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1)

    const assignee = jc.assignee || 'Unassigned'
    const assigneeData = assigneeMap.get(assignee) || { cards: 0, labor_hours: 0, labor_cost: 0, parts_count: 0, parts_cost: 0 }
    assigneeData.cards += 1
    const jcLabor = laborByJC.get(jc.id)
    if (jcLabor) {
      assigneeData.labor_hours += jcLabor.hours
      assigneeData.labor_cost += jcLabor.cost
    }
    const jcParts = partsByJC.get(jc.id)
    if (jcParts) {
      assigneeData.parts_count += jcParts.count
      assigneeData.parts_cost += jcParts.cost
    }
    assigneeMap.set(assignee, assigneeData)

    // Vehicle aggregation
    const vehicleInfo = vehicleMap2.get(jc.vehicle_id)
    const fleet = vehicleInfo?.fleet_number || 'No Vehicle'
    const vehicleData = vehicleMap.get(fleet) || { cards: 0, labor_cost: 0, parts_cost: 0 }
    vehicleData.cards += 1
    if (jcLabor) vehicleData.labor_cost += jcLabor.cost
    if (jcParts) vehicleData.parts_cost += jcParts.cost
    vehicleMap.set(fleet, vehicleData)

    // Monthly
    if (jc.created_at) {
      const date = new Date(jc.created_at)
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const month = monthlyMap.get(monthKey) || { month: monthNames[date.getMonth()], year: date.getFullYear(), cards: 0, labor_hours: 0, labor_cost: 0, parts_cost: 0 }
      month.cards += 1
      if (jcLabor) {
        month.labor_hours += jcLabor.hours
        month.labor_cost += jcLabor.cost
      }
      if (jcParts) month.parts_cost += jcParts.cost
      monthlyMap.set(monthKey, month)
    }
  })

  // Workshop Summary sheet
  const totalMaintenanceCost = totalLaborCost + totalPartsCost
  const summaryData = [
    ['Workshop Management Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Job Cards', jobCardRecords.length],
    ['Total Labor Hours', totalLaborHours.toFixed(1)],
    ['Total Parts Requested', totalPartsQty],
    [''],
    ['Financial Summary'],
    ['Total Labor Cost', totalLaborCost.toFixed(2)],
    ['Total Parts Cost', totalPartsCost.toFixed(2)],
    ['Total Maintenance Cost', totalMaintenanceCost.toFixed(2)],
    ['Avg Cost per Job Card', jobCardRecords.length > 0 ? (totalMaintenanceCost / jobCardRecords.length).toFixed(2) : '0'],
    [''],
    ['Status Breakdown'],
    ...Array.from(statusMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => [status, count]),
    [''],
    ['Priority Breakdown'],
    ...Array.from(priorityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([priority, count]) => [priority, count]),
    [''],
    ['Unique Technicians/Assignees', assigneeMap.size],
    ['Unique Vehicles Serviced', vehicleMap.size],
  ]

  // Workshop by Assignee sheet
  const assigneeData = [
    ['Assignee', 'Job Cards', 'Labor Hours', 'Labor Cost', 'Parts Count', 'Parts Cost', 'Total Cost'],
    ...Array.from(assigneeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, d]) => [
        name,
        d.cards,
        d.labor_hours.toFixed(1),
        d.labor_cost.toFixed(2),
        d.parts_count,
        d.parts_cost.toFixed(2),
        (d.labor_cost + d.parts_cost).toFixed(2),
      ])
  ]

  // Workshop by Vehicle sheet
  const vehicleData = [
    ['Fleet Number', 'Job Cards', 'Labor Cost', 'Parts Cost', 'Total Cost', 'Avg Cost/Card'],
    ...Array.from(vehicleMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([fleet, d]) => [
        fleet,
        d.cards,
        d.labor_cost.toFixed(2),
        d.parts_cost.toFixed(2),
        (d.labor_cost + d.parts_cost).toFixed(2),
        d.cards > 0 ? ((d.labor_cost + d.parts_cost) / d.cards).toFixed(2) : '0',
      ])
  ]

  // Workshop Monthly sheet
  const monthlyData = [
    ['Month', 'Year', 'Job Cards', 'Labor Hours', 'Labor Cost', 'Parts Cost', 'Total Cost'],
    ...Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_key, d]) => [
        d.month,
        d.year,
        d.cards,
        d.labor_hours.toFixed(1),
        d.labor_cost.toFixed(2),
        d.parts_cost.toFixed(2),
        (d.labor_cost + d.parts_cost).toFixed(2),
      ])
  ]

  // Workshop Job Cards Detail sheet (raw data)
  const detailsData = [
    ['Job Number', 'Title', 'Status', 'Priority', 'Assignee', 'Fleet Number', 'Odometer', 'Due Date', 'Created', 'Labor Hours', 'Labor Cost', 'Parts Qty', 'Parts Cost', 'Total Cost', 'Notes Count'],
    ...jobCardRecords.slice(0, 1000).map((jc: any) => {
      const labor = laborByJC.get(jc.id) || { hours: 0, cost: 0 }
      const parts = partsByJC.get(jc.id) || { count: 0, cost: 0 }
      const notesCount = notesByJC.get(jc.id) || 0
      return [
        jc.job_number || '',
        jc.title || '',
        jc.status || '',
        jc.priority || '',
        jc.assignee || '',
        vehicleMap2.get(jc.vehicle_id)?.fleet_number || '',
        jc.odometer_reading || '',
        jc.due_date || '',
        jc.created_at ? new Date(jc.created_at).toISOString().split('T')[0] : '',
        labor.hours.toFixed(1),
        labor.cost.toFixed(2),
        parts.count,
        parts.cost.toFixed(2),
        (labor.cost + parts.cost).toFixed(2),
        notesCount,
      ]
    })
  ]

  // Parts Requests Detail sheet
  const partsDetailData = [
    ['Part Name', 'Part Number', 'Brand', 'Quantity', 'Unit Price', 'Total Price', 'Status', 'Job Card', 'Requested By', 'IR Number', 'Is Service', 'Vendor', 'Expected Delivery', 'Received Qty', 'Received Date'],
    ...partsRequests.slice(0, 1000).map((pr: any) => {
      const jc = jobCardRecords.find((j: any) => j.id === pr.job_card_id)
      return [
        pr.part_name || '',
        pr.part_number || '',
        pr.make_brand || '',
        pr.quantity || 0,
        pr.unit_price || '',
        pr.total_price || '',
        pr.status || '',
        jc?.job_number || '',
        pr.requested_by || '',
        pr.ir_number || '',
        pr.is_service ? 'Yes' : 'No',
        pr.vendor_id || '',
        pr.expected_delivery_date || '',
        pr.received_quantity || '',
        pr.received_date || '',
      ]
    })
  ]

  // Batch update all workshop sheets (3 API calls instead of 18)
  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Workshop Summary', data: summaryData },
    { name: 'Workshop by Assignee', data: assigneeData },
    { name: 'Workshop by Vehicle', data: vehicleData },
    { name: 'Workshop Monthly', data: monthlyData },
    { name: 'Workshop Job Cards', data: detailsData },
    { name: 'Workshop Parts', data: partsDetailData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Workshop reports synced to Google Sheet successfully',
    updated_at: new Date().toISOString(),
    period: period,
    job_cards_processed: jobCardRecords.length,
    labor_entries: laborEntries.length,
    parts_requests: partsRequests.length,
    sheets_updated: ['Workshop Summary', 'Workshop by Assignee', 'Workshop by Vehicle', 'Workshop Monthly', 'Workshop Job Cards', 'Workshop Parts'],
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Sync Inspections & Faults Reports to Google Sheets
async function syncInspectionReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  let inspQuery = supabase
    .from('vehicle_inspections')
    .select('*')
    .order('inspection_date', { ascending: false })

  if (startDate) {
    inspQuery = inspQuery.gte('inspection_date', startDate.toISOString().split('T')[0])
  }

  const { data: inspections, error: inspError } = await inspQuery
  if (inspError) throw new Error(`Failed to fetch inspections: ${inspError.message}`)

  const inspRecords = inspections || []
  const inspIds = inspRecords.map((i: any) => i.id)

  let faults: any[] = []
  if (inspIds.length > 0) {
    const { data: faultData } = await supabase
      .from('inspection_faults')
      .select('*')
      .in('inspection_id', inspIds)
    faults = faultData || []
  }

  // Aggregations
  const statusMap = new Map<string, number>()
  const typeMap = new Map<string, number>()
  const faultSeverityMap = new Map<string, number>()
  const faultActionMap = new Map<string, number>()
  let hasFaultCount = 0
  let resolvedCount = 0

  inspRecords.forEach((insp: any) => {
    const status = insp.status || 'Unknown'
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
    const type = insp.inspection_type || 'Unknown'
    typeMap.set(type, (typeMap.get(type) || 0) + 1)
    if (insp.has_fault) hasFaultCount++
    if (insp.fault_resolved) resolvedCount++
  })

  faults.forEach((f: any) => {
    const severity = f.severity || 'Unknown'
    faultSeverityMap.set(severity, (faultSeverityMap.get(severity) || 0) + 1)
    const action = f.corrective_action_status || 'pending'
    faultActionMap.set(action, (faultActionMap.get(action) || 0) + 1)
  })

  const summaryData = [
    ['Inspections & Faults Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Inspections', inspRecords.length],
    ['With Faults', hasFaultCount],
    ['Faults Resolved', resolvedCount],
    ['Total Faults Logged', faults.length],
    [''],
    ['By Status'],
    ...Array.from(statusMap.entries()).map(([s, c]) => [s, c]),
    [''],
    ['By Type'],
    ...Array.from(typeMap.entries()).map(([t, c]) => [t, c]),
    [''],
    ['Fault Severity'],
    ...Array.from(faultSeverityMap.entries()).map(([s, c]) => [s, c]),
    [''],
    ['Corrective Action Status'],
    ...Array.from(faultActionMap.entries()).map(([a, c]) => [a, c]),
  ]

  const inspDetailsData = [
    ['Inspection #', 'Date', 'Type', 'Status', 'Vehicle Reg', 'Inspector', 'Location', 'Odometer', 'Has Fault', 'Fault Resolved', 'Notes'],
    ...inspRecords.slice(0, 1000).map((i: any) => [
      i.inspection_number || '',
      i.inspection_date || '',
      i.inspection_type || '',
      i.status || '',
      i.vehicle_registration || '',
      i.inspector_name || '',
      i.location || '',
      i.odometer_reading || '',
      i.has_fault ? 'Yes' : 'No',
      i.fault_resolved ? 'Yes' : 'No',
      i.notes || '',
    ])
  ]

  const faultDetailsData = [
    ['Inspection ID', 'Fault Description', 'Severity', 'Requires Immediate Attention', 'Corrective Action Status', 'Action Date', 'Action By', 'Action Notes', 'Estimated Cost (USD)', 'Job Card ID'],
    ...faults.slice(0, 1000).map((f: any) => [
      f.inspection_id || '',
      f.fault_description || '',
      f.severity || '',
      f.requires_immediate_attention ? 'Yes' : 'No',
      f.corrective_action_status || 'pending',
      f.corrective_action_date || '',
      f.corrective_action_by || '',
      f.corrective_action_notes || '',
      f.estimated_cost || '',
      f.job_card_id || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Inspection Summary', data: summaryData },
    { name: 'Inspection Details', data: inspDetailsData },
    { name: 'Fault Details', data: faultDetailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Inspection & Fault reports synced',
    sheets_updated: ['Inspection Summary', 'Inspection Details', 'Fault Details'],
    inspections_processed: inspRecords.length,
    faults_processed: faults.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Vehicle Fleet Reports to Google Sheets
async function syncVehicleReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string
): Promise<Response> {
  const { data: vehicles, error: vError } = await supabase
    .from('vehicles')
    .select('*')
    .order('fleet_number')

  if (vError) throw new Error(`Failed to fetch vehicles: ${vError.message}`)

  const { data: docs } = await supabase
    .from('work_documents')
    .select('*')
    .order('expiry_date', { ascending: true })

  const vehicleRecords = vehicles || []
  const docRecords = docs || []

  const typeMap = new Map<string, number>()
  let activeCount = 0

  vehicleRecords.forEach((v: any) => {
    const vtype = v.vehicle_type || 'Unknown'
    typeMap.set(vtype, (typeMap.get(vtype) || 0) + 1)
    if (v.active !== false) activeCount++
  })

  // Documents expiring within 30 days
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 86400000)
  const expiringDocs = docRecords.filter((d: any) =>
    d.expiry_date && new Date(d.expiry_date) <= thirtyDays && new Date(d.expiry_date) >= now
  )
  const expiredDocs = docRecords.filter((d: any) =>
    d.expiry_date && new Date(d.expiry_date) < now
  )

  const summaryData = [
    ['Vehicle Fleet Report'],
    ['Generated', new Date().toISOString()],
    [''],
    ['Fleet Statistics'],
    ['Total Vehicles', vehicleRecords.length],
    ['Active Vehicles', activeCount],
    ['Inactive Vehicles', vehicleRecords.length - activeCount],
    [''],
    ['By Vehicle Type'],
    ...Array.from(typeMap.entries()).map(([t, c]) => [t, c]),
    [''],
    ['Document Alerts'],
    ['Expiring Within 30 Days', expiringDocs.length],
    ['Already Expired', expiredDocs.length],
  ]

  const vehicleDetailsData = [
    ['Fleet Number', 'Registration', 'Make', 'Model', 'Type', 'Tonnage', 'Odometer', 'Reefer Unit', 'Active'],
    ...vehicleRecords.map((v: any) => [
      v.fleet_number || '',
      v.registration_number || '',
      v.make || '',
      v.model || '',
      v.vehicle_type || '',
      v.tonnage || '',
      v.current_odometer || '',
      v.reefer_unit || '',
      v.active !== false ? 'Yes' : 'No',
    ])
  ]

  const docDetailsData = [
    ['Document Type', 'Category', 'Vehicle/Entity', 'Expiry Date', 'Status', 'File Name'],
    ...docRecords.slice(0, 1000).map((d: any) => [
      d.document_type || '',
      d.document_category || '',
      d.vehicle_id || d.entity_id || '',
      d.expiry_date || '',
      d.expiry_date ? (new Date(d.expiry_date) < now ? 'Expired' : (new Date(d.expiry_date) <= thirtyDays ? 'Expiring Soon' : 'Valid')) : 'No Expiry',
      d.file_name || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Vehicle Summary', data: summaryData },
    { name: 'Vehicle Details', data: vehicleDetailsData },
    { name: 'Vehicle Documents', data: docDetailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Vehicle fleet reports synced',
    sheets_updated: ['Vehicle Summary', 'Vehicle Details', 'Vehicle Documents'],
    vehicles_processed: vehicleRecords.length,
    documents_processed: docRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Driver Reports to Google Sheets
async function syncDriverReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string
): Promise<Response> {
  const { data: drivers, error: dError } = await supabase
    .from('drivers')
    .select('*')
    .order('last_name')

  if (dError) throw new Error(`Failed to fetch drivers: ${dError.message}`)

  const driverRecords = drivers || []
  const driverIds = driverRecords.map((d: any) => d.id)

  let driverDocs: any[] = []
  if (driverIds.length > 0) {
    const { data: docs } = await supabase
      .from('driver_documents')
      .select('*')
      .in('driver_id', driverIds)
    driverDocs = docs || []
  }

  const statusMap = new Map<string, number>()
  driverRecords.forEach((d: any) => {
    const status = d.status || 'Unknown'
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
  })

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 86400000)
  const expiringDocs = driverDocs.filter((d: any) =>
    d.expiry_date && new Date(d.expiry_date) <= thirtyDays && new Date(d.expiry_date) >= now
  )

  const summaryData = [
    ['Driver Management Report'],
    ['Generated', new Date().toISOString()],
    [''],
    ['Driver Statistics'],
    ['Total Drivers', driverRecords.length],
    [''],
    ['By Status'],
    ...Array.from(statusMap.entries()).map(([s, c]) => [s, c]),
    [''],
    ['Document Alerts'],
    ['Documents Expiring Within 30 Days', expiringDocs.length],
    ['Total Driver Documents', driverDocs.length],
  ]

  const driverDetailsData = [
    ['Driver #', 'First Name', 'Last Name', 'License #', 'License Class', 'License Expiry', 'Status', 'Phone', 'Email', 'Hire Date', 'City'],
    ...driverRecords.map((d: any) => [
      d.driver_number || '',
      d.first_name || '',
      d.last_name || '',
      d.license_number || '',
      d.license_class || '',
      d.license_expiry || '',
      d.status || '',
      d.phone || '',
      d.email || '',
      d.hire_date || '',
      d.city || '',
    ])
  ]

  const docDetailsData = [
    ['Driver ID', 'Document Type', 'Document #', 'Expiry Date', 'Status', 'File Name'],
    ...driverDocs.slice(0, 1000).map((d: any) => [
      d.driver_id || '',
      d.document_type || '',
      d.document_number || '',
      d.expiry_date || '',
      d.expiry_date ? (new Date(d.expiry_date) < now ? 'Expired' : (new Date(d.expiry_date) <= thirtyDays ? 'Expiring Soon' : 'Valid')) : 'No Expiry',
      d.file_name || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Driver Summary', data: summaryData },
    { name: 'Driver Details', data: driverDetailsData },
    { name: 'Driver Documents', data: docDetailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Driver reports synced',
    sheets_updated: ['Driver Summary', 'Driver Details', 'Driver Documents'],
    drivers_processed: driverRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Incident Reports to Google Sheets
async function syncIncidentReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  let incQuery = supabase
    .from('incidents')
    .select('*')
    .order('incident_date', { ascending: false })

  if (startDate) {
    incQuery = incQuery.gte('incident_date', startDate.toISOString().split('T')[0])
  }

  const { data: incidents, error: incError } = await incQuery
  if (incError) throw new Error(`Failed to fetch incidents: ${incError.message}`)

  const incRecords = incidents || []

  const typeMap = new Map<string, number>()
  const statusMap = new Map<string, number>()
  let totalCostUSD = 0
  let totalClaimUSD = 0

  incRecords.forEach((inc: any) => {
    const incType = inc.incident_type || 'Unknown'
    typeMap.set(incType, (typeMap.get(incType) || 0) + 1)
    const status = inc.status || 'Unknown'
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
    totalCostUSD += inc.total_cost || 0
    totalClaimUSD += inc.insurance_claim_amount || 0
  })

  const summaryData = [
    ['Incident Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Statistics'],
    ['Total Incidents', incRecords.length],
    ['Total Cost (USD)', totalCostUSD.toFixed(2)],
    ['Total Insurance Claims (USD)', totalClaimUSD.toFixed(2)],
    [''],
    ['By Type'],
    ...Array.from(typeMap.entries()).map(([t, c]) => [t, c]),
    [''],
    ['By Status'],
    ...Array.from(statusMap.entries()).map(([s, c]) => [s, c]),
  ]

  const detailsData = [
    ['Incident #', 'Date', 'Time', 'Type', 'Status', 'Severity', 'Location', 'Vehicle', 'Driver', 'Description', 'Cost (USD)', 'Insurance Claim (USD)', 'Insurance #', 'Reported By'],
    ...incRecords.slice(0, 1000).map((i: any) => [
      i.incident_number || '',
      i.incident_date || '',
      i.incident_time || '',
      i.incident_type || '',
      i.status || '',
      i.severity_rating || '',
      i.location || '',
      i.vehicle_number || '',
      i.driver_name || '',
      i.description || '',
      i.total_cost || '',
      i.insurance_claim_amount || '',
      i.insurance_number || '',
      i.reported_by || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Incident Summary', data: summaryData },
    { name: 'Incident Details', data: detailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Incident reports synced',
    sheets_updated: ['Incident Summary', 'Incident Details'],
    incidents_processed: incRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Maintenance Schedule Reports to Google Sheets
async function syncMaintenanceReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string
): Promise<Response> {
  const { data: schedules, error: schError } = await supabase
    .from('maintenance_schedules')
    .select('*')
    .order('next_due_date', { ascending: true })

  if (schError) throw new Error(`Failed to fetch maintenance schedules: ${schError.message}`)

  const { data: history } = await supabase
    .from('maintenance_schedule_history')
    .select('*')
    .order('completed_date', { ascending: false })

  const schedRecords = schedules || []
  const histRecords = history || []

  const now = new Date()
  let overdueCount = 0
  let dueSoonCount = 0
  const categoryMap = new Map<string, number>()

  schedRecords.forEach((s: any) => {
    if (!s.is_active) return
    const dueDate = s.next_due_date ? new Date(s.next_due_date) : null
    if (dueDate && dueDate < now) overdueCount++
    else if (dueDate && dueDate <= new Date(now.getTime() + 7 * 86400000)) dueSoonCount++
    const cat = s.category || s.maintenance_type || 'General'
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
  })

  let totalHistoryCost = 0
  histRecords.forEach((h: any) => { totalHistoryCost += h.total_cost || 0 })

  const summaryData = [
    ['Maintenance Schedule Report'],
    ['Generated', new Date().toISOString()],
    [''],
    ['Schedule Statistics'],
    ['Total Schedules', schedRecords.length],
    ['Active Schedules', schedRecords.filter((s: any) => s.is_active).length],
    ['Overdue', overdueCount],
    ['Due Within 7 Days', dueSoonCount],
    [''],
    ['History Statistics'],
    ['Total Completed', histRecords.length],
    ['Total Maintenance Cost (USD)', totalHistoryCost.toFixed(2)],
    [''],
    ['By Category'],
    ...Array.from(categoryMap.entries()).map(([c, n]) => [c, n]),
  ]

  const schedDetailsData = [
    ['Vehicle ID', 'Service Type', 'Title', 'Category', 'Frequency', 'Next Due', 'Last Completed', 'Priority', 'Assigned To', 'Active', 'Auto Job Card'],
    ...schedRecords.slice(0, 1000).map((s: any) => [
      s.vehicle_id || '',
      s.service_type || '',
      s.title || '',
      s.category || '',
      s.frequency || '',
      s.next_due_date || '',
      s.last_completed_date || '',
      s.priority || '',
      s.assigned_to || '',
      s.is_active ? 'Yes' : 'No',
      s.auto_create_job_card ? 'Yes' : 'No',
    ])
  ]

  const histDetailsData = [
    ['Schedule ID', 'Scheduled Date', 'Completed Date', 'Status', 'Completed By', 'Odometer', 'Duration (hrs)', 'Labor (hrs)', 'Cost (USD)', 'Job Card ID', 'Notes'],
    ...histRecords.slice(0, 1000).map((h: any) => [
      h.schedule_id || '',
      h.scheduled_date || '',
      h.completed_date || '',
      h.status || '',
      h.completed_by || '',
      h.odometer_reading || '',
      h.duration_hours || '',
      h.labor_hours || '',
      h.total_cost || '',
      h.job_card_id || '',
      h.notes || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Maintenance Summary', data: summaryData },
    { name: 'Maintenance Schedules', data: schedDetailsData },
    { name: 'Maintenance History', data: histDetailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Maintenance reports synced',
    sheets_updated: ['Maintenance Summary', 'Maintenance Schedules', 'Maintenance History'],
    schedules_processed: schedRecords.length,
    history_processed: histRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Breakdown Reports to Google Sheets
async function syncBreakdownReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  let bdQuery = supabase
    .from('fleet_breakdowns')
    .select('*')
    .order('breakdown_date', { ascending: false })

  if (startDate) {
    bdQuery = bdQuery.gte('breakdown_date', startDate.toISOString().split('T')[0])
  }

  const { data: breakdowns, error: bdError } = await bdQuery
  if (bdError) throw new Error(`Failed to fetch breakdowns: ${bdError.message}`)

  const bdRecords = breakdowns || []

  const categoryMap = new Map<string, number>()
  const severityMap = new Map<string, number>()
  const statusMap = new Map<string, number>()

  bdRecords.forEach((bd: any) => {
    categoryMap.set(bd.category || 'Unknown', (categoryMap.get(bd.category || 'Unknown') || 0) + 1)
    severityMap.set(bd.severity || 'Unknown', (severityMap.get(bd.severity || 'Unknown') || 0) + 1)
    statusMap.set(bd.status || 'Unknown', (statusMap.get(bd.status || 'Unknown') || 0) + 1)
  })

  const summaryData = [
    ['Breakdown Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Total Breakdowns', bdRecords.length],
    [''],
    ['By Category'],
    ...Array.from(categoryMap.entries()).map(([c, n]) => [c, n]),
    [''],
    ['By Severity'],
    ...Array.from(severityMap.entries()).map(([s, n]) => [s, n]),
    [''],
    ['By Status'],
    ...Array.from(statusMap.entries()).map(([s, n]) => [s, n]),
  ]

  const detailsData = [
    ['Date', 'Fleet #', 'Registration', 'Driver', 'Load #', 'Location', 'Category', 'Severity', 'Status', 'Description', 'Mechanic', 'Workshop Notes', 'Source'],
    ...bdRecords.slice(0, 1000).map((bd: any) => [
      bd.breakdown_date || '',
      bd.vehicle_fleet_number || '',
      bd.vehicle_registration || '',
      bd.driver_name || '',
      bd.load_number || '',
      bd.location || '',
      bd.category || '',
      bd.severity || '',
      bd.status || '',
      bd.description || '',
      bd.call_out_mechanic || '',
      bd.workshop_notes || '',
      bd.source_app || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Breakdown Summary', data: summaryData },
    { name: 'Breakdown Details', data: detailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Breakdown reports synced',
    sheets_updated: ['Breakdown Summary', 'Breakdown Details'],
    breakdowns_processed: bdRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Out of Commission Reports to Google Sheets
async function syncOOCReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  let oocQuery = supabase
    .from('out_of_commission_reports')
    .select('*')
    .order('report_date', { ascending: false })

  if (startDate) {
    oocQuery = oocQuery.gte('report_date', startDate.toISOString().split('T')[0])
  }

  const { data: oocReports, error: oocError } = await oocQuery
  if (oocError) throw new Error(`Failed to fetch OOC reports: ${oocError.message}`)

  const oocRecords = oocReports || []

  const detailsData = [
    ['Date', 'Time', 'Vehicle ID/License', 'Make/Model', 'Year', 'Location', 'Reason', 'Mechanic', 'Odometer/Hour Meter', 'Sign-Off Date', 'Safety Concerns'],
    ...oocRecords.map((r: any) => [
      r.report_date || '',
      r.report_time || '',
      r.vehicle_id_or_license || '',
      r.make_model || '',
      r.year || '',
      r.location || '',
      r.reason_out_of_commission || '',
      r.mechanic_name || '',
      r.odometer_hour_meter || '',
      r.sign_off_date || '',
      r.additional_notes_safety_concerns || '',
    ])
  ]

  const summaryData = [
    ['Out of Commission Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Total OOC Reports', oocRecords.length],
    ['Signed Off', oocRecords.filter((r: any) => r.sign_off_date).length],
    ['Pending Sign Off', oocRecords.filter((r: any) => !r.sign_off_date).length],
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'OOC Summary', data: summaryData },
    { name: 'OOC Details', data: detailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Out of Commission reports synced',
    sheets_updated: ['OOC Summary', 'OOC Details'],
    ooc_processed: oocRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Fuel Bunker Reports to Google Sheets
async function syncFuelBunkerReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string
): Promise<Response> {
  const { data: bunkers, error: bError } = await supabase
    .from('fuel_bunkers')
    .select('*')
    .order('name')

  if (bError) throw new Error(`Failed to fetch fuel bunkers: ${bError.message}`)

  const bunkerRecords = bunkers || []

  let totalCapacity = 0
  let totalCurrentLevel = 0

  bunkerRecords.forEach((b: any) => {
    totalCapacity += b.capacity_liters || 0
    totalCurrentLevel += b.current_level_liters || 0
  })

  const lowAlertBunkers = bunkerRecords.filter((b: any) =>
    b.min_level_alert && b.current_level_liters <= b.min_level_alert
  )

  const summaryData = [
    ['Fuel Bunker Report'],
    ['Generated', new Date().toISOString()],
    [''],
    ['Total Bunkers', bunkerRecords.length],
    ['Active Bunkers', bunkerRecords.filter((b: any) => b.is_active !== false).length],
    ['Total Capacity (L)', totalCapacity.toFixed(0)],
    ['Total Current Level (L)', totalCurrentLevel.toFixed(0)],
    ['Overall Fill %', totalCapacity > 0 ? ((totalCurrentLevel / totalCapacity) * 100).toFixed(1) + '%' : 'N/A'],
    ['Low Level Alerts', lowAlertBunkers.length],
  ]

  const detailsData = [
    ['Name', 'Fuel Type', 'Capacity (L)', 'Current Level (L)', 'Fill %', 'Min Level Alert', 'Low Alert?', 'Unit Cost (USD)', 'Location', 'Active', 'Notes'],
    ...bunkerRecords.map((b: any) => [
      b.name || '',
      b.fuel_type || '',
      b.capacity_liters || 0,
      b.current_level_liters || 0,
      b.capacity_liters > 0 ? ((b.current_level_liters / b.capacity_liters) * 100).toFixed(1) + '%' : 'N/A',
      b.min_level_alert || '',
      (b.min_level_alert && b.current_level_liters <= b.min_level_alert) ? 'YES' : 'No',
      b.unit_cost || '',
      b.location || '',
      b.is_active !== false ? 'Yes' : 'No',
      b.notes || '',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Fuel Bunker Summary', data: summaryData },
    { name: 'Fuel Bunker Details', data: detailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Fuel bunker reports synced',
    sheets_updated: ['Fuel Bunker Summary', 'Fuel Bunker Details'],
    bunkers_processed: bunkerRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

// Sync Driver Behavior Reports to Google Sheets
async function syncDriverBehaviorReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  let dbQuery = supabase
    .from('driver_behavior_events')
    .select('*')
    .order('event_date', { ascending: false })

  if (startDate) {
    dbQuery = dbQuery.gte('event_date', startDate.toISOString().split('T')[0])
  }

  const { data: events, error: dbError } = await dbQuery
  if (dbError) throw new Error(`Failed to fetch driver behavior events: ${dbError.message}`)

  const eventRecords = events || []

  const eventTypeMap = new Map<string, number>()
  const severityMap = new Map<string, number>()
  const driverMap = new Map<string, { events: number; points: number; debriefed: number }>()

  eventRecords.forEach((e: any) => {
    eventTypeMap.set(e.event_type || 'Unknown', (eventTypeMap.get(e.event_type || 'Unknown') || 0) + 1)
    severityMap.set(e.severity || 'Unknown', (severityMap.get(e.severity || 'Unknown') || 0) + 1)

    const dName = e.driver_name || 'Unknown'
    const driver = driverMap.get(dName) || { events: 0, points: 0, debriefed: 0 }
    driver.events += 1
    driver.points += e.points || 0
    if (e.debriefed_at) driver.debriefed += 1
    driverMap.set(dName, driver)
  })

  const summaryData = [
    ['Driver Behavior Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Total Events', eventRecords.length],
    ['Events Debriefed', eventRecords.filter((e: any) => e.debriefed_at).length],
    ['Follow-Up Required', eventRecords.filter((e: any) => e.follow_up_required).length],
    [''],
    ['By Event Type'],
    ...Array.from(eventTypeMap.entries()).sort((a, b) => b[1] - a[1]).map(([t, c]) => [t, c]),
    [''],
    ['By Severity'],
    ...Array.from(severityMap.entries()).map(([s, c]) => [s, c]),
  ]

  const byDriverData = [
    ['Driver', 'Total Events', 'Total Points', 'Debriefed', 'Pending Debrief'],
    ...Array.from(driverMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, d]) => [name, d.events, d.points, d.debriefed, d.events - d.debriefed])
  ]

  const detailsData = [
    ['Date', 'Time', 'Driver', 'Event Type', 'Severity', 'Points', 'Fleet #', 'Location', 'Description', 'Status', 'Debriefed At', 'Debrief By', 'Follow-Up Required'],
    ...eventRecords.slice(0, 1000).map((e: any) => [
      e.event_date || '',
      e.event_time || '',
      e.driver_name || '',
      e.event_type || '',
      e.severity || '',
      e.points || '',
      e.fleet_number || '',
      e.location || '',
      e.description || '',
      e.status || '',
      e.debriefed_at || '',
      e.debrief_conducted_by || '',
      e.follow_up_required ? 'Yes' : 'No',
    ])
  ]

  await batchUpdateSheets(accessToken, spreadsheetId, [
    { name: 'Behavior Summary', data: summaryData },
    { name: 'Behavior by Driver', data: byDriverData },
    { name: 'Behavior Events', data: detailsData },
  ])

  return new Response(JSON.stringify({
    success: true,
    message: 'Driver behavior reports synced',
    sheets_updated: ['Behavior Summary', 'Behavior by Driver', 'Behavior Events'],
    events_processed: eventRecords.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get config from environment
    const spreadsheetId = Deno.env.get('GOOGLE_SHEET_ID')
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

    if (!spreadsheetId || !serviceAccountJson) {
      throw new Error('Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON environment variables')
    }

    // Get period and type from query params
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || 'ytd'
    const syncType = url.searchParams.get('type') || 'trips' // 'trips' or 'diesel'

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate date filter
    const now = new Date()
    let startDate: Date | null = null

    switch (period) {
      case '1month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        break
      case '1year':
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all':
      default:
        startDate = null
    }

    // Get Google access token
    const accessToken = await getGoogleAccessToken(serviceAccountJson)

    // Handle Diesel Reports sync
    if (syncType === 'diesel') {
      return await syncDieselReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Tyre Reports sync
    if (syncType === 'tyres') {
      return await syncTyreReports(supabase, accessToken, spreadsheetId)
    }

    // Handle Workshop (Job Cards) Reports sync
    if (syncType === 'workshop') {
      return await syncWorkshopReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Inspections & Faults Reports sync
    if (syncType === 'inspections') {
      return await syncInspectionReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Vehicle Fleet Reports sync
    if (syncType === 'vehicles') {
      return await syncVehicleReports(supabase, accessToken, spreadsheetId)
    }

    // Handle Driver Reports sync
    if (syncType === 'drivers') {
      return await syncDriverReports(supabase, accessToken, spreadsheetId)
    }

    // Handle Incident Reports sync
    if (syncType === 'incidents') {
      return await syncIncidentReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Maintenance Schedule Reports sync
    if (syncType === 'maintenance') {
      return await syncMaintenanceReports(supabase, accessToken, spreadsheetId)
    }

    // Handle Breakdown Reports sync
    if (syncType === 'breakdowns') {
      return await syncBreakdownReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Out of Commission Reports sync
    if (syncType === 'ooc') {
      return await syncOOCReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Fuel Bunker Reports sync
    if (syncType === 'fuel-bunkers') {
      return await syncFuelBunkerReports(supabase, accessToken, spreadsheetId)
    }

    // Handle Driver Behavior Reports sync
    if (syncType === 'behavior') {
      return await syncDriverBehaviorReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle ALL reports sync
    if (syncType === 'all') {
      const syncTasks = [
        { name: 'diesel', fn: () => syncDieselReports(supabase, accessToken, spreadsheetId, startDate, period) },
        { name: 'tyres', fn: () => syncTyreReports(supabase, accessToken, spreadsheetId) },
        { name: 'workshop', fn: () => syncWorkshopReports(supabase, accessToken, spreadsheetId, startDate, period) },
        { name: 'inspections', fn: () => syncInspectionReports(supabase, accessToken, spreadsheetId, startDate, period) },
        { name: 'vehicles', fn: () => syncVehicleReports(supabase, accessToken, spreadsheetId) },
        { name: 'drivers', fn: () => syncDriverReports(supabase, accessToken, spreadsheetId) },
        { name: 'incidents', fn: () => syncIncidentReports(supabase, accessToken, spreadsheetId, startDate, period) },
        { name: 'maintenance', fn: () => syncMaintenanceReports(supabase, accessToken, spreadsheetId) },
        { name: 'breakdowns', fn: () => syncBreakdownReports(supabase, accessToken, spreadsheetId, startDate, period) },
        { name: 'ooc', fn: () => syncOOCReports(supabase, accessToken, spreadsheetId, startDate, period) },
        { name: 'fuel-bunkers', fn: () => syncFuelBunkerReports(supabase, accessToken, spreadsheetId) },
        { name: 'behavior', fn: () => syncDriverBehaviorReports(supabase, accessToken, spreadsheetId, startDate, period) },
      ]

      // Run all report types sequentially, then fall through to trip sync
      for (const task of syncTasks) {
        try {
          await task.fn()
        } catch (e) {
          console.error(`Failed to sync ${task.name}:`, e)
        }
      }

      // Trip sync continues below as the default path
    }

    // Default: Handle Trip Reports sync
    // Fetch trips
    let tripsQuery = supabase
      .from('trips')
      .select(`
        id,
        trip_number,
        driver_name,
        client_name,
        base_revenue,
        revenue_currency,
        distance_km,
        departure_date,
        arrival_date,
        status,
        origin,
        destination,
        wialon_vehicles:vehicle_id(fleet_number),
        vehicles:fleet_vehicle_id(fleet_number)
      `)
      .order('departure_date', { ascending: false })

    if (startDate) {
      tripsQuery = tripsQuery.gte('departure_date', startDate.toISOString().split('T')[0])
    }

    const { data: tripsRaw, error: tripsError } = await tripsQuery
    if (tripsError) throw new Error(`Failed to fetch trips: ${tripsError.message}`)

    const trips = (tripsRaw || []).map((trip: any) => ({
      ...trip,
      fleet_number: trip.vehicles?.fleet_number || trip.wialon_vehicles?.fleet_number || null,
    }))

    // Fetch cost entries (chunked to avoid URL length limits, paginated to get all rows)
    const tripIds = trips.map((t: any) => t.id)
    let costEntries: any[] = []

    if (tripIds.length > 0) {
      const CHUNK_SIZE = 200
      for (let i = 0; i < tripIds.length; i += CHUNK_SIZE) {
        const chunk = tripIds.slice(i, i + CHUNK_SIZE)
        let from = 0
        const PAGE_SIZE = 1000
        while (true) {
          const { data: costs, error: costError } = await supabase
            .from('cost_entries')
            .select('id, trip_id, amount, currency')
            .in('trip_id', chunk)
            .range(from, from + PAGE_SIZE - 1)
          if (costError) {
            console.error('Cost entries fetch error:', costError.message)
            break
          }
          if (costs && costs.length > 0) {
            costEntries = costEntries.concat(costs)
          }
          if (!costs || costs.length < PAGE_SIZE) break
          from += PAGE_SIZE
        }
      }
    }

    // Helper: Get costs by trip (USD only, fallback to all if no currency set)
    const getTripCosts = (tripId: string) => {
      const tripCosts = costEntries.filter((c: any) => c.trip_id === tripId)
      return tripCosts.reduce((sum: number, c: any) => {
        // Include entries with USD currency or no currency set (legacy data)
        if (!c.currency || c.currency === 'USD') {
          return sum + (c.amount || 0)
        }
        return sum
      }, 0)
    }

    // Build report data
    const clientMap = new Map<string, any>()
    const driverMap = new Map<string, any>()
    const truckMap = new Map<string, any>()
    const weeklyMap = new Map<string, any>()
    const monthlyMap = new Map<string, any>()

    let totalRevenueUSD = 0
    let totalExpensesUSD = 0
    let totalKm = 0

    trips.forEach((trip: any) => {
      const expenses = getTripCosts(trip.id)
      const revenue = trip.base_revenue || 0
      const km = trip.distance_km || 0

      // Overall totals
      totalRevenueUSD += revenue
      totalExpensesUSD += expenses
      totalKm += km

      // Client summary
      const clientName = trip.client_name || 'No Client'
      const client = clientMap.get(clientName) || { trips: 0, revenue: 0, expenses: 0 }
      client.trips += 1
      client.revenue += revenue
      client.expenses += expenses
      clientMap.set(clientName, client)

      // Driver summary
      const driverName = trip.driver_name || 'Unassigned'
      const driver = driverMap.get(driverName) || { trips: 0, km: 0, revenue: 0, expenses: 0 }
      driver.trips += 1
      driver.km += km
      driver.revenue += revenue
      driver.expenses += expenses
      driverMap.set(driverName, driver)

      // Truck summary - grouped by fleet number only
      const fleetNumber = (trip.fleet_number || '').toUpperCase().trim()
      if (fleetNumber) {
        const truck = truckMap.get(fleetNumber) || { trips: 0, km: 0, revenue: 0, expenses: 0 }
        truck.trips += 1
        truck.km += km
        truck.revenue += revenue
        truck.expenses += expenses
        truckMap.set(fleetNumber, truck)
      }

      // Weekly summary
      const dateStr = trip.arrival_date || trip.departure_date
      if (dateStr) {
        const date = new Date(dateStr)
        const weekNum = getISOWeek(date)
        const year = getISOWeekYear(date)
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`
        const week = weeklyMap.get(weekKey) || { week: weekNum, year, trips: 0, km: 0, revenue: 0, expenses: 0 }
        week.trips += 1
        week.km += km
        week.revenue += revenue
        week.expenses += expenses
        weeklyMap.set(weekKey, week)

        // Monthly summary
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const month = monthlyMap.get(monthKey) || { month: monthNames[date.getMonth()], year: date.getFullYear(), trips: 0, km: 0, revenue: 0, expenses: 0 }
        month.trips += 1
        month.km += km
        month.revenue += revenue
        month.expenses += expenses
        monthlyMap.set(monthKey, month)
      }
    })

    // Prepare sheet data

    // Summary sheet
    const marginUSD = totalRevenueUSD > 0 ? ((totalRevenueUSD - totalExpensesUSD) / totalRevenueUSD * 100).toFixed(2) + '%' : '0%'

    const summaryData = [
      ['Trip Reports Summary'],
      ['Period', period],
      ['Generated', new Date().toISOString()],
      [''],
      ['Overall Statistics'],
      ['Total Trips', trips.length],
      ['Total Kilometers', totalKm],
      [''],
      ['Financial Summary (USD)'],
      ['Revenue (USD)', totalRevenueUSD],
      ['Expenses (USD)', totalExpensesUSD],
      ['Net Profit (USD)', totalRevenueUSD - totalExpensesUSD],
      ['Profit Margin (USD)', marginUSD],
    ]

    // Client sheet
    const clientData = [
      ['Client', 'Trips', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'],
      ...Array.from(clientMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, d]) => [name, d.trips, d.revenue, d.expenses, d.revenue - d.expenses])
    ]

    // Driver sheet
    const driverData = [
      ['Driver', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'],
      ...Array.from(driverMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, d]) => [name, d.trips, d.km, d.revenue, d.expenses, d.revenue - d.expenses])
    ]

    // Truck sheet
    const truckData = [
      ['Truck', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'],
      ...Array.from(truckMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([name, d]) => [name, d.trips, d.km, d.revenue, d.expenses, d.revenue - d.expenses])
    ]

    // Weekly sheet
    const weeklyData = [
      ['Week', 'Year', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'],
      ...Array.from(weeklyMap.values())
        .sort((a, b) => `${a.year}-${String(a.week).padStart(2, '0')}`.localeCompare(`${b.year}-${String(b.week).padStart(2, '0')}`))
        .map(d => [d.week, d.year, d.trips, d.km, d.revenue, d.expenses, d.revenue - d.expenses])
    ]

    // Monthly sheet
    const monthlyData = [
      ['Month', 'Year', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'],
      ...Array.from(monthlyMap.values())
        .sort((a, b) => `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`))
        .map(d => [d.month, d.year, d.trips, d.km, d.revenue, d.expenses, d.revenue - d.expenses])
    ]

    // Update each sheet
    await batchUpdateSheets(accessToken, spreadsheetId, [
      { name: 'Summary', data: summaryData },
      { name: 'By Client', data: clientData },
      { name: 'By Driver', data: driverData },
      { name: 'By Truck', data: truckData },
      { name: 'Weekly', data: weeklyData },
      { name: 'Monthly', data: monthlyData },
    ])

    return new Response(JSON.stringify({
      success: true,
      message: syncType === 'all' ? 'All reports synced to Google Sheets successfully' : 'Google Sheet updated successfully',
      updated_at: new Date().toISOString(),
      period: period,
      sync_type: syncType,
      trips_processed: trips.length,
      sheets_updated: syncType === 'all'
        ? ['Summary', 'By Client', 'By Driver', 'By Truck', 'Weekly', 'Monthly',
          'Diesel Summary', 'Diesel by Fleet', 'Diesel by Driver', 'Diesel by Station', 'Diesel Weekly', 'Diesel Monthly', 'Diesel Transactions',
          'Reefer Summary', 'Reefer by Fleet', 'Reefer by Driver', 'Reefer by Station', 'Reefer Weekly', 'Reefer Monthly', 'Reefer Transactions',
          'Tyre Summary', 'Tyres by Size', 'Tyres by Position', 'Tyre Inventory', 'Tyre Details',
          'Workshop Summary', 'Workshop by Assignee', 'Workshop by Vehicle', 'Workshop Monthly', 'Workshop Job Cards', 'Workshop Parts',
          'Inspection Summary', 'Inspection Details', 'Fault Details',
          'Vehicle Summary', 'Vehicle Details', 'Vehicle Documents',
          'Driver Summary', 'Driver Details', 'Driver Documents',
          'Incident Summary', 'Incident Details',
          'Maintenance Summary', 'Maintenance Schedules', 'Maintenance History',
          'Breakdown Summary', 'Breakdown Details',
          'OOC Summary', 'OOC Details',
          'Fuel Bunker Summary', 'Fuel Bunker Details',
          'Behavior Summary', 'Behavior by Driver', 'Behavior Events']
        : ['Summary', 'By Client', 'By Driver', 'By Truck', 'Weekly', 'Monthly'],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper: Get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Helper: Get ISO week year
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}
