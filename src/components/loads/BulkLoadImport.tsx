/**
 * Enhanced Bulk Load Import Component
 * Handles CSV import of distribution schedules with column mapping
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { bulkCreateLoads, generateSampleCSV, parseDistributionCSV } from '@/lib/loadPlanningUtils';
import type { BulkImportMapping, DistributionScheduleEntry } from '@/types/loadPlanning';
import { AlertCircle, CheckCircle2, Download, Upload, X } from 'lucide-react';
import { useState } from 'react';

interface BulkLoadImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ImportError {
  row: number;
  field: string;
  error: string;
}

export const BulkLoadImport = ({ isOpen, onClose, onSuccess }: BulkLoadImportProps) => {
  const [_file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvContent, setCsvContent] = useState<string>('');
  const [mapping, setMapping] = useState<BulkImportMapping>({
    dispatchDateColumn: '',
    arrivalDateColumn: '',
    farmColumn: '',
    destinationColumn: '',
    channelColumn: '',
    packagingColumn: '',
  });
  const [preview, setPreview] = useState<DistributionScheduleEntry[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: ImportError[] } | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'csv') {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);

    // Read CSV and extract headers
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      setCsvHeaders(headers);

      // Auto-detect column mappings based on common patterns
      const autoMapping: BulkImportMapping = {
        dispatchDateColumn: headers.find(h => /dispatch.*date/i.test(h)) || '',
        arrivalDateColumn: headers.find(h => /(arrival|expected).*date/i.test(h) || /expected.*arrival/i.test(h)) || '',
        farmColumn: headers.find(h => /farm|origin/i.test(h)) || '',
        destinationColumn: headers.find(h => /destination/i.test(h)) || '',
        channelColumn: headers.find(h => /channel/i.test(h)) || '',
        packagingColumn: headers.find(h => /packaging|package/i.test(h)) || '',
        palletsColumn: headers.find(h => /pallet/i.test(h)) || '',
        notesColumn: headers.find(h => /note|comment|remark/i.test(h)) || '',
        contactPersonColumn: headers.find(h => /contact.*person|person.*name/i.test(h)) || '',
        contactPhoneColumn: headers.find(h => /contact.*phone|phone|tel/i.test(h)) || '',
        weightKgColumn: headers.find(h => /weight|kg/i.test(h)) || '',
        volumeM3Column: headers.find(h => /volume|m3|cubic/i.test(h)) || '',
        quotedPriceColumn: headers.find(h => /price|cost|quote/i.test(h)) || '',
        customerNameColumn: headers.find(h => /customer.*name|client.*name/i.test(h)) || '',
      };
      setMapping(autoMapping);

      setStep('mapping');
    };
    reader.readAsText(selectedFile);
  };

  const handleMappingComplete = () => {
    // Validate all required mappings
    const required = [
      'dispatchDateColumn',
      'arrivalDateColumn',
      'farmColumn',
      'destinationColumn',
      'channelColumn',
      'packagingColumn',
    ] as const;

    const missing = required.filter(field => !mapping[field]);
    if (missing.length > 0) {
      const friendlyNames: Record<string, string> = {
        dispatchDateColumn: 'Dispatch Date',
        arrivalDateColumn: 'Arrival Date',
        farmColumn: 'Farm',
        destinationColumn: 'Destination',
        channelColumn: 'Channel',
        packagingColumn: 'Packaging',
      };
      const missingNames = missing.map(field => friendlyNames[field]).join(', ');
      toast({
        title: 'Missing mappings',
        description: `Please map all required fields: ${missingNames}`,
        variant: 'destructive',
      });
      return;
    }

    // Parse CSV with mapping
    try {
      const entries = parseDistributionCSV(csvContent, mapping);
      setPreview(entries.slice(0, 10)); // Show first 10 for preview
      setStep('preview');
    } catch (error) {
      toast({
        title: 'Parse error',
        description: error instanceof Error ? error.message : 'Failed to parse CSV',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    setStep('importing');

    try {
      const entries = parseDistributionCSV(csvContent, mapping);
      const result = await bulkCreateLoads(entries);

      setImportResult(result);
      setStep('complete');

      if (result.success > 0) {
        toast({
          title: 'Import successful',
          description: `Created ${result.success} loads${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        });
        onSuccess?.();
      } else {
        toast({
          title: 'Import failed',
          description: 'No loads were created. Check errors below.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Import error',
        description: error instanceof Error ? error.message : 'Failed to import loads',
        variant: 'destructive',
      });
      setStep('preview');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `load_schedule_template_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Template downloaded',
      description: 'Edit the CSV file with your schedule data',
    });
  };

  const handleClose = () => {
    setFile(null);
    setCsvHeaders([]);
    setCsvContent('');
    setMapping({
      dispatchDateColumn: '',
      arrivalDateColumn: '',
      farmColumn: '',
      destinationColumn: '',
      channelColumn: '',
      packagingColumn: '',
      palletsColumn: '',
      notesColumn: '',
      contactPersonColumn: '',
      contactPhoneColumn: '',
      weightKgColumn: '',
      volumeM3Column: '',
      quotedPriceColumn: '',
      customerNameColumn: '',
    });
    setPreview([]);
    setStep('upload');
    setImportResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Load Import</DialogTitle>
          <DialogDescription>
            Import your distribution schedule from CSV
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Upload CSV File</p>
              <p className="text-sm text-muted-foreground mb-4">
                Select your distribution schedule CSV file
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </span>
                </Button>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1">Don't have a CSV?</p>
                <p className="text-xs text-muted-foreground">Download our template</p>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">Map CSV Columns</p>
              <p className="text-xs text-blue-700 mt-1">
                Match your CSV columns to the required fields
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dispatch Date *</Label>
                <Select
                  value={mapping.dispatchDateColumn}
                  onValueChange={(value) => setMapping({ ...mapping, dispatchDateColumn: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Arrival Date *</Label>
                <Select
                  value={mapping.arrivalDateColumn}
                  onValueChange={(value) => setMapping({ ...mapping, arrivalDateColumn: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Farm/Origin *</Label>
                <Select
                  value={mapping.farmColumn}
                  onValueChange={(value) => setMapping({ ...mapping, farmColumn: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destination *</Label>
                <Select
                  value={mapping.destinationColumn}
                  onValueChange={(value) => setMapping({ ...mapping, destinationColumn: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Channel *</Label>
                <Select
                  value={mapping.channelColumn}
                  onValueChange={(value) => setMapping({ ...mapping, channelColumn: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Packaging *</Label>
                <Select
                  value={mapping.packagingColumn}
                  onValueChange={(value) => setMapping({ ...mapping, packagingColumn: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pallets (Optional)</Label>
                <Select
                  value={mapping.palletsColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, palletsColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Select
                  value={mapping.notesColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, notesColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Customer Name (Optional)</Label>
                <Select
                  value={mapping.customerNameColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, customerNameColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None - use destination</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contact Person (Optional)</Label>
                <Select
                  value={mapping.contactPersonColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, contactPersonColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contact Phone (Optional)</Label>
                <Select
                  value={mapping.contactPhoneColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, contactPhoneColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Weight (kg) (Optional)</Label>
                <Select
                  value={mapping.weightKgColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, weightKgColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None - calculate from pallets</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Volume (m³) (Optional)</Label>
                <Select
                  value={mapping.volumeM3Column || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, volumeM3Column: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quoted Price (Optional)</Label>
                <Select
                  value={mapping.quotedPriceColumn || undefined}
                  onValueChange={(value) => setMapping({ ...mapping, quotedPriceColumn: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleMappingComplete}>
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900">Preview (first 10 rows)</p>
              <p className="text-xs text-green-700 mt-1">
                Total entries to import: {csvContent.split('\n').length - 1}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Dispatch</th>
                    <th className="p-2 text-left">Arrival</th>
                    <th className="p-2 text-left">Farm</th>
                    <th className="p-2 text-left">Destination</th>
                    <th className="p-2 text-left">Channel</th>
                    <th className="p-2 text-left">Packaging</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((entry, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{entry.dispatchDate}</td>
                      <td className="p-2">{entry.arrivalDate}</td>
                      <td className="p-2">{entry.farm}</td>
                      <td className="p-2">{entry.destination}</td>
                      <td className="p-2">{entry.channel}</td>
                      <td className="p-2">{entry.packaging}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import {csvContent.split('\n').length - 1} Loads
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Importing loads...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <Card className={importResult.success > 0 ? 'border-green-500' : 'border-red-500'}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {importResult.success > 0 ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                  <div>
                    <CardTitle>Import Complete</CardTitle>
                    <CardDescription>
                      {importResult.success} successful, {importResult.failed} failed
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {importResult.errors.length > 0 && (
                <CardContent>
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                        <span className="font-medium">Row {error.row}:</span> {error.error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}

        {step !== 'complete' && step !== 'importing' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
