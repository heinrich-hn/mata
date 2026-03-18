import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWialonReports, type WialonReportTemplate } from '@/hooks/useWialonReports';
import { AlertCircle, CheckCircle2, Database, FileText, RefreshCw } from 'lucide-react';
import { useState } from 'react';

/**
 * Debug component to visualize Wialon report resources and templates
 * Helps diagnose issues with report template loading
 */
export const WialonReportDebug = () => {
  const { isConnected, isLoading, resources, units, fetchResourceById, refetchResources } = useWialonReports();
  const [manualFetchLoading, setManualFetchLoading] = useState(false);
  const [manualTemplates, setManualTemplates] = useState<WialonReportTemplate[]>([]);

  const handleManualFetch = async () => {
    setManualFetchLoading(true);
    try {
      // Try fetching Matanuska resource (ID: 25138250)
      const templates = await fetchResourceById(25138250);
      setManualTemplates(templates);

      // Also trigger a refetch of all resources
      await refetchResources();
    } catch (error) {
      console.error('Manual fetch error:', error);
    } finally {
      setManualFetchLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <AlertCircle className="h-5 w-5" />
            Not Connected
          </CardTitle>
          <CardDescription>Wialon connection not established</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
          <CardDescription>Fetching resources and templates</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalTemplates = resources.reduce((sum, r) => sum + (r.reports?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <CheckCircle2 className="h-5 w-5" />
            Wialon Report System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-green-600" />
              <span className="font-medium">{resources.length}</span> resource(s) available
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="font-medium">{totalTemplates}</span> report template(s) total
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">🚗</span>
              <span className="font-medium">{units.length}</span> vehicle unit(s) available
            </div>
          </div>

          {/* Manual Fetch Button */}
          <div className="pt-4 border-t border-green-300">
            <Button
              onClick={handleManualFetch}
              disabled={manualFetchLoading}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {manualFetchLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Fetching Templates...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Manually Fetch Matanuska Templates (ID: 25138250)
                </>
              )}
            </Button>
            {manualTemplates.length > 0 && (
              <div className="mt-2 p-2 bg-white rounded border border-green-300 text-xs">
                <p className="font-medium text-green-900">Manual fetch found {manualTemplates.length} templates:</p>
                <ul className="mt-1 space-y-1 text-green-700">
                  {manualTemplates.map((t) => (
                    <li key={t.id}>#{t.id}: {t.n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resource Details */}
      {resources.map((resource) => (
        <Card key={resource.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {resource.nm}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (ID: {resource.id})
              </span>
            </CardTitle>
            <CardDescription>
              {resource.reports?.length || 0} report template(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resource.reports && resource.reports.length > 0 ? (
              <div className="space-y-2">
                {resource.reports.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-md border bg-muted/50 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">
                          {template.n}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>ID: {template.id}</span>
                          <span>Type: {template.ct}</span>
                          {template.p && <span>Period: {template.p}</span>}
                        </div>
                      </div>
                      <div className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Available
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No report templates found for this resource.
                <br />
                <span className="text-xs">
                  Check if templates are configured in Wialon for this resource.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Units Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Units</CardTitle>
          <CardDescription>{units.length} vehicle unit(s) for reporting</CardDescription>
        </CardHeader>
        <CardContent>
          {units.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {units.slice(0, 10).map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-md border bg-muted/50 p-2 text-sm"
                >
                  <span className="font-medium">{unit.nm}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    (ID: {unit.id})
                  </span>
                </div>
              ))}
              {units.length > 10 && (
                <div className="col-span-2 text-center text-xs text-muted-foreground pt-2">
                  ... and {units.length - 10} more units
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No units found. Check Wialon configuration.
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Response Debug */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Raw Data (Debug)</CardTitle>
          <CardDescription>JSON representation of loaded data</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96 bg-muted/50 p-4 rounded-md">
            {JSON.stringify({ resources, units }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default WialonReportDebug;