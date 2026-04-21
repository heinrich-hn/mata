import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles } from "@/hooks/useVehicles";

export type ToolRecord = {
  id: string;
  serial_number: string;
  name: string;
  quantity: number;
  description: string | null;
  tool_type: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  barcode: string | null;
  location: string | null;
  department: string | null;
  linked_vehicle_id: string | null;
  purchase_vendor: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  status: string;
  reading: string | null;
  last_service_date: string | null;
  warranty_expiry_date: string | null;
  image_url: string | null;
};

interface AssignmentRow {
  id?: string;
  vehicle_id: string;
  quantity: number;
  notes: string;
}

interface AddEditToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: ToolRecord | null;
}

const STATUS_OPTIONS: { value: ToolRecord["status"]; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "in_use", label: "In Use" },
  { value: "maintenance", label: "In Maintenance" },
  { value: "lost", label: "Lost" },
  { value: "retired", label: "Retired" },
];

const emptyForm = {
  serial_number: "",
  name: "",
  quantity: "1",
  description: "",
  tool_type: "",
  manufacturer: "",
  model: "",
  year: "",
  barcode: "",
  location: "",
  department: "",
  purchase_vendor: "",
  purchase_price: "",
  purchase_date: "",
  status: "available" as ToolRecord["status"],
  reading: "",
  last_service_date: "",
  warranty_expiry_date: "",
  image_url: "",
};

