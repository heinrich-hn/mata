import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

// vehicle_fines is created in migration 20260520000001 but not yet in generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const finesTable = () => (supabase as any).from("vehicle_fines");

const toDateOnly = (d: Date) => format(d, "yyyy-MM-dd");

interface VehicleFinesSectionProps {
    vehicleId: string;
}

interface FineRow {
    id: string;
    fine_number: string | null;
    fine_type: string;
    issued_date: string;
    due_date: string | null;
    amount: number;
    currency: string;
    location: string | null;
    issuing_authority: string | null;
    description: string | null;
    status: string;
    paid_date: string | null;
    paid_by: string | null;
    reference_number: string | null;
    notes: string | null;
    driver_id: string | null;
    driver?: { first_name: string; last_name: string } | null;
}

interface DriverOption {
    id: string;
    first_name: string;
    last_name: string;
    driver_number: string;
}

const FINE_TYPES = [
    { value: "speeding", label: "Speeding" },
    { value: "parking", label: "Parking" },
    { value: "traffic_violation", label: "Traffic Violation" },
    { value: "overloading", label: "Overloading" },
    { value: "license", label: "License / Permit" },
    { value: "red_light", label: "Red Light" },
    { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
    { value: "unpaid", label: "Unpaid" },
    { value: "paid", label: "Paid" },
    { value: "disputed", label: "Disputed" },
    { value: "waived", label: "Waived" },
    { value: "cancelled", label: "Cancelled" },
];

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case "paid":
            return "default";
        case "disputed":
            return "secondary";
        case "waived":
        case "cancelled":
            return "outline";
        case "unpaid":
        default:
            return "destructive";
    }
};

