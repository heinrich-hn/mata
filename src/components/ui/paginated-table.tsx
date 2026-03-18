import
  {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
  } from "@/components/ui/pagination";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeletons";
import
  {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { ReactNode, useMemo } from "react";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (item: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface PaginatedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  className?: string;
  rowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
}

/**
 * Paginated table component with built-in loading states
 *
 * @example
 * <PaginatedTable
 *   data={trips}
 *   columns={[
 *     { id: 'number', header: 'Trip #', cell: (trip) => trip.trip_number },
 *     { id: 'status', header: 'Status', cell: (trip) => <Badge>{trip.status}</Badge> },
 *   ]}
 *   getRowKey={(trip) => trip.id}
 *   isLoading={isLoading}
 *   pageSize={20}
 * />
 */
export function PaginatedTable<T>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data found",
  pageSize: initialPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  className,
  rowClassName,
  onRowClick,
  getRowKey,
}: PaginatedTableProps<T>) {
  const {
    pageIndex,
    pageSize,
    totalPages,
    setPageIndex,
    setPageSize,
    paginateData,
  } = usePagination<T>({
    totalItems: data.length,
    initialPageSize,
  });

  const paginatedData = useMemo(
    () => paginateData(data),
    [paginateData, data]
  );

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    // Always show first page
    pages.push(0);

    // Calculate range around current page
    let start = Math.max(1, pageIndex - 1);
    let end = Math.min(totalPages - 2, pageIndex + 1);

    // Adjust if at the start
    if (pageIndex <= 2) {
      end = 3;
    }
    // Adjust if at the end
    if (pageIndex >= totalPages - 3) {
      start = totalPages - 4;
    }

    // Add ellipsis if needed before
    if (start > 1) {
      pages.push('ellipsis');
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Add ellipsis if needed after
    if (end < totalPages - 2) {
      pages.push('ellipsis');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages - 1);
    }

    return pages;
  }, [totalPages, pageIndex]);

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border bg-card", className)}>
        <TableSkeleton rows={initialPageSize > 10 ? 10 : initialPageSize} columns={columns.length} />
      </div>
    );
  }

  const startItem = data.length === 0 ? 0 : pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, data.length);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.id} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => (
                <TableRow
                  key={getRowKey(item)}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    rowClassName?.(item, index)
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Page size selector */}
          {showPageSizeSelector && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
          )}

          {/* Page info */}
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{startItem}</span> to{" "}
            <span className="font-medium">{endItem}</span> of{" "}
            <span className="font-medium">{data.length}</span> results
          </div>

          {/* Page navigation */}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPageIndex(pageIndex - 1)}
                  className={cn(
                    pageIndex === 0 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>

              {pageNumbers.map((page, i) => (
                <PaginationItem key={i}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setPageIndex(page)}
                      isActive={pageIndex === page}
                    >
                      {page + 1}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setPageIndex(pageIndex + 1)}
                  className={cn(
                    pageIndex >= totalPages - 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
