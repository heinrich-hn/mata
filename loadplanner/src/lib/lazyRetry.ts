/**
 * Wraps a dynamic import with retry logic to handle chunk loading failures
 * after new deployments (stale HTML referencing old chunk hashes).
 *
 * On failure it forces a single full-page reload so the browser fetches the
 * latest HTML with updated chunk URLs.
 */
export function lazyRetry<T extends React.ComponentType<unknown>>(
    importFn: () => Promise<{ default: T }>,
): () => Promise<{ default: T }> {
    return async () => {
        const storageKey = "chunk_reload_done";

        try {
            const module = await importFn();
            // Success — clear the flag so future deploys can still trigger a reload
            sessionStorage.removeItem(storageKey);
            return module;
        } catch {
            // Only auto-reload once to avoid infinite reload loops
            if (!sessionStorage.getItem(storageKey)) {
                sessionStorage.setItem(storageKey, "true");
                window.location.reload();
                // Return a never-resolving promise so React doesn't render in the meantime
                return new Promise(() => { });
            }

            // Already reloaded once — re-throw so ErrorBoundary shows fallback
            throw new Error(
                "Failed to load page after refresh. Please clear your cache and try again.",
            );
        }
    };
}
