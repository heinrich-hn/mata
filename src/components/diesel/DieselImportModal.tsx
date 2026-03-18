
import { Alert, AlertDescription } from '@/components/ui/alert';
import Button from '@/components/ui/button-variants';
import Modal from '@/components/ui/modal';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, Download, FileText, Upload } from 'lucide-react';
import React, { useState } from 'react';

// Type definitions
interface DieselRecord {
  fleet_number: string;
  date: string;
  fuel_station: string;
  litres_filled: number;
  total_cost: number;
  km_reading: number;
  driver_name: string;
  notes: string | null;
  currency: string;
  previous_km_reading?: number;
  cost_per_litre?: number;
  distance_travelled?: number;
  km_per_litre?: number;
  requires_debrief?: boolean;
  debrief_trigger_reason?: string;
}

interface DieselNorm {
  fleet_number: string;
  expected_km_per_litre: number;
  min_acceptable: number;
  max_acceptable: number;
}

interface CSVRecord {
  [key: string]: string;
}

interface DieselImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: DieselRecord[]) => Promise<void>;
}

// CSV Template headers and sample data (previous_km_reading is auto-fetched from last fill-up)
const CSV_HEADERS = [
  'fleet_number',
  'date',
  'fuel_station',
  'litres_filled',
  'total_cost',
  'km_reading',
  'driver_name',
  'currency',
  'cost_per_litre',
  'notes',
];

const SAMPLE_DATA = [
  ['21H', '2025-12-04', 'Shell Harare', '350.5', '8750.00', '125000', 'John Doe', 'USD', '24.96', 'Regular fill-up'],
  ['22H', '2025-12-04', 'Engen Beitbridge', '420.0', '10500.00', '98500', 'Jane Smith', 'USD', '25.00', ''],
  ['23H', '2025-12-03', 'Total SA Johannesburg', '380.25', '9125.50', '156200', 'Mike Johnson', 'ZAR', '24.00', 'Border crossing'],
];

