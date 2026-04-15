// src/lib/error-logger.ts
// Comprehensive diagnostic logger for debugging data-loss-on-refresh issues.
// Exposes window.debugApp() for interactive console diagnostics.

import { loadSessionFromIndexedDB } from "@/lib/session-persistence";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiagEvent {
    ts: string;          // ISO timestamp
    kind: string;        // auth | query | storage | network | visibility
    message: string;
    data?: unknown;
}

// ─── Event Ring Buffer (last 80 events) ──────────────────────────────────────

const MAX_EVENTS = 80;
const events: DiagEvent[] = [];

function push(kind: string, message: string, data?: unknown) {
    const entry: DiagEvent = {
        ts: new Date().toISOString(),
        kind,
        message,
        data,
    };
    events.push(entry);
    if (events.length > MAX_EVENTS) events.shift();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const diagLogger = {
    // ── Auth lifecycle events ──────────────────────────────────────────────────
    authEvent(event: string, detail?: unknown) {
        push("auth", event, detail);
        console.log(`🔐 [DIAG][AUTH] ${event}`, detail ?? "");
    },

    // ── Query lifecycle events ─────────────────────────────────────────────────
    queryStart(queryKey: string, enabled: boolean) {
        push("query", `START ${queryKey}`, { enabled });
    },

    querySuccess(queryKey: string, rowCount: number) {
        push("query", `OK ${queryKey}`, { rows: rowCount });
        if (rowCount === 0) {
            console.warn(`⚠️ [DIAG][QUERY] ${queryKey} returned 0 rows`);
        }
    },

    queryError(queryKey: string, error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        push("query", `ERR ${queryKey}`, { error: msg });
        console.error(`❌ [DIAG][QUERY] ${queryKey} failed:`, msg);
    },

    // ── Storage diagnostics ────────────────────────────────────────────────────
    async checkStorage(): Promise<Record<string, unknown>> {
        const report: Record<string, unknown> = {};

        // 1. Check all mata/supabase/auth localStorage keys
        const allKeys = Object.keys(localStorage);
        const relevantKeys = allKeys.filter(
            k => k.includes("mata") || k.includes("supabase") || k.includes("auth")
        );

        report.localStorage = {};
        for (const key of relevantKeys) {
            const raw = localStorage.getItem(key);
            if (!raw) {
                (report.localStorage as Record<string, unknown>)[key] = { exists: false };
                continue;
            }
            // Some keys (like mata_last_email) store plain strings, not JSON
            let isJson = false;
            let hasTokens = false;
            try {
                const parsed = JSON.parse(raw);
                isJson = true;
                // Check if it looks like a session
                if (parsed?.access_token || parsed?.currentSession?.access_token) {
                    hasTokens = true;
                }
            } catch { /* not JSON — that's fine for some keys */ }

            (report.localStorage as Record<string, unknown>)[key] = {
                exists: true,
                size: raw.length,
                isJson,
                hasTokens,
                preview: raw.substring(0, 60) + (raw.length > 60 ? "…" : ""),
            };
        }

        // 2. Specifically check the critical session key
        const sessionKey = "mata-driver-auth";
        const sessionRaw = localStorage.getItem(sessionKey);
        report.sdkSessionInLocalStorage = !!sessionRaw;
        if (sessionRaw) {
            try {
                const parsed = JSON.parse(sessionRaw);
                const expiresAt = parsed?.expires_at ?? parsed?.currentSession?.expires_at;
                report.sdkSessionExpired = expiresAt
                    ? expiresAt * 1000 < Date.now()
                    : "unknown";
                report.sdkSessionUserId =
                    parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? "missing";
            } catch {
                report.sdkSessionCorrupt = true;
            }
        }

        // 3. Check backup session key
        const backupRaw = localStorage.getItem("mata-driver-session-backup");
        report.backupSessionInLocalStorage = !!backupRaw;

        // 4. Check IndexedDB
        try {
            const idbSession = await loadSessionFromIndexedDB();
            report.indexedDB = {
                hasSession: !!idbSession,
                hasAccessToken: !!idbSession?.access_token,
                hasRefreshToken: !!idbSession?.refresh_token,
                userId: idbSession?.user?.id ?? "missing",
            };
        } catch (err) {
            report.indexedDB = { error: err instanceof Error ? err.message : String(err) };
        }

        // 5. Check cached profile
        const profileRaw = localStorage.getItem("mata-driver-profile");
        report.cachedProfile = profileRaw ? "present" : "missing";

        return report;
    },

    // ── Supabase SDK session check ─────────────────────────────────────────────
    async checkSupabaseSession(supabase: {
        auth: {
            getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
        };
    }): Promise<Record<string, unknown>> {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            const s = session as {
                user?: { id?: string; email?: string };
                access_token?: string;
                expires_at?: number;
            } | null;
            return {
                hasSession: !!s,
                error: error ? String(error) : null,
                userId: s?.user?.id ?? "none",
                email: s?.user?.email ?? "none",
                hasAccessToken: !!s?.access_token,
                expired: s?.expires_at ? s.expires_at * 1000 < Date.now() : "unknown",
                expiresAt: s?.expires_at
                    ? new Date(s.expires_at * 1000).toISOString()
                    : null,
            };
        } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    },

    // ── Full diagnostic dump ───────────────────────────────────────────────────
    async dumpAll(supabase?: {
        auth: {
            getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
        };
    }) {
        console.group("🩺 FULL APP DIAGNOSTIC");

        // 1. Storage
        const storage = await this.checkStorage();
        console.log("💾 Storage:", storage);

        // 2. Supabase SDK session
        if (supabase) {
            const sdkSession = await this.checkSupabaseSession(supabase);
            console.log("🔐 SDK Session:", sdkSession);
        }

        // 3. Network
        console.log("🌐 Network:", { online: navigator.onLine });

        // 4. Recent events timeline
        console.log(`📜 Event log (last ${events.length} events):`);
        const grouped: Record<string, DiagEvent[]> = {};
        for (const e of events) {
            (grouped[e.kind] ??= []).push(e);
        }
        for (const [kind, items] of Object.entries(grouped)) {
            console.groupCollapsed(`  [${kind}] (${items.length} events)`);
            for (const item of items) {
                const time = item.ts.split("T")[1]?.split(".")[0] ?? item.ts;
                console.log(`  ${time} ${item.message}`, item.data ?? "");
            }
            console.groupEnd();
        }

        // 5. TanStack Query cache snapshot (if available via window)
        const win = window as unknown as {
            __REACT_QUERY_CLIENT__?: {
                getQueryCache: () => {
                    getAll: () => Array<{
                        queryKey: unknown[];
                        state: { status: string; dataUpdatedAt: number; errorUpdatedAt: number; fetchStatus: string; error?: unknown };
                    }>;
                };
            }
        };
        if (win.__REACT_QUERY_CLIENT__) {
            const queries = win.__REACT_QUERY_CLIENT__.getQueryCache().getAll();
            const summary = queries.map(q => ({
                key: JSON.stringify(q.queryKey),
                status: q.state.status,
                fetchStatus: q.state.fetchStatus,
                hasData: q.state.dataUpdatedAt > 0,
                dataAge: q.state.dataUpdatedAt
                    ? `${Math.round((Date.now() - q.state.dataUpdatedAt) / 1000)}s ago`
                    : "never",
                error: q.state.error
                    ? (q.state.error as Error).message ?? String(q.state.error)
                    : null,
            }));
            console.table(summary);
        } else {
            console.log("(TanStack Query cache not exposed — call exposeQueryClient(queryClient) in main.tsx)");
        }

        // 6. Auth error history
        try {
            const authErrors = JSON.parse(localStorage.getItem("auth-errors") || "[]");
            if (authErrors.length > 0) {
                console.log("🚨 Auth error history:", authErrors);
            }
        } catch { /* ignore */ }

        console.groupEnd();
    },

    // ── Get events for programmatic access ─────────────────────────────────────
    getEvents: () => [...events],
};

