import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VehicleFault {
    id: string;
    fault_description: string;
    severity: string;
    status: string;
    fault_number: string | null;
    inspection_fault_id?: string | null;
    inspection_id?: string | null;
}

interface ResolveFaultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fault: VehicleFault | null;
    onCompleted?: () => void;
}

const ResolveFaultDialog = ({
    open,
    onOpenChange,
    fault,
    onCompleted,
}: ResolveFaultDialogProps) => {
    const { userName } = useAuth();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("fixed");
    const [notes, setNotes] = useState("");
    const isResolved = fault?.status === "resolved";

    const handleSubmit = async () => {
        if (!fault) return;

        setLoading(true);
        try {
            // Update the vehicle_fault
            const resolvedStatuses = ["fixed", "no_need"];
            const vehicleFaultStatus = resolvedStatuses.includes(status) ? "resolved" : "acknowledged";

            const { error } = await supabase
                .from("vehicle_faults")
                .update({
                    status: vehicleFaultStatus,
                    resolution_notes: notes || `Corrective action: ${status}`,
                    resolved_date: vehicleFaultStatus === "resolved" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", fault.id);

            if (error) throw error;

            // Also update the linked inspection_fault if one exists
            if (fault.inspection_fault_id) {
                await supabase
                    .from("inspection_faults")
                    .update({
                        corrective_action_status: status,
                        corrective_action_notes: notes || null,
                        corrective_action_date: new Date().toISOString(),
                        corrective_action_by: userName || "Unknown User",
                    })
                    .eq("id", fault.inspection_fault_id);

                // Re-check if all faults on the inspection are resolved
                if (fault.inspection_id) {
                    const { data: allFaults } = await supabase
                        .from("inspection_faults")
                        .select("corrective_action_status")
                        .eq("inspection_id", fault.inspection_id);

                    const allResolved = (allFaults || []).every(f =>
                        ["fixed", "completed", "no_need"].includes(f.corrective_action_status || "")
                    );

                    await supabase
                        .from("vehicle_inspections")
                        .update({ fault_resolved: allResolved })
                        .eq("id", fault.inspection_id);
                }
            }

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
            queryClient.invalidateQueries({ queryKey: ["vehicle-faults-mobile"] });
            queryClient.invalidateQueries({ queryKey: ["inspection_faults"] });
            queryClient.invalidateQueries({ queryKey: ["inspections-mobile"] });
            queryClient.invalidateQueries({ queryKey: ["open-faults-count"] });

            toast.success(`${fault.fault_number || "Fault"} updated — ${status.replace("_", " ")}`);
            setStatus("fixed");
            setNotes("");
            onCompleted?.();
            onOpenChange(false);
        } catch (error) {
            console.error("Error resolving fault:", error);
            toast.error(error instanceof Error ? error.message : "Failed to resolve fault");
        } finally {
            setLoading(false);
        }
    };

    // When dialog opens for a resolved fault, default to not_fixed
    const handleOpenChange = (open: boolean) => {
        if (open && fault?.status === "resolved") {
            setStatus("not_fixed");
        } else if (!open) {
            setStatus("fixed");
            setNotes("");
        }
        onOpenChange(open);
    };

    const getStatusIcon = (s: string) => {
        switch (s) {
            case "fixed": return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
            case "not_fixed": return <XCircle className="h-4 w-4 text-destructive" />;
            case "no_need": return <Ban className="h-4 w-4 text-muted-foreground" />;
            default: return null;
        }
    };

    const getSeverityVariant = (severity: string) => {
        switch (severity) {
            case "critical":
            case "high": return "destructive" as const;
            case "medium": return "default" as const;
            default: return "secondary" as const;
        }
    };

    if (!fault) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isResolved ? "Reactivate Fault" : "Resolve Fault"}</DialogTitle>
                    <DialogDescription>
                        {isResolved
                            ? "Update the status of this previously resolved fault"
                            : "Record the corrective action taken for this fault"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{fault.fault_description}</span>
                                <Badge variant={getSeverityVariant(fault.severity)}>
                                    {fault.severity}
                                </Badge>
                            </div>
                            {getStatusIcon(status)}
                        </div>

                        <div className="space-y-3">
                            <Label>Final Status</Label>
                            <RadioGroup
                                value={status}
                                onValueChange={setStatus}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="fixed" id="resolve-fixed" />
                                    <Label htmlFor="resolve-fixed" className="font-normal cursor-pointer">
                                        Fixed - Work completed successfully
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="not_fixed" id="resolve-not-fixed" />
                                    <Label htmlFor="resolve-not-fixed" className="font-normal cursor-pointer">
                                        Not Fixed - Work pending or incomplete
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="no_need" id="resolve-no-need" />
                                    <Label htmlFor="resolve-no-need" className="font-normal cursor-pointer">
                                        No Need - Misdiagnosed or not required
                                    </Label>
                                </div>
                            </RadioGroup>

                            <div className="space-y-2">
                                <Label htmlFor="resolve-notes">Notes</Label>
                                <Textarea
                                    id="resolve-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Details about the corrective action taken..."
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ResolveFaultDialog;
