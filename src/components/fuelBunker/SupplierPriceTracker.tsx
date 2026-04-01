import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
    type BulkDieselOrder,
    type BulkDieselPriceEntry,
    type BulkDieselSupplier,
    useBulkDieselOrders,
    useBulkDieselPriceEntries,
    useBulkDieselSuppliers,
    useCreateBulkDieselOrder,
    useCreateBulkDieselPriceEntry,
    useCreateBulkDieselSupplier,
    useDeleteBulkDieselPriceEntry,
    useDeleteBulkDieselSupplier,
    useUpdateBulkDieselSupplier,
} from "@/hooks/useSupplierPrices";
import { useFuelBunkers } from "@/hooks/useFuelBunkers";
import {
    generateOrdersExcel,
    generateOrdersPDF,
    generatePriceHistoryExcel,
    generatePriceHistoryPDF,
} from "@/lib/supplierExport";
import {
    Calendar,
    DollarSign,
    Edit,
    Eye,
    FileSpreadsheet,
    FileText,
    Loader2,
    Plus,
    ShoppingCart,
    Trash2,
    TrendingUp,
    Truck,
    Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type ViewMode = "weekly" | "monthly" | "month-weekly";
type ActiveView = "overview" | "orders" | "price-log" | "suppliers";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SUPPLIER_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#9333ea",
    "#0891b2", "#d97706", "#e11d48", "#4f46e5", "#059669",
];

// ── Helpers ────────────────────────────────────────────

function getDateRange(mode: ViewMode, selectedMonth?: string): { from: string; to: string; label: string } {
    const now = new Date();
    const to = now.toISOString().split("T")[0];
    if (mode === "month-weekly" && selectedMonth) {
        const [year, month] = selectedMonth.split("-").map(Number);
        const from = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0); // last day of month
        return {
            from: from.toISOString().split("T")[0],
            to: end.toISOString().split("T")[0],
            label: `${MONTH_NAMES[month - 1]} ${year} — Weekly`,
        };
    }
    if (mode === "weekly") {
        const from = new Date(now);
        from.setDate(from.getDate() - 12 * 7);
        return { from: from.toISOString().split("T")[0], to, label: "Last 12 Weeks" };
    }
    const from = new Date(now);
    from.setMonth(from.getMonth() - 12);
    return { from: from.toISOString().split("T")[0], to, label: "Last 12 Months" };
}

function getWeekLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
    const weekNum = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    return `W${weekNum} '${String(d.getFullYear()).slice(2)}`;
}

