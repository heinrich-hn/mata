/**
 * MapReportPanel Component
 * Sidebar panel for generating Wialon reports
 * Results are displayed in the full-width bottom panel
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReportInterval, ReportResult } from '@/hooks/useWialonReports';
import { useWialonReports } from '@/hooks/useWialonReports';
import
  {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Database,
    FileText,
    Info,
    Loader2,
    PlayCircle,
    RefreshCw,
    Truck,
  } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MapReportPanelProps {
  defaultVehicleId?: number;
  onReportGenerated?: (result: ReportResult) => void;
  compact?: boolean;
}

export const MapReportPanel = ({
  defaultVehicleId,
  onReportGenerated,
  compact: _compact = false,
}: MapReportPanelProps) => {
  // State
  const [activeTab, setActiveTab] = useState<string>('generate');
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(defaultVehicleId || null);
  const [selectedInterval, setSelectedInterval] = useState<string>('today');
  const [lastGeneratedReport, setLastGeneratedReport] = useState<{ template: string; vehicle: string; time: Date } | null>(null);

  // Wialon hook
  const {
    isConnected,
    isLoading,
    resources,
    units,
    getTemplates,
    executeReport,
    isExecuting,
    createInterval,
    getPredefinedIntervals,
    refetchResources,
  } = useWialonReports();

  // Get templates for selected resource
  const templates = selectedResource ? getTemplates(selectedResource, 'avl_unit') : [];

  // Reset template when resource changes
  useEffect(() => {
    setSelectedTemplate(null);
  }, [selectedResource]);

  // Handle report execution
  const handleExecuteReport = async () => {
    if (!selectedResource || !selectedTemplate || !selectedUnit) return;

    try {
      let interval: ReportInterval;
      const intervals = getPredefinedIntervals();

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
          interval = await createInterval(86400);
      }

      // Get selected names for display
      const templateName = templates.find(t => t.id === selectedTemplate)?.n || 'Unknown';
      const vehicleName = units.find(u => u.id === selectedUnit)?.nm || 'Unknown';

      executeReport(
        {
          resourceId: selectedResource,
          templateId: selectedTemplate,
          unitId: selectedUnit,
          interval,
        },
        {
          onSuccess: (result) => {
            setLastGeneratedReport({
              template: templateName,
              vehicle: vehicleName,
              time: new Date(),
            });
            onReportGenerated?.(result);
          },
          onError: (error) => {
            console.error('Report execution error:', error);
          },
        }
      );
    } catch (error) {
      console.error('Error executing report:', error);
    }
  };

  const canExecute = selectedResource && selectedTemplate && selectedUnit && !isExecuting;
  const totalTemplates = resources.reduce((sum, r) => sum + (r.reports?.length || 0), 0);

  // Not connected state
  if (!isConnected) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-orange-900">
            <AlertCircle className="h-4 w-4" />
            Wialon Not Connected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-orange-700">
            Connect to Wialon via the Vehicles tab to access report functionality.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading report resources...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="generate" className="text-xs gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" />
                Generate
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>Generate Report</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="info" className="text-xs gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Info
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>System Info</TooltipContent>
          </Tooltip>
        </TabsList>

        {/* Generate Report Tab */}
        <TabsContent value="generate" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-primary">{resources.length}</p>
                  <p className="text-[10px] text-muted-foreground">Resources</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-primary">{totalTemplates}</p>
                  <p className="text-[10px] text-muted-foreground">Templates</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-primary">{units.length}</p>
                  <p className="text-[10px] text-muted-foreground">Vehicles</p>
                </div>
              </div>

              <Separator />

              {/* Report Configuration */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Resource</Label>
                  <Select
                    value={selectedResource?.toString() ?? ''}
                    onValueChange={(value) => setSelectedResource(value ? Number(value) : null)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select resource..." />
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
                    <p className="text-[10px] text-muted-foreground">
                      {templates.length} template(s) available
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Report Template</Label>
                  <Select
                    value={selectedTemplate?.toString() ?? ''}
                    onValueChange={(value) => setSelectedTemplate(value ? Number(value) : null)}
                    disabled={!selectedResource || templates.length === 0}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select template..." />
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Vehicle
                  </Label>
                  <Select
                    value={selectedUnit?.toString() ?? ''}
                    onValueChange={(value) => setSelectedUnit(value ? Number(value) : null)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select vehicle..." />
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Time Period
                  </Label>
                  <Select value={selectedInterval} onValueChange={setSelectedInterval}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="lastWeek">Last 7 Days</SelectItem>
                      <SelectItem value="lastMonth">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleExecuteReport}
                disabled={!canExecute}
                className="w-full"
                size="sm"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>

              {/* Last Generated Report */}
              {lastGeneratedReport && (
                <Card className="bg-green-50/50 border-green-200">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-900">Report Generated</span>
                    </div>
                    <div className="space-y-1 text-[10px] text-green-700">
                      <p><strong>Template:</strong> {lastGeneratedReport.template}</p>
                      <p><strong>Vehicle:</strong> {lastGeneratedReport.vehicle}</p>
                      <p><strong>Generated:</strong> {lastGeneratedReport.time.toLocaleTimeString()}</p>
                    </div>
                    <p className="text-[10px] text-green-600 mt-2 italic">
                      View results in the panel below the map
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Help Section */}
              <Card className="bg-blue-50/50 border-blue-200">
                <CardContent className="pt-3 pb-3">
                  <h4 className="text-xs font-semibold text-blue-900 mb-2">Quick Guide</h4>
                  <ol className="text-[10px] space-y-1 text-blue-700">
                    <li>1. Select a resource containing report templates</li>
                    <li>2. Choose your desired report template</li>
                    <li>3. Select the vehicle to analyze</li>
                    <li>4. Pick a time period for the report</li>
                    <li>5. Click Generate to run the report</li>
                  </ol>
                  <p className="text-[10px] text-blue-600 mt-2 italic">
                    Results will appear in a full-width panel at the bottom of the page.
                  </p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-3">
              {/* Status Card */}
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      System Connected
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-green-700">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" />
                      <span>{resources.length} resource(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{totalTemplates} template(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5" />
                      <span>{units.length} vehicle(s)</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-xs"
                    onClick={() => refetchResources()}
                  >
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Refresh Resources
                  </Button>
                </CardContent>
              </Card>

              {/* Resources List */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm">Available Resources</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="rounded-lg border bg-muted/30 p-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">
                          {resource.nm}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          ID: {resource.id}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {resource.reports?.length || 0} template(s)
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Units Preview */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm">Vehicle Units</CardTitle>
                  <CardDescription className="text-xs">
                    {units.length} available for reporting
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {units.slice(0, 12).map((unit) => (
                      <div
                        key={unit.id}
                        className="rounded border bg-muted/30 p-1.5 text-xs truncate"
                      >
                        {unit.nm}
                      </div>
                    ))}
                  </div>
                  {units.length > 12 && (
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      + {units.length - 12} more vehicles
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MapReportPanel;