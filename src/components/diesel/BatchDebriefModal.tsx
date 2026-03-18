import { Alert, AlertDescription } from '@/components/ui/alert';
import Button from '@/components/ui/button-variants';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, TextArea } from '@/components/ui/form-elements';
import Modal from '@/components/ui/modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import { AlertCircle, CheckCircle2, FileText, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
  whatsapp_shared?: boolean;
}

export interface BatchDebriefData {
  recordIds: string[];
  debrief_notes: string;
  debrief_signed_by: string;
  debrief_signed_at: string;
  debrief_date: string;
  whatsapp_shared?: boolean;
}

export interface BatchDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Array of diesel records for the selected fleet */
  dieselRecords: DieselRecord[];
  /** The fleet number these records belong to */
  fleetNumber: string;
  /** Callback to complete multiple debriefs at once */
  onBatchDebrief: (debriefData: BatchDebriefData) => Promise<void>;
  /** Optional callback to track when WhatsApp is shared for records */
  onWhatsappShared?: (recordIds: string[]) => void;
  /** Optional callback to refresh data after debrief */
  onRefresh?: () => void;
}

/** Normalise a phone number to international format for WhatsApp */
const formatPhoneForWhatsApp = (raw: string): string => {
  // Remove all non-digit characters
  const digits = raw.replace(/\D/g, '');

  // If it's empty, return empty
  if (!digits) return '';

  // South African number handling
  if (digits.startsWith('0') && digits.length === 10) {
    // Convert 0821234567 -> 27821234567
    return '27' + digits.slice(1);
  }

  if (digits.startsWith('27') && digits.length === 11) {
    // Already has country code
    return digits;
  }

  if (digits.startsWith('+27')) {
    // Remove the +
    return digits.slice(1);
  }

  // If it's just digits, assume it's a local number and add SA code
  if (digits.length === 9) {
    return '27' + digits;
  }

  // Return as-is if we can't determine
  return digits;
};