// ── Expose query client from main.tsx ────────────────────────────────────────
// Call this from main.tsx after creating the QueryClient so dumpAll() can
// inspect the TanStack Query cache.
export function exposeQueryClient(qc: unknown) {
    (window as unknown as { __REACT_QUERY_CLIENT__: unknown }).__REACT_QUERY_CLIENT__ = qc;
}

// ── Expose window.debugApp() ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
    const win = window as unknown as {
        debugApp: () => void;
        debugQueries: () => void;
        debugStorage: () => void;
        debugEvents: () => void;
    };

    win.debugApp = () => {
        const w = window as unknown as {
            __SUPABASE_CLIENT__?: {
                auth: { getSession: () => Promise<{ data: { session: unknown }; error: unknown }> };
            }
        };
        diagLogger.dumpAll(w.__SUPABASE_CLIENT__ ?? undefined).catch(console.error);
    };

    win.debugQueries = () => {
        const w = window as unknown as {
            __REACT_QUERY_CLIENT__?: {
                getQueryCache: () => {
                    getAll: () => Array<{
                        queryKey: unknown[];
                        state: { status: string; dataUpdatedAt: number; fetchStatus: string; error?: unknown };
                    }>;
                };
            }
        };
        if (!w.__REACT_QUERY_CLIENT__) {
            console.warn("QueryClient not exposed. Check main.tsx.");
            return;
        }
        const queries = w.__REACT_QUERY_CLIENT__.getQueryCache().getAll();
        console.table(
            queries.map(q => ({
                key: JSON.stringify(q.queryKey),
                status: q.state.status,
                fetchStatus: q.state.fetchStatus,
                hasData: q.state.dataUpdatedAt > 0,
                dataAge: q.state.dataUpdatedAt
                    ? `${Math.round((Date.now() - q.state.dataUpdatedAt) / 1000)}s ago`
                    : "never",
                error: q.state.error
                    ? (q.state.error as Error).message ?? String(q.state.error)
                    : null,
            }))
        );
    };

    win.debugStorage = () => {
        diagLogger.checkStorage().then(r => console.log("💾 Storage:", r)).catch(console.error);
    };

    win.debugEvents = () => {
        for (const e of events) {
            const time = e.ts.split("T")[1]?.split(".")[0] ?? e.ts;
            console.log(`[${e.kind}] ${time} ${e.message}`, e.data ?? "");
        }
    };
}