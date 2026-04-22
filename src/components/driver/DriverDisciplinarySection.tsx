import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle, Calendar, ClipboardList, Edit,
    Eye, Filter, Gavel, Loader2, Plus, Search, Trash2,
} from "lucide-react";
import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/* ─── Constants ─── */

const CATEGORIES = [
    { value: "verbal_warning", label: "Verbal Warning" },
    { value: "written_warning", label: "Written Warning" },
    { value: "final_warning", label: "Final Warning" },
    { value: "suspension", label: "Suspension" },
    { value: "dismissal", label: "Dismissal" },
    { value: "counselling", label: "Counselling" },
    { value: "other", label: "Other" },
];

const ALL_STATUSES = [
    { value: "inquiry_logged", label: "Inquiry Logged" },
    { value: "hearing_scheduled", label: "Hearing Scheduled" },
    { value: "outcome_recorded", label: "Outcome Recorded" },
    { value: "appeal", label: "Appeal" },
    { value: "dismissed", label: "Dismissed" },
    { value: "resolved", label: "Resolved" },
];

/* ─── Types ─── */

interface DisciplinaryRecord {
    id: string;
    driver_id: string;
    title: string | null;
    incident_date: string;
    category: string;
    reason: string;
    description: string | null;
    hearing_date: string | null;
    hearing_time: string | null;
    hearing_venue: string | null;
    hearing_chairperson: string | null;
    outcome: string | null;
    outcome_date: string | null;
    sanction: string | null;
    status: string;
    follow_up_date: string | null;
    issued_by: string | null;
    created_at: string;
    drivers?: { first_name: string; last_name: string; driver_number: string };
}

/* ─── Stage 1: Log Inquiry ─── */
interface InquiryForm {
    driver_id: string;
    title: string;
    incident_date: Date | undefined;
    category: string;
    reason: string;
    description: string;
    issued_by: string;
}
const INITIAL_INQUIRY: InquiryForm = {
    driver_id: "", title: "", incident_date: new Date(), category: "other",
    reason: "", description: "", issued_by: "",
};

/* ─── Stage 2: Schedule Hearing ─── */
interface HearingForm {
    hearing_date: Date | undefined;
    hearing_time: string;
    hearing_venue: string;
    hearing_chairperson: string;
}
const INITIAL_HEARING: HearingForm = {
    hearing_date: undefined, hearing_time: "", hearing_venue: "", hearing_chairperson: "",
};

/* ─── Stage 3: Record Outcome ─── */
interface OutcomeForm {
    outcome: string;
    sanction: string;
    category: string;
    status: string;
    outcome_date: Date | undefined;
    follow_up_date: Date | undefined;
}
const INITIAL_OUTCOME: OutcomeForm = {
    outcome: "", sanction: "", category: "", status: "outcome_recorded",
    outcome_date: new Date(), follow_up_date: undefined,
};

/* ─── Component ─── */

