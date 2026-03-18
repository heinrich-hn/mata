import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useDieselAlerts } from "@/hooks/useDieselAlerts";
import { useFaultAlerts } from "@/hooks/useFaultAlerts";
import { useMaintenanceAlerts } from "@/hooks/useMaintenanceAlerts";
import { useTripAlerts } from "@/hooks/useTripAlerts";
import { useVehicleDocumentAlerts } from "@/hooks/useVehicleDocumentAlerts";
import { supabase } from "@/integrations/supabase/client";
import AlertDetailPage from "@/pages/AlertDetailPage";
import AlertsPage from "@/pages/AlertsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AuthPage from "@/pages/AuthPage";
import ConfigPage from "@/pages/ConfigPage";
import DieselAlertsPage from "@/pages/DieselAlertsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import FaultsPage from "@/pages/FaultsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import TripAlertsPage from "@/pages/TripAlertsPage";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

// Define types for cost entries
interface Cost {
  amount: number;
  description?: string;
  is_flagged?: boolean;
  investigation_status?: string;
}

interface AdditionalCost {
  amount: number;
  description?: string;
}

// Define types for JSON fields
interface CompletionValidation {
  validated_at?: string;
  validated_by?: string;
  flags_checked?: boolean;
  unresolved_flags?: number;
  [key: string]: unknown;
}

interface DelayReason {
  reason: string;
  date: string;
  duration_hours?: number;
  [key: string]: unknown;
}

interface EditHistoryEntry {
  edited_at: string;
  edited_by: string;
  changes: Record<string, unknown>;
  [key: string]: unknown;
}

// Define the Trip type to match what useTripAlerts expects
interface TripForAlerts {
  id: string;
  trip_number: string;
  fleet_number?: string;
  driver_name?: string;
  client_name?: string;
  base_revenue?: number;
  revenue_currency?: string;
  payment_status?: string;
  hasFlaggedCosts?: boolean;
  flaggedCostCount?: number;
  hasNoCosts?: boolean;
  daysInProgress?: number;
  costs?: Cost[];
  additional_costs?: AdditionalCost[];
  departure_date?: string;
  // Fields to detect flagged trips
  validation_notes?: string | null;
  completion_validation?: CompletionValidation | null;
  delay_reasons?: DelayReason[] | null;
  edit_history?: EditHistoryEntry[] | null;
  // Track if trip has issues
  hasIssues?: boolean;
}

// Define the type for the raw trip data from Supabase
interface RawTripData {
  id: string;
  trip_number: string;
  driver_name: string | null;
  client_name: string | null;
  base_revenue: number | null;
  revenue_currency: string | null;
  payment_status: string | null;
  additional_costs: AdditionalCost[] | null;
  departure_date: string | null;
  status: string | null;
  completed_at: string | null;
  validation_notes: string | null;
  completion_validation: CompletionValidation | null;
  verified_no_costs: boolean | null;
  delay_reasons: DelayReason[] | null;
  edit_history: EditHistoryEntry[] | null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

function AppContent() {
  // Fetch ALL trips from the last 90 days (simplified approach)
  const { data: trips = [] } = useQuery<TripForAlerts[]>({
    queryKey: ['all-trips-recent'],
    queryFn: async () => {
      // Get all trips from the last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          trip_number,
          driver_name,
          client_name,
          base_revenue,
          revenue_currency,
          payment_status,
          additional_costs,
          departure_date,
          status,
          completed_at,
          validation_notes,
          completion_validation,
          verified_no_costs,
          delay_reasons,
          edit_history
        `)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trips:', error);
        return [];
      }

      console.log('Fetched trips (last 90 days):', data?.length);

      // Filter to only include trips with issues (client-side filtering)
      const tripsWithIssues = (data as RawTripData[] || []).filter(trip =>
        trip.validation_notes !== null ||
        (trip.delay_reasons !== null &&
          Array.isArray(trip.delay_reasons) &&
          trip.delay_reasons.length > 0) ||
        trip.completion_validation !== null ||
        (trip.edit_history !== null &&
          Array.isArray(trip.edit_history) &&
          trip.edit_history.length > 0)
      );

      console.log('Trips with issues:', tripsWithIssues.length);

      // Transform all trips (the hook will decide which alerts to create)
      return (data as RawTripData[] || []).map(trip => {
        // Calculate days in progress only if trip is not completed
        const daysInProgress = trip.departure_date && trip.status !== 'completed'
          ? Math.ceil((new Date().getTime() - new Date(trip.departure_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Check if there are any additional costs
        const hasAdditionalCosts = trip.additional_costs &&
          Array.isArray(trip.additional_costs) &&
          trip.additional_costs.length > 0;

        // Check if trip has issues
        const hasIssues =
          trip.validation_notes !== null ||
          (trip.delay_reasons !== null &&
            Array.isArray(trip.delay_reasons) &&
            trip.delay_reasons.length > 0) ||
          trip.completion_validation !== null ||
          (trip.edit_history !== null &&
            Array.isArray(trip.edit_history) &&
            trip.edit_history.length > 0);

        return {
          id: trip.id,
          trip_number: trip.trip_number,
          // Convert null to undefined
          fleet_number: undefined,
          driver_name: trip.driver_name ?? undefined,
          client_name: trip.client_name ?? undefined,
          base_revenue: trip.base_revenue ?? undefined,
          revenue_currency: trip.revenue_currency ?? undefined,
          payment_status: trip.payment_status ?? undefined,
          departure_date: trip.departure_date ?? undefined,
          validation_notes: trip.validation_notes,
          completion_validation: trip.completion_validation,
          delay_reasons: trip.delay_reasons,
          edit_history: trip.edit_history,
          // Derived fields for alerts
          hasFlaggedCosts: false,
          flaggedCostCount: 0,
          hasNoCosts: !hasAdditionalCosts,
          daysInProgress: daysInProgress,
          additional_costs: trip.additional_costs ?? undefined,
          hasIssues: hasIssues,
        };
      });
    },
    refetchInterval: 60000, // Check every minute for new trips
  });

  // Enable all alert types
  useFaultAlerts(true);
  useVehicleDocumentAlerts(true);
  useDieselAlerts(true);
  useMaintenanceAlerts(true);
  useTripAlerts(trips, { enabled: true }); // Monitor trips for alerts

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/alerts" replace />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="alerts/:id" element={<AlertDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="faults" element={<FaultsPage />} />
        <Route path="trip-alerts" element={<TripAlertsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="diesel-alerts" element={<DieselAlertsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: "hsl(222 47% 14%)",
                  border: "1px solid hsl(222 47% 22%)",
                  color: "hsl(213 31% 91%)",
                },
              }}
            />
            <AppContent />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;