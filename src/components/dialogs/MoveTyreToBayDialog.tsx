import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";

type BayTyre = Database["public"]["Tables"]["tyres"]["Row"];
type BayPosition = "holding-bay" | "retread-bay" | "scrap" | "sold";

const BAY_LABELS: Record<string, string> = {
    "holding-bay": "Holding Bay",
    "main-warehouse": "Holding Bay",
    "retread-bay": "Retread Bay",
    "scrap": "Scrap",
    "sold": "Sold",
};

const DESTINATIONS: { value: BayPosition; label: string }[] = [
    { value: "holding-bay", label: "Holding Bay" },
    { value: "retread-bay", label: "Retread Bay" },
    { value: "scrap", label: "Scrap" },
    { value: "sold", label: "Sold" },
];

interface MoveTyreToBayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tyre: BayTyre | null;
    onMoved: () => void;
}

const MoveTyreToBayDialog = ({ open, onOpenChange, tyre, onMoved }: MoveTyreToBayDialogProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [destination, setDestination] = useState<BayPosition>("holding-bay");
    const [notes, setNotes] = useState("");

    const currentPosition = tyre?.position || "holding-bay";
    const currentLabel = BAY_LABELS[currentPosition] || "Holding Bay";

    // Filter out current position from destinations
    const availableDestinations = DESTINATIONS.filter(d => {
        if (currentPosition === "main-warehouse" || !currentPosition) {
            return d.value !== "holding-bay";
        }
        return d.value !== currentPosition;
    });

    // Reset form when tyre changes
    useEffect(() => {
        if (tyre && open) {
            setNotes("");
            // Default to first available destination
            const current = tyre.position || "holding-bay";
            const first = DESTINATIONS.find(d => {
                if (current === "main-warehouse" || !current) return d.value !== "holding-bay";
                return d.value !== current;
            });
            setDestination(first?.value || "holding-bay");
        }
    }, [tyre, open]);

    const handleMove = async () => {
        if (!tyre) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from("tyres")
                .update({
                    position: destination,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", tyre.id);

            if (error) throw error;

            // Create position history entry
            const action = destination === "scrap" ? "scrapped" :
                destination === "sold" ? "sold" : "moved_to_bay";

            await supabase.from("tyre_position_history").insert({
                tyre_id: tyre.id,
                vehicle_id: null,
                action,
                fleet_position: destination,
                from_position: currentPosition,
                to_position: destination,
                km_reading: null,
                performed_by: "System",
                notes: notes.trim() || `Tyre moved from ${currentLabel} to ${BAY_LABELS[destination]}`,
            });

            toast({
                title: "Tyre Moved",
                description: `${tyre.serial_number || tyre.brand + " " + tyre.model} moved to ${BAY_LABELS[destination]}`,
            });
            requestGoogleSheetsSync("tyres");
            onMoved();
            onOpenChange(false);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to move tyre",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!tyre) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5" />
                        Move Tyre to Store
                    </DialogTitle>
                    <DialogDescription>
                        Move <span className="font-semibold">{tyre.serial_number || `${tyre.brand} ${tyre.model}`}</span> to a different store
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Current Location</Label>
                        <div className="px-3 py-2 bg-muted/50 rounded-md text-sm font-medium">
                            {currentLabel}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="destination">Move To *</Label>
                        <Select value={destination} onValueChange={(v) => setDestination(v as BayPosition)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select destination" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDestinations.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Reason for moving..."
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleMove} disabled={loading}>
                        {loading ? "Moving..." : `Move to ${BAY_LABELS[destination]}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MoveTyreToBayDialog;
