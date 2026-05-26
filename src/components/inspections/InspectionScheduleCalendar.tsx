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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Clock, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";

interface ScheduledInspection {
    id: string;
    vehicle_id: string | null;
    vehicle_label: string | null;
    scheduled_date: string;
    inspection_type: string | null;
    notes: string | null;
    created_by: string | null;
    completed_at: string | null;
}

interface VehicleOption {
    id: string;
    registration_number: string;
    fleet_number: string | null;
    make: string;
    model: string;
}

const INSPECTION_TYPES = [
    "Pre-trip",
    "Daily",
    "Weekly",
    "Monthly",
    "Service",
    "Roadworthy",
    "Other",
];

const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const formatLong = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

export function InspectionScheduleCalendar() {
    const { toast } = useToast();
    const { userName } = useAuth();
    const queryClient = useQueryClient();

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [addOpen, setAddOpen] = useState(false);
    const [vehicleId, setVehicleId] = useState<string>("");
    const [inspectionType, setInspectionType] = useState<string>("Pre-trip");
    const [notes, setNotes] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<ScheduledInspection | null>(null);

    const { data: scheduled = [], isLoading } = useQuery<ScheduledInspection[]>({
        queryKey: ["scheduled-inspections"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("scheduled_inspections")
                .select(
                    "id, vehicle_id, vehicle_label, scheduled_date, inspection_type, notes, created_by, completed_at"
                )
                .order("scheduled_date", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        refetchInterval: 60000,
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

    const byDate = useMemo(() => {
        const map = new Map<string, ScheduledInspection[]>();
        for (const s of scheduled) {
            const list = map.get(s.scheduled_date) || [];
            list.push(s);
            map.set(s.scheduled_date, list);
        }
        return map;
    }, [scheduled]);

    const scheduledDays = useMemo(
        () => Array.from(byDate.keys()).map((k) => new Date(k + "T00:00:00")),
        [byDate]
    );

    const selectedKey = selectedDate ? toDateKey(selectedDate) : null;
    const itemsForSelected = selectedKey ? byDate.get(selectedKey) || [] : [];

    const upcoming = useMemo(() => {
        const today = toDateKey(new Date());
        return scheduled
            .filter((s) => s.scheduled_date >= today && !s.completed_at)
            .slice(0, 8);
    }, [scheduled]);

    const vehicleLabel = (v: VehicleOption) => {
        const fleet = v.fleet_number ? `${v.fleet_number} \u00b7 ` : "";
        return `${fleet}${v.registration_number} \u2014 ${v.make} ${v.model}`.trim();
    };

    const handleDayClick = (date: Date | undefined) => {
        setSelectedDate(date);
    };

    const openAddDialog = () => {
        if (!selectedDate) {
            setSelectedDate(new Date());
        }
        setVehicleId("");
        setInspectionType("Pre-trip");
        setNotes("");
        setAddOpen(true);
    };

    const addInspection = useMutation({
        mutationFn: async () => {
            if (!selectedDate) throw new Error("Pick a date first");
            const chosen = vehicles.find((v) => v.id === vehicleId) || null;
            const { error } = await supabase.from("scheduled_inspections").insert({
                vehicle_id: chosen?.id || null,
                vehicle_label: chosen ? vehicleLabel(chosen) : null,
                scheduled_date: toDateKey(selectedDate),
                inspection_type: inspectionType || null,
                notes: notes.trim() || null,
                created_by: userName || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({
                title: "Inspection Scheduled",
                description: selectedDate ? formatLong(toDateKey(selectedDate)) : "",
            });
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
            setAddOpen(false);
        },
        onError: (err) => {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to schedule",
                variant: "destructive",
            });
        },
    });

    const markComplete = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("scheduled_inspections")
                .update({ completed_at: new Date().toISOString() })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Marked as complete" });
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
        },
    });

    const reopenScheduled = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("scheduled_inspections")
                .update({ completed_at: null })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
        },
    });

    const deleteScheduled = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("scheduled_inspections")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Scheduled inspection removed" });
            queryClient.invalidateQueries({ queryKey: ["scheduled-inspections"] });
            setDeleteTarget(null);
        },
    });

    return (
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <CalendarPlus className="h-4 w-4" />
                        Schedule
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDayClick}
                        modifiers={{ scheduled: scheduledDays }}
                        modifiersClassNames={{
                            scheduled:
                                "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                        }}
                    />
                    <Button
                        className="w-full mt-3"
                        onClick={openAddDialog}
                        disabled={!selectedDate}
                    >
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Add inspection {selectedDate ? `on ${selectedDate.toLocaleDateString("en-GB")}` : ""}
                    </Button>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                            {selectedDate ? formatLong(toDateKey(selectedDate)) : "Pick a date"}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({itemsForSelected.length} scheduled)
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : itemsForSelected.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No inspections scheduled. Click the button to add one.
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {itemsForSelected.map((item) => (
                                    <li
                                        key={item.id}
                                        className="py-2 flex items-start justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="font-medium text-sm">
                                                    {item.vehicle_label || "Unassigned vehicle"}
                                                </span>
                                                {item.inspection_type && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {item.inspection_type}
                                                    </Badge>
                                                )}
                                                {item.completed_at && (
                                                    <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                                                        Done
                                                    </Badge>
                                                )}
                                            </div>
                                            {item.notes && (
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {item.notes}
                                                </p>
                                            )}
                                            {item.created_by && (
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    Added by {item.created_by}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {item.completed_at ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => reopenScheduled.mutate(item.id)}
                                                >
                                                    Re-open
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                                                    onClick={() => markComplete.mutate(item.id)}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                    Done
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteTarget(item)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Upcoming
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {upcoming.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
                        ) : (
                            <ul className="divide-y">
                                {upcoming.map((item) => (
                                    <li
                                        key={item.id}
                                        className="py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 rounded px-2"
                                        onClick={() =>
                                            setSelectedDate(new Date(item.scheduled_date + "T00:00:00"))
                                        }
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {item.vehicle_label || "Unassigned vehicle"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatLong(item.scheduled_date)}
                                                {item.inspection_type ? ` \u00b7 ${item.inspection_type}` : ""}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Schedule Inspection</DialogTitle>
                        <DialogDescription>
                            {selectedDate
                                ? formatLong(toDateKey(selectedDate))
                                : "Choose a date on the calendar"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Vehicle</Label>
                            <Select value={vehicleId} onValueChange={setVehicleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a vehicle (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {vehicleLabel(v)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Type</Label>
                            <Select value={inspectionType} onValueChange={setInspectionType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {INSPECTION_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional details"
                                rows={3}
                            />
                        </div>
                        {userName && (
                            <p className="text-[11px] text-muted-foreground">
                                Will be recorded as added by <strong>{userName}</strong>
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAddOpen(false)}
                            disabled={addInspection.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => addInspection.mutate()}
                            disabled={addInspection.isPending || !selectedDate}
                        >
                            {addInspection.isPending ? "Saving..." : "Schedule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove scheduled inspection?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.vehicle_label || "This entry"} on{" "}
                            {deleteTarget && formatLong(deleteTarget.scheduled_date)} will be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget && deleteScheduled.mutate(deleteTarget.id)}
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
