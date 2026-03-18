import { useToast } from '@/hooks/use-toast';
import { useWialonContext } from '@/integrations/wialon/useWialonContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Wialon Report Types
 */
export interface WialonReportTemplate {
  id: number;
  n: string;           // Template name
  ct: string;          // Content type (avl_unit, avl_unit_group, etc.)
  p: string;           // Period
  f: number;           // Flags
}

export interface WialonResource {
  id: number;
  nm: string;          // Resource name
  reports?: WialonReportTemplate[];
}

export interface ReportInterval {
  from: number;        // Unix timestamp (seconds)
  to: number;          // Unix timestamp (seconds)
  flags: number;       // Interval flags (1 = absolute time)
}

export interface ReportTableHeader {
  name: string;
  type: string;
}

/**
 * A cell value can be:
 * - A simple string/number value
 * - An object with text (t) and optional value (v) properties
 */
export type ReportCellValue =
  | string
  | number
  | { t: string; v?: string | number };

export interface ReportTableRow {
  c: ReportCellValue[];  // Array of cell values
  d?: number;            // Detail level
  i1?: number;           // Start index
  i2?: number;           // End index
  n?: number;            // Row number
  t1?: number;           // Start timestamp
  t2?: number;           // End timestamp
}

export interface ReportTable {
  name: string;
  label: string;
  header: string[];
  rows: number;
  level: number;
  // Fetched row data (populated after calling get_result_rows)
  data?: ReportTableRow[];
}

/**
 * Raw API response from report/exec_report
 * This is the actual JSON structure returned by the Wialon REST API
 */
export interface ReportExecResult {
  reportResult: {
    msgsRendered: number;
    stats: Array<{
      name: string;
      vals: Array<{ v: string | number; t?: string }>;
    }>;
    tables: ReportTable[];
  };
}

/**
 * Wrapper for report result that provides helper methods
 */
export interface ReportResult {
  tables: ReportTable[];
  stats: Array<{
    name: string;
    vals: Array<{ v: string | number; t?: string }>;
  }>;
  msgsRendered: number;
  // Helper method to get tables (for backwards compatibility)
  getTables: () => ReportTable[];
}

interface ExecuteReportParams {
  resourceId: number;
  templateId: number;
  unitId: number;
  interval: ReportInterval;
}

interface UseWialonReportsOptions {
  autoLoadResources?: boolean;
}

/**
 * Hook for managing Wialon reports
 */
