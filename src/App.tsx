// src/App.tsx
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadRealtimeProvider } from "@/contexts/LoadRealtimeContext";
import { OperationsProvider } from "@/contexts/OperationsContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Import your page components
import ActionLog from "./pages/ActionLog";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Auth from "./pages/Auth";
import CostManagement from "./pages/CostManagement";
import DieselManagement from "./pages/DieselManagement";
import DriverManagement from "./pages/DriverManagement";
// Faults page merged into Inspections page
import FuelBunkers from "./pages/FuelBunkers";
import Incidents from "./pages/Incidents";
import Index from "./pages/Index";
import InspectionDetails from "./pages/InspectionDetails";
import Inspections from "./pages/Inspections";
import InspectorProfiles from "./pages/InspectorProfiles";
// Inventory page merged into Procurement page
import Invoicing from "./pages/Invoicing";
import JobCardDetails from "./pages/JobCardDetails";
import JobCards from "./pages/JobCards";
import LoadManagement from "./pages/LoadManagement";
import MaintenanceScheduling from "./pages/MaintenanceScheduling";
import MobileInspections from "./pages/MobileInspections";
import NotFound from "./pages/NotFound";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import Procurement from "./pages/Procurement";
import TripManagement from "./pages/TripManagement";
import TyreInspections from "./pages/TyreInspections";
import TyreManagement from "./pages/TyreManagement";
import UnifiedMapPage from "./pages/UnifiedMapPage";
import Vehicles from "./pages/Vehicles";
import Vendors from "./pages/Vendors";

// Import inspection components for sub-routes
import InspectionTypeSelector from "./components/inspections/InspectionTypeSelector";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OperationsProvider>
        <LoadRealtimeProvider>
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
                  <Route path="/load-management" element={<ProtectedRoute><LoadManagement /></ProtectedRoute>} />
                  {/* WialonReports functionality moved to Unified Map page - redirect old route */}
                  <Route path="/wialon-reports" element={<Navigate to="/unified-map" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </ErrorBoundary>
          </TooltipProvider>
        </LoadRealtimeProvider>
      </OperationsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;