const BatchDebriefModal = ({
  isOpen,
  onClose,
  dieselRecords,
  fleetNumber,
  onBatchDebrief,
  onWhatsappShared,
  onRefresh,
}: BatchDebriefModalProps) => {
  const [formData, setFormData] = useState({
    debrief_notes: '',
    debrief_signed_by: '',
    whatsapp_phone: '',
  });

  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [whatsappTestStatus, setWhatsappTestStatus] = useState<string | null>(null);

  // Filter records by the specific fleet number AND only pending (not debriefed)
  const fleetRecords = useMemo(() =>
    dieselRecords?.filter(record =>
      record.fleet_number === fleetNumber && !record.debrief_signed
    ) || [],
    [dieselRecords, fleetNumber]
  );

  // Get records that haven't been shared on WhatsApp yet
  const unsharedRecords = useMemo(() =>
    fleetRecords.filter(record => !record.whatsapp_shared),
    [fleetRecords]
  );

  // Reset state when modal opens ONLY, not when records change
  useEffect(() => {
    if (isOpen) {
      setFormData({
        debrief_notes: '',
        debrief_signed_by: '',
        whatsapp_phone: '',
      });
      setSelectedRecords(new Set());
      setSelectAll(false);
      setErrors({});
      setOperationError(null);
      setOperationSuccess(false);
      setShareSuccess(false);
      setWhatsappTestStatus(null);
    }
  }, [isOpen]); // Removed fleetRecords dependency

  // Handle select all checkbox
  useEffect(() => {
    if (selectAll) {
      const allIds = new Set(fleetRecords.map(record => record.id));
      setSelectedRecords(allIds);
    } else {
      setSelectedRecords(new Set());
    }
  }, [selectAll, fleetRecords]);

  const handleSelectRecord = (recordId: string, checked: boolean) => {
    const newSelected = new Set(selectedRecords);
    if (checked) {
      newSelected.add(recordId);
    } else {
      newSelected.delete(recordId);
      setSelectAll(false);
    }
    setSelectedRecords(newSelected);
  };

  const validate = (requireSignature: boolean = true) => {
    const newErrors: Record<string, string> = {};

    if (requireSignature && !formData.debrief_signed_by) {
      newErrors.debrief_signed_by = 'Signature name is required';
    }

    if (selectedRecords.size === 0) {
      newErrors.records = 'Please select at least one record to process';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Test WhatsApp number formatting
   */
  const testWhatsAppNumber = () => {
    if (!formData.whatsapp_phone) {
      setWhatsappTestStatus('Please enter a phone number');
      return;
    }

    const formatted = formatPhoneForWhatsApp(formData.whatsapp_phone);
    const testUrl = `https://wa.me/${formatted}`;

    setWhatsappTestStatus(`Formatted: ${formatted}`);

    // Open test URL in new tab (will open WhatsApp if installed)
    window.open(testUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * Generate WhatsApp message for a single record (without PDF)
   */
  const generateWhatsAppMessage = (record: DieselRecord): string => {
    // Ensure currency is properly typed
    const currency = (record.currency as 'ZAR' | 'USD') || 'ZAR';

    const lines = [
      '🚛 *Diesel Debrief Report*',
      `Fleet: ${record.fleet_number}`,
      `Driver: ${record.driver_name || 'N/A'}`,
      `Date: ${formatDate(record.date)}`,
      `Station: ${record.fuel_station}`,
      `Litres: ${formatNumber(record.litres_filled)} L`,
      `Cost: ${formatCurrency(record.total_cost, currency)}`,
    ];

    if (record.distance_travelled) {
      lines.push(`Distance: ${formatNumber(record.distance_travelled)} km`);
    }

    if (record.km_per_litre) {
      lines.push(`Efficiency: ${formatNumber(record.km_per_litre, 2)} km/L`);
    }

    if (formData.debrief_notes) {
      lines.push(`\nNotes: ${formData.debrief_notes}`);
    }

    lines.push(`\n✅ Debrief signed by ${formData.debrief_signed_by}`);
    lines.push('_This is a batch debrief confirmation._');

    return lines.join('\n');
  };

  /**
   * Share a single record via WhatsApp (text only, no PDF)
   */
  const shareSingleRecord = async (record: DieselRecord, phoneNumber: string) => {
    const message = generateWhatsAppMessage(record);
    const formattedPhone = formatPhoneForWhatsApp(phoneNumber);

    console.log('Sharing single record via WhatsApp:', { phoneNumber, formattedPhone, messageLength: message.length });

    // Open WhatsApp with the message
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    return true;
  };

  /**
   * Share multiple records with a summary message (text only, no PDFs)
   */
  const shareMultipleRecords = async (records: DieselRecord[], phoneNumber: string) => {
    // Create a summary message for all records
    const summary = records.map((r, index) => {
      const currency = (r.currency as 'ZAR' | 'USD') || 'ZAR';
      const lines = [
        `${index + 1}. *Fleet ${r.fleet_number}* - ${formatDate(r.date)}`,
        `   Driver: ${r.driver_name || 'N/A'}`,
        `   Station: ${r.fuel_station}`,
        `   Litres: ${formatNumber(r.litres_filled)} L`,
        `   Cost: ${formatCurrency(r.total_cost, currency)}`,
      ];

      if (r.km_per_litre) {
        lines.push(`   Efficiency: ${formatNumber(r.km_per_litre, 2)} km/L`);
      }

      return lines.join('\n');
    }).join('\n\n');

    const message = [
      '🚛 *Batch Diesel Debrief Report*',
      `Records: ${records.length}`,
      `Signed by: ${formData.debrief_signed_by}`,
      `Date: ${formatDate(new Date().toISOString())}`,
      '',
      '*SUMMARY:*',
      summary,
      '',
      '_All records have been debriefed in batch._',
    ].join('\n');

    const formattedPhone = formatPhoneForWhatsApp(phoneNumber);
    console.log('Sharing multiple records via WhatsApp:', { phoneNumber, formattedPhone, recordsCount: records.length });

    // Open WhatsApp with the summary message
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    return true;
  };

  /**
   * Share selected records via WhatsApp AND mark them as debriefed
   */
  const handleBatchWhatsappShare = async () => {
    if (!validate(true)) return;

    // Validate phone number
    if (!formData.whatsapp_phone) {
      setErrors({ ...errors, whatsapp_phone: 'WhatsApp number is required for sharing' });
      return;
    }

    setIsSharing(true);
    setOperationError(null);
    setWhatsappTestStatus(null);

    try {
      const recordIds = Array.from(selectedRecords);
      const selectedRecordsData = fleetRecords.filter(r => recordIds.includes(r.id));

      // Create the batch debrief data
      const batchData: BatchDebriefData = {
        recordIds,
        debrief_notes: formData.debrief_notes,
        debrief_signed_by: formData.debrief_signed_by,
        debrief_signed_at: new Date().toISOString(),
        debrief_date: new Date().toISOString().split('T')[0],
        whatsapp_shared: true, // Mark as shared via WhatsApp
      };

      console.log('Starting batch debrief with WhatsApp:', {
        recordCount: recordIds.length,
        phoneNumber: formData.whatsapp_phone
      });

      // First, mark records as debriefed in the database
      await onBatchDebrief(batchData);

      // Then share via WhatsApp (text only, no PDFs)
      const phoneNumber = formData.whatsapp_phone;

      if (selectedRecordsData.length === 1) {
        // Single record - share text only
        const record = selectedRecordsData[0];
        await shareSingleRecord(record, phoneNumber);
      } else {
        // Multiple records - create a summary message
        await shareMultipleRecords(selectedRecordsData, phoneNumber);
      }

      // Call onWhatsappShared with all recordIds if provided
      if (onWhatsappShared && recordIds.length > 0) {
        onWhatsappShared(recordIds);
      }

      // Refresh parent data
      if (onRefresh) {
        await onRefresh();
      }

      setShareSuccess(true);
      setOperationSuccess(true);

      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Batch WhatsApp share failed:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to share via WhatsApp');
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * Traditional batch debrief without WhatsApp
   */
  const handleBatchDebrief = async () => {
    if (!validate(true)) return;

    setIsProcessing(true);
    setOperationError(null);

    try {
      const batchData: BatchDebriefData = {
        recordIds: Array.from(selectedRecords),
        debrief_notes: formData.debrief_notes,
        debrief_signed_by: formData.debrief_signed_by,
        debrief_signed_at: new Date().toISOString(),
        debrief_date: new Date().toISOString().split('T')[0],
      };

      await onBatchDebrief(batchData);

      // Refresh parent data if callback provided
      if (onRefresh) {
        await onRefresh();
      }

      setOperationSuccess(true);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to complete batch debrief');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPerformanceIssueCount = (record: DieselRecord): number => {
    let count = 0;
    if (record.km_per_litre && record.km_per_litre < 2) count++;
    if (record.probe_discrepancy && record.probe_discrepancy > 5) count++;
    return count;
  };

  const getWhatsappStatus = (record: DieselRecord) => {
    if (record.whatsapp_shared) {
      return <span className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Shared
      </span>;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Batch Debrief - Fleet ${fleetNumber}`}
      maxWidth="3xl"
    >
      <div className="flex flex-col gap-3 max-h-[80vh]">
        {operationSuccess && (
          <Alert className="bg-success/10 border-success py-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success text-sm">
              {shareSuccess
                ? `${selectedRecords.size} record(s) shared via WhatsApp and debriefed successfully!`
                : `Batch debrief completed successfully! ${selectedRecords.size} records processed.`}
            </AlertDescription>
          </Alert>
        )}

        {operationError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{operationError}</AlertDescription>
          </Alert>
        )}

        {errors.records && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{errors.records}</AlertDescription>
          </Alert>
        )}

        {/* Summary Card - More compact */}
        <div className="bg-muted p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-sm">Fleet {fleetNumber}</h4>
              <p className="text-xs text-muted-foreground">
                {fleetRecords.length} pending • {selectedRecords.size} selected
                {unsharedRecords.length > 0 && ` • ${unsharedRecords.length} not shared`}
              </p>
            </div>
            <div className="text-xs bg-background px-2 py-1 rounded-full">
              Total: {formatNumber(
                Array.from(selectedRecords).reduce((sum, id) => {
                  const record = fleetRecords?.find(r => r.id === id);
                  return sum + (record?.litres_filled || 0);
                }, 0)
              )} L
            </div>
          </div>
        </div>

        {/* Records Table - Scrollable with fixed height */}
        <div className="border rounded-lg overflow-hidden max-h-[300px]">
          <div className="overflow-auto h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={(checked) => setSelectAll(checked as boolean)}
                      disabled={fleetRecords.length === 0}
                    />
                  </TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Driver</TableHead>
                  <TableHead className="text-xs">Station</TableHead>
                  <TableHead className="text-right text-xs">Litres</TableHead>
                  <TableHead className="text-right text-xs">Cost</TableHead>
                  <TableHead className="text-right text-xs">km/L</TableHead>
                  <TableHead className="text-xs">Issues</TableHead>
                  <TableHead className="text-xs">WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fleetRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-muted-foreground text-sm">
                      No pending records to debrief for fleet {fleetNumber}
                    </TableCell>
                  </TableRow>
                ) : (
                  fleetRecords.map((record) => {
                    const issueCount = getPerformanceIssueCount(record);
                    const currency = (record.currency as 'ZAR' | 'USD') || 'ZAR';

                    return (
                      <TableRow key={record.id} className="text-sm">
                        <TableCell>
                          <Checkbox
                            checked={selectedRecords.has(record.id)}
                            onCheckedChange={(checked) =>
                              handleSelectRecord(record.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(record.date)}</TableCell>
                        <TableCell className="text-xs">{record.driver_name || 'N/A'}</TableCell>
                        <TableCell className="text-xs">{record.fuel_station}</TableCell>
                        <TableCell className="text-right text-xs">
                          {formatNumber(record.litres_filled)} L
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {formatCurrency(record.total_cost, currency)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {record.km_per_litre ? formatNumber(record.km_per_litre, 1) : '-'}
                        </TableCell>
                        <TableCell>
                          {issueCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px]">
                              {issueCount}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getWhatsappStatus(record)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Debrief Form - Compact */}
        <div className="space-y-2 mt-1">
          <TextArea
            label="Notes"
            value={formData.debrief_notes}
            onChange={(e) => setFormData({ ...formData, debrief_notes: e.target.value })}
            disabled={isProcessing || isSharing}
            rows={2}
            placeholder="Optional notes..."
            className="text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Signed By"
              value={formData.debrief_signed_by}
              onChange={(e) => setFormData({ ...formData, debrief_signed_by: e.target.value })}
              error={errors.debrief_signed_by}
              disabled={isProcessing || isSharing}
              placeholder="Your name"
              required
              className="text-sm"
            />

            <div className="space-y-1">
              <Input
                label="WhatsApp Number"
                value={formData.whatsapp_phone}
                onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
                error={errors.whatsapp_phone}
                disabled={isSharing}
                placeholder="0821234567"
                type="tel"
                className="text-sm"
              />
              {formData.whatsapp_phone && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={testWhatsAppNumber}
                  className="text-[10px] h-5 px-1 text-muted-foreground"
                >
                  <MessageCircle className="h-3 w-3 mr-1" />
                  Test number
                </Button>
              )}
              {whatsappTestStatus && (
                <p className="text-[10px] text-green-600">{whatsappTestStatus}</p>
              )}
            </div>
          </div>
        </div>

        <Alert className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This will mark {selectedRecords.size} record(s) as completed.
          </AlertDescription>
        </Alert>

        {/* Footer Actions - Compact */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={isProcessing || isSharing} size="sm">
            Cancel
          </Button>

          <Button
            variant="outline"
            onClick={handleBatchWhatsappShare}
            disabled={isSharing || isProcessing || selectedRecords.size === 0}
            className="gap-1 text-green-600 border-green-200 hover:bg-green-50 text-xs h-8"
            size="sm"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3" />
                WhatsApp & Debrief ({selectedRecords.size})
              </>
            )}
          </Button>

          <Button
            onClick={handleBatchDebrief}
            disabled={isProcessing || isSharing || selectedRecords.size === 0}
            className="gap-1 text-xs h-8"
            size="sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                Debrief ({selectedRecords.size})
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BatchDebriefModal;