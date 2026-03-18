"use client";

import { MobileShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { BottomSheetSelect, SearchableSelect } from "@/components/ui/select";
import { VehicleSelect } from "@/components/ui/vehicle-select";
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
  Droplet,
  Fuel,
  Gauge,
  Image as ImageIcon,
  Info,
  MapPin,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ViewMode = "list" | "add";

interface Vehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make?: string;
  model?: string;
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

interface VehicleOption {
  value: string;
  label: string;
  sublabel: string;
}

// Type for driver_vehicle_assignments join result
interface DriverVehicleAssignment {
  id: string;
  vehicle_id: string;
  vehicles: Vehicle | Vehicle[] | null;
}

// Helper to get month options (current + past 11 months)
function getMonthOptions(): MonthOption[] {
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
}

export default function DieselPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showSuccess, setShowSuccess] = useState(false);
  const { user, profile } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Month selector state
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0].value);

  // Parse selected month to get date range
  const selectedMonthData = monthOptions.find(m => m.value === selectedMonth) || monthOptions[0];
  const firstDayOfMonth = new Date(selectedMonthData.year, selectedMonthData.month, 1).toISOString().split("T")[0];
  const lastDayOfMonth = new Date(selectedMonthData.year, selectedMonthData.month + 1, 0).toISOString().split("T")[0];
  const monthName = new Date(selectedMonthData.year, selectedMonthData.month).toLocaleString("default", { month: "long" });

  // Real-time subscriptions - Pass ID only if it exists
  useDieselRealtimeSync(user?.id);
  useVehicleAssignmentSubscription(user?.id);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    date: new Date().toISOString().split("T")[0],
    odometer_reading: "",
    litres: "",
    station: "",
    notes: "",
  });

  // Photo upload state — diesel slip & pump photo
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [slipPreviews, setSlipPreviews] = useState<string[]>([]);
  const [pumpFiles, setPumpFiles] = useState<File[]>([]);
  const [pumpPreviews, setPumpPreviews] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // Handle file selection for photos
  const handlePhotoSelect = (
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
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit`, variant: "destructive" });
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
  };

  const removePhoto = (index: number, target: "slip" | "pump"): void => {
    if (target === "slip") {
      if (slipPreviews[index]) URL.revokeObjectURL(slipPreviews[index]);
      setSlipFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
      setSlipPreviews((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
    } else {
      if (pumpPreviews[index]) URL.revokeObjectURL(pumpPreviews[index]);
      setPumpFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
      setPumpPreviews((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
    }
  };

  // Upload photos to Supabase Storage
  const uploadDieselPhotos = async (entryId: string): Promise<void> => {
    const allUploads = [
      ...slipFiles.map((f: File, i: number) => ({ file: f, type: "slip" as const, idx: i })),
      ...pumpFiles.map((f: File, i: number) => ({ file: f, type: "pump" as const, idx: i })),
    ];
    if (allUploads.length === 0) return;
    setIsUploadingPhotos(true);
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
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("trip-documents")
          .getPublicUrl(filePath);

        // Store reference in diesel_attachments (or cost_attachments)
        await supabase.from("cost_attachments").insert({
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
    }
  };

  // 1. Fetch all vehicles (General list, no user ID needed)
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number, make, model")
        .eq("active", true)
        .order("fleet_number");

      if (error) throw error;
      return (data || []) as Vehicle[];
    },
    staleTime: 10 * 60 * 1000, // 10 min - vehicle list rarely changes
  });

  // 2. Fetch assigned vehicle from driver_vehicle_assignments
  const { data: assignedVehicle } = useQuery<Vehicle | null>({
    queryKey: ["assigned-vehicle", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Query the driver_vehicle_assignments table to find the assigned vehicle
      const { data, error } = await supabase
        .from("driver_vehicle_assignments")
        .select(`
          id,
          vehicle_id,
          vehicles!inner (
            id,
            fleet_number,
            registration_number,
            make,
            model
          )
        `)
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      // Extract the vehicle from the assignment
      // Handle both object and array cases due to Supabase join behavior
      const assignment = data as DriverVehicleAssignment | null;
      if (assignment?.vehicles) {
        const vehicleData = Array.isArray(assignment.vehicles) ? assignment.vehicles[0] : assignment.vehicles;
        return vehicleData as Vehicle;
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 min - assignment doesn't change often
  });

  // 3. Fetch all diesel records for current month from diesel_records table
  const { data: allDieselRecords = [], isLoading } = useQuery<DieselEntry[]>({
    queryKey: ["diesel-records", assignedVehicle?.fleet_number, firstDayOfMonth],
    queryFn: async () => {
      if (!assignedVehicle?.fleet_number) return [];

      const { data, error } = await supabase
        .from("diesel_records")
        .select("id, date, litres_filled, total_cost, cost_per_litre, km_reading, previous_km_reading, distance_travelled, km_per_litre, fuel_station, fleet_number, driver_name, currency, notes, created_at")
        .eq("fleet_number", assignedVehicle.fleet_number)
        .gte("date", firstDayOfMonth)
        .lte("date", lastDayOfMonth)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data || []) as DieselEntry[];
    },
    enabled: !!assignedVehicle?.fleet_number,
  });

  // 4. Fetch saved fuel stations from fuel_stations table
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
    staleTime: 10 * 60 * 1000,
  });

  // 5. Fetch historical fuel station names from diesel_records
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
    staleTime: 10 * 60 * 1000,
  });

  // Combine saved + historical into searchable options (deduplicated)
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

  // Look up configured price from the selected filling station
  const selectedStationPrice = useMemo(() => {
    if (!formData.station) return null;
    const match = savedStations.find(
      (s: FuelStation) => s.name.toLowerCase() === formData.station.toLowerCase()
    );
    return match?.price_per_litre ?? null;
  }, [formData.station, savedStations]);

  // Add flagging logic to diesel records
  const entries: DieselEntry[] = allDieselRecords.map((record: DieselEntry) => {
    const kmPerLitre = record.km_per_litre;
    const requiresDebriefing = kmPerLitre !== null && kmPerLitre !== undefined && kmPerLitre > 0 && kmPerLitre < CONSUMPTION_THRESHOLD_KM_PER_LITRE;

    return {
      ...record,
      requires_debriefing: requiresDebriefing,
      debriefed: false,
    };
  });

  // 5. Add diesel entry mutation — inserts into diesel_records (same table as dashboard)
  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!data.vehicle_id) throw new Error("Please select a vehicle");

      // Find the selected vehicle to get the fleet_number
      const selectedVehicle = vehicles.find((v: Vehicle) => v.id === data.vehicle_id);
      if (!selectedVehicle?.fleet_number) throw new Error("Vehicle fleet number not found");

      const litresFilled = parseFloat(data.litres);

      // Cost is derived from the station's configured price only.
      // If no price is configured, leave cost fields null so the dashboard
      // user can fill them in later.
      const stationMatch = savedStations.find(
        (s: FuelStation) => s.name.toLowerCase() === (data.station || "").toLowerCase()
      );
      const costPerLitre = stationMatch?.price_per_litre ?? null;
      const totalCost = costPerLitre != null ? litresFilled * costPerLitre : 0;

      const insertData = {
        fleet_number: selectedVehicle.fleet_number,
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

      const { data: result, error } = await supabase
        .from("diesel_records")
        .insert(insertData as never)
        .select("id")
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (data: { id: string }) => {
      // Upload photos if any were attached
      const entryId = data?.id;
      if (entryId && (slipFiles.length > 0 || pumpFiles.length > 0)) {
        try {
          await uploadDieselPhotos(entryId);
        } catch {
          // Entry saved, but photo upload failed — non-blocking
          toast({ title: "Photos failed", description: "Diesel entry saved but photo upload failed", variant: "destructive" });
        }
      }

      // Invalidate all related queries for dashboard sync
      queryClient.invalidateQueries({ queryKey: ["diesel-records"] });
      queryClient.invalidateQueries({ queryKey: ["recent-diesel"] });

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

  const resetForm = (): void => {
    setFormData({
      vehicle_id: assignedVehicle?.id || "",
      date: new Date().toISOString().split("T")[0],
      odometer_reading: "",
      litres: "",
      station: "",
      notes: "",
    });
    // Clear photo state
    slipPreviews.forEach((p: string) => p && URL.revokeObjectURL(p));
    pumpPreviews.forEach((p: string) => p && URL.revokeObjectURL(p));
    setSlipFiles([]);
    setSlipPreviews([]);
    setPumpFiles([]);
    setPumpPreviews([]);
  };

  useEffect(() => {
    if (assignedVehicle?.id && !formData.vehicle_id) {
      setFormData((prev: typeof formData) => ({ ...prev, vehicle_id: assignedVehicle.id }));
    }
  }, [assignedVehicle?.id, formData.vehicle_id]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  const selectedVehicle = vehicles.find((v: Vehicle) => v.id === formData.vehicle_id);

  const vehicleOptions: VehicleOption[] = vehicles.map((v: Vehicle) => ({
    value: v.id,
    label: v.fleet_number,
    sublabel: v.registration_number,
  }));

  const totalLitres = entries.reduce((sum: number, e: DieselEntry) => sum + (e.litres_filled || 0), 0);

  // Identify flagged entries requiring debriefing
  const flaggedEntries = entries.filter((e: DieselEntry) => e.requires_debriefing && !e.debriefed);
  const hasFlaggedEntries = flaggedEntries.length > 0;

  // Refresh handler for pull-to-refresh
  const handleRefresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["diesel-records"] }),
      queryClient.invalidateQueries({ queryKey: ["assigned-vehicle"] }),
    ]);
  };

  // Calculate consumption (km/L) from records that have distance data for current month
  const recordsWithDistance = allDieselRecords.filter((r: DieselEntry) => r.distance_travelled && r.litres_filled);
  const totalKmTravelled = recordsWithDistance.reduce((sum: number, r: DieselEntry) => sum + (r.distance_travelled || 0), 0);
  const totalLitresForCalc = recordsWithDistance.reduce((sum: number, r: DieselEntry) => sum + (r.litres_filled || 0), 0);
  const avgKmPerLitre = totalLitresForCalc > 0 ? totalKmTravelled / totalLitresForCalc : 0;

  // Remaining render logic...
  if (viewMode === "add") {
    // Show success animation
    if (showSuccess) {
      return (
        <MobileShell>
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-5">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold">Entry Saved!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Diesel record synced successfully
            </p>
          </div>
        </MobileShell>
      );
    }

    return (
      <MobileShell>
        <div className="p-5 space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode("list")}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <h1 className="text-lg font-semibold">New Diesel Entry</h1>
          </div>

          {/* Vehicle Selection Card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-primary" strokeWidth={1.5} />
                <Label className="text-sm font-medium">Select Vehicle</Label>
              </div>
              <VehicleSelect
                options={vehicleOptions}
                value={formData.vehicle_id}
                onChange={(value: string) => setFormData({ ...formData, vehicle_id: value })}
                placeholder="Select a vehicle"
              />
              {selectedVehicle && (
                <p className="text-xs text-muted-foreground">
                  {selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.registration_number}
                </p>
              )}
              {!formData.vehicle_id && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Please select a vehicle to continue
                </p>
              )}
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, date: e.target.value })}
                required
                className="h-12"
              />
            </div>

            {/* Odometer Reading */}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, odometer_reading: e.target.value })}
                required
                className="h-12"
              />
            </div>

            {/* Litres */}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, litres: e.target.value })}
                required
                className="h-12"
              />
            </div>

            {/* Fuel Station */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Filling Station
              </Label>
              <SearchableSelect
                value={formData.station}
                onValueChange={(value: string) => setFormData({ ...formData, station: value })}
                options={stationOptions}
                placeholder="Search filling station..."
                searchPlaceholder="Search by name or location..."
                label="Select Filling Station"
              />
              {/* Pricing info */}
              {formData.station && selectedStationPrice != null ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Price: <span className="font-semibold">${formatNumber(selectedStationPrice)}/L</span>
                    {formData.litres && (
                      <> — Total: <span className="font-semibold">${formatNumber(parseFloat(formData.litres) * selectedStationPrice)}</span></>
                    )}
                  </p>
                </div>
              ) : formData.station ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Cost per litre not configured for this station — will be added on the dashboard
                  </p>
                </div>
              ) : null}
            </div>

            {/* Diesel Slip Photo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Camera className="w-4 h-4 text-muted-foreground" />
                Diesel Slip Photo ({slipFiles.length}/3)
              </Label>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer" aria-label="Take photo with camera">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePhotoSelect(e, "slip")}
                    className="hidden"
                    disabled={slipFiles.length >= 3}
                  />
                  <div className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
                    slipFiles.length >= 3
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePhotoSelect(e, "slip")}
                    className="hidden"
                    disabled={slipFiles.length >= 3}
                  />
                  <div className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
                    slipFiles.length >= 3
                      ? "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
                      : "border-primary/40 text-primary hover:bg-primary/5 active:scale-[0.98]"
                  )}>
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">Gallery</span>
                  </div>
                </label>
              </div>
              {slipFiles.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {slipFiles.map((file: File, idx: number) => (
                    <div key={idx} className="relative group">
                      {slipPreviews[idx] ? (
                        <img src={slipPreviews[idx]} alt={file.name} className="w-16 h-16 rounded-lg object-cover border border-border/50" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx, "slip")}
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

            {/* Pump Photo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Fuel className="w-4 h-4 text-muted-foreground" />
                Pump Photo ({pumpFiles.length}/2)
              </Label>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer" aria-label="Take photo with camera">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePhotoSelect(e, "pump")}
                    className="hidden"
                    disabled={pumpFiles.length >= 2}
                  />
                  <div className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
                    pumpFiles.length >= 2
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePhotoSelect(e, "pump")}
                    className="hidden"
                    disabled={pumpFiles.length >= 2}
                  />
                  <div className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
                    pumpFiles.length >= 2
                      ? "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
                      : "border-primary/40 text-primary hover:bg-primary/5 active:scale-[0.98]"
                  )}>
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">Gallery</span>
                  </div>
                </label>
              </div>
              {pumpFiles.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {pumpFiles.map((file: File, idx: number) => (
                    <div key={idx} className="relative group">
                      {pumpPreviews[idx] ? (
                        <img src={pumpPreviews[idx]} alt={file.name} className="w-16 h-16 rounded-lg object-cover border border-border/50" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx, "pump")}
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                type="text"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, notes: e.target.value })}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-semibold"
              disabled={addMutation.isPending || isUploadingPhotos || !formData.vehicle_id}
            >
              {isUploadingPhotos ? "Uploading photos..." : addMutation.isPending ? "Saving..." : "Save Entry"}
            </Button>
          </form>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-5 space-y-6 min-h-screen">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Diesel Log</h1>
              <BottomSheetSelect
                value={selectedMonth}
                onValueChange={setSelectedMonth}
                options={monthOptions.map((opt: MonthOption) => ({ value: opt.value, label: opt.label }))}
                placeholder="Select month"
                label="Select Month"
                className="h-7 w-auto text-xs text-muted-foreground border-none px-0 py-0 bg-transparent"
              />
            </div>
            <Button onClick={() => setViewMode("add")} size="sm" className="h-9" aria-label="Add new entry">
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
              Add
            </Button>
          </div>

          {/* Flagged Entries Alert */}
          {hasFlaggedEntries && (
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      Debriefing Required
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {flaggedEntries.length} transaction{flaggedEntries.length > 1 ? 's' : ''} with abnormal consumption detected.
                      Please visit the office for debriefing.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 dark:bg-orange-950/50 rounded-lg">
                  <Gauge className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold">{avgKmPerLitre > 0 ? `${avgKmPerLitre.toFixed(2)} km/L` : "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{monthName} Consumption</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {totalLitres > 0 && <p>{formatNumber(totalLitres)} L used</p>}
                  {totalKmTravelled > 0 && <p>{formatNumber(Math.round(totalKmTravelled))} km</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <p className="text-sm font-medium mb-3">{monthName} Entries</p>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Droplet className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No entries found.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tap &quot;Add&quot; to record your first diesel entry
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {entries.map((entry: DieselEntry) => (
                  <Card
                    key={entry.id}
                    className={entry.requires_debriefing && !entry.debriefed
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : ""}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            {formatDate(entry.date)}
                            {entry.source === "dashboard" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                Dashboard
                              </span>
                            )}
                            {/* Flagged transaction badges */}
                            {entry.requires_debriefing && !entry.debriefed && (
                              <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Debriefing Required
                              </Badge>
                            )}
                            {entry.debriefed && (
                              <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle className="w-3 h-3" />
                                Debriefed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Gauge className="w-3.5 h-3.5" />
                            {formatNumber(entry.km_reading)} km
                            {entry.km_per_litre && (
                              <span className={entry.requires_debriefing ? "text-amber-600 font-medium" : ""}>
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
                          {/* Debriefing notice for flagged entries */}
                          {entry.requires_debriefing && !entry.debriefed && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
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
                ))}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </MobileShell>
  );
}