function getWeekOfMonthLabel(dateStr: string): string {
    const d = new Date(dateStr);
    // Week of month: which Monday-aligned week does this date fall in?
    const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const firstMonday = new Date(firstOfMonth);
    const dayOfWeek = firstOfMonth.getDay();
    // Push to the Monday on or before the 1st
    firstMonday.setDate(firstOfMonth.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekNum = Math.floor((d.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
    const monthName = MONTH_NAMES[d.getMonth()].slice(0, 3);
    return `${monthName} W${weekNum}`;
}

function getMonthLabel(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}

function getPeriodKey(dateStr: string, mode: ViewMode): string {
    if (mode === "month-weekly") return getWeekOfMonthLabel(dateStr);
    return mode === "weekly" ? getWeekLabel(dateStr) : getMonthLabel(dateStr);
}

/** Returns { year, week } using ISO 8601 week numbering */
function getISOWeekInfo(dateStr: string): { year: number; week: number; weekStart: Date; weekEnd: Date } {
    const d = new Date(dateStr + "T00:00:00");
    const dayOfWeek = d.getDay() || 7; // Mon = 1 … Sun = 7
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + 4 - dayOfWeek);
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    // compute Monday–Sunday range
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - (dayOfWeek - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { year: thursday.getFullYear(), week, weekStart, weekEnd };
}

function aggregatePriceData(
    priceEntries: BulkDieselPriceEntry[],
    orders: BulkDieselOrder[],
    suppliers: BulkDieselSupplier[],
    mode: ViewMode,
    dateRange: { from: string; to: string }
) {
    // Merge price entries and order prices into a unified timeline
    const allPrices: { supplier_id: string; date: string; price: number }[] = [];

    for (const entry of priceEntries) {
        allPrices.push({ supplier_id: entry.supplier_id, date: entry.effective_date, price: entry.price_per_liter });
    }
    for (const order of orders) {
        allPrices.push({ supplier_id: order.supplier_id, date: order.order_date, price: order.price_per_liter });
    }

    if (allPrices.length === 0) return [];

    // Group by period
    const periodMap = new Map<string, Map<string, number[]>>();
    for (const p of allPrices) {
        const period = getPeriodKey(p.date, mode);
        if (!periodMap.has(period)) periodMap.set(period, new Map());
        const supplierMap = periodMap.get(period)!;
        if (!supplierMap.has(p.supplier_id)) supplierMap.set(p.supplier_id, []);
        supplierMap.get(p.supplier_id)!.push(p.price);
    }

    // Generate ordered period keys
    const periods: string[] = [];
    const current = new Date(dateRange.from);
    const end = new Date(dateRange.to);

    if (mode === "weekly" || mode === "month-weekly") {
        const day = current.getDay();
        current.setDate(current.getDate() - (day === 0 ? 6 : day - 1));
        while (current <= end) {
            periods.push(getPeriodKey(current.toISOString().split("T")[0], mode));
            current.setDate(current.getDate() + 7);
        }
    } else {
        current.setDate(1);
        while (current <= end) {
            periods.push(getPeriodKey(current.toISOString().split("T")[0], mode));
            current.setMonth(current.getMonth() + 1);
        }
    }

    const uniquePeriods = [...new Set(periods)];

    // Build chart data with carry-forward
    const lastKnown = new Map<string, number>();
    return uniquePeriods.map((period) => {
        const row: Record<string, string | number> = { period };
        const supplierPrices = periodMap.get(period);
        const periodValues: number[] = [];

        for (const supplier of suppliers) {
            if (supplierPrices?.has(supplier.id)) {
                const prices = supplierPrices.get(supplier.id)!;
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                lastKnown.set(supplier.id, avg);
                row[supplier.id] = parseFloat(avg.toFixed(2));
                periodValues.push(avg);
            } else if (lastKnown.has(supplier.id)) {
                const v = lastKnown.get(supplier.id)!;
                row[supplier.id] = v;
                periodValues.push(v);
            }
        }

        // Combined market average
        if (periodValues.length > 0) {
            row["__market_avg__"] = parseFloat((periodValues.reduce((a, b) => a + b, 0) / periodValues.length).toFixed(2));
        }

        return row;
    });
}

// ── Component ──────────────────────────────────────────

export default function SupplierPriceTracker() {
    const now = new Date();
    const [viewMode, setViewMode] = useState<ViewMode>("month-weekly");
    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
    const [activeView, setActiveView] = useState<ActiveView>("overview");
    const [orderFilterSupplier, setOrderFilterSupplier] = useState<string>("all");
    const [overviewSupplier, setOverviewSupplier] = useState<string>("all");
    const [detailDate, setDetailDate] = useState<string | null>(null);

    // Supplier form
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<BulkDieselSupplier | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deletePriceId, setDeletePriceId] = useState<string | null>(null);
    const [supplierForm, setSupplierForm] = useState({
        name: "", contact_person: "", phone: "", email: "", location: "", notes: "",
    });

    // Order form
    const [orderDialogOpen, setOrderDialogOpen] = useState(false);
    const [orderForm, setOrderForm] = useState({
        supplier_id: "", order_date: new Date().toISOString().split("T")[0],
        quantity_liters: "", price_per_liter: "", delivery_date: "",
        reference_number: "", bunker_id: "", notes: "",
    });

    // Price entry form
    const [priceDialogOpen, setPriceDialogOpen] = useState(false);
    const [priceForm, setPriceForm] = useState({
        supplier_id: "", price_per_liter: "",
        effective_date: new Date().toISOString().split("T")[0], notes: "",
    });

    // Data hooks
    const { data: suppliers = [], isLoading: loadingSuppliers } = useBulkDieselSuppliers(false);
    const activeSuppliers = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers]);
    const supplierIds = useMemo(() => activeSuppliers.map((s) => s.id), [activeSuppliers]);
    const dateRange = getDateRange(viewMode, selectedMonth);

    const { data: orders = [], isLoading: loadingOrders } = useBulkDieselOrders(
        orderFilterSupplier !== "all" ? orderFilterSupplier : undefined
    );
    const { data: priceEntries = [], isLoading: loadingPrices } = useBulkDieselPriceEntries(
        supplierIds, dateRange.from, dateRange.to
    );
    const { data: bunkers = [] } = useFuelBunkers(true);

    // Mutations
    const createSupplier = useCreateBulkDieselSupplier();
    const updateSupplier = useUpdateBulkDieselSupplier();
    const deleteSupplier = useDeleteBulkDieselSupplier();
    const createOrder = useCreateBulkDieselOrder();
    const createPriceEntry = useCreateBulkDieselPriceEntry();
    const deletePriceEntry = useDeleteBulkDieselPriceEntry();

    // Chart data
    const filteredOverviewSuppliers = useMemo(
        () => overviewSupplier === "all" ? activeSuppliers : activeSuppliers.filter((s) => s.id === overviewSupplier),
        [activeSuppliers, overviewSupplier]
    );
    const chartData = useMemo(
        () => aggregatePriceData(priceEntries, orders, filteredOverviewSuppliers, viewMode, dateRange),
        [priceEntries, orders, filteredOverviewSuppliers, viewMode, dateRange]
    );

    // Stats
    const stats = useMemo(() => {
        if (orders.length === 0) return null;
        const totalLiters = orders.reduce((s, o) => s + o.quantity_liters, 0);
        const totalCost = orders.reduce((s, o) => s + (o.total_cost || o.quantity_liters * o.price_per_liter), 0);
        const avgPrice = totalCost / totalLiters;

        // Cheapest & most expensive from latest prices or orders
        const latestPrices = new Map<string, number>();
        for (const o of [...orders].sort((a, b) => a.order_date.localeCompare(b.order_date))) {
            latestPrices.set(o.supplier_id, o.price_per_liter);
        }
        for (const e of [...priceEntries].sort((a, b) => a.effective_date.localeCompare(b.effective_date))) {
            latestPrices.set(e.supplier_id, e.price_per_liter);
        }

        let cheapest: { name: string; price: number } | null = null;
        let expensive: { name: string; price: number } | null = null;
        for (const [sid, price] of latestPrices) {
            const s = activeSuppliers.find((x) => x.id === sid);
            if (!s) continue;
            if (!cheapest || price < cheapest.price) cheapest = { name: s.name, price };
            if (!expensive || price > expensive.price) expensive = { name: s.name, price };
        }

        return { totalLiters, totalCost, avgPrice, cheapest, expensive, supplierCount: activeSuppliers.length };
    }, [orders, priceEntries, activeSuppliers]);

    // ── Handlers ───────────────────────────────────────

    const openSupplierDialog = (supplier?: BulkDieselSupplier) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setSupplierForm({
                name: supplier.name,
                contact_person: supplier.contact_person || "",
                phone: supplier.phone || "",
                email: supplier.email || "",
                location: supplier.location || "",
                notes: supplier.notes || "",
            });
        } else {
            setEditingSupplier(null);
            setSupplierForm({ name: "", contact_person: "", phone: "", email: "", location: "", notes: "" });
        }
        setSupplierDialogOpen(true);
    };

    const handleSaveSupplier = () => {
        if (!supplierForm.name.trim()) return;
        const payload = {
            name: supplierForm.name.trim(),
            contact_person: supplierForm.contact_person.trim() || null,
            phone: supplierForm.phone.trim() || null,
            email: supplierForm.email.trim() || null,
            location: supplierForm.location.trim() || null,
            notes: supplierForm.notes.trim() || null,
        };
        if (editingSupplier) {
            updateSupplier.mutate({ id: editingSupplier.id, ...payload }, {
                onSuccess: () => setSupplierDialogOpen(false),
            });
        } else {
            createSupplier.mutate(payload, {
                onSuccess: () => setSupplierDialogOpen(false),
            });
        }
    };

    const handleDeleteSupplier = () => {
        if (!deleteConfirmId) return;
        deleteSupplier.mutate(deleteConfirmId, {
            onSuccess: () => setDeleteConfirmId(null),
        });
    };

    const handleToggleActive = (supplier: BulkDieselSupplier) => {
        updateSupplier.mutate({ id: supplier.id, is_active: !supplier.is_active });
    };

    const openOrderDialog = () => {
        setOrderForm({
            supplier_id: activeSuppliers[0]?.id || "",
            order_date: new Date().toISOString().split("T")[0],
            quantity_liters: "", price_per_liter: "", delivery_date: "",
            reference_number: "", bunker_id: "", notes: "",
        });
        setOrderDialogOpen(true);
    };

    const handleSaveOrder = () => {
        if (!orderForm.supplier_id || !orderForm.quantity_liters || !orderForm.price_per_liter) return;
        createOrder.mutate({
            supplier_id: orderForm.supplier_id,
            order_date: orderForm.order_date,
            quantity_liters: parseFloat(orderForm.quantity_liters),
            price_per_liter: parseFloat(orderForm.price_per_liter),
            delivery_date: orderForm.delivery_date || undefined,
            reference_number: orderForm.reference_number.trim() || undefined,
            bunker_id: orderForm.bunker_id || undefined,
            notes: orderForm.notes.trim() || undefined,
        }, {
            onSuccess: () => setOrderDialogOpen(false),
        });
    };

    const openPriceDialog = () => {
        setPriceForm({
            supplier_id: activeSuppliers[0]?.id || "",
            price_per_liter: "",
            effective_date: new Date().toISOString().split("T")[0],
            notes: "",
        });
        setPriceDialogOpen(true);
    };

    const handleSavePrice = () => {
        if (!priceForm.supplier_id || !priceForm.price_per_liter) return;
        createPriceEntry.mutate({
            supplier_id: priceForm.supplier_id,
            price_per_liter: parseFloat(priceForm.price_per_liter),
            effective_date: priceForm.effective_date,
            notes: priceForm.notes.trim() || undefined,
        }, {
            onSuccess: () => setPriceDialogOpen(false),
        });
    };

    const isLoading = loadingSuppliers || loadingOrders || loadingPrices;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                    {(["overview", "orders", "price-log", "suppliers"] as ActiveView[]).map((v) => (
                        <Button
                            key={v}
                            variant={activeView === v ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setActiveView(v)}
                            className="capitalize"
                        >
                            {v === "overview" && <TrendingUp className="h-4 w-4 mr-1.5" />}
                            {v === "orders" && <ShoppingCart className="h-4 w-4 mr-1.5" />}
                            {v === "price-log" && <Calendar className="h-4 w-4 mr-1.5" />}
                            {v === "suppliers" && <Users className="h-4 w-4 mr-1.5" />}
                            {v === "price-log" ? "Price Log" : v}
                        </Button>
                    ))}
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={openPriceDialog}>
                        <DollarSign className="h-4 w-4 mr-1.5" />
                        Log Price
                    </Button>
                    <Button variant="outline" size="sm" onClick={openOrderDialog} disabled={activeSuppliers.length === 0}>
                        <ShoppingCart className="h-4 w-4 mr-1.5" />
                        Record Order
                    </Button>
                    <Button size="sm" onClick={() => openSupplierDialog()}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Supplier
                    </Button>
                </div>
            </div>

            {/* ─── OVERVIEW VIEW ────────────────────────────── */}
            {activeView === "overview" && (
                <>
                    {/* Stats */}
                    {stats && (
                        <div className="grid gap-4 md:grid-cols-4">
                            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-950 dark:to-gray-900/50">
                                <CardHeader className="pb-2">
                                    <CardDescription>Active Suppliers</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.supplierCount}</div>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-950 dark:to-gray-900/50">
                                <CardHeader className="pb-2">
                                    <CardDescription>Cheapest (Latest)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-600">
                                        {stats.cheapest ? `$${stats.cheapest.price.toFixed(2)}` : "—"}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{stats.cheapest?.name ?? "No data"}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-950 dark:to-gray-900/50">
                                <CardHeader className="pb-2">
                                    <CardDescription>Most Expensive (Latest)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-red-600">
                                        {stats.expensive ? `$${stats.expensive.price.toFixed(2)}` : "—"}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{stats.expensive?.name ?? "No data"}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-950 dark:to-gray-900/50">
                                <CardHeader className="pb-2">
                                    <CardDescription>Total Ordered</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {stats.totalLiters.toLocaleString("en-ZA")}L
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        ${stats.totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} total
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Price Trend Chart */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle>Price Comparison</CardTitle>
                                <CardDescription>{dateRange.label}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={overviewSupplier} onValueChange={setOverviewSupplier}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="All Suppliers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Suppliers</SelectItem>
                                        {activeSuppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="month-weekly">Month by Week</SelectItem>
                                        <SelectItem value="weekly">Last 12 Weeks</SelectItem>
                                        <SelectItem value="monthly">Last 12 Months</SelectItem>
                                    </SelectContent>
                                </Select>
                                {viewMode === "month-weekly" && (
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[170px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => {
                                                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                                                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                                return (
                                                    <SelectItem key={val} value={val}>
                                                        {MONTH_NAMES[d.getMonth()]} {d.getFullYear()}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {chartData.length > 0 && filteredOverviewSuppliers.length > 0 ? (
                                <ResponsiveContainer width="100%" height={350}>
                                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                        <XAxis dataKey="period" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                                        <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} domain={[1, "auto"]} />
                                        <Tooltip
                                            formatter={(value: number, name: string) => {
                                                if (name === "__market_avg__") return [`$${value.toFixed(2)}/L`, "Market Average"];
                                                const s = filteredOverviewSuppliers.find((x) => x.id === name);
                                                return [`$${value.toFixed(2)}/L`, s?.name || name];
                                            }}
                                            contentStyle={{
                                                backgroundColor: "hsl(var(--background))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: "8px",
                                                fontSize: "12px",
                                            }}
                                        />
                                        <Legend formatter={(v: string) => {
                                            if (v === "__market_avg__") return "Market Average";
                                            return filteredOverviewSuppliers.find((x) => x.id === v)?.name || v;
                                        }} />
                                        {filteredOverviewSuppliers.map((supplier, idx) => (
                                            <Line
                                                key={supplier.id}
                                                type="monotone"
                                                dataKey={supplier.id}
                                                stroke={SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                                activeDot={{ r: 5 }}
                                                connectNulls
                                            />
                                        ))}
                                        {filteredOverviewSuppliers.length > 1 && (
                                            <Line
                                                key="__market_avg__"
                                                type="monotone"
                                                dataKey="__market_avg__"
                                                stroke="#6b7280"
                                                strokeWidth={2}
                                                strokeDasharray="6 3"
                                                dot={false}
                                                connectNulls
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <TrendingUp className="h-10 w-10 mb-3 opacity-40" />
                                    <p className="text-sm">No price data available yet.</p>
                                    <p className="text-xs mt-1">Log prices or record orders to see trends.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Price Table */}
                    {filteredOverviewSuppliers.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Latest Prices by Supplier</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Supplier</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead className="text-right">Latest Price / L</TableHead>
                                                <TableHead className="text-right">Last Order Qty</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredOverviewSuppliers.map((supplier, idx) => {
                                                const latestOrder = orders.find((o) => o.supplier_id === supplier.id);
                                                const latestPrice = [...priceEntries]
                                                    .filter((e) => e.supplier_id === supplier.id)
                                                    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];

                                                const displayPrice = latestPrice?.price_per_liter ?? latestOrder?.price_per_liter;

                                                return (
                                                    <TableRow key={supplier.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full shrink-0"
                                                                    style={{ backgroundColor: SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length] }}
                                                                />
                                                                <span className="font-medium">{supplier.name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{supplier.location || "—"}</TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {displayPrice != null ? `$${displayPrice.toFixed(2)}` : "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {latestOrder ? `${latestOrder.quantity_liters.toLocaleString("en-ZA")}L` : "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 text-xs">
                                                                Active
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {activeSuppliers.length === 0 && (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold">No Bulk Diesel Suppliers</h3>
                                <p className="text-muted-foreground mt-1 max-w-sm">
                                    Add your bulk diesel suppliers to start tracking and comparing prices weekly.
                                </p>
                                <Button className="mt-4" onClick={() => openSupplierDialog()}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add First Supplier
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* ─── ORDERS VIEW ──────────────────────────────── */}
            {activeView === "orders" && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle>Order History</CardTitle>
                            <CardDescription>All bulk diesel orders with pricing</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={orderFilterSupplier} onValueChange={setOrderFilterSupplier}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="All Suppliers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Suppliers</SelectItem>
                                    {activeSuppliers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateOrdersPDF(orders, activeSuppliers)}
                                disabled={orders.length === 0}
                            >
                                <FileText className="h-4 w-4 mr-1.5" />
                                PDF
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateOrdersExcel(orders, activeSuppliers)}
                                disabled={orders.length === 0}
                            >
                                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                                Excel
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead className="text-right">Quantity (L)</TableHead>
                                        <TableHead className="text-right">Price / L</TableHead>
                                        <TableHead className="text-right">Total Cost</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Delivery</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.length > 0 ? (
                                        orders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                    {new Date(order.order_date).toLocaleDateString("en-ZA")}
                                                </TableCell>
                                                <TableCell>{order.supplier?.name || "—"}</TableCell>
                                                <TableCell className="text-right">
                                                    {order.quantity_liters.toLocaleString("en-ZA")}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    ${order.price_per_liter.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    ${(order.total_cost || order.quantity_liters * order.price_per_liter).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {order.reference_number || "—"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {order.delivery_date
                                                        ? new Date(order.delivery_date).toLocaleDateString("en-ZA")
                                                        : "—"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                                    {order.notes || "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                No orders recorded yet. Click "Record Order" to add your first order.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── PRICE LOG VIEW ────────────────────────── */}
            {activeView === "price-log" && (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle>Price Log</CardTitle>
                                <CardDescription>All recorded supplier prices grouped by week</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generatePriceHistoryPDF(priceEntries, activeSuppliers)}
                                    disabled={priceEntries.length === 0}
                                >
                                    <FileText className="h-4 w-4 mr-1.5" />
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generatePriceHistoryExcel(priceEntries, activeSuppliers)}
                                    disabled={priceEntries.length === 0}
                                >
                                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                                    Excel
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {priceEntries.length > 0 ? (
                                <div className="space-y-4">
                                    {Object.entries(
                                        priceEntries
                                            .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
                                            .reduce<Record<string, { entries: typeof priceEntries; week: number; year: number; weekStart: Date; weekEnd: Date }>>((acc, entry) => {
                                                const info = getISOWeekInfo(entry.effective_date);
                                                const key = `${info.year}-W${String(info.week).padStart(2, "0")}`;
                                                if (!acc[key]) acc[key] = { entries: [], week: info.week, year: info.year, weekStart: info.weekStart, weekEnd: info.weekEnd };
                                                acc[key].entries.push(entry);
                                                return acc;
                                            }, {})
                                    ).map(([key, { entries, week, weekStart, weekEnd }]) => {
                                        const avgPrice = entries.reduce((s, e) => s + e.price_per_liter, 0) / entries.length;
                                        const cheapest = entries.reduce((best, e) => (e.price_per_liter < best.price_per_liter ? e : best), entries[0]);
                                        const bestSupplier = activeSuppliers.find((s) => s.id === cheapest.supplier_id);
                                        const fmtRange = `${weekStart.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`;
                                        return (
                                            <div key={key} className="rounded-lg border">
                                                <button
                                                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors"
                                                    onClick={() => setDetailDate(detailDate === key ? null : key)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-semibold">
                                                            Week {week}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {fmtRange}
                                                        </span>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm text-muted-foreground">
                                                            Avg: <span className="font-medium text-foreground">${avgPrice.toFixed(2)}</span>
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            Best: <span className="font-medium text-green-600 dark:text-green-400">${cheapest.price_per_liter.toFixed(2)}</span>
                                                            {bestSupplier && <span className="ml-1">({bestSupplier.name})</span>}
                                                        </span>
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                </button>
                                                {detailDate === key && (
                                                    <div className="border-t">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Date</TableHead>
                                                                    <TableHead>Supplier</TableHead>
                                                                    <TableHead className="text-right">Price / Liter</TableHead>
                                                                    <TableHead>Notes</TableHead>
                                                                    <TableHead className="w-10" />
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {entries
                                                                    .sort((a, b) => a.price_per_liter - b.price_per_liter)
                                                                    .map((entry, idx) => {
                                                                        const supplier = activeSuppliers.find((s) => s.id === entry.supplier_id);
                                                                        const isCheapest = idx === 0 && entries.length > 1;
                                                                        return (
                                                                            <TableRow key={entry.id}>
                                                                                <TableCell className="text-muted-foreground text-sm">
                                                                                    {new Date(entry.effective_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                                                                                </TableCell>
                                                                                <TableCell className="font-medium">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {supplier?.name || "Unknown"}
                                                                                        {isCheapest && (
                                                                                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                                                                                Best Price
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-semibold">
                                                                                    ${entry.price_per_liter.toFixed(2)}
                                                                                </TableCell>
                                                                                <TableCell className="text-muted-foreground">
                                                                                    {entry.notes || "—"}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-7 w-7 p-0"
                                                                                        onClick={() => setDeletePriceId(entry.id)}
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">No Price Entries</h3>
                                    <p className="text-muted-foreground mt-1 max-w-sm">
                                        Log a price for a supplier to start building your price history.
                                    </p>
                                    <Button className="mt-4" onClick={() => setPriceDialogOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Log Price
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* ─── SUPPLIERS VIEW ───────────────────────────── */}
            {activeView === "suppliers" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Suppliers</CardTitle>
                        <CardDescription>Add, edit, or deactivate your bulk diesel suppliers</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suppliers.length > 0 ? (
                                        suppliers.map((supplier) => (
                                            <TableRow key={supplier.id} className={!supplier.is_active ? "opacity-50" : ""}>
                                                <TableCell className="font-medium">{supplier.name}</TableCell>
                                                <TableCell className="text-muted-foreground">{supplier.contact_person || "—"}</TableCell>
                                                <TableCell className="text-muted-foreground">{supplier.phone || "—"}</TableCell>
                                                <TableCell className="text-muted-foreground">{supplier.location || "—"}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={supplier.is_active ? "outline" : "secondary"}
                                                        className={supplier.is_active
                                                            ? "text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 text-xs cursor-pointer"
                                                            : "text-xs cursor-pointer"
                                                        }
                                                        onClick={() => handleToggleActive(supplier)}
                                                    >
                                                        {supplier.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="sm" onClick={() => openSupplierDialog(supplier)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(supplier.id)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No suppliers yet. Click "Add Supplier" to get started.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── DIALOGS ──────────────────────────────────── */}

            {/* Supplier Dialog */}
            <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {editingSupplier ? "Edit Supplier" : "Add Bulk Diesel Supplier"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingSupplier ? "Update supplier details" : "Add a new bulk diesel supplier to track"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="e.g. Diesel Direct SA"
                                value={supplierForm.name}
                                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Contact Person</Label>
                                <Input
                                    placeholder="John Doe"
                                    value={supplierForm.contact_person}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Phone</Label>
                                <Input
                                    placeholder="+27..."
                                    value={supplierForm.phone}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    placeholder="email@example.com"
                                    value={supplierForm.email}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Location</Label>
                                <Input
                                    placeholder="Johannesburg"
                                    value={supplierForm.location}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, location: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Notes</Label>
                            <Textarea
                                placeholder="Any notes about this supplier..."
                                value={supplierForm.notes}
                                rows={2}
                                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSaveSupplier}
                            disabled={!supplierForm.name.trim() || createSupplier.isPending || updateSupplier.isPending}
                        >
                            {(createSupplier.isPending || updateSupplier.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {editingSupplier ? "Save Changes" : "Add Supplier"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Order Dialog */}
            <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Record Bulk Diesel Order
                        </DialogTitle>
                        <DialogDescription>Log a purchase order from a supplier</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Supplier <span className="text-red-500">*</span></Label>
                            <Select value={orderForm.supplier_id} onValueChange={(v) => setOrderForm({ ...orderForm, supplier_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                                <SelectContent>
                                    {activeSuppliers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Order Date <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={orderForm.order_date}
                                    onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Delivery Date</Label>
                                <Input
                                    type="date"
                                    value={orderForm.delivery_date}
                                    onChange={(e) => setOrderForm({ ...orderForm, delivery_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Quantity (litres) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="5000"
                                    value={orderForm.quantity_liters}
                                    onChange={(e) => setOrderForm({ ...orderForm, quantity_liters: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Price per Litre ($) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="1.25"
                                    value={orderForm.price_per_liter}
                                    onChange={(e) => setOrderForm({ ...orderForm, price_per_liter: e.target.value })}
                                />
                            </div>
                        </div>
                        {orderForm.quantity_liters && orderForm.price_per_liter && (
                            <div className="p-3 bg-muted rounded-lg text-center">
                                <span className="text-sm text-muted-foreground">Estimated Total: </span>
                                <span className="font-bold text-lg">
                                    ${(parseFloat(orderForm.quantity_liters) * parseFloat(orderForm.price_per_liter)).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label>Destination Bunker</Label>
                            <Select value={orderForm.bunker_id} onValueChange={(v) => setOrderForm({ ...orderForm, bunker_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select bunker (optional)" /></SelectTrigger>
                                <SelectContent>
                                    {bunkers.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Reference Number</Label>
                            <Input
                                placeholder="PO-2026-001"
                                value={orderForm.reference_number}
                                onChange={(e) => setOrderForm({ ...orderForm, reference_number: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Notes</Label>
                            <Textarea
                                placeholder="Any notes about this order..."
                                rows={2}
                                value={orderForm.notes}
                                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSaveOrder}
                            disabled={!orderForm.supplier_id || !orderForm.quantity_liters || !orderForm.price_per_liter || createOrder.isPending}
                        >
                            {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Record Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Price Entry Dialog */}
            <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Log Supplier Price
                        </DialogTitle>
                        <DialogDescription>Record a price quote or rate from a supplier</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Supplier <span className="text-red-500">*</span></Label>
                            <Select value={priceForm.supplier_id} onValueChange={(v) => setPriceForm({ ...priceForm, supplier_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                                <SelectContent>
                                    {activeSuppliers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Price per Litre ($) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="1.25"
                                    value={priceForm.price_per_liter}
                                    onChange={(e) => setPriceForm({ ...priceForm, price_per_liter: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Effective Date</Label>
                                <Input
                                    type="date"
                                    value={priceForm.effective_date}
                                    onChange={(e) => setPriceForm({ ...priceForm, effective_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Notes</Label>
                            <Textarea
                                placeholder="e.g. Quoted for 10,000L+ orders"
                                rows={2}
                                value={priceForm.notes}
                                onChange={(e) => setPriceForm({ ...priceForm, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSavePrice}
                            disabled={!priceForm.supplier_id || !priceForm.price_per_liter || createPriceEntry.isPending}
                        >
                            {createPriceEntry.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save Price
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Price Entry Confirmation */}
            <AlertDialog open={!!deletePriceId} onOpenChange={() => setDeletePriceId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Price Entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove this price entry. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!deletePriceId) return;
                                deletePriceEntry.mutate(deletePriceId, {
                                    onSuccess: () => setDeletePriceId(null),
                                });
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletePriceEntry.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Supplier Confirmation */}
            <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this supplier and all their orders and price history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSupplier}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteSupplier.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