const DieselImportModal = ({
  isOpen,
  onClose,
  onImport,
}: DieselImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState(false);

  const downloadTemplate = () => {
    // Create CSV content with headers and sample data
    const csvContent = [
      CSV_HEADERS.join(','),
      ...SAMPLE_DATA.map(row => row.join(',')),
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'diesel_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadEmptyTemplate = () => {
    // Create CSV content with headers only
    const csvContent = CSV_HEADERS.join(',');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'diesel_import_template_empty.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setOperationError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setOperationError(null);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        const records = lines.slice(1, 6).map(line => {
          const values = line.split(',').map(v => v.trim());
          const record: CSVRecord = {};
          headers.forEach((header, index) => {
            record[header] = values[index];
          });
          return record;
        });

        setPreviewData(records);
      } catch {
        setOperationError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  // Helper function to fetch the previous km reading from the last fill-up for a vehicle
  const fetchPreviousKmReading = async (fleetNumber: string, currentDate: string): Promise<number | undefined> => {
    try {
      const { data, error } = await supabase
        .from('diesel_records')
        .select('km_reading, date')
        .eq('fleet_number', fleetNumber)
        .lt('date', currentDate)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return undefined;
      return data.km_reading;
    } catch {
      return undefined;
    }
  };

  // Helper function to fetch the diesel norm for a fleet number
  const fetchDieselNorm = async (fleetNumber: string): Promise<DieselNorm | null> => {
    try {
      const { data, error } = await supabase
        .from('diesel_norms')
        .select('fleet_number, expected_km_per_litre, min_acceptable, max_acceptable')
        .eq('fleet_number', fleetNumber)
        .single();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  };

  // Helper to check if consumption exceeds norm
  const checkNormViolation = (kmPerLitre: number, norm: DieselNorm | null): { exceeds: boolean; reason: string } => {
    if (!norm) {
      return { exceeds: false, reason: '' };
    }

    if (kmPerLitre < norm.min_acceptable) {
      const variance = ((norm.expected_km_per_litre - kmPerLitre) / norm.expected_km_per_litre * 100).toFixed(1);
      return {
        exceeds: true,
        reason: `Consumption below minimum acceptable (${kmPerLitre.toFixed(2)} km/L vs min ${norm.min_acceptable.toFixed(2)} km/L). ${variance}% below expected norm of ${norm.expected_km_per_litre.toFixed(2)} km/L.`
      };
    }

    return { exceeds: false, reason: '' };
  };

  const handleImport = async () => {
    if (!file) {
      setOperationError('Please select a file');
      return;
    }

    setIsProcessing(true);
    setOperationError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim());

          // Parse records first
          const parsedRecords = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const record: CSVRecord = {};
            headers.forEach((header, index) => {
              record[header] = values[index];
            });

            const litresFilled = parseFloat(record.litres_filled || record['Litres Filled'] || '0');
            const totalCost = parseFloat(record.total_cost || record['Total Cost'] || '0');

            return {
              fleet_number: record.fleet_number || record['Fleet Number'],
              date: record.date || record['Date'],
              fuel_station: record.fuel_station || record['Fuel Station'],
              litres_filled: litresFilled,
              total_cost: totalCost,
              km_reading: parseInt(record.km_reading || record['KM Reading'] || '0'),
              driver_name: record.driver_name || record['Driver Name'] || '',
              notes: record.notes || record['Notes'] || null,
              currency: record.currency || record['Currency'] || 'USD',
              cost_per_litre: record.cost_per_litre || record['Cost Per Litre']
                ? parseFloat(record.cost_per_litre || record['Cost Per Litre'])
                : litresFilled > 0 ? totalCost / litresFilled : undefined,
            };
          });

          // Fetch previous km readings and diesel norms for each record from the database
          const records: DieselRecord[] = await Promise.all(
            parsedRecords.map(async (record) => {
              const previousKmReading = await fetchPreviousKmReading(record.fleet_number, record.date);
              const dieselNorm = await fetchDieselNorm(record.fleet_number);

              // Calculate distance and km/L
              const distance = previousKmReading ? record.km_reading - previousKmReading : undefined;
              const kmPerLitre = distance && record.litres_filled > 0 ? distance / record.litres_filled : undefined;

              // Check if consumption exceeds norm
              let requiresDebrief = false;
              let debriefTriggerReason: string | undefined;

              if (kmPerLitre !== undefined) {
                const normCheck = checkNormViolation(kmPerLitre, dieselNorm);
                if (normCheck.exceeds) {
                  requiresDebrief = true;
                  debriefTriggerReason = normCheck.reason;
                }
              }

              return {
                ...record,
                previous_km_reading: previousKmReading,
                distance_travelled: distance,
                km_per_litre: kmPerLitre,
                requires_debrief: requiresDebrief,
                debrief_trigger_reason: debriefTriggerReason,
              };
            })
          );

          await onImport(records);
          setOperationSuccess(true);
          setTimeout(() => {
            onClose();
            setFile(null);
            setPreviewData([]);
          }, 1500);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to import records';
          setOperationError(errorMessage);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to import records');
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setOperationError(null);
    setOperationSuccess(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Diesel Records"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {operationSuccess && (
          <Alert className="bg-success/10 border-success">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Records imported successfully!
            </AlertDescription>
          </Alert>
        )}

        {operationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        )}

        {/* Template Download Section */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <h4 className="text-sm font-medium mb-1">Download Import Template</h4>
            <p className="text-xs text-muted-foreground">
              Get a CSV template with the correct format for importing diesel transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadEmptyTemplate}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Empty Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              With Sample Data
            </Button>
          </div>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
            disabled={isProcessing}
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">CSV files only</p>
          </label>
          {file && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
            </div>
          )}
        </div>

        {previewData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Preview (first 5 rows)</h4>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Fleet</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Station</th>
                      <th className="px-4 py-2 text-right">Litres</th>
                      <th className="px-4 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((record, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2">{record.fleet_number || record['Fleet Number']}</td>
                        <td className="px-4 py-2">{record.date || record['Date']}</td>
                        <td className="px-4 py-2">{record.fuel_station || record['Fuel Station']}</td>
                        <td className="px-4 py-2 text-right">{record.litres_filled || record['Litres Filled']}</td>
                        <td className="px-4 py-2 text-right">{record.total_cost || record['Total Cost']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Required columns:</p>
            <p className="text-xs">fleet_number, date, fuel_station, litres_filled, total_cost, km_reading</p>
            <p className="font-medium mt-2 mb-1">Optional columns:</p>
            <p className="text-xs">driver_name, currency (USD/ZAR), cost_per_litre, notes</p>
            <p className="text-xs text-muted-foreground mt-2 italic">
              📊 <strong>Distance is calculated automatically:</strong> The system uses the date to find the previous fill-up
              and calculates the distance travelled from the km readings. Consumption is then checked against fleet norms.
            </p>
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isProcessing}>
            {isProcessing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DieselImportModal;
