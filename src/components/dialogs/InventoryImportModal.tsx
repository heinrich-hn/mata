import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface InventoryImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface InventoryRecord {
  name: string;
  part_number: string;
  category: string;
  quantity: string;
  min_quantity: string;
  unit_price?: string;
  location?: string;
  supplier?: string;
}

const InventoryImportModal = ({ open, onOpenChange, onImportComplete }: InventoryImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<InventoryRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{ successful: number; failed: number } | null>(null);

  const downloadTemplate = () => {
    const template = `name,part_number,category,quantity,min_quantity,unit_price,location,supplier
Oil Filter,OF-12345,Filters,50,10,25.50,warehouse-a,AutoParts Co
Brake Pads,BP-67890,Brakes,30,5,85.00,warehouse-b,BrakeTech
Engine Oil 5W30,EO-5W30,Fluids,100,20,45.99,warehouse-a,LubeCorp`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
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

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['name', 'part_number', 'category', 'quantity', 'min_quantity'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`);
        return;
      }

      const records: InventoryRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const record: Record<string, string> = {};
          headers.forEach((header, index) => {
            record[header] = values[index];
          });
          records.push(record as unknown as InventoryRecord);
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
        name: record.name,
        part_number: record.part_number,
        category: record.category,
        quantity: parseInt(record.quantity) || 0,
        min_quantity: parseInt(record.min_quantity) || 5,
        unit_price: record.unit_price ? parseFloat(record.unit_price) : null,
        location: record.location || null,
        supplier: record.supplier || null,
      }));

      const { data, error } = await supabase
        .from('inventory')
        .insert(recordsToInsert)
        .select();

      if (error) {
        console.error("Import error:", error);
        failed = parsedData.length;
        toast.error(`Import failed: ${error.message}`);
      } else {
        successful = data?.length || 0;
        failed = parsedData.length - successful;
        toast.success(`Successfully imported ${successful} items`);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Inventory from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import inventory items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Required columns:</strong> name, part_number, category, quantity, min_quantity
              <br />
              <strong>Optional columns:</strong> unit_price, location, supplier
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <label htmlFor="csv-upload">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {file ? file.name : "Select CSV File"}
                </span>
              </Button>
            </label>
            <input
              id="csv-upload"
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
                        <TableHead>Name</TableHead>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Min Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((record, index) => (
                        <TableRow key={index}>
                          <TableCell>{record.name}</TableCell>
                          <TableCell className="font-mono text-xs">{record.part_number}</TableCell>
                          <TableCell>{record.category}</TableCell>
                          <TableCell>{record.quantity}</TableCell>
                          <TableCell>{record.min_quantity}</TableCell>
                          <TableCell>{record.unit_price || '-'}</TableCell>
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

export default InventoryImportModal;