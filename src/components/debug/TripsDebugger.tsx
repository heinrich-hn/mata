import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface TripData {
  id: string;
  trip_number: string;
  client_name: string;
  status: string;
  created_at: string;
  base_revenue?: number;
  revenue_currency?: string;
  departure_date?: string;
  origin?: string;
  destination?: string;
  route?: string;
  import_source?: string;
  driver_name?: string;
}

interface DbStats {
  total: number;
  statuses: Record<string, number>;
  importSources: Record<string, number>;
  recentTrips: TripData[];
  activeTrips: TripData[];
  activeTripsCount: number;
}

const TripsDebugger = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const { toast } = useToast();

  const checkDatabase = async () => {
    setIsLoading(true);
    try {
      // Get basic stats
      const { data: allTrips, error: allError } = await supabase
        .from('trips')
        .select('*') // Get all fields for full analysis
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      console.log('🔍 Full trips data:', allTrips);

      const stats = {
        total: allTrips?.length || 0,
        statuses: {} as Record<string, number>,
        importSources: {} as Record<string, number>,
        recentTrips: allTrips?.slice(0, 10) || [],
        activeTrips: allTrips?.filter(trip => trip.status === 'active') || [],
        activeTripsCount: allTrips?.filter(trip => trip.status === 'active').length || 0
      };

      // Count by status
      allTrips?.forEach(trip => {
        const status = trip.status || 'null';
        stats.statuses[status] = (stats.statuses[status] || 0) + 1;
      });

      // Count by import source
      allTrips?.forEach(trip => {
        const source = trip.import_source || 'null';
        stats.importSources[source] = (stats.importSources[source] || 0) + 1;
      });

      console.log('📊 Active trips found:', stats.activeTrips);
      console.log('📊 Active trips details:', stats.activeTrips.map(trip => ({
        id: trip.id,
        trip_number: trip.trip_number,
        client_name: trip.client_name,
        status: trip.status,
        base_revenue: trip.base_revenue,
        revenue_currency: trip.revenue_currency,
        departure_date: trip.departure_date,
        origin: trip.origin,
        destination: trip.destination,
        route: trip.route
      })));

      setDbStats(stats);

      toast({
        title: 'Database Check Complete',
        description: `Found ${stats.total} total trips, ${stats.activeTripsCount} active`
      });

    } catch (error) {
      console.error('Database check failed:', error);
      toast({
        title: 'Database Check Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestTrip = async () => {
    setIsLoading(true);
    try {
      const testTrip = {
        trip_number: `TEST-${Date.now()}`,
        client_name: 'Test Client',
        origin: 'Cape Town',
        destination: 'Johannesburg',
        route: 'Cape Town - Johannesburg',
        status: 'active',
        base_revenue: 15000,
        revenue_currency: 'USD',
        departure_date: new Date().toISOString().split('T')[0],
        import_source: 'manual_test',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('trips')
        .insert([testTrip])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Test Trip Created',
        description: `Created trip ${testTrip.trip_number}`
      });

      // Refresh stats
      checkDatabase();

    } catch (error) {
      console.error('Failed to create test trip:', error);
      toast({
        title: 'Test Trip Creation Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeDataIssues = async () => {
    setIsLoading(true);
    try {
      const { data: allTrips, error } = await supabase
        .from('trips')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      console.log('🔍 Analyzing active trips data issues...');

      const issues: string[] = [];

      allTrips?.forEach((trip, index) => {
        console.log(`Trip ${index + 1}:`, {
          id: trip.id,
          trip_number: trip.trip_number,
          status: trip.status,
          payment_status: trip.payment_status,
          client_name: trip.client_name,
          base_revenue: trip.base_revenue,
          revenue_currency: trip.revenue_currency
        });

        // Check for potential type issues
        if (!trip.id) issues.push(`Trip ${index + 1}: Missing ID`);
        if (!trip.trip_number) issues.push(`Trip ${index + 1}: Missing trip_number`);
        if (!trip.status) issues.push(`Trip ${index + 1}: Missing status`);
        if (!trip.payment_status) issues.push(`Trip ${index + 1}: Missing payment_status (required by Trip interface)`);

        // Check for type mismatches
        if (typeof trip.base_revenue === 'string') issues.push(`Trip ${index + 1}: base_revenue is string, should be number`);
      });

      if (issues.length > 0) {
        console.warn('⚠️ Data issues found:', issues);
        toast({
          title: 'Data Issues Found',
          description: `Found ${issues.length} issues. Check console for details.`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'No Data Issues',
          description: 'All active trips have valid data structure'
        });
      }

    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fixDataIssues = async () => {
    setIsLoading(true);
    try {
      console.log('🔧 Fixing data issues...');

      // Get all trips with missing required fields
      const { data: tripsToFix, error: fetchError } = await supabase
        .from('trips')
        .select('id, trip_number, payment_status, revenue_currency, status')
        .or('payment_status.is.null,revenue_currency.is.null,status.is.null');

      if (fetchError) throw fetchError;

      if (!tripsToFix || tripsToFix.length === 0) {
        toast({
          title: 'No Issues to Fix',
          description: 'All trips have valid required fields'
        });
        return;
      }

      console.log('🔧 Found trips to fix:', tripsToFix);

      let fixedCount = 0;
      const updatePromises = tripsToFix.map(async (trip) => {
        const updates: Record<string, string> = {};

        if (!trip.payment_status) updates.payment_status = 'unpaid';
        if (!trip.revenue_currency) updates.revenue_currency = 'USD';
        if (!trip.status) updates.status = 'active';

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', trip.id);

          if (error) {
            console.error(`Failed to fix trip ${trip.trip_number}:`, error);
          } else {
            fixedCount++;
            console.log(`✅ Fixed trip ${trip.trip_number}:`, updates);
          }
        }
      });

      await Promise.all(updatePromises);

      toast({
        title: 'Data Issues Fixed',
        description: `Fixed ${fixedCount} trips with missing required fields`
      });

      // Refresh the database check
      checkDatabase();

    } catch (error) {
      console.error('Fix failed:', error);
      toast({
        title: 'Fix Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const simulateWebhookData = async () => {
    setIsLoading(true);
    try {
      const webhookTrips = [
        {
          trip_number: `WB-${Date.now()}-1`,
          client_name: 'Web Book Client A',
          origin: 'Durban',
          destination: 'Cape Town',
          route: 'Durban - Cape Town',
          status: 'active',
          base_revenue: 18500,
          revenue_currency: 'USD', // Webhook enforces USD
          departure_date: new Date().toISOString().split('T')[0],
          actual_departure_date: new Date().toISOString(),
          import_source: 'web_book',
          external_load_ref: `LOAD-${Date.now()}-1`,
          shipped_status: true,
          delivered_status: false,
          edit_history: {
            imported_at: new Date().toISOString(),
            imported_from: 'web_book',
            forced_active_status: true,
            forced_usd_currency: true
          }
        },
        {
          trip_number: `WB-${Date.now()}-2`,
          client_name: 'Web Book Client B',
          origin: 'Johannesburg',
          destination: 'Port Elizabeth',
          route: 'Johannesburg - Port Elizabeth',
          status: 'active',
          base_revenue: 12300,
          revenue_currency: 'USD',
          departure_date: new Date().toISOString().split('T')[0],
          actual_departure_date: new Date().toISOString(),
          import_source: 'web_book',
          external_load_ref: `LOAD-${Date.now()}-2`,
          shipped_status: true,
          delivered_status: false,
          edit_history: {
            imported_at: new Date().toISOString(),
            imported_from: 'web_book',
            forced_active_status: true,
            forced_usd_currency: true
          }
        }
      ];

      const { error } = await supabase
        .from('trips')
        .insert(webhookTrips)
        .select();

      if (error) throw error;

      toast({
        title: 'Webhook Simulation Complete',
        description: `Created ${webhookTrips.length} trips simulating webhook data`
      });

      // Refresh stats
      checkDatabase();

    } catch (error) {
      console.error('Failed to simulate webhook data:', error);
      toast({
        title: 'Webhook Simulation Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Trips Database Debugger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkDatabase} disabled={isLoading}>
            Check Database
          </Button>
          <Button onClick={createTestTrip} disabled={isLoading} variant="outline">
            Create Test Trip
          </Button>
          <Button onClick={simulateWebhookData} disabled={isLoading} variant="secondary">
            Simulate Webhook Data
          </Button>
          <Button onClick={analyzeDataIssues} disabled={isLoading} variant="destructive">
            Analyze Data Issues
          </Button>
          <Button onClick={fixDataIssues} disabled={isLoading} variant="default" className="bg-green-600 hover:bg-green-700">
            Fix Data Issues
          </Button>
        </div>

        {dbStats && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Trips</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{dbStats.total}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(dbStats.statuses).map(([status, count]) => (
                      <div key={status} className="flex justify-between text-sm">
                        <span>{status}:</span>
                        <span className="font-medium">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Import Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(dbStats.importSources).map(([source, count]) => (
                      <div key={source} className="flex justify-between text-sm">
                        <span>{source}:</span>
                        <span className="font-medium">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Trips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dbStats.recentTrips.map((trip: { id: string; trip_number: string; client_name: string; status: string; created_at: string }) => (
                    <div key={trip.id} className="flex justify-between text-sm border-b pb-1">
                      <span>{trip.trip_number}</span>
                      <span>{trip.client_name}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{trip.status}</span>
                      <span className="text-gray-500">{trip.created_at?.substring(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Trips Details */}
            {dbStats.activeTrips && dbStats.activeTrips.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Active Trips Details ({dbStats.activeTripsCount})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dbStats.activeTrips.map((trip: TripData) => (
                      <div key={trip.id} className="border rounded p-3 bg-green-50">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><strong>Trip:</strong> {trip.trip_number}</div>
                          <div><strong>Client:</strong> {trip.client_name || 'N/A'}</div>
                          <div><strong>Route:</strong> {trip.route || `${trip.origin || 'N/A'} → ${trip.destination || 'N/A'}`}</div>
                          <div><strong>Status:</strong> {trip.status}</div>
                          <div><strong>Revenue:</strong> {trip.base_revenue ? `${trip.revenue_currency || 'USD'} ${trip.base_revenue}` : 'N/A'}</div>
                          <div><strong>Departure:</strong> {trip.departure_date || 'N/A'}</div>
                          <div><strong>Source:</strong> {trip.import_source || 'N/A'}</div>
                          <div><strong>Driver:</strong> {trip.driver_name || 'N/A'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TripsDebugger;
