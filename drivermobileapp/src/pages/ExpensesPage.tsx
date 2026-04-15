import React from 'react';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Flag,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// Components
import { MobileShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { RefreshButton } from "@/components/ui/refresh-button";
import { SearchableSelect, BottomSheetSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Constants & Types
import type { CostCategory } from "@/constants/cost-categories";
import { COST_CATEGORIES, HIGH_RISK_CATEGORIES } from "@/constants/cost-categories";

// Hooks & Context
import { useAuth } from "@/contexts/auth-context";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useToast } from "@/hooks/use-toast";

// Utils & Clients
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";

// Types
type ViewMode = "list" | "add" | "edit";

interface Trip {
  id: string;
  trip_number: string;
  origin: string | null;
  destination: string | null;
  status: string;
}

interface TripInfo {
  trip_number: string;
  origin: string | null;
  destination: string | null;
}

interface CostEntry {
  id: string;
  trip_id: string | null;
  category: string;
  sub_category: string | null;
  amount: number;
  currency: string;
  reference_number: string | null;
  date: string;
  notes: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string | null;
  trips?: TripInfo[] | null;
}

interface ExpenseFormData {
  trip_id: string;
  category: string;
  sub_category: string;
  amount: string;
  currency: string;
  reference_number: string;
  date: string;
  notes: string;
  is_flagged: boolean;
  flag_reason: string;
}

interface TripData {
  id: string;
  trip_number: string;
  origin: string | null;
  destination: string | null;
}

interface CostEntryRow {
  id: string;
  trip_id: string | null;
  category: string;
  sub_category: string | null;
  amount: number;
  currency: string;
  reference_number: string | null;
  date: string;
  notes: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string | null;
}

// Helper functions
const getTripInfo = (entry: CostEntry): TripInfo | null => {
  return entry.trips?.[0] ?? null;
};

const formatTripOption = (trip: Trip): string => {
  const origin = trip.origin || "Unknown";
  const destination = trip.destination || "Unknown";
  return `${trip.trip_number} - ${origin} → ${destination}`;
};

const calculateFlaggedCount = (entries: CostEntry[]): number => {
  return entries.filter((e: CostEntry) => e.is_flagged).length;
};

// Success Animation Component
const SuccessAnimation = (): JSX.Element => (
  <MobileShell>
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-5 animate-in fade-in">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-success/10 dark:bg-success/20 flex items-center justify-center mb-6 animate-pulse">
          <CheckCircle2 className="w-12 h-12 text-success" strokeWidth={1.5} />
        </div>
        <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Expense Saved!</h2>
      <p className="text-sm text-muted-foreground text-center">
        Entry has been recorded and synced to the dashboard
      </p>
    </div>
  </MobileShell>
);

// Expense Card Component
const ExpenseCard = ({ entry, onEdit }: { entry: CostEntry; onEdit: (entry: CostEntry) => void }): JSX.Element => {
  const tripInfo = getTripInfo(entry);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow active:scale-[0.98] cursor-pointer" onClick={() => onEdit(entry)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={entry.is_flagged ? "destructive" : "secondary"}
                className="text-xs"
              >
                {entry.category}
              </Badge>
              {entry.is_flagged && (
                <Badge variant="outline" className="text-xs">
                  <Flag className="w-3 h-3 mr-1" />
                  Flagged
                </Badge>
              )}
            </div>

            <p className="font-medium text-sm truncate mb-1">{entry.sub_category}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(entry.date)}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {entry.reference_number || "N/A"}
              </span>
              {tripInfo && (
                <Badge variant="outline" className="text-xs">
                  Trip: {tripInfo.trip_number}
                </Badge>
              )}
            </div>

            {entry.notes && (
              <div className="flex items-start gap-1 text-xs text-muted-foreground">
                <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{entry.notes}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm",
              entry.is_flagged
                ? "bg-warning/10 text-warning dark:bg-warning/20"
                : "bg-success/10 text-success dark:bg-success/20"
            )}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">Recorded</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground bg-muted/50">
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Loading Skeleton Component
const LoadingSkeleton = (): JSX.Element => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_: unknown, i: number) => (
      <Card key={i}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Alert Component (since @/components/ui/alert doesn't exist)
interface AlertProps {
  variant?: "default" | "destructive";
  className?: string;
  children: React.ReactNode;
}

const Alert = ({
  variant = "default",
  className = "",
  children
}: AlertProps): JSX.Element => {
  const variantClasses = {
    default: "bg-info/5 border-info/20 text-info dark:bg-info/10 dark:border-info/30",
    destructive: "bg-destructive/5 border-destructive/20 text-destructive dark:bg-destructive/10 dark:border-destructive/30"
  };

  return (
    <div className={`p-4 rounded-lg border ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};

const AlertDescription = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <p className="text-sm">{children}</p>
);

export default function ExpensesPage(): JSX.Element {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CostEntry | null>(null);

  // Context & Hooks
  const { user, profile } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form State
  const [formData, setFormData] = useState<ExpenseFormData>({
    trip_id: "",
    category: "",
    sub_category: "",
    amount: "",
    currency: "USD",
    reference_number: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    is_flagged: false,
    flag_reason: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];
  const TRAILER_TYPES = ['reefer', 'trailer', 'interlink'];

  // Refresh handler — shared by PullToRefresh and RefreshButton
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["assigned-vehicle"] }),
      queryClient.invalidateQueries({ queryKey: ["driver-trips"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicle-trip-ids"] }),
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] }),
    ]);
  }, [queryClient]);

  // Auto-refresh data when navigating to this tab
  useRefreshOnFocus([
    ["assigned-vehicle"],
    ["driver-trips"],
    ["vehicle-trip-ids"],
    ["expense-entries"],
  ]);

  // Fetch driver's assigned vehicle (truck) first
  // NOTE: driver_vehicle_assignments.driver_id = auth.users.id (Auth UUID)
  const { data: assignedVehicle } = useQuery({
    queryKey: ["assigned-vehicle", user?.id],
    queryFn: async () => {
      if (!user?.id) return { truck: null as null | { id: string; fleet_number: string; registration_number: string; vehicle_type?: string }, reefer: null as null | { id: string; fleet_number: string; registration_number: string; vehicle_type?: string } };

      const { data, error } = await supabase
        .from("driver_vehicle_assignments")
        .select("id, vehicle_id, vehicles!inner (id, fleet_number, registration_number, vehicle_type)")
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return { truck: null, reefer: null };

      type VehicleData = { id: string; fleet_number: string; registration_number: string; vehicle_type?: string };
      type AssignmentRow = { vehicles: VehicleData | VehicleData[] };
      const rows = data as unknown as AssignmentRow[];
      const normalizedRows = rows.map(r => ({
        vehicles: Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles,
      }));

      const truckRow = normalizedRows.find(r => !r.vehicles.vehicle_type || TRUCK_TYPES.includes(r.vehicles.vehicle_type));
      const reeferRow = normalizedRows.find(r => r.vehicles.vehicle_type && TRAILER_TYPES.includes(r.vehicles.vehicle_type));

      return {
        truck: truckRow?.vehicles || null,
        reefer: reeferRow?.vehicles || null,
      };
    },
    select: (data) => {
      const v = data?.truck;
      return v ? { id: v.id, fleet_number: v.fleet_number, registration_number: v.registration_number } : null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Queries - Fetch only trips for this driver's assigned vehicle
  const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["driver-trips", user?.id, assignedVehicle?.id],
    queryFn: async () => {
      if (!assignedVehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select("id, trip_number, origin, destination, status")
        .eq("fleet_vehicle_id", assignedVehicle.id)
        .in("status", ["active", "in_progress", "pending"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching trips:", error);
        throw error;
      }
      return (data || []) as Trip[];
    },
    enabled: !!user?.id && !!assignedVehicle?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all trip IDs for this vehicle (including completed) for filtering expenses
  const { data: vehicleTripIds = [] } = useQuery<string[]>({
    queryKey: ["vehicle-trip-ids", assignedVehicle?.id],
    queryFn: async () => {
      if (!assignedVehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select("id")
        .eq("fleet_vehicle_id", assignedVehicle.id);

      if (error) return [];
      return (data || []).map((t: { id: string }) => t.id);
    },
    enabled: !!assignedVehicle?.id,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: entries = [],
    isLoading: entriesLoading,
    error: entriesError
  } = useQuery<CostEntry[]>({
    queryKey: ["expense-entries", vehicleTripIds, assignedVehicle?.fleet_number],
    queryFn: async () => {
      // Fetch trip-linked expenses
      let tripRows: CostEntryRow[] = [];
      if (vehicleTripIds.length > 0) {
        const { data, error } = await supabase
          .from("cost_entries")
          .select(
            "id, trip_id, category, sub_category, amount, currency, reference_number, date, notes, is_flagged, flag_reason, created_at"
          )
          .eq("is_system_generated", false)
          .in("trip_id", vehicleTripIds)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching trip expenses:", error);
          throw error;
        }
        tripRows = (data ?? []) as CostEntryRow[];
      }

      // Also fetch standalone expenses (no trip) for this vehicle
      let standaloneRows: CostEntryRow[] = [];
      if (assignedVehicle?.fleet_number) {
        const { data, error } = await supabase
          .from("cost_entries")
          .select(
            "id, trip_id, category, sub_category, amount, currency, reference_number, date, notes, is_flagged, flag_reason, created_at"
          )
          .eq("is_system_generated", false)
          .is("trip_id", null)
          .eq("vehicle_identifier", assignedVehicle.fleet_number)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          standaloneRows = data as CostEntryRow[];
        }
      }

      // Merge and deduplicate by id
      const seen = new Set<string>();
      const allRows: CostEntryRow[] = [];
      for (const row of [...tripRows, ...standaloneRows]) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          allRows.push(row);
        }
      }
      // Sort by created_at descending
      allRows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

      const rows = allRows.slice(0, 50);

      // Fetch trip info separately for entries that have a trip_id
      const tripIdsSet = new Set(rows.map((e: CostEntryRow) => e.trip_id).filter(Boolean) as string[]);
      const tripIds: string[] = Array.from(tripIdsSet);
      const tripMap: Record<string, TripInfo> = {};

      if (tripIds.length > 0) {
        const { data: tripsData } = await supabase
          .from("trips")
          .select("id, trip_number, origin, destination")
          .in("id", tripIds);

        if (tripsData) {
          (tripsData as TripData[]).forEach((t: TripData) => {
            tripMap[t.id] = {
              trip_number: t.trip_number,
              origin: t.origin,
              destination: t.destination
            };
          });
        }
      }

      // Merge trip info into entries
      return rows.map((entry: CostEntryRow): CostEntry => ({
        ...entry,
        trips: entry.trip_id && tripMap[entry.trip_id] ? [tripMap[entry.trip_id]] : null,
      }));
    },
  });

  // Memoized values
  const availableSubCategories = useMemo((): readonly string[] => {
    if (!formData.category) return [];
    return COST_CATEGORIES[formData.category as CostCategory] || [];
  }, [formData.category]);

  const isHighRiskCategory = useMemo((): boolean =>
    HIGH_RISK_CATEGORIES.includes(formData.category as typeof HIGH_RISK_CATEGORIES[number]),
    [formData.category]
  );

  const flaggedCount = useMemo(
    (): number => calculateFlaggedCount(entries),
    [entries]
  );

  const tripOptions = useMemo(() => [
    { value: "", label: "No trip (standalone expense)" },
    ...trips.map((trip: Trip) => ({
      value: trip.id,
      label: formatTripOption(trip),
    })),
  ], [trips]);

  const categoryOptions = useMemo(() =>
    Object.keys(COST_CATEGORIES).map((value: string) => ({
      value,
      label: value,
    })),
    []
  );

  const subCategoryOptions = useMemo(() =>
    availableSubCategories.map((sub: string) => ({
      value: sub,
      label: sub,
    })),
    [availableSubCategories]
  );

  // Start editing an entry
  const startEdit = useCallback((entry: CostEntry): void => {

    const amount = entry.amount.toString();
    const currency = entry.currency || 'USD';

    // Strip the driver metadata suffix from notes for editing
    let cleanNotes = entry.notes || '';
    cleanNotes = cleanNotes.replace(/\s*\[Submitted by: [^\]]+\]/, '');
    cleanNotes = cleanNotes.trim();

    setEditingEntry(entry);
    setFormData({
      trip_id: entry.trip_id || '',
      category: entry.category,
      sub_category: entry.sub_category || '',
      amount,
      currency,
      reference_number: entry.reference_number || '',
      date: entry.date,
      notes: cleanNotes,
      is_flagged: entry.is_flagged,
      flag_reason: entry.flag_reason || '',
    });
    setErrors({});
    setViewMode('edit');
  }, []);

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      if (!user?.id) throw new Error("Authentication required");

      const isHighRisk = HIGH_RISK_CATEGORIES.includes(
        data.category as typeof HIGH_RISK_CATEGORIES[number]
      );
      const shouldFlag = data.is_flagged || isHighRisk;

      let flagReason = "";
      if (data.is_flagged && data.flag_reason.trim()) {
        flagReason = data.flag_reason.trim();
      } else if (isHighRisk) {
        flagReason = `High-risk category: ${data.category} - ${data.sub_category} requires review`;
      }

      // Always convert to USD for trip cost association
      const rawAmount = parseFloat(data.amount);
      const usdAmount = data.currency === 'USD' ? rawAmount / 18.6 : rawAmount;
      const zarNote = "";

      const costData = {
        trip_id: data.trip_id || null,
        category: data.category,
        sub_category: data.sub_category,
        amount: parseFloat(usdAmount.toFixed(2)),
        currency: 'USD',
        reference_number: data.reference_number.trim() || null,
        date: data.date,
        notes: `${data.notes.trim()}${zarNote} [Submitted by: ${profile?.name || user.email || 'Driver'}]`.trim(),
        is_flagged: shouldFlag,
        flag_reason: flagReason || null,
        is_system_generated: false,
        vehicle_identifier: assignedVehicle?.fleet_number || null,
      };

      const { data: result, error } = await supabase
        .from("cost_entries")
        .insert(costData as never)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      // Also invalidate trip-expenses so the trip detail sheet stays in sync
      if (formData.trip_id) {
        queryClient.invalidateQueries({ queryKey: ["trip-expenses", formData.trip_id] });
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        setViewMode("list");
      }, 2000);

      toast({
        title: "Success",
        description: "Expense has been recorded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save expense",
        variant: "destructive",
      });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!editingEntry) throw new Error("No entry selected");

      const isHighRisk = HIGH_RISK_CATEGORIES.includes(
        data.category as typeof HIGH_RISK_CATEGORIES[number]
      );
      const shouldFlag = data.is_flagged || isHighRisk;

      let flagReason = "";
      if (data.is_flagged && data.flag_reason.trim()) {
        flagReason = data.flag_reason.trim();
      } else if (isHighRisk) {
        flagReason = `High-risk category: ${data.category} - ${data.sub_category} requires review`;
      }

      const rawAmount = parseFloat(data.amount);
      const usdAmount = data.currency === 'USD' ? rawAmount / 18.6 : rawAmount;
      const zarNote = "";

      const costData = {
        trip_id: data.trip_id || null,
        category: data.category,
        sub_category: data.sub_category,
        amount: parseFloat(usdAmount.toFixed(2)),
        currency: 'USD',
        reference_number: data.reference_number.trim() || null,
        date: data.date,
        notes: `${data.notes.trim()}${zarNote} [Submitted by: ${profile?.name || user.email || 'Driver'}]`.trim(),
        is_flagged: shouldFlag,
        flag_reason: flagReason || null,
        vehicle_identifier: assignedVehicle?.fleet_number || null,
      };

      const { data: result, error } = await supabase
        .from("cost_entries")
        .update(costData as never)
        .eq("id", editingEntry.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      if (formData.trip_id) {
        queryClient.invalidateQueries({ queryKey: ["trip-expenses", formData.trip_id] });
      }
      if (editingEntry?.trip_id && editingEntry.trip_id !== formData.trip_id) {
        queryClient.invalidateQueries({ queryKey: ["trip-expenses", editingEntry.trip_id] });
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        setEditingEntry(null);
        setViewMode("list");
      }, 2000);

      toast({
        title: "Updated",
        description: "Expense has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update expense",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!user?.id) throw new Error("Authentication required");

      // Delete attachments first (if any)
      await supabase
        .from("cost_attachments")
        .delete()
        .eq("cost_id", entryId);

      const { error } = await supabase
        .from("cost_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      if (editingEntry?.trip_id) {
        queryClient.invalidateQueries({ queryKey: ["trip-expenses", editingEntry.trip_id] });
      }

      resetForm();
      setEditingEntry(null);
      setViewMode("list");

      toast({
        title: "Deleted",
        description: "Expense has been deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const resetForm = useCallback((): void => {
    setFormData({
      trip_id: "",
      category: "",
      sub_category: "",
      amount: "",
      currency: "USD",
      reference_number: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      is_flagged: false,
      flag_reason: "",
    });
    setErrors({});
  }, []);


  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.category.trim()) {
      newErrors.category = "Cost category is required";
    }
    if (!formData.sub_category.trim()) {
      newErrors.sub_category = "Sub-category is required";
    }
    if (!formData.amount.trim() || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount is required and must be greater than 0";
    }
    if (!formData.reference_number.trim()) {
      newErrors.reference_number = "Reference number is required";
    }
    if (!formData.date.trim()) {
      newErrors.date = "Date is required";
    }
    if (formData.is_flagged && !formData.flag_reason.trim()) {
      newErrors.flag_reason = "Flag reason is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!validateForm()) return;
    if (viewMode === 'edit') {
      editMutation.mutate(formData);
    } else {
      addMutation.mutate(formData);
    }
  };

  const handleCategoryChange = (value: string): void => {
    setFormData(prev => ({
      ...prev,
      category: value,
      sub_category: "",
    }));
    if (errors.category) setErrors(prev => ({ ...prev, category: "" }));
  };

  const handleInputChange = useCallback((
    field: keyof ExpenseFormData,
    value: string | boolean
  ): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  }, [errors]);

  // Success state
  if (showSuccess) {
    return <SuccessAnimation />;
  }

  const isEditing = viewMode === 'edit';
  const isMutating = addMutation.isPending || editMutation.isPending || deleteMutation.isPending;

  // Add/Edit Expense View
  if (viewMode === "add" || viewMode === "edit") {
    return (
      <MobileShell>
        <div className="p-5 space-y-5 pb-28">
          {/* Header */}
          <div className="flex items-center gap-3 sticky top-0 bg-background pt-4 pb-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => {
                resetForm();
                setEditingEntry(null);
                setViewMode("list");
              }}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{isEditing ? 'Edit Expense' : 'New Expense'}</h1>
              <p className="text-xs text-muted-foreground">{isEditing ? 'Update this expense entry' : 'Record a trip cost or expense'}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {profile?.name || "Driver"}
            </Badge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Trip Selection */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-medium mb-2 block">
                  Link to Trip (Optional)
                </Label>
                <BottomSheetSelect
                  value={formData.trip_id}
                  onValueChange={(value: string) => handleInputChange("trip_id", value)}
                  options={tripOptions}
                  placeholder="Select a trip..."
                  disabled={tripsLoading}
                />
                {tripsLoading && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Circle className="w-3 h-3 animate-pulse" />
                    Loading trips...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Selection */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Cost Category *
                  </Label>
                  <BottomSheetSelect
                    value={formData.category}
                    onValueChange={handleCategoryChange}
                    options={categoryOptions}
                    placeholder="Select category..."
                  />
                  {errors.category && (
                    <p className="text-sm text-destructive mt-2">{errors.category}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Sub-category *
                  </Label>
                  <SearchableSelect
                    value={formData.sub_category}
                    onValueChange={(value: string) => handleInputChange("sub_category", value)}
                    options={subCategoryOptions}
                    placeholder={formData.category ? "Search & select..." : "Select category first"}
                    searchPlaceholder="Type to search..."
                    disabled={!formData.category}
                  />
                  {errors.sub_category && (
                    <p className="text-sm text-destructive mt-2">{errors.sub_category}</p>
                  )}
                </div>

                {/* High-risk warning */}
                {isHighRiskCategory && (
                  <Alert
                    variant="default"
                    className="border-warning/20 bg-warning/5 text-warning"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <AlertDescription>
                        This expense will be automatically flagged for review due to high-risk category.
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Amount */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Amount ($) *
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("amount", e.target.value)}
                    placeholder="0.00"
                    className="h-14 text-2xl font-bold tabular-nums"
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive mt-2">{errors.amount}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Date *
                    </Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("date", e.target.value)}
                      className="h-12"
                    />
                    {errors.date && (
                      <p className="text-sm text-destructive mt-2">{errors.date}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Ref. Number *
                    </Label>
                    <Input
                      value={formData.reference_number}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("reference_number", e.target.value)}
                      placeholder="INV-12345"
                      className="h-12"
                    />
                    {errors.reference_number && (
                      <p className="text-sm text-destructive mt-2">{errors.reference_number}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-medium mb-2 block">
                  Notes (Optional)
                </Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange("notes", e.target.value)}
                  placeholder="Any additional details about this expense..."
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Flag Section */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => handleInputChange("is_flagged", !formData.is_flagged)}
                    className="flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all"
                    style={{
                      backgroundColor: formData.is_flagged ? "oklch(0.69 0.19 148.89)" : "transparent",
                      borderColor: formData.is_flagged ? "oklch(0.69 0.19 148.89)" : "var(--border)",
                    }}
                    aria-label={formData.is_flagged ? "Unflag expense" : "Flag expense for review"}
                  >
                    {formData.is_flagged && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium">Flag for Investigation</p>
                    <p className="text-sm text-muted-foreground">Mark if this expense needs review</p>
                  </div>
                  <Flag className={cn(
                    "w-5 h-5",
                    formData.is_flagged ? "text-warning" : "text-muted-foreground"
                  )} />
                </div>

                {formData.is_flagged && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium mb-2 block">
                      Flag Reason *
                    </Label>
                    <Textarea
                      value={formData.flag_reason}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange("flag_reason", e.target.value)}
                      placeholder="Why does this expense need investigation?"
                      rows={2}
                    />
                    {errors.flag_reason && (
                      <p className="text-sm text-destructive mt-2">{errors.flag_reason}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-base font-semibold"
              disabled={isMutating}
            >
              {isMutating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {isEditing ? 'Update Expense' : 'Save Expense'}
                </>
              )}
            </Button>

            {/* Delete Button — only in edit mode */}
            {isEditing && editingEntry && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="w-full h-14 text-base font-semibold"
                disabled={isMutating}
                onClick={() => {
                  if (window.confirm("Delete this expense? This cannot be undone.")) {
                    deleteMutation.mutate(editingEntry.id);
                  }
                }}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete Expense
                  </>
                )}
              </Button>
            )}
          </form>
        </div>
      </MobileShell>
    );
  }

  // List View
  return (
    <MobileShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-5 space-y-6 pb-24">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Expenses</h1>
              <p className="text-sm text-muted-foreground">Track and record trip costs</p>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton onRefresh={handleRefresh} />
              <Button onClick={() => setViewMode("add")} size="lg" className="gap-2" aria-label="Add new expense">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </div>
          </div>

          {/* Error State */}
          {entriesError && (
            <Alert variant="destructive">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <AlertDescription>
                  Failed to load expenses. Please try again.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Receipt className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Entries</span>
                </div>
                <p className="text-2xl font-bold">{entries.length}</p>
                <p className="text-xs text-muted-foreground mt-1">expenses recorded</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Flag className="w-4 h-4" />
                  <span className="text-xs font-medium">Flagged</span>
                </div>
                <p className="text-2xl font-bold text-warning">{flaggedCount}</p>
                <p className="text-xs text-muted-foreground">require review</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Expenses */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Expenses</h2>
              {entries.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {entries.length} total
                </Badge>
              )}
            </div>

            {entriesLoading ? (
              <LoadingSkeleton />
            ) : entries.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Receipt className="w-12 h-12 text-muted-foreground/50" />
                    <div>
                      <p className="text-muted-foreground mb-2">No expenses recorded yet</p>
                      <p className="text-sm text-muted-foreground/70">
                        Start by adding your first expense
                      </p>
                    </div>
                    <Button onClick={() => setViewMode("add")} className="mt-2">
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Expense
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {entries.map((entry: CostEntry) => (
                  <ExpenseCard key={entry.id} entry={entry} onEdit={startEdit} />
                ))}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </MobileShell>
  );
}