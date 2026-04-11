import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DriverSelect } from '@/components/ui/driver-select';
import { Input } from '@/components/ui/form-elements';
import { Label } from '@/components/ui/label';
import Modal from '@/components/ui/modal';
import { REEFER_UNITS } from '@/constants/fleet';
import { useToast } from '@/hooks/use-toast';
import { useReeferDieselRecords, type ReeferDieselRecordRow } from '@/hooks/useReeferDiesel';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import type { DieselConsumptionRecord } from '@/types/operations';
import { CheckCircle, Clock, Loader2, Plus, Snowflake, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ReeferLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  dieselRecord: DieselConsumptionRecord | null;
  linkedReeferRecords: ReeferDieselRecordRow[];
  onLinkComplete: () => void;
}

const ReeferLinkageModal = ({
  isOpen,
  onClose,
  dieselRecord,
  linkedReeferRecords,
  onLinkComplete,
}: ReeferLinkageModalProps) => {
  const { toast } = useToast();
  const { linkToDieselRecord, createRecordAsync, isCreating } = useReeferDieselRecords();

  // State for creating new reefer records
  const [showNewReeferForm, setShowNewReeferForm] = useState(false);
  const [isLoadingPreviousHours, setIsLoadingPreviousHours] = useState(false);

  // State for unlinking existing records
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // State for new reefer entry
  const [newReeferData, setNewReeferData] = useState({
    reefer_unit: '',
    litres_filled: '',
    cost_per_litre: '',
    total_cost: '',
    operating_hours: '',
    driver_name: dieselRecord?.driver_name || '',
    notes: '',
  });

  const [previousHoursInfo, setPreviousHoursInfo] = useState<{
    hours: number | null;
    date: string | null;
  }>({ hours: null, date: null });

  // Fetch previous hours for selected reefer
  const fetchPreviousHours = useCallback(async (reeferUnit: string) => {
    if (!reeferUnit || !dieselRecord?.date) {
      setPreviousHoursInfo({ hours: null, date: null });
      return;
    }

    setIsLoadingPreviousHours(true);
    try {
      const { data, error } = await supabase
        .from('reefer_diesel_records')
        .select('operating_hours, date')
        .eq('reefer_unit', reeferUnit)
        .lt('date', dieselRecord.date)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setPreviousHoursInfo({ hours: null, date: null });
      } else {
        setPreviousHoursInfo({ hours: data.operating_hours, date: data.date });
      }
    } catch {
      setPreviousHoursInfo({ hours: null, date: null });
    } finally {
      setIsLoadingPreviousHours(false);
    }
  }, [dieselRecord?.date]);

  // Fetch previous hours when reefer unit changes
  useEffect(() => {
    if (newReeferData.reefer_unit) {
      fetchPreviousHours(newReeferData.reefer_unit);
    }
  }, [newReeferData.reefer_unit, fetchPreviousHours]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && dieselRecord) {
      setNewReeferData({
        reefer_unit: '',
        litres_filled: '',
        cost_per_litre: dieselRecord.cost_per_litre?.toString() || '',
        total_cost: '',
        operating_hours: '',
        driver_name: dieselRecord.driver_name || '',
        notes: '',
      });
      setShowNewReeferForm(false);
      setPreviousHoursInfo({ hours: null, date: null });
    }
  }, [isOpen, dieselRecord]);

  // Auto-calculate total cost
  useEffect(() => {
    if (newReeferData.litres_filled && newReeferData.cost_per_litre) {
      const total = parseFloat(newReeferData.litres_filled) * parseFloat(newReeferData.cost_per_litre);
      if (!isNaN(total)) {
        setNewReeferData(prev => ({ ...prev, total_cost: total.toFixed(2) }));
      }
    }
  }, [newReeferData.litres_filled, newReeferData.cost_per_litre]);

  // Calculate consumption preview
  const consumptionPreview = (() => {
    if (previousHoursInfo.hours !== null && newReeferData.operating_hours && newReeferData.litres_filled) {
      const hoursOperated = parseFloat(newReeferData.operating_hours) - previousHoursInfo.hours;
      const litres = parseFloat(newReeferData.litres_filled);
      const litresPerHour = hoursOperated > 0 && litres > 0 ? litres / hoursOperated : 0;
      return { hoursOperated, litresPerHour };
    }
    return null;
  })();

  const handleUnlinkReefer = async (reeferId: string) => {
    setUnlinkingId(reeferId);
    try {
      linkToDieselRecord({ recordId: reeferId, dieselRecordId: null });
      onLinkComplete();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink reefer record',
        variant: 'destructive',
      });
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleCreateAndLink = async () => {
    if (!dieselRecord || !newReeferData.reefer_unit || !newReeferData.litres_filled || !newReeferData.total_cost) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const litresFilled = parseFloat(newReeferData.litres_filled);
    const costPerLitre = newReeferData.cost_per_litre ? parseFloat(newReeferData.cost_per_litre) : null;
    const totalCost = parseFloat(newReeferData.total_cost);
    const operatingHours = newReeferData.operating_hours ? parseFloat(newReeferData.operating_hours) : null;

    // Calculate hours operated and L/hr
    let hoursOperated: number | null = null;
    let litresPerHour: number | null = null;

    if (operatingHours !== null && previousHoursInfo.hours !== null) {
      hoursOperated = operatingHours - previousHoursInfo.hours;
      if (hoursOperated > 0 && litresFilled > 0) {
        litresPerHour = litresFilled / hoursOperated;
      }
    }

    try {
      await createRecordAsync({
        reefer_unit: newReeferData.reefer_unit,
        date: dieselRecord.date,
        fuel_station: dieselRecord.fuel_station,
        litres_filled: litresFilled,
        cost_per_litre: costPerLitre,
        total_cost: totalCost,
        currency: dieselRecord.currency || 'USD',
        operating_hours: operatingHours,
        previous_operating_hours: previousHoursInfo.hours,
        hours_operated: hoursOperated,
        litres_per_hour: litresPerHour,
        linked_diesel_record_id: dieselRecord.id,
        driver_name: newReeferData.driver_name,
        notes: newReeferData.notes,
      });

      toast({
        title: 'Success',
        description: `Reefer ${newReeferData.reefer_unit} fill-up recorded and linked`,
      });

      // Reset form
      setNewReeferData({
        reefer_unit: '',
        litres_filled: '',
        cost_per_litre: dieselRecord.cost_per_litre?.toString() || '',
        total_cost: '',
        operating_hours: '',
        driver_name: dieselRecord.driver_name || '',
        notes: '',
      });
      setShowNewReeferForm(false);
      setPreviousHoursInfo({ hours: null, date: null });
      onLinkComplete();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create reefer record',
        variant: 'destructive',
      });
    }
  };

  // Get reefers not yet linked to this transaction
  const availableReefers = REEFER_UNITS.filter(
    unit => !linkedReeferRecords.some(r => r.reefer_unit === unit)
  );

  if (!dieselRecord) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Reefer Consumption"
      maxWidth="xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {/* Transaction Summary */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{dieselRecord.fleet_number}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(dieselRecord.date)} • {dieselRecord.fuel_station}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatNumber(dieselRecord.litres_filled)} L</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(dieselRecord.total_cost, (dieselRecord.currency || 'USD') as string)}
              </p>
            </div>
          </div>
        </div>

        {/* Currently Linked Reefers */}
        {linkedReeferRecords.length > 0 && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-blue-500" />
              Linked Reefer Records ({linkedReeferRecords.length})
            </Label>
            <div className="space-y-2">
              {linkedReeferRecords.map((reefer) => (
                <div
                  key={reefer.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-blue-500/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">{reefer.reefer_unit}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatNumber(reefer.litres_filled)} L</span>
                        {reefer.litres_per_hour && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 font-medium">
                              {formatNumber(reefer.litres_per_hour, 2)} L/hr
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlinkReefer(reefer.id)}
                    disabled={unlinkingId === reefer.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {unlinkingId === reefer.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Reefer Section */}
        {!showNewReeferForm ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowNewReeferForm(true)}
            disabled={availableReefers.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Reefer Fill-up
          </Button>
        ) : (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Reefer Fill-up
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewReeferForm(false);
                  setNewReeferData({
                    reefer_unit: '',
                    litres_filled: '',
                    cost_per_litre: dieselRecord.cost_per_litre?.toString() || '',
                    total_cost: '',
                    operating_hours: '',
                    driver_name: dieselRecord.driver_name || '',
                    notes: '',
                  });
                  setPreviousHoursInfo({ hours: null, date: null });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reefer Unit Selection */}
              <div className="space-y-2">
                <Label>Reefer Unit *</Label>
                <select
                  value={newReeferData.reefer_unit}
                  onChange={(e) => setNewReeferData(prev => ({ ...prev, reefer_unit: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Select Reefer...</option>
                  {availableReefers.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              {/* Litres Filled */}
              <Input
                label="Litres Filled *"
                type="number"
                step="0.01"
                value={newReeferData.litres_filled}
                onChange={(e) => setNewReeferData(prev => ({ ...prev, litres_filled: e.target.value }))}
                placeholder="e.g., 50.00"
              />

              {/* Cost per Litre */}
              <Input
                label="Cost per Litre"
                type="number"
                step="0.01"
                value={newReeferData.cost_per_litre}
                onChange={(e) => setNewReeferData(prev => ({ ...prev, cost_per_litre: e.target.value }))}
              />

              {/* Total Cost */}
              <Input
                label="Total Cost *"
                type="number"
                step="0.01"
                value={newReeferData.total_cost}
                onChange={(e) => setNewReeferData(prev => ({ ...prev, total_cost: e.target.value }))}
              />

              {/* Current Hour Meter */}
              <Input
                label="Current Hour Meter"
                type="number"
                step="0.1"
                value={newReeferData.operating_hours}
                onChange={(e) => setNewReeferData(prev => ({ ...prev, operating_hours: e.target.value }))}
                placeholder="e.g., 1250.5"
              />

              {/* Previous Hour Meter (Auto-fetched) */}
              <div className="space-y-2">
                <Label>Previous Hour Meter</Label>
                <div className="flex items-center h-10 px-3 border rounded-md bg-muted/50">
                  {isLoadingPreviousHours ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : previousHoursInfo.hours !== null ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{previousHoursInfo.hours.toLocaleString()} hrs</span>
                      {previousHoursInfo.date && (
                        <span className="text-xs text-muted-foreground">
                          from {formatDate(previousHoursInfo.date)}
                        </span>
                      )}
                    </div>
                  ) : newReeferData.reefer_unit ? (
                    <span className="text-sm text-muted-foreground italic">No previous fill-up found</span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Select reefer first</span>
                  )}
                </div>
              </div>
            </div>

            {/* Consumption Preview */}
            {consumptionPreview && (
              <div className="p-3 rounded-lg border-2 border-blue-500 bg-blue-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      Hours Operated: <strong>{consumptionPreview.hoursOperated.toFixed(1)} hrs</strong>
                    </span>
                  </div>
                  <div className="text-lg font-bold text-blue-600">
                    {consumptionPreview.litresPerHour.toFixed(2)} L/hr
                  </div>
                </div>
              </div>
            )}

            {/* Driver & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Driver/Operator</Label>
                <DriverSelect
                  value={newReeferData.driver_name}
                  onValueChange={(value) => setNewReeferData(prev => ({ ...prev, driver_name: value }))}
                  placeholder="Select driver"
                  allowCreate={true}
                />
              </div>
              <Input
                label="Notes"
                value={newReeferData.notes}
                onChange={(e) => setNewReeferData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* Save Button */}
            <Button
              className="w-full"
              onClick={handleCreateAndLink}
              disabled={isCreating || !newReeferData.reefer_unit || !newReeferData.litres_filled || !newReeferData.total_cost}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create & Link Reefer Record
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info Alert */}
        <Alert>
          <Snowflake className="h-4 w-4" />
          <AlertDescription>
            Reefer fill-ups linked to this transaction will be included in the combined cost breakdown
            and appear in the "By Truck" report view.
          </AlertDescription>
        </Alert>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
};

export default ReeferLinkageModal;
