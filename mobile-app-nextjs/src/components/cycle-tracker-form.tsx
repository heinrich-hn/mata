"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"; // Removed Card, CardContent imports
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Thermometer,
  Trash2,
  Truck,
  Package,
  // X is removed as it's not used
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface TripEntry {
  id: string;
  trip_number: string | null;
  vehicle_id: string | null;
  fleet_vehicle_id: string | null;
  origin: string | null;
  destination: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  driver_name: string | null;
  client_name: string | null;
  distance_km: number | null;
  starting_km: number | null;
  ending_km: number | null;
  base_revenue: number | null;
  invoice_amount: number | null;
  status: string | null;
  created_at: string | null;
}

interface CycleTrackerData {
  id?: string;
  trip_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  truck_type: string | null;
  route: string | null;
  current_phase: number;
  is_completed: boolean;
  // Phase 1
  p1_inspection_start: string | null;
  p1_inspection_end: string | null;
  p1_refuel_start: string | null;
  p1_refuel_end: string | null;
  p1_reefer_start_time: string | null;
  p1_reefer_start_temp: number | null;
  p1_yard_departure: string | null;
  // Phase 2
  p2_farm_arrival: string | null;
  p2_loading_start: string | null;
  p2_loading_end: string | null;
  p2_farm_departure: string | null;
  p2_delay_reason: string[] | null;
  p2_delay_other_detail: string | null;
  p2_farm_supervisor: string | null;
  // Phase 4
  p4_depot_arrival: string | null;
  p4_reefer_arrival_temp: number | null;
  p4_offloading_start: string | null;
  p4_offloading_end: string | null;
  // Phase 5
  p5_crates_count: number;
  p5_bins_count: number;
  p5_damaged_packaging: boolean;
  p5_damaged_details: string | null;
  p5_depot_departure: string | null;
  p5_depot_supervisor: string | null;
  // Phase 6
  p6_yard_arrival: string | null;
  p6_unloading_start: string | null;
  p6_unloading_end: string | null;
  p6_road_comments: string | null;
}

interface TransitStop {
  id?: string;
  tracker_id?: string;
  location: string;
  reason: string;
  time_in: string;
  time_out: string;
  duration_mins: number | null;
  sort_order: number;
  _isNew?: boolean;
  _isDeleted?: boolean;
}

interface CycleTrackerFormProps {
  trip: TripEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Constants ───────────────────────────────────────────────────────

const PHASES = [
  { num: 1, label: "Preparation", icon: "🔧" },
  { num: 2, label: "Farm Loading", icon: "🌾" },
  { num: 3, label: "In-Transit", icon: "🚛" },
  { num: 4, label: "Depot Arrival", icon: "🏭" },
  { num: 5, label: "Return Leg", icon: "📦" },
  { num: 6, label: "Loop Complete", icon: "✅" },
];

const DELAY_REASONS = [
  { value: "packaging_shortage", label: "Packaging Shortage" },
  { value: "labor_shortage", label: "Labor Shortage" },
  { value: "fruit_not_harvested", label: "Fruit not Harvested" },
  { value: "qc_delay", label: "QC Delay" },
  { value: "mechanical", label: "Mechanical" },
  { value: "other", label: "Other" },
];

const EMPTY_TRACKER: Omit<CycleTrackerData, "trip_id" | "driver_id" | "vehicle_id"> = {
  truck_type: null,
  route: null,
  current_phase: 1,
  is_completed: false,
  p1_inspection_start: null,
  p1_inspection_end: null,
  p1_refuel_start: null,
  p1_refuel_end: null,
  p1_reefer_start_time: null,
  p1_reefer_start_temp: null,
  p1_yard_departure: null,
  p2_farm_arrival: null,
  p2_loading_start: null,
  p2_loading_end: null,
  p2_farm_departure: null,
  p2_delay_reason: null,
  p2_delay_other_detail: null,
  p2_farm_supervisor: null,
  p4_depot_arrival: null,
  p4_reefer_arrival_temp: null,
  p4_offloading_start: null,
  p4_offloading_end: null,
  p5_crates_count: 0,
  p5_bins_count: 0,
  p5_damaged_packaging: false,
  p5_damaged_details: null,
  p5_depot_departure: null,
  p5_depot_supervisor: null,
  p6_yard_arrival: null,
  p6_unloading_start: null,
  p6_unloading_end: null,
  p6_road_comments: null,
};

// Helper: get current datetime-local value
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Helper: calc minutes between two ISO strings
function calcDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  return `${hrs}h ${rm}m`;
}