export const useWialonReports = (options: UseWialonReportsOptions = {}) => {
  const { autoLoadResources = true } = options;
  const { isConnected, callAPI } = useWialonContext();
  const { toast } = useToast();

  // Fetch available resources with report templates
  const {
    data: resources = [],
    isLoading: resourcesLoading,
    refetch: refetchResources,
  } = useQuery({
    queryKey: ['wialon-report-resources'],
    queryFn: async () => {
      try {
        console.log('📊 Fetching Wialon resources with reports...');

        // Step 1: Search for resources first (without reports)
        console.log('🔍 Step 1: Searching for resources...');
        const searchResult = await callAPI('core/search_items', {
          spec: {
            itemsType: 'avl_resource',
            propName: '',
            propValueMask: '*',
            sortType: 'sys_name',
          },
          force: 1,
          flags: 0x0001, // Just BASE to get IDs
          from: 0,
          to: 0,
        }) as {
          items: Array<{
            id: number;
            nm: string;
          }>;
        };

        if (!searchResult.items || searchResult.items.length === 0) {
          console.warn('⚠️ No resources found');
          return [];
        }

        console.log(`✅ Found ${searchResult.items.length} resource(s)`);

        // Step 2: Update data flags for each resource to load reports
        // Flags: 0x0001 (1 BASE) + 0x0010 (16 GENERAL) + 0x2000 (8192 REPORTS) = 8209
        console.log('🔄 Step 2: Loading reports with flags 8209 (0x2011)...');
        await callAPI('core/update_data_flags', {
          spec: searchResult.items.map(item => ({
            type: 'id',
            data: item.id,
            flags: 8209, // 0x2011 = BASE + GENERAL + REPORTS
            mode: 0, // Replace mode
          }))
        });

        // Step 3: Fetch resources again with reports now loaded
        console.log('🔍 Step 3: Fetching resources with loaded reports...');
        const result = await callAPI('core/search_items', {
          spec: {
            itemsType: 'avl_resource',
            propName: '',
            propValueMask: '*',
            sortType: 'sys_name',
          },
          force: 0, // Use cached data
          flags: 8209, // 0x2011 = BASE + GENERAL + REPORTS
          from: 0,
          to: 0,
        }) as {
          items: Array<{
            id: number;
            nm: string;
            rep?: Record<string, {
              n?: string;
              ct?: string;
              p?: string;
              f?: number;
            }>;
          }>;
        };

        console.log('📦 Raw API result:', JSON.stringify(result, null, 2));        if (!result.items || result.items.length === 0) {
          console.warn('⚠️ No resources found');
          return [];
        }

        console.log(`✅ Found ${result.items.length} resource(s)`);

        // Map resources with their report templates
        const resourcesWithReports = result.items.map(item => {
          console.log(`\n🔍 Processing resource: "${item.nm}" (ID: ${item.id})`);
          console.log('  Raw rep field:', item.rep ? 'exists' : 'missing');

          if (item.rep) {
            console.log('  Rep keys:', Object.keys(item.rep));
            console.log('  Rep structure:', JSON.stringify(item.rep, null, 2));
          }

          const reports: WialonReportTemplate[] = [];

          if (item.rep && typeof item.rep === 'object') {
            // Wialon stores templates with numeric IDs as keys
            Object.entries(item.rep).forEach(([key, template]) => {
              console.log(`    Processing template key: ${key}`, template);

              if (template && typeof template === 'object') {
                const reportTemplate = {
                  id: Number(key),
                  n: template.n || 'Unnamed Template',
                  ct: template.ct || 'avl_unit',
                  p: template.p || '',
                  f: template.f || 0,
                };
                reports.push(reportTemplate);
                console.log(`      ✅ Added template:`, reportTemplate);
              } else {
                console.log(`      ❌ Invalid template at key ${key}`);
              }
            });
          } else {
            console.log('  ⚠️ No rep field or invalid format');
          }

          console.log(`📋 Resource "${item.nm}" (ID: ${item.id}): ${reports.length} templates loaded`);

          return {
            id: item.id,
            nm: item.nm,
            reports,
          };
        });

        console.log(`✓ Found ${resourcesWithReports.length} resources with ${resourcesWithReports.reduce((sum, r) => sum + r.reports.length, 0)} total templates`);
        return resourcesWithReports;
      } catch (error) {
        console.error('Error in fetching resources:', error);
        toast({
          title: 'Failed to fetch resources',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
          variant: 'destructive',
        });
        return [];
      }
    },
    enabled: isConnected && autoLoadResources,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch units for report execution
  const {
    data: units = [],
    isLoading: unitsLoading,
  } = useQuery({
    queryKey: ['wialon-report-units'],
    queryFn: async () => {
      console.log('🚗 Fetching units for reports...');

      await callAPI('core/update_data_flags', {
        spec: [
          {
            type: 'type',
            data: 'avl_unit',
            flags: 0x0001, // BASE only
            mode: 0,
          }
        ]
      });

      const result = await callAPI('core/search_items', {
        spec: {
          itemsType: 'avl_unit',
          propName: '',
          propValueMask: '*',
          sortType: 'sys_name',
        },
        force: 1,
        flags: 0x0001,
        from: 0,
        to: 0,
      }) as {
        items: Array<{
          id: number;
          nm: string;
        }>;
      };

      if (!result.items || result.items.length === 0) {
        console.warn('No units found');
        return [];
      }

      console.log(`✓ Found ${result.items.length} units`);
      return result.items;
    },
    enabled: isConnected && autoLoadResources,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Get report templates for a specific resource
   */
  const getTemplates = useCallback((resourceId: number, contentType: string = 'avl_unit') => {
    const resource = resources.find(r => r.id === resourceId);

    if (!resource) {
      console.warn(`⚠️ Resource ${resourceId} not found`);
      return [];
    }

    if (!resource.reports || resource.reports.length === 0) {
      console.warn(`⚠️ Resource "${resource.nm}" has no report templates`);
      return [];
    }

    const filtered = resource.reports.filter(template => template.ct === contentType);
    console.log(`📊 Found ${filtered.length} templates of type "${contentType}" for resource "${resource.nm}"`);

    return filtered;
  }, [resources]);

  /**
   * Execute a report
   */
  const executeReportMutation = useMutation({
    mutationFn: async (params: ExecuteReportParams) => {
      const { resourceId, templateId, unitId, interval } = params;

      console.log('📈 Executing report:', {
        resourceId,
        templateId,
        unitId,
        interval,
      });

      try {
        const rawResult = await callAPI('report/exec_report', {
          reportResourceId: resourceId,
          reportTemplateId: templateId,
          reportObjectId: unitId,
          reportObjectSecId: 0,
          interval,
        }) as unknown as (ReportExecResult | ReportExecResult['reportResult']);

        console.log('✅ Report API call successful, raw result:', rawResult);

        // Extract data from the nested reportResult structure
        // The response may be nested under reportResult or directly at the top level
        const reportData = 'reportResult' in rawResult ? rawResult.reportResult : rawResult;
        const tables = reportData.tables || [];
        const stats = reportData.stats || [];
        const msgsRendered = reportData.msgsRendered || 0;

        console.log(`📊 Found ${tables.length} table(s), fetching row data...`);

        // Fetch row data for each table sequentially (Wialon may not handle parallel requests well)
        const tablesWithData: ReportTable[] = [];
        for (let index = 0; index < tables.length; index++) {
          const table = tables[index];

          if (table.rows === 0) {
            console.log(`  Table ${index} "${table.label}": 0 rows, skipping`);
            tablesWithData.push({ ...table, data: [] });
            continue;
          }

          try {
            console.log(`  Table ${index} "${table.label}": fetching ${table.rows} rows...`);

            // Wialon API returns rows in a specific format
            // The response could be an array directly or wrapped in an object
            const rowsResponse = await callAPI('report/get_result_rows', {
              tableIndex: index,
              indexFrom: 0,
              indexTo: table.rows,
            });

            console.log(`  Table ${index} raw response:`, rowsResponse);

            // Handle different response formats from Wialon
            let rowsData: ReportTableRow[] = [];
            if (Array.isArray(rowsResponse)) {
              rowsData = rowsResponse as ReportTableRow[];
            } else if (rowsResponse && typeof rowsResponse === 'object') {
              // Check for common wrapper properties
              const resp = rowsResponse as Record<string, unknown>;
              if (Array.isArray(resp.rows)) {
                rowsData = resp.rows as ReportTableRow[];
              } else if (Array.isArray(resp.data)) {
                rowsData = resp.data as ReportTableRow[];
              } else if (Array.isArray(resp.result)) {
                rowsData = resp.result as ReportTableRow[];
              }
            }

            console.log(`  Table ${index} "${table.label}": fetched ${rowsData.length} rows`);
            tablesWithData.push({ ...table, data: rowsData });
          } catch (rowError) {
            console.error(`  Table ${index} "${table.label}": failed to fetch rows:`, rowError);
            tablesWithData.push({ ...table, data: [] });
          }
        }

        // Create a result object with helper methods for backwards compatibility
        const result: ReportResult = {
          tables: tablesWithData,
          stats,
          msgsRendered,
          getTables: () => tablesWithData,
        };

        console.log('📊 Processed result:', {
          tables: tablesWithData.length,
          totalRows: tablesWithData.reduce((sum, t) => sum + (t.data?.length || 0), 0),
          stats: stats.length,
          msgsRendered
        });
        return result;
      } catch (error) {
        console.error('❌ Report API call failed:', error);
        throw error;
      }
    },
    onSuccess: (result) => {
      console.log('✅ Mutation onSuccess triggered');
      const tables = result.getTables();
      console.log('📊 Tables in result:', tables);
      toast({
        title: 'Report Generated',
        description: `Successfully generated report with ${tables.length} table(s)`,
      });
    },
    onError: (error: Error) => {
      console.error('❌ Mutation onError triggered:', error);
      toast({
        title: 'Report Error',
        description: error.message || 'Failed to execute report',
        variant: 'destructive',
      });
    },
  });

  /**
   * Get current server time (for interval calculations)
   * Note: We use local time as Wialon doesn't have a dedicated server time endpoint.
   * The server time is returned during login (tm field) but using local time is
   * accurate enough for report intervals and avoids unnecessary API calls.
   */
  const getServerTime = useCallback(async (): Promise<number> => {
    // Use local Unix timestamp in seconds (Wialon uses seconds, not milliseconds)
    return Math.floor(Date.now() / 1000);
  }, []);

  /**
   * Helper: Create interval from duration (in seconds)
   */
  const createInterval = useCallback(async (durationSeconds: number): Promise<ReportInterval> => {
    const to = await getServerTime();
    const from = to - durationSeconds;

    return {
      from,
      to,
      flags: 1, // Absolute time
    };
  }, [getServerTime]);

  /**
   * Helper: Create interval from date range
   */
  const createIntervalFromDates = useCallback((fromDate: Date, toDate: Date): ReportInterval => {
    return {
      from: Math.floor(fromDate.getTime() / 1000),
      to: Math.floor(toDate.getTime() / 1000),
      flags: 1, // Absolute time
    };
  }, []);

  /**
   * Fetch report table rows using the REST API
   * Note: This requires calling report/get_result_rows API endpoint
   */
  const fetchTableRows = useCallback(async (
    reportResult: ReportResult,
    tableIndex: number,
    fromRow: number = 0,
    toRow?: number
  ): Promise<ReportTableRow[]> => {
    const tables = reportResult.getTables();
    const rowCount = toRow !== undefined ? toRow : tables[tableIndex]?.rows || 0;

    if (rowCount === 0) {
      return [];
    }

    try {
      // Use the Wialon REST API to fetch table rows
      const result = await callAPI('report/get_result_rows', {
        tableIndex,
        indexFrom: fromRow,
        indexTo: rowCount,
      }) as unknown as ReportTableRow[];

      return result || [];
    } catch (error) {
      console.error('Failed to fetch table rows:', error);
      throw error;
    }
  }, [callAPI]);

  /**
   * Format cell value for display
   * Handles both raw values (strings/numbers) and object format from Wialon API
   */
  const formatCellValue = useCallback((cell: ReportCellValue): string => {
    if (cell === null || cell === undefined) return '';

    // Handle raw string/number values (most common from Wialon REST API)
    if (typeof cell === 'string') {
      return cell;
    }
    if (typeof cell === 'number') {
      return String(cell);
    }

    // Handle object format with t (type) and v (value) properties
    if (typeof cell === 'object') {
      // If it has a 't' (text) property, use that as display value
      if (cell.t !== undefined) {
        return String(cell.t);
      }
      // Fall back to 'v' (value) property
      if (cell.v !== undefined) {
        return String(cell.v);
      }
    }

    return '';
  }, []);

  /**
   * Check if user has report execution permissions
   */
  const checkReportAccess = useCallback((resourceId: number): boolean => {
    const resource = resources.find(r => r.id === resourceId);
    return !!resource;  // Assuming access if the resource exists
  }, [resources]);

  /**
   * Get predefined time intervals
   */
  const getPredefinedIntervals = useCallback(() => {
    return {
      today: async () => {
        const now = await getServerTime();
        const todayStart = Math.floor(new Date(now * 1000).setHours(0, 0, 0, 0) / 1000);
        return { from: todayStart, to: now, flags: 1 };
      },
      yesterday: async () => {
        const now = await getServerTime();
        const yesterdayStart = Math.floor(new Date(now * 1000).setHours(0, 0, 0, 0) / 1000) - 86400;
        const yesterdayEnd = yesterdayStart + 86400;
        return { from: yesterdayStart, to: yesterdayEnd, flags: 1 };
      },
      lastWeek: async () => {
        const now = await getServerTime();
        return { from: now - 7 * 86400, to: now, flags: 1 };
      },
      lastMonth: async () => {
        const now = await getServerTime();
        return { from: now - 30 * 86400, to: now, flags: 1 };
      },
    };
  }, [getServerTime]);

  /**
   * Manually fetch a specific resource by ID with its report templates
   * Useful for debugging when templates aren't loading via search
   */
  const fetchResourceById = useCallback(async (resourceId: number) => {
    try {
      console.log(`🔍 Fetching resource ${resourceId} directly...`);

      // First ensure the item is loaded in session
      await callAPI('core/update_data_flags', {
        spec: [
          {
            type: 'id',
            data: resourceId,
            flags: 8209, // 0x2011 = BASE + GENERAL + REPORTS
            mode: 0,
          }
        ]
      });

      // Then search for the specific item
      const result = await callAPI('core/search_item', {
        id: resourceId,
        flags: 8209, // 0x2011 = BASE + GENERAL + REPORTS
      }) as {
        item: {
          id: number;
          nm: string;
          rep?: Record<string, {
            n?: string;
            ct?: string;
            p?: string;
            f?: number;
          }>;
        };
      };

      console.log('📦 Direct fetch result:', JSON.stringify(result, null, 2));

      if (result.item && result.item.rep) {
        const reports: WialonReportTemplate[] = [];
        Object.entries(result.item.rep).forEach(([key, template]) => {
          if (template && typeof template === 'object') {
            reports.push({
              id: Number(key),
              n: template.n || 'Unnamed Template',
              ct: template.ct || 'avl_unit',
              p: template.p || '',
              f: template.f || 0,
            });
          }
        });
        console.log(`✅ Found ${reports.length} templates for resource ${resourceId}`);
        return reports;
      }

      return [];
    } catch (error) {
      console.error('❌ Error fetching resource:', error);
      return [];
    }
  }, [callAPI]);

  return {
    // Connection state
    isConnected,
    isLoading: resourcesLoading || unitsLoading,

    // Data
    resources,
    units,

    // Methods
    getTemplates,
    executeReport: executeReportMutation.mutate,
    isExecuting: executeReportMutation.isPending,
    reportResult: executeReportMutation.data,

    // Helpers
    createInterval,
    createIntervalFromDates,
    fetchTableRows,
    formatCellValue,
    checkReportAccess,
    getPredefinedIntervals,
    getServerTime,

    // Refetch
    refetchResources,

    // Debug helpers
    fetchResourceById,
  };
};

export default useWialonReports;