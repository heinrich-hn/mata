import { Button } from '@/components/ui/button';
import { ClientSelect } from '@/components/ui/client-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DriverSelect } from '@/components/ui/driver-select';
import { Form, FormControl, FormDescription as FormDesc, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { GeofenceSelect } from '@/components/ui/geofence-select';
import { Input } from '@/components/ui/input';
import { RouteSelect } from '@/components/ui/route-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CARGO_TYPES } from '@/constants/cargoTypes';
import { useOperations } from '@/contexts/OperationsContext';
import { useToast } from '@/hooks/use-toast';
import type { RouteExpenseItem } from '@/hooks/useRoutePredefinedExpenses';
import { useWialonVehicles } from '@/hooks/useWialonVehicles';
import { supabase } from '@/integrations/supabase/client';
import type { CostEntry, Trip } from '@/types/operations';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import TripCostSection, { TripCostEntry } from './TripCostSection';

const tripSchema = z.object({
  trip_number: z.string().min(1, 'Trip number is required').max(50),
  vehicle_id: z.string().optional(),
  client_name: z.string().max(200).optional(),
  driver_name: z.string().max(200).optional(),
  load_type: z.string().optional(),
  origin: z.string().max(200).optional(),
  destination: z.string().max(200).optional(),
  route: z.string().max(200).optional(),
  departure_date: z.string().optional(),
  arrival_date: z.string().optional(),
  revenue_type: z.enum(['per_load', 'per_km']).default('per_load'),
  base_revenue: z.string().optional(),
  rate_per_km: z.string().optional(),
  revenue_currency: z.string().default('USD'),
  starting_km: z.string().optional(),
  ending_km: z.string().optional(),
  distance_km: z.string().optional(),
  empty_km: z.string().optional(),
  empty_km_reason: z.string().optional(),
  zero_revenue_comment: z.string().optional(),
  status: z.string().optional(),
}).refine(
  (data) => {
    const emptyKm = data.empty_km ? parseFloat(data.empty_km) : 0;
    if (emptyKm > 0 && (!data.empty_km_reason || data.empty_km_reason.trim() === '')) {
      return false;
    }
    return true;
  },
  {
    message: 'A reason must be provided when empty kilometers are greater than 0',
    path: ['empty_km_reason'],
  }
);

type TripFormData = z.infer<typeof tripSchema>;

interface EditTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  onRefresh?: () => void;
}

