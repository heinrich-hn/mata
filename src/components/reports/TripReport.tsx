import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadTripExcel, downloadTripPDF } from '@/lib/exportUtils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ProcessedTripReport } from '@/lib/reportUtils';
import
  {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    CheckCircle,
    DollarSign,
    FileSpreadsheet,
    FileText,
    FileX,
    MapPin,
    TrendingUp,
    Truck,
    User,
    XCircle
  } from 'lucide-react';

interface TripReportProps {
  report: ProcessedTripReport;
  onBack: () => void;
}

const TripReport = ({ report, onBack }: TripReportProps) => {
  const { trip, costs, kpis, categoryBreakdown, missingReceipts, hasInvestigation, investigationInfo } = report;

  // Export to Excel
  const handleExcelExport = () => {
    downloadTripExcel(report);
  };

  // Export to PDF
  const handlePDFExport = () => {
    downloadTripPDF('trip-report-content', trip);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Trips
        </Button>
      </div>

      <div id="trip-report-content" className="space-y-6">
        {/* Trip Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">
                  Trip Report: {trip.trip_number}
                </CardTitle>
                <CardDescription className="mt-2">
                  Comprehensive trip analysis and cost breakdown
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExcelExport} size="sm" variant="outline">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button onClick={handlePDFExport} size="sm" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <Truck className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Fleet Number</p>
                  <p className="font-semibold">{trip.vehicle_id || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Driver</p>
                  <p className="font-semibold">{trip.driver_name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-semibold text-sm">
                    {formatDate(trip.departure_date)} - {formatDate(trip.arrival_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Route</p>
                  <p className="font-semibold text-sm">{trip.origin} → {trip.destination}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <DollarSign className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-semibold">{trip.client_name || 'N/A'}</p>
                </div>
              </div>
              {trip.distance_km && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Distance</p>
                    <p className="font-semibold">{trip.distance_km} km</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alert Systems */}
        {hasInvestigation && investigationInfo && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              <div className="font-semibold text-amber-500">Investigation in Progress</div>
              <div className="text-sm mt-1">
                <span className="text-muted-foreground">Date: </span>
                {investigationInfo.date}
              </div>
              <div className="text-sm mt-1">
                <span className="text-muted-foreground">Notes: </span>
                {investigationInfo.notes}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {missingReceipts.count > 0 && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <FileX className="h-4 w-4 text-destructive" />
            <AlertDescription>
              <div className="font-semibold text-destructive">Missing Documentation</div>
              <div className="text-sm mt-2 space-y-1">
                {missingReceipts.entries.map((cost, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-medium">{cost.category}:</span>
                    <span>{formatCurrency(Number(cost.amount), cost.currency as 'ZAR' | 'USD')}</span>
                    <span className="text-muted-foreground">- {formatDate(cost.date)}</span>
                    {cost.reference_number && (
                      <span className="text-muted-foreground">({cost.reference_number})</span>
                    )}
                  </div>
                ))}
                {missingReceipts.count > 3 && (
                  <div className="text-muted-foreground italic">
                    ...and {missingReceipts.count - 3} more items without documentation
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Financial KPIs Card */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
            <CardDescription>Key performance indicators for this trip</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(kpis.totalRevenue, kpis.currency)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
                <p className="text-2xl font-bold text-red-500">
                  {formatCurrency(kpis.totalExpenses, kpis.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{kpis.expenseCount} entries</p>
              </div>
              <div className={`p-4 rounded-lg border ${
                kpis.netProfit >= 0
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <p className="text-sm text-muted-foreground mb-1">Net Profit/Loss</p>
                <p className={`text-2xl font-bold ${
                  kpis.netProfit >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatCurrency(kpis.netProfit, kpis.currency)}
                </p>
              </div>
              {kpis.costPerKm !== null && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Cost per KM</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {formatCurrency(kpis.costPerKm, kpis.currency)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown Card */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown by Category</CardTitle>
            <CardDescription>Expense distribution across categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {categoryBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">{item.category}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-accent rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right font-semibold whitespace-nowrap">
                      {formatCurrency(item.total, kpis.currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No cost data available</p>
            )}
          </CardContent>
        </Card>

        {/* Detailed Cost Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Cost Entries</CardTitle>
            <CardDescription>Complete breakdown of all expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Attachments</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.length > 0 ? (
                    costs.map((cost) => (
                      <TableRow key={cost.id} className="hover:bg-accent/50">
                        <TableCell className="whitespace-nowrap">
                          {formatDate(cost.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{cost.category}</div>
                            {cost.sub_category && (
                              <div className="text-xs text-muted-foreground">{cost.sub_category}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{cost.reference_number || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {cost.notes || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cost.attachments && Array.isArray(cost.attachments) && cost.attachments.length > 0 ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {cost.attachments.length}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                              <XCircle className="w-3 h-3 mr-1" />
                              Missing
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          {formatCurrency(Number(cost.amount), cost.currency as 'ZAR' | 'USD')}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No cost entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {costs.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-semibold">
                        Total Expenses:
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(kpis.totalExpenses, kpis.currency)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TripReport;