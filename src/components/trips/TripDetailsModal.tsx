import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  calculateSystemCosts,
  generateAndInsertSystemCosts,
  useEffectiveRates,
} from '@/hooks/useSystemCostRates';
import { supabase } from '@/integrations/supabase/client';
import { CostEntry } from '@/types/operations';
import {
  AlertTriangle,
  Calendar,
  Calculator,
  CheckCircle,
  DollarSign,
  Edit,
  Gauge,
  MapPin,
  RefreshCw,
  Truck,
  User
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import EditTripDialog from './EditTripDialog';
import FlagResolutionModal from './FlagResolutionModal';
import TripCostManager from './TripCostManager';
import TripCycleTrackerView from './TripCycleTrackerView';
import { evaluateKmSchedules, updateVehicleOdometer } from '@/lib/maintenanceKmTracking';
import { useTripKmValidation } from '@/hooks/useTripKmValidation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Trip {
  id: string;
  trip_number: string;
  vehicle_id?: string;
  driver_name?: string;
  client_name?: string;
  origin?: string;
  destination?: string;
  route?: string;
  departure_date?: string;
  arrival_date?: string;
  status?: string;
  payment_status?: string;
  base_revenue?: number;
  additional_revenue?: number;
  additional_revenue_reason?: string;
  revenue_currency?: string;
  starting_km?: number;
  ending_km?: number;
  distance_km?: number;
  empty_km?: number;
  empty_km_reason?: string;
  load_type?: string;
  fleet_vehicle_id?: string;
}

interface TripDetailsModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