export default function DriverDisciplinarySection() {
    const { toast } = useToast();
    const qc = useQueryClient();

    // Dialog state
    const [inquiryOpen, setInquiryOpen] = useState(false);
    const [hearingOpen, setHearingOpen] = useState(false);
    const [outcomeOpen, setOutcomeOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const [activeRecord, setActiveRecord] = useState<DisciplinaryRecord | null>(null);
    const [inquiryForm, setInquiryForm] = useState<InquiryForm>(INITIAL_INQUIRY);
    const [hearingForm, setHearingForm] = useState<HearingForm>(INITIAL_HEARING);
    const [outcomeForm, setOutcomeForm] = useState<OutcomeForm>(INITIAL_OUTCOME);
    const [editMode, setEditMode] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    /* ─── Queries ─── */

    const { data: drivers = [] } = useQuery({
        queryKey: ["drivers-list"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("drivers").select("id, first_name, last_name, driver_number").order("first_name");
            if (error) throw error;
            return data || [];
        },
    });

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["driver-disciplinary"],
        queryFn: async () => {
            const { data, error } = await db
                .from("driver_disciplinary")
                .select("*, drivers(first_name, last_name, driver_number)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data || []) as DisciplinaryRecord[];
        },
    });

    /* ─── Mutations ─── */

    const inquiryMutation = useMutation({
        mutationFn: async (f: InquiryForm) => {
            const row = {
                driver_id: f.driver_id,
                title: f.title || null,
                incident_date: f.incident_date?.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0],
                category: f.category,
                reason: f.reason,
                description: f.description || null,
                issued_by: f.issued_by || null,
                status: "inquiry_logged",
            };
            if (editMode && activeRecord) {
                const { error } = await db.from("driver_disciplinary").update(row).eq("id", activeRecord.id);
                if (error) throw error;
            } else {
                const { error } = await db.from("driver_disciplinary").insert(row);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["driver-disciplinary"] });
            toast({ title: editMode ? "Inquiry updated" : "Inquiry logged" });
            setInquiryOpen(false); setActiveRecord(null); setEditMode(false);
        },
        onError: (err) => {
            toast({ title: "Failed to save", description: (err as { message?: string }).message ?? String(err), variant: "destructive" });
        },
    });

    const hearingMutation = useMutation({
        mutationFn: async ({ id, f }: { id: string; f: HearingForm }) => {
            const { error } = await db.from("driver_disciplinary").update({
                hearing_date: f.hearing_date?.toISOString().split("T")[0] ?? null,
                hearing_time: f.hearing_time || null,
                hearing_venue: f.hearing_venue || null,
                hearing_chairperson: f.hearing_chairperson || null,
                status: "hearing_scheduled",
            }).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["driver-disciplinary"] });
            toast({ title: "Hearing scheduled" });
            setHearingOpen(false); setActiveRecord(null);
        },
        onError: () => { toast({ title: "Failed to schedule hearing", variant: "destructive" }); },
    });

    const outcomeMutation = useMutation({
        mutationFn: async ({ id, f }: { id: string; f: OutcomeForm }) => {
            const { error } = await db.from("driver_disciplinary").update({
                outcome: f.outcome || null,
                sanction: f.sanction || null,
                category: f.category,
                status: f.status,
                outcome_date: f.outcome_date?.toISOString().split("T")[0] ?? null,
                follow_up_date: f.follow_up_date?.toISOString().split("T")[0] ?? null,
            }).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["driver-disciplinary"] });
            toast({ title: "Outcome recorded" });
            setOutcomeOpen(false); setActiveRecord(null);
        },
        onError: () => { toast({ title: "Failed to record outcome", variant: "destructive" }); },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await db.from("driver_disciplinary").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["driver-disciplinary"] });
            toast({ title: "Record deleted" }); setDeleteId(null);
        },
        onError: () => { toast({ title: "Failed to delete", variant: "destructive" }); },
    });

    /* ─── Dialog Openers ─── */

    const openNewInquiry = () => {
        setInquiryForm(INITIAL_INQUIRY); setEditMode(false); setActiveRecord(null); setInquiryOpen(true);
    };

    const openEditInquiry = (rec: DisciplinaryRecord) => {
        setActiveRecord(rec); setEditMode(true);
        setInquiryForm({
            driver_id: rec.driver_id, title: rec.title || "",
            incident_date: new Date(rec.incident_date), category: rec.category,
            reason: rec.reason, description: rec.description || "", issued_by: rec.issued_by || "",
        });
        setInquiryOpen(true);
    };

    const openScheduleHearing = (rec: DisciplinaryRecord) => {
        setActiveRecord(rec);
        setHearingForm({
            hearing_date: rec.hearing_date ? new Date(rec.hearing_date) : undefined,
            hearing_time: rec.hearing_time || "",
            hearing_venue: rec.hearing_venue || "",
            hearing_chairperson: rec.hearing_chairperson || "",
        });
        setHearingOpen(true);
    };

    const openRecordOutcome = (rec: DisciplinaryRecord) => {
        setActiveRecord(rec);
        setOutcomeForm({
            outcome: rec.outcome || "", sanction: rec.sanction || "",
            category: rec.category,
            status: "outcome_recorded",
            outcome_date: rec.outcome_date ? new Date(rec.outcome_date) : new Date(),
            follow_up_date: rec.follow_up_date ? new Date(rec.follow_up_date) : undefined,
        });
        setOutcomeOpen(true);
    };

    /* ─── Filters ─── */

    const filtered = records.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const name = `${r.drivers?.first_name ?? ""} ${r.drivers?.last_name ?? ""}`.toLowerCase();
            const num = r.drivers?.driver_number?.toLowerCase() ?? "";
            const title = r.title?.toLowerCase() ?? "";
            if (!name.includes(q) && !num.includes(q) && !r.reason.toLowerCase().includes(q) && !title.includes(q)) return false;
        }
        return true;
    });

    /* ─── Helpers ─── */

    const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const fmtTimestamp = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

    const statusBadge = (s: string) => {
        const m: Record<string, { label: string; cls: string }> = {
            inquiry_logged: { label: "Inquiry Logged", cls: "bg-slate-100 text-slate-700" },
            hearing_scheduled: { label: "Hearing Scheduled", cls: "bg-blue-100 text-blue-700" },
            outcome_recorded: { label: "Outcome Recorded", cls: "bg-amber-100 text-amber-700" },
            appeal: { label: "Appeal", cls: "bg-orange-100 text-orange-700" },
            dismissed: { label: "Dismissed", cls: "bg-gray-100 text-gray-600" },
            resolved: { label: "Resolved", cls: "bg-emerald-100 text-emerald-700" },
        };
        const entry = m[s] || { label: s, cls: "" };
        return <Badge className={entry.cls}>{entry.label}</Badge>;
    };

    const catBadge = (c: string) => {
        const cls: Record<string, string> = {
            verbal_warning: "border-yellow-300 text-yellow-700",
            written_warning: "border-orange-300 text-orange-700",
            final_warning: "border-red-300 text-red-700",
            suspension: "border-red-400 text-red-800",
            dismissal: "border-red-500 text-red-900",
            counselling: "border-blue-300 text-blue-700",
            other: "border-gray-300 text-gray-700",
        };
        return <Badge variant="outline" className={cls[c] || ""}>{catLabel(c)}</Badge>;
    };

    // Which actions are available per stage
    const canScheduleHearing = (s: string) => s === "inquiry_logged";
    const canRecordOutcome = (s: string) => s === "hearing_scheduled";

    // Stats
    const inquiryCount = records.filter((r) => r.status === "inquiry_logged").length;
    const scheduledCount = records.filter((r) => r.status === "hearing_scheduled").length;
    const closedCount = records.filter((r) => ["outcome_recorded", "resolved", "dismissed"].includes(r.status)).length;

    /* ─── Render ─── */

    return (
        <div className="space-y-4">
            {/* Process Steps */}
            <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="font-semibold text-blue-700">Process:</span>
                        <span className="flex items-center gap-1 font-medium"><ClipboardList className="h-3.5 w-3.5" /> 1. Log Inquiry</span>
                        <span className="text-blue-400">→</span>
                        <span className="flex items-center gap-1 font-medium"><Calendar className="h-3.5 w-3.5" /> 2. Schedule Hearing</span>
                        <span className="text-blue-400">→</span>
                        <span className="flex items-center gap-1 font-medium"><Gavel className="h-3.5 w-3.5" /> 3. Record Outcome</span>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground uppercase">Total Cases</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3"><span className="text-2xl font-bold">{records.length}</span></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-slate-600 uppercase">Awaiting Hearing</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3"><span className="text-2xl font-bold text-slate-600">{inquiryCount}</span></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-blue-600 uppercase">Hearing Scheduled</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3"><span className="text-2xl font-bold text-blue-600">{scheduledCount}</span></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-emerald-600 uppercase">Closed</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3"><span className="text-2xl font-bold text-emerald-600">{closedCount}</span></CardContent>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search driver, title or reason…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {ALL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={openNewInquiry}>
                    <Plus className="h-4 w-4 mr-1" /> Log Inquiry
                </Button>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                    <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No disciplinary records found.</p>
                </CardContent></Card>
            ) : (
                <Card><CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Logged</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Incident Date</TableHead>
                                <TableHead>Hearing</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Outcome</TableHead>
                                <TableHead className="w-[130px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((rec) => (
                                <TableRow key={rec.id}>
                                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtTimestamp(rec.created_at)}</TableCell>
                                    <TableCell>
                                        <div className="font-medium text-sm">{rec.drivers?.first_name} {rec.drivers?.last_name}</div>
                                        <div className="text-xs text-muted-foreground">{rec.drivers?.driver_number}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[160px] truncate text-sm font-medium" title={rec.title || rec.reason}>{rec.title || rec.reason}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(rec.incident_date)}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                        {rec.hearing_date ? (
                                            <span>{fmtDate(rec.hearing_date)}{rec.hearing_time && <span className="text-muted-foreground ml-1">{rec.hearing_time}</span>}</span>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>{statusBadge(rec.status)}</TableCell>
                                    <TableCell className="max-w-[140px] truncate text-sm" title={rec.outcome || ""}>{rec.outcome || <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-0.5">
                                            <Button variant="ghost" size="icon" onClick={() => { setActiveRecord(rec); setViewOpen(true); }} title="View"><Eye className="h-4 w-4" /></Button>
                                            {canScheduleHearing(rec.status) && (
                                                <Button variant="ghost" size="icon" onClick={() => openScheduleHearing(rec)} title="Schedule hearing"><Calendar className="h-4 w-4 text-blue-600" /></Button>
                                            )}
                                            {canRecordOutcome(rec.status) && (
                                                <Button variant="ghost" size="icon" onClick={() => openRecordOutcome(rec)} title="Record outcome"><Gavel className="h-4 w-4 text-amber-600" /></Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => openEditInquiry(rec)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(rec.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent></Card>
            )}

            {/* ═══ Stage 1: Log Inquiry Dialog ═══ */}
            <Dialog open={inquiryOpen} onOpenChange={(o) => { if (!o) { setInquiryOpen(false); setActiveRecord(null); setEditMode(false); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-slate-600" />
                            {editMode ? "Edit Inquiry" : "Log Disciplinary Inquiry"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label>Driver *</Label>
                            <Select value={inquiryForm.driver_id} onValueChange={(v) => setInquiryForm((s) => ({ ...s, driver_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                                <SelectContent>
                                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name} ({d.driver_number})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Title</Label>
                            <Input value={inquiryForm.title} onChange={(e) => setInquiryForm((s) => ({ ...s, title: e.target.value }))} placeholder="e.g. Late arrival — 15 Apr 2026" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Incident Date *</Label>
                                <DatePicker value={inquiryForm.incident_date} onChange={(d) => setInquiryForm((s) => ({ ...s, incident_date: d }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Category</Label>
                                <Select value={inquiryForm.category} onValueChange={(v) => setInquiryForm((s) => ({ ...s, category: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Non-Conformance / Reason *</Label>
                            <Textarea value={inquiryForm.reason} onChange={(e) => setInquiryForm((s) => ({ ...s, reason: e.target.value }))} placeholder="Describe the non-conformance…" rows={3} />
                        </div>
                        <div className="space-y-1">
                            <Label>Additional Description</Label>
                            <Textarea value={inquiryForm.description} onChange={(e) => setInquiryForm((s) => ({ ...s, description: e.target.value }))} placeholder="Any supporting details…" rows={2} />
                        </div>
                        <div className="space-y-1">
                            <Label>Issued By</Label>
                            <Input value={inquiryForm.issued_by} onChange={(e) => setInquiryForm((s) => ({ ...s, issued_by: e.target.value }))} placeholder="Manager name" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setInquiryOpen(false); setActiveRecord(null); setEditMode(false); }}>Cancel</Button>
                        <Button onClick={() => {
                            if (!inquiryForm.driver_id || !inquiryForm.reason) { toast({ title: "Driver and reason are required", variant: "destructive" }); return; }
                            inquiryMutation.mutate(inquiryForm);
                        }} disabled={inquiryMutation.isPending}>
                            {inquiryMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                            {editMode ? "Update" : "Log Inquiry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Stage 2: Schedule Hearing Dialog ═══ */}
            <Dialog open={hearingOpen} onOpenChange={(o) => { if (!o) { setHearingOpen(false); setActiveRecord(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            Schedule Hearing
                        </DialogTitle>
                    </DialogHeader>
                    {activeRecord && (
                        <div className="text-sm space-y-1 bg-muted/40 rounded-md p-3">
                            <div><span className="font-medium">Driver:</span> {activeRecord.drivers?.first_name} {activeRecord.drivers?.last_name}</div>
                            <div><span className="font-medium">Title:</span> {activeRecord.title || activeRecord.reason}</div>
                            <div><span className="font-medium">Category:</span> {catLabel(activeRecord.category)}</div>
                        </div>
                    )}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Hearing Date *</Label>
                                <DatePicker value={hearingForm.hearing_date} onChange={(d) => setHearingForm((s) => ({ ...s, hearing_date: d }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Time</Label>
                                <Input value={hearingForm.hearing_time} onChange={(e) => setHearingForm((s) => ({ ...s, hearing_time: e.target.value }))} placeholder="e.g. 09:00" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Venue</Label>
                            <Input value={hearingForm.hearing_venue} onChange={(e) => setHearingForm((s) => ({ ...s, hearing_venue: e.target.value }))} placeholder="e.g. Conference Room A" />
                        </div>
                        <div className="space-y-1">
                            <Label>Chairperson</Label>
                            <Input value={hearingForm.hearing_chairperson} onChange={(e) => setHearingForm((s) => ({ ...s, hearing_chairperson: e.target.value }))} placeholder="Name of chairperson" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setHearingOpen(false); setActiveRecord(null); }}>Cancel</Button>
                        <Button onClick={() => {
                            if (!activeRecord) return;
                            if (!hearingForm.hearing_date) { toast({ title: "Hearing date is required", variant: "destructive" }); return; }
                            hearingMutation.mutate({ id: activeRecord.id, f: hearingForm });
                        }} disabled={hearingMutation.isPending}>
                            {hearingMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                            Schedule Hearing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Stage 3: Record Outcome Dialog ═══ */}
            <Dialog open={outcomeOpen} onOpenChange={(o) => { if (!o) { setOutcomeOpen(false); setActiveRecord(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gavel className="h-5 w-5 text-amber-600" />
                            Record Outcome
                        </DialogTitle>
                    </DialogHeader>
                    {activeRecord && (
                        <div className="text-sm space-y-1 bg-muted/40 rounded-md p-3">
                            <div><span className="font-medium">Driver:</span> {activeRecord.drivers?.first_name} {activeRecord.drivers?.last_name}</div>
                            <div><span className="font-medium">Title:</span> {activeRecord.title || activeRecord.reason}</div>
                            {activeRecord.hearing_date && <div><span className="font-medium">Hearing:</span> {fmtDate(activeRecord.hearing_date)}{activeRecord.hearing_time && ` at ${activeRecord.hearing_time}`}</div>}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label>Outcome *</Label>
                            <Textarea value={outcomeForm.outcome} onChange={(e) => setOutcomeForm((s) => ({ ...s, outcome: e.target.value }))} placeholder="Describe the hearing outcome…" rows={3} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Sanction / Action</Label>
                                <Select value={outcomeForm.category} onValueChange={(v) => setOutcomeForm((s) => ({ ...s, category: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select sanction" /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Sanction Details</Label>
                                <Input value={outcomeForm.sanction} onChange={(e) => setOutcomeForm((s) => ({ ...s, sanction: e.target.value }))} placeholder="e.g. 3-day suspension" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Status</Label>
                                <Select value={outcomeForm.status} onValueChange={(v) => setOutcomeForm((s) => ({ ...s, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="outcome_recorded">Outcome Recorded</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                        <SelectItem value="appeal">Appeal</SelectItem>
                                        <SelectItem value="dismissed">Dismissed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Outcome Date</Label>
                                <DatePicker value={outcomeForm.outcome_date} onChange={(d) => setOutcomeForm((s) => ({ ...s, outcome_date: d }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Follow-up Date</Label>
                            <DatePicker value={outcomeForm.follow_up_date} onChange={(d) => setOutcomeForm((s) => ({ ...s, follow_up_date: d }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOutcomeOpen(false); setActiveRecord(null); }}>Cancel</Button>
                        <Button onClick={() => {
                            if (!activeRecord) return;
                            if (!outcomeForm.outcome) { toast({ title: "Outcome is required", variant: "destructive" }); return; }
                            outcomeMutation.mutate({ id: activeRecord.id, f: outcomeForm });
                        }} disabled={outcomeMutation.isPending}>
                            {outcomeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                            Record Outcome
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ View Details Dialog ═══ */}
            <Dialog open={viewOpen} onOpenChange={(o) => { if (!o) { setViewOpen(false); setActiveRecord(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Disciplinary Details</DialogTitle></DialogHeader>
                    {activeRecord && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-[120px_1fr] gap-y-2">
                                <span className="font-medium text-muted-foreground">Driver:</span>
                                <span>{activeRecord.drivers?.first_name} {activeRecord.drivers?.last_name} ({activeRecord.drivers?.driver_number})</span>
                                <span className="font-medium text-muted-foreground">Logged:</span>
                                <span>{fmtTimestamp(activeRecord.created_at)}</span>
                                <span className="font-medium text-muted-foreground">Incident Date:</span>
                                <span>{fmtDate(activeRecord.incident_date)}</span>
                                {activeRecord.title && <><span className="font-medium text-muted-foreground">Title:</span><span>{activeRecord.title}</span></>}
                                <span className="font-medium text-muted-foreground">Category:</span>
                                <span>{catBadge(activeRecord.category)}</span>
                                <span className="font-medium text-muted-foreground">Status:</span>
                                <span>{statusBadge(activeRecord.status)}</span>
                                {activeRecord.issued_by && <><span className="font-medium text-muted-foreground">Issued By:</span><span>{activeRecord.issued_by}</span></>}
                            </div>
                            <div className="border-t pt-2">
                                <p className="font-medium text-muted-foreground mb-1">Non-Conformance</p>
                                <p className="whitespace-pre-wrap">{activeRecord.reason}</p>
                            </div>
                            {activeRecord.description && (
                                <div><p className="font-medium text-muted-foreground mb-1">Description</p><p className="whitespace-pre-wrap">{activeRecord.description}</p></div>
                            )}
                            {activeRecord.hearing_date && (
                                <div className="border-t pt-2">
                                    <p className="font-medium text-muted-foreground mb-1">Hearing</p>
                                    <div className="space-y-0.5">
                                        <div>{fmtDate(activeRecord.hearing_date)}{activeRecord.hearing_time && ` at ${activeRecord.hearing_time}`}</div>
                                        {activeRecord.hearing_venue && <div>Venue: {activeRecord.hearing_venue}</div>}
                                        {activeRecord.hearing_chairperson && <div>Chair: {activeRecord.hearing_chairperson}</div>}
                                    </div>
                                </div>
                            )}
                            {activeRecord.outcome && (
                                <div className="border-t pt-2">
                                    <p className="font-medium text-muted-foreground mb-1">Outcome</p>
                                    <p className="whitespace-pre-wrap">{activeRecord.outcome}</p>
                                    {activeRecord.sanction && <p className="mt-1"><span className="font-medium">Sanction:</span> {activeRecord.sanction}</p>}
                                    {activeRecord.outcome_date && <p className="text-xs text-muted-foreground mt-1">Recorded: {fmtDate(activeRecord.outcome_date)}</p>}
                                </div>
                            )}
                            {activeRecord.follow_up_date && (
                                <div className="border-t pt-2"><p className="font-medium text-muted-foreground">Follow-up: {fmtDate(activeRecord.follow_up_date)}</p></div>
                            )}
                        </div>
                    )}
                    <DialogFooter><Button variant="outline" onClick={() => { setViewOpen(false); setActiveRecord(null); }}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Delete Confirmation ═══ */}
            <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Delete Record</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}