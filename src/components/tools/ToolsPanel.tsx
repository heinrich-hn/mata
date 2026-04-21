import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import AddEditToolDialog, { ToolRecord } from "./AddEditToolDialog";

type AssignmentSummary = {
  id: string;
  quantity: number;
  vehicle: {
    id: string;
    fleet_number: string | null;
    registration_number: string;
  } | null;
};

type ToolWithAssignments = ToolRecord & {
  assignments: AssignmentSummary[];
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  available: { label: "Available", tone: "bg-emerald-100 text-emerald-700" },
  in_use: { label: "In Use", tone: "bg-blue-100 text-blue-700" },
  maintenance: { label: "Maintenance", tone: "bg-amber-100 text-amber-700" },
  lost: { label: "Lost", tone: "bg-rose-100 text-rose-700" },
  retired: { label: "Retired", tone: "bg-muted text-muted-foreground" },
};

export default function ToolsPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ToolRecord | null>(null);
  const [toDelete, setToDelete] = useState<ToolRecord | null>(null);

  const { data: tools = [], isLoading } = useQuery<ToolWithAssignments[]>({
    queryKey: ["tools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tools")
        .select(
          `*,
           assignments:tool_assignments(
             id,
             quantity,
             vehicle:vehicle_id(id, fleet_number, registration_number)
           )`
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ToolWithAssignments[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tools.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.serial_number.toLowerCase().includes(q) ||
        (t.barcode || "").toLowerCase().includes(q) ||
        (t.tool_type || "").toLowerCase().includes(q) ||
        (t.manufacturer || "").toLowerCase().includes(q)
      );
    });
  }, [tools, search, statusFilter]);

  const stats = useMemo(() => {
    const total = tools.length;
    const totalQty = tools.reduce((s, t) => s + (t.quantity || 0), 0);
    const allocated = tools.reduce(
      (s, t) =>
        s + (t.assignments || []).reduce((ss, a) => ss + (a.quantity || 0), 0),
      0
    );
    const unallocated = totalQty - allocated;
    return { total, totalQty, allocated, unallocated };
  }, [tools]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tool deleted");
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-tools"] });
      setToDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete tool");
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
        <KpiChip dotClass="bg-slate-400" label="Tool types" value={stats.total} />
        <KpiChip dotClass="bg-emerald-500" label="Total qty" value={stats.totalQty} />
        <KpiChip dotClass="bg-blue-500" label="Allocated" value={stats.allocated} />
        <KpiChip
          dotClass="bg-amber-500"
          label="Unallocated"
          value={stats.unallocated}
        />

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, serial, barcode…"
              className="h-9 w-[260px] pl-8 bg-background"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, s]) => (
                <SelectItem key={v} value={v}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="h-9 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Tool
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Loading tools…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  <Wrench className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  No tools found. Click "Add Tool" to create your first one.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const status = STATUS_LABELS[t.status] || {
                  label: t.status,
                  tone: "bg-muted",
                };
                const allocatedQty = (t.assignments || []).reduce(
                  (s, a) => s + (a.quantity || 0),
                  0
                );
                const assignedVehicleCount = (t.assignments || []).filter(
                  (a) => a.vehicle
                ).length;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.image_url ? (
                          <img
                            src={t.image_url}
                            alt={t.name}
                            className="h-8 w-8 rounded border object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded border bg-muted/40 flex items-center justify-center">
                            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{t.name}</div>
                          {t.manufacturer && (
                            <div className="text-xs text-muted-foreground">
                              {t.manufacturer}
                              {t.model ? ` • ${t.model}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.serial_number}
                    </TableCell>
                    <TableCell>{t.tool_type || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.quantity}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${status.tone} hover:${status.tone} border-transparent`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {assignedVehicleCount === 0 ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 text-sm cursor-default">
                                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="tabular-nums font-medium">
                                  {allocatedQty}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="tabular-nums">{t.quantity}</span>
                                <span className="text-xs text-muted-foreground">
                                  • {assignedVehicleCount} vehicle
                                  {assignedVehicleCount !== 1 ? "s" : ""}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                {(t.assignments || [])
                                  .filter((a) => a.vehicle)
                                  .map((a) => (
                                    <div key={a.id} className="flex justify-between gap-3">
                                      <span>
                                        {a.vehicle!.fleet_number
                                          ? `${a.vehicle!.fleet_number} — `
                                          : ""}
                                        {a.vehicle!.registration_number}
                                      </span>
                                      <span className="font-semibold tabular-nums">
                                        {a.quantity}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell>{t.location || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(t);
                            setDialogOpen(true);
                          }}
                          title="View / Edit"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(t);
                            setDialogOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setToDelete(t)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddEditToolDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        tool={editing}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tool?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{toDelete?.name}" and all its vehicle
              assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiChip({
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-background border px-3 py-1.5 shadow-xs">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
