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

// Heavy pages lazy-loaded for code splitting
const ActionLog = React.lazy(() => import("./pages/ActionLog"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const CostManagement = React.lazy(() => import("./pages/CostManagement"));
const DieselManagement = React.lazy(() => import("./pages/DieselManagement"));
const DriverManagement = React.lazy(() => import("./pages/DriverManagement"));
const FuelBunkers = React.lazy(() => import("./pages/FuelBunkers"));
const Incidents = React.lazy(() => import("./pages/Incidents"));
const InspectionDetails = React.lazy(() => import("./pages/InspectionDetails"));
const Inspections = React.lazy(() => import("./pages/Inspections"));
const InspectorProfiles = React.lazy(() => import("./pages/InspectorProfiles"));
const Invoicing = React.lazy(() => import("./pages/Invoicing"));
const JobCardDetails = React.lazy(() => import("./pages/JobCardDetails"));
const JobCards = React.lazy(() => import("./pages/JobCards"));
const MaintenanceScheduling = React.lazy(() => import("./pages/MaintenanceScheduling"));
const MobileInspections = React.lazy(() => import("./pages/MobileInspections"));
const PerformanceAnalytics = React.lazy(() => import("./pages/PerformanceAnalytics"));
const Procurement = React.lazy(() => import("./pages/Procurement"));
const TripManagement = React.lazy(() => import("./pages/TripManagement"));
const TyreInspections = React.lazy(() => import("./pages/TyreInspections"));
const TyreManagement = React.lazy(() => import("./pages/TyreManagement"));
const UnifiedMapPage = React.lazy(() => import("./pages/UnifiedMapPage"));
const Vehicles = React.lazy(() => import("./pages/Vehicles"));
const Vendors = React.lazy(() => import("./pages/Vendors"));

// Lazy-loaded sub-route component
const InspectionTypeSelector = React.lazy(() => import("./components/inspections/InspectionTypeSelector"));

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
                  <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
                  <Route path="/inventory" element={<Navigate to="/procurement" replace />} /> {/* Inventory merged into Procurement */}
                  <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
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
                  <Route path="/reports" element={<Navigate to="/trip-management" replace />} /> {/* Reports moved to Trip Management */}
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