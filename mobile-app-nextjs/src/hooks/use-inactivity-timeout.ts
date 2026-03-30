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
 */
export function useInactivityTimeout() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const signingOutRef = useRef(false);

    const performSignOut = useCallback(async () => {
        if (signingOutRef.current || !user) return;
        signingOutRef.current = true;

        // Persist email for quick re-login
        if (user.email) {
            try {
                localStorage.setItem(LAST_EMAIL_KEY, user.email);
            } catch {
                // storage full / blocked — non-critical
            }
        }

        try {
            await signOut();
        } catch {
            // continue regardless
        }

        navigate("/login", { replace: true });
    }, [user, signOut, navigate]);

    const resetTimer = useCallback(() => {
        if (signingOutRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(performSignOut, INACTIVITY_TIMEOUT_MS);
    }, [performSignOut]);

    useEffect(() => {
        if (!user) return; // only when authenticated
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
    }, [user, resetTimer]);
}
