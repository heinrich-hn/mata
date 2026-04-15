// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/toaster";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaUpdatePrompt } from "@/components/pwa-update-prompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "@/App";
import "@/index.css";
// Side-effect: registers window.debugApp / debugQueries / debugStorage / debugEvents
import { exposeQueryClient } from "@/lib/error-logger";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            // IMPORTANT: refetchOnWindowFocus is disabled globally.
            // The visibility-change handler in auth-context refreshes the
            // session first, THEN calls queryClient.invalidateQueries() to
            // trigger refetches.  If we let React Query refetch on focus
            // as well, queries fire BEFORE the session is refreshed and hit
            // PostgREST with an expired/missing token → empty results via RLS.
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
            retry: (failureCount, error) => {
                const msg = (error as Error)?.message?.toLowerCase() ?? "";
                if (
                    msg.includes("jwt") ||
                    msg.includes("token") ||
                    msg.includes("unauthorized") ||
                    msg.includes("refresh_token")
                ) {
                    // Allow 1 retry for auth errors — the SDK may still be
                    // refreshing the token when the first attempt fires.
                    return failureCount < 1;
                }
                return failureCount < 2;
            },
            retryDelay: (attemptIndex, error) => {
                const msg = (error as Error)?.message?.toLowerCase() ?? "";
                if (
                    msg.includes("jwt") ||
                    msg.includes("token") ||
                    msg.includes("unauthorized") ||
                    msg.includes("refresh_token")
                ) {
                    // 2s delay gives the SDK time to finish token refresh
                    return 2000;
                }
                return Math.min(1000 * 2 ** attemptIndex, 5000);
            },
        },
    },
});

// Expose queryClient so window.debugApp() / debugQueries() can inspect the cache
exposeQueryClient(queryClient);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AuthProvider>
                        <App />
                        <PwaInstallPrompt />
                        <PwaUpdatePrompt />
                        <Toaster />
                    </AuthProvider>
                </BrowserRouter>
            </QueryClientProvider>
        </ErrorBoundary>
    </React.StrictMode>
);