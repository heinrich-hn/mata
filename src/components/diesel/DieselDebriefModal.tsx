import { Alert, AlertDescription } from '@/components/ui/alert';
import Button from '@/components/ui/button-variants';
import { Input, TextArea } from '@/components/ui/form-elements';
import Modal from '@/components/ui/modal';
import { useDrivers } from '@/hooks/useDrivers';
import { generateDieselDebriefPDF, generateDieselDebriefPDFBlob, generateWeeklyDebriefsPDF } from '@/lib/dieselDebriefExport';
import type { WeeklyDebriefRecord, WeeklyDebriefNorm } from '@/lib/dieselDebriefExport';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import { AlertCircle, Calendar, CheckCircle2, FileText, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface TrailerFuelData {
  trailer_id: string;
  operating_hours: number;
  litres_per_hour: number;
  total_litres: number;
}

export interface DieselRecord {
  id: string;
  trip_number?: string;
  vehicle_identifier?: string;
  driver_name?: string;
  litres_consumed?: number;
  total_km?: number;
  km_per_litre?: number;
  trailer_fuel_data?: TrailerFuelData[];
  fleet_number?: string;
  date?: string;
  fuel_station?: string;
  litres_filled?: number;
  vehicle_litres_only?: number;
  trailer_litres_total?: number;
  total_cost?: number;
  currency?: string;
  distance_travelled?: number;
  probe_discrepancy?: number;
  debrief_notes?: string;
  debrief_signed_by?: string;
  debrief_signed?: boolean;
}

export interface DebriefData {
  debrief_notes: string;
  debrief_signed_by: string;
}

interface DieselDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  dieselRecord: DieselRecord;
  onDebrief: (debriefData: DebriefData) => Promise<void>;
  /** Called with the record ID when a WhatsApp share succeeds */
  onWhatsappShared?: (recordId: string) => void;
  /** All diesel records — used for the weekly PDF export (last 7 days). */
  allDieselRecords?: WeeklyDebriefRecord[];
  /** Diesel norms — used for the weekly PDF export. */
  dieselNorms?: WeeklyDebriefNorm[];
}

/** Normalise a phone number to E.164 digits-only (no + or spaces). */
const normalisePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  // South-African local numbers: leading 0 → replace with 27
  if (digits.startsWith('0') && digits.length === 10) return '27' + digits.slice(1);
  return digits;
};

