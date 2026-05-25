import { useMemo, useState, useCallback } from "react";
import { CalendarDays, ChevronDown, Clock, FileSpreadsheet, FileText, MessageCircle, Plus, Truck } from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  parseISO,
  isSameDay,
  isWithinInterval,
  format,
  getWeek,
} from "date-fns";

import { CreateLoadDialog } from "@/components/trips/CreateTripDialog";
import { DeliveryConfirmationDialog } from "@/components/trips/DeliveryConfirmationDialog";
import { EditLoadDialog } from "@/components/trips/EditTripDialog";
import { LoadsTable } from "@/components/trips/LoadsTable";
import { QuickFilters } from "@/components/trips/QuickFilters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Load } from "@/hooks/useTrips";
import { useLoads } from "@/hooks/useTrips";
import { exportTimeComparisonToExcel } from "@/lib/exportTimeComparisonToExcel";
import {
  exportLoadsByVehicleExcel,
  exportLoadsByVehiclePdf,
} from "@/lib/exportLoadsByVehicle";
import { exportLoadsForDayOnTimePdf, exportLoadsForDayPdf } from "@/lib/exportLoadsForDayPdf";
import {
  exportLoadsForDayOnTimeExcel,
  exportLoadsToExcel,
  exportLoadsToExcelSimplified,
  exportLoadsWithUnverifiedTimesToExcel,
} from "@/lib/exportTripsToExcel";
import { shareVehicleLocationsForDayWhatsApp } from "@/lib/exportVehicleLocationsForDay";
import { toast } from "sonner";

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
      // Subcontractor loads are normally managed on the Subcontractor page,
      // but unassigned ones (no fleet vehicle yet) are surfaced here so the
      // user can assign a vehicle/driver — even if the load was already
      // marked delivered when it was created.
      if (isSubcontractorLoad(load.load_id) && load.fleet_vehicle_id) return false;

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
  const [dayExportOpen, setDayExportOpen] = useState(false);
  const [dayExportMode, setDayExportMode] = useState<"plan" | "ontime-excel" | "ontime-pdf" | "vehicle-locations">("plan");
  const [dayExportBusy, setDayExportBusy] = useState(false);
  const [dayExportDate, setDayExportDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

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

  const handleExportUnverifiedTimes = useCallback(() => {
    exportLoadsWithUnverifiedTimesToExcel(filteredLoads, getWeekInfo());
  }, [filteredLoads, getWeekInfo]);

  const assignedLoads = useMemo(
    () => filteredLoads.filter((l) => !!l.fleet_vehicle_id),
    [filteredLoads],
  );

  const handleExportByVehicleExcel = useCallback(() => {
    const info = getWeekInfo();
    exportLoadsByVehicleExcel(assignedLoads, {
      ...info,
      title: "Load Planning by Vehicle",
      filename: `load-planning-by-vehicle-week-${info.weekNumber}-${info.year}`,
    });
  }, [assignedLoads, getWeekInfo]);

  const handleExportByVehiclePdf = useCallback(() => {
    const info = getWeekInfo();
    exportLoadsByVehiclePdf(assignedLoads, {
      ...info,
      title: "Load Planning by Vehicle",
      filename: `load-planning-by-vehicle-week-${info.weekNumber}-${info.year}`,
    });
  }, [assignedLoads, getWeekInfo]);

  const dayExportLoads = useMemo(() => {
    if (!dayExportDate) return [] as Load[];
    let target: Date;
    try {
      target = parseISO(dayExportDate);
    } catch {
      return [] as Load[];
    }
    return loads.filter((load) => {
      // Exclude third-party loads (consistent with the rest of this page)
      if (isThirdPartyLoad(load.load_id)) return false;
      try {
        return isSameDay(parseISO(load.loading_date), target);
      } catch {
        return false;
      }
    });
  }, [loads, dayExportDate]);

  const handleConfirmDayExport = useCallback(async () => {
    if (!dayExportDate || dayExportLoads.length === 0) return;
    if (dayExportMode === "ontime-excel") {
      exportLoadsForDayOnTimeExcel(dayExportLoads, dayExportDate, {
        filename: `daily-load-plan-on-time-${dayExportDate}`,
      });
      setDayExportOpen(false);
    } else if (dayExportMode === "ontime-pdf") {
      exportLoadsForDayOnTimePdf(dayExportLoads, dayExportDate, {
        filename: `daily-load-plan-on-time-${dayExportDate}`,
      });
      setDayExportOpen(false);
    } else if (dayExportMode === "vehicle-locations") {
      setDayExportBusy(true);
      try {
        const result = await shareVehicleLocationsForDayWhatsApp(
          dayExportLoads,
          dayExportDate,
        );
        toast.success(
          `WhatsApp message ready — ${result.fetched} of ${result.vehicleCount} vehicle${result.vehicleCount === 1 ? "" : "s"} located (copied to clipboard)` +
          (result.skipped ? `, ${result.skipped} without telematics` : "") +
          (result.failed ? `, ${result.failed} failed` : ""),
        );
        setDayExportOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to build vehicle locations message");
      } finally {
        setDayExportBusy(false);
      }
    } else {
      exportLoadsForDayPdf(dayExportLoads, dayExportDate, {
        filename: `daily-load-plan-${dayExportDate}`,
      });
      setDayExportOpen(false);
    }
  }, [dayExportDate, dayExportLoads, dayExportMode]);

  const openDayExport = useCallback((mode: "plan" | "ontime-excel" | "ontime-pdf" | "vehicle-locations") => {
    setDayExportMode(mode);
    setDayExportOpen(true);
  }, []);

  // Render helpers
  const noAssignedVehicles = assignedLoads.length === 0;
  const exportMenuItems: Array<{
    label: string;
    onClick: () => void;
    icon?: typeof Clock;
    disabled?: boolean;
  }> = [
      { label: "Full Export (All Columns)", onClick: () => handleExportExcel(false) },
      { label: "Simplified Export", onClick: () => handleExportExcel(true) },
      {
        label: "Time Comparison (Planned vs Actual)",
        onClick: handleExportTimeComparison,
        icon: Clock,
      },
      {
        label: "Unverified / Missing Times",
        onClick: handleExportUnverifiedTimes,
        icon: Clock,
      },
      {
        label: "By Vehicle — Excel (one sheet per vehicle)",
        onClick: handleExportByVehicleExcel,
        icon: Truck,
        disabled: noAssignedVehicles,
      },
      {
        label: "By Vehicle — PDF (one section per vehicle)",
        onClick: handleExportByVehiclePdf,
        icon: FileText,
        disabled: noAssignedVehicles,
      },
      {
        label: "Day Plan — PDF (pick a day)",
        onClick: () => openDayExport("plan"),
        icon: CalendarDays,
      },
      {
        label: "Day On-Time — Excel (pick a day)",
        onClick: () => openDayExport("ontime-excel"),
        icon: CalendarDays,
      },
      {
        label: "Day On-Time — PDF (pick a day)",
        onClick: () => openDayExport("ontime-pdf"),
        icon: CalendarDays,
      },
      {
        label: "Day Vehicle Locations — WhatsApp (pick a day)",
        onClick: () => openDayExport("vehicle-locations"),
        icon: MessageCircle,
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
                  <DropdownMenuItem
                    key={item.label}
                    onClick={item.onClick}
                    disabled={item.disabled}
                  >
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

      <Dialog open={dayExportOpen} onOpenChange={setDayExportOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {dayExportMode === "ontime-excel"
                ? "Export Day On-Time to Excel"
                : dayExportMode === "ontime-pdf"
                  ? "Export Day On-Time to PDF"
                  : dayExportMode === "vehicle-locations"
                    ? "Share Day Vehicle Locations on WhatsApp"
                    : "Export Day Plan to PDF"}
            </DialogTitle>
            <DialogDescription>
              {dayExportMode === "plan"
                ? "Pick a loading date. The PDF will include every load scheduled to load on that day, grouped by vehicle."
                : dayExportMode === "vehicle-locations"
                  ? "Pick a loading date. Fetches the current telematics position of every vehicle assigned to a load on that day, copies a WhatsApp-formatted summary to your clipboard and opens WhatsApp to share. Requires Telematics Guru sign-in (Live Tracking page)."
                  : "Pick a loading date. The report shows every load scheduled to load on that day with a single On Time column (Yes if no leg is more than 15 minutes late)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="day-export-date">Loading date</Label>
            <Input
              id="day-export-date"
              type="date"
              value={dayExportDate}
              onChange={(e) => setDayExportDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {dayExportLoads.length === 0
                ? "No loads scheduled to load on this date."
                : `${dayExportLoads.length} load${dayExportLoads.length === 1 ? "" : "s"} will be included.`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDayExportOpen(false)} disabled={dayExportBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDayExport}
              disabled={!dayExportDate || dayExportLoads.length === 0 || dayExportBusy}
              className="gap-2"
            >
              {dayExportMode === "vehicle-locations" ? (
                <>
                  <MessageCircle className="h-4 w-4" />
                  {dayExportBusy ? "Fetching…" : "Share on WhatsApp"}
                </>
              ) : dayExportMode === "ontime-excel" ? (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  {dayExportBusy ? "Fetching…" : "Export Excel"}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}