import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Automatic PWA updater — no user interaction required.
 *
 * Flow:
 *   1. On mount + every 5 min + every tab-foreground: calls reg.update()
 *   2. When a new SW installs → tells it to skipWaiting (belt & suspenders
 *      alongside next-pwa's skipWaiting:true)
 *   3. On controllerchange (new SW took over) → clears caches → reloads
 *   4. Shows a brief "Updating…" splash during the reload so the user
 *      doesn't think the app froze.
 */
export function PwaUpdatePrompt() {
    const [isUpdating, setIsUpdating] = useState(false);
    const reloadingRef = useRef(false);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        let registration: ServiceWorkerRegistration | null = null;

        // ── Force-activate a waiting worker ──────────────────────────
        const activateWaiting = (worker: ServiceWorker) => {
            worker.postMessage({ type: "SKIP_WAITING" });
        };

        // ── When the browser installs a fresh SW ─────────────────────
        const watchForNewWorker = (reg: ServiceWorkerRegistration) => {
            // Already a worker waiting? Activate it immediately.
            if (reg.waiting) {
                activateWaiting(reg.waiting);
            }

            reg.addEventListener("updatefound", () => {
                const installing = reg.installing;
                if (!installing) return;

                installing.addEventListener("statechange", () => {
                    // installed + an old controller exists → new version ready
                    if (installing.state === "installed" && navigator.serviceWorker.controller) {
                        activateWaiting(installing);
                    }
                });
            });
        };

        // ── When the new SW activates → reload ──────────────────────
        const onControllerChange = async () => {
            if (reloadingRef.current) return;
            reloadingRef.current = true;
            setIsUpdating(true);

            // Clear all caches so the reload gets fresh assets
            try {
                if ("caches" in window) {
                    const names = await caches.keys();
                    await Promise.allSettled(names.map((n) => caches.delete(n)));
                }
            } catch {
                // non-critical
            }

            window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        // ── Check for updates ────────────────────────────────────────
        const checkForUpdate = () => {
            registration?.update().catch(() => { });
        };

        // Grab the current registration
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (!reg) return;
            registration = reg;
            watchForNewWorker(reg);
            // Immediate check on mount
            checkForUpdate();
        });

        // Poll every 5 minutes
        const interval = setInterval(checkForUpdate, 5 * 60 * 1000);

        // Also check whenever the app comes back to the foreground
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkForUpdate();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            clearInterval(interval);
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    if (!isUpdating) return null;

    // Brief full-screen splash while the page reloads
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm safe-area-top safe-area-bottom">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm font-semibold text-foreground">Updating app…</p>
            <p className="text-xs text-muted-foreground mt-1">This will only take a moment</p>
        </div>
    );
}
