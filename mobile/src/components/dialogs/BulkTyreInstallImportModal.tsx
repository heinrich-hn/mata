import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { extractRegistrationNumber } from "@/constants/fleetTyreConfig";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BulkTyreInstallImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface MountedTyreRecord {
  tire_number: string;
  tire_size: string;
  manufacturer: string;
  supplier?: string;
  tire_cost?: string;
  tire_type: string;
  tire_status?: string;
  mount_status?: string;
  created_date?: string;
  created_by?: string;
  location?: string;
  note?: string;
  tread_depth?: string;
  opening_reading?: string;
  run_limit?: string;
  vehicle_number: string;
  vehicle_name?: string;
  axle_position: string;
  fitment_reading?: string;
  fitment_date?: string;
}

const BulkTyreInstallImportModal = ({ open, onOpenChange, onImportComplete }: BulkTyreInstallImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<MountedTyreRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{ successful: number; failed: number; errors: string[] } | null>(null);

  const downloadTemplate = () => {
    const template = `Tire Number,Tire Size,Manufacturer,Supplier,Tire Cost,Tire Type,Tire Status,Mount Status,Created Date,Created By,Location,Note,Tread Depth,Opening Reading,Run Limit,Vehicle Number,Vehicle Name,Axle Position,Fitment Reading,Fitment Date
TYR001,295/80R22.5,Michelin,Tyre Depot,4500.00,Steer,good,mounted,2025-01-15,Admin,main-warehouse,Front left steer tyre,15.5,12500,80000,33H JFK963FS,Horse 33H,V1,12500,2025-01-15
TYR002,295/80R22.5,Michelin,Tyre Depot,4500.00,Steer,good,mounted,2025-01-15,Admin,main-warehouse,Front right steer tyre,15.2,12500,80000,33H JFK963FS,Horse 33H,V2,12500,2025-01-15
TYR003,11R22.5,Bridgestone,Tyre Depot,3800.00,Drive,good,mounted,2025-01-20,Admin,main-warehouse,Rear left outer,14.8,0,100000,1T ADZ9011/ADZ9010,Trailer 1T,T1,0,2025-01-20
TYR004,385/65R22.5,Continental,Continental Direct,3200.00,Trailer,good,mounted,2025-02-01,Admin,secondary-warehouse,Reefer front left,13.5,5000,120000,7F LX08PLGP,Reefer 7F,T1,5000,2025-02-01`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_tyre_install_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      toast.error("Please select a valid CSV file");
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const requiredHeaders = ['tire_number', 'tire_size', 'manufacturer', 'tire_type', 'vehicle_number', 'axle_position'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`);
        return;
      }

      const records: MountedTyreRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const record: Partial<MountedTyreRecord> = {};
          headers.forEach((header, index) => {
            (record as Record<string, string>)[header] = values[index];
          });
          records.push(record as MountedTyreRecord);
        }
      }

      setParsedData(records);
      toast.success(`Parsed ${records.length} records from CSV`);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error("No data to import");
      return;
    }

    setIsProcessing(true);
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Fetch all vehicles first
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration_number, fleet_number');

      if (vehiclesError) {
        toast.error(`Failed to fetch vehicles: ${vehiclesError.message}`);
        setIsProcessing(false);
        return;
      }

      for (const record of parsedData) {
        try {
          // Find vehicle by registration number
          const vehicle = vehicles?.find(v =>
            v.registration_number === record.vehicle_number ||
            v.registration_number.includes(record.vehicle_number)
          );

          if (!vehicle) {
            errors.push(`Vehicle not found: ${record.vehicle_number}`);
            failed++;
            continue;
          }

          // Use fleet_number from the vehicles table directly
          const fleetNumber = vehicle.fleet_number;
          if (!fleetNumber) {
            errors.push(`Vehicle ${vehicle.registration_number} does not have a fleet_number set`);
            failed++;
            continue;
          }

          const registrationNo = extractRegistrationNumber(vehicle.registration_number);
          const fleetPosition = `${fleetNumber} ${vehicle.registration_number}-${record.axle_position}`;

          // Step 1: Insert into tyres table
          const { data: tyreData, error: tyreError } = await supabase
            .from('tyres')
            .insert({
              tyre_code: record.tire_number,
              brand: record.manufacturer,
              model: record.tire_type,
              size: record.tire_size,
              type: record.tire_type,
              status: record.tire_status || 'good',
              current_tread_depth: record.tread_depth ? parseFloat(record.tread_depth) : null,
              purchase_cost: record.tire_cost ? parseFloat(record.tire_cost) : null,
              supplier: record.supplier || null,
              notes: record.note || null,
              current_vehicle_id: vehicle.id,
              current_fleet_position: fleetPosition,
              location: 'installed',
            })
            .select()
            .single();

          if (tyreError) {
            errors.push(`Failed to create tyre ${record.tire_number}: ${tyreError.message}`);
            failed++;
            continue;
          }

          // Step 2: Update unified fleet_tyre_positions table
          const { error: fleetError } = await supabase
            .from("fleet_tyre_positions")
            .upsert({
              fleet_number: fleetNumber,
              vehicle_id: vehicle.id,
              registration_no: registrationNo,
              position: record.axle_position,
              tyre_code: record.tire_number,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'fleet_number,registration_no,position' });

          if (fleetError) {
            errors.push(`Failed to update fleet table for ${record.tire_number}: ${fleetError.message}`);
            // Try to rollback tyre creation
            await supabase.from('tyres').delete().eq('id', tyreData.id);
            failed++;
            continue;
          }

          // Step 3: Create position history record
          await supabase
            .from('tyre_position_history')
            .insert({
              tyre_id: tyreData.id,
              vehicle_id: vehicle.id,
              position: record.axle_position,
              fleet_position: fleetPosition,
              action: 'installed',
              odometer_reading: record.fitment_reading ? parseInt(record.fitment_reading) : null,
              tread_depth_at_change: record.tread_depth ? parseFloat(record.tread_depth) : null,
              notes: `Bulk import - ${record.note || 'Initial installation'}`,
            });

          // Step 4: Create lifecycle event
          await supabase
            .from('tyre_lifecycle_events')
            .insert({
              tyre_id: tyreData.id,
              tyre_code: record.tire_number,
              event_type: 'installed',
              event_date: record.fitment_date || new Date().toISOString().split('T')[0],
              vehicle_id: vehicle.id,
              fleet_position: fleetPosition,
              km_reading: record.fitment_reading ? parseInt(record.fitment_reading) : null,
              tread_depth_at_event: record.tread_depth ? parseFloat(record.tread_depth) : null,
              notes: `Installed at ${record.axle_position} via bulk import`,
              performed_by: record.created_by || 'System',
            });

          successful++;
        } catch (error) {
          console.error(`Error processing record ${record.tire_number}:`, error);
          errors.push(`Error processing ${record.tire_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          failed++;
        }
      }

      setImportResults({ successful, failed, errors });

      if (successful > 0) {
        toast.success(`Successfully imported ${successful} tyres`);
        onImportComplete();
      }

      if (failed > 0) {
        toast.error(`Failed to import ${failed} tyres. Check details below.`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("An error occurred during import");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setImportResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Installed Tyres</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import tyres that are already installed on vehicles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Required columns:</strong> Tire Number, Tire Size, Manufacturer, Tire Type, Vehicle Number, Axle Position
              <br />
              <strong>Optional columns:</strong> Supplier, Tire Cost, Tire Status, Mount Status, Created Date, Created By,
              Location, Note, Tread Depth, Opening Reading, Run Limit, Vehicle Name, Fitment Reading, Fitment Date
              <br />
              <strong>Vehicle Number format:</strong> Must match registration in database (e.g., "33H JFK963FS", "7F LX08PLGP")
              <br />
              <strong>Axle Position examples:</strong> V1-V10, SP (for horses), T1-T16, SP (for trailers)
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <label htmlFor="csv-upload-bulk-install">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {file ? file.name : "Select CSV File"}
                </span>
              </Button>
            </label>
            <input
              id="csv-upload-bulk-install"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {parsedData.length > 0 && (
            <>
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tyre Code</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Tread</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((record, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{record.tire_number}</TableCell>
                          <TableCell className="font-mono text-xs">{record.tire_size}</TableCell>
                          <TableCell>{record.manufacturer}</TableCell>
                          <TableCell className="font-mono text-xs">{record.vehicle_number}</TableCell>
                          <TableCell className="font-semibold">{record.axle_position}</TableCell>
                          <TableCell>{record.tread_depth || '-'}</TableCell>
                          <TableCell>{record.tire_status || 'good'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Total records: {parsedData.length}
                </p>
              </div>

              {importResults && (
                <Alert className={importResults.failed === 0 ? "border-green-500" : "border-yellow-500"}>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Import Complete:</strong> {importResults.successful} successful, {importResults.failed} failed
                    {importResults.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <strong>Errors:</strong>
                        <ul className="list-disc list-inside text-xs">
                          {importResults.errors.map((error, idx) => (
                            <li key={idx} className="text-red-600">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isProcessing || parsedData.length === 0}
                >
                  {isProcessing ? "Importing..." : `Import ${parsedData.length} Tyres`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTyreInstallImportModal;