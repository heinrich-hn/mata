import { MobileShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { BottomSheetSelect } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useDieselRealtimeSync, useVehicleAssignmentSubscription } from "@/hooks/use-realtime";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle,
  CheckCircle2,
  Clock,
  Droplet,
  Fuel,
  Gauge,
  Image as ImageIcon,
  Info,
  MapPin,
  Plus,
  Snowflake,
  Trash2,
  Truck,
} from "lucide-react";
import { useCallback, useMemo, useState, lazy, Suspense } from "react";

// Lazy load heavy components
const SearchableSelectLazy = lazy(() => import("@/components/ui/select").then(mod => ({ default: mod.SearchableSelect })));

// Types
type ViewMode = "list" | "add";
type FuelTarget = "truck" | "reefer";

interface Vehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make?: string;
  model?: string;
  vehicle_type?: string | null;
}

// Consumption threshold - entries below this km/L are flagged for debriefing
const CONSUMPTION_THRESHOLD_KM_PER_LITRE = 2.0;

interface DieselEntry {
  id: string;
  fleet_number: string;
  date: string;
  fuel_station: string;
  litres_filled: number;
  total_cost: number;
  cost_per_litre: number | null;
  km_reading: number;
  previous_km_reading: number | null;
  distance_travelled: number | null;
  km_per_litre: number | null;
  driver_name: string | null;
  notes: string | null;
  currency: string | null;
  created_at: string | null;
  source?: "mobile" | "dashboard";
  requires_debriefing?: boolean;
  debriefed?: boolean;
}

interface ReeferDieselEntry {
  id: string;
  reefer_unit: string;
  date: string;
  fuel_station: string;
  litres_filled: number;
  total_cost: number;
  cost_per_litre: number | null;
  operating_hours: number | null;
  previous_operating_hours: number | null;
  hours_operated: number | null;
  litres_per_hour: number | null;
  driver_name: string | null;
  notes: string | null;
  currency: string | null;
  linked_horse: string | null;
  created_at: string | null;
}

interface FuelStation {
  id: string;
  name: string;
  location?: string;
  price_per_litre?: number;
  currency?: string;
  is_active: boolean;
}

interface StationOption {
  value: string;
  label: string;
  description?: string;
}

interface MonthOption {
  value: string;
  label: string;
  month: number;
  year: number;
}

const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];
const TRAILER_TYPES = ['reefer', 'trailer', 'interlink'];

// Helper to get month options (current + past 11 months) - memoized outside component
const MONTH_OPTIONS: MonthOption[] = (() => {
  const options: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      month: date.getMonth(),
      year: date.getFullYear(),
    });
  }
  return options;
})();

// Sub-components for better code splitting
const SuccessView = () => (
  <MobileShell>
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-5">
      <div className="w-20 h-20 rounded-full bg-success/10 dark:bg-success/20 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-10 h-10 text-success" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-semibold">Entry Saved!</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Diesel record synced successfully
      </p>
    </div>
  </MobileShell>
);

const LoadingSpinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const EmptyState = () => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <Droplet className="w-5 h-5 text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">No entries found.</p>
      <p className="text-xs text-muted-foreground mt-1">
        Tap &quot;Add&quot; to record your first diesel entry
      </p>
    </CardContent>
  </Card>
);

const FlaggedEntriesAlert = ({ count }: { count: number }) => (
  <Card className="border-warning bg-warning/5 dark:bg-warning/10">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-warning/10 dark:bg-warning/20 rounded-full">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-warning">
            Debriefing Required
          </p>
          <p className="text-sm text-warning/80 mt-1">
            {count} transaction{count > 1 ? 's' : ''} with abnormal consumption detected.
            Please visit the office for debriefing.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Photo upload section component
const PhotoUploadSection = ({
  type,
  files,
  previews,
  maxFiles,
  onSelect,
  onRemove,
}: {
  type: "slip" | "pump";
  files: File[];
  previews: string[];
  maxFiles: number;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        {type === "slip" ? (
          <Camera className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Fuel className="w-4 h-4 text-muted-foreground" />
        )}
        {type === "slip" ? "Diesel Slip Photo" : "Pump Photo"} ({files.length}/{maxFiles})
      </Label>
      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer" aria-label="Take photo with camera">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onSelect}
            className="hidden"
            disabled={files.length >= maxFiles}
          />
          <div className={cn(
            "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
            files.length >= maxFiles
              ? "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
              : "border-primary/40 text-primary hover:bg-primary/5 active:scale-[0.98]"
          )}>
            <Camera className="w-4 h-4" />
            <span className="text-xs font-medium">Camera</span>
          </div>
        </label>
        <label className="flex-1 cursor-pointer" aria-label="Choose from gallery">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onSelect}
            className="hidden"
            disabled={files.length >= maxFiles}
          />
          <div className={cn(
            "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
            files.length >= maxFiles
              ? "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
              : "border-primary/40 text-primary hover:bg-primary/5 active:scale-[0.98]"
          )}>
            <ImageIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Gallery</span>
          </div>
        </label>
      </div>
      {files.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {files.map((file, idx) => (
            <div key={idx} className="relative group">
              {previews[idx] ? (
                <img src={previews[idx]} alt={file.name} className="w-16 h-16 rounded-lg object-cover border border-border/50" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                aria-label="Remove photo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Diesel entry card component
const DieselEntryCard = ({ entry }: { entry: DieselEntry }) => {
  const requiresDebriefing = useMemo(() =>
    entry.requires_debriefing && !entry.debriefed,
    [entry.requires_debriefing, entry.debriefed]
  );

  return (
    <Card className={requiresDebriefing ? "border-warning bg-warning/5 dark:bg-warning/10" : ""}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {formatDate(entry.date)}
              {entry.source === "dashboard" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 dark:bg-info/20 text-info">
                  Dashboard
                </span>
              )}
              {requiresDebriefing && (
                <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Debriefing Required
                </Badge>
              )}
              {entry.debriefed && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-success/10 text-success dark:bg-success/20">
                  <CheckCircle className="w-3 h-3" />
                  Debriefed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="w-3.5 h-3.5" />
              {formatNumber(entry.km_reading)} km
              {entry.km_per_litre && (
                <span className={requiresDebriefing ? "text-warning font-medium" : ""}>
                  • {entry.km_per_litre.toFixed(2)} km/L
                </span>
              )}
            </div>
            {entry.fleet_number && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="w-3.5 h-3.5" />
                {entry.fleet_number}
              </div>
            )}
            {entry.fuel_station && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {entry.fuel_station}
              </div>
            )}
            {requiresDebriefing && (
              <p className="text-xs text-warning mt-2 font-medium">
                ⚠ Please visit the office for debriefing
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-base font-bold">{formatNumber(entry.litres_filled)} L</p>
            {entry.distance_travelled && (
              <p className="text-xs text-muted-foreground">
                {formatNumber(entry.distance_travelled)} km
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Reefer/Trailer diesel entry card
const ReeferEntryCard = ({ entry }: { entry: ReeferDieselEntry }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            {formatDate(entry.date)}
            <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <Snowflake className="w-3 h-3" />
              Reefer
            </Badge>
          </div>
          {entry.operating_hours != null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {formatNumber(entry.operating_hours)} hrs
              {entry.litres_per_hour != null && (
                <span>• {entry.litres_per_hour.toFixed(2)} L/hr</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Snowflake className="w-3.5 h-3.5" />
            {entry.reefer_unit}
          </div>
          {entry.fuel_station && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {entry.fuel_station}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-base font-bold">{formatNumber(entry.litres_filled)} L</p>
          {entry.hours_operated != null && entry.hours_operated > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatNumber(entry.hours_operated)} hrs
            </p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Main Component
export default function DieselPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showSuccess, setShowSuccess] = useState(false);
  const [fuelTarget, setFuelTarget] = useState<FuelTarget>("truck");
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Month selector state - auto-load current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => MONTH_OPTIONS[0].value);

  // Parse selected month to get date range
  const selectedMonthData = useMemo(() =>
    MONTH_OPTIONS.find(m => m.value === selectedMonth) || MONTH_OPTIONS[0],
    [selectedMonth]
  );

  const dateRange = useMemo(() => ({
    from: new Date(selectedMonthData.year, selectedMonthData.month, 1).toISOString().split("T")[0],
    to: new Date(selectedMonthData.year, selectedMonthData.month + 1, 0).toISOString().split("T")[0],
  }), [selectedMonthData]);

  const monthName = useMemo(() =>
    new Date(selectedMonthData.year, selectedMonthData.month).toLocaleString("default", { month: "long" }),
    [selectedMonthData]
  );

  // Real-time subscriptions - only if user exists
  // Diesel sync moved below vehicle query to pass fleet_number filter
  useVehicleAssignmentSubscription(user?.id);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    odometer_reading: "",
    hour_reading: "",
    litres: "",
    station: "",
    notes: "",
  });

  // Photo upload state
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [slipPreviews, setSlipPreviews] = useState<string[]>([]);
  const [pumpFiles, setPumpFiles] = useState<File[]>([]);
  const [pumpPreviews, setPumpPreviews] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // Handle file selection for photos
  const handlePhotoSelect = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    target: "slip" | "pump"
  ): void => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentFiles = target === "slip" ? slipFiles : pumpFiles;
    const maxFiles = target === "slip" ? 3 : 2;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach((file: File) => {
      if (currentFiles.length + newFiles.length >= maxFiles) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive"
        });
        return;
      }
      newFiles.push(file);
      if (file.type.startsWith("image/")) {
        newPreviews.push(URL.createObjectURL(file));
      } else {
        newPreviews.push("");
      }
    });

    if (target === "slip") {
      setSlipFiles((prev: File[]) => [...prev, ...newFiles]);
      setSlipPreviews((prev: string[]) => [...prev, ...newPreviews]);
    } else {
      setPumpFiles((prev: File[]) => [...prev, ...newFiles]);
      setPumpPreviews((prev: string[]) => [...prev, ...newPreviews]);
    }
    e.target.value = "";
  }, [slipFiles, pumpFiles, toast]);

  const removePhoto = useCallback((index: number, target: "slip" | "pump"): void => {
    if (target === "slip") {
      if (slipPreviews[index]) URL.revokeObjectURL(slipPreviews[index]);
      setSlipFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
      setSlipPreviews((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
    } else {
      if (pumpPreviews[index]) URL.revokeObjectURL(pumpPreviews[index]);
      setPumpFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
      setPumpPreviews((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
    }
  }, [slipPreviews, pumpPreviews]);

  // Upload photos to Supabase Storage - FIXED with type assertion
  const uploadDieselPhotos = useCallback(async (entryId: string): Promise<void> => {
    const allUploads = [
      ...slipFiles.map((f: File, i: number) => ({ file: f, type: "slip" as const, idx: i })),
      ...pumpFiles.map((f: File, i: number) => ({ file: f, type: "pump" as const, idx: i })),
    ];
    if (allUploads.length === 0) return;

    setIsUploadingPhotos(true);
    let failedCount = 0;
    try {
      for (const item of allUploads) {
        const fileExt = item.file.name.split(".").pop();
        const fileName = `${entryId}_${item.type}_${Date.now()}_${item.idx}.${fileExt}`;
        const filePath = `diesel-slips/${entryId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("trip-documents")
          .upload(filePath, item.file);

        if (uploadError) {
          console.error(`Failed to upload ${item.type} photo:`, uploadError.message);
          failedCount++;
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("trip-documents")
          .getPublicUrl(filePath);

        // FIX: Add type assertion to bypass TypeScript strict checking
        await supabase
          .from("cost_attachments")
          .insert({
            cost_id: entryId,
            filename: item.file.name,
            file_path: filePath,
            file_url: publicUrl,
            file_size: item.file.size,
            file_type: item.file.type,
            uploaded_by: user?.email || "Driver",
          } as never);
      }
    } finally {
      setIsUploadingPhotos(false);
      if (failedCount > 0) {
        toast({
          title: "Photo Upload Issue",
          description: `${failedCount} of ${allUploads.length} photo${allUploads.length > 1 ? "s" : ""} failed to upload. The diesel entry was saved.`,
          variant: "destructive",
        });
      }
    }
  }, [slipFiles, pumpFiles, supabase, user?.email, toast]);

  // Query 1: All active vehicle assignments — split into truck + reefer client-side
  const { data: vehicleAssignments, isLoading: _isLoadingVehicle } = useQuery<{ truck: Vehicle | null; reefer: Vehicle | null }>({
    queryKey: ["assigned-vehicles", user?.id],
    queryFn: async () => {
      if (!user?.id) return { truck: null, reefer: null };

      const { data, error } = await supabase
        .from("driver_vehicle_assignments")
        .select(`
          vehicle_id,
          vehicles!inner (
            id,
            fleet_number,
            registration_number,
            make,
            model,
            vehicle_type
          )
        `)
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return { truck: null, reefer: null };

      type AssignmentData = {
        vehicle_id: string;
        vehicles: Vehicle;
      };

      const rows = (data as unknown as AssignmentData[]);
      const truckRow = rows.find(r => !r.vehicles.vehicle_type || TRUCK_TYPES.includes(r.vehicles.vehicle_type));
      const reeferRow = rows.find(r => r.vehicles.vehicle_type && TRAILER_TYPES.includes(r.vehicles.vehicle_type));

      return {
        truck: truckRow?.vehicles || null,
        reefer: reeferRow?.vehicles || null,
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const assignedVehicle = vehicleAssignments?.truck ?? null;
  const assignedReefer = vehicleAssignments?.reefer ?? null;

  // Diesel realtime sync — needs fleet_number so placed after vehicle query
  useDieselRealtimeSync(user?.id, assignedVehicle?.fleet_number);

  // Query 2: Diesel records - ONLY when user selects a month
  const {
    data: allDieselRecords = [],
    isLoading: isLoadingRecords,
    refetch: refetchRecords
  } = useQuery<DieselEntry[]>({
    queryKey: ["diesel-records", assignedVehicle?.fleet_number, selectedMonth],
    queryFn: async () => {
      if (!assignedVehicle?.fleet_number) return [];

      const { data, error } = await supabase
        .from("diesel_records")
        .select("id, date, litres_filled, total_cost, cost_per_litre, km_reading, previous_km_reading, distance_travelled, km_per_litre, fuel_station, fleet_number, driver_name, currency, notes, created_at")
        .eq("fleet_number", assignedVehicle.fleet_number)
        .gte("date", dateRange.from)
        .lte("date", dateRange.to)
        .order("date", { ascending: false })
        .limit(50); // Add limit for performance

      if (error) throw error;
      return (data || []) as DieselEntry[];
    },
    enabled: !!assignedVehicle?.fleet_number,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Query 2b: Reefer diesel records
  const {
    data: allReeferRecords = [],
    isLoading: _isLoadingReeferRecords,
    refetch: refetchReeferRecords
  } = useQuery<ReeferDieselEntry[]>({
    queryKey: ["reefer-diesel-records", assignedReefer?.fleet_number, selectedMonth],
    queryFn: async () => {
      if (!assignedReefer?.fleet_number) return [];

      const { data, error } = await supabase
        .from("reefer_diesel_records")
        .select("id, date, litres_filled, total_cost, cost_per_litre, operating_hours, previous_operating_hours, hours_operated, litres_per_hour, fuel_station, reefer_unit, driver_name, currency, notes, linked_horse, created_at")
        .eq("reefer_unit", assignedReefer.fleet_number)
        .gte("date", dateRange.from)
        .lte("date", dateRange.to)
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ReeferDieselEntry[];
    },
    enabled: !!assignedReefer?.fleet_number,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Query 3: Fuel stations - cached long time
  const { data: savedStations = [] } = useQuery<FuelStation[]>({
    queryKey: ["fuel-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_stations")
        .select("id, name, location, price_per_litre, currency, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) return [];
      return (data || []) as FuelStation[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,
  });

  // Query 4: Historical stations - cached long time
  const { data: historicalStations = [] } = useQuery<string[]>({
    queryKey: ["historical-fuel-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diesel_records")
        .select("fuel_station")
        .not("fuel_station", "is", null)
        .order("fuel_station");
      if (error) return [];
      const unique = [...new Set((data || []).map((d: { fuel_station: string }) => d.fuel_station).filter(Boolean))];
      return unique as string[];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Memoized station options
  const stationOptions = useMemo<StationOption[]>(() => {
    const savedNames = new Set(savedStations.map((s: FuelStation) => s.name.toLowerCase()));
    const fromDb: StationOption[] = savedStations.map((s: FuelStation) => ({
      value: s.name,
      label: s.name,
      description: s.location
        ? `${s.location}${s.price_per_litre ? ` • $${s.price_per_litre}/L` : ""}`
        : s.price_per_litre
          ? `$${s.price_per_litre}/L`
          : undefined,
    }));
    const fromHistory: StationOption[] = historicalStations
      .filter((name: string) => !savedNames.has(name.toLowerCase()))
      .map((name: string) => ({ value: name, label: name, description: undefined }));
    return [...fromDb, ...fromHistory];
  }, [savedStations, historicalStations]);

  // Memoized selected station price
  const selectedStationPrice = useMemo(() => {
    if (!formData.station) return null;
    const match = savedStations.find(
      (s: FuelStation) => s.name.toLowerCase() === formData.station.toLowerCase()
    );
    return match?.price_per_litre ?? null;
  }, [formData.station, savedStations]);

  // Memoized entries with flags
  const entries = useMemo(() =>
    allDieselRecords.map((record: DieselEntry) => {
      const kmPerLitre = record.km_per_litre;
      const requiresDebriefing = kmPerLitre !== null && kmPerLitre !== undefined && kmPerLitre > 0 && kmPerLitre < CONSUMPTION_THRESHOLD_KM_PER_LITRE;

      return {
        ...record,
        requires_debriefing: requiresDebriefing,
        debriefed: false,
      };
    }),
    [allDieselRecords]
  );

  // Memoized stats (truck only — km/L)
  const stats = useMemo(() => {
    const recordsWithDistance = entries.filter((r: DieselEntry) => r.distance_travelled && r.litres_filled);
    const totalKmTravelled = recordsWithDistance.reduce((sum: number, r: DieselEntry) => sum + (r.distance_travelled || 0), 0);
    const totalLitresForCalc = recordsWithDistance.reduce((sum: number, r: DieselEntry) => sum + (r.litres_filled || 0), 0);
    const avgKmPerLitre = totalLitresForCalc > 0 ? totalKmTravelled / totalLitresForCalc : 0;
    const totalLitres = entries.reduce((sum: number, e: DieselEntry) => sum + (e.litres_filled || 0), 0);
    const flaggedEntries = entries.filter((e: DieselEntry) => e.requires_debriefing && !e.debriefed);

    return {
      totalLitres,
      avgKmPerLitre,
      totalKmTravelled,
      flaggedCount: flaggedEntries.length,
      hasFlagged: flaggedEntries.length > 0,
    };
  }, [entries]);

  // Memoized reefer stats (L/hr — separate from vehicle km/L)
  const reeferStats = useMemo(() => {
    if (allReeferRecords.length === 0) return null;
    const recordsWithHours = allReeferRecords.filter((r: ReeferDieselEntry) => r.hours_operated && r.hours_operated > 0 && r.litres_filled);
    const totalHours = recordsWithHours.reduce((sum: number, r: ReeferDieselEntry) => sum + (r.hours_operated || 0), 0);
    const totalLitresForCalc = recordsWithHours.reduce((sum: number, r: ReeferDieselEntry) => sum + (r.litres_filled || 0), 0);
    const avgLitresPerHour = totalHours > 0 ? totalLitresForCalc / totalHours : 0;
    const totalLitres = allReeferRecords.reduce((sum: number, e: ReeferDieselEntry) => sum + (e.litres_filled || 0), 0);

    return {
      totalLitres,
      avgLitresPerHour,
      totalHours,
    };
  }, [allReeferRecords]);

  // Add diesel entry mutation - FIXED with type assertion
  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!assignedVehicle) throw new Error("No vehicle assigned. Please contact your admin.");

      const litresFilled = parseFloat(data.litres);
      const stationMatch = savedStations.find(
        (s: FuelStation) => s.name.toLowerCase() === (data.station || "").toLowerCase()
      );
      const costPerLitre = stationMatch?.price_per_litre ?? null;
      const totalCost = costPerLitre != null ? litresFilled * costPerLitre : 0;

      const insertData = {
        fleet_number: assignedVehicle.fleet_number,
        date: data.date,
        fuel_station: data.station || "Unknown",
        km_reading: parseFloat(data.odometer_reading),
        litres_filled: litresFilled,
        total_cost: totalCost,
        cost_per_litre: costPerLitre,
        driver_name: profile?.name || profile?.full_name || user.email?.split("@")[0] || "Driver",
        notes: data.notes || null,
        currency: stationMatch?.currency || "USD",
      };

      // FIX: Add type assertion to bypass TypeScript strict checking
      const { data: result, error } = await supabase
        .from("diesel_records")
        .insert(insertData as never)
        .select("id")
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (data: { id: string }) => {
      if (data?.id && (slipFiles.length > 0 || pumpFiles.length > 0)) {
        try {
          await uploadDieselPhotos(data.id);
        } catch {
          toast({
            title: "Photos failed",
            description: "Diesel entry saved but photo upload failed",
            variant: "destructive"
          });
        }
      }

      // Only invalidate current month's data
      queryClient.invalidateQueries({
        queryKey: ["diesel-records", assignedVehicle?.fleet_number, selectedMonth]
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        setViewMode("list");
      }, 1500);

      const photoCount = slipFiles.length + pumpFiles.length;
      toast({
        title: "Entry saved",
        description: photoCount > 0
          ? `Diesel entry with ${photoCount} photo(s) recorded and synced`
          : "Diesel entry recorded and synced to dashboard",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add reefer diesel entry mutation
  const addReeferMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!assignedReefer) throw new Error("No reefer/trailer assigned. Please contact your admin.");

      const litresFilled = parseFloat(data.litres);
      const stationMatch = savedStations.find(
        (s: FuelStation) => s.name.toLowerCase() === (data.station || "").toLowerCase()
      );
      const costPerLitre = stationMatch?.price_per_litre ?? null;
      const totalCost = costPerLitre != null ? litresFilled * costPerLitre : 0;

      const insertData = {
        reefer_unit: assignedReefer.fleet_number,
        date: data.date,
        fuel_station: data.station || "Unknown",
        operating_hours: data.hour_reading ? parseFloat(data.hour_reading) : null,
        litres_filled: litresFilled,
        total_cost: totalCost,
        cost_per_litre: costPerLitre,
        driver_name: profile?.name || profile?.full_name || user.email?.split("@")[0] || "Driver",
        notes: data.notes || null,
        currency: stationMatch?.currency || "USD",
        linked_horse: assignedVehicle?.fleet_number || null,
        linked_horse_id: assignedVehicle?.id || null,
      };

      const { data: result, error } = await supabase
        .from("reefer_diesel_records")
        .insert(insertData as never)
        .select("id")
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (data: { id: string }) => {
      if (data?.id && (slipFiles.length > 0 || pumpFiles.length > 0)) {
        try {
          await uploadDieselPhotos(data.id);
        } catch {
          toast({
            title: "Photos failed",
            description: "Reefer diesel entry saved but photo upload failed",
            variant: "destructive"
          });
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["reefer-diesel-records", assignedReefer?.fleet_number, selectedMonth]
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        setFuelTarget("truck");
        setViewMode("list");
      }, 1500);

      toast({
        title: "Entry saved",
        description: "Reefer diesel entry recorded and synced to dashboard",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = useCallback((): void => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      odometer_reading: "",
      hour_reading: "",
      litres: "",
      station: "",
      notes: "",
    });
    slipPreviews.forEach((p: string) => p && URL.revokeObjectURL(p));
    pumpPreviews.forEach((p: string) => p && URL.revokeObjectURL(p));
    setSlipFiles([]);
    setSlipPreviews([]);
    setPumpFiles([]);
    setPumpPreviews([]);
  }, [slipPreviews, pumpPreviews]);

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();
    if (fuelTarget === "reefer") {
      addReeferMutation.mutate(formData);
    } else {
      addMutation.mutate(formData);
    }
  }, [formData, addMutation, addReeferMutation, fuelTarget]);

  const handleMonthChange = useCallback((value: string) => {
    setSelectedMonth(value);
  }, []);

  const handleRefresh = useCallback(async (): Promise<void> => {
    const promises: Promise<unknown>[] = [];
    if (assignedVehicle?.fleet_number) promises.push(refetchRecords());
    if (assignedReefer?.fleet_number) promises.push(refetchReeferRecords());
    await Promise.all(promises);
  }, [assignedVehicle?.fleet_number, assignedReefer?.fleet_number, refetchRecords, refetchReeferRecords]);

  // Success view
  if (showSuccess) {
    return <SuccessView />;
  }

  // Add view
  if (viewMode === "add") {
    return (
      <MobileShell>
        <div className="p-5 space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setViewMode("list")}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <h1 className="text-lg font-semibold">New Diesel Entry</h1>
          </div>

          {/* Truck / Reefer toggle — only shown if a reefer is assigned */}
          {assignedReefer && (
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
              <button
                type="button"
                onClick={() => setFuelTarget("truck")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
                  fuelTarget === "truck"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Truck className="w-4 h-4" strokeWidth={1.5} />
                Truck
              </button>
              <button
                type="button"
                onClick={() => setFuelTarget("reefer")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
                  fuelTarget === "reefer"
                    ? "bg-sky-100 dark:bg-sky-900/40 shadow-sm text-sky-700 dark:text-sky-300"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Snowflake className="w-4 h-4" strokeWidth={1.5} />
                Reefer
              </button>
            </div>
          )}

          {/* Vehicle info card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  fuelTarget === "reefer" ? "bg-sky-100 dark:bg-sky-900/30" : "bg-primary/10"
                )}>
                  {fuelTarget === "reefer" ? (
                    <Snowflake className="w-5 h-5 text-sky-600" strokeWidth={1.5} />
                  ) : (
                    <Truck className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  )}
                </div>
                {fuelTarget === "reefer" ? (
                  assignedReefer ? (
                    <div>
                      <p className="font-semibold text-sm">{assignedReefer.fleet_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignedReefer.make} {assignedReefer.model} • {assignedReefer.registration_number}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-warning">No reefer assigned</p>
                      <p className="text-xs text-muted-foreground">Contact your admin to assign a reefer/trailer</p>
                    </div>
                  )
                ) : (
                  assignedVehicle ? (
                    <div>
                      <p className="font-semibold text-sm">{assignedVehicle.fleet_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignedVehicle.make} {assignedVehicle.model} • {assignedVehicle.registration_number}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-warning">No vehicle assigned</p>
                      <p className="text-xs text-muted-foreground">Contact your admin to assign a vehicle</p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="h-12"
              />
            </div>

            {fuelTarget === "reefer" ? (
              <div className="space-y-2">
                <Label htmlFor="hours" className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Hour Meter Reading
                </Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Enter current hour meter"
                  value={formData.hour_reading}
                  onChange={(e) => setFormData({ ...formData, hour_reading: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="odometer" className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-muted-foreground" />
                  Odometer Reading (km)
                </Label>
                <Input
                  id="odometer"
                  type="number"
                  inputMode="numeric"
                  placeholder="Enter current km"
                  value={formData.odometer_reading}
                  onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="litres" className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-muted-foreground" />
                Litres Filled
              </Label>
              <Input
                id="litres"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Enter litres"
                value={formData.litres}
                onChange={(e) => setFormData({ ...formData, litres: e.target.value })}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Filling Station
              </Label>
              <Suspense fallback={<div className="h-11 bg-muted rounded animate-pulse" />}>
                <SearchableSelectLazy
                  value={formData.station}
                  onValueChange={(value: string) => setFormData({ ...formData, station: value })}
                  options={stationOptions}
                  placeholder="Search filling station..."
                  searchPlaceholder="Search by name or location..."
                  label="Select Filling Station"
                />
              </Suspense>
              {formData.station && selectedStationPrice != null ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/5 dark:bg-success/10 border border-success/20 dark:border-success/30">
                  <CheckCircle className="w-4 h-4 text-success shrink-0" />
                  <p className="text-xs text-success">
                    Price: <span className="font-semibold">${formatNumber(selectedStationPrice)}/L</span>
                    {formData.litres && (
                      <> — Total: <span className="font-semibold">${formatNumber(parseFloat(formData.litres) * selectedStationPrice)}</span></>
                    )}
                  </p>
                </div>
              ) : formData.station ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/5 dark:bg-warning/10 border border-warning/20 dark:border-warning/30">
                  <Info className="w-4 h-4 text-warning shrink-0" />
                  <p className="text-xs text-warning">
                    Cost per litre not configured for this station — will be added on the dashboard
                  </p>
                </div>
              ) : null}
            </div>

            <PhotoUploadSection
              type="slip"
              files={slipFiles}
              previews={slipPreviews}
              maxFiles={3}
              onSelect={(e) => handlePhotoSelect(e, "slip")}
              onRemove={(idx) => removePhoto(idx, "slip")}
            />

            <PhotoUploadSection
              type="pump"
              files={pumpFiles}
              previews={pumpPreviews}
              maxFiles={2}
              onSelect={(e) => handlePhotoSelect(e, "pump")}
              onRemove={(idx) => removePhoto(idx, "pump")}
            />

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                type="text"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              className={cn("w-full h-12 font-semibold", fuelTarget === "reefer" && "bg-sky-600 hover:bg-sky-700")}
              disabled={
                (fuelTarget === "reefer" ? addReeferMutation.isPending : addMutation.isPending)
                || isUploadingPhotos
                || (fuelTarget === "reefer" ? !assignedReefer : !assignedVehicle)
              }
            >
              {isUploadingPhotos
                ? "Uploading photos..."
                : (fuelTarget === "reefer" ? addReeferMutation.isPending : addMutation.isPending)
                  ? "Saving..."
                  : fuelTarget === "reefer"
                    ? "Save Reefer Entry"
                    : "Save Entry"
              }
            </Button>
          </form>
        </div>
      </MobileShell>
    );
  }

  // List view
  return (
    <MobileShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-5 space-y-6 min-h-screen">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Diesel Log</h1>
              <BottomSheetSelect
                value={selectedMonth}
                onValueChange={handleMonthChange}
                options={MONTH_OPTIONS.map((opt: MonthOption) => ({ value: opt.value, label: opt.label }))}
                placeholder="Select month"
                label="Select Month"
                className="h-7 w-auto text-xs text-muted-foreground border-none px-0 py-0 bg-transparent"
              />
            </div>
            <Button
              onClick={() => setViewMode("add")}
              size="sm"
              aria-label="Add new entry"
              disabled={!assignedVehicle && !assignedReefer}
            >
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
              Add
            </Button>
          </div>

          {stats.hasFlagged && <FlaggedEntriesAlert count={stats.flaggedCount} />}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/5 dark:bg-warning/10 rounded-lg">
                  <Gauge className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold">
                    {stats.avgKmPerLitre > 0 ? `${stats.avgKmPerLitre.toFixed(2)} km/L` : "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">{monthName} Vehicle Consumption</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {stats.totalLitres > 0 && <p>{formatNumber(stats.totalLitres)} L used</p>}
                  {stats.totalKmTravelled > 0 && <p>{formatNumber(Math.round(stats.totalKmTravelled))} km</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {reeferStats && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                    <Snowflake className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold">
                      {reeferStats.avgLitresPerHour > 0 ? `${reeferStats.avgLitresPerHour.toFixed(2)} L/hr` : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">{monthName} Reefer Consumption</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {reeferStats.totalLitres > 0 && <p>{formatNumber(reeferStats.totalLitres)} L used</p>}
                    {reeferStats.totalHours > 0 && <p>{formatNumber(Math.round(reeferStats.totalHours))} hrs</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <p className="text-sm font-medium mb-3">{monthName} Entries</p>
            {isLoadingRecords ? (
              <LoadingSpinner />
            ) : entries.length === 0 && allReeferRecords.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-2">
                {entries.map((entry: DieselEntry) => (
                  <DieselEntryCard key={entry.id} entry={entry} />
                ))}
                {allReeferRecords.length > 0 && (
                  <>
                    {entries.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 pb-1">
                        <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                        <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Reefer Entries</p>
                      </div>
                    )}
                    {allReeferRecords.map((entry: ReeferDieselEntry) => (
                      <ReeferEntryCard key={entry.id} entry={entry} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </MobileShell>
  );
}