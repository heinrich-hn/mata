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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CalendarPlus,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Repeat,
    Settings,
    Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type Cadence = "daily" | "weekly" | "biweekly" | "monthly" | "custom";

interface ScheduleRule {
    id: string;
    template_id: string | null;
    template_name: string | null;
    vehicle_id: string | null;
    vehicle_label: string | null;
    cadence: Cadence;
    interval_days: number | null;
    weekday: number | null;
    day_of_month: number | null;
    start_date: string;
    end_date: string | null;
    active: boolean;
    notes: string | null;
    created_by: string | null;
}

interface ScheduledInspection {
    id: string;
    vehicle_id: string | null;
    vehicle_label: string | null;
    scheduled_date: string;
    inspection_type: string | null;
    template_id: string | null;
    template_name: string | null;
    notes: string | null;
    completed_at: string | null;
}

interface VehicleOption {
    id: string;
    registration_number: string;
    fleet_number: string | null;
    make: string;
    model: string;
}

interface TemplateOption {
    id: string;
    name: string;
    template_code: string;
}

interface CalendarCellEntry {
    kind: "scheduled" | "generated";
    label: string;
    sublabel?: string;
    completed?: boolean;
    scheduledId?: string;
    ruleId?: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const parseDateKey = (s: string) => new Date(s + "T00:00:00");

const daysBetween = (a: Date, b: Date) =>
    Math.round((b.getTime() - a.getTime()) / 86400000);

const cadenceLabel = (rule: ScheduleRule): string => {
    switch (rule.cadence) {
        case "daily":
            return "Every day";
        case "weekly":
            return `Weekly · ${WEEKDAY_LABELS[rule.weekday ?? 0]}`;
        case "biweekly":
            return `Every 2 weeks · ${WEEKDAY_LABELS[rule.weekday ?? 0]}`;
        case "monthly":
            return `Monthly · day ${rule.day_of_month ?? 1}`;
        case "custom":
            return `Every ${rule.interval_days ?? 1} days`;
    }
};

function occurrencesInWindow(
    rule: ScheduleRule,
    windowStartIn: Date,
    windowEndIn: Date
): string[] {
    if (!rule.active) return [];
    const start = parseDateKey(rule.start_date);
    const end = rule.end_date ? parseDateKey(rule.end_date) : null;
    const windowStart = windowStartIn > start ? new Date(windowStartIn) : new Date(start);
    const windowEnd = end && end < windowEndIn ? new Date(end) : new Date(windowEndIn);
    if (windowStart > windowEnd) return [];

    const out: string[] = [];

    if (rule.cadence === "daily") {
        for (const d = new Date(windowStart); d <= windowEnd; d.setDate(d.getDate() + 1)) {
            out.push(toDateKey(d));
        }
        return out;
    }

    if (rule.cadence === "weekly" || rule.cadence === "biweekly") {
        const stepDays = rule.cadence === "weekly" ? 7 : 14;
        const targetDow = rule.weekday ?? start.getDay();
        const first = new Date(start);
        const offset = (targetDow - first.getDay() + 7) % 7;
        first.setDate(first.getDate() + offset);
        for (const d = new Date(first); d <= windowEnd; d.setDate(d.getDate() + stepDays)) {
            if (d >= windowStart) out.push(toDateKey(d));
        }
        return out;
    }

    if (rule.cadence === "monthly") {
        const dom = rule.day_of_month ?? start.getDate();
        const cursor = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
        const stopMonth = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);
        while (cursor <= stopMonth) {
            const d = new Date(cursor.getFullYear(), cursor.getMonth(), dom);
            if (d >= start && d <= windowEnd && d >= windowStart && (!end || d <= end)) {
                out.push(toDateKey(d));
            }
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return out;
    }

    if (rule.cadence === "custom") {
        const interval = Math.max(1, rule.interval_days ?? 1);
        const offsetDays = Math.max(0, daysBetween(start, windowStart));
        const skipCycles = Math.floor(offsetDays / interval);
        const cursor = new Date(start);
        cursor.setDate(cursor.getDate() + skipCycles * interval);
        while (cursor < windowStart) cursor.setDate(cursor.getDate() + interval);
        while (cursor <= windowEnd) {
            out.push(toDateKey(cursor));
            cursor.setDate(cursor.getDate() + interval);
        }
        return out;
    }

    return out;
}

const vehicleDisplay = (v: VehicleOption) => {
    const fleet = v.fleet_number ? `${v.fleet_number} · ` : "";
    return `${fleet}${v.registration_number} — ${v.make} ${v.model}`.trim();
};

export function InspectionScheduleCalendar() {
    const { toast } = useToast();
    const { userName } = useAuth();
    const queryClient = useQueryClient();

    const today = new Date();
    const [viewMonth, setViewMonth] = useState(
        new Date(today.getFullYear(), today.getMonth(), 1)
    );
    const [selectedDate, setSelectedDate] = useState<Date>(today);

    const [addOpen, setAddOpen] = useState(false);
    const [rulesOpen, setRulesOpen] = useState(false);
    const [ruleFormOpen, setRuleFormOpen] = useState(false);
    const [deleteRule, setDeleteRule] = useState<ScheduleRule | null>(null);
    const [deleteScheduled, setDeleteScheduled] = useState<ScheduledInspection | null>(null);

    const [addVehicleId, setAddVehicleId] = useState("");
    const [addTemplateId, setAddTemplateId] = useState("");
    const [addType, setAddType] = useState("Pre-trip");
    const [addNotes, setAddNotes] = useState("");

    const [ruleTemplateId, setRuleTemplateId] = useState("");
    const [ruleVehicleId, setRuleVehicleId] = useState<string>("__all__");
    const [ruleCadence, setRuleCadence] = useState<Cadence>("weekly");
    const [ruleWeekday, setRuleWeekday] = useState("1");
    const [ruleDayOfMonth, setRuleDayOfMonth] = useState("1");
    const [ruleIntervalDays, setRuleIntervalDays] = useState("7");
    const [ruleStartDate, setRuleStartDate] = useState(toDateKey(today));
    const [ruleEndDate, setRuleEndDate] = useState("");
    const [ruleNotes, setRuleNotes] = useState("");

    const monthStart = useMemo(
        () => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1),
        [viewMonth]
    );
    const gridStart = useMemo(() => {
        const d = new Date(monthStart);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }, [monthStart]);
    const gridDays = useMemo(() => {
        const out: Date[] = [];
        const d = new Date(gridStart);
        for (let i = 0; i < 42; i++) {
            out.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        return out;
    }, [gridStart]);

    const gridStartKey = toDateKey(gridDays[0]);
    const gridEndKey = toDateKey(gridDays[gridDays.length - 1]);

    const { data: scheduled = [] } = useQuery<ScheduledInspection[]>({
        queryKey: ["scheduled-inspections", gridStartKey, gridEndKey],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("scheduled_inspections")
                .select(
                    "id, vehicle_id, vehicle_label, scheduled_date, inspection_type, template_id, template_name, notes, completed_at"
                )
                .gte("scheduled_date", gridStartKey)
                .lte("scheduled_date", gridEndKey)
                .order("scheduled_date", { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    const { data: rules = [] } = useQuery<ScheduleRule[]>({
        queryKey: ["inspection-schedule-rules"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("inspection_schedule_rules")
                .select(
                    "id, template_id, template_name, vehicle_id, vehicle_label, cadence, interval_days, weekday, day_of_month, start_date, end_date, active, notes, created_by"
                )
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data || []) as ScheduleRule[];
        },
    });

    const { data: vehicles = [] } = useQuery<VehicleOption[]>({
        queryKey: ["vehicles-for-schedule"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vehicles")
                .select("id, registration_number, fleet_number, make, model")
                .eq("active", true)
                .order("fleet_number", { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    const { data: templates = [] } = useQuery<TemplateOption[]>({
        queryKey: ["inspection-templates-for-schedule"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("inspection_templates")
                .select("id, name, template_code")
                .eq("is_active", true)
                .order("name");
            if (error) throw error;
            return data || [];
        },
    });

    const entriesByDate = useMemo(() => {
        const map = new Map<string, CalendarCellEntry[]>();
        const push = (key: string, entry: CalendarCellEntry) => {
            const list = map.get(key) || [];
            list.push(entry);
            map.set(key, list);
        };
        for (const s of scheduled) {
            push(s.scheduled_date, {
                kind: "scheduled",
                label: s.inspection_type || "Inspection",
                sublabel: s.vehicle_label || "Unassigned",
                completed: !!s.completed_at,
                scheduledId: s.id,
            });
        }
        const winStart = gridDays[0];
        const winEnd = gridDays[gridDays.length - 1];
        for (const r of rules) {
            const dates = occurrencesInWindow(r, winStart, winEnd);
            for (const k of dates) {
                push(k, {
                    kind: "generated",
                    label: r.template_name || "Template",
                    sublabel: r.vehicle_label || "All vehicles",
                    ruleId: r.id,
                });
            }
        }
        return map;
    }, [scheduled, rules, gridDays]);

    const plannedThisMonth = useMemo(() => {
        const mStart = new Date(monthStart);
        const mEnd = new Date(
            monthStart.getFullYear(),
            monthStart.getMonth() + 1,
            0
        );
        const out: Array<{
            date: string;
            vehicle_label: string | null;
            template_name: string | null;
            cadenceText: string;
        }> = [];
        for (const r of rules) {
            const dates = occurrencesInWindow(r, mStart, mEnd);
            for (const d of dates) {
                out.push({
                    date: d,
                    vehicle_label: r.vehicle_label,
                    template_name: r.template_name,
                    cadenceText: cadenceLabel(r),
                });
            }
        }
        out.sort((a, b) => a.date.localeCompare(b.date));
        return out;
    }, [rules, monthStart]);

    const selectedKey = toDateKey(selectedDate);
    const selectedEntries = entriesByDate.get(selectedKey) || [];

    const addInspection = useMutation({
        mutationFn: async () => {
            const chosen = vehicles.find((v) => v.id === addVehicleId) || null;
            const tpl = templates.find((t) => t.id === addTemplateId) || null;
            const { error } = await supabase.from("scheduled_inspections").insert({
                vehicle_id: chosen?.id || null,
                vehicle_label: chosen ? vehicleDisplay(chosen) : null,
                scheduled_date: toDateKey(selectedDate),
                inspection_type: addType || null,
                template_id: tpl?.id || null,
                template_name: tpl?.name || null,
                notes: addNotes.trim() || null,
                created_by: userName || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Inspection scheduled" });
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
            setAddOpen(false);
            setAddVehicleId("");
            setAddTemplateId("");
            setAddType("Pre-trip");
            setAddNotes("");
        },
        onError: (e) =>
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Failed",
                variant: "destructive",
            }),
    });

    const toggleComplete = useMutation({
        mutationFn: async (s: ScheduledInspection) => {
            const { error } = await supabase
                .from("scheduled_inspections")
                .update({ completed_at: s.completed_at ? null : new Date().toISOString() })
                .eq("id", s.id);
            if (error) throw error;
        },
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] }),
    });

    const removeScheduled = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("scheduled_inspections")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Removed" });
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
            setDeleteScheduled(null);
        },
    });

    const materialise = useMutation({
        mutationFn: async (args: { rule: ScheduleRule; date: string }) => {
            const { error } = await supabase.from("scheduled_inspections").insert({
                vehicle_id: args.rule.vehicle_id,
                vehicle_label: args.rule.vehicle_label,
                scheduled_date: args.date,
                inspection_type: args.rule.template_name || "Template",
                template_id: args.rule.template_id,
                template_name: args.rule.template_name,
                notes: args.rule.notes,
                created_by: userName || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Saved as scheduled inspection" });
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
        },
        onError: (e) =>
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Failed",
                variant: "destructive",
            }),
    });

    const resetRuleForm = () => {
        setRuleTemplateId("");
        setRuleVehicleId("__all__");
        setRuleCadence("weekly");
        setRuleWeekday("1");
        setRuleDayOfMonth("1");
        setRuleIntervalDays("7");
        setRuleStartDate(toDateKey(new Date()));
        setRuleEndDate("");
        setRuleNotes("");
    };

    const saveRule = useMutation({
        mutationFn: async () => {
            if (!ruleTemplateId) throw new Error("Pick a template");
            const tpl = templates.find((t) => t.id === ruleTemplateId);
            const veh =
                ruleVehicleId === "__all__"
                    ? null
                    : vehicles.find((v) => v.id === ruleVehicleId) || null;
            const { error } = await supabase.from("inspection_schedule_rules").insert({
                template_id: tpl?.id || null,
                template_name: tpl?.name || null,
                vehicle_id: veh?.id || null,
                vehicle_label: veh ? vehicleDisplay(veh) : null,
                cadence: ruleCadence,
                interval_days:
                    ruleCadence === "custom" ? Number(ruleIntervalDays) || 1 : null,
                weekday:
                    ruleCadence === "weekly" || ruleCadence === "biweekly"
                        ? Number(ruleWeekday)
                        : null,
                day_of_month: ruleCadence === "monthly" ? Number(ruleDayOfMonth) : null,
                start_date: ruleStartDate,
                end_date: ruleEndDate || null,
                notes: ruleNotes.trim() || null,
                created_by: userName || null,
                active: true,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Rule added" });
            queryClient.invalidateQueries({ queryKey: ["inspection-schedule-rules"] });
            setRuleFormOpen(false);
            resetRuleForm();
        },
        onError: (e) =>
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Failed",
                variant: "destructive",
            }),
    });

    const toggleRule = useMutation({
        mutationFn: async (r: ScheduleRule) => {
            const { error } = await supabase
                .from("inspection_schedule_rules")
                .update({ active: !r.active })
                .eq("id", r.id);
            if (error) throw error;
        },
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["inspection-schedule-rules"] }),
    });

    const removeRule = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("inspection_schedule_rules")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Rule deleted" });
            queryClient.invalidateQueries({ queryKey: ["inspection-schedule-rules"] });
            setDeleteRule(null);
        },
    });

    const monthLabel = viewMonth.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
    });

    const goPrevMonth = () =>
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    const goNextMonth = () =>
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    const goToday = () => {
        const t = new Date();
        setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1));
        setSelectedDate(t);
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={goPrevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <CardTitle className="text-lg min-w-[160px] text-center">
                                {monthLabel}
                            </CardTitle>
                            <Button variant="outline" size="icon" onClick={goNextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={goToday}>
                                Today
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRulesOpen(true)}
                            >
                                <Settings className="h-4 w-4 mr-1.5" />
                                Schedule rules ({rules.filter((r) => r.active).length})
                            </Button>
                            <Button size="sm" onClick={() => setAddOpen(true)}>
                                <CalendarPlus className="h-4 w-4 mr-1.5" />
                                Add inspection
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground border-b">
                        {WEEKDAY_LABELS.map((w) => (
                            <div key={w} className="py-1.5 px-2 text-center">
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-border">
                        {gridDays.map((d) => {
                            const key = toDateKey(d);
                            const inMonth = d.getMonth() === viewMonth.getMonth();
                            const isToday = toDateKey(d) === toDateKey(new Date());
                            const isSelected = key === selectedKey;
                            const entries = entriesByDate.get(key) || [];
                            return (
                                <button
                                    type="button"
                                    key={key}
                                    onClick={() => setSelectedDate(new Date(d))}
                                    className={[
                                        "min-h-[90px] sm:min-h-[110px] bg-background p-1.5 text-left flex flex-col gap-1 transition-colors",
                                        inMonth ? "" : "bg-muted/30 text-muted-foreground",
                                        isSelected ? "ring-2 ring-primary ring-inset" : "",
                                        "hover:bg-muted/40",
                                    ].join(" ")}
                                >
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={[
                                                "text-xs font-medium inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full",
                                                isToday
                                                    ? "bg-primary text-primary-foreground"
                                                    : "",
                                            ].join(" ")}
                                        >
                                            {d.getDate()}
                                        </span>
                                        {entries.length > 0 && (
                                            <span className="text-[10px] text-muted-foreground">
                                                {entries.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        {entries.slice(0, 3).map((e, idx) => (
                                            <span
                                                key={idx}
                                                className={[
                                                    "text-[10px] truncate rounded px-1 py-0.5 leading-tight",
                                                    e.kind === "scheduled"
                                                        ? e.completed
                                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 line-through"
                                                            : "bg-primary/15 text-primary"
                                                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-dashed border-amber-500/40",
                                                ].join(" ")}
                                                title={`${e.sublabel ?? "All vehicles"} — ${e.label}`}
                                            >
                                                <span className="font-medium">
                                                    {e.sublabel || "All vehicles"}
                                                </span>
                                                <span className="opacity-70"> · {e.label}</span>
                                            </span>
                                        ))}
                                        {entries.length > 3 && (
                                            <span className="text-[10px] text-muted-foreground">
                                                +{entries.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded bg-primary/30" />
                            Scheduled
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded bg-amber-500/30 border border-dashed border-amber-500/60" />
                            From template rule
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded bg-emerald-500/30" />
                            Completed
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        {selectedDate.toLocaleDateString("en-GB", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({selectedEntries.length})
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Nothing scheduled. Use "Add inspection" or set up a recurring rule.
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {selectedEntries.map((e, i) => {
                                const sched = e.scheduledId
                                    ? scheduled.find((s) => s.id === e.scheduledId)
                                    : null;
                                const rule = e.ruleId
                                    ? rules.find((r) => r.id === e.ruleId)
                                    : null;
                                return (
                                    <li
                                        key={i}
                                        className="py-2 flex items-start justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm">
                                                    {e.label}
                                                </span>
                                                <Badge
                                                    variant={
                                                        e.kind === "scheduled"
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    className="text-[10px]"
                                                >
                                                    {e.kind === "scheduled"
                                                        ? "Scheduled"
                                                        : "Template"}
                                                </Badge>
                                                {e.completed && (
                                                    <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                                                        Done
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {e.sublabel}
                                            </p>
                                            {sched?.notes && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {sched.notes}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {sched ? (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => toggleComplete.mutate(sched)}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                        {sched.completed_at ? "Re-open" : "Done"}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                        onClick={() => setDeleteScheduled(sched)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            ) : (
                                                rule && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() =>
                                                            materialise.mutate({
                                                                rule,
                                                                date: selectedKey,
                                                            })
                                                        }
                                                    >
                                                        Save as scheduled
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CalendarPlus className="h-4 w-4" />
                            Scheduled this month
                            <span className="text-xs font-normal text-muted-foreground">
                                ({scheduled.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {scheduled.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No one-off inspections scheduled in this view.
                            </p>
                        ) : (
                            <ul className="divide-y max-h-[320px] overflow-y-auto">
                                {scheduled.map((s) => (
                                    <li
                                        key={s.id}
                                        className="py-2 cursor-pointer hover:bg-muted/30 rounded px-2"
                                        onClick={() =>
                                            setSelectedDate(
                                                parseDateKey(s.scheduled_date)
                                            )
                                        }
                                    >
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <span className="text-sm font-medium truncate">
                                                {s.vehicle_label || "Unassigned vehicle"}
                                            </span>
                                            {s.completed_at ? (
                                                <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                                                    Done
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    {s.inspection_type || "Inspection"}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {parseDateKey(
                                                s.scheduled_date
                                            ).toLocaleDateString("en-GB", {
                                                weekday: "short",
                                                day: "numeric",
                                                month: "short",
                                            })}
                                            {s.inspection_type && !s.completed_at
                                                ? ""
                                                : s.inspection_type
                                                    ? ` · ${s.inspection_type}`
                                                    : ""}
                                        </p>
                                        {s.notes && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {s.notes}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Repeat className="h-4 w-4" />
                            Planned this month
                            <span className="text-xs font-normal text-muted-foreground">
                                ({plannedThisMonth.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {plannedThisMonth.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No recurring rules generate inspections this month.
                            </p>
                        ) : (
                            <ul className="divide-y max-h-[320px] overflow-y-auto">
                                {plannedThisMonth.map((p, i) => (
                                    <li
                                        key={i}
                                        className="py-2 cursor-pointer hover:bg-muted/30 rounded px-2"
                                        onClick={() =>
                                            setSelectedDate(parseDateKey(p.date))
                                        }
                                    >
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <span className="text-sm font-medium truncate">
                                                {p.vehicle_label || "All vehicles"}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400"
                                            >
                                                {p.template_name || "Template"}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {parseDateKey(p.date).toLocaleDateString(
                                                "en-GB",
                                                {
                                                    weekday: "short",
                                                    day: "numeric",
                                                    month: "short",
                                                }
                                            )}
                                            {p.cadenceText ? ` · ${p.cadenceText}` : ""}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Schedule Inspection</DialogTitle>
                        <DialogDescription>
                            {selectedDate.toLocaleDateString("en-GB", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Vehicle (optional)</Label>
                            <Select value={addVehicleId} onValueChange={setAddVehicleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick vehicle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {vehicleDisplay(v)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Inspection form</Label>
                            <Select
                                value={addTemplateId}
                                onValueChange={(v) => {
                                    setAddTemplateId(v);
                                    const tpl = templates.find((t) => t.id === v);
                                    if (tpl) setAddType(tpl.name);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick inspection form" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.length === 0 ? (
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                            No active templates
                                        </div>
                                    ) : (
                                        templates.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                                {t.template_code
                                                    ? ` (${t.template_code})`
                                                    : ""}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                The selected form will open when the inspection is performed.
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs">Type</Label>
                            <Input
                                value={addType}
                                onChange={(e) => setAddType(e.target.value)}
                                placeholder="e.g. Pre-trip, Service"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                                value={addNotes}
                                onChange={(e) => setAddNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => addInspection.mutate()}
                            disabled={addInspection.isPending}
                        >
                            {addInspection.isPending ? "Saving..." : "Schedule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Repeat className="h-5 w-5" />
                            Recurring schedule rules
                        </DialogTitle>
                        <DialogDescription>
                            Generate inspections automatically from your inspection templates.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            onClick={() => {
                                resetRuleForm();
                                setRuleFormOpen(true);
                            }}
                        >
                            <CalendarPlus className="h-4 w-4 mr-1.5" />
                            New rule
                        </Button>
                    </div>

                    {rules.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            No rules yet. Add one to auto-populate the calendar.
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {rules.map((r) => (
                                <li
                                    key={r.id}
                                    className="py-2 flex items-start justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">
                                                {r.template_name || "Untitled"}
                                            </span>
                                            <Badge variant="outline" className="text-[10px]">
                                                {cadenceLabel(r)}
                                            </Badge>
                                            {!r.active && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px]"
                                                >
                                                    Inactive
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {r.vehicle_label || "All vehicles"} · from{" "}
                                            {r.start_date}
                                            {r.end_date ? ` until ${r.end_date}` : ""}
                                        </p>
                                        {r.notes && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {r.notes}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Switch
                                            checked={r.active}
                                            onCheckedChange={() => toggleRule.mutate(r)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteRule(r)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRulesOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={ruleFormOpen} onOpenChange={setRuleFormOpen}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New schedule rule</DialogTitle>
                        <DialogDescription>
                            Pick a template and how often it should appear on the calendar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">
                                Inspection template{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Select value={ruleTemplateId} onValueChange={setRuleTemplateId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Applies to</Label>
                            <Select value={ruleVehicleId} onValueChange={setRuleVehicleId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All vehicles</SelectItem>
                                    {vehicles.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {vehicleDisplay(v)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Cadence</Label>
                            <Select
                                value={ruleCadence}
                                onValueChange={(v) => setRuleCadence(v as Cadence)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Every day</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="custom">Custom interval</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(ruleCadence === "weekly" || ruleCadence === "biweekly") && (
                            <div>
                                <Label className="text-xs">Weekday</Label>
                                <Select value={ruleWeekday} onValueChange={setRuleWeekday}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WEEKDAY_LABELS.map((w, i) => (
                                            <SelectItem key={w} value={String(i)}>
                                                {w}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {ruleCadence === "monthly" && (
                            <div>
                                <Label className="text-xs">Day of month (1–28)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={28}
                                    value={ruleDayOfMonth}
                                    onChange={(e) => setRuleDayOfMonth(e.target.value)}
                                />
                            </div>
                        )}

                        {ruleCadence === "custom" && (
                            <div>
                                <Label className="text-xs">Every N days</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={ruleIntervalDays}
                                    onChange={(e) => setRuleIntervalDays(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Starts on</Label>
                                <Input
                                    type="date"
                                    value={ruleStartDate}
                                    onChange={(e) => setRuleStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Ends on (optional)</Label>
                                <Input
                                    type="date"
                                    value={ruleEndDate}
                                    onChange={(e) => setRuleEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                                value={ruleNotes}
                                onChange={(e) => setRuleNotes(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRuleFormOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => saveRule.mutate()}
                            disabled={saveRule.isPending || !ruleTemplateId}
                        >
                            {saveRule.isPending ? "Saving..." : "Save rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={!!deleteRule}
                onOpenChange={(o) => !o && setDeleteRule(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete schedule rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deleteRule?.template_name}" (
                            {deleteRule && cadenceLabel(deleteRule)}) will stop generating
                            inspections.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteRule && removeRule.mutate(deleteRule.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={!!deleteScheduled}
                onOpenChange={(o) => !o && setDeleteScheduled(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove scheduled inspection?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteScheduled?.vehicle_label || "This entry"} on{" "}
                            {deleteScheduled?.scheduled_date} will be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                deleteScheduled &&
                                removeScheduled.mutate(deleteScheduled.id)
                            }
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