const DieselDebriefModal = ({
  isOpen,
  onClose,
  dieselRecord,
  onDebrief,
  onWhatsappShared,
  allDieselRecords,
  dieselNorms,
}: DieselDebriefModalProps) => {
  const [formData, setFormData] = useState({
    debrief_notes: '',
    debrief_signed_by: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState(false);

  // WhatsApp share state
  const [whatsappPanelOpen, setWhatsappPanelOpen] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { drivers } = useDrivers();

  useEffect(() => {
    if (isOpen && dieselRecord) {
      setFormData({
        debrief_notes: dieselRecord.debrief_notes || '',
        debrief_signed_by: dieselRecord.debrief_signed_by || '',
      });
      setErrors({});
      setOperationError(null);
      setOperationSuccess(false);
      setWhatsappPanelOpen(false);
      setWhatsappStatus('idle');

      // Pre-fill driver phone from drivers list
      if (dieselRecord.driver_name && drivers.length > 0) {
        const name = dieselRecord.driver_name.toLowerCase();
        const match = drivers.find(
          d =>
            `${d.first_name} ${d.last_name}`.toLowerCase() === name ||
            d.first_name.toLowerCase() === name ||
            d.last_name.toLowerCase() === name
        );
        setWhatsappPhone(match?.phone || '');
      }
    }
  }, [isOpen, dieselRecord, drivers]);

  const handleSendWhatsApp = async () => {
    setIsSharingWhatsApp(true);
    setWhatsappStatus('idle');
    try {
      const { blob, fileName } = generateDieselDebriefPDFBlob(dieselRecord);

      const message = [
        '🚛 *Diesel Debrief Report*',
        `Fleet: ${dieselRecord.fleet_number}`,
        `Driver: ${dieselRecord.driver_name || 'N/A'}`,
        `Date: ${formatDate(dieselRecord.date)}`,
        `Station: ${dieselRecord.fuel_station}`,
        `Litres: ${formatNumber(dieselRecord.litres_filled)} L`,
        `Cost: ${formatCurrency(dieselRecord.total_cost, dieselRecord.currency)}`,
        dieselRecord.distance_travelled ? `Distance: ${formatNumber(dieselRecord.distance_travelled)} km` : null,
        dieselRecord.km_per_litre ? `Efficiency: ${formatNumber(dieselRecord.km_per_litre, 2)} km/L` : null,
        dieselRecord.debrief_signed ? `\n✅ Debrief signed by ${dieselRecord.debrief_signed_by}` : null,
        dieselRecord.debrief_notes ? `\nNotes: ${dieselRecord.debrief_notes}` : null,
        '\n_PDF report attached._',
      ]
        .filter(Boolean)
        .join('\n');

      // Try Web Share API (works natively on Android/mobile)
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Diesel Debrief', text: message, files: [file] });
        onWhatsappShared?.(dieselRecord.id);
        setWhatsappStatus('success');
      } else {
        // Desktop fallback: download PDF + open WhatsApp Web with text
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        const phone = normalisePhone(whatsappPhone);
        const waUrl = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        onWhatsappShared?.(dieselRecord.id);
        setWhatsappStatus('success');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setWhatsappStatus('error');
      }
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.debrief_signed_by) {
      newErrors.debrief_signed_by = 'Signature name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDebrief = async () => {
    if (!validate()) return;

    setIsProcessing(true);
    setOperationError(null);

    try {
      const debriefData = {
        id: dieselRecord.id,
        debrief_notes: formData.debrief_notes,
        debrief_signed: true,
        debrief_signed_by: formData.debrief_signed_by,
        debrief_signed_at: new Date().toISOString(),
        debrief_date: new Date().toISOString().split('T')[0],
      };

      await onDebrief(debriefData);
      setOperationSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to complete debrief');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!dieselRecord) return null;

  const performanceIssues = [];
  if (dieselRecord.km_per_litre && dieselRecord.km_per_litre < 2) {
    performanceIssues.push('Low fuel efficiency');
  }
  if (dieselRecord.probe_discrepancy && dieselRecord.probe_discrepancy > 5) {
    performanceIssues.push('Significant probe discrepancy');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Diesel Debrief"
      maxWidth="2xl"
    >
      <div className="flex flex-col gap-0">
        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto max-h-[55vh] space-y-4 pr-1 min-h-0 pb-2">
          {operationSuccess && (
            <Alert className="bg-success/10 border-success">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Debrief completed successfully!
              </AlertDescription>
            </Alert>
          )}

          {operationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{operationError}</AlertDescription>
            </Alert>
          )}

          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h4 className="font-medium text-sm">Record Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Fleet:</span>
                <span className="ml-2 font-medium">{dieselRecord.fleet_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-2 font-medium">{formatDate(dieselRecord.date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Driver:</span>
                <span className="ml-2 font-medium">{dieselRecord.driver_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Station:</span>
                <span className="ml-2 font-medium">{dieselRecord.fuel_station}</span>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <div className="font-medium mb-2">Fuel Breakdown:</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Litres Filled:</span>
                    <span className="font-medium">{formatNumber(dieselRecord.litres_filled)} L</span>
                  </div>
                  {dieselRecord.vehicle_litres_only && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vehicle Fuel:</span>
                        <span className="font-medium">{formatNumber(dieselRecord.vehicle_litres_only)} L</span>
                      </div>
                      {dieselRecord.trailer_litres_total > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Trailer Fuel:</span>
                          <span className="font-medium">{formatNumber(dieselRecord.trailer_litres_total)} L</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Cost:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(dieselRecord.total_cost, dieselRecord.currency)}
                </span>
              </div>
              {dieselRecord.distance_travelled && (
                <div>
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="ml-2 font-medium">{formatNumber(dieselRecord.distance_travelled)} km</span>
                </div>
              )}
              {dieselRecord.km_per_litre && (
                <div className="col-span-2 pt-2 border-t">
                  <span className="text-muted-foreground">Vehicle Efficiency:</span>
                  <span className="ml-2 font-medium text-lg">{formatNumber(dieselRecord.km_per_litre, 2)} km/L</span>
                  <span className="ml-2 text-xs text-muted-foreground">(vehicle fuel only)</span>
                </div>
              )}
            </div>

            {dieselRecord.trailer_fuel_data && dieselRecord.trailer_fuel_data.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="font-medium text-sm mb-2">Trailer Details:</div>
                <div className="space-y-2">
                  {dieselRecord.trailer_fuel_data.map((trailer, idx) => (
                    <div key={idx} className="text-xs bg-background p-2 rounded">
                      <div className="font-medium">{trailer.trailer_id}</div>
                      <div className="flex justify-between mt-1">
                        <span className="text-muted-foreground">Hours: {formatNumber(trailer.operating_hours, 1)}</span>
                        <span className="text-muted-foreground">Rate: {formatNumber(trailer.litres_per_hour, 1)} L/hr</span>
                        <span className="font-medium">Total: {formatNumber(trailer.total_litres, 1)} L</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {performanceIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Issues requiring attention:</strong>
                <ul className="mt-2 list-disc list-inside">
                  {performanceIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <TextArea
              label="Debrief Notes"
              value={formData.debrief_notes}
              onChange={(e) => setFormData({ ...formData, debrief_notes: e.target.value })}
              disabled={isProcessing}
              rows={5}
              placeholder="Record any observations, concerns, or follow-up actions required..."
            />

            <Input
              label="Signed By"
              value={formData.debrief_signed_by}
              onChange={(e) => setFormData({ ...formData, debrief_signed_by: e.target.value })}
              error={errors.debrief_signed_by}
              disabled={isProcessing}
              placeholder="Enter your name to sign off"
            />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              By signing this debrief, you confirm that you have reviewed the diesel record and any issues have been noted.
            </AlertDescription>
          </Alert>
        </div>{/* end scrollable body */}

        {/* ── Sticky footer ── */}
        <div className="border-t pt-4 mt-2 space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => generateDieselDebriefPDF(dieselRecord)}
              disabled={isProcessing}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            {allDieselRecords && allDieselRecords.length > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  generateWeeklyDebriefsPDF({
                    records: allDieselRecords,
                    norms: dieselNorms || [],
                    fleetNumber: dieselRecord.fleet_number,
                  })
                }
                disabled={isProcessing}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Weekly PDF
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={() => {
                setWhatsappPanelOpen(prev => !prev);
                setWhatsappStatus('idle');
              }}
              disabled={isProcessing}
            >
              <Share2 className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button onClick={handleDebrief} disabled={isProcessing}>
              {isProcessing ? 'Signing...' : 'Sign Debrief'}
            </Button>
          </div>

          {/* WhatsApp share panel */}
          {whatsappPanelOpen && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share Debrief via WhatsApp
              </p>
              <p className="text-xs text-muted-foreground">
                Enter the driver's WhatsApp number. The PDF will be downloaded and WhatsApp will open with a pre-filled summary message.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={e => setWhatsappPhone(e.target.value)}
                  placeholder="+27 82 123 4567"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={isSharingWhatsApp}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSharingWhatsApp ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  {isSharingWhatsApp ? 'Sharing...' : 'Send'}
                </Button>
              </div>
              {whatsappStatus === 'success' && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  WhatsApp opened. The PDF has been downloaded — attach it to the message.
                </p>
              )}
              {whatsappStatus === 'error' && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Sharing failed. Please try again or copy the number manually.
                </p>
              )}
            </div>
          )}
        </div>{/* end sticky footer */}
      </div>
    </Modal>
  );
};

export default DieselDebriefModal;
