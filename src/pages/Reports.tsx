import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import {
    AlertTriangle,
    Calendar,
    Car,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    FileSpreadsheet,
    FileText,
    Fuel,
    Gauge,
    Receipt,
    Search,
    ShoppingCart,
    Truck,
    Users,
    Wrench,
} from "lucide-react";
import { useState } from "react";

// ── Lazy imports for export functions ────────────────────────────────────────
import {
    exportAllTyresToExcel,
    exportAllTyresToPDF,
    exportBrandSummaryToExcel,
    exportBrandSummaryToPDF,
} from "@/utils/tyreExport";
import {
    exportSchedulesToExcel,
    exportSchedulesToPDF,
    exportHistoryToExcel,
    exportHistoryToPDF,
    exportOverdueToExcel,
    exportOverdueToPDF,
} from "@/lib/maintenanceExport";
import { generateAllFaultsPDF } from "@/lib/faultExport";
import { generateBatchInspectionPDF } from "@/lib/inspectionPdfExport";
import {
    addStyledSheet,
    addSummarySheet,
    createWorkbook,
    saveWorkbook,
    statusColours,
} from "@/utils/excelStyles";

// ── Types ────────────────────────────────────────────────────────────────────

type Vehicle = {
    id: string;
    fleet_number?: string;
    registration_number?: string;
    make?: string;
    model?: string;
};

type Inspection = {
    id: string;
    inspection_date: string;
    report_number?: string;
    vehicle_name?: string;
    vehicle_id?: string;
    inspector_name?: string;
    location?: string;
    meter_reading?: number;
    vehicle_safe_to_use?: boolean;
    maintenance_priority?: string;
    vehicle_category?: string;
    vehicle_status?: string;
};

type JobCard = {
    id: string;
    job_number?: string;
    vehicle_id?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    created_at?: string;
    description?: string;
    vehicles?: Vehicle | null;
};

type Trip = {
    id: string;
    trip_number?: string;
    fleet_vehicle_id?: string;
    fleet_number?: string;
    driver_name?: string;
    origin?: string;
    destination?: string;
    status?: string;
    departure_date?: string;
    planned_departure_date?: string;
    arrival_date?: string;
    planned_arrival_date?: string;
    base_revenue?: number;
    additional_revenue?: number;
    distance_km?: number;
    rate_per_km?: number;
    final_invoice_amount?: number;
};

type Driver = {
    id: string;
    first_name?: string;
    last_name?: string;
    driver_number?: string;
    license_number?: string;
    license_expiry?: string;
    phone?: string;
    status?: string;
    email?: string;
};

type DieselRecord = {
    id: string;
    date?: string;
    fleet_number?: string;
    driver_name?: string;
    fuel_station?: string;
    litres_filled?: number;
    cost_per_litre?: number;
    total_cost?: number;
    km_reading?: number;
    km_per_litre?: number;
};

type PartsRequest = {
    id: string;
    ir_number?: string;
    part_name?: string;
    status?: string;
    urgency_level?: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
    make_brand?: string;
    requested_by?: string;
    created_at?: string;
};

type ActionItem = {
    id: string;
    title?: string;
    status?: string;
    priority?: string;
    assigned_to?: string;
    due_date?: string;
    created_at?: string;
    description?: string;
};

type BrandSummary = {
    brand: string;
    bayCount: number;
    installedCount: number;
    totalQty: number;
    totalCost: number;
    totalKm: number;
    totalMmWorn: number;
    avgCostPerTyre: number;
    avgCostPerKm: number | null;
    avgCostPerMm: number | null;
};

type ReportItem = {
    id: string;
    label: string;
    description: string;
    formats: ("excel" | "pdf")[];
    onExport: (format: "excel" | "pdf") => Promise<void>;
};

type ReportSection = {
    title: string;
    icon: React.ElementType;
    description: string;
    badge?: string;
    reports: ReportItem[];
};

// ── Component ────────────────────────────────────────────────────────────────