export default function AddEditToolDialog({
  open,
  onOpenChange,
  tool,
}: AddEditToolDialogProps) {
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [form, setForm] = useState(emptyForm);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: existingAssignments = [] } = useQuery<AssignmentRow[]>({
    queryKey: ["tool-assignments", tool?.id],
    enabled: !!tool?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_assignments")
        .select("id, vehicle_id, quantity, notes")
        .eq("tool_id", tool!.id);
      if (error) throw error;
      return (data || []).map((a) => ({
        id: a.id,
        vehicle_id: a.vehicle_id,
        quantity: a.quantity,
        notes: a.notes ?? "",
      }));
    },
  });

  useEffect(() => {
    if (open) {
      if (tool) {
        setForm({
          serial_number: tool.serial_number ?? "",
          name: tool.name ?? "",
          quantity: String(tool.quantity ?? 1),
          description: tool.description ?? "",
          tool_type: tool.tool_type ?? "",
          manufacturer: tool.manufacturer ?? "",
          model: tool.model ?? "",
          year: tool.year ? String(tool.year) : "",
          barcode: tool.barcode ?? "",
          location: tool.location ?? "",
          department: tool.department ?? "",
          purchase_vendor: tool.purchase_vendor ?? "",
          purchase_price:
            tool.purchase_price !== null && tool.purchase_price !== undefined
              ? String(tool.purchase_price)
              : "",
          purchase_date: tool.purchase_date ?? "",
          status: (tool.status as ToolRecord["status"]) ?? "available",
          reading: tool.reading ?? "",
          last_service_date: tool.last_service_date ?? "",
          warranty_expiry_date: tool.warranty_expiry_date ?? "",
          image_url: tool.image_url ?? "",
        });
      } else {
        setForm(emptyForm);
        setAssignments([]);
      }
    }
  }, [open, tool]);

  useEffect(() => {
    if (open && tool?.id) setAssignments(existingAssignments);
  }, [open, tool?.id, existingAssignments]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const totalQty = parseInt(form.quantity, 10) || 0;
  const allocated = useMemo(
    () => assignments.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0),
    [assignments]
  );
  const remaining = totalQty - allocated;

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `tools/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(path);
      update("image_url", publicUrl);
      toast.success("Image uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const addAssignmentRow = () =>
    setAssignments((rows) => [
      ...rows,
      { vehicle_id: "", quantity: 1, notes: "" },
    ]);

  const updateAssignmentRow = (
    idx: number,
    patch: Partial<AssignmentRow>
  ) =>
    setAssignments((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );

  const removeAssignmentRow = (idx: number) =>
    setAssignments((rows) => rows.filter((_, i) => i !== idx));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.serial_number.trim()) throw new Error("Serial Number is required");
      if (!form.name.trim()) throw new Error("Tool Name is required");
      const qty = parseInt(form.quantity, 10);
      if (Number.isNaN(qty) || qty < 0) throw new Error("Quantity must be 0 or greater");

      const cleaned: AssignmentRow[] = [];
      const seenVehicles = new Set<string>();
      for (const row of assignments) {
        if (!row.vehicle_id) continue;
        if (seenVehicles.has(row.vehicle_id)) {
          throw new Error("Each vehicle can only be assigned once per tool");
        }
        if (!row.quantity || row.quantity <= 0) {
          throw new Error("Assignment quantity must be greater than 0");
        }
        seenVehicles.add(row.vehicle_id);
        cleaned.push(row);
      }
      const totalAllocated = cleaned.reduce((s, r) => s + r.quantity, 0);
      if (totalAllocated > qty) {
        throw new Error(
          `Total assigned (${totalAllocated}) exceeds tool quantity (${qty})`
        );
      }

      const payload = {
        serial_number: form.serial_number.trim(),
        name: form.name.trim(),
        quantity: qty,
        description: form.description.trim() || null,
        tool_type: form.tool_type.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? parseInt(form.year, 10) : null,
        barcode: form.barcode.trim() || null,
        location: form.location.trim() || null,
        department: form.department.trim() || null,
        purchase_vendor: form.purchase_vendor.trim() || null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date: form.purchase_date || null,
        status: form.status,
        reading: form.reading.trim() || null,
        last_service_date: form.last_service_date || null,
        warranty_expiry_date: form.warranty_expiry_date || null,
        image_url: form.image_url || null,
      };

      let toolId = tool?.id;
      if (toolId) {
        const { error } = await supabase
          .from("tools")
          .update(payload)
          .eq("id", toolId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tools")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toolId = data.id;
      }

      const existingIds = new Set(
        existingAssignments.map((a) => a.id).filter(Boolean) as string[]
      );
      const keptIds = new Set(
        cleaned.map((a) => a.id).filter(Boolean) as string[]
      );
      const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("tool_assignments")
          .delete()
          .in("id", toDelete);
        if (error) throw error;
      }

      for (const row of cleaned) {
        if (row.id) {
          const { error } = await supabase
            .from("tool_assignments")
            .update({
              vehicle_id: row.vehicle_id,
              quantity: row.quantity,
              notes: row.notes || null,
            })
            .eq("id", row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("tool_assignments").insert({
            tool_id: toolId,
            vehicle_id: row.vehicle_id,
            quantity: row.quantity,
            notes: row.notes || null,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(tool ? "Tool updated" : "Tool added");
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["tool-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-tools"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save tool");
    },
  });

  const vehicleOptions = (currentRowVehicleId: string) => {
    const usedElsewhere = new Set(
      assignments
        .map((a) => a.vehicle_id)
        .filter((id) => id && id !== currentRowVehicleId)
    );
    return vehicles.filter((v) => !usedElsewhere.has(v.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tool ? "Edit Tool" : "Add Tool"}</DialogTitle>
          <DialogDescription>
            Capture tool details, allocate to vehicles, and track purchase &amp; maintenance lifecycle.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-6 py-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>

              <Field label="Serial Number" required>
                <Input
                  value={form.serial_number}
                  onChange={(e) => update("serial_number", e.target.value)}
                  required
                />
              </Field>

              <Field label="Tool Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>

              <Field label="Total Quantity" required>
                <Input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  required
                />
              </Field>

              <Field label="Description">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>

              <Field label="Tool Type">
                <Input
                  value={form.tool_type}
                  onChange={(e) => update("tool_type", e.target.value)}
                  placeholder="e.g. Power Tool, Hand Tool"
                />
              </Field>

              <Field label="Manufacturer">
                <Input
                  value={form.manufacturer}
                  onChange={(e) => update("manufacturer", e.target.value)}
                />
              </Field>

              <Field label="Model">
                <Input
                  value={form.model}
                  onChange={(e) => update("model", e.target.value)}
                />
              </Field>

              <Field label="Year">
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => update("year", e.target.value)}
                />
              </Field>

              <Field label="Barcode">
                <Input
                  value={form.barcode}
                  onChange={(e) => update("barcode", e.target.value)}
                />
              </Field>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Location</h3>

              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </Field>

              <Field label="Department">
                <Input
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                />
              </Field>

              <h3 className="text-sm font-semibold text-foreground pt-2">
                Financial Information
              </h3>

              <Field label="Purchase Vendor">
                <Input
                  value={form.purchase_vendor}
                  onChange={(e) => update("purchase_vendor", e.target.value)}
                />
              </Field>

              <Field label="Purchase Price">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.purchase_price}
                  onChange={(e) => update("purchase_price", e.target.value)}
                />
              </Field>

              <Field label="Purchase Date">
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => update("purchase_date", e.target.value)}
                />
              </Field>

              <h3 className="text-sm font-semibold text-foreground pt-2">
                Maintenance Lifecycle
              </h3>

              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) => update("status", v as ToolRecord["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Reading">
                <Input
                  value={form.reading}
                  onChange={(e) => update("reading", e.target.value)}
                  placeholder="e.g. hours, cycles"
                />
              </Field>

              <Field label="Last Service Date">
                <Input
                  type="date"
                  value={form.last_service_date}
                  onChange={(e) => update("last_service_date", e.target.value)}
                />
              </Field>

              <Field label="Warranty Expiry Date">
                <Input
                  type="date"
                  value={form.warranty_expiry_date}
                  onChange={(e) => update("warranty_expiry_date", e.target.value)}
                />
              </Field>

              <Field label="Image">
                <div className="flex items-center gap-3">
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt="Tool"
                      className="h-12 w-12 rounded border object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded border border-dashed bg-muted/40" />
                  )}
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                    <Button type="button" variant="default" size="sm" asChild>
                      <span className="cursor-pointer inline-flex items-center gap-1">
                        {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload Photo
                      </span>
                    </Button>
                  </label>
                </div>
              </Field>
            </div>
          </div>

          {/* Vehicle Assignments */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Vehicle Assignments
                </h3>
                <p className="text-xs text-muted-foreground">
                  Allocate portions of the total quantity to specific vehicles.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full bg-background border px-2 py-1">
                  Total: <span className="font-semibold tabular-nums">{totalQty}</span>
                </span>
                <span className="rounded-full bg-background border px-2 py-1">
                  Allocated: <span className="font-semibold tabular-nums">{allocated}</span>
                </span>
                <span
                  className={`rounded-full border px-2 py-1 ${
                    remaining < 0
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-background"
                  }`}
                >
                  Remaining: <span className="font-semibold tabular-nums">{remaining}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAssignmentRow}
                  className="h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Vehicle
                </Button>
              </div>
            </div>

            {assignments.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg bg-background/40">
                No vehicle assignments yet. Click "Add Vehicle" to allocate.
              </div>
            ) : (
              <div className="rounded-lg border bg-background overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="w-[120px]">Quantity</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((row, idx) => (
                      <TableRow key={row.id ?? `new-${idx}`}>
                        <TableCell>
                          <Select
                            value={row.vehicle_id || undefined}
                            onValueChange={(v) =>
                              updateAssignmentRow(idx, { vehicle_id: v })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select vehicle" />
                            </SelectTrigger>
                            <SelectContent>
                              {vehicleOptions(row.vehicle_id).map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.fleet_number ? `${v.fleet_number} — ` : ""}
                                  {v.registration_number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            className="h-9"
                            value={row.quantity}
                            onChange={(e) =>
                              updateAssignmentRow(idx, {
                                quantity: parseInt(e.target.value, 10) || 0,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-9"
                            value={row.notes}
                            onChange={(e) =>
                              updateAssignmentRow(idx, { notes: e.target.value })
                            }
                            placeholder="Optional notes"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeAssignmentRow(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {tool ? "Save Changes" : "Add Tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <Label className="text-sm text-muted-foreground text-right">
        {required && <span className="text-destructive mr-0.5">*</span>}
        {label}:
      </Label>
      {children}
    </div>
  );
}
