import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface PartRequired {
    partNameNumber: string;
    quantity: string;
    onHand: string;
    orderNeededBy: string;
}

export interface OocReportEditData {
    id: string;
    year: string | null;
    location: string | null;
    reason_out_of_commission: string;
    immediate_plan: unknown;
    parts_required: unknown;
    additional_notes_safety_concerns: string | null;
    mechanic_name: string;
    mechanic_signature: string | null;
}

interface OutOfCommissionReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionId: string;
    vehicleId: string | null;
    vehicleRegistration: string;
    vehicleMake: string;
    vehicleModel: string;
    odometerReading: number | null;
    inspectorName: string;
    onComplete: () => void;
    editReport?: OocReportEditData | null;
}

export function OutOfCommissionReportDialog({
    open,
    onOpenChange,
    inspectionId,
    vehicleId,
    vehicleRegistration,
    vehicleMake,
    vehicleModel,
    odometerReading,
    inspectorName,
    onComplete,
    editReport,
}: OutOfCommissionReportDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const isEdit = !!editReport;

    const now = new Date();
    const [year, setYear] = useState("");
    const [location, setLocation] = useState("");
    const [reason, setReason] = useState("");
    const [immediatePlan, setImmediatePlan] = useState<string[]>([""]);
    const [partsRequired, setPartsRequired] = useState<PartRequired[]>([]);
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [mechanicName, setMechanicName] = useState(inspectorName || "");
    const [mechanicSignature, setMechanicSignature] = useState("");

    // Populate form when editing
    useEffect(() => {
        if (open && editReport) {
            setYear(editReport.year || "");
            setLocation(editReport.location || "");
            setReason(editReport.reason_out_of_commission);
            const plan = Array.isArray(editReport.immediate_plan) ? editReport.immediate_plan as string[] : [""];
            setImmediatePlan(plan.length > 0 ? plan : [""]);
            const parts = Array.isArray(editReport.parts_required) ? editReport.parts_required as PartRequired[] : [];
            setPartsRequired(parts);
            setAdditionalNotes(editReport.additional_notes_safety_concerns || "");
            setMechanicName(editReport.mechanic_name);
            setMechanicSignature(editReport.mechanic_signature || "");
        } else if (open && !editReport) {
            setYear("");
            setLocation("");
            setReason("");
            setImmediatePlan([""]);
            setPartsRequired([]);
            setAdditionalNotes("");
            setMechanicName(inspectorName || "");
            setMechanicSignature("");
        }
    }, [open, editReport, inspectorName]);

    const addPlanStep = () => setImmediatePlan((prev) => [...prev, ""]);
    const removePlanStep = (index: number) =>
        setImmediatePlan((prev) => prev.filter((_, i) => i !== index));
    const updatePlanStep = (index: number, value: string) =>
        setImmediatePlan((prev) => prev.map((s, i) => (i === index ? value : s)));

    const addPart = () =>
        setPartsRequired((prev) => [
            ...prev,
            { partNameNumber: "", quantity: "1", onHand: "No", orderNeededBy: "" },
        ]);
    const removePart = (index: number) =>
        setPartsRequired((prev) => prev.filter((_, i) => i !== index));
    const updatePart = (index: number, field: keyof PartRequired, value: string) =>
        setPartsRequired((prev) =>
            prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        );

    const submitReport = useMutation({
        mutationFn: async () => {
            const reportDate = now.toISOString().split("T")[0];
            const reportTime = now.toTimeString().slice(0, 5);

            const payload = {
                vehicle_id_or_license: vehicleRegistration,
                make_model: `${vehicleMake} ${vehicleModel}`.trim() || null,
                year: year || null,
                odometer_hour_meter: odometerReading ? `${odometerReading.toLocaleString()} km` : null,
                location: location || null,
                reason_out_of_commission: reason,
                immediate_plan: immediatePlan.filter(Boolean) as string[],
                parts_required: partsRequired
                    .filter((p) => p.partNameNumber)
                    .map((p) => ({ ...p }) as Record<string, string>),
                additional_notes_safety_concerns: additionalNotes || null,
                mechanic_name: mechanicName,
                mechanic_signature: mechanicSignature || null,
            };

            if (isEdit && editReport) {
                const { error } = await supabase
                    .from("out_of_commission_reports")
                    .update(payload)
                    .eq("id", editReport.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("out_of_commission_reports").insert({
                    ...payload,
                    inspection_id: inspectionId,
                    vehicle_id: vehicleId,
                    report_date: reportDate,
                    report_time: reportTime,
                    sign_off_date: reportDate,
                });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast({
                title: isEdit ? "Report Updated" : "Report Filed",
                description: isEdit
                    ? "Out-of-commission report has been updated."
                    : "Out-of-commission report has been saved.",
            });
            queryClient.invalidateQueries({ queryKey: ["out-of-commission-reports"] });
            onComplete();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to save report",
                variant: "destructive",
            });
        },
    });

    const isValid = reason.trim() && mechanicName.trim();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-destructive">
                        {isEdit ? "Edit Out-of-Commission Report" : "Out-of-Commission Report"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the details of this out-of-commission report."
                            : "This vehicle has been declared unsafe to operate. Please complete the report below."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Vehicle Information */}
                    <fieldset className="space-y-3">
                        <legend className="text-sm font-semibold">Vehicle Information</legend>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Registration / Fleet #</Label>
                                <Input value={vehicleRegistration} readOnly className="bg-muted" />
                            </div>
                            <div>
                                <Label className="text-xs">Make & Model</Label>
                                <Input
                                    value={`${vehicleMake} ${vehicleModel}`.trim()}
                                    readOnly
                                    className="bg-muted"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Year</Label>
                                <Input
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    placeholder="e.g. 2019"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Odometer / Hour Meter</Label>
                                <Input
                                    value={odometerReading ? `${odometerReading.toLocaleString()} km` : ""}
                                    readOnly
                                    className="bg-muted"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs">Current Location</Label>
                                <Input
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Main Garage - Bay 3"
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                            Reason Out of Commission <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe the issue that makes this vehicle unsafe to operate..."
                            rows={3}
                        />
                    </div>

                    {/* Immediate Plan */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Immediate Plan / Steps</Label>
                        {immediatePlan.map((step, i) => (
                            <div key={i} className="flex gap-2">
                                <Input
                                    value={step}
                                    onChange={(e) => updatePlanStep(i, e.target.value)}
                                    placeholder={`Step ${i + 1}`}
                                    className="flex-1"
                                />
                                {immediatePlan.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removePlanStep(i)}
                                        className="shrink-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addPlanStep}>
                            <Plus className="h-3 w-3 mr-1" /> Add Step
                        </Button>
                    </div>

                    {/* Parts Required */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Parts Required</Label>
                        {partsRequired.map((part, i) => (
                            <div key={i} className="border rounded-md p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-muted-foreground">Part {i + 1}</span>
                                    <Button variant="ghost" size="icon" onClick={() => removePart(i)} className="h-6 w-6">
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                                <Input
                                    value={part.partNameNumber}
                                    onChange={(e) => updatePart(i, "partNameNumber", e.target.value)}
                                    placeholder="Part name / number"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-xs">Qty</Label>
                                        <Input
                                            value={part.quantity}
                                            onChange={(e) => updatePart(i, "quantity", e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">On Hand?</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={part.onHand}
                                            onChange={(e) => updatePart(i, "onHand", e.target.value)}
                                        >
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Needed By</Label>
                                        <Input
                                            type="date"
                                            value={part.orderNeededBy}
                                            onChange={(e) => updatePart(i, "orderNeededBy", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addPart}>
                            <Plus className="h-3 w-3 mr-1" /> Add Part
                        </Button>
                    </div>

                    {/* Additional Notes */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Additional Notes / Safety Concerns</Label>
                        <Textarea
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                            placeholder="Any safety concerns, special instructions, etc."
                            rows={2}
                        />
                    </div>

                    {/* Mechanic Sign-off */}
                    <fieldset className="space-y-3 border-t pt-3">
                        <legend className="text-sm font-semibold">Mechanic / Inspector Sign-off</legend>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={mechanicName}
                                    onChange={(e) => setMechanicName(e.target.value)}
                                    placeholder="Full name"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Signature / Initials</Label>
                                <Input
                                    value={mechanicSignature}
                                    onChange={(e) => setMechanicSignature(e.target.value)}
                                    placeholder="e.g. JD"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Date: {now.toLocaleDateString()}
                        </p>
                    </fieldset>
                </div>

                <DialogFooter className="gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={!isValid || submitReport.isPending}
                        onClick={() => submitReport.mutate()}
                    >
                        {submitReport.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isEdit ? "Save Changes" : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
