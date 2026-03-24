import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useDieselAlerts } from "@/hooks/useDieselAlerts";
import { useDriverBehaviorAlerts } from "@/hooks/useDriverBehaviorAlerts";
import { useDriverDocumentAlerts } from "@/hooks/useDriverDocumentAlerts";
import { useFaultAlerts } from "@/hooks/useFaultAlerts";
import { useGeofenceAlerts } from "@/hooks/useGeofenceAlerts";
import { useIncidentAlerts } from "@/hooks/useIncidentAlerts";
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
import DriverBehaviorPage from "@/pages/DriverBehaviorPage";
import FaultsPage from "@/pages/FaultsPage";
import GeofencePage from "@/pages/GeofencePage";
import IncidentsPage from "@/pages/IncidentsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import TripAlertsPage from "@/pages/TripAlertsPage";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect } from "react";

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
  status?: string;
  zero_revenue_comment?: string | null;
  hasFlaggedCosts?: boolean;
  flaggedCostCount?: number;
  hasNoCosts?: boolean;
  hasUnverifiedCosts?: boolean;
  unverifiedCostCount?: number;
  hasMissingDocuments?: boolean;
  missingDocumentCount?: number;
  daysInProgress?: number;
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
  departure_date: string | null;
  status: string | null;
  completed_at: string | null;
  validation_notes: string | null;
  completion_validation: CompletionValidation | null;
  verified_no_costs: boolean | null;
  zero_revenue_comment: string | null;
  delay_reasons: DelayReason[] | null;
  edit_history: EditHistoryEntry[] | null;
  fleet_vehicle_id: string | null;
  vehicles: { fleet_number: string | null } | { fleet_number: string | null }[] | null;
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
          departure_date,
          status,
          completed_at,
          validation_notes,
          completion_validation,
          verified_no_costs,
          zero_revenue_comment,
          delay_reasons,
          edit_history,
          fleet_vehicle_id,
          vehicles:fleet_vehicle_id (fleet_number)
        `)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trips:', error);
        return [];
      }

      console.log('Fetched trips (last 90 days):', data?.length);

      // Fetch cost_entries for these trips to get real flagged cost status
      const tripIds = (data || []).map(t => (t as unknown as RawTripData).id);
      const costEntriesMap: Record<string, { hasCosts: boolean; flaggedCount: number; unverifiedCount: number; missingDocCount: number }> = {};

      if (tripIds.length > 0) {
        // Fetch in batches of 50 to stay well within Supabase row limits
        for (let i = 0; i < tripIds.length; i += 50) {
          const batch = tripIds.slice(i, i + 50);
          const { data: costData } = await supabase
            .from('cost_entries')
            .select('trip_id, is_flagged, investigation_status, attachments')
            .in('trip_id', batch)
            .limit(5000);

          if (costData) {
            for (const cost of costData) {
              if (!cost.trip_id) continue;
              if (!costEntriesMap[cost.trip_id]) {
                costEntriesMap[cost.trip_id] = { hasCosts: false, flaggedCount: 0, unverifiedCount: 0, missingDocCount: 0 };
              }
              costEntriesMap[cost.trip_id].hasCosts = true;
              if (cost.is_flagged && cost.investigation_status !== 'resolved') {
                costEntriesMap[cost.trip_id].flaggedCount++;
              }
              // Unverified = any cost not yet approved/verified by an operator
              if (cost.investigation_status !== 'resolved') {
                costEntriesMap[cost.trip_id].unverifiedCount++;
              }
              // Missing document = cost entry without any attachments/slips
              const attachments = cost.attachments as unknown[] | null;
              if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
                costEntriesMap[cost.trip_id].missingDocCount++;
              }
            }
          }
        }
      }

      // Transform all trips (the hook will decide which alerts to create)
      return (data as unknown as RawTripData[] || []).map(trip => {
        // Calculate days in progress only if trip is not completed
        const daysInProgress = trip.departure_date && trip.status !== 'completed'
          ? Math.ceil((new Date().getTime() - new Date(trip.departure_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Use cost_entries data for accurate flagged cost detection
        const costInfo = costEntriesMap[trip.id];
        const hasCostEntries = costInfo?.hasCosts ?? false;
        const flaggedCostCount = costInfo?.flaggedCount ?? 0;
        const unverifiedCostCount = costInfo?.unverifiedCount ?? 0;
        const missingDocCount = costInfo?.missingDocCount ?? 0;

        // Extract fleet_number from joined vehicle data
        const vehicleData = Array.isArray(trip.vehicles)
          ? trip.vehicles[0]
          : trip.vehicles;
        const fleetNumber = vehicleData?.fleet_number ?? undefined;

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
          fleet_number: fleetNumber,
          driver_name: trip.driver_name ?? undefined,
          client_name: trip.client_name ?? undefined,
          base_revenue: trip.base_revenue ?? undefined,
          revenue_currency: trip.revenue_currency ?? undefined,
          payment_status: trip.payment_status ?? undefined,
          status: trip.status ?? undefined,
          zero_revenue_comment: trip.zero_revenue_comment,
          departure_date: trip.departure_date ?? undefined,
          validation_notes: trip.validation_notes,
          completion_validation: trip.completion_validation,
          delay_reasons: trip.delay_reasons,
          edit_history: trip.edit_history,
          // Derived fields from cost_entries table (real-time accurate)
          hasFlaggedCosts: flaggedCostCount > 0,
          flaggedCostCount: flaggedCostCount,
          hasNoCosts: !hasCostEntries && !trip.verified_no_costs,
          hasUnverifiedCosts: hasCostEntries && unverifiedCostCount > 0,
          unverifiedCostCount: unverifiedCostCount,
          hasMissingDocuments: hasCostEntries && missingDocCount > 0,
          missingDocumentCount: missingDocCount,
          daysInProgress: daysInProgress,
          hasIssues: hasIssues,
        };
      });
    },
    refetchInterval: 60000, // Check every minute for new trips
  });

  // Realtime subscription on cost_entries so the monitor reacts immediately
  // when costs are added, approved, or flagged in the main app
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('monitor-cost-entries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cost_entries' },
        () => {
          // Invalidate trip data so costEntriesMap is rebuilt with fresh data
          queryClient.invalidateQueries({ queryKey: ['all-trips-recent'] });
          queryClient.invalidateQueries({ queryKey: ['trip-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['trip-alert-counts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Enable all alert types
  useFaultAlerts(true);
  useVehicleDocumentAlerts(true);
  useDriverDocumentAlerts(true);
  useDieselAlerts(true);
  useMaintenanceAlerts(true);
  useIncidentAlerts(true);
  useDriverBehaviorAlerts(true);
  useGeofenceAlerts(true);
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
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="driver-behavior" element={<DriverBehaviorPage />} />
        <Route path="geofence" element={<GeofencePage />} />
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