// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/toaster";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaUpdatePrompt } from "@/components/pwa-update-prompt";
import App from "@/App";
import "@/index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: "always",
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
                    return false;
                }
                return failureCount < 2;
            },
        },
    },
});

// NOTE: Service worker is registered by vite-plugin-pwa (registerType: "autoUpdate").
// Do NOT manually register /sw.js here — it conflicts with the plugin's lifecycle.

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
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
    </React.StrictMode>
);