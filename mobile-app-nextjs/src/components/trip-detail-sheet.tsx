import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomSheetSelect, SearchableSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Hash,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  Receipt,
  Gauge,
  FileText,
  AlertTriangle,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CycleTrackerForm } from "@/components/cycle-tracker-form";

import type { CostCategory } from "@/constants/cost-categories";
import { COST_CATEGORIES, HIGH_RISK_CATEGORIES } from "@/constants/cost-categories";

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
  is_system_generated: boolean;
  created_at: string | null;
}

interface ExpenseFormData {
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

// ─── Props ───────────────────────────────────────────────────────────

interface TripDetailSheetProps {
  trip: TripEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Constants ───────────────────────────────────────────────────────

const ZAR_TO_USD_RATE = 18.6;

const INITIAL_EXPENSE_FORM: ExpenseFormData = {
  category: "",
  sub_category: "",
  amount: "",
  currency: "USD",
  reference_number: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  is_flagged: false,
  flag_reason: "",
};

// ─── Main Component ─────────────────────────────────────────────────

export function TripDetailSheet({ trip, open, onOpenChange }: TripDetailSheetProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Local state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCycleTracker, setShowCycleTracker] = useState(false);
  const [podNumber, setPodNumber] = useState(trip.trip_number || "");
  const [startingKm, setStartingKm] = useState(trip.starting_km?.toString() || "");
  const [endingKm, setEndingKm] = useState(trip.ending_km?.toString() || "");
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [tripSaved, setTripSaved] = useState(false);

