import { Button } from '@/components/ui/button';
import { ClientSelect } from '@/components/ui/client-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DriverSelect } from '@/components/ui/driver-select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { GeofenceSelect } from '@/components/ui/geofence-select';
import { Input } from '@/components/ui/input';
import { RouteSelect } from '@/components/ui/route-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LOAD_TYPES } from '@/constants/loadTypes';
import { TOLL_COST_CATEGORY, TOLL_COST_SUBCATEGORY } from '@/constants/routeTollCosts';
import { useOperations } from '@/contexts/OperationsContext';
import { useToast } from '@/hooks/use-toast';
import type { RouteExpenseItem } from '@/hooks/useRoutePredefinedExpenses';
import { useWialonVehicles } from '@/hooks/useWialonVehicles';
import type { CostEntry, Trip } from '@/types/operations';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import React, { useState } from 'react';
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
}).refine(
  (data) => {
    // If empty_km is provided and > 0, empty_km_reason is required
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

interface AddTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddTripDialog = ({ isOpen, onClose }: AddTripDialogProps) => {
  const { addTrip, addCostEntry } = useOperations();
  const { toast } = useToast();
  const { data: vehicles, isLoading: vehiclesLoading } = useWialonVehicles();

  // State for tracking selected route toll cost
  const [selectedTollCost, setSelectedTollCost] = useState<{ amount: number; currency: string } | null>(null);

  // State for tracking selected route expenses (from predefined route config)
  const [selectedRouteExpenses, setSelectedRouteExpenses] = useState<RouteExpenseItem[]>([]);

  // State for tracking costs to be added with the trip
  const [tripCosts, setTripCosts] = useState<TripCostEntry[]>([]);

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
    },
  });

  // Watch starting and ending km for auto-calculation
  const startingKm = form.watch('starting_km');
  const endingKm = form.watch('ending_km');
  const emptyKm = form.watch('empty_km');
  const baseRevenue = form.watch('base_revenue');
  const revenueType = form.watch('revenue_type');
  const ratePerKm = form.watch('rate_per_km');
  const distanceKm = form.watch('distance_km');

  // Auto-calculate distance when starting and ending km change
  const calculatedDistance = React.useMemo(() => {
    const start = startingKm ? parseFloat(startingKm) : 0;
    const end = endingKm ? parseFloat(endingKm) : 0;
    if (start > 0 && end > 0 && end >= start) {
      return end - start;
    }
    return null;
  }, [startingKm, endingKm]);

  // Auto-calculate revenue when per_km is selected
  const calculatedRevenue = React.useMemo(() => {
    if (revenueType !== 'per_km') return null;
    const rate = ratePerKm ? parseFloat(ratePerKm) : 0;
    const distance = distanceKm ? parseFloat(distanceKm) : 0;
    if (rate > 0 && distance > 0) {
      return rate * distance;
    }
    return null;
  }, [revenueType, ratePerKm, distanceKm]);

  // Update distance_km field when calculation changes
  React.useEffect(() => {
    if (calculatedDistance !== null) {
      form.setValue('distance_km', calculatedDistance.toString());
    }
  }, [calculatedDistance, form]);

  // Update base_revenue field when per-km calculation changes
  React.useEffect(() => {
    if (calculatedRevenue !== null && revenueType === 'per_km') {
      form.setValue('base_revenue', calculatedRevenue.toFixed(2));
    }
  }, [calculatedRevenue, revenueType, form]);

  const onSubmit = async (data: TripFormData) => {
    try {
      // Build trip data object - cast to unknown first to allow new fields pending DB migration
      const tripData = {
        trip_number: data.trip_number,
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
        status: 'active',
      } as Omit<Trip, 'id' | 'created_at' | 'updated_at'>;

      const tripId = await addTrip(tripData);

      // Add all required route expenses (from predefined route config)
      let routeExpensesAdded = 0;
      if (selectedRouteExpenses.length > 0 && tripId) {
        // Filter for required expenses only - these are auto-added
        const requiredExpenses = selectedRouteExpenses.filter(e => e.is_required);

        for (const expense of requiredExpenses) {
          const expenseEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
            trip_id: tripId,
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

      // Fallback: If no route expenses but toll cost exists (old system), add toll cost
      if (routeExpensesAdded === 0 && selectedTollCost && selectedTollCost.amount > 0 && tripId) {
        const tollCostEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
          trip_id: tripId,
          category: TOLL_COST_CATEGORY,
          sub_category: TOLL_COST_SUBCATEGORY,
          amount: selectedTollCost.amount,
          currency: selectedTollCost.currency,
          date: data.departure_date || format(new Date(), 'yyyy-MM-dd'),
          notes: `Route toll for ${data.route}`,
          is_flagged: false,
          is_system_generated: true,
        };

        try {
          await addCostEntry(tollCostEntry);
          routeExpensesAdded = 1;
        } catch {
          // Trip was created, but toll cost failed - inform user
          console.error('Failed to add toll cost entry');
        }
      }

      // Add any user-specified costs
      let costsAddedCount = 0;
      let costsFailedCount = 0;

      for (const cost of tripCosts) {
        const costEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
          trip_id: tripId,
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
          costsFailedCount++;
          console.error('Failed to add cost entry:', cost.category);
        }
      }

      // Show appropriate success message
      const totalCostsAdded = costsAddedCount + routeExpensesAdded;
      if (totalCostsAdded > 0 || tripCosts.length > 0) {
        if (costsFailedCount > 0) {
          toast({
            title: 'Trip Created',
            description: `Trip added with ${totalCostsAdded} cost(s). ${costsFailedCount} cost(s) failed to add.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Success',
            description: `Trip added successfully with ${totalCostsAdded} cost entr${totalCostsAdded === 1 ? 'y' : 'ies'}`,
          });
        }
      } else {
        toast({
          title: 'Success',
          description: 'Trip added successfully',
        });
      }

      form.reset();
      setSelectedTollCost(null);
      setSelectedRouteExpenses([]);
      setTripCosts([]);
      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add trip',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Trip</DialogTitle>
          <DialogDescription>Create a new active trip</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trip_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>POD Number *</FormLabel>
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
                        value={field.value || undefined}
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
                        allowCreate={true}
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
                        {LOAD_TYPES.map((type) => (
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
                      onValueChange={(value, tollCost, expenses) => {
                        field.onChange(value);
                        setSelectedTollCost(tollCost || null);
                        setSelectedRouteExpenses(expenses || []);
                      }}
                      placeholder="Select route"
                      showTollFee={true}
                      allowCreate={true}
                      allowEdit={true}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {selectedRouteExpenses.filter(e => e.is_required).length > 0
                      ? `${selectedRouteExpenses.filter(e => e.is_required).length} expense(s) will be auto-added: ${selectedRouteExpenses.filter(e => e.is_required).map(e => `${e.sub_category} (${e.currency === 'USD' ? '$' : 'R'}${e.amount})`).join(', ')}`
                      : selectedTollCost
                        ? `Toll cost: ${selectedTollCost.currency === 'USD' ? '$' : 'R'}${selectedTollCost.amount} will be automatically added`
                        : 'Select a route or create a new one with associated expenses'}
                  </FormDescription>
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
                      <FormDescription className="text-xs">
                        {revenueType === 'per_km'
                          ? 'Revenue will be calculated: Rate × Distance'
                          : 'Enter the total revenue for this load'}
                      </FormDescription>
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
                          <SelectItem value="ZAR">ZAR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
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
                      <FormDescription className="text-xs">Total revenue for this load</FormDescription>
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
                        <FormDescription className="text-xs">Rate charged per km</FormDescription>
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
                        <FormDescription className="text-xs">
                          {calculatedRevenue !== null
                            ? `${ratePerKm || 0} × ${distanceKm || 0} km = ${calculatedRevenue.toFixed(2)}`
                            : 'Enter rate and distance to calculate'}
                        </FormDescription>
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
                      <FormLabel className="text-amber-700">
                        Zero Revenue Comment
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Explain why this trip has no revenue (e.g., repositioning, internal transfer, warranty load)"
                          className="resize-none border-amber-200 focus:ring-amber-500"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-amber-600">
                        Providing a comment will modify the missing revenue alert for this trip
                      </FormDescription>
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
                      <FormDescription className="text-xs">Odometer at trip start</FormDescription>
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
                      <FormDescription className="text-xs">Odometer at trip end</FormDescription>
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
                      <FormDescription className="text-xs">
                        {calculatedDistance !== null ? 'Auto-calculated' : 'Enter manually or use odometer readings'}
                      </FormDescription>
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
                      <FormDescription className="text-xs">Kilometers traveled without load</FormDescription>
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

            {/* Trip Costs Section */}
            <TripCostSection
              costs={tripCosts}
              onCostsChange={setTripCosts}
              departureDate={form.watch('departure_date')}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Add Trip</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTripDialog;