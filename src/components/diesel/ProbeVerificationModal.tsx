import { Alert, AlertDescription } from '@/components/ui/alert';
import Button from '@/components/ui/button-variants';
import { Input, TextArea } from '@/components/ui/form-elements';
import Modal from '@/components/ui/modal';
import { TRUCKS_WITH_PROBES } from '@/constants/fleet';
import { formatDate, formatNumber } from '@/lib/formatters';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// Type definitions
interface DieselRecord {
  id: string;
  fleet_number: string;
  date: string;
  litres_filled: number;
  fuel_station: string;
  probe_reading?: number;
  probe_verification_notes?: string;
  probe_action_taken?: string;
  probe_verified_by?: string;
}

interface ProbeVerificationData {
  id: string;
  probe_reading: number;
  probe_discrepancy: number | null;
  probe_verification_notes: string;
  probe_action_taken: string;
  probe_verified: boolean;
  probe_verified_by: string;
  probe_verified_at: string;
  probe_verification_date: string;
}

interface ProbeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dieselRecord: DieselRecord | null;
  onVerify: (verificationData: ProbeVerificationData) => Promise<void>;
}

const ProbeVerificationModal = ({
  isOpen,
  onClose,
  dieselRecord,
  onVerify,
}: ProbeVerificationModalProps) => {
  const [formData, setFormData] = useState({
    probe_reading: '',
    probe_verification_notes: '',
    probe_action_taken: '',
    probe_verified_by: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState(false);
  const [discrepancy, setDiscrepancy] = useState<number | null>(null);

  const hasProbe = dieselRecord?.fleet_number
    ? (TRUCKS_WITH_PROBES as readonly string[]).includes(dieselRecord.fleet_number)
    : false;

  useEffect(() => {
    if (isOpen && dieselRecord) {
      setFormData({
        probe_reading: dieselRecord.probe_reading?.toString() || '',
        probe_verification_notes: dieselRecord.probe_verification_notes || '',
        probe_action_taken: dieselRecord.probe_action_taken || '',
        probe_verified_by: dieselRecord.probe_verified_by || '',
      });
      setErrors({});
      setOperationError(null);
      setOperationSuccess(false);
      setDiscrepancy(null);
    }
  }, [isOpen, dieselRecord]);

  useEffect(() => {
    if (formData.probe_reading && dieselRecord?.litres_filled) {
      const probeValue = parseFloat(formData.probe_reading);
      const actualValue = parseFloat(dieselRecord.litres_filled.toString());
      const diff = Math.abs(probeValue - actualValue);
      setDiscrepancy(diff);
    }
  }, [formData.probe_reading, dieselRecord]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.probe_reading || parseFloat(formData.probe_reading) <= 0) {
      newErrors.probe_reading = 'Valid probe reading is required';
    }
    if (!formData.probe_verified_by) {
      newErrors.probe_verified_by = 'Verifier name is required';
    }

    if (discrepancy !== null && discrepancy > 5) {
      if (!formData.probe_action_taken) {
        newErrors.probe_action_taken = 'Action taken is required for large discrepancies';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerify = async () => {
    if (!validate() || !dieselRecord) return;

    setIsProcessing(true);
    setOperationError(null);

    try {
      const verificationData: ProbeVerificationData = {
        id: dieselRecord.id,
        probe_reading: parseFloat(formData.probe_reading),
        probe_discrepancy: discrepancy,
        probe_verification_notes: formData.probe_verification_notes,
        probe_action_taken: formData.probe_action_taken,
        probe_verified: true,
        probe_verified_by: formData.probe_verified_by,
        probe_verified_at: new Date().toISOString(),
        probe_verification_date: new Date().toISOString().split('T')[0],
      };

      await onVerify(verificationData);
      setOperationSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to verify probe reading');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!dieselRecord) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Probe Verification"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {operationSuccess && (
          <Alert className="bg-success/10 border-success">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Probe verification completed successfully!
            </AlertDescription>
          </Alert>
        )}

        {operationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        )}

        {!hasProbe && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Note: Fleet {dieselRecord.fleet_number} does not typically have a probe installed.
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <h4 className="font-medium text-sm">Diesel Record Details</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Fleet:</span>
              <span className="ml-2 font-medium">{dieselRecord.fleet_number}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>
              <span className="ml-2 font-medium">{formatDate(dieselRecord.date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Litres Filled:</span>
              <span className="ml-2 font-medium">{formatNumber(dieselRecord.litres_filled)} L</span>
            </div>
            <div>
              <span className="text-muted-foreground">Station:</span>
              <span className="ml-2 font-medium">{dieselRecord.fuel_station}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Probe Reading (Litres)"
            type="number"
            step="0.01"
            value={formData.probe_reading}
            onChange={(e) => setFormData({ ...formData, probe_reading: e.target.value })}
            error={errors.probe_reading}
            disabled={isProcessing}
          />

          {discrepancy !== null && (
            <Alert variant={discrepancy > 5 ? 'destructive' : 'default'}>
              {discrepancy > 5 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>
                Discrepancy: {formatNumber(discrepancy)} L
                {discrepancy > 5 && ' - Requires investigation'}
              </AlertDescription>
            </Alert>
          )}

          <Input
            label="Verified By"
            value={formData.probe_verified_by}
            onChange={(e) => setFormData({ ...formData, probe_verified_by: e.target.value })}
            error={errors.probe_verified_by}
            disabled={isProcessing}
          />

          <TextArea
            label="Verification Notes"
            value={formData.probe_verification_notes}
            onChange={(e) => setFormData({ ...formData, probe_verification_notes: e.target.value })}
            disabled={isProcessing}
            rows={3}
          />

          {discrepancy !== null && discrepancy > 5 && (
            <TextArea
              label="Action Taken"
              value={formData.probe_action_taken}
              onChange={(e) => setFormData({ ...formData, probe_action_taken: e.target.value })}
              error={errors.probe_action_taken}
              disabled={isProcessing}
              rows={3}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={isProcessing}>
            {isProcessing ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProbeVerificationModal;