  // Expense form state
  const [formData, setFormData] = useState<ExpenseFormData>(INITIAL_EXPENSE_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Handle file selection (camera or gallery)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach((file) => {
      // Limit to 5 files total
      if (receiptFiles.length + newFiles.length >= 5) return;
      // Max 10MB per file
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit`, variant: "destructive" });
        return;
      }
      newFiles.push(file);
      if (file.type.startsWith("image/")) {
        newPreviews.push(URL.createObjectURL(file));
      } else {
        newPreviews.push(""); // non-image placeholder
      }
    });

    setReceiptFiles((prev) => [...prev, ...newFiles]);
    setReceiptPreviews((prev) => [...prev, ...newPreviews]);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    // Revoke object URL to prevent memory leak
    if (receiptPreviews[index]) URL.revokeObjectURL(receiptPreviews[index]);
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
    setReceiptPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload files to Supabase Storage and record in cost_attachments
  const uploadReceipts = async (costId: string) => {
    if (receiptFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < receiptFiles.length; i++) {
        const file = receiptFiles[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${costId}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `trip-costs/${trip.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("trip-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("trip-documents")
          .getPublicUrl(filePath);

        await supabase.from("cost_attachments").insert({
          cost_id: costId,
          filename: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: profile?.name || user?.email || "Driver",
        } as never);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Queries ───────────────────────────────────────────────────────

  // Fetch cost entries for this trip (manual entries only — system-generated are shown separately)
  const { data: tripExpenses = [], isLoading: loadingExpenses } = useQuery<CostEntry[]>({
    queryKey: ["trip-expenses", trip.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select(
          "id, trip_id, category, sub_category, amount, currency, reference_number, date, notes, is_flagged, flag_reason, is_system_generated, created_at"
        )
        .eq("trip_id", trip.id)
        .eq("is_system_generated", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CostEntry[];
    },
    enabled: open && !!trip.id,
  });

  // Fetch system-generated (pre-configured) cost entries for this trip
  const { data: systemExpenses = [] } = useQuery<CostEntry[]>({
    queryKey: ["trip-system-expenses", trip.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select(
          "id, trip_id, category, sub_category, amount, currency, reference_number, date, notes, is_flagged, flag_reason, is_system_generated, created_at"
        )
        .eq("trip_id", trip.id)
        .eq("is_system_generated", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CostEntry[];
    },
    enabled: open && !!trip.id,
  });

  // Fetch attachment counts for all expenses in this trip
  const { data: attachmentCounts = {} } = useQuery({
    queryKey: ["trip-expense-attachments", trip.id],
    queryFn: async () => {
      const costIds = tripExpenses.map((e: CostEntry) => e.id);
      if (costIds.length === 0) return {};
      const { data, error } = await supabase
        .from("cost_attachments")
        .select("cost_id")
        .in("cost_id", costIds);
      if (error) return {};
      // Count per cost_id
      const counts: Record<string, number> = {};
      (data || []).forEach((row: { cost_id: string }) => {
        counts[row.cost_id] = (counts[row.cost_id] || 0) + 1;
      });
      return counts;
    },
    enabled: open && tripExpenses.length > 0,
  });

  // ─── Memoized values ──────────────────────────────────────────────

  const availableSubCategories = useMemo(() => {
    if (!formData.category) return [];
    return COST_CATEGORIES[formData.category as CostCategory] || [];
  }, [formData.category]);

  const isHighRiskCategory = useMemo(
    () => HIGH_RISK_CATEGORIES.includes(formData.category as (typeof HIGH_RISK_CATEGORIES)[number]),
    [formData.category]
  );

  const categoryOptions = useMemo(
    () => Object.keys(COST_CATEGORIES).map((v) => ({ value: v, label: v })),
    []
  );

  const subCategoryOptions = useMemo(
    () => availableSubCategories.map((sub) => ({ value: sub, label: sub })),
    [availableSubCategories]
  );

  const usdEquivalent = useMemo(() => {
    const amt = parseFloat(formData.amount);
    if (!amt || amt <= 0 || formData.currency !== "ZAR") return null;
    return (amt / ZAR_TO_USD_RATE).toFixed(2);
  }, [formData.amount, formData.currency]);

  const totalExpensesUsd = useMemo(
    () => tripExpenses.reduce((s: number, e: CostEntry) => s + (e.currency === "USD" ? e.amount : 0), 0),
    [tripExpenses]
  );

  const totalSystemExpensesUsd = useMemo(
    () => systemExpenses.reduce((s: number, e: CostEntry) => s + (e.currency === "USD" ? e.amount : 0), 0),
    [systemExpenses]
  );

  // ─── Trip Info Save ────────────────────────────────────────────────

  const handleSaveTripInfo = async () => {
    setIsSavingTrip(true);
    try {
      const startKm = startingKm ? parseFloat(startingKm) : null;
      const endKm = endingKm ? parseFloat(endingKm) : null;
      const distanceKm = startKm != null && endKm != null && endKm > startKm ? endKm - startKm : trip.distance_km;

      const { error } = await supabase
        .from("trips")
        .update({
          trip_number: podNumber.trim() || null,
          starting_km: startKm,
          ending_km: endKm,
          distance_km: distanceKm,
        } as never)
        .eq("id", trip.id);

      if (error) throw error;

      setTripSaved(true);
      setTimeout(() => setTripSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["monthly-trips"] });
      toast({ title: "Saved", description: "Trip info updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update trip info", variant: "destructive" });
    } finally {
      setIsSavingTrip(false);
    }
  };

  // ─── Start 360° Cycle Tracker (Save Trip First) ────────────────────

  const [isStartingCycleTracker, setIsStartingCycleTracker] = useState(false);

  const handleStart360CycleTracker = async () => {
    setIsStartingCycleTracker(true);
    try {
      // Save current trip info before opening cycle tracker
      const startKm = startingKm ? parseFloat(startingKm) : null;
      const endKm = endingKm ? parseFloat(endingKm) : null;
      const distanceKm = startKm != null && endKm != null && endKm > startKm ? endKm - startKm : trip.distance_km;

      const { error } = await supabase
        .from("trips")
        .update({
          trip_number: podNumber.trim() || null,
          starting_km: startKm,
          ending_km: endKm,
          distance_km: distanceKm,
        } as never)
        .eq("id", trip.id);

      if (error) throw error;

      // Invalidate queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["monthly-trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-expenses", trip.id] });

      // Now open the cycle tracker
      setShowCycleTracker(true);
      toast({ title: "Trip Saved", description: "Starting 360° Time Tracker" });
    } catch {
      toast({ title: "Error", description: "Failed to save trip before starting tracker", variant: "destructive" });
    } finally {
      setIsStartingCycleTracker(false);
    }
  };

  // ─── Expense Mutation ──────────────────────────────────────────────

  const addExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      if (!user?.id) throw new Error("Auth required");

      const isHighRisk = HIGH_RISK_CATEGORIES.includes(data.category as (typeof HIGH_RISK_CATEGORIES)[number]);
      const shouldFlag = data.is_flagged || isHighRisk;
      let flagReason = "";
      if (data.is_flagged && data.flag_reason.trim()) {
        flagReason = data.flag_reason.trim();
      } else if (isHighRisk) {
        flagReason = `High-risk category: ${data.category} - ${data.sub_category}`;
      }

      const rawAmount = parseFloat(data.amount);
      const usdAmount = data.currency === "ZAR" ? rawAmount / ZAR_TO_USD_RATE : rawAmount;
      const zarNote = data.currency === "ZAR" ? ` [Original: ZAR ${rawAmount.toFixed(2)}, Rate: ${ZAR_TO_USD_RATE}]` : "";

      const { data: inserted, error } = await supabase.from("cost_entries").insert({
        trip_id: trip.id,
        category: data.category,
        sub_category: data.sub_category,
        amount: parseFloat(usdAmount.toFixed(2)),
        currency: "USD",
        reference_number: data.reference_number.trim() || null,
        date: data.date,
        notes: `${data.notes.trim()}${zarNote} [Driver: ${profile?.name || user.email || "Driver"}]`.trim(),
        is_flagged: shouldFlag,
        flag_reason: flagReason || null,
        is_system_generated: false,
      } as never).select("id").single();

      if (error) throw error;
      const insertedEntry = inserted as { id: string } | null;

      // Upload receipt files if any
      if (insertedEntry?.id && receiptFiles.length > 0) {
        try {
          await uploadReceipts(insertedEntry.id);
        } catch {
          // Expense saved but upload failed - still show success with warning
          toast({ title: "Expense saved", description: "Receipt upload failed - you can retry later", variant: "destructive" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-expenses", trip.id] });
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      setFormData(INITIAL_EXPENSE_FORM);
      setErrors({});
      // Clean up receipt files and previews
      receiptPreviews.forEach((url) => url && URL.revokeObjectURL(url));
      setReceiptFiles([]);
      setReceiptPreviews([]);
      setShowExpenseForm(false);
      toast({ title: "Saved", description: "Expense recorded for this trip" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to save expense", variant: "destructive" });
    },
  });

  // ─── Expense Form Handlers ────────────────────────────────────────

  const handleInputChange = useCallback(
    (field: keyof ExpenseFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    },
    [errors]
  );

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value, sub_category: "" }));
    if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
  };

  const validateAndSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.category.trim()) newErrors.category = "Required";
    if (!formData.sub_category.trim()) newErrors.sub_category = "Required";
    if (!formData.amount.trim() || parseFloat(formData.amount) <= 0) newErrors.amount = "Enter valid amount";
    if (!formData.reference_number.trim()) newErrors.reference_number = "Required";
    if (!formData.date.trim()) newErrors.date = "Required";
    if (formData.is_flagged && !formData.flag_reason.trim()) newErrors.flag_reason = "Required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) addExpenseMutation.mutate(formData);
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-full max-w-none h-[100dvh] max-h-none rounded-none border-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[calc(100%-2rem)] sm:max-w-[500px] sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border overflow-y-auto overflow-x-hidden p-0 gap-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Trip Details</DialogTitle>
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full shrink-0" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold truncate">Trip Details</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{trip.origin || "N/A"}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{trip.destination || "N/A"}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {trip.status || "pending"}
              </Badge>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Trip Info Row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {trip.departure_date ? formatDate(trip.departure_date) : "No date"}
              </span>
              {trip.client_name && (
                <Badge variant="secondary" className="text-[10px]">
                  {trip.client_name}
                </Badge>
              )}
            </div>

            {/* ─── 360° Time Tracker Button ─────────────────── */}
            <Button
              variant="outline"
              className="w-full h-12 text-sm font-semibold gap-2 border-primary/30 hover:bg-primary/5"
              onClick={handleStart360CycleTracker}
              disabled={isStartingCycleTracker}
            >
              {isStartingCycleTracker ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              {isStartingCycleTracker ? "Saving Trip..." : "360° Time Tracker"}
              <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </Button>

            {/* ─── POD & KM Section ─────────────────────────── */}
            <div className="card-glass p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
                Trip Information
              </p>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">POD Number</Label>
                <Input
                  value={podNumber}
                  onChange={(e) => setPodNumber(e.target.value)}
                  placeholder="Enter POD number"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Starting KM</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={startingKm}
                      onChange={(e) => setStartingKm(e.target.value)}
                      placeholder="0"
                      className="h-11 pl-9 tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Ending KM</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={endingKm}
                      onChange={(e) => setEndingKm(e.target.value)}
                      placeholder="0"
                      className="h-11 pl-9 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Show calculated distance */}
              {startingKm && endingKm && parseFloat(endingKm) > parseFloat(startingKm) && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-success/10 border border-success/20">
                  <span className="text-xs text-muted-foreground">Calculated distance</span>
                  <span className="text-sm font-bold text-success tabular-nums">
                    {(parseFloat(endingKm) - parseFloat(startingKm)).toLocaleString()} km
                  </span>
                </div>
              )}

              <Button
                onClick={handleSaveTripInfo}
                disabled={isSavingTrip}
                className="w-full h-10 text-sm"
                variant={tripSaved ? "outline" : "default"}
              >
                {isSavingTrip ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : tripSaved ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                ) : null}
                {tripSaved ? "Saved!" : "Save Trip Info"}
              </Button>
            </div>

            {/* ─── Expenses Section ─────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em]">
                  Trip Expenses
                </p>
                <div className="flex items-center gap-2">
                  {(tripExpenses.length > 0 || systemExpenses.length > 0) && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ${(totalExpensesUsd + totalSystemExpensesUsd).toFixed(2)}
                    </span>
                  )}
                  {!showExpenseForm && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs gap-1"
                      onClick={() => setShowExpenseForm(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </Button>
                  )}
                </div>
              </div>

              {/* Pre-configured (system-generated) expenses */}
              {systemExpenses.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    Pre-configured Route Costs
                  </p>
                  <div className="space-y-1.5 opacity-70">
                    {systemExpenses.map((entry: CostEntry) => (
                      <ExpenseRow key={entry.id} entry={entry} isSystem />
                    ))}
                  </div>
                </div>
              )}

              {/* Driver-added expenses */}
              {loadingExpenses ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : tripExpenses.length === 0 && !showExpenseForm ? (
                <div className="card-glass p-6 text-center">
                  <Receipt className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {systemExpenses.length > 0
                      ? "No additional expenses added. Pre-configured costs are shown above."
                      : "No expenses for this trip"}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 h-9 text-xs gap-1"
                    onClick={() => setShowExpenseForm(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add {systemExpenses.length > 0 ? "Expense" : "First Expense"}
                  </Button>
                </div>
              ) : tripExpenses.length > 0 ? (
                <div className="space-y-1.5">
                  {systemExpenses.length > 0 && (
                    <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                      Your Expenses
                    </p>
                  )}
                  <div className="space-y-2">
                    {tripExpenses.map((entry: CostEntry) => (
                      <ExpenseRow key={entry.id} entry={entry} attachmentCount={attachmentCounts[entry.id] || 0} />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* ─── Add Expense Form ──────────────────────── */}
              {showExpenseForm && (
                <div className="card-glass p-4 space-y-3 border border-primary/20">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">New Expense</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => {
                        setShowExpenseForm(false);
                        setFormData(INITIAL_EXPENSE_FORM);
                        setErrors({});
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Category */}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Category *</Label>
                    <BottomSheetSelect
                      value={formData.category}
                      onValueChange={handleCategoryChange}
                      options={categoryOptions}
                      placeholder="Select category..."
                    />
                    {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
                  </div>

                  {/* Sub-category */}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Sub-category *</Label>
                    <SearchableSelect
                      value={formData.sub_category}
                      onValueChange={(v) => handleInputChange("sub_category", v)}
                      options={subCategoryOptions}
                      placeholder={formData.category ? "Search..." : "Select category first"}
                      searchPlaceholder="Type to search..."
                      disabled={!formData.category}
                    />
                    {errors.sub_category && <p className="text-xs text-destructive mt-1">{errors.sub_category}</p>}
                  </div>

                  {/* High-risk alert */}
                  {isHighRiskCategory && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Auto-flagged for review (high-risk category)
                    </div>
                  )}

                  {/* Currency toggle */}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Currency</Label>
                    <div className="flex rounded-lg border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleInputChange("currency", "ZAR")}
                        className={cn(
                          "flex-1 py-2.5 text-xs font-semibold transition-colors",
                          formData.currency === "ZAR" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"
                        )}
                      >
                        ZAR (R)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange("currency", "USD")}
                        className={cn(
                          "flex-1 py-2.5 text-xs font-semibold transition-colors",
                          formData.currency === "USD" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"
                        )}
                      >
                        USD ($)
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      Amount ({formData.currency === "ZAR" ? "R" : "$"}) *
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => handleInputChange("amount", e.target.value)}
                      placeholder="0.00"
                      className="h-12 text-xl font-bold tabular-nums"
                    />
                    {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
                  </div>

                  {/* ZAR preview */}
                  {formData.currency === "ZAR" && usdEquivalent && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-info/10 border border-info/20">
                      <span className="text-[10px] text-info">USD equivalent (÷ {ZAR_TO_USD_RATE})</span>
                      <span className="text-sm font-bold text-info tabular-nums">$ {usdEquivalent}</span>
                    </div>
                  )}

                  {/* Date + Ref */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Date *</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange("date", e.target.value)}
                        className="h-10 text-xs"
                      />
                      {errors.date && <p className="text-xs text-destructive mt-1">{errors.date}</p>}
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Ref # *</Label>
                      <Input
                        value={formData.reference_number}
                        onChange={(e) => handleInputChange("reference_number", e.target.value)}
                        placeholder="INV-123"
                        className="h-10 text-xs"
                      />
                      {errors.reference_number && <p className="text-xs text-destructive mt-1">{errors.reference_number}</p>}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      placeholder="Optional details..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  {/* Receipt Upload */}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      <Paperclip className="w-3 h-3 inline mr-1" />
                      Receipt / Proof ({receiptFiles.length}/5)
                    </Label>
                    <div className="flex gap-2">
                      {/* Camera capture */}
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={receiptFiles.length >= 5}
                        />
                        <div className={cn(
                          "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
                          receiptFiles.length >= 5
                            ? "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
                            : "border-primary/40 text-primary hover:bg-primary/5 active:scale-[0.98]"
                        )}>
                          <Camera className="w-4 h-4" />
                          <span className="text-xs font-medium">Camera</span>
                        </div>
                      </label>
                      {/* File/gallery picker */}
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={receiptFiles.length >= 5}
                        />
                        <div className={cn(
                          "flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed transition-colors",
                          receiptFiles.length >= 5
                            ? "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
                            : "border-primary/40 text-primary hover:bg-primary/5 active:scale-[0.98]"
                        )}>
                          <ImageIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">Gallery</span>
                        </div>
                      </label>
                    </div>

                    {/* File previews */}
                    {receiptFiles.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {receiptFiles.map((file, idx) => (
                          <div key={idx} className="relative group">
                            {receiptPreviews[idx] ? (
                              <img
                                src={receiptPreviews[idx]}
                                alt={file.name}
                                className="w-16 h-16 rounded-lg object-cover border border-border/50"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted/30 border border-border/50 flex flex-col items-center justify-center">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <span className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-[56px]">
                                  {file.name.split(".").pop()?.toUpperCase()}
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              title="Remove file"
                              onClick={() => removeFile(idx)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Flag */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleInputChange("is_flagged", !formData.is_flagged)}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                        formData.is_flagged ? "bg-warning border-warning" : "border-muted-foreground/40"
                      )}
                    >
                      {formData.is_flagged && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className="text-xs text-muted-foreground">Flag for investigation</span>
                    {formData.is_flagged && (
                      <Flag className="w-4 h-4 text-warning ml-auto" />
                    )}
                  </div>

                  {formData.is_flagged && (
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Flag reason *</Label>
                      <Textarea
                        value={formData.flag_reason}
                        onChange={(e) => handleInputChange("flag_reason", e.target.value)}
                        placeholder="Why flag this expense?"
                        rows={2}
                        className="text-xs"
                      />
                      {errors.flag_reason && <p className="text-xs text-destructive mt-1">{errors.flag_reason}</p>}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={validateAndSubmit}
                    disabled={addExpenseMutation.isPending || isUploading}
                    className="w-full h-10 text-sm font-semibold"
                  >
                    {addExpenseMutation.isPending || isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    {isUploading ? "Uploading receipts..." : addExpenseMutation.isPending ? "Saving..." : receiptFiles.length > 0 ? `Save with ${receiptFiles.length} receipt${receiptFiles.length > 1 ? "s" : ""}` : "Save Expense"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 360° Cycle Tracker Form */}
      <CycleTrackerForm
        trip={trip}
        open={showCycleTracker}
        onOpenChange={setShowCycleTracker}
      />
    </>
  );
}

// ─── Expense Row Sub-component ───────────────────────────────────────

function ExpenseRow({ entry, attachmentCount = 0, isSystem = false }: { entry: CostEntry; attachmentCount?: number; isSystem?: boolean }) {
  return (
    <div className={cn("card-glass p-3 space-y-1.5", isSystem && "border border-dashed border-muted-foreground/20")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant={isSystem ? "outline" : entry.is_flagged ? "destructive" : "secondary"}
            className="text-[10px] shrink-0"
          >
            {entry.category}
          </Badge>
          {isSystem && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              Auto
            </span>
          )}
          {entry.is_flagged && (
            <Flag className="w-3 h-3 text-warning shrink-0" />
          )}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-primary/80">
              <Paperclip className="w-3 h-3" />
              {attachmentCount}
            </span>
          )}
        </div>
        <span className="text-sm font-bold tabular-nums shrink-0">
          ${entry.amount.toFixed(2)}
        </span>
      </div>
      {entry.sub_category && (
        <p className="text-xs text-muted-foreground truncate">{entry.sub_category}</p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <Calendar className="w-2.5 h-2.5" />
          {formatDate(entry.date)}
        </span>
        {entry.reference_number && (
          <span className="flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" />
            {entry.reference_number}
          </span>
        )}
      </div>
      {entry.notes && (
        <p className="text-[10px] text-muted-foreground/60 line-clamp-1 flex items-center gap-1">
          <FileText className="w-2.5 h-2.5 shrink-0" />
          {entry.notes}
        </p>
      )}
    </div>
  );
}