// ─── Main Component ─────────────────────────────────────────────────

export function CycleTrackerForm({ trip, open, onOpenChange }: CycleTrackerFormProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activePhase, setActivePhase] = useState(1);
  const [formData, setFormData] = useState<CycleTrackerData>({
    ...EMPTY_TRACKER,
    trip_id: trip.id,
    driver_id: user?.id || null,
    vehicle_id: trip.fleet_vehicle_id || null,
  });
  const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ─── Fetch existing tracker ────────────────────────────────────────

  const { data: existingTracker, isLoading: isLoadingTracker } = useQuery({
    queryKey: ["cycle-tracker", trip.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_cycle_tracker")
        .select("*")
        .eq("trip_id", trip.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data as CycleTrackerData | null;
    },
    enabled: open && !!trip.id,
  });

  // Fetch transit stops if tracker exists
  const { data: existingStops = [] } = useQuery({
    queryKey: ["transit-stops", existingTracker?.id],
    queryFn: async () => {
      if (!existingTracker?.id) return [];
      const { data, error } = await supabase
        .from("trip_transit_stops")
        .select("*")
        .eq("tracker_id", existingTracker.id)
        .order("sort_order", { ascending: true });

      if (error) return [];
      return (data || []) as TransitStop[];
    },
    enabled: open && !!existingTracker?.id,
  });

  // Sync fetched data into form state when loaded
  const [hasInitialized, setHasInitialized] = useState(false);
  if (existingTracker && !hasInitialized) {
    setFormData({
      ...EMPTY_TRACKER,
      ...existingTracker,
      trip_id: trip.id,
      driver_id: user?.id || existingTracker.driver_id,
      vehicle_id: trip.fleet_vehicle_id || existingTracker.vehicle_id,
    });
    setActivePhase(existingTracker.current_phase || 1);
    setHasInitialized(true);
  }
  if (existingStops.length > 0 && transitStops.length === 0 && hasInitialized) {
    setTransitStops(existingStops);
  }

  // ─── Handlers ─────────────────────────────────────────────────────

  const updateField = useCallback(<K extends keyof CycleTrackerData>(field: K, value: CycleTrackerData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const stampNow = useCallback((field: keyof CycleTrackerData) => {
    updateField(field, nowLocal() as never);
  }, [updateField]);

  const toggleDelayReason = useCallback((reason: string) => {
    setFormData(prev => {
      const current = prev.p2_delay_reason || [];
      const updated = current.includes(reason)
        ? current.filter(r => r !== reason)
        : [...current, reason];
      return { ...prev, p2_delay_reason: updated };
    });
  }, []);

  // Transit stop management
  const addTransitStop = useCallback(() => {
    setTransitStops(prev => [
      ...prev,
      {
        location: "",
        reason: "",
        time_in: nowLocal(),
        time_out: "",
        duration_mins: null,
        sort_order: prev.length,
        _isNew: true,
      },
    ]);
  }, []);

  const updateStop = useCallback((index: number, field: keyof TransitStop, value: string | number | null) => {
    setTransitStops(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calc duration
      if (field === "time_in" || field === "time_out") {
        const tIn = field === "time_in" ? value as string : updated[index].time_in;
        const tOut = field === "time_out" ? value as string : updated[index].time_out;
        if (tIn && tOut) {
          const ms = new Date(tOut).getTime() - new Date(tIn).getTime();
          updated[index].duration_mins = ms > 0 ? Math.round(ms / 60000) : null;
        }
      }
      return updated;
    });
  }, []);

  const removeStop = useCallback((index: number) => {
    setTransitStops(prev => {
      const stop = prev[index];
      if (stop.id && !stop._isNew) {
        // Mark for deletion
        const updated = [...prev];
        updated[index] = { ...updated[index], _isDeleted: true };
        return updated;
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ─── Save Phase ───────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Auth required");
      setIsSaving(true);

      // Build the row payload (exclude id, transit stops handled separately)
      const payload: Record<string, unknown> = {
        trip_id: formData.trip_id,
        driver_id: formData.driver_id,
        vehicle_id: formData.vehicle_id,
        truck_type: formData.truck_type,
        route: formData.route,
        current_phase: activePhase,
        is_completed: activePhase === 6 && formData.p6_yard_arrival !== null,
        // Phase 1
        p1_inspection_start: formData.p1_inspection_start,
        p1_inspection_end: formData.p1_inspection_end,
        p1_refuel_start: formData.p1_refuel_start,
        p1_refuel_end: formData.p1_refuel_end,
        p1_reefer_start_time: formData.p1_reefer_start_time,
        p1_reefer_start_temp: formData.p1_reefer_start_temp,
        p1_yard_departure: formData.p1_yard_departure,
        // Phase 2
        p2_farm_arrival: formData.p2_farm_arrival,
        p2_loading_start: formData.p2_loading_start,
        p2_loading_end: formData.p2_loading_end,
        p2_farm_departure: formData.p2_farm_departure,
        p2_delay_reason: formData.p2_delay_reason,
        p2_delay_other_detail: formData.p2_delay_other_detail,
        p2_farm_supervisor: formData.p2_farm_supervisor,
        // Phase 4
        p4_depot_arrival: formData.p4_depot_arrival,
        p4_reefer_arrival_temp: formData.p4_reefer_arrival_temp,
        p4_offloading_start: formData.p4_offloading_start,
        p4_offloading_end: formData.p4_offloading_end,
        // Phase 5
        p5_crates_count: formData.p5_crates_count,
        p5_bins_count: formData.p5_bins_count,
        p5_damaged_packaging: formData.p5_damaged_packaging,
        p5_damaged_details: formData.p5_damaged_details,
        p5_depot_departure: formData.p5_depot_departure,
        p5_depot_supervisor: formData.p5_depot_supervisor,
        // Phase 6
        p6_yard_arrival: formData.p6_yard_arrival,
        p6_unloading_start: formData.p6_unloading_start,
        p6_unloading_end: formData.p6_unloading_end,
        p6_road_comments: formData.p6_road_comments,
      };

      let trackerId = formData.id || existingTracker?.id;

      if (trackerId) {
        // Update existing
        const { error } = await supabase
          .from("trip_cycle_tracker")
          .update(payload as never)
          .eq("id", trackerId);
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("trip_cycle_tracker")
          .insert(payload as never)
          .select("id")
          .single();
        if (error) throw error;
        trackerId = (data as { id: string }).id;
        setFormData(prev => ({ ...prev, id: trackerId! }));
      }

      // Handle transit stops for Phase 3
      if (activePhase === 3 && trackerId) {
        // Delete removed stops
        const toDelete = transitStops.filter(s => s._isDeleted && s.id);
        for (const stop of toDelete) {
          await supabase.from("trip_transit_stops").delete().eq("id", stop.id!);
        }

        // Insert new stops
        const toInsert = transitStops.filter(s => s._isNew && !s._isDeleted);
        if (toInsert.length > 0) {
          const rows = toInsert.map((s, i) => ({
            tracker_id: trackerId,
            location: s.location,
            reason: s.reason,
            time_in: s.time_in || null,
            time_out: s.time_out || null,
            duration_mins: s.duration_mins,
            sort_order: i,
          }));
          const { error } = await supabase.from("trip_transit_stops").insert(rows as never);
          if (error) throw error;
        }

        // Update existing stops
        const toUpdate = transitStops.filter(s => s.id && !s._isNew && !s._isDeleted);
        for (const stop of toUpdate) {
          await supabase
            .from("trip_transit_stops")
            .update({
              location: stop.location,
              reason: stop.reason,
              time_in: stop.time_in || null,
              time_out: stop.time_out || null,
              duration_mins: stop.duration_mins,
              sort_order: stop.sort_order,
            } as never)
            .eq("id", stop.id!);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycle-tracker", trip.id] });
      queryClient.invalidateQueries({ queryKey: ["transit-stops"] });
      queryClient.invalidateQueries({ queryKey: ["cycle-tracker-exists"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: "Saved", description: `Phase ${activePhase} saved successfully` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  // ─── Phase Completion Check ────────────────────────────────────────

  const phaseComplete = useMemo(() => {
    return {
      1: !!formData.p1_yard_departure,
      2: !!formData.p2_farm_departure,
      3: true, // Transit stops are optional
      4: !!formData.p4_offloading_end,
      5: !!formData.p5_depot_departure,
      6: !!formData.p6_yard_arrival,
    };
  }, [formData]);

  const totalTransitStopMins = useMemo(
    () => transitStops.filter(s => !s._isDeleted).reduce((sum, s) => sum + (s.duration_mins || 0), 0),
    [transitStops]
  );

  // ─── Render ────────────────────────────────────────────────────────

  if (isLoadingTracker) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[92vh] overflow-y-auto p-0 gap-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Loading Tracker</DialogTitle>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[92vh] overflow-y-auto p-0 gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">360° Time Tracker</DialogTitle>

        {/* ─── Sticky Header ─────────────────────────── */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close dialog"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold truncate">360° Time Tracker</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{trip.origin || "N/A"}</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <span className="truncate">{trip.destination || "N/A"}</span>
              </div>
            </div>
            {formData.is_completed && (
              <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-500 text-emerald-500">
                Complete
              </Badge>
            )}
          </div>

          {/* Phase Progress Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {PHASES.map((phase) => (
              <button
                key={phase.num}
                onClick={() => setActivePhase(phase.num)}
                className={cn(
                  "w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center",
                  activePhase === phase.num
                    ? "bg-primary text-primary-foreground scale-110"
                    : phaseComplete[phase.num as keyof typeof phaseComplete]
                    ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                    : "bg-muted/50 text-muted-foreground"
                )}
                aria-label={`Go to phase ${phase.num}: ${phase.label}`}
              >
                {phaseComplete[phase.num as keyof typeof phaseComplete] && activePhase !== phase.num ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  phase.num
                )}
              </button>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            {PHASES[activePhase - 1].icon} {PHASES[activePhase - 1].label}
          </p>
        </div>

        {/* ─── Phase Content ─────────────────────────── */}
        <div className="p-4 space-y-4">
          {activePhase === 1 && (
            <Phase1Preparation
              data={formData}
              onUpdate={updateField}
              onStamp={stampNow}
            />
          )}
          {activePhase === 2 && (
            <Phase2FarmLoading
              data={formData}
              onUpdate={updateField}
              onStamp={stampNow}
              onToggleDelay={toggleDelayReason}
            />
          )}
          {activePhase === 3 && (
            <Phase3Transit
              stops={transitStops.filter(s => !s._isDeleted)}
              totalMins={totalTransitStopMins}
              onAdd={addTransitStop}
              onUpdate={updateStop}
              onRemove={removeStop}
            />
          )}
          {activePhase === 4 && (
            <Phase4Depot
              data={formData}
              onUpdate={updateField}
              onStamp={stampNow}
            />
          )}
          {activePhase === 5 && (
            <Phase5Return
              data={formData}
              onUpdate={updateField}
              onStamp={stampNow}
            />
          )}
          {activePhase === 6 && (
            <Phase6Loop
              data={formData}
              onUpdate={updateField}
              onStamp={stampNow}
            />
          )}

          {/* ─── Navigation & Save ────────────────────── */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              disabled={activePhase <= 1}
              onClick={() => setActivePhase(p => p - 1)}
              aria-label="Previous phase"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={isSaving}
              className="flex-1 h-10 text-sm font-semibold"
              variant={saved ? "outline" : "default"}
              aria-label={`Save phase ${activePhase}`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              {saved ? "Saved!" : `Save Phase ${activePhase}`}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-10"
              disabled={activePhase >= 6}
              onClick={() => setActivePhase(p => p + 1)}
              aria-label="Next phase"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Time Input Field ────────────────────────────────────────────────

function TimeField({
  label,
  value,
  onChange,
  onStampNow,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  onStampNow?: () => void;
}) {
  return (
    <div>
      <Label className="text-xs font-medium mb-1.5 block">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="datetime-local"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 text-xs flex-1"
          aria-label={label}
        />
        {onStampNow && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 px-3 text-xs shrink-0"
            onClick={onStampNow}
            aria-label={`Set ${label} to now`}
          >
            <Clock className="w-3.5 h-3.5 mr-1" />
            Now
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Phase 1: Preparation ────────────────────────────────────────────

function Phase1Preparation({
  data,
  onUpdate,
  onStamp,
}: {
  data: CycleTrackerData;
  onUpdate: <K extends keyof CycleTrackerData>(field: K, value: CycleTrackerData[K]) => void;
  onStamp: (field: keyof CycleTrackerData) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Truck Type */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Vehicle & Route
        </p>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Truck Type</Label>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => onUpdate("truck_type", "reefer")}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
                data.truck_type === "reefer"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground"
              )}
              aria-label="Select reefer truck type"
            >
              <Thermometer className="w-3.5 h-3.5" />
              Reefer
            </button>
            <button
              type="button"
              onClick={() => onUpdate("truck_type", "flatbed")}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
                data.truck_type === "flatbed"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground"
              )}
              aria-label="Select flatbed truck type"
            >
              <Truck className="w-3.5 h-3.5" />
              Flatbed
            </button>
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium mb-1.5 block">Route</Label>
          <div className="flex rounded-lg border overflow-hidden">
            {(["rezende", "bulawayo", "other"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onUpdate("route", r)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-semibold transition-colors capitalize",
                  data.route === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground"
                )}
                aria-label={`Select route ${r}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inspection */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Pre-trip Inspection
        </p>
        <p className="text-[10px] text-muted-foreground">Target: Maximum 45 minutes</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Start Time"
            value={data.p1_inspection_start}
            onChange={(v) => onUpdate("p1_inspection_start", v)}
            onStampNow={() => onStamp("p1_inspection_start")}
          />
          <TimeField
            label="Finish Time"
            value={data.p1_inspection_end}
            onChange={(v) => onUpdate("p1_inspection_end", v)}
            onStampNow={() => onStamp("p1_inspection_end")}
          />
        </div>
        {data.p1_inspection_start && data.p1_inspection_end && (
          <DurationBadge label="Inspection duration" start={data.p1_inspection_start} end={data.p1_inspection_end} target={45} />
        )}
      </div>

      {/* Refuelling */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Refuelling
        </p>
        <p className="text-[10px] text-muted-foreground">If required — Target: Maximum 60 minutes</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Start Time"
            value={data.p1_refuel_start}
            onChange={(v) => onUpdate("p1_refuel_start", v)}
            onStampNow={() => onStamp("p1_refuel_start")}
          />
          <TimeField
            label="Finish Time"
            value={data.p1_refuel_end}
            onChange={(v) => onUpdate("p1_refuel_end", v)}
            onStampNow={() => onStamp("p1_refuel_end")}
          />
        </div>
        {data.p1_refuel_start && data.p1_refuel_end && (
          <DurationBadge label="Refuel duration" start={data.p1_refuel_start} end={data.p1_refuel_end} target={60} />
        )}
      </div>

      {/* Reefer Pre-cooling */}
      {data.truck_type === "reefer" && (
        <div className="card-glass p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
            Reefer Pre-cooling
          </p>
          <p className="text-[10px] text-muted-foreground">Minimum 60 minutes before departure</p>
          <TimeField
            label="Reefer Unit Started"
            value={data.p1_reefer_start_time}
            onChange={(v) => onUpdate("p1_reefer_start_time", v)}
            onStampNow={() => onStamp("p1_reefer_start_time")}
          />
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Temperature (°C)</Label>
            <div className="relative">
              <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={data.p1_reefer_start_temp ?? ""}
                onChange={(e) => onUpdate("p1_reefer_start_temp", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g. -2.5"
                className="h-11 pl-9 tabular-nums"
                aria-label="Reefer start temperature"
              />
            </div>
          </div>
        </div>
      )}

      {/* Departure */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Departure from Yard
        </p>
        <p className="text-[10px] text-muted-foreground">Total preparation target: Maximum 3 hours</p>
        <TimeField
          label="Actual Departure Time"
          value={data.p1_yard_departure}
          onChange={(v) => onUpdate("p1_yard_departure", v)}
          onStampNow={() => onStamp("p1_yard_departure")}
        />
      </div>
    </div>
  );
}

// ─── Phase 2: Farm Loading ───────────────────────────────────────────

function Phase2FarmLoading({
  data,
  onUpdate,
  onStamp,
  onToggleDelay,
}: {
  data: CycleTrackerData;
  onUpdate: <K extends keyof CycleTrackerData>(field: K, value: CycleTrackerData[K]) => void;
  onStamp: (field: keyof CycleTrackerData) => void;
  onToggleDelay: (reason: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Farm Arrival & Loading
        </p>
        <p className="text-[10px] text-muted-foreground">
          Target: Arrive 15:00 | Depart 17:00 — Strict 2-hour window
        </p>

        <TimeField
          label="Arrival at Farm Gate"
          value={data.p2_farm_arrival}
          onChange={(v) => onUpdate("p2_farm_arrival", v)}
          onStampNow={() => onStamp("p2_farm_arrival")}
        />

        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Loading Start"
            value={data.p2_loading_start}
            onChange={(v) => onUpdate("p2_loading_start", v)}
            onStampNow={() => onStamp("p2_loading_start")}
          />
          <TimeField
            label="Loading Finish"
            value={data.p2_loading_end}
            onChange={(v) => onUpdate("p2_loading_end", v)}
            onStampNow={() => onStamp("p2_loading_end")}
          />
        </div>

        {data.p2_loading_start && data.p2_loading_end && (
          <DurationBadge label="Loading duration" start={data.p2_loading_start} end={data.p2_loading_end} target={120} />
        )}

        <TimeField
          label="Departure from Farm"
          value={data.p2_farm_departure}
          onChange={(v) => onUpdate("p2_farm_departure", v)}
          onStampNow={() => onStamp("p2_farm_departure")}
        />

        {/* Farm dwell */}
        {data.p2_farm_arrival && data.p2_farm_departure && (
          <DurationBadge label="Farm dwell time" start={data.p2_farm_arrival} end={data.p2_farm_departure} target={120} />
        )}
      </div>

      {/* Delay Reasons */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Delay Reason (if delayed &gt;30 mins)
        </p>
        <div className="flex flex-wrap gap-2">
          {DELAY_REASONS.map((reason) => {
            const selected = (data.p2_delay_reason || []).includes(reason.value);
            return (
              <button
                key={reason.value}
                type="button"
                onClick={() => onToggleDelay(reason.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  selected
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                    : "bg-muted/30 border-transparent text-muted-foreground"
                )}
                aria-label={`Toggle delay reason: ${reason.label}`}
                aria-pressed={selected}
              >
                {selected && <Check className="w-3 h-3 inline mr-1" />}
                {reason.label}
              </button>
            );
          })}
        </div>

        {(data.p2_delay_reason || []).includes("other") && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Other Details</Label>
            <Input
              value={data.p2_delay_other_detail || ""}
              onChange={(e) => onUpdate("p2_delay_other_detail", e.target.value)}
              placeholder="Specify reason..."
              className="h-10 text-xs"
              aria-label="Other delay details"
            />
          </div>
        )}
      </div>

      {/* Supervisor */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Farm Supervisor Sign-off
        </p>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Supervisor Name</Label>
          <Input
            value={data.p2_farm_supervisor || ""}
            onChange={(e) => onUpdate("p2_farm_supervisor", e.target.value)}
            placeholder="Enter supervisor name"
            className="h-11"
            aria-label="Farm supervisor name"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3: In-Transit Log ─────────────────────────────────────────

function Phase3Transit({
  stops,
  totalMins,
  onAdd,
  onUpdate,
  onRemove,
}: {
  stops: TransitStop[];
  totalMins: number;
  onAdd: () => void;
  onUpdate: (index: number, field: keyof TransitStop, value: string | number | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          In-Transit Stop Log
        </p>
        <p className="text-[10px] text-muted-foreground">
          Log every stop/delay &gt;10 minutes during the trip
        </p>

        {stops.length === 0 ? (
          <div className="text-center py-6">
            <Truck className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No transit stops logged</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stops.map((stop, index) => (
              <div key={stop.id || `new-${index}`} className="p-3 rounded-lg border border-border/50 space-y-2 relative">
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"
                  aria-label={`Remove stop ${index + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-medium mb-1 block">Location</Label>
                    <Input
                      value={stop.location}
                      onChange={(e) => onUpdate(index, "location", e.target.value)}
                      placeholder="Location"
                      className="h-9 text-xs"
                      aria-label={`Stop ${index + 1} location`}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-medium mb-1 block">Reason</Label>
                    <Input
                      value={stop.reason}
                      onChange={(e) => onUpdate(index, "reason", e.target.value)}
                      placeholder="Reason for stop"
                      className="h-9 text-xs"
                      aria-label={`Stop ${index + 1} reason`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-medium mb-1 block">Time In</Label>
                    <Input
                      type="datetime-local"
                      value={stop.time_in || ""}
                      onChange={(e) => onUpdate(index, "time_in", e.target.value)}
                      className="h-9 text-xs"
                      aria-label={`Stop ${index + 1} time in`}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-medium mb-1 block">Time Out</Label>
                    <Input
                      type="datetime-local"
                      value={stop.time_out || ""}
                      onChange={(e) => onUpdate(index, "time_out", e.target.value)}
                      className="h-9 text-xs"
                      aria-label={`Stop ${index + 1} time out`}
                    />
                  </div>
                </div>
                {stop.duration_mins != null && (
                  <p className="text-[10px] text-muted-foreground text-right tabular-nums">
                    Duration: {stop.duration_mins} min
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-10 text-xs gap-1"
          onClick={onAdd}
          aria-label="Add transit stop"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Stop
        </Button>

        {stops.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-xs text-blue-400">Total Transit Stop Time</span>
            <span className="text-sm font-bold text-blue-300 tabular-nums">
              {totalMins} min
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 4: Depot Arrival & Offloading ─────────────────────────────

function Phase4Depot({
  data,
  onUpdate,
  onStamp,
}: {
  data: CycleTrackerData;
  onUpdate: <K extends keyof CycleTrackerData>(field: K, value: CycleTrackerData[K]) => void;
  onStamp: (field: keyof CycleTrackerData) => void;
}) {
  const routeInfo = data.route === "rezende"
    ? "Rezende Depot: Arrival 05:00 | Departure 07:00 (2 hr window)"
    : data.route === "bulawayo"
    ? "Bulawayo Depot: Arrival 08:00 | Departure 11:00 (3 hr window)"
    : "Log depot arrival and offloading times";

  return (
    <div className="space-y-4">
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Depot Arrival & Offloading
        </p>
        <p className="text-[10px] text-muted-foreground">{routeInfo}</p>

        <TimeField
          label="Arrival at Depot Gate"
          value={data.p4_depot_arrival}
          onChange={(v) => onUpdate("p4_depot_arrival", v)}
          onStampNow={() => onStamp("p4_depot_arrival")}
        />

        {data.truck_type === "reefer" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Reefer Temperature on Arrival (°C)</Label>
            <div className="relative">
              <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={data.p4_reefer_arrival_temp ?? ""}
                onChange={(e) => onUpdate("p4_reefer_arrival_temp", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g. 2.0"
                className="h-11 pl-9 tabular-nums"
                aria-label="Reefer arrival temperature"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Offloading Start"
            value={data.p4_offloading_start}
            onChange={(v) => onUpdate("p4_offloading_start", v)}
            onStampNow={() => onStamp("p4_offloading_start")}
          />
          <TimeField
            label="Offloading Finish"
            value={data.p4_offloading_end}
            onChange={(v) => onUpdate("p4_offloading_end", v)}
            onStampNow={() => onStamp("p4_offloading_end")}
          />
        </div>

        {data.p4_offloading_start && data.p4_offloading_end && (
          <DurationBadge label="Offloading duration" start={data.p4_offloading_start} end={data.p4_offloading_end} />
        )}

        {/* Depot dwell */}
        {data.p4_depot_arrival && data.p4_offloading_end && (
          <DurationBadge label="Depot dwell time" start={data.p4_depot_arrival} end={data.p4_offloading_end} />
        )}
      </div>
    </div>
  );
}

// ─── Phase 5: Return Leg (Packaging Return) ──────────────────────────

function Phase5Return({
  data,
  onUpdate,
  onStamp,
}: {
  data: CycleTrackerData;
  onUpdate: <K extends keyof CycleTrackerData>(field: K, value: CycleTrackerData[K]) => void;
  onStamp: (field: keyof CycleTrackerData) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Packaging */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Packaging Return
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Crates</Label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={data.p5_crates_count || ""}
                onChange={(e) => onUpdate("p5_crates_count", e.target.value ? parseInt(e.target.value) : 0)}
                placeholder="0"
                className="h-11 pl-9 tabular-nums"
                aria-label="Number of crates returned"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Bins</Label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={data.p5_bins_count || ""}
                onChange={(e) => onUpdate("p5_bins_count", e.target.value ? parseInt(e.target.value) : 0)}
                placeholder="0"
                className="h-11 pl-9 tabular-nums"
                aria-label="Number of bins returned"
              />
            </div>
          </div>
        </div>

        {/* Damaged packaging */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onUpdate("p5_damaged_packaging", !data.p5_damaged_packaging)}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
              data.p5_damaged_packaging ? "bg-amber-500 border-amber-500" : "border-muted-foreground/40"
            )}
            aria-label="Toggle damaged packaging"
            aria-pressed={data.p5_damaged_packaging}
          >
            {data.p5_damaged_packaging && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className="text-xs text-muted-foreground">Damaged packaging noted?</span>
        </div>

        {data.p5_damaged_packaging && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Damage Details</Label>
            <Textarea
              value={data.p5_damaged_details || ""}
              onChange={(e) => onUpdate("p5_damaged_details", e.target.value)}
              placeholder="Describe damage..."
              rows={2}
              className="text-xs"
              aria-label="Damage details"
            />
          </div>
        )}
      </div>

      {/* Departure & Supervisor */}
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Departure from Depot
        </p>
        <TimeField
          label="Departure Time"
          value={data.p5_depot_departure}
          onChange={(v) => onUpdate("p5_depot_departure", v)}
          onStampNow={() => onStamp("p5_depot_departure")}
        />
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Depot Supervisor Name</Label>
          <Input
            value={data.p5_depot_supervisor || ""}
            onChange={(e) => onUpdate("p5_depot_supervisor", e.target.value)}
            placeholder="Enter supervisor name"
            className="h-11"
            aria-label="Depot supervisor name"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Phase 6: Completing the Loop ────────────────────────────────────

function Phase6Loop({
  data,
  onUpdate,
  onStamp,
}: {
  data: CycleTrackerData;
  onUpdate: <K extends keyof CycleTrackerData>(field: K, value: CycleTrackerData[K]) => void;
  onStamp: (field: keyof CycleTrackerData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Return to Yard / Farm
        </p>

        <TimeField
          label="Arrival at Farm / Transport Yard"
          value={data.p6_yard_arrival}
          onChange={(v) => onUpdate("p6_yard_arrival", v)}
          onStampNow={() => onStamp("p6_yard_arrival")}
        />

        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Unloading Start"
            value={data.p6_unloading_start}
            onChange={(v) => onUpdate("p6_unloading_start", v)}
            onStampNow={() => onStamp("p6_unloading_start")}
          />
          <TimeField
            label="Unloading Finish"
            value={data.p6_unloading_end}
            onChange={(v) => onUpdate("p6_unloading_end", v)}
            onStampNow={() => onStamp("p6_unloading_end")}
          />
        </div>

        {data.p6_unloading_start && data.p6_unloading_end && (
          <DurationBadge label="Unloading duration" start={data.p6_unloading_start} end={data.p6_unloading_end} />
        )}
      </div>

      <div className="card-glass p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
          Road Conditions & Comments
        </p>
        <Textarea
          value={data.p6_road_comments || ""}
          onChange={(e) => onUpdate("p6_road_comments", e.target.value)}
          placeholder="Comments on road conditions or other issues..."
          rows={3}
          className="text-xs"
          aria-label="Road conditions comments"
        />
      </div>

      {/* Cycle Summary (auto-computed) */}
      <CycleSummaryCard data={data} />
    </div>
  );
}

// ─── Cycle Summary Card ──────────────────────────────────────────────

function CycleSummaryCard({ data }: { data: CycleTrackerData }) {
  const yardToFarm = calcDuration(data.p1_yard_departure, data.p2_farm_arrival);
  const farmDwell = calcDuration(data.p2_farm_arrival, data.p2_farm_departure);
  const farmToDepot = calcDuration(data.p2_farm_departure, data.p4_depot_arrival);
  const depotDwell = calcDuration(data.p4_depot_arrival, data.p5_depot_departure);
  const returnLeg = calcDuration(data.p5_depot_departure, data.p6_yard_arrival);
  const totalCycle = calcDuration(data.p1_yard_departure, data.p6_yard_arrival);

  return (
    <div className="card-glass p-4 space-y-3 border border-primary/20">
      <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
        Total Cycle Summary
      </p>
      <div className="space-y-1.5">
        <SummaryRow label="Transport Yard → Farm" value={yardToFarm} />
        <SummaryRow label="Farm Dwell Time" value={farmDwell} />
        <SummaryRow label="Farm → Depot (Transit)" value={farmToDepot} />
        <SummaryRow label="Depot Dwell Time" value={depotDwell} />
        <SummaryRow label="Return Leg (Depot → Yard)" value={returnLeg} />
        <div className="border-t pt-1.5 mt-1.5">
          <SummaryRow label="Total 360° Cycle Time" value={totalCycle} highlight />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-xs", highlight ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className={cn("text-xs tabular-nums", highlight ? "font-bold text-primary" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

// ─── Duration Badge ──────────────────────────────────────────────────

function DurationBadge({
  label,
  start,
  end,
  target,
}: {
  label: string;
  start: string;
  end: string;
  target?: number; // target minutes
}) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const mins = Math.round(ms / 60000);
  const overTarget = target ? mins > target : false;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-lg border",
        overTarget
          ? "bg-amber-500/10 border-amber-500/20"
          : "bg-emerald-500/10 border-emerald-500/20"
      )}
    >
      <span className={cn("text-xs", overTarget ? "text-amber-400" : "text-emerald-400")}>
        {label}
      </span>
      <span className={cn("text-sm font-bold tabular-nums", overTarget ? "text-amber-300" : "text-emerald-400")}>
        {mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`}
        {target && <span className="text-[10px] font-normal ml-1 opacity-70">(target: {target}m)</span>}
      </span>
    </div>
  );
}