import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReportCellValue, ReportResult, ReportTableRow } from '@/hooks/useWialonReports';
import { useWialonReports } from '@/hooks/useWialonReports';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// --- ReportTable Subcomponent ---
interface ReportTableProps {
  headers: string[];
  rows: ReportTableRow[];
  formatCellValue: (cell: ReportCellValue) => string;
}

const ReportTable = ({ headers, rows, formatCellValue }: ReportTableProps) => {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto max-h-[600px]">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={index} className="font-semibold">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => {
            if (!row.c) return null;

            return (
              <TableRow key={rowIndex} className={rowIndex % 2 === 1 ? 'bg-muted/50' : ''}>
                {row.c.map((cell, cellIndex) => (
                  <TableCell key={cellIndex}>
                    {formatCellValue(cell)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
// --- End ReportTable Subcomponent ---

interface WialonReportViewerProps {
  reportResult: ReportResult | null;
  title?: string;
  showDownload?: boolean;
}

export const WialonReportViewer = ({
  reportResult,
  title = 'Report Results',
  showDownload = true,
}: WialonReportViewerProps) => {
  const [tableData, setTableData] = useState<Record<number, ReportTableRow[]>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const { fetchTableRows, formatCellValue } = useWialonReports();

  useEffect(() => {
    if (!reportResult) {
      setTableData({});
      setLoading({});
      return;
    }

    const tables = reportResult.getTables();
    if (tables.length === 0) return;

    const loadAllTables = async () => {
      const initialLoading = tables.reduce((acc, _, i) => ({ ...acc, [i]: true }), {});
      setLoading(initialLoading);

      const fetchPromises = tables.map((_, i) =>
        fetchTableRows(reportResult, i).catch(error => {
          console.error(`Failed to load table ${i} (${tables[i]?.label}):`, error);
          return []; // Return empty array on failure
        })
      );

      const results = await Promise.allSettled(fetchPromises);

      const newTableData: Record<number, ReportTableRow[]> = {};
      const newLoading: Record<number, boolean> = {};

      results.forEach((result, i) => {
        newTableData[i] = (result.status === 'fulfilled' ? result.value : []) as ReportTableRow[];
        newLoading[i] = false;
      });

      setTableData(newTableData);
      setLoading(newLoading);
    };

    loadAllTables();
  }, [reportResult, fetchTableRows]);

  const exportToCSV = (tableIndex: number) => {
    if (!reportResult) return;

    const tables = reportResult.getTables();
    const table = tables[tableIndex];
    const rows = tableData[tableIndex] || [];

    const csvRows: string[] = [];
    csvRows.push(table.header.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    rows.forEach(row => {
      if (row.c) {
        const values = row.c.map(cell => {
          const value = formatCellValue(cell);
          return `"${value.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      }
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${table.label.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!reportResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No report data to display. Execute a report to see results here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tables = reportResult.getTables();

  if (tables.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Report generated but no data was found for the selected criteria.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tables.length === 1 ? (
          // Single table - display directly
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{tables[0].label}</h3>
              {showDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(0)}
                  disabled={loading[0]}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
            {loading[0] ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ReportTable
                headers={tables[0].header}
                rows={tableData[0] || []}
                formatCellValue={formatCellValue}
              />
            )}
          </div>
        ) : (
          // Multiple tables - use tabs
          <Tabs defaultValue="0" className="w-full">
            <TabsList className="flex w-full">
              {tables.map((table, index) => (
                <TabsTrigger key={index} value={index.toString()} className="flex-1">
                  {table.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tables.map((table, index) => (
              <TabsContent key={index} value={index.toString()} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {table.rows} row(s)
                  </p>
                  {showDownload && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(index)}
                      disabled={loading[index]}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </div>
                {loading[index] ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ReportTable
                    headers={table.header}
                    rows={tableData[index] || []}
                    formatCellValue={formatCellValue}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default WialonReportViewer;