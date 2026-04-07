// src/App.tsx
import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { Loader2 } from "lucide-react";

// Pages
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import TripPage from "@/pages/TripPage";
import DieselPage from "@/pages/DieselPage";
import ExpensesPage from "@/pages/ExpensesPage";
import ProfilePage from "@/pages/ProfilePage";
import DocumentsPage from "@/pages/DocumentsPage";

/**
 * ProtectedRoute with a grace period for transient null-user states.
 *
 * During token refresh and navigator lock recovery, `user` can flash to null
 * for a few hundred milliseconds. Without a grace period, the route redirects
 * to /login and unmounts all child components, wiping query caches and realtime
 * subscriptions. The 1.5s grace only applies when the user was previously
 * authenticated — first-load redirects are still instant.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading, isSigningOut } = useAuth();
    const hadUserRef = useRef(false);
    const [showLogin, setShowLogin] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track whether we ever had a user
    if (user) {
        hadUserRef.current = true;
    }

    useEffect(() => {
        // Clear previous timer on every render
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (isLoading || user) {
            // Loading or user present — no redirect needed
            setShowLogin(false);
            return;
        }

        // User is null and not loading
        if (!hadUserRef.current || isSigningOut) {
            // Never had a user OR intentional sign-out — redirect immediately
            setShowLogin(true);
            return;
        }

        // Previously had a user — give a grace period for token refresh
        timerRef.current = setTimeout(() => {
            setShowLogin(true);
        }, 1500);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [user, isLoading, isSigningOut]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm font-medium">Loading…</p>
                </div>
            </div>
        );
    }

    // During grace period, show a loading spinner instead of redirecting
    if (!user && !showLogin) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm font-medium">Reconnecting…</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

export default function App() {
    // Inactivity timeout lives here (stable mount) instead of per-page
    // MobileShell, which unmounts/remounts on every navigation and caused
    // timer thrashing + stale closures over the user object.
    useInactivityTimeout();

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <HomePage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/trip"
                element={
                    <ProtectedRoute>
                        <TripPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/diesel"
                element={
                    <ProtectedRoute>
                        <DieselPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/expenses"
                element={
                    <ProtectedRoute>
                        <ExpensesPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <ProfilePage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile/documents"
                element={
                    <ProtectedRoute>
                        <DocumentsPage />
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}