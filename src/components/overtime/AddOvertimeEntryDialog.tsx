import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type OvertimeEntry = {
    id?: string;
    inspector_id: string;
    inspector_name: string;
    entry_mode?: "shift" | "monthly";
    date: string;
    month?: string | null; // YYYY-MM
    start_time?: string | null;
    end_time?: string | null;
    hours?: number | null;
    link_type?: "job_card" | "breakdown" | "incident" | "other" | null;
    job_card_id?: string | null;
    breakdown_id?: string | null;
    incident_id?: string | null;
    reason?: string | null;
    notes?: string | null;
    status: "pending" | "approved" | "rejected";
    rejection_reason?: string | null;
};

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry?: OvertimeEntry | null;
}

function diffHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // overnight
    return Math.round((mins / 60) * 100) / 100;
}

export default function AddOvertimeEntryDialog({ open, onOpenChange, entry }: Props) {
    const queryClient = useQueryClient();
    const isEdit = !!entry?.id;

    const [inspectorId, setInspectorId] = useState<string>("");
    const [inspectorName, setInspectorName] = useState<string>("");
    const [inspectorPickerOpen, setInspectorPickerOpen] = useState(false);

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const [entryMode, setEntryMode] = useState<"shift" | "monthly">("shift");
    const [date, setDate] = useState(today);
    const [month, setMonth] = useState(currentMonth);
    const [monthlyHours, setMonthlyHours] = useState<string>("");
    const [startTime, setStartTime] = useState("17:00");
    const [endTime, setEndTime] = useState("19:00");

    const [linkType, setLinkType] = useState<NonNullable<OvertimeEntry["link_type"]>>("job_card");
    const [jobCardId, setJobCardId] = useState<string | null>(null);
    const [breakdownId, setBreakdownId] = useState<string | null>(null);
    const [incidentId, setIncidentId] = useState<string | null>(null);
    const [linkPickerOpen, setLinkPickerOpen] = useState(false);

    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (!open) return;
        if (entry) {
            setInspectorId(entry.inspector_id || "");
            setInspectorName(entry.inspector_name || "");
            setEntryMode(entry.entry_mode === "monthly" ? "monthly" : "shift");
            setDate(entry.date || today);
            setMonth(entry.month || currentMonth);
            setMonthlyHours(
                entry.entry_mode === "monthly" && entry.hours != null
                    ? String(entry.hours)
                    : ""
            );
            setStartTime(entry.start_time?.slice(0, 5) || "17:00");
            setEndTime(entry.end_time?.slice(0, 5) || "19:00");
            setLinkType(entry.link_type || "job_card");
            setJobCardId(entry.job_card_id || null);
            setBreakdownId(entry.breakdown_id || null);
            setIncidentId(entry.incident_id || null);
            setReason(entry.reason || "");
            setNotes(entry.notes || "");
        } else {
            setInspectorId("");
            setInspectorName("");
            setEntryMode("shift");
            setDate(today);
            setMonth(currentMonth);
            setMonthlyHours("");
            setStartTime("17:00");
            setEndTime("19:00");
            setLinkType("job_card");
            setJobCardId(null);
            setBreakdownId(null);
            setIncidentId(null);
            setReason("");
            setNotes("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, entry]);

    const shiftHours = useMemo(() => diffHours(startTime, endTime), [startTime, endTime]);
    const monthlyHoursNum = Number(monthlyHours);
    const hours = entryMode === "monthly"
        ? (Number.isFinite(monthlyHoursNum) ? monthlyHoursNum : 0)
        : shiftHours;

    // Inspectors (NOT drivers - per user requirement)
    const { data: inspectors = [] } = useQuery({
        queryKey: ["inspector_profiles", "all"],
        queryFn: async () => {
            const { data, error } = await sb
                .from("inspector_profiles")
                .select("id, name")
                .order("name");
            if (error) throw error;
            return data || [];
        },
        enabled: open,
    });

    const { data: jobCards = [] } = useQuery({
        queryKey: ["overtime-jobcards"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("job_cards")
                .select("id, job_number, title, status")
                .is("archived_at", null)
                .order("created_at", { ascending: false })
                .limit(500);
            if (error) throw error;
            return data || [];
        },
        enabled: open && entryMode === "shift" && linkType === "job_card",
    });

    const { data: breakdowns = [] } = useQuery({
        queryKey: ["overtime-breakdowns"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("fleet_breakdowns")
                .select("id, source_breakdown_number, description, vehicle_fleet_number, breakdown_date")
                .order("breakdown_date", { ascending: false })
                .limit(500);
            if (error) throw error;
            return data || [];
        },
        enabled: open && entryMode === "shift" && linkType === "breakdown",
    });

    const { data: incidents = [] } = useQuery({
        queryKey: ["overtime-incidents"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("incidents")
                .select("id, incident_number, description, vehicle_number, incident_date")
                .order("incident_date", { ascending: false })
                .limit(500);
            if (error) throw error;
            return data || [];
        },
        enabled: open && entryMode === "shift" && linkType === "incident",
    });

    const upsertMutation = useMutation({
        mutationFn: async () => {
            if (!inspectorId) throw new Error("Select an inspector");

            const userResp = await supabase.auth.getUser();
            const userId = userResp.data.user?.id ?? null;

            let payload: Record<string, unknown>;

            if (entryMode === "monthly") {
                if (!month) throw new Error("Select a month");
                if (!Number.isFinite(monthlyHoursNum) || monthlyHoursNum <= 0) {
                    throw new Error("Enter total hours greater than zero");
                }
                // Use the first day of the selected month as the date.
                const monthDate = `${month}-01`;
                payload = {
                    inspector_id: inspectorId,
                    inspector_name: inspectorName,
                    entry_mode: "monthly",
                    date: monthDate,
                    month,
                    start_time: null,
                    end_time: null,
                    hours: monthlyHoursNum,
                    link_type: null,
                    job_card_id: null,
                    breakdown_id: null,
                    incident_id: null,
                    reason: reason.trim() || null,
                    notes: notes.trim() || null,
                };
            } else {
                if (!date) throw new Error("Select a date");
                if (!startTime || !endTime) throw new Error("Provide start and end time");
                if (shiftHours <= 0) throw new Error("End time must be after start time");
                if (linkType === "job_card" && !jobCardId) throw new Error("Select a job card");
                if (linkType === "breakdown" && !breakdownId) throw new Error("Select a breakdown");
                if (linkType === "incident" && !incidentId) throw new Error("Select an incident");

                payload = {
                    inspector_id: inspectorId,
                    inspector_name: inspectorName,
                    entry_mode: "shift",
                    date,
                    month: date.slice(0, 7),
                    start_time: startTime,
                    end_time: endTime,
                    hours: shiftHours,
                    link_type: linkType,
                    job_card_id: linkType === "job_card" ? jobCardId : null,
                    breakdown_id: linkType === "breakdown" ? breakdownId : null,
                    incident_id: linkType === "incident" ? incidentId : null,
                    reason: reason.trim() || null,
                    notes: notes.trim() || null,
                };
            }

            if (isEdit && entry?.id) {
                const { error } = await sb
                    .from("overtime_entries")
                    .update(payload)
                    .eq("id", entry.id);
                if (error) throw error;
            } else {
                const { error } = await sb
                    .from("overtime_entries")
                    .insert([{ ...payload, status: "pending", created_by: userId }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success(isEdit ? "Overtime entry updated" : "Overtime entry submitted");
            queryClient.invalidateQueries({ queryKey: ["overtime-entries"] });
            onOpenChange(false);
        },
        onError: (err: Error) => toast.error(err.message || "Failed to save"),
    });

    const linkLabel =
        linkType === "job_card"
            ? jobCards.find((j) => j.id === jobCardId)
                ? `${jobCards.find((j) => j.id === jobCardId)?.job_number || ""} — ${jobCards.find((j) => j.id === jobCardId)?.title || ""
                }`
                : "Select job card…"
            : linkType === "breakdown"
                ? breakdowns.find((b) => b.id === breakdownId)
                    ? `${breakdowns.find((b) => b.id === breakdownId)?.source_breakdown_number || "BD"} — ${breakdowns.find((b) => b.id === breakdownId)?.description || ""
                    }`
                    : "Select breakdown…"
                : linkType === "incident"
                    ? incidents.find((i) => i.id === incidentId)
                        ? `${incidents.find((i) => i.id === incidentId)?.incident_number || "INC"} — ${incidents.find((i) => i.id === incidentId)?.description || ""
                        }`
                        : "Select incident…"
                    : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit overtime entry" : "Add overtime entry"}</DialogTitle>
                    <DialogDescription>
                        Log overtime worked by an inspector and link it to the related job card,
                        breakdown, or incident.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Inspector picker */}
                    <div className="grid gap-1.5">
                        <Label>Inspector *</Label>
                        <Popover open={inspectorPickerOpen} onOpenChange={setInspectorPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "justify-between h-9",
                                        !inspectorId && "text-muted-foreground"
                                    )}
                                >
                                    {inspectorName || "Select inspector…"}
                                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search inspectors…" />
                                    <CommandList>
                                        <CommandEmpty>
                                            No inspector profiles found. Create one in Settings → Inspectors.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {inspectors.map((i) => (
                                                <CommandItem
                                                    key={i.id}
                                                    value={i.name}
                                                    onSelect={() => {
                                                        setInspectorId(i.id);
                                                        setInspectorName(i.name);
                                                        setInspectorPickerOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            inspectorId === i.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span>{i.name}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Entry mode toggle */}
                    <div className="grid gap-1.5">
                        <Label>Entry type *</Label>
                        <RadioGroup
                            value={entryMode}
                            onValueChange={(v) => setEntryMode(v as "shift" | "monthly")}
                            className="grid grid-cols-2 gap-2"
                        >
                            {(["shift", "monthly"] as const).map((opt) => (
                                <Label
                                    key={opt}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm",
                                        entryMode === opt && "border-primary bg-primary/5"
                                    )}
                                >
                                    <RadioGroupItem value={opt} />
                                    {opt === "shift" ? "Single shift" : "Monthly total"}
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>

                    {entryMode === "monthly" ? (
                        <>
                            {/* Month + total hours */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="ot-month">Month *</Label>
                                    <Input
                                        id="ot-month"
                                        type="month"
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="ot-monthly-hours">Total hours *</Label>
                                    <Input
                                        id="ot-monthly-hours"
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={monthlyHours}
                                        onChange={(e) => setMonthlyHours(e.target.value)}
                                        placeholder="e.g. 24"
                                    />
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                Total: <span className="font-semibold text-foreground tabular-nums">{hours.toFixed(2)} h</span>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Date / times */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <div className="grid gap-1.5 sm:col-span-2">
                                    <Label htmlFor="ot-date">Date *</Label>
                                    <Input
                                        id="ot-date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="ot-start">Start *</Label>
                                    <Input
                                        id="ot-start"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="ot-end">End *</Label>
                                    <Input
                                        id="ot-end"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                Total: <span className="font-semibold text-foreground tabular-nums">{hours.toFixed(2)} h</span>
                            </div>

                            {/* Link type */}
                            <div className="grid gap-1.5">
                                <Label>Link to *</Label>
                                <RadioGroup
                                    value={linkType}
                                    onValueChange={(v) => {
                                        setLinkType(v as NonNullable<OvertimeEntry["link_type"]>);
                                        setJobCardId(null);
                                        setBreakdownId(null);
                                        setIncidentId(null);
                                    }}
                                    className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                                >
                                    {(["job_card", "breakdown", "incident", "other"] as const).map((opt) => (
                                        <Label
                                            key={opt}
                                            className={cn(
                                                "flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm",
                                                linkType === opt && "border-primary bg-primary/5"
                                            )}
                                        >
                                            <RadioGroupItem value={opt} />
                                            {opt === "job_card"
                                                ? "Job Card"
                                                : opt === "breakdown"
                                                    ? "Breakdown"
                                                    : opt === "incident"
                                                        ? "Incident"
                                                        : "Other"}
                                        </Label>
                                    ))}
                                </RadioGroup>
                            </div>
                        </>
                    )}

                    {/* Conditional link picker */}
                    {entryMode === "shift" && linkType !== "other" && (
                        <div className="grid gap-1.5">
                            <Label>
                                {linkType === "job_card"
                                    ? "Job card *"
                                    : linkType === "breakdown"
                                        ? "Breakdown *"
                                        : "Incident *"}
                            </Label>
                            <Popover open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="justify-between h-9">
                                        <span className="truncate text-left">{linkLabel}</span>
                                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[--radix-popover-trigger-width] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Search…" />
                                        <CommandList>
                                            <CommandEmpty>No results.</CommandEmpty>
                                            <CommandGroup>
                                                {linkType === "job_card" &&
                                                    jobCards.map((j) => (
                                                        <CommandItem
                                                            key={j.id}
                                                            value={`${j.job_number ?? ""} ${j.title ?? ""}`}
                                                            onSelect={() => {
                                                                setJobCardId(j.id);
                                                                setLinkPickerOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    jobCardId === j.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs">
                                                                    {j.job_number || j.id.slice(0, 8)}
                                                                </span>
                                                                <span className="text-sm">{j.title}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                {linkType === "breakdown" &&
                                                    breakdowns.map((b) => (
                                                        <CommandItem
                                                            key={b.id}
                                                            value={`${b.source_breakdown_number ?? ""} ${b.description ?? ""} ${b.vehicle_fleet_number ?? ""}`}
                                                            onSelect={() => {
                                                                setBreakdownId(b.id);
                                                                setLinkPickerOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    breakdownId === b.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs">
                                                                    {b.source_breakdown_number || b.id.slice(0, 8)}
                                                                    {b.vehicle_fleet_number && ` · ${b.vehicle_fleet_number}`}
                                                                </span>
                                                                <span className="text-sm truncate">{b.description}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                {linkType === "incident" &&
                                                    incidents.map((i) => (
                                                        <CommandItem
                                                            key={i.id}
                                                            value={`${i.incident_number ?? ""} ${i.description ?? ""} ${i.vehicle_number ?? ""}`}
                                                            onSelect={() => {
                                                                setIncidentId(i.id);
                                                                setLinkPickerOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    incidentId === i.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs">
                                                                    {i.incident_number || i.id.slice(0, 8)}
                                                                    {i.vehicle_number && ` · ${i.vehicle_number}`}
                                                                </span>
                                                                <span className="text-sm truncate">{i.description}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    <div className="grid gap-1.5">
                        <Label htmlFor="ot-reason">Reason</Label>
                        <Input
                            id="ot-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Late afterhours repair, urgent breakdown response"
                        />
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="ot-notes">Notes</Label>
                        <Textarea
                            id="ot-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Optional context for the approver"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={upsertMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>
                        {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                        {isEdit ? "Save changes" : "Submit for approval"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
