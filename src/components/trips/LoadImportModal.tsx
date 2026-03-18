import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

interface LoadImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoadImportModal = ({ isOpen, onClose }: LoadImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'xlsx' || fileExtension === 'csv' || fileExtension === 'xls') {
        setFile(selectedFile);
      } else {
        toast({
          title: 'Invalid file type',
          description: 'Please select an Excel (.xlsx, .xls) or CSV file',
          variant: 'destructive',
        });
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);

    // Simulate import process
    setTimeout(() => {
      setIsImporting(false);
      toast({
        title: 'Import successful',
        description: 'Trips have been imported successfully',
      });
      setFile(null);
      onClose();
    }, 2000);
  };

  const downloadTemplate = () => {
    // Define template headers matching the trips table structure for trip allocation
    // Distance KM is auto-calculated from Starting KM and Ending KM
    // Load Category determines pricing: Local = rate per km, Export = fixed revenue
    const templateData = [
      {
        'Trip Number': 'TRIP-001',
        'Driver Name': 'John Smith',
        'Vehicle Fleet Number': 'FL-001',
        'Client Name': 'ABC Logistics',
        'Client Type': 'external',
        'Load Category': 'Local',
        'Load Type': 'General Freight',
        'Origin': 'Johannesburg',
        'Destination': 'Pretoria',
        'Route': 'N1 Highway',
        'Departure Date': '2026-01-20',
        'Arrival Date': '2026-01-20',
        'Starting KM': 150000,
        'Ending KM': 150080,
        'Empty KM': 10,
        'Empty KM Reason': 'Returning from depot',
        'Rate Per KM': 18.50,
        'Base Revenue': '',
        'Revenue Currency': 'ZAR',
        'Special Requirements': 'Handle with care',
        'External Load Ref': 'PO-12345',
      },
      // Second example - Export load with fixed revenue
      {
        'Trip Number': 'TRIP-002',
        'Driver Name': 'Jane Doe',
        'Vehicle Fleet Number': 'FL-002',
        'Client Name': 'XYZ Transport',
        'Client Type': 'external',
        'Load Category': 'Export',
        'Load Type': 'Container',
        'Origin': 'Durban Port',
        'Destination': 'Harare',
        'Route': 'N3 to Beitbridge',
        'Departure Date': '2026-01-22',
        'Arrival Date': '2026-01-24',
        'Starting KM': 85000,
        'Ending KM': 86500,
        'Empty KM': 0,
        'Empty KM Reason': '',
        'Rate Per KM': '',
        'Base Revenue': 45000,
        'Revenue Currency': 'USD',
        'Special Requirements': 'Cross-border documentation required',
        'External Load Ref': 'EXP-2026-001',
      },
      // Third example - Local load
      {
        'Trip Number': 'TRIP-003',
        'Driver Name': 'Peter Moyo',
        'Vehicle Fleet Number': 'FL-003',
        'Client Name': 'Local Distributors',
        'Client Type': 'external',
        'Load Category': 'Local',
        'Load Type': 'FMCG',
        'Origin': 'Johannesburg',
        'Destination': 'Polokwane',
        'Route': 'N1 North',
        'Departure Date': '2026-01-23',
        'Arrival Date': '2026-01-23',
        'Starting KM': 200000,
        'Ending KM': 200320,
        'Empty KM': 20,
        'Empty KM Reason': 'Collection detour',
        'Rate Per KM': 22.00,
        'Base Revenue': '',
        'Revenue Currency': 'ZAR',
        'Special Requirements': '',
        'External Load Ref': 'LD-5678',
      },
      // Empty row as template placeholder
      {
        'Trip Number': '',
        'Driver Name': '',
        'Vehicle Fleet Number': '',
        'Client Name': '',
        'Client Type': '',
        'Load Category': '',
        'Load Type': '',
        'Origin': '',
        'Destination': '',
        'Route': '',
        'Departure Date': '',
        'Arrival Date': '',
        'Starting KM': '',
        'Ending KM': '',
        'Empty KM': '',
        'Empty KM Reason': '',
        'Rate Per KM': '',
        'Base Revenue': '',
        'Revenue Currency': '',
        'Special Requirements': '',
        'External Load Ref': '',
      },
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 15 }, // Trip Number
      { wch: 18 }, // Driver Name
      { wch: 20 }, // Vehicle Fleet Number
      { wch: 20 }, // Client Name
      { wch: 12 }, // Client Type
      { wch: 14 }, // Load Category
      { wch: 18 }, // Load Type
      { wch: 15 }, // Origin
      { wch: 15 }, // Destination
      { wch: 18 }, // Route
      { wch: 14 }, // Departure Date
      { wch: 14 }, // Arrival Date
      { wch: 12 }, // Starting KM
      { wch: 12 }, // Ending KM
      { wch: 10 }, // Empty KM
      { wch: 22 }, // Empty KM Reason
      { wch: 12 }, // Rate Per KM
      { wch: 14 }, // Base Revenue
      { wch: 16 }, // Revenue Currency
      { wch: 30 }, // Special Requirements
      { wch: 18 }, // External Load Ref
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Trip Allocation Template');

    // Create instructions sheet
    const instructionsData = [
      { 'Field': 'Trip Number', 'Required': 'Optional', 'Description': 'Unique trip identifier (e.g., TRIP-001). Auto-generated if empty.' },
      { 'Field': 'Driver Name', 'Required': 'Yes', 'Description': 'Full name of the assigned driver' },
      { 'Field': 'Vehicle Fleet Number', 'Required': 'Yes', 'Description': 'Fleet number of the assigned vehicle (must exist in system)' },
      { 'Field': 'Client Name', 'Required': 'Yes', 'Description': 'Customer/client name' },
      { 'Field': 'Client Type', 'Required': 'Optional', 'Description': 'Type of client: "internal" or "external" (defaults to external)' },
      { 'Field': 'Load Category', 'Required': 'Yes', 'Description': 'Either "Local" (per-km rate pricing) or "Export" (fixed revenue pricing)' },
      { 'Field': 'Load Type', 'Required': 'Yes', 'Description': 'Type of cargo (e.g., General Freight, Container, FMCG, Refrigerated, Hazmat)' },
      { 'Field': 'Origin', 'Required': 'Yes', 'Description': 'Pickup location/city' },
      { 'Field': 'Destination', 'Required': 'Yes', 'Description': 'Delivery location/city' },
      { 'Field': 'Route', 'Required': 'Optional', 'Description': 'Route description or route code (e.g., N1 Highway, N3 to Beitbridge)' },
      { 'Field': 'Departure Date', 'Required': 'Yes', 'Description': 'Planned departure date. Format: YYYY-MM-DD' },
      { 'Field': 'Arrival Date', 'Required': 'Yes', 'Description': 'Expected arrival date. Format: YYYY-MM-DD' },
      { 'Field': 'Starting KM', 'Required': 'Yes', 'Description': 'Vehicle odometer reading at trip start (number only). Distance is auto-calculated.' },
      { 'Field': 'Ending KM', 'Required': 'Yes', 'Description': 'Vehicle odometer reading at trip end (number only). Distance = Ending KM - Starting KM' },
      { 'Field': 'Empty KM', 'Required': 'Optional', 'Description': 'Empty running kilometers (deadhead distance)' },
      { 'Field': 'Empty KM Reason', 'Required': 'Optional', 'Description': 'Reason for empty kilometers (e.g., Returning from depot, Collection detour)' },
      { 'Field': 'Rate Per KM', 'Required': 'For Local', 'Description': 'Rate per kilometer for LOCAL loads only. Revenue = Distance × Rate Per KM' },
      { 'Field': 'Base Revenue', 'Required': 'For Export', 'Description': 'Fixed revenue amount for EXPORT loads only. Leave empty for Local loads.' },
      { 'Field': 'Revenue Currency', 'Required': 'Optional', 'Description': 'Currency code: "ZAR" or "USD" (defaults to ZAR for Local, USD for Export)' },
      { 'Field': 'Special Requirements', 'Required': 'Optional', 'Description': 'Any special handling instructions or notes' },
      { 'Field': 'External Load Ref', 'Required': 'Optional', 'Description': 'External reference number (customer PO, booking ref, etc.)' },
    ];

    const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
    wsInstructions['!cols'] = [
      { wch: 22 },
      { wch: 12 },
      { wch: 75 },
    ];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Create notes sheet with important information
    const notesData = [
      { 'Note': '═══════════════════════════════════════════════════════════════════════════════════════════' },
      { 'Note': 'IMPORTANT NOTES FOR SUCCESSFUL TRIP ALLOCATION IMPORT' },
      { 'Note': '═══════════════════════════════════════════════════════════════════════════════════════════' },
      { 'Note': '' },
      { 'Note': '▶ DISTANCE CALCULATION:' },
      { 'Note': '   • Distance is AUTO-CALCULATED: Distance = Ending KM - Starting KM' },
      { 'Note': '   • You only need to enter Starting KM and Ending KM' },
      { 'Note': '   • Both Starting KM and Ending KM are REQUIRED fields' },
      { 'Note': '' },
      { 'Note': '▶ LOAD CATEGORY - TWO PRICING MODELS:' },
      { 'Note': '' },
      { 'Note': '   📍 LOCAL LOADS (per-km rate):' },
      { 'Note': '      • Set Load Category = "Local"' },
      { 'Note': '      • Enter Rate Per KM (e.g., 18.50)' },
      { 'Note': '      • Leave Base Revenue EMPTY' },
      { 'Note': '      • Revenue is calculated: Distance × Rate Per KM' },
      { 'Note': '      • Example: 80 km × R18.50/km = R1,480 revenue' },
      { 'Note': '      • Currency defaults to ZAR' },
      { 'Note': '' },
      { 'Note': '   🌍 EXPORT LOADS (fixed revenue):' },
      { 'Note': '      • Set Load Category = "Export"' },
      { 'Note': '      • Enter Base Revenue (fixed amount, e.g., 45000)' },
      { 'Note': '      • Leave Rate Per KM EMPTY' },
      { 'Note': '      • Revenue is the fixed amount entered' },
      { 'Note': '      • Currency defaults to USD for exports' },
      { 'Note': '' },
      { 'Note': '▶ REQUIRED FIELDS:' },
      { 'Note': '   • Driver Name, Vehicle Fleet Number, Client Name' },
      { 'Note': '   • Load Category, Load Type, Origin, Destination' },
      { 'Note': '   • Departure Date, Arrival Date, Starting KM, Ending KM' },
      { 'Note': '   • Rate Per KM (for Local) OR Base Revenue (for Export)' },
      { 'Note': '' },
      { 'Note': '▶ FORMATTING RULES:' },
      { 'Note': '   • All dates: YYYY-MM-DD format (e.g., 2026-01-20)' },
      { 'Note': '   • Numbers: NO currency symbols, NO commas (use 25000 not R25,000)' },
      { 'Note': '   • Vehicle Fleet Number: Must match existing vehicle in system' },
      { 'Note': '   • Client Type: "internal" or "external" (defaults to external)' },
      { 'Note': '   • Load Category: "Local" or "Export" only' },
      { 'Note': '' },
      { 'Note': '▶ BEFORE IMPORTING:' },
      { 'Note': '   • Remove the sample data rows (keep header row)' },
      { 'Note': '   • Do NOT modify the header row - column names must match exactly' },
      { 'Note': '   • Remove any empty rows between data entries' },
      { 'Note': '   • All imported trips will have status "active" and payment status "unpaid"' },
      { 'Note': '' },
      { 'Note': '═══════════════════════════════════════════════════════════════════════════════════════════' },
    ];

    const wsNotes = XLSX.utils.json_to_sheet(notesData);
    wsNotes['!cols'] = [{ wch: 95 }];
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Important Notes');

    // Generate and download file
    XLSX.writeFile(wb, 'trip_allocation_import_template.xlsx');

    toast({
      title: 'Template downloaded',
      description: 'The trip allocation import template has been downloaded to your device',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Trips"
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Import Instructions</h4>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Download the template file to see the required format</li>
            <li>Fill in your trip data following the column headers</li>
            <li>Save as Excel (.xlsx) or CSV format</li>
            <li>Upload the file using the button below</li>
          </ul>
        </div>

        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>

          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              {file ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-green-600 mb-2" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click to change file
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="font-medium">Click to upload file</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Excel (.xlsx, .xls) or CSV files
                  </p>
                </>
              )}
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isImporting}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? 'Importing...' : 'Import Trips'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default LoadImportModal;