// src/App.tsx
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OperationsProvider } from "@/contexts/OperationsContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Light pages loaded eagerly
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Retry dynamic imports once on failure (handles stale chunks after redeployment)
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return React.lazy(() =>
    importFn().catch(() => {
      // If chunk fails to load, reload the page to get fresh index.html
      window.location.reload();
      // Return a never-resolving promise to prevent rendering stale UI
      return new Promise(() => { });
    })
  );
}

// Heavy pages lazy-loaded for code splitting
const ActionLog = lazyWithRetry(() => import("./pages/ActionLog"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Analytics = lazyWithRetry(() => import("./pages/Analytics"));
const CostManagement = lazyWithRetry(() => import("./pages/CostManagement"));
const DieselManagement = lazyWithRetry(() => import("./pages/DieselManagement"));
const DriverManagement = lazyWithRetry(() => import("./pages/DriverManagement"));
const FuelBunkers = lazyWithRetry(() => import("./pages/FuelBunkers"));
const Incidents = lazyWithRetry(() => import("./pages/Incidents"));
const InspectionDetails = lazyWithRetry(() => import("./pages/InspectionDetails"));
const Inspections = lazyWithRetry(() => import("./pages/Inspections"));
const InspectorProfiles = lazyWithRetry(() => import("./pages/InspectorProfiles"));
const Invoicing = lazyWithRetry(() => import("./pages/Invoicing"));
const JobCardDetails = lazyWithRetry(() => import("./pages/JobCardDetails"));
const JobCards = lazyWithRetry(() => import("./pages/JobCards"));
const MaintenanceScheduling = lazyWithRetry(() => import("./pages/MaintenanceScheduling"));
const MobileInspections = lazyWithRetry(() => import("./pages/MobileInspections"));
const PerformanceAnalytics = lazyWithRetry(() => import("./pages/PerformanceAnalytics"));
const Procurement = lazyWithRetry(() => import("./pages/Procurement"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const TripManagement = lazyWithRetry(() => import("./pages/TripManagement"));
const TyreInspections = lazyWithRetry(() => import("./pages/TyreInspections"));
const TyreManagement = lazyWithRetry(() => import("./pages/TyreManagement"));
const UnifiedMapPage = lazyWithRetry(() => import("./pages/UnifiedMapPage"));
const Vehicles = lazyWithRetry(() => import("./pages/Vehicles"));
const Vendors = lazyWithRetry(() => import("./pages/Vendors"));

// Lazy-loaded sub-route component
const InspectionTypeSelector = lazyWithRetry(() => import("./components/inspections/InspectionTypeSelector"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OperationsProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Toaster />
            <Sonner />
            <PWAInstallPrompt autoShowDelay={60000} />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />

                  {/* Workshop Routes */}
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/job-cards" element={<ProtectedRoute><JobCards /></ProtectedRoute>} />
                  <Route path="/job-card/:id" element={<ProtectedRoute><JobCardDetails /></ProtectedRoute>} />
                  <Route path="/inspections" element={<ProtectedRoute><Inspections /></ProtectedRoute>} />
                  <Route path="/inspections/:id" element={<ProtectedRoute><InspectionDetails /></ProtectedRoute>} />
                  <Route path="/inspections/mobile" element={<ProtectedRoute><MobileInspections /></ProtectedRoute>} />
                  <Route path="/inspections/type-selector" element={<ProtectedRoute><InspectionTypeSelector /></ProtectedRoute>} />
                  <Route path="/inspections/tyre" element={<ProtectedRoute><TyreInspections /></ProtectedRoute>} />
                  <Route path="/faults" element={<Navigate to="/inspections" replace />} /> {/* Faults merged into Inspections */}
                  <Route path="/incidents" element={<Navigate to="/inspections?tab=incidents" replace />} /> {/* Incidents merged into Inspections */}
                  <Route path="/inventory" element={<Navigate to="/procurement" replace />} /> {/* Inventory merged into Procurement */}
                  <Route path="/vendors" element={<Navigate to="/inspector-profiles?tab=vendors" replace />} /> {/* Vendors merged into Profile Management */}
                  <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
                  <Route path="/procurement" element={<ProtectedRoute><Procurement /></ProtectedRoute>} />
                  <Route path="/tyre-management" element={<ProtectedRoute><TyreManagement /></ProtectedRoute>} />
                  <Route path="/inspector-profiles" element={<ProtectedRoute><InspectorProfiles /></ProtectedRoute>} />
                  <Route path="/maintenance-scheduling" element={<ProtectedRoute><MaintenanceScheduling /></ProtectedRoute>} />

                  {/* Operations Routes */}
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/cost-management" element={<ProtectedRoute><CostManagement /></ProtectedRoute>} />
                  <Route path="/performance" element={<ProtectedRoute><PerformanceAnalytics /></ProtectedRoute>} />
                  <Route path="/trip-management" element={<ProtectedRoute><TripManagement /></ProtectedRoute>} />
                  <Route path="/driver-management" element={<ProtectedRoute><DriverManagement /></ProtectedRoute>} />
                  <Route path="/diesel-management" element={<ProtectedRoute><DieselManagement /></ProtectedRoute>} />
                  <Route path="/fuel-bunkers" element={<ProtectedRoute><FuelBunkers /></ProtectedRoute>} />
                  <Route path="/invoicing" element={<ProtectedRoute><Invoicing /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                  <Route path="/action-log" element={<ProtectedRoute><ActionLog /></ProtectedRoute>} />
                  <Route path="/gps-tracking" element={<Navigate to="/unified-map" replace />} /> {/* Redirect to Unified Map */}
                  <Route path="/unified-map" element={<ProtectedRoute><UnifiedMapPage /></ProtectedRoute>} />
                  <Route path="/load-management" element={<Navigate to="/trip-management" replace />} />
                  {/* WialonReports functionality moved to Unified Map page - redirect old route */}
                  <Route path="/wialon-reports" element={<Navigate to="/unified-map" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </OperationsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;