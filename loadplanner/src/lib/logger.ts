/**
 * Central logger + global error capture for LoadPlanner.
 *
 * Provides consistent, namespaced console output and surfaces all otherwise
 * uncaught errors (window errors, promise rejections, query/mutation errors)
 * with both a console entry and a user-visible toast.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Trips', 'fetched %d loads', loads.length);
 *   logger.error('Trips', 'failed to fetch loads', err);
 *
 * Inspect recent errors at runtime:
 *   window.__lpDebug.errors  // array of last N errors
 *   window.__lpDebug.dump()  // pretty-print to console
 */

import { toast } from '@/components/ui/sonner';

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    ts: string;
    level: Level;
    scope: string;
    message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any;
}

const MAX_ENTRIES = 200;
const buffer: LogEntry[] = [];

function pushEntry(entry: LogEntry) {
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) buffer.shift();
}

function fmtScope(scope: string) {
    return `[${scope}]`;
}

function emit(level: Level, scope: string, message: string, details?: unknown) {
    const entry: LogEntry = {
        ts: new Date().toISOString(),
        level,
        scope,
        message,
        details,
    };
    pushEntry(entry);

    const tag = fmtScope(scope);
    switch (level) {
        case 'debug':
            console.debug(tag, message, details ?? '');
            break;
        case 'info':
            console.log(tag, message, details ?? '');
            break;
        case 'warn':
            console.warn(tag, message, details ?? '');
            break;
        case 'error':
            console.error(tag, message, details ?? '');
            break;
    }
}

export const logger = {
    debug: (scope: string, message: string, details?: unknown) =>
        emit('debug', scope, message, details),
    info: (scope: string, message: string, details?: unknown) =>
        emit('info', scope, message, details),
    warn: (scope: string, message: string, details?: unknown) =>
        emit('warn', scope, message, details),
    error: (scope: string, message: string, details?: unknown) =>
        emit('error', scope, message, details),
    /** Last N captured log entries (debug-only). */
    entries: () => [...buffer],
    /** Last N captured error entries. */
    errors: () => buffer.filter((e) => e.level === 'error'),
};

/**
 * Toast helper used by global handlers. Sonner has rate-limit per-id so we use
 * a stable id per scope+message to avoid toast spam during error storms.
 */
function reportToUser(title: string, description?: string) {
    try {
        toast.error(title, {
            description,
            // dedupe storms of the same error
            id: `${title}::${description ?? ''}`.slice(0, 120),
        });
    } catch {
        // toast might not be ready during early bootstrap; ignore
    }
}

let installed = false;

/**
 * Install global error handlers. Safe to call multiple times.
 * Intended to be invoked once from the app entrypoint (`main.tsx`).
 */
export function installGlobalErrorHandlers() {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    window.addEventListener('error', (event) => {
        const err = event.error ?? event.message;
        const message = err instanceof Error ? err.message : String(err);
        logger.error('window.error', message, {
            source: event.filename,
            line: event.lineno,
            col: event.colno,
            stack: err instanceof Error ? err.stack : undefined,
        });
        reportToUser('Unexpected error', message);
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const message =
            reason instanceof Error
                ? reason.message
                : typeof reason === 'string'
                    ? reason
                    : 'Unhandled promise rejection';
        logger.error('unhandledrejection', message, {
            stack: reason instanceof Error ? reason.stack : undefined,
            reason,
        });
        reportToUser('Background task failed', message);
    });

    // Expose a tiny debug helper on the window for ad-hoc inspection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__lpDebug = {
        errors: () => logger.errors(),
        entries: () => logger.entries(),
        dump: () => {
            console.groupCollapsed('[LoadPlanner debug] last log entries');
            logger.entries().forEach((e) => {
                const fn =
                    e.level === 'error' ? console.error :
                        e.level === 'warn' ? console.warn :
                            console.log;
                fn(`${e.ts} [${e.scope}]`, e.message, e.details ?? '');
            });
            console.groupEnd();
        },
    };

    logger.info('logger', 'Global error handlers installed');
}

export { reportToUser };
