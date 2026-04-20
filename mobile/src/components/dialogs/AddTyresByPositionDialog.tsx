import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, ShoppingCart, Truck, AlertCircle } from "lucide-react";
import { getFleetConfig } from "@/constants/fleetTyreConfig";

interface HoldingBayTyre {
  id: string;
  brand: string;
  model: string | null;
  size: string;
  type: string | null;
  serial_number: string | null;
  condition: string | null;
  current_tread_depth: number | null;
  purchase_cost_zar: number | null;
  position: string | null;
  notes: string | null;
}

interface PositionRow {
  positionCode: string;
  label: string;
  source: "holding-bay" | "procure";
  selectedTyreId: string | null;
  tyreSize: string;
  tyreType: string;
  notes: string;
}

interface AddTyresByPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId: string;
  vehicleId: string | null;
  fleetNumber: string | null;
  jobNumber: string | null;
  onComplete: () => void;
}

const AddTyresByPositionDialog = ({
  open,
  onOpenChange,
  jobCardId,
  vehicleId: _vehicleId,
  fleetNumber,
  jobNumber,
  onComplete,
}: AddTyresByPositionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [positionRows, setPositionRows] = useState<Record<string, PositionRow>>({});
  const [submitting, setSubmitting] = useState(false);

  const fleetConfig = useMemo(() => {
    if (!fleetNumber) return null;
    return getFleetConfig(fleetNumber);
  }, [fleetNumber]);

  const allPositions = useMemo(() => {
    if (!fleetConfig) return [];
    return fleetConfig.positions;
  }, [fleetConfig]);

  const { data: existingRequests = [] } = useQuery({
    queryKey: ["existing_tyre_requests", jobCardId],
    queryFn: async () => {
      const { data } = await supabase
        .from("parts_requests")
        .select("target_position, status")
        .eq("job_card_id", jobCardId)
        .not("target_position", "is", null);
      return (data || []) as { target_position: string | null; status: string }[];
    },
    enabled: open && !!jobCardId,
  });

  const alreadyRequestedPositions = existingRequests
    .filter(r => r.status !== "cancelled")
    .map(r => r.target_position)
    .filter(Boolean) as string[];

  const { data: holdingBayTyres = [] } = useQuery({
    queryKey: ["holding_bay_tyres_for_positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyres")
        .select("id, brand, model, size, type, serial_number, condition, current_tread_depth, purchase_cost_zar, position, notes")
        .is("current_fleet_position", null)
        .or("position.eq.holding-bay,position.eq.main-warehouse,position.is.null")
        .order("brand");
      if (error) throw error;
      return (data || []) as HoldingBayTyre[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelectedPositions([]);
      setPositionRows({});
    }
  }, [open]);

  const togglePosition = (code: string, label: string) => {
    setSelectedPositions(prev => {
      const next = prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code];
      if (!prev.includes(code)) {
        setPositionRows(rows => ({
          ...rows,
          [code]: {
            positionCode: code,
            label,
            source: holdingBayTyres.length > 0 ? "holding-bay" : "procure",
            selectedTyreId: null,
            tyreSize: "315/80R22.5",
            tyreType: code.startsWith("V") ? "Steer" : "Trailer",
            notes: "",
          },
        }));
      }
      return next;
    });
  };

  const updateRow = (code: string, updates: Partial<PositionRow>) => {
    setPositionRows(rows => ({ ...rows, [code]: { ...rows[code], ...updates } }));
  };

  const handleSubmit = async () => {
    if (selectedPositions.length === 0) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const code of selectedPositions) {
        const row = positionRows[code];
        if (!row) continue;

        if (row.source === "holding-bay" && row.selectedTyreId) {
          const selectedTyre = holdingBayTyres.find(t => t.id === row.selectedTyreId);
          await supabase.from("parts_requests").insert({
            job_card_id: jobCardId,
            part_name: `Tyre - ${selectedTyre?.brand || ""} ${selectedTyre?.model || ""} ${selectedTyre?.size || ""}`.trim(),
            part_number: selectedTyre?.serial_number || null,
            quantity: 1,
            status: "fulfilled",
            notes: `Position ${code} (${row.label}) | From holding bay`,
            tyre_id: row.selectedTyreId,
            target_position: code,
            unit_price: selectedTyre?.purchase_cost_zar || null,
            total_price: selectedTyre?.purchase_cost_zar || null,
            is_from_inventory: true,
            allocated_to_job_card: true,
            allocated_at: new Date().toISOString(),
            requested_by: user?.email || "system",
          });
          await supabase.from("tyres").update({
            position: "allocated",
            notes: `Allocated to ${fleetNumber || "vehicle"} position ${code} via job ${jobNumber || jobCardId}`,
          }).eq("id", row.selectedTyreId);
        } else {
          await supabase.from("parts_requests").insert({
            job_card_id: jobCardId,
            part_name: `Tyre - ${row.tyreSize} ${row.tyreType}`,
            part_number: null,
            quantity: 1,
            status: "pending",
            notes: `Position ${code} (${row.label}) for ${fleetNumber || "vehicle"}${row.notes ? " | " + row.notes : ""}`,
            target_position: code,
            requested_by: user?.email || "system",
          });
        }
      }

      toast({
        title: "Tyres Added",
        description: `${selectedPositions.length} tyre request(s) created for positions: ${selectedPositions.join(", ")}`,
      });

      queryClient.invalidateQueries({ queryKey: ["existing_tyre_requests", jobCardId] });
      queryClient.invalidateQueries({ queryKey: ["holding_bay_tyres_for_positions"] });
      onComplete();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create tyre requests",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Add Tyres by Position
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select positions on {fleetNumber || "vehicle"} needing tyres.
          </DialogDescription>
        </DialogHeader>

        {!fleetConfig ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>No configuration for &quot;{fleetNumber}&quot;.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Select Positions</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {allPositions.map(pos => {
                  const isRequested = alreadyRequestedPositions.includes(pos.position);
                  const isSelected = selectedPositions.includes(pos.position);
                  return (
                    <div
                      key={pos.position}
                      className={`flex items-center gap-1 p-1.5 rounded border text-xs cursor-pointer transition-all
                        ${isRequested ? "opacity-40 cursor-not-allowed bg-muted" : ""}
                        ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-muted"}
                      `}
                      onClick={() => !isRequested && togglePosition(pos.position, pos.label)}
                    >
                      <Checkbox checked={isSelected} disabled={isRequested} className="h-3 w-3" />
                      <span className="font-mono font-bold">{pos.position}</span>
                      {isRequested && <Badge variant="secondary" className="text-[8px] px-0.5 py-0 ml-auto">req</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedPositions.length > 0 && <Separator />}

            {selectedPositions.map(code => {
              const row = positionRows[code];
              if (!row) return null;
              return (
                <div key={code} className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge className="font-mono text-xs">{code}</Badge>
                      <span className="text-[10px] text-muted-foreground">{row.label}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={row.source === "holding-bay" ? "default" : "outline"}
                        className="h-6 text-[10px] px-2"
                        onClick={() => updateRow(code, { source: "holding-bay", selectedTyreId: null })}
                        disabled={holdingBayTyres.length === 0}
                      >
                        <Package className="h-2.5 w-2.5 mr-0.5" />
                        Bay
                      </Button>
                      <Button
                        size="sm"
                        variant={row.source === "procure" ? "default" : "outline"}
                        className="h-6 text-[10px] px-2"
                        onClick={() => updateRow(code, { source: "procure", selectedTyreId: null })}
                      >
                        <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
                        New
                      </Button>
                    </div>
                  </div>

                  {row.source === "holding-bay" ? (
                    holdingBayTyres.length === 0 ? (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        Empty.
                        <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => updateRow(code, { source: "procure" })}>
                          Procure instead
                        </Button>
                      </div>
                    ) : (
                      <Select value={row.selectedTyreId || ""} onValueChange={v => updateRow(code, { selectedTyreId: v })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select tyre..." />
                        </SelectTrigger>
                        <SelectContent>
                          {holdingBayTyres
                            .filter(t => {
                              const otherSelected = Object.entries(positionRows)
                                .filter(([k]) => k !== code)
                                .map(([, v]) => v.selectedTyreId)
                                .filter(Boolean);
                              return !otherSelected.includes(t.id);
                            })
                            .map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.brand} {t.model} - {t.size} (SN: {t.serial_number || "N/A"})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[10px]">Size</Label>
                        <Input value={row.tyreSize} onChange={e => updateRow(code, { tyreSize: e.target.value })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Type</Label>
                        <Select value={row.tyreType} onValueChange={v => updateRow(code, { tyreType: v })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Steer">Steer</SelectItem>
                            <SelectItem value="Drive">Drive</SelectItem>
                            <SelectItem value="Trailer">Trailer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || selectedPositions.length === 0 || selectedPositions.some(c => {
              const r = positionRows[c];
              return r?.source === "holding-bay" && !r?.selectedTyreId;
            })}
          >
            {submitting ? "Adding..." : `Add ${selectedPositions.length} Tyre(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddTyresByPositionDialog;
