import { useMemo, useState, useCallback } from "react";
import { ChevronDown, Clock, FileSpreadsheet, Plus } from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  parseISO,
  isWithinInterval,
  getWeek,
} from "date-fns";

import { CreateLoadDialog } from "@/components/trips/CreateTripDialog";
import { DeliveryConfirmationDialog } from "@/components/trips/DeliveryConfirmationDialog";
import { EditLoadDialog } from "@/components/trips/EditTripDialog";
import { LoadsTable } from "@/components/trips/LoadsTable";
import { QuickFilters } from "@/components/trips/QuickFilters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Load } from "@/hooks/useTrips";
import { useLoads } from "@/hooks/useTrips";
import { exportTimeComparisonToExcel } from "@/lib/exportTimeComparisonToExcel";
import {
  exportLoadsToExcel,
  exportLoadsToExcelSimplified,
} from "@/lib/exportTripsToExcel";

// Types
interface WeekFilter {
  start: Date | null;
  end: Date | null;
}

type DialogState = {
  create: boolean;
  edit: boolean;
  delivery: boolean;
};

type FilterState = {
  search: string;
  status: string;
  origin: string;
};

const INITIAL_FILTERS: FilterState = {
  search: "",
  status: "all",
  origin: "all",
};

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

// Helper functions
const getInitialWeekFilter = (): WeekFilter => {
  const now = new Date();
  return {
    start: startOfWeek(now, WEEK_OPTIONS),
    end: endOfWeek(now, WEEK_OPTIONS),
  };
};

const isThirdPartyLoad = (loadId: string) => loadId.startsWith("TP-");
const isSubcontractorLoad = (loadId: string) => loadId.startsWith("SC-");

const matchesSearchQuery = (load: Load, query: string): boolean => {
  if (!query) return true;

  const searchLower = query.toLowerCase();
  return (
    load.load_id.toLowerCase().includes(searchLower) ||
    load.driver?.name?.toLowerCase().includes(searchLower) ||
    load.origin.toLowerCase().includes(searchLower)
  );
};

const matchesWeekFilter = (load: Load, weekFilter: WeekFilter): boolean => {
  if (!weekFilter.start || !weekFilter.end) return true;

  try {
    const loadDate = startOfDay(parseISO(load.loading_date));
    return isWithinInterval(loadDate, {
      start: startOfDay(weekFilter.start),
      end: weekFilter.end,
    });
  } catch {
    return false;
  }
};

// Custom hook for filter logic
const useFilteredLoads = (loads: Load[], filters: FilterState, weekFilter: WeekFilter) => {
  return useMemo(() => {
    return loads.filter((load) => {
      if (isThirdPartyLoad(load.load_id)) return false;
      if (isSubcontractorLoad(load.load_id)) return false;

      const searchMatch = matchesSearchQuery(load, filters.search);
      const statusMatch = filters.status === "all" || load.status === filters.status;
      const originMatch = filters.origin === "all" || load.origin === filters.origin;
      const weekMatch = matchesWeekFilter(load, weekFilter);

      return searchMatch && statusMatch && originMatch && weekMatch;
    });
  }, [loads, filters, weekFilter]);
};

export default function LoadsPage() {
  // State
  const [dialogs, setDialogs] = useState<DialogState>({
    create: false,
    edit: false,
    delivery: false,
  });

  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>(getInitialWeekFilter);

  // Data
  const { data: loads = [], isLoading } = useLoads();

  // Computed values
  const filteredLoads = useFilteredLoads(loads, filters, weekFilter);

  const selectedLoadFresh = useMemo(() => {
    if (!selectedLoad) return null;
    return loads.find(l => l.id === selectedLoad.id) ?? selectedLoad;
  }, [selectedLoad, loads]);

  // Handlers
  const updateDialog = useCallback((key: keyof DialogState, value: boolean) => {
    setDialogs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleLoadAction = useCallback((load: Load, dialog: keyof DialogState) => {
    setSelectedLoad(load);
    updateDialog(dialog, true);
  }, [updateDialog]);

  const handleWeekFilter = useCallback((weekStart: Date | null, weekEnd: Date | null) => {
    setWeekFilter({ start: weekStart, end: weekEnd });
  }, []);

  const getWeekInfo = useCallback(() => {
    const refDate = weekFilter.start ?? new Date();
    return {
      weekNumber: getWeek(refDate, WEEK_OPTIONS),
      year: refDate.getFullYear(),
    };
  }, [weekFilter.start]);

  const handleExportExcel = useCallback((simplified = false) => {
    const exportOptions = getWeekInfo();
    const exportFn = simplified ? exportLoadsToExcelSimplified : exportLoadsToExcel;
    exportFn(filteredLoads, exportOptions);
  }, [filteredLoads, getWeekInfo]);

  const handleExportTimeComparison = useCallback(() => {
    exportTimeComparisonToExcel(filteredLoads, getWeekInfo());
  }, [filteredLoads, getWeekInfo]);

  // Render helpers
  const exportMenuItems = [
    { label: "Full Export (All Columns)", onClick: () => handleExportExcel(false) },
    { label: "Simplified Export", onClick: () => handleExportExcel(true) },
    {
      label: "Time Comparison (Planned vs Actual)",
      onClick: handleExportTimeComparison,
      icon: Clock,
    },
  ];

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!filteredLoads.length}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export to Excel
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {exportMenuItems.map((item) => (
                  <DropdownMenuItem key={item.label} onClick={item.onClick}>
                    {item.icon && <item.icon className="h-4 w-4 mr-2" />}
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => updateDialog("create", true)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Load
            </Button>
          </div>
        </header>

        <QuickFilters
          onSearch={(search) => setFilters(prev => ({ ...prev, search }))}
          onStatusFilter={(status) => setFilters(prev => ({ ...prev, status }))}
          onOriginFilter={(origin) => setFilters(prev => ({ ...prev, origin }))}
          onWeekFilter={handleWeekFilter}
        />

        <LoadsTable
          loads={filteredLoads}
          isLoading={isLoading}
          onLoadClick={(load) => handleLoadAction(load, "edit")}
          onEditLoad={(load) => handleLoadAction(load, "edit")}
          onConfirmDelivery={(load) => handleLoadAction(load, "delivery")}
        />
      </div>

      <CreateLoadDialog
        open={dialogs.create}
        onOpenChange={(open) => updateDialog("create", open)}
      />

      <EditLoadDialog
        open={dialogs.edit}
        onOpenChange={(open) => updateDialog("edit", open)}
        load={selectedLoadFresh}
      />

      <DeliveryConfirmationDialog
        open={dialogs.delivery}
        onOpenChange={(open) => updateDialog("delivery", open)}
        load={selectedLoadFresh}
      />
    </>
  );
}