const EditTripDialog = ({ isOpen, onClose, trip, onRefresh }: EditTripDialogProps) => {
  const { toast } = useToast();
  const { addCostEntry } = useOperations();
  const { data: vehicles, isLoading: vehiclesLoading } = useWialonVehicles();

  // State for new costs to be added when editing
  const [tripCosts, setTripCosts] = useState<TripCostEntry[]>([]);

  // State for route expenses from route selection
  const [selectedRouteExpenses, setSelectedRouteExpenses] = useState<RouteExpenseItem[]>([]);

  // Track if route was changed to add new expenses
  const [routeChanged, setRouteChanged] = useState(false);

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      trip_number: '',
      vehicle_id: undefined,
      client_name: undefined,
      driver_name: undefined,
      load_type: undefined,
      origin: '',
      destination: '',
      route: '',
      departure_date: '',
      arrival_date: '',
      revenue_type: 'per_load',
      base_revenue: '',
      rate_per_km: '',
      revenue_currency: 'USD',
      starting_km: '',
      ending_km: '',
      distance_km: '',
      empty_km: '',
      empty_km_reason: '',
      zero_revenue_comment: '',
      status: 'active',
    },
  });

  // Watch kilometer fields for auto-calculation
  const startingKm = form.watch('starting_km');
  const endingKm = form.watch('ending_km');
  const emptyKm = form.watch('empty_km');
  const baseRevenue = form.watch('base_revenue');
  const revenueType = form.watch('revenue_type');
  const ratePerKm = form.watch('rate_per_km');
  const distanceKm = form.watch('distance_km');

  // Auto-calculate distance when starting and ending km change
  const calculatedDistance = useMemo(() => {
    const start = startingKm ? parseFloat(startingKm) : 0;
    const end = endingKm ? parseFloat(endingKm) : 0;
    if (start > 0 && end > 0 && end >= start) {
      return end - start;
    }
    return null;
  }, [startingKm, endingKm]);

  // Auto-calculate revenue when per_km is selected
  const calculatedRevenue = useMemo(() => {
    if (revenueType !== 'per_km') return null;
    const rate = ratePerKm ? parseFloat(ratePerKm) : 0;
    const distance = distanceKm ? parseFloat(distanceKm) : 0;
    if (rate > 0 && distance > 0) {
      return rate * distance;
    }
    return null;
  }, [revenueType, ratePerKm, distanceKm]);

  // Update distance_km field when calculation changes
  useEffect(() => {
    if (calculatedDistance !== null) {
      form.setValue('distance_km', calculatedDistance.toString());
    }
  }, [calculatedDistance, form]);

  // Update base_revenue field when per-km calculation changes
  useEffect(() => {
    if (calculatedRevenue !== null && revenueType === 'per_km') {
      form.setValue('base_revenue', calculatedRevenue.toFixed(2));
    }
  }, [calculatedRevenue, revenueType, form]);

  // Populate form when trip changes
  useEffect(() => {
    if (trip && isOpen) {
      form.reset({
        trip_number: trip.trip_number || '',
        vehicle_id: trip.vehicle_id || undefined,
        client_name: trip.client_name || undefined,
        driver_name: trip.driver_name || undefined,
        load_type: trip.load_type || undefined,
        origin: trip.origin || '',
        destination: trip.destination || '',
        route: trip.route || '',
        departure_date: trip.departure_date || '',
        arrival_date: trip.arrival_date || '',
        revenue_type: trip.revenue_type || 'per_load',
        base_revenue: trip.base_revenue?.toString() || '',
        rate_per_km: trip.rate_per_km?.toString() || '',
        revenue_currency: trip.revenue_currency || 'ZAR',
        starting_km: trip.starting_km?.toString() || '',
        ending_km: trip.ending_km?.toString() || '',
        distance_km: trip.distance_km?.toString() || '',
        empty_km: trip.empty_km?.toString() || '',
        empty_km_reason: trip.empty_km_reason || '',
        zero_revenue_comment: trip.zero_revenue_comment || '',
        status: trip.status || 'active',
      });
      // Reset costs state when dialog opens
      setTripCosts([]);
      setSelectedRouteExpenses([]);
      setRouteChanged(false);
    }
  }, [trip, isOpen, form]);

  const onSubmit = async (data: TripFormData) => {
    if (!trip) return;

    try {
      const { error } = await supabase
        .from('trips')
        .update({
          trip_number: data.trip_number,
          // Clear fleet_vehicle_id when vehicle is changed via wialon_vehicles selector
          // This ensures the fleet_number is derived from vehicle_id (wialon_vehicles) instead
          fleet_vehicle_id: null,
          vehicle_id: data.vehicle_id || null,
          client_name: data.client_name || null,
          driver_name: data.driver_name || null,
          load_type: data.load_type || null,
          origin: data.origin || null,
          destination: data.destination || null,
          route: data.route || null,
          departure_date: data.departure_date || null,
          arrival_date: data.arrival_date || null,
          base_revenue: data.base_revenue ? parseFloat(data.base_revenue) : null,
          revenue_currency: data.revenue_currency,
          revenue_type: data.revenue_type || 'per_load',
          rate_per_km: data.rate_per_km ? parseFloat(data.rate_per_km) : null,
          starting_km: data.starting_km ? parseFloat(data.starting_km) : null,
          ending_km: data.ending_km ? parseFloat(data.ending_km) : null,
          distance_km: data.distance_km ? parseFloat(data.distance_km) : null,
          empty_km: data.empty_km ? parseFloat(data.empty_km) : null,
          empty_km_reason: data.empty_km_reason || null,
          zero_revenue_comment: data.zero_revenue_comment || null,
          status: data.status || 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', trip.id);

      if (error) throw error;

      // Add route expenses if route was changed and has required expenses
      let routeExpensesAdded = 0;
      if (routeChanged && selectedRouteExpenses.length > 0) {
        const requiredExpenses = selectedRouteExpenses.filter(e => e.is_required);

        for (const expense of requiredExpenses) {
          const expenseEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
            trip_id: trip.id,
            category: expense.category,
            sub_category: expense.sub_category,
            amount: expense.amount,
            currency: expense.currency,
            date: data.departure_date || format(new Date(), 'yyyy-MM-dd'),
            notes: `Auto-added from route: ${data.route}`,
            is_flagged: false,
            is_system_generated: true,
          };

          try {
            await addCostEntry(expenseEntry);
            routeExpensesAdded++;
          } catch {
            console.error('Failed to add route expense:', expense.category, expense.sub_category);
          }
        }
      }

      // Add any user-specified costs
      let costsAddedCount = 0;
      for (const cost of tripCosts) {
        const costEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
          trip_id: trip.id,
          category: cost.category,
          sub_category: cost.sub_category,
          amount: cost.amount,
          currency: cost.currency,
          reference_number: cost.reference_number,
          date: cost.date,
          notes: cost.notes || null,
          is_flagged: cost.is_flagged,
          flag_reason: cost.flag_reason || null,
          is_system_generated: false,
        };

        try {
          await addCostEntry(costEntry);
          costsAddedCount++;
        } catch {
          console.error('Failed to add cost entry:', cost.category);
        }
      }

      // Show appropriate success message
      const totalCostsAdded = costsAddedCount + routeExpensesAdded;
      if (totalCostsAdded > 0) {
        toast({
          title: 'Success',
          description: `Trip updated with ${totalCostsAdded} cost entr${totalCostsAdded === 1 ? 'y' : 'ies'} added`,
        });
      } else {
        toast({
          title: 'Success',
          description: 'Trip updated successfully',
        });
      }

      if (onRefresh) onRefresh();
      onClose();
    } catch (error) {
      console.error('Error updating trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to update trip',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
          <DialogDescription>
            Update trip details - {trip?.trip_number}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trip_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="T001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={vehiclesLoading ? "Loading..." : "Select vehicle"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => {
                          // Extract fleet number from name if fleet_number column is not populated
                          // Name format is often "21H Init Sim..." - extract the fleet code (e.g., "21H", "4H", "UD")
                          const extractedFleet = vehicle.fleet_number ||
                            vehicle.name?.match(/^(\d+[A-Z]+|[A-Z]+\d*)/i)?.[1] || null;

                          // Display fleet_number with registration
                          const displayName = extractedFleet && vehicle.registration
                            ? `${extractedFleet} (${vehicle.registration})`
                            : extractedFleet || vehicle.registration || 'Unknown';

                          return (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driver_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver</FormLabel>
                    <FormControl>
                      <DriverSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Select driver"
                        allowCreate={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <ClientSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select or create client"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="load_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Load Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select load type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CARGO_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin (From)</FormLabel>
                    <FormControl>
                      <GeofenceSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Select origin"
                        allowCreate={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination (To)</FormLabel>
                    <FormControl>
                      <GeofenceSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Select destination"
                        allowCreate={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="route"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Route</FormLabel>
                  <FormControl>
                    <RouteSelect
                      value={field.value || ''}
                      onValueChange={(value, _tollCost, expenses) => {
                        field.onChange(value);
                        // Track if route was changed from original
                        if (value !== trip?.route) {
                          setRouteChanged(true);
                          setSelectedRouteExpenses(expenses || []);
                        } else {
                          setRouteChanged(false);
                          setSelectedRouteExpenses([]);
                        }
                      }}
                      placeholder="Select route"
                      showTollFee={true}
                      allowCreate={true}
                      allowEdit={true}
                    />
                  </FormControl>
                  <FormDesc className="text-xs">
                    {routeChanged && selectedRouteExpenses.filter(e => e.is_required).length > 0
                      ? `${selectedRouteExpenses.filter(e => e.is_required).length} expense(s) will be auto-added: ${selectedRouteExpenses.filter(e => e.is_required).map(e => `${e.sub_category} (${e.currency === 'USD' ? '$' : 'R'}${e.amount})`).join(', ')}`
                      : 'Select a route with predefined expenses or add costs below'}
                  </FormDesc>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departure_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Departure Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value || undefined}
                        onChange={(date) => {
                          if (date) {
                            // Format as YYYY-MM-DD in local time to avoid timezone shifts
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            field.onChange(`${year}-${month}-${day}`);
                          } else {
                            field.onChange('');
                          }
                        }}
                        placeholder="Pick departure date"
                        dateFormat="dd MMM yyyy"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arrival_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Arrival Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value || undefined}
                        onChange={(date) => {
                          if (date) {
                            // Format as YYYY-MM-DD in local time to avoid timezone shifts
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            field.onChange(`${year}-${month}-${day}`);
                          } else {
                            field.onChange('');
                          }
                        }}
                        placeholder="Pick arrival date"
                        dateFormat="dd MMM yyyy"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Revenue Section */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium text-sm">Revenue</h4>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="revenue_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revenue Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select revenue type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="per_load">Per Load (Fixed Amount)</SelectItem>
                          <SelectItem value="per_km">Per Kilometer (Rate × Distance)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDesc className="text-xs">
                        {revenueType === 'per_km'
                          ? 'Revenue will be calculated: Rate × Distance'
                          : 'Enter the total revenue for this load'}
                      </FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="revenue_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ZAR">ZAR (South African Rand)</SelectItem>
                          <SelectItem value="USD">USD (US Dollar)</SelectItem>
                          <SelectItem value="EUR">EUR (Euro)</SelectItem>
                          <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                          <SelectItem value="BWP">BWP (Botswana Pula)</SelectItem>
                          <SelectItem value="ZMW">ZMW (Zambian Kwacha)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {revenueType === 'per_load' ? (
                <FormField
                  control={form.control}
                  name="base_revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Revenue</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDesc className="text-xs">Total revenue for this load</FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rate_per_km"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate per Kilometer</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormDesc className="text-xs">Rate charged per km</FormDesc>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="base_revenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calculated Revenue</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            readOnly={calculatedRevenue !== null}
                            className={calculatedRevenue !== null ? 'bg-muted font-semibold' : ''}
                          />
                        </FormControl>
                        <FormDesc className="text-xs">
                          {calculatedRevenue !== null
                            ? `${ratePerKm || 0} × ${distanceKm || 0} km = ${calculatedRevenue.toFixed(2)}`
                            : 'Enter rate and distance to calculate'}
                        </FormDesc>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Zero Revenue Comment - shown when base revenue is 0 or empty */}
              {(!baseRevenue || baseRevenue === '0' || baseRevenue === '0.00') && (
                <FormField
                  control={form.control}
                  name="zero_revenue_comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zero Revenue Comment</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Explain why this trip has no revenue (e.g., repositioning, internal transfer, warranty trip)"
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormDesc className="text-xs text-amber-600">
                        Adding a comment will modify the missing revenue alert for this trip
                      </FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Kilometer Tracking Section */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium text-sm">Kilometer Tracking</h4>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="starting_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting KM</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0" {...field} />
                      </FormControl>
                      <FormDesc className="text-xs">Odometer at trip start</FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ending_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ending KM</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0" {...field} />
                      </FormControl>
                      <FormDesc className="text-xs">Odometer at trip end</FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="distance_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distance (km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          {...field}
                          readOnly={calculatedDistance !== null}
                          className={calculatedDistance !== null ? 'bg-muted' : ''}
                        />
                      </FormControl>
                      <FormDesc className="text-xs">
                        {calculatedDistance !== null ? 'Auto-calculated' : 'Enter manually or use odometer readings'}
                      </FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="empty_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empty Kilometers</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0" {...field} />
                      </FormControl>
                      <FormDesc className="text-xs">Kilometers traveled without load</FormDesc>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="empty_km_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Empty KM Reason {emptyKm && parseFloat(emptyKm) > 0 && <span className="text-destructive">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Reason for empty kilometers (required if empty km > 0)"
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trip Costs Section - Add new costs while editing */}
            <TripCostSection
              costs={tripCosts}
              onCostsChange={setTripCosts}
              departureDate={form.watch('departure_date')}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTripDialog;