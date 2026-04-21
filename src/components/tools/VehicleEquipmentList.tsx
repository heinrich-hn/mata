import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VehicleEquipmentListProps {
  vehicleId: string;
}

type Row = {
  id: string;
  quantity: number;
  notes: string | null;
  tool: {
    id: string;
    name: string;
    serial_number: string;
    tool_type: string | null;
    manufacturer: string | null;
    model: string | null;
    status: string;
  } | null;
};

export default function VehicleEquipmentList({ vehicleId }: VehicleEquipmentListProps) {
  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["vehicle-tools", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_assignments")
        .select(
          `id,
           quantity,
           notes,
           tool:tool_id(id, name, serial_number, tool_type, manufacturer, model, status)`
        )
        .eq("vehicle_id", vehicleId)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Loading equipment…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wrench className="h-6 w-6 mx-auto mb-2 opacity-60" />
        <p className="text-sm">No tools or equipment assigned to this vehicle.</p>
      </div>
    );
  }

  const totalItems = rows.reduce((s, r) => s + (r.quantity || 0), 0);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {rows.length} tool type{rows.length !== 1 ? "s" : ""} •{" "}
        <span className="font-semibold tabular-nums">{totalItems}</span> total items
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.tool?.name ?? "—"}</div>
                  {(r.tool?.manufacturer || r.tool?.model) && (
                    <div className="text-xs text-muted-foreground">
                      {r.tool?.manufacturer}
                      {r.tool?.manufacturer && r.tool?.model ? " • " : ""}
                      {r.tool?.model}
                    </div>
                  )}
                </TableCell>
                <TableCell>{r.tool?.tool_type ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.tool?.serial_number ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.quantity}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.notes || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
