import { useCallback, useMemo, useState } from "react";

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface UsePaginationOptions {
  initialPageIndex?: number;
  initialPageSize?: number;
  totalItems: number;
}

export interface UsePaginationReturn<T> {
  // State
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;

  // Computed
  startIndex: number;
  endIndex: number;
  canPreviousPage: boolean;
  canNextPage: boolean;

  // Actions
  setPageIndex: (index: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;

  // Data slicing
  paginateData: (data: T[]) => T[];

  // Reset
  reset: () => void;
}

/**
 * Hook for managing pagination state
 *
 * @example
 * const { pageIndex, pageSize, paginateData, goToNextPage } = usePagination({
 *   totalItems: data.length,
 *   initialPageSize: 20,
 * });
 *
 * const paginatedData = paginateData(data);
 */
export function usePagination<T = unknown>({
  initialPageIndex = 0,
  initialPageSize = 20,
  totalItems,
}: UsePaginationOptions): UsePaginationReturn<T> {
  const [pageIndex, setPageIndexState] = useState(initialPageIndex);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = useMemo(
    () => Math.ceil(totalItems / pageSize) || 1,
    [totalItems, pageSize]
  );

  const startIndex = pageIndex * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < totalPages - 1;

  const setPageIndex = useCallback((index: number) => {
    const maxIndex = Math.max(0, totalPages - 1);
    setPageIndexState(Math.max(0, Math.min(index, maxIndex)));
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Reset to first page when page size changes
    setPageIndexState(0);
  }, []);

  const goToFirstPage = useCallback(() => setPageIndex(0), [setPageIndex]);
  const goToLastPage = useCallback(() => setPageIndex(totalPages - 1), [setPageIndex, totalPages]);
  const goToNextPage = useCallback(() => {
    if (canNextPage) setPageIndex(pageIndex + 1);
  }, [canNextPage, pageIndex, setPageIndex]);
  const goToPreviousPage = useCallback(() => {
    if (canPreviousPage) setPageIndex(pageIndex - 1);
  }, [canPreviousPage, pageIndex, setPageIndex]);

  const paginateData = useCallback(
    (data: T[]): T[] => data.slice(startIndex, endIndex),
    [startIndex, endIndex]
  );

  const reset = useCallback(() => {
    setPageIndexState(initialPageIndex);
    setPageSizeState(initialPageSize);
  }, [initialPageIndex, initialPageSize]);

  // Auto-adjust page index if it becomes invalid
  useMemo(() => {
    if (pageIndex >= totalPages && totalPages > 0) {
      setPageIndexState(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  return {
    pageIndex,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    canPreviousPage,
    canNextPage,
    setPageIndex,
    setPageSize,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    paginateData,
    reset,
  };
}

/**
 * Hook for server-side pagination (when data is fetched per page)
 */
export function useServerPagination({
  initialPageIndex = 0,
  initialPageSize = 20,
}: Omit<UsePaginationOptions, 'totalItems'> = {}) {
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0); // Reset to first page
  }, []);

  const reset = useCallback(() => {
    setPageIndex(initialPageIndex);
    setPageSize(initialPageSize);
  }, [initialPageIndex, initialPageSize]);

  return {
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize: handlePageSizeChange,
    reset,
    // For Supabase queries
    range: {
      from: pageIndex * pageSize,
      to: (pageIndex + 1) * pageSize - 1,
    },
  };
}