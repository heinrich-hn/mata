import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useNavigate } from "react-router-dom";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const LAST_EMAIL_KEY = "mata_last_email";

/**
 * Signs the user out after 5 minutes of inactivity.
 * Saves the last email to localStorage so the login form can pre-fill it.
 *
 * Activity = touchstart | pointerdown | keydown | scroll | visibilitychange (visible)
 *
 * Designed to be called ONCE from App.tsx (stable mount) rather than per-page
 * MobileShell, which unmounts/remounts on navigation and caused timer thrashing.
 */
export function useInactivityTimeout() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const signingOutRef = useRef(false);

    // Use refs for values used in the timeout callback so we don't
    // need to recreate the timer on every auth state change.
    const userRef = useRef(user);
    const signOutRef = useRef(signOut);
    const navigateRef = useRef(navigate);
    userRef.current = user;
    signOutRef.current = signOut;
    navigateRef.current = navigate;

    const performSignOut = useCallback(async () => {
        if (signingOutRef.current || !userRef.current) return;
        signingOutRef.current = true;

        // Persist email for quick re-login
        if (userRef.current.email) {
            try {
                localStorage.setItem(LAST_EMAIL_KEY, userRef.current.email);
            } catch {
                // storage full / blocked — non-critical
            }
        }

        try {
            await signOutRef.current();
        } catch {
            // continue regardless
        }

        navigateRef.current("/login", { replace: true });
    }, []); // stable — reads from refs

    const resetTimer = useCallback(() => {
        if (signingOutRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(performSignOut, INACTIVITY_TIMEOUT_MS);
    }, [performSignOut]); // stable — performSignOut never changes

    const isAuthenticated = !!user;

    useEffect(() => {
        if (!isAuthenticated) return; // only when authenticated
        signingOutRef.current = false;

        // Start the first timer
        resetTimer();

        const activityEvents: (keyof DocumentEventMap)[] = [
            "touchstart",
            "pointerdown",
            "keydown",
            "scroll",
        ];

        const onActivity = () => resetTimer();

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                resetTimer();
            }
        };

        activityEvents.forEach((evt) =>
            document.addEventListener(evt, onActivity, { passive: true, capture: true })
        );
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            activityEvents.forEach((evt) =>
                document.removeEventListener(evt, onActivity, { capture: true })
            );
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [isAuthenticated, resetTimer]); // Only re-run when user presence changes (not on every object ref change)
}
