import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Button from '@/components/ui/button-variants';
import { DatePicker } from '@/components/ui/date-picker';
import { DriverSelect } from '@/components/ui/driver-select';
import { Input, Select, TextArea } from '@/components/ui/form-elements';
import { FuelStationSelect } from '@/components/ui/fuel-station-select';
import { Label } from '@/components/ui/label';
import Modal from '@/components/ui/modal';
import { REEFER_UNITS } from '@/constants/fleet';
import { useDispenseFuel, useFuelBunkers } from '@/hooks/useFuelBunkers';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, Loader2, Snowflake } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Type definitions
export interface ReeferDieselRecord {
  id?: string;
  reefer_unit: string;
  date: string;
  fuel_station: string;
  litres_filled: number;
  cost_per_litre: number | null;
  total_cost: number;
  currency: string;
  operating_hours: number | null;
  previous_operating_hours: number | null;
  hours_operated: number | null;
  litres_per_hour: number | null;
  linked_diesel_record_id: string | null;
  driver_name: string;
  notes: string;
}

interface ReeferDieselEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ReeferDieselRecord) => Promise<void>;
  editRecord?: ReeferDieselRecord | null;
}

const ReeferDieselEntryModal = ({
  isOpen,
  onClose,
  onSave,
  editRecord,
}: ReeferDieselEntryModalProps) => {
  const [formData, setFormData] = useState({
    reefer_unit: '',
    date: new Date().toISOString().split('T')[0],
    fuel_station: '',
    litres_filled: '',
    cost_per_litre: '',
    total_cost: '',
    operating_hours: '',
    driver_name: '',
    notes: '',
    currency: 'USD',
  });

  // Fuel source selection: 'station' or 'bunker'
  const [fuelSource, setFuelSource] = useState<'station' | 'bunker'>('station');
  const [selectedBunkerId, setSelectedBunkerId] = useState<string>('');

  // Fetch fuel bunkers
  const { data: bunkers = [], isLoading: isLoadingBunkers } = useFuelBunkers(true);
  const dispenseFuelMutation = useDispenseFuel();

  // Auto-fetched previous hour reading from database
  const [previousHourReading, setPreviousHourReading] = useState<number | null>(null);
  const [previousHourDate, setPreviousHourDate] = useState<string | null>(null);
  const [isLoadingPreviousHours, setIsLoadingPreviousHours] = useState(false);
  const [isFutureDateWarning, setIsFutureDateWarning] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState(false);

  // Function to fetch previous hour reading from last fill-up
  const fetchPreviousHourReading = useCallback(async (reeferUnit: string, currentDate: string) => {
    if (!reeferUnit || !currentDate) {
      setPreviousHourReading(null);
      setPreviousHourDate(null);
      setIsFutureDateWarning(false);
      return;
    }

    setIsLoadingPreviousHours(true);

    try {
      let previousHours: number | null = null;
      let previousDate: string | null = null;

      // Try reefer_diesel_records first (new records)
      const { data: anyReeferData } = await supabase
        .from('reefer_diesel_records')
        .select('operating_hours, date')
        .eq('reefer_unit', reeferUnit)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyReeferData?.operating_hours !== null && anyReeferData?.operating_hours !== undefined) {
        previousHours = anyReeferData.operating_hours;
        previousDate = anyReeferData.date;
      } else {
        // Try legacy table as fallback
        // Legacy fallback: diesel_records may have had operating_hours/hours_operated in older schemas
        const { data: anyLegacyData } = await supabase
          .from('diesel_records')
          .select('date')
          .eq('fleet_number', reeferUnit)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle() as { data: { operating_hours?: number; hours_operated?: number; date?: string } | null };

        if (anyLegacyData) {
          const hoursValue = anyLegacyData.operating_hours ?? anyLegacyData.hours_operated;
          if (hoursValue !== null && hoursValue !== undefined) {
            previousHours = hoursValue;
            previousDate = anyLegacyData.date;
          }
        }
      }

      // Check if the previous record is from a future date
      if (previousHours !== null && previousDate) {
        const isFuture = previousDate > currentDate;
        setIsFutureDateWarning(isFuture);
      } else {
        setIsFutureDateWarning(false);
      }

      setPreviousHourReading(previousHours);
      setPreviousHourDate(previousDate);
    } catch {
      setPreviousHourReading(null);
      setPreviousHourDate(null);
      setIsFutureDateWarning(false);
    } finally {
      setIsLoadingPreviousHours(false);
    }
  }, []);

  // Fetch previous hour reading when reefer unit changes
  useEffect(() => {
    if (formData.reefer_unit && !editRecord) {
      fetchPreviousHourReading(formData.reefer_unit, formData.date);
    }
  }, [formData.reefer_unit, formData.date, editRecord, fetchPreviousHourReading]);

  useEffect(() => {
    if (editRecord && isOpen) {
      setFormData({
        reefer_unit: editRecord.reefer_unit || '',
        date: editRecord.date || new Date().toISOString().split('T')[0],
        fuel_station: editRecord.fuel_station || '',
        litres_filled: editRecord.litres_filled?.toString() || '',
        cost_per_litre: editRecord.cost_per_litre?.toString() || '',
        total_cost: editRecord.total_cost?.toString() || '',
        operating_hours: editRecord.operating_hours?.toString() || '',
        driver_name: editRecord.driver_name || '',
        notes: editRecord.notes || '',
        currency: editRecord.currency || 'USD',
      });
      // When editing, use the stored previous_operating_hours
      setPreviousHourReading(editRecord.previous_operating_hours || null);
      setPreviousHourDate(null);
      setIsFutureDateWarning(false);
      setFuelSource('station');
      setSelectedBunkerId('');
    } else if (isOpen) {
      setFormData({
        reefer_unit: '',
        date: new Date().toISOString().split('T')[0],
        fuel_station: '',
        litres_filled: '',
        cost_per_litre: '',
        total_cost: '',
        operating_hours: '',
        driver_name: '',
        notes: '',
        currency: 'USD',
      });
      setPreviousHourReading(null);
      setPreviousHourDate(null);
      setIsFutureDateWarning(false);
      setErrors({});
      setOperationError(null);
      setOperationSuccess(false);
      setFuelSource('station');
      setSelectedBunkerId('');
    }
  }, [editRecord, isOpen]);

  // Auto-calculate total cost
  useEffect(() => {
    if (formData.litres_filled && formData.cost_per_litre) {
      const total = parseFloat(formData.litres_filled) * parseFloat(formData.cost_per_litre);
      if (!isNaN(total)) {
        setFormData(prev => ({ ...prev, total_cost: total.toFixed(2) }));
      }
    }
  }, [formData.litres_filled, formData.cost_per_litre]);

  // Auto-fill cost per litre from bunker when bunker is selected
  useEffect(() => {
    if (fuelSource === 'bunker' && selectedBunkerId) {
      const bunker = bunkers.find(b => b.id === selectedBunkerId);
      if (bunker?.unit_cost) {
        setFormData(prev => ({ ...prev, cost_per_litre: bunker.unit_cost?.toString() || '' }));
      }
    }
  }, [fuelSource, selectedBunkerId, bunkers]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.reefer_unit) newErrors.reefer_unit = 'Reefer unit is required';
    if (!formData.date) newErrors.date = 'Date is required';

    // Validate fuel source
    if (fuelSource === 'station') {
      if (!formData.fuel_station) newErrors.fuel_station = 'Fuel station is required';
    } else if (fuelSource === 'bunker') {
      if (!selectedBunkerId) newErrors.bunker = 'Please select a bunker';
      const selectedBunker = bunkers.find(b => b.id === selectedBunkerId);
      if (selectedBunker && formData.litres_filled) {
        const litresNeeded = parseFloat(formData.litres_filled);
        if (litresNeeded > selectedBunker.current_level_liters) {
          newErrors.litres_filled = `Bunker only has ${selectedBunker.current_level_liters.toFixed(1)}L available`;
        }
      }
    }

    if (!formData.litres_filled || parseFloat(formData.litres_filled) <= 0) {
      newErrors.litres_filled = newErrors.litres_filled || 'Valid litres filled is required';
    }
    if (!formData.total_cost || parseFloat(formData.total_cost) <= 0) {
      newErrors.total_cost = 'Valid total cost is required';
    }

    // Validate operating hours if previous reading exists
    if (previousHourReading !== null && formData.operating_hours) {
      const currentHours = parseFloat(formData.operating_hours);
      if (currentHours < previousHourReading) {
        newErrors.operating_hours = `Current hours (${currentHours}) cannot be less than previous reading (${previousHourReading})`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsProcessing(true);
    setOperationError(null);

    try {
      const litresFilled = parseFloat(formData.litres_filled);
      const costPerLitre = formData.cost_per_litre === '' ? null : parseFloat(formData.cost_per_litre);
      const operatingHours = formData.operating_hours ? parseFloat(formData.operating_hours) : null;

      // If using bunker, dispense fuel first
      let bunkerDispenseResult = null;
      if (fuelSource === 'bunker' && selectedBunkerId) {
        const selectedBunker = bunkers?.find(b => b.id === selectedBunkerId);
        if (selectedBunker && selectedBunker.current_level_liters !== null && litresFilled > selectedBunker.current_level_liters) {
          throw new Error(`Insufficient fuel in bunker. Available: ${selectedBunker.current_level_liters?.toFixed(0)}L, Requested: ${litresFilled}L`);
        }

        bunkerDispenseResult = await dispenseFuelMutation.mutateAsync({
          bunker_id: selectedBunkerId,
          quantity_liters: litresFilled,
          vehicle_fleet_number: formData.reefer_unit,
          driver_name: formData.driver_name || undefined,
          notes: `Reefer fill: ${formData.notes || ''}`.trim() || undefined,
        });

        if (!bunkerDispenseResult.success) {
          throw new Error('Failed to dispense fuel from bunker');
        }
      }

      // Calculate hours operated and L/hr
      let hoursOperated: number | null = null;
      let litresPerHour: number | null = null;

      if (operatingHours !== null && previousHourReading !== null) {
        hoursOperated = operatingHours - previousHourReading;
        if (hoursOperated > 0 && litresFilled > 0) {
          litresPerHour = litresFilled / hoursOperated;
        }
      }

      // Determine fuel station name
      let fuelStationName = formData.fuel_station;
      if (fuelSource === 'bunker' && selectedBunkerId) {
        const selectedBunker = bunkers?.find(b => b.id === selectedBunkerId);
        fuelStationName = selectedBunker ? `Bunker: ${selectedBunker.name} (${selectedBunker.location})` : 'Bunker';
      }

      const recordData: ReeferDieselRecord = {
        reefer_unit: formData.reefer_unit,
        date: formData.date,
        fuel_station: fuelStationName,
        litres_filled: litresFilled,
        cost_per_litre: costPerLitre,
        total_cost: parseFloat(formData.total_cost),
        currency: formData.currency,
        operating_hours: operatingHours,
        previous_operating_hours: previousHourReading,
        hours_operated: hoursOperated,
        litres_per_hour: litresPerHour,
        linked_diesel_record_id: editRecord?.linked_diesel_record_id ?? null,
        driver_name: formData.driver_name,
        notes: fuelSource === 'bunker' && bunkerDispenseResult
          ? `${formData.notes ? formData.notes + ' | ' : ''}Bunker level after: ${bunkerDispenseResult.new_bunker_level?.toFixed(0)}L`
          : formData.notes,
      };

      await onSave(editRecord ? { ...recordData, id: editRecord.id } : recordData);
      setOperationSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to save reefer diesel record');
    } finally {
      setIsProcessing(false);
    }
  };

  const reeferOptions = [
    { label: 'Select Reefer Unit', value: '' },
    ...REEFER_UNITS.map(unit => ({ label: unit, value: unit }))
  ];

  const currencyOptions = [
    { label: 'USD', value: 'USD' },
    { label: 'USD', value: 'USD' },
  ];

  // Calculate consumption preview
  const consumptionPreview = (() => {
    if (previousHourReading !== null && formData.operating_hours && formData.litres_filled) {
      const hoursOperated = parseFloat(formData.operating_hours) - previousHourReading;
      const litres = parseFloat(formData.litres_filled);
      const litresPerHour = hoursOperated > 0 && litres > 0 ? litres / hoursOperated : 0;
      return { hoursOperated, litresPerHour };
    }
    return null;
  })();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editRecord ? 'Edit Reefer Diesel Record' : 'Reefer Diesel Entry'}
      maxWidth="2xl"
    >
      <div className="flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[60vh]">
          {/* Header badge */}
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500 rounded-lg">
            <Snowflake className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Reefer fuel consumption is measured in <strong>Litres per Hour (L/hr)</strong>
            </span>
          </div>

          {operationSuccess && (
            <Alert className="bg-success/10 border-success">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Reefer diesel record saved successfully!
              </AlertDescription>
            </Alert>
          )}

          {operationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{operationError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Reefer Unit"
              value={formData.reefer_unit}
              onChange={(e) => setFormData({ ...formData, reefer_unit: e.target.value })}
              options={reeferOptions}
              error={errors.reefer_unit}
              disabled={isProcessing}
            />

            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                value={formData.date}
                onChange={(date) => {
                  if (date) {
                    // Use local date formatting to avoid timezone issues
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setFormData({ ...formData, date: `${year}-${month}-${day}` });
                  } else {
                    setFormData({ ...formData, date: '' });
                  }
                }}
                disabled={isProcessing}
                placeholder="Select date"
              />
              {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
            </div>

            {/* Fuel Source Selection */}
            <div className="md:col-span-2 space-y-3">
              <label className="text-sm font-medium text-foreground">Fuel Source</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fuelSource"
                    value="station"
                    checked={fuelSource === 'station'}
                    onChange={() => {
                      setFuelSource('station');
                      setSelectedBunkerId('');
                    }}
                    disabled={isProcessing}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">Filling Station</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fuelSource"
                    value="bunker"
                    checked={fuelSource === 'bunker'}
                    onChange={() => setFuelSource('bunker')}
                    disabled={isProcessing}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">Fuel Bunker</span>
                </label>
              </div>
            </div>

            {fuelSource === 'station' ? (
              <FuelStationSelect
                value={formData.fuel_station}
                onValueChange={(value) => setFormData({ ...formData, fuel_station: value })}
                error={errors.fuel_station}
                disabled={isProcessing}
                placeholder="Select or enter fuel station..."
              />
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Select Bunker</label>
                <select
                  value={selectedBunkerId}
                  onChange={(e) => setSelectedBunkerId(e.target.value)}
                  disabled={isProcessing || isLoadingBunkers}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                >
                  <option value="">Select a bunker...</option>
                  {bunkers?.map((bunker) => (
                    <option key={bunker.id} value={bunker.id}>
                      {bunker.name} - {bunker.location} ({bunker.current_level_liters?.toFixed(0) || 0}L available)
                    </option>
                  ))}
                </select>
                {errors.bunker && (
                  <p className="text-sm text-destructive">{errors.bunker}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Driver/Operator</Label>
              <DriverSelect
                value={formData.driver_name}
                onValueChange={(value) => setFormData({ ...formData, driver_name: value })}
                placeholder="Select driver"
                allowCreate={true}
                disabled={isProcessing}
              />
            </div>

            <Input
              label="Litres Filled"
              type="number"
              step="0.01"
              value={formData.litres_filled}
              onChange={(e) => setFormData({ ...formData, litres_filled: e.target.value })}
              error={errors.litres_filled}
              disabled={isProcessing}
            />

            <Input
              label="Cost per Litre"
              type="number"
              step="0.01"
              value={formData.cost_per_litre}
              onChange={(e) => setFormData({ ...formData, cost_per_litre: e.target.value })}
              disabled={isProcessing}
            />

            <div className="flex items-end gap-2">
              <Select
                label="Currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                options={currencyOptions}
                disabled={isProcessing}
                className="w-24"
              />
              <Input
                label="Total Cost"
                type="number"
                step="0.01"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                error={errors.total_cost}
                disabled={isProcessing}
                className="flex-1"
              />
            </div>

            {/* Operating Hours - For L/hr calculation */}
            <Input
              label="Current Hour Meter Reading"
              type="number"
              step="0.1"
              value={formData.operating_hours}
              onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
              error={errors.operating_hours}
              disabled={isProcessing}
              placeholder="e.g., 1250.5"
            />

            {/* Previous Hour Reading - Auto-fetched */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Previous Hour Meter Reading</Label>
              <div className="flex items-center min-h-10 px-3 border rounded-md bg-muted/50">
                {isLoadingPreviousHours ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : previousHourReading !== null ? (
                  <div className="flex flex-col w-full py-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{previousHourReading.toLocaleString()} hrs</span>
                      {isFutureDateWarning && previousHourDate && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        >
                          Future record: {new Date(previousHourDate).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                    {previousHourDate && !isFutureDateWarning && (
                      <span className="text-xs text-muted-foreground">
                        from {new Date(previousHourDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ) : formData.reefer_unit ? (
                  <span className="text-sm text-muted-foreground italic py-1">No previous fill-up found</span>
                ) : (
                  <span className="text-sm text-muted-foreground italic py-1">Select a reefer unit first</span>
                )}
              </div>
            </div>
          </div>

          {/* Consumption Preview */}
          {consumptionPreview && (
            <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-500/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Calculated Consumption</span>
                <span className="text-lg font-bold text-blue-600">
                  {consumptionPreview.litresPerHour > 0
                    ? consumptionPreview.litresPerHour.toFixed(2)
                    : '0.00'} L/hr
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Hours operated: {consumptionPreview.hoursOperated > 0
                  ? consumptionPreview.hoursOperated.toFixed(1)
                  : '0.0'} hrs
                {consumptionPreview.hoursOperated <= 0 && (
                  <span className="ml-2 text-yellow-600">
                    (Current hours must be greater than previous)
                  </span>
                )}
              </div>
            </div>
          )}

          <TextArea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            disabled={isProcessing}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? 'Saving...' : editRecord ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReeferDieselEntryModal;