import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ReportInterval, ReportResult } from '@/hooks/useWialonReports';
import { useWialonReports } from '@/hooks/useWialonReports';
import { Calendar, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WialonReportExecutorProps {
  defaultResourceId?: number;
  defaultUnitId?: number;
  onReportGenerated?: (result: ReportResult) => void;
}

export const WialonReportExecutor = ({
  defaultResourceId,
  defaultUnitId,
  onReportGenerated,
}: WialonReportExecutorProps) => {
  // Initialize state for selected resources, templates, units, and intervals.
  const [selectedResource, setSelectedResource] = useState<number | null>(defaultResourceId || null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(defaultUnitId || null);
  const [selectedInterval, setSelectedInterval] = useState<string>('today');
  const [_customInterval, _setCustomInterval] = useState<ReportInterval | null>(null);

  const {
    isConnected,
    isLoading,
    resources,
    units,
    getTemplates,
    executeReport,
    isExecuting,
    reportResult,
    createInterval,
    getPredefinedIntervals,
  } = useWialonReports();

  // Get templates for selected resource
  const templates = selectedResource ? getTemplates(selectedResource, 'avl_unit') : [];

  // Handle report execution
  const handleExecute = async () => {
    console.log('🎯 Execute button clicked');
    console.log('Selections:', {
      selectedResource,
      selectedTemplate,
      selectedUnit,
      selectedInterval,
    });

    if (!selectedResource || !selectedTemplate || !selectedUnit) {
      console.warn('⚠️ Missing selections - cannot execute');
      return; // Ensure all selections are made
    }

    try {
      let interval: ReportInterval;

      // Determine the report interval based on the selected option
      if (selectedInterval === 'custom' && _customInterval) {
        interval = _customInterval; // Use custom interval if defined
      } else {
        // Use predefined intervals
        const intervals = getPredefinedIntervals();
        console.log('⏰ Creating interval for:', selectedInterval);

        switch (selectedInterval) {
          case 'today':
            interval = await intervals.today();
            break;
          case 'yesterday':
            interval = await intervals.yesterday();
            break;
          case 'lastWeek':
            interval = await intervals.lastWeek();
            break;
          case 'lastMonth':
            interval = await intervals.lastMonth();
            break;
          default:
            interval = await createInterval(86400); // Default to last 24 hours
        }
      }

      console.log('✅ Interval created:', interval);
      console.log('🚀 Calling executeReport...');

      // Execute the report and handle the result
      executeReport(
        {
          resourceId: selectedResource,
          templateId: selectedTemplate,
          unitId: selectedUnit,
          interval,
        },
        {
          onSuccess: (result) => {
            console.log('✅ Report execution success callback triggered');
            onReportGenerated?.(result); // Callback for further processing
          },
          onError: (error) => {
            console.error('❌ Report execution error callback triggered:', error);
          },
        }
      );
    } catch (error) {
      console.error('❌ Error in handleExecute:', error);
    }
  };

  // Reset template selection when resource changes
  useEffect(() => {
    setSelectedTemplate(null); // Reset to null when resource changes
  }, [selectedResource]);

  // Handle connection status
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wialon Reports</CardTitle>
          <CardDescription>Not connected to Wialon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please connect to Wialon to access report functionality.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wialon Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine if the report can be executed
  const canExecute = selectedResource && selectedTemplate && selectedUnit && !isExecuting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Wialon Report Executor
        </CardTitle>
        <CardDescription>
          Generate reports from Wialon tracking data
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Resource Selection */}
        <div className="space-y-2">
          <Label htmlFor="resource">Resource</Label>
          <Select
            value={selectedResource?.toString() ?? ''}
            onValueChange={(value) => setSelectedResource(value ? Number(value) : null)}
          >
            <SelectTrigger id="resource">
              <SelectValue placeholder="Select a resource" />
            </SelectTrigger>
            <SelectContent>
              {resources.map((resource) => (
                <SelectItem key={resource.id} value={resource.id.toString()}>
                  {resource.nm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedResource && (
            <p className="text-xs text-muted-foreground">
              {templates.length} template(s) available
            </p>
          )}
        </div>

        {/* Template Selection */}
        <div className="space-y-2">
          <Label htmlFor="template">Report Template</Label>
          <Select
            value={selectedTemplate?.toString() ?? ''}
            onValueChange={(value) => setSelectedTemplate(value ? Number(value) : null)}
            disabled={!selectedResource || templates.length === 0}
          >
            <SelectTrigger id="template">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  {template.n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unit Selection */}
        <div className="space-y-2">
          <Label htmlFor="unit">Vehicle Unit</Label>
          <Select
            value={selectedUnit?.toString() ?? ''}
            onValueChange={(value) => setSelectedUnit(value ? Number(value) : null)}
          >
            <SelectTrigger id="unit">
              <SelectValue placeholder="Select a unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id.toString()}>
                  {unit.nm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time Interval Selection */}
        <div className="space-y-2">
          <Label htmlFor="interval" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Time Period
          </Label>
          <Select value={selectedInterval} onValueChange={setSelectedInterval}>
            <SelectTrigger id="interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="lastWeek">Last 7 Days</SelectItem>
              <SelectItem value="lastMonth">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Execute Button */}
        <Button
          onClick={handleExecute}
          disabled={!canExecute}
          className="w-full"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Execute Report
            </>
          )}
        </Button>

        {/* Report Result Summary */}
        {reportResult && (
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900">
                Report generated successfully!
              </p>
              <p className="text-xs text-green-700 mt-1">
                {reportResult.getTables().length} table(s) generated with{' '}
                {reportResult.getTables().reduce((sum, t) => sum + (t.data?.length || 0), 0)} total rows
              </p>
            </div>

            {/* Display report tables */}
            {reportResult.getTables().map((table, tableIndex) => (
              <div key={tableIndex} className="rounded-md border p-4">
                <h4 className="font-medium mb-2">{table.label || table.name}</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {table.data?.length || 0} rows
                </p>

                {table.data && table.data.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {table.header?.map((col, colIndex) => (
                            <th key={colIndex} className="text-left py-2 px-2 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.data.slice(0, 10).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b last:border-0">
                            {row.c?.map((cell, cellIndex) => {
                              // Handle different cell value formats from Wialon API
                              let displayValue = '-';
                              if (cell !== null && cell !== undefined) {
                                if (typeof cell === 'string' || typeof cell === 'number') {
                                  // Direct value (most common from Wialon)
                                  displayValue = String(cell);
                                } else if (typeof cell === 'object') {
                                  // Object format - try 't' first (text), then 'v' (value)
                                  const cellObj = cell as { t?: string; v?: string | number };
                                  if (cellObj.t !== undefined) {
                                    displayValue = String(cellObj.t);
                                  } else if (cellObj.v !== undefined) {
                                    displayValue = String(cellObj.v);
                                  }
                                }
                              }
                              return (
                                <td key={cellIndex} className="py-2 px-2">
                                  {displayValue}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {table.data.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing 10 of {table.data.length} rows
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Display stats if available */}
            {reportResult.stats && reportResult.stats.length > 0 && (
              <div className="rounded-md border p-4">
                <h4 className="font-medium mb-2">Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {reportResult.stats.map((stat, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-muted-foreground">{stat.name}:</span>
                      <span className="font-medium">
                        {stat.vals?.[0]?.v !== undefined ? String(stat.vals[0].v) : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WialonReportExecutor;