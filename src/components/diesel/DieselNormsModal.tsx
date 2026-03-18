
import { Alert, AlertDescription } from '@/components/ui/alert';
import Button from '@/components/ui/button-variants';
import { Input, Select } from '@/components/ui/form-elements';
import Modal from '@/components/ui/modal';
import { useFleetNumberOptions } from '@/hooks/useFleetNumbers';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// Type definitions
interface DieselNorm {
  id?: string;
  fleet_number: string;
  expected_km_per_litre: number;
  tolerance_percentage: number;
  min_acceptable: number;
  max_acceptable: number;
  updated_by: string;
  last_updated: string;
}

interface DieselNormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (norm: DieselNorm) => Promise<void>;
  editNorm?: DieselNorm | null;
}

const DieselNormsModal = ({
  isOpen,
  onClose,
  onSave,
  editNorm,
}: DieselNormsModalProps) => {
  const [formData, setFormData] = useState({
    fleet_number: '',
    expected_km_per_litre: '',
    tolerance_percentage: '10',
    updated_by: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState(false);
  const [calculatedRanges, setCalculatedRanges] = useState({
    min: 0,
    max: 0,
  });

  useEffect(() => {
    if (editNorm && isOpen) {
      setFormData({
        fleet_number: editNorm.fleet_number || '',
        expected_km_per_litre: editNorm.expected_km_per_litre?.toString() || '',
        tolerance_percentage: editNorm.tolerance_percentage?.toString() || '10',
        updated_by: editNorm.updated_by || '',
      });
    } else if (isOpen) {
      setFormData({
        fleet_number: '',
        expected_km_per_litre: '',
        tolerance_percentage: '10',
        updated_by: '',
      });
      setErrors({});
      setOperationError(null);
      setOperationSuccess(false);
    }
  }, [editNorm, isOpen]);

  useEffect(() => {
    if (formData.expected_km_per_litre && formData.tolerance_percentage) {
      const expected = parseFloat(formData.expected_km_per_litre);
      const tolerance = parseFloat(formData.tolerance_percentage);
      const range = (expected * tolerance) / 100;
      setCalculatedRanges({
        min: expected - range,
        max: expected + range,
      });
    }
  }, [formData.expected_km_per_litre, formData.tolerance_percentage]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fleet_number) newErrors.fleet_number = 'Fleet number is required';
    if (!formData.expected_km_per_litre || parseFloat(formData.expected_km_per_litre) <= 0) {
      newErrors.expected_km_per_litre = 'Valid expected km/L is required';
    }
    if (!formData.tolerance_percentage || parseFloat(formData.tolerance_percentage) < 0) {
      newErrors.tolerance_percentage = 'Valid tolerance percentage is required';
    }
    if (!formData.updated_by) newErrors.updated_by = 'Updated by is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsProcessing(true);
    setOperationError(null);

    try {
      const normData: DieselNorm = {
        fleet_number: formData.fleet_number,
        expected_km_per_litre: parseFloat(formData.expected_km_per_litre),
        tolerance_percentage: parseFloat(formData.tolerance_percentage),
        min_acceptable: calculatedRanges.min,
        max_acceptable: calculatedRanges.max,
        updated_by: formData.updated_by,
        last_updated: new Date().toISOString(),
      };

      await onSave(editNorm ? { ...normData, id: editNorm.id } : normData);
      setOperationSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to save diesel norm');
    } finally {
      setIsProcessing(false);
    }
  };

  const { options: fleetOptions } = useFleetNumberOptions();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editNorm ? 'Edit Fuel Efficiency Norm' : 'Add Fuel Efficiency Norm'}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {operationSuccess && (
          <Alert className="bg-success/10 border-success">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Fuel norm saved successfully!
            </AlertDescription>
          </Alert>
        )}

        {operationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Select
            label="Fleet Number"
            value={formData.fleet_number}
            onChange={(e) => setFormData({ ...formData, fleet_number: e.target.value })}
            options={fleetOptions}
            error={errors.fleet_number}
            disabled={isProcessing || !!editNorm}
          />

          <Input
            label="Expected KM per Litre"
            type="number"
            step="0.01"
            value={formData.expected_km_per_litre}
            onChange={(e) => setFormData({ ...formData, expected_km_per_litre: e.target.value })}
            error={errors.expected_km_per_litre}
            disabled={isProcessing}
          />

          <Input
            label="Tolerance Percentage (%)"
            type="number"
            step="0.1"
            value={formData.tolerance_percentage}
            onChange={(e) => setFormData({ ...formData, tolerance_percentage: e.target.value })}
            error={errors.tolerance_percentage}
            disabled={isProcessing}
          />

          {formData.expected_km_per_litre && formData.tolerance_percentage && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Calculated Acceptable Range</h4>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Minimum:</span>
                  <span className="ml-2 font-medium">{calculatedRanges.min.toFixed(2)} km/L</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Maximum:</span>
                  <span className="ml-2 font-medium">{calculatedRanges.max.toFixed(2)} km/L</span>
                </div>
              </div>
            </div>
          )}

          <Input
            label="Updated By"
            value={formData.updated_by}
            onChange={(e) => setFormData({ ...formData, updated_by: e.target.value })}
            error={errors.updated_by}
            disabled={isProcessing}
          />
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            These norms will be used to flag diesel records that fall outside the acceptable range.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? 'Saving...' : editNorm ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DieselNormsModal;
