import SystemCostGenerator from '@/components/costs/SystemCostGeneratorV2';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CostEntry } from '@/types/operations';
import
  {
    AlertTriangle,
    Calendar,
    CheckCircle,
    DollarSign,
    Edit,
    Gauge,
    MapPin,
    Truck,
    User
  } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import EditTripDialog from './EditTripDialog';
import FlagResolutionModal from './FlagResolutionModal';
import TripCostManager from './TripCostManager';
import TripCycleTrackerView from './TripCycleTrackerView';
import { evaluateKmSchedules, updateVehicleOdometer } from '@/lib/maintenanceKmTracking';

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

const TripDetailsModal = ({ trip, isOpen, onClose, onRefresh }: TripDetailsModalProps) => {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [selectedCost, setSelectedCost] = useState<CostEntry | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleGenerateSystemCosts = async (generatedCosts: any) => {
    try {
      // Map to ensure all required fields are present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const costsToInsert = generatedCosts.map((cost: any) => ({
        trip_id: cost.trip_id,
        category: cost.category,
        sub_category: cost.sub_category,
        amount: cost.amount,
        currency: cost.currency,
        reference_number: cost.reference_number,
        date: cost.date,
        notes: cost.notes,
        is_flagged: cost.is_flagged !== undefined ? cost.is_flagged : false,
        is_system_generated: cost.is_system_generated !== undefined ? cost.is_system_generated : true,
      }));

      // Insert all system-generated costs
      const { error } = await supabase
        .from('cost_entries')
        .insert(costsToInsert);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${generatedCosts.length} system costs added successfully`,
      });

      // Refresh costs
      fetchCosts();
    } catch (error) {
      console.error('Error generating system costs:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate system costs',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (trip && isOpen) {
      fetchCosts();
    }
  }, [trip, isOpen, fetchCosts]);  const handleCompleteTrip = async () => {
    if (!trip) return;

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
  const totalCostsZAR = costs.filter(c => (c.currency || 'ZAR') === 'ZAR').reduce((sum, c) => sum + c.amount, 0);
  const totalCostsUSD = costs.filter(c => c.currency === 'USD').reduce((sum, c) => sum + c.amount, 0);
  const canComplete = trip.status === 'active' && unresolvedFlags.length === 0;

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
                          {formatCurrency(trip.base_revenue || 0, trip.revenue_currency)}
                        </p>
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
                      <p className="text-2xl font-bold">{formatCurrency(totalCostsZAR, 'ZAR')}</p>
                      {totalCostsUSD > 0 && (
                        <p className="text-lg font-semibold text-muted-foreground">{formatCurrency(totalCostsUSD, 'USD')}</p>
                      )}
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
            </TabsContent>

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
              <SystemCostGenerator
                trip={{
                  id: trip.id,
                  distanceKm: trip.distance_km,
                  startDate: trip.departure_date || '',
                  endDate: trip.arrival_date || '',
                  revenueAmount: trip.base_revenue,
                  revenueCurrency: trip.revenue_currency || 'ZAR',
                }}
                onGenerateSystemCosts={handleGenerateSystemCosts}
              />
            </TabsContent>

            <TabsContent value="cycle-tracker" className="space-y-4">
              <TripCycleTrackerView tripId={trip.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

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