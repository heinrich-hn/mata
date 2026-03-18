/**
 * ReportResultsPanel Component
 * Full-width bottom panel for displaying report results
 * Designed to span the entire bottom of the page for better visibility
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ReportResult, ReportTableRow } from '@/hooks/useWialonReports';
import { useWialonReports } from '@/hooks/useWialonReports';
import { cn } from '@/lib/utils';
import
  {
    CheckCircle2,
    Download,
    FileBarChart,
    Loader2,
    Maximize2,
    Minimize2,
    X
  } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ReportResultsPanelProps {
  reportResult: ReportResult | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export const ReportResultsPanel = ({
  reportResult,
  isOpen,
  onClose,
  onToggleExpand,
  isExpanded = false,
}: ReportResultsPanelProps) => {
  const [tableData, setTableData] = useState<Record<number, ReportTableRow[]>>({});
  const [tableLoading, setTableLoading] = useState<Record<number, boolean>>({});
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);

  const { fetchTableRows, formatCellValue } = useWialonReports();

  // Load table data when report result changes
  useEffect(() => {
    if (!reportResult) {
      setTableData({});
      setTableLoading({});
      return;
    }

    const tables = reportResult.getTables();
    if (tables.length === 0) return;

    const loadAllTables = async () => {
      const initialLoading = tables.reduce((acc, _, i) => ({ ...acc, [i]: true }), {});
      setTableLoading(initialLoading);

      const results = await Promise.allSettled(
        tables.map((_, i) =>
          fetchTableRows(reportResult, i).catch((error) => {
            console.error(`Failed to load table ${i}:`, error);
            return [];
          })
        )
      );

      const newTableData: Record<number, ReportTableRow[]> = {};
      const newLoading: Record<number, boolean> = {};

      results.forEach((result, i) => {
        newTableData[i] = (result.status === 'fulfilled' ? result.value : []) as ReportTableRow[];
        newLoading[i] = false;
      });

      setTableData(newTableData);
      setTableLoading(newLoading);
    };

    loadAllTables();
  }, [reportResult, fetchTableRows]);

  // Export to CSV
  const exportToCSV = useCallback(
    (tableIndex: number) => {
      if (!reportResult) return;

      const tables = reportResult.getTables();
      const table = tables[tableIndex];
      const rows = tableData[tableIndex] || [];

      const csvRows: string[] = [];
      csvRows.push(table.header.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

      rows.forEach((row) => {
        if (row.c) {
          const values = row.c.map((cell) => {
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
      link.setAttribute('download', `${table.label.replace(/\s+/g, '_')}_report.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [reportResult, tableData, formatCellValue]
  );

  if (!isOpen || !reportResult) return null;

  const tables = reportResult.getTables();
  const currentTable = tables[selectedTableIndex];
  const currentRows = tableData[selectedTableIndex] || [];
  const isLoading = tableLoading[selectedTableIndex];

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-background border-t shadow-lg z-[900] transition-all duration-300',
        isExpanded ? 'h-[60vh]' : 'h-[320px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Report Results</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {tables.length} table(s) • {tables.reduce((sum, t) => sum + (t.rows || 0), 0)} rows
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Table Selector */}
          {tables.length > 1 && (
            <Select
              value={selectedTableIndex.toString()}
              onValueChange={(v) => setSelectedTableIndex(Number(v))}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table, index) => (
                  <SelectItem key={index} value={index.toString()} className="text-xs">
                    {table.label} ({table.rows} rows)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(selectedTableIndex)}
            disabled={isLoading}
            className="h-8 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>

          {/* Expand/Collapse */}
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 49px)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading report data...</p>
            </div>
          </div>
        ) : currentTable ? (
          <div className="h-full flex flex-col">
            {/* Table Header Info */}
            <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">{currentTable.label}</h4>
                <p className="text-xs text-muted-foreground">
                  Showing {currentRows.length} of {currentTable.rows} rows
                </p>
              </div>
              {/* Stats if available */}
              {reportResult.stats && reportResult.stats.length > 0 && (
                <div className="flex items-center gap-4">
                  {reportResult.stats.slice(0, 4).map((stat, index) => (
                    <div key={index} className="text-center">
                      <p className="text-xs text-muted-foreground">{stat.name}</p>
                      <p className="text-sm font-semibold">
                        {stat.vals?.[0]?.v !== undefined ? String(stat.vals[0].v) : '-'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable Table */}
            <ScrollArea className="flex-1">
              <div className="min-w-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-semibold py-3 px-4 w-12 text-center">#</TableHead>
                      {currentTable.header.map((header, index) => (
                        <TableHead
                          key={index}
                          className="text-xs font-semibold whitespace-nowrap py-3 px-4"
                        >
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={currentTable.header.length + 1}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No data available for this report
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentRows.map((row, rowIndex) => {
                        if (!row.c) return null;
                        return (
                          <TableRow
                            key={rowIndex}
                            className={cn(
                              'transition-colors hover:bg-muted/50',
                              rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                            )}
                          >
                            <TableCell className="text-xs py-2.5 px-4 text-center text-muted-foreground font-mono">
                              {rowIndex + 1}
                            </TableCell>
                            {row.c.map((cell, cellIndex) => (
                              <TableCell
                                key={cellIndex}
                                className="text-xs py-2.5 px-4 whitespace-nowrap"
                              >
                                {formatCellValue(cell)}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No data to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportResultsPanel;