import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { GeofenceMonitorProvider } from "@/hooks/useGeofenceMonitor";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { logger, reportToUser } from "@/lib/logger";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import React, { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ClientsPage from "./pages/ClientsPage";
import DieselOrdersPage from "./pages/DieselOrdersPage";
import DriversPage from "./pages/DriversPage";
import FleetPage from "./pages/FleetPage";
import Index from "./pages/Index";
import LoadsPage from "./pages/TripssPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import SuppliersPage from "./pages/Suppliers"; // Add this import
import ThirdPartyLoadsPage from "./pages/ThirdPartyTripsPage";
import SubcontractorTripsPage from "./pages/SubcontractorTripsPage";
import LoadConsignmentsPage from "./pages/load-consignments";
import BreakdownsPage from "./pages/BreakdownsPage";
import ClientDashboardPage from "./pages/client-dashboard/ClientDashboardPage";
import { MainLayout } from "./components/layout/MainLayout"; // Add this import if you have it
import { lazyRetry } from "./lib/lazyRetry";

// Lazy-loaded heavy pages (maps, charts, calendar)
const CalendarPage = React.lazy(lazyRetry(() => import("./pages/CalendarPage")));
const DeliveriesDashboardPage = React.lazy(lazyRetry(() => import("./pages/DeliveriesDashboardPage")));
const LiveTrackingPage = React.lazy(lazyRetry(() => import("./pages/LiveTrackingPage")));
const ReportsPage = React.lazy(lazyRetry(() => import("./pages/ReportsPage")));
const ShareableTrackingPage = React.lazy(lazyRetry(() => import("./pages/ShareableTrackingPage")));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
  // Global error capture: every failed query/mutation across the app
  // is logged with full context and surfaced via toast — no per-hook
  // boilerplate required.
  queryCache: new QueryCache({
    onError: (error, query) => {
      const key = JSON.stringify(query.queryKey);
      logger.error('query', `Query failed: ${key}`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        queryKey: query.queryKey,
      });
      reportToUser(
        'Failed to load data',
        error instanceof Error ? error.message : String(error),
      );
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, _context, mutation) => {
      logger.error('mutation', 'Mutation failed', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        mutationKey: mutation.options.mutationKey,
        variables,
      });
      // Don't toast here — most mutation hooks already toast on their own
      // onError. The console log above is the safety net.
    },
  }),
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GeofenceMonitorProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/track" element={<ShareableTrackingPage />} />
                  {/* Public client portal - no authentication required */}
                  <Route path="/portal/:clientId/*" element={<ClientDashboardPage />} />

                  {/* Protected Routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <Index />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/loads"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <LoadsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <CalendarPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fleet"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <FleetPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/drivers"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <DriversPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <ClientsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customers/:clientId/*"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <ClientDashboardPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/suppliers" // Add this new route
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <SuppliersPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <ReportsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/live-tracking"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <LiveTrackingPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/third-party"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <ThirdPartyLoadsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/diesel-orders"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <DieselOrdersPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/deliveries"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <DeliveriesDashboardPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/breakdowns"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <BreakdownsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/subcontractor-trips"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <SubcontractorTripsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/consignments"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <LoadConsignmentsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </GeofenceMonitorProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;