const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const VehicleFinesSection: React.FC<VehicleFinesSectionProps> = ({ vehicleId }) => {
    const { toast } = useToast();
    const [fines, setFines] = useState<FineRow[]>([]);
    const [drivers, setDrivers] = useState<DriverOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState<{
        fine_number: string;
        fine_type: string;
        issued_date: Date | undefined;
        due_date: Date | undefined;
        amount: string;
        currency: string;
        location: string;
        issuing_authority: string;
        description: string;
        driver_id: string;
        reference_number: string;
        notes: string;
    }>({
        fine_number: "",
        fine_type: "traffic_violation",
        issued_date: new Date(),
        due_date: undefined,
        amount: "",
        currency: "USD",
        location: "",
        issuing_authority: "",
        description: "",
        driver_id: "",
        reference_number: "",
        notes: "",
    });

    const resetForm = () =>
        setForm({
            fine_number: "",
            fine_type: "traffic_violation",
            issued_date: new Date(),
            due_date: undefined,
            amount: "",
            currency: "USD",
            location: "",
            issuing_authority: "",
            description: "",
            driver_id: "",
            reference_number: "",
            notes: "",
        });

    const fetchFines = async () => {
        if (!vehicleId) return;
        setLoading(true);
        const { data, error } = await finesTable()
            .select("*, driver:drivers(first_name, last_name)")
            .eq("vehicle_id", vehicleId)
            .order("issued_date", { ascending: false });
        if (error) {
            console.error("Failed to load fines:", error);
            toast({ title: "Could not load fines", description: error.message, variant: "destructive" });
        } else {
            setFines((data ?? []) as FineRow[]);
        }
        setLoading(false);
    };

    const fetchDrivers = async () => {
        const { data } = await supabase
            .from("drivers")
            .select("id, first_name, last_name, driver_number")
            .order("first_name", { ascending: true });
        if (data) setDrivers(data as DriverOption[]);
    };

    useEffect(() => {
        fetchFines();
        fetchDrivers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicleId]);

    const handleSubmit = async () => {
        if (!form.issued_date || !form.amount) {
            toast({
                title: "Missing fields",
                description: "Issued date and amount are required.",
                variant: "destructive",
            });
            return;
        }
        const amountNumber = parseFloat(form.amount);
        if (Number.isNaN(amountNumber) || amountNumber < 0) {
            toast({ title: "Invalid amount", description: "Enter a valid fine amount.", variant: "destructive" });
            return;
        }
        setSubmitting(true);
        const payload = {
            vehicle_id: vehicleId,
            driver_id: form.driver_id || null,
            fine_number: form.fine_number || null,
            fine_type: form.fine_type,
            issued_date: toDateOnly(form.issued_date),
            due_date: form.due_date ? toDateOnly(form.due_date) : null,
            amount: amountNumber,
            currency: form.currency || "USD",
            location: form.location || null,
            issuing_authority: form.issuing_authority || null,
            description: form.description || null,
            reference_number: form.reference_number || null,
            notes: form.notes || null,
            status: "unpaid",
        };
        const { error } = await finesTable().insert(payload);
        setSubmitting(false);
        if (error) {
            toast({ title: "Could not log fine", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Fine logged" });
        resetForm();
        setAdding(false);
        fetchFines();
    };

    const handleStatusChange = async (id: string, status: string) => {
        const patch: Record<string, unknown> = { status };
        if (status === "paid") patch.paid_date = toDateOnly(new Date());
        const { error } = await finesTable().update(patch).eq("id", id);
        if (error) {
            toast({ title: "Could not update fine", description: error.message, variant: "destructive" });
            return;
        }
        fetchFines();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this fine? This cannot be undone.")) return;
        const { error } = await finesTable().delete().eq("id", id);
        if (error) {
            toast({ title: "Could not delete fine", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Fine deleted" });
        fetchFines();
    };

    const totalOutstanding = fines
        .filter((f) => f.status === "unpaid" || f.status === "disputed")
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const totalPaid = fines
        .filter((f) => f.status === "paid")
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Fines
                        </CardTitle>
                        <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                            <span>
                                Outstanding: <span className="font-medium text-red-600">$ {totalOutstanding.toFixed(2)}</span>
                            </span>
                            <span>
                                Paid: <span className="font-medium text-green-700">$ {totalPaid.toFixed(2)}</span>
                            </span>
                            <span>Total: {fines.length}</span>
                        </div>
                    </div>
                    <Button onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"} size="sm">
                        {adding ? "Cancel" : (
                            <>
                                <Plus className="h-4 w-4 mr-1" /> Log Fine
                            </>
                        )}
                    </Button>
                </CardHeader>
                {adding && (
                    <CardContent className="border-t pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Fine Number</Label>
                                <Input
                                    value={form.fine_number}
                                    onChange={(e) => setForm({ ...form, fine_number: e.target.value })}
                                    placeholder="e.g. AARTO-123456"
                                />
                            </div>
                            <div>
                                <Label>Type</Label>
                                <Select value={form.fine_type} onValueChange={(v) => setForm({ ...form, fine_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FINE_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Issued Date *</Label>
                                <DatePicker value={form.issued_date} onChange={(d) => setForm({ ...form, issued_date: d })} />
                            </div>
                            <div>
                                <Label>Due Date</Label>
                                <DatePicker value={form.due_date} onChange={(d) => setForm({ ...form, due_date: d })} />
                            </div>
                            <div>
                                <Label>Amount *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <Label>Currency</Label>
                                <Input
                                    value={form.currency}
                                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                                    maxLength={3}
                                />
                            </div>
                            <div>
                                <Label>Driver</Label>
                                <Select
                                    value={form.driver_id || "none"}
                                    onValueChange={(v) => setForm({ ...form, driver_id: v === "none" ? "" : v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select driver (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— None —</SelectItem>
                                        {drivers.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.first_name} {d.last_name} ({d.driver_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Issuing Authority</Label>
                                <Input
                                    value={form.issuing_authority}
                                    onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })}
                                    placeholder="e.g. JMPD, SAPS"
                                />
                            </div>
                            <div>
                                <Label>Location</Label>
                                <Input
                                    value={form.location}
                                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                                    placeholder="Where the fine was issued"
                                />
                            </div>
                            <div>
                                <Label>Reference Number</Label>
                                <Input
                                    value={form.reference_number}
                                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Description</Label>
                                <Textarea
                                    rows={2}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Offence description"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Notes</Label>
                                <Textarea
                                    rows={2}
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => { setAdding(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                Save Fine
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Fine History</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading fines…
                        </div>
                    ) : fines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No fines recorded for this vehicle.</p>
                    ) : (
                        <div className="space-y-3">
                            {fines.map((fine) => (
                                <div key={fine.id} className="border rounded-md p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {fine.status === "unpaid" ? (
                                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                                ) : fine.status === "paid" ? (
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                ) : null}
                                                <span className="font-medium text-sm">
                                                    {fine.fine_number || "(no fine number)"} •{" "}
                                                    {FINE_TYPES.find((t) => t.value === fine.fine_type)?.label ?? fine.fine_type}
                                                </span>
                                                <Badge variant={statusBadgeVariant(fine.status)} className="text-xs capitalize">
                                                    {fine.status}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                                <span>Issued: {formatDate(fine.issued_date)}</span>
                                                {fine.due_date && <span>Due: {formatDate(fine.due_date)}</span>}
                                                {fine.paid_date && <span>Paid: {formatDate(fine.paid_date)}</span>}
                                                {fine.issuing_authority && <span>By: {fine.issuing_authority}</span>}
                                                {fine.location && <span>At: {fine.location}</span>}
                                                {fine.driver && (
                                                    <span>
                                                        Driver: {fine.driver.first_name} {fine.driver.last_name}
                                                    </span>
                                                )}
                                            </div>
                                            {fine.description && (
                                                <p className="text-xs mt-1">{fine.description}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <span className="font-semibold text-sm">
                                                {fine.currency} {Number(fine.amount).toFixed(2)}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Select value={fine.status} onValueChange={(v) => handleStatusChange(fine.id, v)}>
                                                    <SelectTrigger className="h-7 text-xs w-28">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map((s) => (
                                                            <SelectItem key={s.value} value={s.value}>
                                                                {s.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleDelete(fine.id)}
                                                    aria-label="Delete fine"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default VehicleFinesSection;
