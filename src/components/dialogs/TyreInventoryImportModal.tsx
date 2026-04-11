import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface TyreInventoryImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface TyreInventoryRecord {
  brand: string;
  model: string;
  size: string;
  type: string;
  quantity: string;
  min_quantity?: string;
  unit_price?: string;
  purchase_cost_zar?: string;
  purchase_cost_usd?: string;
  dot_code?: string;
  pressure_rating?: string;
  initial_tread_depth?: string;
  location?: string;
  supplier?: string;
  status?: string;
  warranty_months?: string;
  warranty_km?: string;
}

const TyreInventoryImportModal = ({
  open,
  onOpenChange,
  onImportComplete,
}: TyreInventoryImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<TyreInventoryRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{
    successful: number;
    failed: number;
  } | null>(null);

  const downloadExcelTemplate = () => {
    // Create sample data for the template
    const templateData = [
      {
        brand: "Michelin",
        model: "XZE2",
        size: "295/80R22.5",
        type: "Steer",
        quantity: 20,
        min_quantity: 5,
        unit_price: 4500.00,
        purchase_cost_zar: 4200.00,
        purchase_cost_usd: 250.00,
        dot_code: "DOT3524",
        pressure_rating: 120,
        initial_tread_depth: 16,
        location: "main-warehouse",
        supplier: "Tyre Depot",
        status: "new",
        warranty_months: 24,
        warranty_km: 80000,
      },
      {
        brand: "Bridgestone",
        model: "R297",
        size: "11R22.5",
        type: "Drive",
        quantity: 15,
        min_quantity: 5,
        unit_price: 3800.00,
        purchase_cost_zar: 3500.00,
        purchase_cost_usd: 210.00,
        dot_code: "DOT3624",
        pressure_rating: 110,
        initial_tread_depth: 15,
        location: "main-warehouse",
        supplier: "Tyre Depot",
        status: "new",
        warranty_months: 24,
        warranty_km: 80000,
      },
      {
        brand: "Continental",
        model: "HTR2",
        size: "385/65R22.5",
        type: "Trailer",
        quantity: 25,
        min_quantity: 8,
        unit_price: 3200.00,
        purchase_cost_zar: 3000.00,
        purchase_cost_usd: 180.00,
        dot_code: "DOT3724",
        pressure_rating: 100,
        initial_tread_depth: 14,
        location: "secondary-warehouse",
        supplier: "Continental Direct",
        status: "new",
        warranty_months: 18,
        warranty_km: 100000,
      },
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for better readability
    ws["!cols"] = [
      { wch: 15 }, // brand
      { wch: 12 }, // model
      { wch: 15 }, // size
      { wch: 12 }, // type
      { wch: 10 }, // quantity
      { wch: 12 }, // min_quantity
      { wch: 12 }, // unit_price
      { wch: 18 }, // purchase_cost_zar
      { wch: 18 }, // purchase_cost_usd
      { wch: 12 }, // dot_code
      { wch: 15 }, // pressure_rating
      { wch: 18 }, // initial_tread_depth
      { wch: 18 }, // location
      { wch: 18 }, // supplier
      { wch: 10 }, // status
      { wch: 15 }, // warranty_months
      { wch: 12 }, // warranty_km
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tyre Inventory");

    // Add instructions sheet
    const instructionsData = [
      { Field: "brand", Required: "Yes", Description: "Tyre manufacturer (e.g., Michelin, Bridgestone, Continental)" },
      { Field: "model", Required: "Yes", Description: "Tyre model name/number" },
      { Field: "size", Required: "Yes", Description: "Tyre size designation (e.g., 295/80R22.5, 11R22.5)" },
      { Field: "type", Required: "Yes", Description: "Tyre type: Steer, Drive, Trailer" },
      { Field: "quantity", Required: "Yes", Description: "Number of tyres in stock (whole number)" },
      { Field: "min_quantity", Required: "No", Description: "Minimum stock level for reorder alerts (default: 5)" },
      { Field: "unit_price", Required: "No", Description: "Unit price of tyre" },
      { Field: "purchase_cost_zar", Required: "No", Description: "Purchase cost in South African Rand" },
      { Field: "purchase_cost_usd", Required: "No", Description: "Purchase cost in US Dollars" },
      { Field: "dot_code", Required: "No", Description: "DOT code for tyre manufacturing date (e.g., DOT3524)" },
      { Field: "pressure_rating", Required: "No", Description: "Recommended pressure in PSI" },
      { Field: "initial_tread_depth", Required: "No", Description: "New tyre tread depth in mm" },
      { Field: "location", Required: "No", Description: "Storage location: main-warehouse, service-bay, retread-bay, scrap-store, holding-bay" },
      { Field: "supplier", Required: "No", Description: "Supplier/vendor name" },
      { Field: "status", Required: "No", Description: "Tyre condition: new, used, refurbished, scrap (default: new)" },
      { Field: "warranty_months", Required: "No", Description: "Warranty period in months" },
      { Field: "warranty_km", Required: "No", Description: "Warranty mileage in kilometers" },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
    wsInstructions["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    // Download the file
    XLSX.writeFile(wb, "tyre_inventory_import_template.xlsx");
    toast.success("Excel template downloaded successfully");
  };

  const downloadCSVTemplate = () => {
    const template = `brand,model,size,type,quantity,min_quantity,unit_price,purchase_cost_zar,purchase_cost_usd,dot_code,pressure_rating,initial_tread_depth,location,supplier,status,warranty_months,warranty_km
Michelin,XZE2,295/80R22.5,Steer,20,5,4500.00,4200.00,250.00,DOT3524,120,16,main-warehouse,Tyre Depot,new,24,80000
Bridgestone,R297,11R22.5,Drive,15,5,3800.00,3500.00,210.00,DOT3624,110,15,main-warehouse,Tyre Depot,new,24,80000
Continental,HTR2,385/65R22.5,Trailer,25,8,3200.00,3000.00,180.00,DOT3724,100,14,secondary-warehouse,Continental Direct,new,18,100000`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tyre_inventory_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV template downloaded successfully");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      toast.error("Please select an Excel (.xlsx, .xls) or CSV file");
      return;
    }

    setFile(selectedFile);

    if (isExcel) {
      parseExcel(selectedFile);
    } else {
      parseCSV(selectedFile);
    }
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });

        // Get the first sheet (skip Instructions sheet if it exists)
        const sheetName = workbook.SheetNames.find(name => name !== "Instructions") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length === 0) {
          toast.error("Excel file is empty or has no data rows");
          return;
        }

        // Validate required columns
        const firstRow = jsonData[0];
        const requiredHeaders = ["brand", "model", "size", "type", "quantity"];
        const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          toast.error(`Missing required columns: ${missingHeaders.join(", ")}`);
          return;
        }

        // Normalize headers and convert data
        const records: TyreInventoryRecord[] = jsonData.map((row) => {
          const normalizedRow: Record<string, string> = {};
          Object.entries(row).forEach(([key, value]) => {
            normalizedRow[key.toLowerCase().trim()] = String(value ?? "");
          });
          return normalizedRow as unknown as TyreInventoryRecord;
        });

        setParsedData(records);
        toast.success(`Parsed ${records.length} records from Excel file`);
      } catch (error) {
        console.error("Excel parse error:", error);
        toast.error("Failed to parse Excel file. Please check the file format.");
      }
    };
    reader.readAsArrayBuffer(file);
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

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['brand', 'model', 'size', 'type', 'quantity'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`);
        return;
      }

      const records: TyreInventoryRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const record: Partial<TyreInventoryRecord> = {};
          headers.forEach((header, index) => {
            (record as Record<string, string>)[header] = values[index];
          });
          records.push(record as TyreInventoryRecord);
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

    try {
      const recordsToInsert = parsedData.map(record => ({
        brand: record.brand,
        model: record.model,
        size: record.size,
        type: record.type,
        quantity: parseInt(record.quantity) || 0,
        min_quantity: parseInt(record.min_quantity || '5') || 5,
        unit_price: record.unit_price ? parseFloat(record.unit_price) : null,
        purchase_cost_zar: record.purchase_cost_zar ? parseFloat(record.purchase_cost_zar) : null,
        purchase_cost_usd: record.purchase_cost_usd ? parseFloat(record.purchase_cost_usd) : null,
        dot_code: record.dot_code || null,
        pressure_rating: record.pressure_rating ? parseFloat(record.pressure_rating) : null,
        initial_tread_depth: record.initial_tread_depth ? parseFloat(record.initial_tread_depth) : null,
        location: record.location || null,
        supplier: record.supplier || null,
        status: record.status || 'new',
        warranty_months: record.warranty_months ? parseInt(record.warranty_months) : null,
        warranty_km: record.warranty_km ? parseInt(record.warranty_km) : null,
      }));

      const { data, error } = await supabase
        .from('tyre_inventory')
        .insert(recordsToInsert)
        .select();

      if (error) {
        console.error("Import error:", error);
        failed = parsedData.length;
        toast.error(`Import failed: ${error.message}`);
      } else {
        successful = data?.length || 0;
        failed = parsedData.length - successful;
        toast.success(`Successfully imported ${successful} tyre items`);
        setImportResults({ successful, failed });
        onImportComplete();
      }
    } catch (error) {
      console.error("Import error:", error);
      failed = parsedData.length;
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tyre Inventory</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx, .xls) or CSV file to bulk import tyre inventory items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Required columns:</strong> brand, model, size, type, quantity
              <br />
              <strong>Optional columns:</strong> min_quantity, unit_price, purchase_cost_zar, purchase_cost_usd, dot_code,
              pressure_rating, initial_tread_depth, location, supplier, status, warranty_months, warranty_km
              <br />
              <strong>Valid types:</strong> Steer, Drive, Trailer
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadExcelTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Excel Template
            </Button>
            <Button variant="outline" onClick={downloadCSVTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
            <label htmlFor="file-upload-tyre">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {file ? file.name : "Select Excel or CSV File"}
                </span>
              </Button>
            </label>
            <input
              id="file-upload-tyre"
              type="file"
              accept=".xlsx,.xls,.csv"
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
                        <TableHead>Brand</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Cost (USD)</TableHead>
                        <TableHead>DOT</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((record, index) => (
                        <TableRow key={index}>
                          <TableCell>{record.brand}</TableCell>
                          <TableCell>{record.model}</TableCell>
                          <TableCell className="font-mono text-xs">{record.size}</TableCell>
                          <TableCell>{record.type}</TableCell>
                          <TableCell>{record.quantity}</TableCell>
                          <TableCell>{record.purchase_cost_zar || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{record.dot_code || '-'}</TableCell>
                          <TableCell>{record.location || '-'}</TableCell>
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
                <Alert className={importResults.failed === 0 ? "border-success" : "border-destructive"}>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Import Complete:</strong> {importResults.successful} successful, {importResults.failed} failed
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
                  {isProcessing ? "Importing..." : `Import ${parsedData.length} Items`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TyreInventoryImportModal;