// ─── Inline System Costs Tab (DB-driven rates) ───
const formatUSD = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SystemCostsTab({ trip, onGenerated }: { trip: Trip; onGenerated: () => void }) {
  const { effectiveRates, isLoading } = useEffectiveRates(trip.departure_date || undefined);
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const previewCosts = calculateSystemCosts(
    {
      id: trip.id,
      departure_date: trip.departure_date,
      arrival_date: trip.arrival_date,
      distance_km: trip.distance_km,
    },
    effectiveRates
  );

  const totalCosts = previewCosts.reduce((sum, c) => sum + c.amount, 0);

  const tripDays = (() => {
    if (!trip.departure_date || !trip.arrival_date) return 1;
    const days = Math.ceil(
      (new Date(trip.arrival_date).getTime() - new Date(trip.departure_date).getTime()) /
      (1000 * 60 * 60 * 24)
    ) + 1;
    return Math.max(1, days);
  })();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateAndInsertSystemCosts(
        {
          id: trip.id,
          departure_date: trip.departure_date,
          arrival_date: trip.arrival_date,
          distance_km: trip.distance_km,
        },
        effectiveRates
      );

      if (result.skipped) {
        toast({
          title: 'Already Generated',
          description: 'System costs already exist for this trip.',
        });
      } else {
        toast({
          title: 'Success',
          description: `${result.inserted} system cost${result.inserted !== 1 ? 's' : ''} generated.`,
        });
      }
      onGenerated();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate system costs',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading rates...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                System Cost Generator
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Auto-calculated from DB-managed rates
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trip info */}
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm font-medium">Trip Duration</span>
              <span className="font-bold">{tripDays} day{tripDays !== 1 ? 's' : ''}</span>
            </div>
            {(trip.distance_km ?? 0) > 0 && (
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span className="text-sm font-medium">Trip Distance</span>
                <span className="font-bold">{trip.distance_km?.toLocaleString()} km</span>
              </div>
            )}
            <div className="flex justify-between items-center p-3 bg-primary/10 rounded">
              <span className="font-semibold">Total System Costs</span>
              <span className="text-xl font-bold text-primary">{formatUSD(totalCosts)}</span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Cost Breakdown</h4>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {previewCosts.map((cost, i) => (
                <div key={i} className="flex justify-between text-sm p-2 hover:bg-muted rounded">
                  <span className="text-muted-foreground">{cost.sub_category}</span>
                  <span className="font-medium font-mono">{formatUSD(cost.amount)}</span>
                </div>
              ))}
              {previewCosts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No costs to generate. Ensure trip has dates and/or distance.
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full"
            disabled={previewCosts.length === 0 || generating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : `Generate ${previewCosts.length} System Cost${previewCosts.length !== 1 ? 's' : ''}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const TripDetailsModal = ({ trip, isOpen, onClose, onRefresh }: TripDetailsModalProps) => {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [selectedCost, setSelectedCost] = useState<CostEntry | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();

  // KM mismatch validation
  const kmValidation = useTripKmValidation(
    trip?.id,
    trip?.fleet_vehicle_id,
    trip?.starting_km,
    trip?.departure_date,
  );

  const fetchCosts = useCallback(async () => {
    if (!trip) return;

    try {
      const { data, error } = await supabase
        .from('cost_entries')
        .select(`
          *,
          cost_attachments (*)
        `)
        .eq('trip_id', trip.id)
        .order('date', { ascending: false });

      if (error) throw error;

      // Transform attachments to match CostEntry type
      const costsWithAttachments = (data || []).map(cost => ({
        ...cost,
        attachments: (cost.cost_attachments || []).map((att: Record<string, unknown>) => ({
          id: att.id,
          filename: att.filename,
          file_url: att.file_url,
          file_type: att.file_type,
          file_size: att.file_size,
          uploaded_at: att.created_at,
          cost_entry_id: att.cost_id
        }))
      }));

      setCosts(costsWithAttachments as CostEntry[]);
    } catch (error) {
      console.error('Error fetching costs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load costs',
        variant: 'destructive',
      });
    }
  }, [trip, toast]);

  useEffect(() => {
    if (trip && isOpen) {
      fetchCosts();
    }
  }, [trip, isOpen, fetchCosts]); const handleCompleteTrip = async () => {
    if (!trip) return;

    // Check for KM mismatch
    if (kmValidation.hasMismatch) {
      toast({
        title: 'Cannot Complete Trip — KM Mismatch',
        description: kmValidation.message || 'Starting KM does not match previous trip ending KM for this vehicle.',
        variant: 'destructive',
      });
      return;
    }

    // Check for unresolved flags
    const unresolvedFlags = costs.filter(c => c.is_flagged && c.investigation_status !== 'resolved');

    if (unresolvedFlags.length > 0) {
      toast({
        title: 'Cannot Complete Trip',
        description: `There are ${unresolvedFlags.length} unresolved flag(s). Please resolve all flags before completing the trip.`,
        variant: 'destructive',
      });
      return;
    }

    const flaggedCosts = costs.filter(c => c.is_flagged);

    try {
      const { error } = await supabase
        .from('trips')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_validation: {
            flags_checked_at: new Date().toISOString(),
            flags_resolved_count: flaggedCosts.length,
            unresolved_flags_at_completion: 0,
            validated_by: 'system'
          }
        })
        .eq('id', trip.id);

      if (error) throw error;

      // Update vehicle odometer from trip ending_km
      if (trip.ending_km && trip.fleet_vehicle_id) {
        const updated = await updateVehicleOdometer(trip.fleet_vehicle_id, trip.ending_km);
        if (updated) {
          // Evaluate KM-based maintenance schedules for this vehicle
          await evaluateKmSchedules(trip.fleet_vehicle_id, trip.ending_km);
        }
      }

      toast({
        title: 'Success',
        description: 'Trip marked as completed',
      });

      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error completing trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete trip',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  if (!trip) return null;

  const flaggedCosts = costs.filter(c => c.is_flagged);
  const unresolvedFlags = flaggedCosts.filter(c => c.investigation_status !== 'resolved');
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const canComplete = trip.status === 'active' && unresolvedFlags.length === 0 && !kmValidation.hasMismatch;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Trip {trip.trip_number} - Details</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditDialog(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit Trip
                </Button>
                {trip.status === 'active' && (
                  <Button
                    onClick={handleCompleteTrip}
                    disabled={!canComplete}
                    size="sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Trip
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="costs">
                Costs
                {flaggedCosts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unresolvedFlags.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="system-costs">System Costs</TabsTrigger>
              <TabsTrigger value="cycle-tracker">
                360° Tracker
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Trip Status */}
              {unresolvedFlags.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-900">
                          {unresolvedFlags.length} Unresolved Flag{unresolvedFlags.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-amber-700">
                          Resolve all flags before completing this trip
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* KM Mismatch Warning */}
              {kmValidation.hasMismatch && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Kilometer Mismatch — Cannot Complete Trip</AlertTitle>
                  <AlertDescription>
                    {kmValidation.message}
                    {' '}Please correct the starting KM before completing this trip.
                  </AlertDescription>
                </Alert>
              )}

              {/* Trip Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Trip Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Driver</p>
                        <p className="font-medium">{trip.driver_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Client</p>
                        <p className="font-medium">{trip.client_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Route</p>
                        <p className="font-medium">{trip.route || `${trip.origin} → ${trip.destination}`}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Departure</p>
                        <p className="font-medium">{formatDate(trip.departure_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Arrival</p>
                        <p className="font-medium">{formatDate(trip.arrival_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency((trip.base_revenue || 0) + (trip.additional_revenue || 0), trip.revenue_currency)}
                        </p>
                        {trip.additional_revenue && trip.additional_revenue > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Base: {formatCurrency(trip.base_revenue || 0, trip.revenue_currency)} + Additional: {formatCurrency(trip.additional_revenue, trip.revenue_currency)}
                            {trip.additional_revenue_reason && ` (${trip.additional_revenue_reason.replace(/_/g, ' ')})`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kilometer Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="w-5 h-5" />
                    Kilometer Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Starting KM</p>
                      <p className="text-lg font-semibold">{trip.starting_km?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ending KM</p>
                      <p className="text-lg font-semibold">{trip.ending_km?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Distance</p>
                      <p className="text-lg font-semibold text-primary">
                        {trip.distance_km ? `${trip.distance_km.toLocaleString()} km` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Empty KM</p>
                      <p className={`text-lg font-semibold ${trip.empty_km && trip.empty_km > 0 ? 'text-amber-600' : ''}`}>
                        {trip.empty_km ? `${trip.empty_km.toLocaleString()} km` : '0 km'}
                      </p>
                    </div>
                  </div>
                  {trip.empty_km && trip.empty_km > 0 && trip.empty_km_reason && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Empty Kilometers Reason:</p>
                      <p className="text-sm text-amber-700 mt-1">{trip.empty_km_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cost Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Costs</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalCosts)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cost Entries</p>
                      <p className="text-2xl font-bold">{costs.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Flagged Items</p>
                      <p className="text-2xl font-bold text-amber-600">{flaggedCosts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent >

            <TabsContent value="costs" className="space-y-4">
              <TripCostManager
                tripId={trip.id}
                route={trip.route}
                costs={costs}
                onRefresh={fetchCosts}
                onResolveFlag={(cost) => {
                  setSelectedCost(cost);
                  setShowFlagModal(true);
                }}
              />
            </TabsContent>

            <TabsContent value="system-costs" className="space-y-4">
              <SystemCostsTab trip={trip} onGenerated={fetchCosts} />
            </TabsContent>

            <TabsContent value="cycle-tracker" className="space-y-4">
              <TripCycleTrackerView tripId={trip.id} tripNumber={trip.trip_number} route={trip.route} />
            </TabsContent>
          </Tabs >
        </DialogContent >
      </Dialog >

      <EditTripDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        trip={trip as import('@/types/operations').Trip}
        onRefresh={() => {
          fetchCosts();
          if (onRefresh) onRefresh();
        }}
      />

      <FlagResolutionModal
        cost={selectedCost}
        isOpen={showFlagModal}
        onClose={() => {
          setShowFlagModal(false);
          setSelectedCost(null);
        }}
        onResolve={() => {
          fetchCosts();
          setShowFlagModal(false);
          setSelectedCost(null);
        }}
      />
    </>
  );
};

export default TripDetailsModal;