const Reports = () => {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // ── Toggle section collapse state ──────────────────────────────────────────
    const toggleSection = (sectionTitle: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionTitle)) {
                next.delete(sectionTitle);
            } else {
                next.add(sectionTitle);
            }
            return next;
        });
    };

    // ── Expand/Collapse all sections in a category ─────────────────────────────
    const toggleAllWorkshop = (expand: boolean) => {
        const workshopTitles = sections.filter(s => s.badge === "Workshop").map(s => s.title);
        setExpandedSections(prev => {
            const next = new Set(prev);
            workshopTitles.forEach(title => {
                if (expand) {
                    next.add(title);
                } else {
                    next.delete(title);
                }
            });
            return next;
        });
    };

    const toggleAllOperations = (expand: boolean) => {
        const opsTitles = sections.filter(s => s.badge === "Operations").map(s => s.title);
        setExpandedSections(prev => {
            const next = new Set(prev);
            opsTitles.forEach(title => {
                if (expand) {
                    next.add(title);
                } else {
                    next.delete(title);
                }
            });
            return next;
        });
    };

    // ── Helper: wrap export call with loading & toast ──────────────────────────
    const runExport = async (id: string, fmt: "excel" | "pdf", fn: () => Promise<void>) => {
        setLoadingKey(`${id}:${fmt}`);
        try {
            await fn();
            toast({ title: "Export complete", description: "Your file has been downloaded." });
        } catch (err) {
            console.error("Export failed", err);
            toast({ title: "Export failed", description: String(err), variant: "destructive" });
        } finally {
            setLoadingKey(null);
        }
    };

    // ── Data fetchers (called on demand) ───────────────────────────────────────
    // ... (all fetch functions remain exactly the same) ...

    const fetchTyres = async () => {
        const { data, error } = await supabase.from("tyres").select("*");
        if (error) throw error;
        return data || [];
    };

    const fetchMaintenanceSchedules = async () => {
        const { data, error } = await supabase
            .from("maintenance_schedules")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("next_due_date") as { data: Record<string, unknown>[] | null; error: unknown };
        if (error) throw error;
        return data || [];
    };

    const fetchMaintenanceHistory = async () => {
        const { data, error } = await supabase
            .from("maintenance_schedule_history")
            .select("*, maintenance_schedules(service_type, vehicle_id)")
            .order("completed_date", { ascending: false }) as { data: Record<string, unknown>[] | null; error: unknown };
        if (error) throw error;
        return data || [];
    };

    const fetchOverdueSchedules = async () => {
        const today = new Date().toISOString().split("T")[0];
        const q: { lt: (col: string, val: string) => { neq: (col: string, val: string) => { order: (col: string) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } } } = supabase
            .from("maintenance_schedules")
            .select("*, vehicles(fleet_number, registration_number, make, model)") as never;
        const { data, error } = await q
            .lt("next_due_date", today)
            .neq("status", "completed")
            .order("next_due_date");
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchFaults = async () => {
        const { data, error } = await supabase
            .from("vehicle_faults")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("reported_date", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const fetchInspections = async (): Promise<Inspection[]> => {
        const { data, error } = await supabase
            .from("inspections")
            .select("*")
            .order("inspection_date", { ascending: false });
        if (error) throw error;
        return (data || []) as Inspection[];
    };

    const fetchJobCards = async (): Promise<JobCard[]> => {
        const { data, error } = await supabase
            .from("job_cards")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        const cards = (data || []) as JobCard[];
        const vehicleIds = [...new Set(cards.map((c: JobCard) => c.vehicle_id).filter(Boolean))];
        if (vehicleIds.length === 0) return cards;
        const { data: vehicles } = await supabase
            .from("vehicles")
            .select("id, fleet_number, registration_number, make, model")
            .in("id", vehicleIds);
        const vehicleMap = new Map((vehicles || []).map((v: Vehicle) => [v.id, v]));
        return cards.map((c: JobCard) => ({ ...c, vehicles: c.vehicle_id ? vehicleMap.get(c.vehicle_id) || null : null }));
    };

    const fetchTripsWithFleet = async (): Promise<Trip[]> => {
        const { data, error } = await supabase
            .from("trips")
            .select("*, vehicles:fleet_vehicle_id(fleet_number)")
            .order("departure_date", { ascending: true });
        if (error) throw error;
        return (data || []).map((t: Record<string, unknown>) => ({
            ...t,
            fleet_number: (t.vehicles as { fleet_number?: string } | null)?.fleet_number || null,
        })) as Trip[];
    };

    const fetchDrivers = async (): Promise<Driver[]> => {
        const { data, error } = await supabase
            .from("drivers")
            .select("*")
            .order("first_name");
        if (error) throw error;
        return (data || []) as Driver[];
    };

    const fetchDieselRecords = async (): Promise<DieselRecord[]> => {
        const { data, error } = await supabase
            .from("diesel_records")
            .select("*")
            .order("date", { ascending: false });
        if (error) throw error;
        return (data || []) as DieselRecord[];
    };

    const fetchProcurementRequests = async (): Promise<PartsRequest[]> => {
        const { data, error } = await supabase
            .from("parts_requests")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as PartsRequest[];
    };

    const fetchActionLog = async (): Promise<ActionItem[]> => {
        const { data, error } = await supabase
            .from("action_items")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as ActionItem[];
    };

    const fetchVehicles = async () => {
        const { data, error } = await supabase
            .from("vehicles")
            .select("*")
            .order("fleet_number");
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchWorkOrders = async () => {
        const { data, error } = await supabase
            .from("work_orders")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchIncidents = async () => {
        const { data, error } = await supabase
            .from("incidents")
            .select("*")
            .order("incident_date", { ascending: false });
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchInvoices = async () => {
        const { data, error } = await supabase
            .from("invoices")
            .select("*, trips(trip_number, driver_name, origin, destination)")
            .order("invoice_date", { ascending: false });
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchFuelBunkers = async () => {
        const { data, error } = await supabase
            .from("fuel_bunkers")
            .select("*")
            .order("name");
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    // ── Generic ExcelJS export builder ─────────────────────────────────────────
    const exportGenericExcel = async (
        filename: string,
        sheetName: string,
        title: string,
        headers: string[],
        rows: (string | number | null | undefined)[][],
        cellStyler?: (row: (string | number | null | undefined)[], col: number) => Partial<import("exceljs").Font> | undefined,
    ) => {
        const wb = createWorkbook();
        addStyledSheet(wb, sheetName, { title, headers, rows, cellStyler });
        await saveWorkbook(wb, filename);
    };

    const exportGenericPdf = async (
        title: string,
        headers: string[],
        rows: string[][],
        filename: string,
    ) => {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(16);
        doc.text(title, 14, 18);
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26);
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 32,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [242, 246, 252] },
        });
        doc.save(filename);
    };

    // ── Report Sections ────────────────────────────────────────────────────────
    // ... (sections array remains exactly the same) ...

    const sections: ReportSection[] = [
        // ── WORKSHOP MANAGEMENT ──────────────────────────────────────────────────
        {
            title: "Job Cards",
            icon: ClipboardList,
            description: "Job card records, costs, and status",
            badge: "Workshop",
            reports: [
                {
                    id: "job-cards-all",
                    label: "All Job Cards",
                    description: "Complete job card register with status, priority, and assignment details",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const cards = await fetchJobCards();
                        const headers = ["Job Card #", "Fleet", "Registration", "Status", "Priority", "Assigned To", "Created", "Description"];
                        const rows = cards.map((c: JobCard) => [
                            c.job_number || c.id?.slice(0, 8),
                            c.vehicles?.fleet_number || "-",
                            c.vehicles?.registration_number || "-",
                            c.status || "-",
                            c.priority || "-",
                            c.assignee || "-",
                            c.created_at ? new Date(c.created_at).toLocaleDateString() : "-",
                            c.description || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Job_Cards_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Job Cards", "ALL JOB CARDS REPORT", headers, rows,
                                (row, col) => col === 4 ? statusColours[String(row[3]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL JOB CARDS REPORT", headers, rows.map(r => r.map(String)),
                                `Job_Cards_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Inspections & Faults",
            icon: Search,
            description: "Vehicle inspections and fault tracking reports",
            badge: "Workshop",
            reports: [
                {
                    id: "inspections-all",
                    label: "All Inspections",
                    description: "Inspection history with results and inspector details",
                    formats: ["pdf"],
                    onExport: async () => {
                        const inspections = await fetchInspections();
                        const mapped = inspections.map((ins: Inspection) => ({
                            inspection_number: ins.report_number || ins.id?.slice(0, 8),
                            inspection_date: ins.inspection_date,
                            vehicle_registration: ins.vehicle_name || "-",
                            vehicle_make: "",
                            vehicle_model: "",
                            inspector_name: ins.inspector_name || "-",
                            fault_count: 0,
                            corrective_action_status: ins.maintenance_priority || "-",
                            linked_work_order: "-",
                            inspection_type: ins.vehicle_category || "-",
                            notes: "",
                            status: ins.vehicle_status || (ins.vehicle_safe_to_use ? "safe" : "unsafe"),
                            template_name: "-",
                        }));
                        await generateBatchInspectionPDF(mapped);
                    },
                },
                {
                    id: "faults-all",
                    label: "All Faults",
                    description: "Complete fault register with severity and resolution status",
                    formats: ["pdf"],
                    onExport: async () => {
                        const faults = await fetchFaults();
                        await generateAllFaultsPDF(faults as unknown as Parameters<typeof generateAllFaultsPDF>[0]);
                    },
                },
            ],
        },
        {
            title: "Tyre Management",
            icon: Gauge,
            description: "Fleet tyre inventory, health, and brand analysis",
            badge: "Workshop",
            reports: [
                {
                    id: "tyres-all",
                    label: "All Tyres Report",
                    description: "Every tyre in the fleet with tread depth, condition, and position",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const tyres = await fetchTyres();
                        if (fmt === "excel") await exportAllTyresToExcel(tyres as unknown as Parameters<typeof exportAllTyresToExcel>[0]);
                        else await exportAllTyresToPDF(tyres as unknown as Parameters<typeof exportAllTyresToPDF>[0]);
                    },
                },
                {
                    id: "tyres-brand-summary",
                    label: "Brand Performance Summary",
                    description: "Cost/KM and cost/MM analysis by tyre brand",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const tyres = await fetchTyres();
                        const brandMap = new Map<string, BrandSummary>();
                        tyres.forEach((t) => {
                            const brand = t.brand || "Unknown";
                            const existing = brandMap.get(brand);
                            const e = existing || {
                                brand,
                                bayCount: 0,
                                installedCount: 0,
                                totalQty: 0,
                                totalCost: 0,
                                totalKm: 0,
                                totalMmWorn: 0,
                                avgCostPerTyre: 0,
                                avgCostPerKm: null,
                                avgCostPerMm: null
                            };
                            e.totalQty += 1;
                            if (t.current_fleet_position) e.installedCount += 1; else e.bayCount += 1;
                            e.totalCost += t.purchase_cost_zar || 0;
                            e.totalKm += t.km_travelled || 0;
                            if (t.initial_tread_depth && t.current_tread_depth) e.totalMmWorn += Math.max(0, t.initial_tread_depth - t.current_tread_depth);
                            brandMap.set(brand, e);
                        });
                        const brandData = Array.from(brandMap.values()).map((d: BrandSummary) => ({
                            ...d,
                            avgCostPerTyre: d.totalQty > 0 ? d.totalCost / d.totalQty : 0,
                            avgCostPerKm: d.totalKm > 0 ? d.totalCost / d.totalKm : null,
                            avgCostPerMm: d.totalMmWorn > 0 ? d.totalCost / d.totalMmWorn : null,
                        }));
                        const gt = brandData.reduce((acc: BrandSummary, b: BrandSummary) => ({
                            brand: "TOTAL",
                            bayCount: acc.bayCount + b.bayCount,
                            installedCount: acc.installedCount + b.installedCount,
                            totalQty: acc.totalQty + b.totalQty,
                            totalCost: acc.totalCost + b.totalCost,
                            totalKm: acc.totalKm + b.totalKm,
                            totalMmWorn: acc.totalMmWorn + b.totalMmWorn,
                            avgCostPerTyre: 0,
                            avgCostPerKm: null,
                            avgCostPerMm: null,
                        }), { brand: "", bayCount: 0, installedCount: 0, totalQty: 0, totalCost: 0, totalKm: 0, totalMmWorn: 0, avgCostPerTyre: 0, avgCostPerKm: null, avgCostPerMm: null });
                        if (fmt === "excel") await exportBrandSummaryToExcel(brandData, gt);
                        else await exportBrandSummaryToPDF(brandData, gt);
                    },
                },
            ],
        },
        {
            title: "Maintenance Scheduling",
            icon: Calendar,
            description: "Service schedules, history, and overdue alerts",
            badge: "Workshop",
            reports: [
                {
                    id: "maintenance-schedules",
                    label: "Service Schedules",
                    description: "All upcoming and active maintenance schedules",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const schedules = await fetchMaintenanceSchedules();
                        if (fmt === "excel") await exportSchedulesToExcel(schedules as unknown as Parameters<typeof exportSchedulesToExcel>[0]);
                        else await exportSchedulesToPDF(schedules as unknown as Parameters<typeof exportSchedulesToPDF>[0]);
                    },
                },
                {
                    id: "maintenance-history",
                    label: "Maintenance History",
                    description: "Completed maintenance records with costs and duration",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const history = await fetchMaintenanceHistory();
                        if (fmt === "excel") await exportHistoryToExcel(history as unknown as Parameters<typeof exportHistoryToExcel>[0]);
                        else await exportHistoryToPDF(history as unknown as Parameters<typeof exportHistoryToPDF>[0]);
                    },
                },
                {
                    id: "maintenance-overdue",
                    label: "Overdue Alerts",
                    description: "Maintenance tasks past their due date",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const overdue = await fetchOverdueSchedules();
                        if (fmt === "excel") await exportOverdueToExcel(overdue as unknown as Parameters<typeof exportOverdueToExcel>[0]);
                        else await exportOverdueToPDF(overdue as unknown as Parameters<typeof exportOverdueToPDF>[0]);
                    },
                },
            ],
        },
        {
            title: "Procurement & Inventory",
            icon: ShoppingCart,
            description: "Parts requests, stock levels, and restock alerts",
            badge: "Workshop",
            reports: [
                {
                    id: "procurement-requests",
                    label: "All Parts Requests",
                    description: "Complete parts request register with status and cost",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const requests = await fetchProcurementRequests();
                        const headers = ["Request #", "Part Name", "Fleet", "Status", "Priority", "Qty", "Unit Cost", "Total Cost", "Requested By", "Date"];
                        const rows = requests.map((r: PartsRequest) => [
                            r.ir_number || r.id.slice(0, 8),
                            r.part_name || "-",
                            r.make_brand || "-",
                            r.status || "-",
                            r.urgency_level || "-",
                            r.quantity ?? 0,
                            r.unit_price != null ? Number(r.unit_price).toFixed(2) : "0.00",
                            r.total_price != null ? Number(r.total_price).toFixed(2) : "0.00",
                            r.requested_by || "-",
                            r.created_at ? new Date(r.created_at).toLocaleDateString() : "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Parts_Requests_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Parts Requests", "ALL PARTS REQUESTS", headers, rows,
                                (row, col) => col === 4 ? statusColours[String(row[3]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL PARTS REQUESTS", headers, rows.map(r => r.map(String)),
                                `Parts_Requests_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Fleet Vehicles",
            icon: Car,
            description: "Vehicle fleet register and status",
            badge: "Workshop",
            reports: [
                {
                    id: "vehicles-all",
                    label: "Vehicle Fleet Register",
                    description: "Complete vehicle register with type, make, model, and odometer",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const vehicles = await fetchVehicles();
                        const headers = ["Fleet #", "Registration", "Make", "Model", "Type", "Tonnage", "Active", "Odometer"];
                        const rows = vehicles.map((v: Record<string, unknown>) => [
                            (v.fleet_number as string) || "-",
                            (v.registration_number as string) || "-",
                            (v.make as string) || "-",
                            (v.model as string) || "-",
                            (v.vehicle_type as string) || "-",
                            v.tonnage != null ? String(v.tonnage) : "-",
                            v.active ? "Yes" : "No",
                            v.current_odometer != null ? Number(v.current_odometer).toLocaleString() : "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Fleet_Register_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Fleet Register", "FLEET VEHICLE REGISTER", headers, rows,
                            );
                        } else {
                            await exportGenericPdf("FLEET VEHICLE REGISTER", headers, rows.map(r => r.map(String)),
                                `Fleet_Register_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Work Orders",
            icon: Wrench,
            description: "Work order tracking, costs, and completion",
            badge: "Workshop",
            reports: [
                {
                    id: "work-orders-all",
                    label: "All Work Orders",
                    description: "Complete work order register with status, priority, and costs",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const orders = await fetchWorkOrders();
                        const headers = ["WO #", "Title", "Fleet", "Registration", "Status", "Priority", "Technician", "Est. Cost", "Actual Cost", "Created"];
                        const rows = orders.map((o: Record<string, unknown>) => {
                            const v = o.vehicles as Record<string, unknown> | null;
                            return [
                                (o.work_order_number as string) || (o.id as string)?.slice(0, 8),
                                (o.title as string) || "-",
                                (v?.fleet_number as string) || "-",
                                (v?.registration_number as string) || "-",
                                (o.status as string) || "-",
                                (o.priority as string) || "-",
                                (o.assigned_technician as string) || "-",
                                o.estimated_total_cost != null ? Number(o.estimated_total_cost).toFixed(2) : "-",
                                o.actual_total_cost != null ? Number(o.actual_total_cost).toFixed(2) : "-",
                                o.created_at ? new Date(o.created_at as string).toLocaleDateString() : "-",
                            ];
                        });
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Work_Orders_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Work Orders", "ALL WORK ORDERS REPORT", headers, rows,
                                (row, col) => col === 5 ? statusColours[String(row[4]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL WORK ORDERS REPORT", headers, rows.map(r => r.map(String)),
                                `Work_Orders_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Incidents & Accidents",
            icon: AlertTriangle,
            description: "Incident reports, severity, and resolution tracking",
            badge: "Workshop",
            reports: [
                {
                    id: "incidents-all",
                    label: "All Incidents",
                    description: "Complete incident register with type, severity, and status",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const incidents = await fetchIncidents();
                        const headers = ["Incident #", "Date", "Type", "Location", "Severity", "Status", "Driver", "Vehicle", "Reported By"];
                        const rows = incidents.map((i: Record<string, unknown>) => [
                            (i.incident_number as string) || (i.id as string)?.slice(0, 8),
                            i.incident_date ? new Date(i.incident_date as string).toLocaleDateString() : "-",
                            (i.incident_type as string) || "-",
                            (i.location as string) || "-",
                            i.severity_rating != null ? String(i.severity_rating) : "-",
                            (i.status as string) || "-",
                            (i.driver_name as string) || "-",
                            (i.vehicle_number as string) || "-",
                            (i.reported_by as string) || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Incidents_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Incidents", "ALL INCIDENTS REPORT", headers, rows,
                                (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL INCIDENTS REPORT", headers, rows.map(r => r.map(String)),
                                `Incidents_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Trip Management",
            icon: Truck,
            description: "Trip records, routes, revenue, and cost analysis",
            badge: "Operations",
            reports: [
                {
                    id: "trips-all",
                    label: "All Trips",
                    description: "Complete trip register with route, driver, revenue, and status",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const trips = await fetchTripsWithFleet();
                        const sortedByFleet = [...trips].sort((a, b) => {
                            const fa = a.fleet_number || '';
                            const fb = b.fleet_number || '';
                            if (fa !== fb) return fa.localeCompare(fb);
                            const da = new Date(a.departure_date || a.planned_departure_date || '').getTime() || 0;
                            const db = new Date(b.departure_date || b.planned_departure_date || '').getTime() || 0;
                            return da - db;
                        });
                        const gapMap = new Map<string, number>();
                        const prevArrivalByFleet = new Map<string, Date>();
                        for (const t of sortedByFleet) {
                            const fn = t.fleet_number;
                            const dep = t.departure_date || t.planned_departure_date;
                            const arr = t.arrival_date || t.planned_arrival_date;
                            if (fn && dep) {
                                const prev = prevArrivalByFleet.get(fn);
                                if (prev) {
                                    const gap = Math.max(0, Math.floor((new Date(dep).getTime() - prev.getTime()) / 86400000));
                                    gapMap.set(t.id, gap);
                                }
                            }
                            if (fn && arr) prevArrivalByFleet.set(fn, new Date(arr));
                        }
                        const headers = ["Trip #", "Fleet", "Driver", "Origin", "Destination", "Status", "Start Date", "End Date", "Revenue", "Additional Revenue", "Gap Days", "Actual Cost"];
                        const rows = trips.map((t: Trip) => [
                            t.trip_number || t.id?.slice(0, 8),
                            t.fleet_number || "-",
                            t.driver_name || "-",
                            t.origin || "-",
                            t.destination || "-",
                            t.status || "-",
                            (t.departure_date || t.planned_departure_date) ? new Date((t.departure_date || t.planned_departure_date)!).toLocaleDateString() : "-",
                            (t.arrival_date || t.planned_arrival_date) ? new Date((t.arrival_date || t.planned_arrival_date)!).toLocaleDateString() : "-",
                            Number((Number(t.base_revenue) || 0) + (Number(t.additional_revenue) || 0)).toFixed(2),
                            t.additional_revenue ? Number(t.additional_revenue).toFixed(2) : "0.00",
                            gapMap.has(t.id) ? gapMap.get(t.id)! : "-",
                            t.distance_km != null && t.rate_per_km != null ? Number(Number(t.distance_km) * Number(t.rate_per_km)).toFixed(2) : "-",
                        ]);
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Trips", {
                                title: "ALL TRIPS REPORT",
                                headers, rows,
                                cellStyler: (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            });
                            const totalRevenue = trips.reduce((s, t) => s + (Number(t.base_revenue) || 0) + (Number(t.additional_revenue) || 0), 0);
                            const totalCost = trips.reduce((s, t) => s + (Number(t.final_invoice_amount) || 0), 0);
                            addSummarySheet(wb, "Summary", {
                                title: "TRIPS SUMMARY",
                                rows: [
                                    ["Total Trips", trips.length],
                                    ["Total Revenue", `$${totalRevenue.toLocaleString()}`],
                                    ["Total Cost", `$${totalCost.toLocaleString()}`],
                                    ["Net Profit", `$${(totalRevenue - totalCost).toLocaleString()}`],
                                ],
                            });
                            await saveWorkbook(wb, `Trips_${new Date().toISOString().split("T")[0]}.xlsx`);
                        } else {
                            await exportGenericPdf("ALL TRIPS REPORT", headers, rows.map(r => r.map(String)),
                                `Trips_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
                {
                    id: "trips-fleet-gap-days",
                    label: "Fleet Gap Days",
                    description: "Days between last offloading and next loading per fleet — weekly & monthly",
                    formats: ["excel"],
                    onExport: async () => {
                        const trips = await fetchTripsWithFleet();
                        const dated = trips.filter(
                            (t) => t.fleet_number && (t.departure_date || t.planned_departure_date) && (t.arrival_date || t.planned_arrival_date),
                        );
                        const byFleet = new Map<string, Trip[]>();
                        for (const t of dated) {
                            const fn = t.fleet_number!;
                            if (!byFleet.has(fn)) byFleet.set(fn, []);
                            byFleet.get(fn)!.push(t);
                        }
                        for (const arr of byFleet.values()) {
                            arr.sort((a, b) => {
                                const da = new Date(a.departure_date || a.planned_departure_date!).getTime();
                                const db = new Date(b.departure_date || b.planned_departure_date!).getTime();
                                return da - db;
                            });
                        }
                        type GapRow = { fleet: string; tripNumber: string; prevTripNumber: string; prevArrival: string; nextDeparture: string; gapDays: number };
                        const gapRows: GapRow[] = [];
                        for (const [fleet, fleetTrips] of byFleet.entries()) {
                            for (let i = 1; i < fleetTrips.length; i++) {
                                const prev = fleetTrips[i - 1];
                                const curr = fleetTrips[i];
                                const prevEnd = new Date(prev.arrival_date || prev.planned_arrival_date!);
                                const currStart = new Date(curr.departure_date || curr.planned_departure_date!);
                                const gap = Math.max(0, Math.floor((currStart.getTime() - prevEnd.getTime()) / 86400000));
                                gapRows.push({
                                    fleet,
                                    tripNumber: curr.trip_number || curr.id.slice(0, 8),
                                    prevTripNumber: prev.trip_number || prev.id.slice(0, 8),
                                    prevArrival: prevEnd.toLocaleDateString(),
                                    nextDeparture: currStart.toLocaleDateString(),
                                    gapDays: gap,
                                });
                            }
                        }
                        const weekKey = (d: Date) => {
                            const jan1 = new Date(d.getFullYear(), 0, 1);
                            const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
                            return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
                        };
                        const weeklyMap = new Map<string, { totalGap: number; count: number }>();
                        for (const r of gapRows) {
                            const dep = new Date(r.nextDeparture);
                            const key = `${r.fleet}||${weekKey(dep)}`;
                            const entry = weeklyMap.get(key) || { totalGap: 0, count: 0 };
                            entry.totalGap += r.gapDays;
                            entry.count += 1;
                            weeklyMap.set(key, entry);
                        }
                        const weeklyRows = [...weeklyMap.entries()]
                            .map(([key, v]) => {
                                const [fleet, week] = key.split("||");
                                return [fleet, week, v.count, v.totalGap, v.count > 0 ? (v.totalGap / v.count).toFixed(1) : "0"];
                            })
                            .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
                        const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        const monthlyMap = new Map<string, { totalGap: number; count: number }>();
                        for (const r of gapRows) {
                            const dep = new Date(r.nextDeparture);
                            const key = `${r.fleet}||${monthKey(dep)}`;
                            const entry = monthlyMap.get(key) || { totalGap: 0, count: 0 };
                            entry.totalGap += r.gapDays;
                            entry.count += 1;
                            monthlyMap.set(key, entry);
                        }
                        const monthlyRows = [...monthlyMap.entries()]
                            .map(([key, v]) => {
                                const [fleet, month] = key.split("||");
                                return [fleet, month, v.count, v.totalGap, v.count > 0 ? (v.totalGap / v.count).toFixed(1) : "0"];
                            })
                            .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
                        const wb = createWorkbook();
                        addStyledSheet(wb, "Gap Details", {
                            title: "FLEET GAP DAYS — DETAIL",
                            subtitle: "Days between last offloading (arrival) and next loading (departure) per fleet",
                            headers: ["Fleet", "Prev Trip #", "Prev Arrival", "Next Trip #", "Next Departure", "Gap Days"],
                            rows: gapRows.map((r) => [r.fleet, r.prevTripNumber, r.prevArrival, r.tripNumber, r.nextDeparture, r.gapDays]),
                        });
                        addStyledSheet(wb, "Weekly", {
                            title: "FLEET GAP DAYS — WEEKLY",
                            headers: ["Fleet", "Week", "Gaps", "Total Gap Days", "Avg Gap Days"],
                            rows: weeklyRows,
                        });
                        addStyledSheet(wb, "Monthly", {
                            title: "FLEET GAP DAYS — MONTHLY",
                            headers: ["Fleet", "Month", "Gaps", "Total Gap Days", "Avg Gap Days"],
                            rows: monthlyRows,
                        });
                        const totalGapDays = gapRows.reduce((s, r) => s + r.gapDays, 0);
                        const fleetsWithGaps = new Set(gapRows.filter((r) => r.gapDays > 0).map((r) => r.fleet)).size;
                        addSummarySheet(wb, "Summary", {
                            title: "FLEET GAP DAYS SUMMARY",
                            rows: [
                                ["Fleets Analysed", byFleet.size],
                                ["Total Gaps Measured", gapRows.length],
                                ["Total Gap Days", totalGapDays],
                                ["Average Gap (days)", gapRows.length > 0 ? (totalGapDays / gapRows.length).toFixed(1) : "0"],
                                ["Fleets with Gaps > 0", fleetsWithGaps],
                            ],
                        });
                        await saveWorkbook(wb, `Fleet_Gap_Days_${new Date().toISOString().split("T")[0]}.xlsx`);
                    },
                },
            ],
        },
        {
            title: "Driver Management",
            icon: Users,
            description: "Driver records and performance data",
            badge: "Operations",
            reports: [
                {
                    id: "drivers-all",
                    label: "Driver Register",
                    description: "All drivers with licence, contact, and assignment details",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const drivers = await fetchDrivers();
                        const headers = ["Name", "Driver #", "Licence", "Licence Expiry", "Phone", "Status", "Email"];
                        const rows = drivers.map((d: Driver) => [
                            [d.first_name, d.last_name].filter(Boolean).join(" ") || "-",
                            d.driver_number || "-",
                            d.license_number || "-",
                            d.license_expiry ? new Date(d.license_expiry).toLocaleDateString() : "-",
                            d.phone || "-",
                            d.status || "-",
                            d.email || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Drivers_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Drivers", "DRIVER REGISTER", headers, rows,
                                (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("DRIVER REGISTER", headers, rows.map(r => r.map(String)),
                                `Drivers_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Diesel Management",
            icon: Fuel,
            description: "Fuel consumption, cost tracking, and efficiency",
            badge: "Operations",
            reports: [
                {
                    id: "diesel-all",
                    label: "All Diesel Records",
                    description: "Complete diesel fill-up register with KM/L and cost analysis",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const records = await fetchDieselRecords();
                        const headers = ["Date", "Fleet", "Driver", "Station", "Litres", "Cost/L", "Total Cost", "KM Reading", "KM/L"];
                        const rows = records.map((r: DieselRecord) => [
                            r.date ? new Date(r.date).toLocaleDateString() : "-",
                            r.fleet_number || "-",
                            r.driver_name || "-",
                            r.fuel_station || "-",
                            r.litres_filled != null ? Number(r.litres_filled).toFixed(1) : "0",
                            r.cost_per_litre != null ? Number(r.cost_per_litre).toFixed(2) : "0.00",
                            r.total_cost != null ? Number(r.total_cost).toFixed(2) : "0.00",
                            r.km_reading ?? "-",
                            r.km_per_litre != null ? Number(r.km_per_litre).toFixed(2) : "-",
                        ]);
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Diesel Records", { title: "DIESEL CONSUMPTION REPORT", headers, rows });
                            const totalLitres = records.reduce((s, r) => s + (Number(r.litres_filled) || 0), 0);
                            const totalCost = records.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
                            addSummarySheet(wb, "Summary", {
                                title: "DIESEL SUMMARY",
                                rows: [
                                    ["Total Records", records.length],
                                    ["Total Litres", totalLitres.toLocaleString()],
                                    ["Total Cost", `$${totalCost.toLocaleString()}`],
                                    ["Avg Cost/Litre", totalLitres > 0 ? `$${(totalCost / totalLitres).toFixed(2)}` : "N/A"],
                                ],
                            });
                            await saveWorkbook(wb, `Diesel_Records_${new Date().toISOString().split("T")[0]}.xlsx`);
                        } else {
                            await exportGenericPdf("DIESEL CONSUMPTION REPORT", headers, rows.map(r => r.map(String)),
                                `Diesel_Records_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Action Log",
            icon: ClipboardList,
            description: "Operational action items and follow-ups",
            badge: "Operations",
            reports: [
                {
                    id: "action-log-all",
                    label: "Action Log Export",
                    description: "All action log entries with status, assignee, and due dates",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const entries = await fetchActionLog();
                        const headers = ["Title", "Status", "Priority", "Assigned To", "Due Date", "Created", "Description"];
                        const rows = entries.map((e: ActionItem) => [
                            e.title || "-",
                            e.status || "-",
                            e.priority || "-",
                            e.assigned_to || "-",
                            e.due_date ? new Date(e.due_date).toLocaleDateString() : "-",
                            e.created_at ? new Date(e.created_at).toLocaleDateString() : "-",
                            e.description || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Action_Log_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Action Log", "ACTION LOG REPORT", headers, rows,
                                (row, col) => col === 2 ? statusColours[String(row[1]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ACTION LOG REPORT", headers, rows.map(r => r.map(String)),
                                `Action_Log_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Invoicing",
            icon: Receipt,
            description: "Invoice records, payment tracking, and revenue",
            badge: "Operations",
            reports: [
                {
                    id: "invoices-all",
                    label: "All Invoices",
                    description: "Complete invoice register with amounts, status, and trip details",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const invoices = await fetchInvoices();
                        const headers = ["Invoice #", "Trip #", "Driver", "Route", "Date", "Amount", "Status", "Paid At", "Reference"];
                        const rows = invoices.map((inv: Record<string, unknown>) => {
                            const trip = inv.trips as Record<string, unknown> | null;
                            return [
                                (inv.invoice_number as string) || (inv.id as string)?.slice(0, 8),
                                (trip?.trip_number as string) || "-",
                                (trip?.driver_name as string) || "-",
                                trip ? `${(trip.origin as string) || "?"} → ${(trip.destination as string) || "?"}` : "-",
                                inv.invoice_date ? new Date(inv.invoice_date as string).toLocaleDateString() : "-",
                                inv.amount != null ? Number(inv.amount).toFixed(2) : "0.00",
                                (inv.status as string) || "-",
                                inv.paid_at ? new Date(inv.paid_at as string).toLocaleDateString() : "-",
                                (inv.payment_reference as string) || "-",
                            ];
                        });
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Invoices", {
                                title: "ALL INVOICES REPORT",
                                headers, rows,
                                cellStyler: (row, col) => col === 7 ? statusColours[String(row[6]).toLowerCase()] : undefined,
                            });
                            const totalAmount = invoices.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.amount) || 0), 0);
                            const paidCount = invoices.filter((i: Record<string, unknown>) => i.paid_at).length;
                            addSummarySheet(wb, "Summary", {
                                title: "INVOICING SUMMARY",
                                rows: [
                                    ["Total Invoices", invoices.length],
                                    ["Total Amount", `R${totalAmount.toLocaleString()}`],
                                    ["Paid", paidCount],
                                    ["Outstanding", invoices.length - paidCount],
                                ],
                            });
                            await saveWorkbook(wb, `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`);
                        } else {
                            await exportGenericPdf("ALL INVOICES REPORT", headers, rows.map(r => r.map(String)),
                                `Invoices_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Fuel Bunkers",
            icon: Fuel,
            description: "Fuel bunker levels, capacity, and stock status",
            badge: "Operations",
            reports: [
                {
                    id: "fuel-bunkers-all",
                    label: "Fuel Bunker Status",
                    description: "All fuel bunkers with capacity, current level, and cost",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const bunkers = await fetchFuelBunkers();
                        const headers = ["Name", "Fuel Type", "Capacity (L)", "Current Level (L)", "% Full", "Min Alert (L)", "Unit Cost", "Active"];
                        const rows = bunkers.map((b: Record<string, unknown>) => [
                            (b.name as string) || "-",
                            (b.fuel_type as string) || "-",
                            b.capacity_liters != null ? Number(b.capacity_liters).toLocaleString() : "-",
                            b.current_level_liters != null ? Number(b.current_level_liters).toLocaleString() : "-",
                            b.capacity_liters && b.current_level_liters != null ? `${((Number(b.current_level_liters) / Number(b.capacity_liters)) * 100).toFixed(1)}%` : "-",
                            b.min_level_alert != null ? Number(b.min_level_alert).toLocaleString() : "-",
                            b.unit_cost != null ? Number(b.unit_cost).toFixed(2) : "-",
                            b.is_active ? "Yes" : "No",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Fuel_Bunkers_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Fuel Bunkers", "FUEL BUNKER STATUS REPORT", headers, rows,
                            );
                        } else {
                            await exportGenericPdf("FUEL BUNKER STATUS REPORT", headers, rows.map(r => r.map(String)),
                                `Fuel_Bunkers_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
    ];

    // ── Filtering ──────────────────────────────────────────────────────────────
    const filteredSections = sections
        .map((section) => ({
            ...section,
            reports: section.reports.filter(
                (r) =>
                    r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    section.title.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
        }))
        .filter((s) => s.reports.length > 0);

    const workshopSections = filteredSections.filter((s) => s.badge === "Workshop");
    const operationsSections = filteredSections.filter((s) => s.badge === "Operations");

    const totalReports = sections.reduce((s, sec) => s + sec.reports.length, 0);

    const workshopExpandedCount = workshopSections.filter(s => expandedSections.has(s.title)).length;
    const operationsExpandedCount = operationsSections.filter(s => expandedSections.has(s.title)).length;

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Reports Centre</h1>
                        <p className="text-muted-foreground">
                            Export any report across Workshop Management and Operations — {totalReports} reports available
                        </p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Workshop Management */}
                {workshopSections.length > 0 && (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wrench className="h-5 w-5 text-muted-foreground" />
                                <h2 className="text-lg font-semibold">Workshop Management</h2>
                                <Badge variant="secondary" className="ml-1">{workshopSections.reduce((s, sec) => s + sec.reports.length, 0)}</Badge>
                            </div>
                            <div className="flex gap-1">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 text-xs"
                                    onClick={() => toggleAllWorkshop(workshopExpandedCount < workshopSections.length)}
                                >
                                    {workshopExpandedCount < workshopSections.length ? "Expand All" : "Collapse All"}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {workshopSections.map((section) => {
                                const Icon = section.icon;
                                const isExpanded = expandedSections.has(section.title);
                                return (
                                    <div key={section.title} className="space-y-1">
                                        <button
                                            onClick={() => toggleSection(section.title)}
                                            className="flex items-center gap-2 px-1 pt-2 w-full text-left hover:bg-muted/30 rounded transition-colors"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="text-sm font-semibold">{section.title}</span>
                                            <span className="text-xs text-muted-foreground">— {section.description}</span>
                                            <Badge variant="outline" className="ml-auto text-[10px] h-5">
                                                {section.reports.length}
                                            </Badge>
                                        </button>
                                        {isExpanded && (
                                            <div className="ml-7 space-y-1">
                                                {section.reports.map((report) => (
                                                    <ReportRow
                                                        key={report.id}
                                                        report={report}
                                                        loadingKey={loadingKey}
                                                        onExport={(fmt) => runExport(report.id, fmt, () => report.onExport(fmt))}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {workshopSections.length > 0 && operationsSections.length > 0 && <Separator />}

                {/* Operations */}
                {operationsSections.length > 0 && (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="h-5 w-5 text-muted-foreground" />
                                <h2 className="text-lg font-semibold">Operations</h2>
                                <Badge variant="secondary" className="ml-1">{operationsSections.reduce((s, sec) => s + sec.reports.length, 0)}</Badge>
                            </div>
                            <div className="flex gap-1">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 text-xs"
                                    onClick={() => toggleAllOperations(operationsExpandedCount < operationsSections.length)}
                                >
                                    {operationsExpandedCount < operationsSections.length ? "Expand All" : "Collapse All"}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {operationsSections.map((section) => {
                                const Icon = section.icon;
                                const isExpanded = expandedSections.has(section.title);
                                return (
                                    <div key={section.title} className="space-y-1">
                                        <button
                                            onClick={() => toggleSection(section.title)}
                                            className="flex items-center gap-2 px-1 pt-2 w-full text-left hover:bg-muted/30 rounded transition-colors"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="text-sm font-semibold">{section.title}</span>
                                            <span className="text-xs text-muted-foreground">— {section.description}</span>
                                            <Badge variant="outline" className="ml-auto text-[10px] h-5">
                                                {section.reports.length}
                                            </Badge>
                                        </button>
                                        {isExpanded && (
                                            <div className="ml-7 space-y-1">
                                                {section.reports.map((report) => (
                                                    <ReportRow
                                                        key={report.id}
                                                        report={report}
                                                        loadingKey={loadingKey}
                                                        onExport={(fmt) => runExport(report.id, fmt, () => report.onExport(fmt))}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {filteredSections.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-3 opacity-40" />
                        <p className="text-lg font-medium">No reports found</p>
                        <p className="text-sm">Try a different search term</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};

// ── Report Row ───────────────────────────────────────────────────────────────

const ReportRow = ({
    report,
    loadingKey,
    onExport,
}: {
    report: ReportItem;
    loadingKey: string | null;
    onExport: (fmt: "excel" | "pdf") => void;
}) => {
    const excelLoading = loadingKey === `${report.id}:excel`;
    const pdfLoading = loadingKey === `${report.id}:pdf`;
    const anyLoading = excelLoading || pdfLoading;
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/40 transition-colors">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{report.label}</p>
                <p className="text-xs text-muted-foreground truncate">{report.description}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
                {report.formats.includes("excel") && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        disabled={anyLoading}
                        onClick={() => onExport("excel")}
                    >
                        {excelLoading ? (
                            <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                        )}
                        Excel
                    </Button>
                )}
                {report.formats.includes("pdf") && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        disabled={anyLoading}
                        onClick={() => onExport("pdf")}
                    >
                        {pdfLoading ? (
                            <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                            <FileText className="h-3.5 w-3.5 text-red-600" />
                        )}
                        PDF
                    </Button>
                )}
            </div>
        </div>
    );
};

export default Reports;