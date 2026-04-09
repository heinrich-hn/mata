import { Button } from '@/components/ui/button';
import { ClientSelect } from '@/components/ui/client-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DriverSelect } from '@/components/ui/driver-select';
import { GeofenceSelect } from '@/components/ui/geofence-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RouteSelect } from '@/components/ui/route-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useWialonVehicles } from '@/hooks/useWialonVehicles';
import { ADDITIONAL_REVENUE_REASONS } from '@/constants/additionalRevenueReasons';
import { EditHistoryRecord } from '@/types/forms';
import { AlertTriangle, History, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  base_revenue?: number;
  revenue_currency?: string;
  revenue_type?: 'per_load' | 'per_km';
  rate_per_km?: number;
  starting_km?: number;
  ending_km?: number;
  distance_km?: number;
  description?: string;
  zero_revenue_comment?: string;
  additional_revenue?: number;
  additional_revenue_reason?: string;
  edit_history?: EditHistoryRecord[];
  vehicles?: { id: string; fleet_number: string | null; registration: string | null } | null;
  wialon_vehicles?: { id: string; fleet_number: string | null; name: string | null } | null;
}

interface CompletedTripEditModalProps {
  isOpen: boolean;
  trip: Trip;
  onClose: () => void;
  onSave: (updatedTrip: Trip, editRecord: EditHistoryRecord) => void;
}

const TRIP_EDIT_REASONS = [
  'Incorrect data entry',
  'Client requested correction',
  'Financial discrepancy',
  'Distance correction',
  'Date adjustment',
  'Other (specify in comments)'
];

const CompletedTripEditModal = ({
  isOpen,
  trip,
  onClose,
  onSave
}: CompletedTripEditModalProps) => {
  const { userName } = useAuth();
  const { data: vehicles, isLoading: vehiclesLoading } = useWialonVehicles();
  const [formData, setFormData] = useState({
    vehicle_id: trip.vehicle_id || '',
    driver_name: trip.driver_name || '',
    client_name: trip.client_name || '',
    origin: trip.origin || '',
    destination: trip.destination || '',
    route: trip.route || '',
    departure_date: trip.departure_date || '',
    arrival_date: trip.arrival_date || '',
    revenue_type: (trip.revenue_type || 'per_load') as 'per_load' | 'per_km',
    base_revenue: trip.base_revenue?.toString() || '0',
    rate_per_km: trip.rate_per_km?.toString() || '',
    revenue_currency: trip.revenue_currency || 'USD',
    starting_km: trip.starting_km?.toString() || '0',
    ending_km: trip.ending_km?.toString() || '0',
    description: trip.description || '',
    zero_revenue_comment: trip.zero_revenue_comment || '',
    additional_revenue: trip.additional_revenue?.toString() || '',
    additional_revenue_reason: trip.additional_revenue_reason || '',
  });

  const [editReason, setEditReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (trip && isOpen) {
      setFormData({
        vehicle_id: trip.vehicle_id || '',
        driver_name: trip.driver_name || '',
        client_name: trip.client_name || '',
        origin: trip.origin || '',
        destination: trip.destination || '',
        route: trip.route || '',
        departure_date: trip.departure_date || '',
        arrival_date: trip.arrival_date || '',
        revenue_type: (trip.revenue_type || 'per_load') as 'per_load' | 'per_km',
        base_revenue: trip.base_revenue?.toString() || '0',
        rate_per_km: trip.rate_per_km?.toString() || '',
        revenue_currency: trip.revenue_currency || 'USD',
        starting_km: trip.starting_km?.toString() || '0',
        ending_km: trip.ending_km?.toString() || '0',
        description: trip.description || '',
        zero_revenue_comment: trip.zero_revenue_comment || '',
        additional_revenue: trip.additional_revenue?.toString() || '',
        additional_revenue_reason: trip.additional_revenue_reason || '',
      });
      setEditReason('');
      setCustomReason('');
      setErrors({});
    }
  }, [trip, isOpen]);

  const calculatedDistance = Math.max(0, Number(formData.ending_km) - Number(formData.starting_km));

  const calculatedRevenue = (() => {
    if (formData.revenue_type !== 'per_km') return null;
    const rate = formData.rate_per_km ? parseFloat(formData.rate_per_km) : 0;
    const distance = calculatedDistance;
    if (rate > 0 && distance > 0) {
      return rate * distance;
    }
    return null;
  })();

  const handleRevenueTypeChange = (newType: 'per_load' | 'per_km') => {
    setFormData(prev => ({
      ...prev,
      revenue_type: newType,
      rate_per_km: newType === 'per_load' ? '' : prev.rate_per_km,
    }));
  };

  const handleRatePerKmChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    const distance = calculatedDistance;
    const newRevenue = rate > 0 && distance > 0 ? (rate * distance).toFixed(2) : formData.base_revenue;
    setFormData(prev => ({
      ...prev,
      rate_per_km: value,
      base_revenue: newRevenue,
    }));
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!editReason) {
      newErrors.editReason = 'Edit reason is required for completed trips';
    }
    if (editReason === 'Other (specify in comments)' && !customReason.trim()) {
      newErrors.customReason = 'Please specify the reason for editing';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resolveMissingRevenueAlert = async (tripId: string) => {
    try {
      // Resolve alert — missing revenue alerts use category 'load_exception' with issue_type 'missing_revenue'
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: userName || 'System'
        })
        .eq('source_type', 'trip')
        .eq('source_id', tripId)
        .eq('category', 'load_exception')
        .eq('status', 'active')
        .filter('metadata->>issue_type', 'eq', 'missing_revenue');

      if (error) {
        console.error('Error resolving missing revenue alert:', error);
      }
    } catch (error) {
      console.error('Failed to resolve missing revenue alert:', error);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const finalReason = editReason === 'Other (specify in comments)' ? customReason : editReason;

    const editRecord: EditHistoryRecord = {
      editedBy: userName || 'Unknown User',
      editedAt: new Date().toISOString(),
      reason: finalReason,
    };

    const updatedTrip: Trip = {
      ...trip,
      vehicle_id: formData.vehicle_id || undefined,
      driver_name: formData.driver_name,
      client_name: formData.client_name,
      origin: formData.origin,
      destination: formData.destination,
      route: formData.route,
      departure_date: formData.departure_date,
      arrival_date: formData.arrival_date,
      revenue_type: formData.revenue_type,
      base_revenue: Number(formData.base_revenue),
      rate_per_km: formData.rate_per_km ? Number(formData.rate_per_km) : undefined,
      revenue_currency: formData.revenue_currency,
      starting_km: Number(formData.starting_km),
      ending_km: Number(formData.ending_km),
      distance_km: calculatedDistance,
      description: formData.description,
      zero_revenue_comment: formData.zero_revenue_comment || undefined,
      additional_revenue: formData.additional_revenue ? Number(formData.additional_revenue) : undefined,
      additional_revenue_reason: formData.additional_revenue_reason || undefined,
    };

    // Resolve missing revenue alert if we're adding a zero revenue comment
    const hadMissingRevenue = (!trip.base_revenue || trip.base_revenue === 0) && !trip.zero_revenue_comment;
    const nowHasComment = formData.zero_revenue_comment && formData.zero_revenue_comment.trim() !== '';

    if (hadMissingRevenue && nowHasComment) {
      await resolveMissingRevenueAlert(trip.id);
    }

    onSave(updatedTrip, editRecord);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Completed Trip</DialogTitle>
          <DialogDescription>
            Update trip details - {trip.trip_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Changes to completed trips will be logged with timestamps for audit purposes.
            </p>
          </div>

          {/* Edit Reason */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason for Edit *</Label>
              <Select value={editReason} onValueChange={setEditReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIP_EDIT_REASONS.map(reason => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.editReason && <p className="text-sm text-destructive">{errors.editReason}</p>}
            </div>

            {editReason === 'Other (specify in comments)' && (
              <div className="space-y-2">
                <Label>Specify Reason *</Label>
                <Input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter reason..."
                />
                {errors.customReason && <p className="text-sm text-destructive">{errors.customReason}</p>}
              </div>
            )}
          </div>

          {/* Vehicle & Driver */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <Select
                value={formData.vehicle_id || undefined}
                onValueChange={(value) => handleChange('vehicle_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={vehiclesLoading ? "Loading..." : "Select vehicle"} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles?.map((vehicle) => {
                    const extractedFleet = vehicle.fleet_number ||
                      vehicle.name?.match(/^(\d+[A-Z]+|[A-Z]+\d*)/i)?.[1] || null;
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
            </div>

            <div className="space-y-2">
              <Label>Driver</Label>
              <DriverSelect
                value={formData.driver_name}
                onValueChange={(value) => handleChange('driver_name', value)}
                placeholder="Select driver"
                allowCreate={true}
              />
            </div>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Client</Label>
            <ClientSelect
              value={formData.client_name}
              onValueChange={(value) => handleChange('client_name', value)}
              placeholder="Select or create client"
              allowCreate={true}
            />
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origin (From)</Label>
              <GeofenceSelect
                value={formData.origin}
                onValueChange={(value) => handleChange('origin', value)}
                placeholder="Select origin"
                allowCreate={true}
              />
            </div>

            <div className="space-y-2">
              <Label>Destination (To)</Label>
              <GeofenceSelect
                value={formData.destination}
                onValueChange={(value) => handleChange('destination', value)}
                placeholder="Select destination"
                allowCreate={true}
              />
            </div>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <Label>Route</Label>
            <RouteSelect
              value={formData.route}
              onValueChange={(value) => handleChange('route', value)}
              placeholder="Select route"
              showTollFee={false}
              allowCreate={true}
              allowEdit={true}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-2">
              <Label>Loading Date</Label>
              <DatePicker
                value={formData.departure_date || undefined}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    handleChange('departure_date', `${year}-${month}-${day}`);
                  } else {
                    handleChange('departure_date', '');
                  }
                }}
                placeholder="Pick loading date"
                dateFormat="dd MMM yyyy"
                className="w-full"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Offloading Date</Label>
              <DatePicker
                value={formData.arrival_date || undefined}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    handleChange('arrival_date', `${year}-${month}-${day}`);
                  } else {
                    handleChange('arrival_date', '');
                  }
                }}
                placeholder="Pick offloading date"
                dateFormat="dd MMM yyyy"
                className="w-full"
              />
            </div>
          </div>

          {/* Revenue Section */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium text-sm">Revenue</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revenue Type</Label>
                <Select
                  value={formData.revenue_type}
                  onValueChange={(value: 'per_load' | 'per_km') => handleRevenueTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_load">Per Load (Fixed Amount)</SelectItem>
                    <SelectItem value="per_km">Per Kilometer (Rate x Distance)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.revenue_type === 'per_km'
                    ? 'Revenue will be calculated: Rate x Distance'
                    : 'Enter the total revenue for this load'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={formData.revenue_currency}
                  onValueChange={(value) => handleChange('revenue_currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="ZAR">ZAR (South African Rand)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                    <SelectItem value="BWP">BWP (Botswana Pula)</SelectItem>
                    <SelectItem value="ZMW">ZMW (Zambian Kwacha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.revenue_type === 'per_load' ? (
              <div className="space-y-2">
                <Label>Base Revenue</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.base_revenue}
                  onChange={(e) => handleChange('base_revenue', e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Total revenue for this load</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rate per Kilometer</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.rate_per_km}
                    onChange={(e) => handleRatePerKmChange(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Rate charged per km</p>
                </div>

                <div className="space-y-2">
                  <Label>Calculated Revenue</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.base_revenue}
                    readOnly={calculatedRevenue !== null}
                    className={calculatedRevenue !== null ? 'bg-muted font-semibold' : ''}
                    onChange={(e) => handleChange('base_revenue', e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    {calculatedRevenue !== null
                      ? `${formData.rate_per_km || 0} x ${calculatedDistance.toFixed(1)} km = ${calculatedRevenue.toFixed(2)}`
                      : 'Enter rate and distance to calculate'}
                  </p>
                </div>
              </div>
            )}

            {/* Zero Revenue Comment - shown when base revenue is 0 or empty */}
            {(!formData.base_revenue || formData.base_revenue === '0' || formData.base_revenue === '0.00') && (
              <div className="space-y-2">
                <Label>Zero Revenue Comment</Label>
                <Textarea
                  value={formData.zero_revenue_comment}
                  onChange={(e) => handleChange('zero_revenue_comment', e.target.value)}
                  placeholder="Explain why this trip has no revenue (e.g., repositioning, internal transfer, warranty trip)"
                  className="resize-none"
                  rows={2}
                />
                <p className="text-xs text-amber-600">
                  Adding a comment will modify the missing revenue alert for this trip
                </p>
              </div>
            )}

            {/* Additional Revenue */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Additional Revenue</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.additional_revenue}
                  onChange={(e) => handleChange('additional_revenue', e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Extra revenue beyond the base amount</p>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Select
                  value={formData.additional_revenue_reason || undefined}
                  onValueChange={(value) => handleChange('additional_revenue_reason', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDITIONAL_REVENUE_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Kilometer Tracking Section */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium text-sm">Kilometer Tracking</h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Starting KM</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.starting_km}
                  onChange={(e) => handleChange('starting_km', e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Odometer at trip start</p>
              </div>

              <div className="space-y-2">
                <Label>Ending KM</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.ending_km}
                  onChange={(e) => handleChange('ending_km', e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Odometer at trip end</p>
              </div>

              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={calculatedDistance.toFixed(1)}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Auto-calculated</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Additional notes about this trip..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Existing Edit History */}
          {trip.edit_history && trip.edit_history.length > 0 && (
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Previous Edits</h4>
              </div>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {trip.edit_history.map((edit, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{edit.reason}</span>
                    <span className="text-xs text-muted-foreground">{edit.editedBy}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CompletedTripEditModal;
