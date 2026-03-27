import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import {
    Calendar,
    ClipboardList,
    Download,
    FileSpreadsheet,
    FileText,
    Fuel,
    Gauge,
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

    const fetchTyres = async () => {
        const { data, error } = await supabase.from("tyres").select("*");
        if (error) throw error;
        return data || [];
    };

    const fetchMaintenanceSchedules = async () => {
        const { data, error } = await supabase
            .from("maintenance_schedules")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("next_due_date") as { data: any[] | null; error: any };
        if (error) throw error;
        return data || [];
    };

    const fetchMaintenanceHistory = async () => {
        const { data, error } = await supabase
            .from("maintenance_schedule_history")
            .select("*, maintenance_schedules(service_type, vehicle_id)")
            .order("completed_date", { ascending: false }) as { data: any[] | null; error: any };
        if (error) throw error;
        return data || [];
    };

    const fetchOverdueSchedules = async () => {
        const today = new Date().toISOString().split("T")[0];
        const { data, error } = await (supabase
            .from("maintenance_schedules")
            .select("*, vehicles(fleet_number, registration_number, make, model)") as any)
            .lt("next_due_date", today)
            .neq("status", "completed")
            .order("next_due_date");
        if (error) throw error;
        return (data || []) as any[];
    };

    const fetchFaults = async () => {
        const { data, error } = await supabase
            .from("vehicle_faults")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("reported_date", { ascending: false }) as { data: any[] | null; error: any };
        if (error) throw error;
        return data || [];
    };

    const fetchInspections = async () => {
        const { data, error } = await supabase
            .from("inspections")
            .select("*")
            .order("inspection_date", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const fetchJobCards = async () => {
        const { data, error } = await supabase
            .from("job_cards")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        const cards = data || [];
        const vehicleIds = [...new Set(cards.map((c: any) => c.vehicle_id).filter(Boolean))];
        if (vehicleIds.length === 0) return cards;
        const { data: vehicles } = await supabase
            .from("vehicles")
            .select("id, fleet_number, registration_number, make, model")
            .in("id", vehicleIds);
        const vehicleMap = new Map((vehicles || []).map((v: any) => [v.id, v]));
        return cards.map((c: any) => ({ ...c, vehicles: vehicleMap.get(c.vehicle_id) || null }));
    };

    const fetchTrips = async () => {
        const { data, error } = await supabase
            .from("trips")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const fetchDrivers = async () => {
        const { data, error } = await supabase
            .from("drivers")
            .select("*")
            .order("first_name");
        if (error) throw error;
        return data || [];
    };

    const fetchDieselRecords = async () => {
        const { data, error } = await supabase
            .from("diesel_records")
            .select("*")
            .order("date", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const fetchProcurementRequests = async () => {
        const { data, error } = await supabase
            .from("parts_requests")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const fetchActionLog = async () => {
        const { data, error } = await supabase
            .from("action_items")
            .select("*")
            .order("created_at", { ascending: false }) as { data: any[] | null; error: any };
        if (error) throw error;
        return data || [];
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
                        const rows = cards.map((c: any) => [
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
                        const mapped = inspections.map((ins: any) => ({
                            inspection_number: ins.inspection_number || ins.id?.slice(0, 8),
                            inspection_date: ins.inspection_date,
                            vehicle_registration: ins.vehicle_registration,
                            vehicle_make: ins.vehicle_make || "",
                            vehicle_model: ins.vehicle_model || "",
                            inspector_name: ins.inspector_name || "-",
                            fault_count: ins.fault_count || 0,
                            corrective_action_status: ins.corrective_action_status || "-",
                            linked_work_order: ins.linked_work_order || "-",
                            inspection_type: ins.inspection_type || "-",
                            notes: ins.notes || "",
                            status: ins.status || "-",
                            template_name: ins.template_name || "-",
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
                        await generateAllFaultsPDF(faults as any);
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
                        if (fmt === "excel") await exportAllTyresToExcel(tyres as any);
                        else await exportAllTyresToPDF(tyres as any);
                    },
                },
                {
                    id: "tyres-brand-summary",
                    label: "Brand Performance Summary",
                    description: "Cost/KM and cost/MM analysis by tyre brand",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const tyres = await fetchTyres();
                        const brandMap = new Map<string, any>();
                        (tyres as any[]).forEach((t) => {
                            const brand = t.brand || "Unknown";
                            const e = brandMap.get(brand) || { brand, bayCount: 0, installedCount: 0, totalQty: 0, totalCost: 0, totalKm: 0, totalMmWorn: 0, avgCostPerTyre: 0, avgCostPerKm: null, avgCostPerMm: null };
                            e.totalQty += 1;
                            if (t.current_fleet_position) e.installedCount += 1; else e.bayCount += 1;
                            e.totalCost += t.purchase_cost_zar || 0;
                            e.totalKm += t.km_travelled || 0;
                            if (t.initial_tread_depth && t.current_tread_depth) e.totalMmWorn += Math.max(0, t.initial_tread_depth - t.current_tread_depth);
                            brandMap.set(brand, e);
                        });
                        const brandData = Array.from(brandMap.values()).map((d: any) => ({
                            ...d,
                            avgCostPerTyre: d.totalQty > 0 ? d.totalCost / d.totalQty : 0,
                            avgCostPerKm: d.totalKm > 0 ? d.totalCost / d.totalKm : null,
                            avgCostPerMm: d.totalMmWorn > 0 ? d.totalCost / d.totalMmWorn : null,
                        }));
                        const gt = brandData.reduce((a: any, b: any) => ({
                            bayCount: a.bayCount + b.bayCount,
                            installedCount: a.installedCount + b.installedCount,
                            totalQty: a.totalQty + b.totalQty,
                            totalCost: a.totalCost + b.totalCost,
                            totalKm: a.totalKm + b.totalKm,
                            totalMmWorn: a.totalMmWorn + b.totalMmWorn,
                        }), { bayCount: 0, installedCount: 0, totalQty: 0, totalCost: 0, totalKm: 0, totalMmWorn: 0 });
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
                        if (fmt === "excel") await exportSchedulesToExcel(schedules as any);
                        else exportSchedulesToPDF(schedules as any);
                    },
                },
                {
                    id: "maintenance-history",
                    label: "Maintenance History",
                    description: "Completed maintenance records with costs and duration",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const history = await fetchMaintenanceHistory();
                        if (fmt === "excel") await exportHistoryToExcel(history as any);
                        else exportHistoryToPDF(history as any);
                    },
                },
                {
                    id: "maintenance-overdue",
                    label: "Overdue Alerts",
                    description: "Maintenance tasks past their due date",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const overdue = await fetchOverdueSchedules();
                        if (fmt === "excel") await exportOverdueToExcel(overdue as any);
                        else exportOverdueToPDF(overdue as any);
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
                        const rows = (requests as any[]).map((r) => [
                            r.request_number || r.id?.slice(0, 8),
                            r.part_name || "-",
                            "-",
                            r.status || "-",
                            r.priority || "-",
                            r.quantity ?? 0,
                            r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : "0.00",
                            r.total_cost != null ? Number(r.total_cost).toFixed(2) : "0.00",
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

        // ── OPERATIONS ───────────────────────────────────────────────────────────
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
                        const trips = await fetchTrips();
                        const headers = ["Trip #", "Fleet", "Driver", "Origin", "Destination", "Status", "Start Date", "End Date", "Base Revenue", "Actual Cost"];
                        const rows = (trips as any[]).map((t) => [
                            t.trip_number || t.id?.slice(0, 8),
                            t.fleet_number || "-",
                            t.driver_name || "-",
                            t.origin || "-",
                            t.destination || "-",
                            t.status || "-",
                            t.start_date ? new Date(t.start_date).toLocaleDateString() : "-",
                            t.end_date ? new Date(t.end_date).toLocaleDateString() : "-",
                            t.base_revenue != null ? Number(t.base_revenue).toFixed(2) : "0.00",
                            t.actual_cost != null ? Number(t.actual_cost).toFixed(2) : "0.00",
                        ]);
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Trips", {
                                title: "ALL TRIPS REPORT",
                                headers, rows,
                                cellStyler: (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            });
                            const totalRevenue = (trips as any[]).reduce((s, t) => s + (Number(t.base_revenue) || 0), 0);
                            const totalCost = (trips as any[]).reduce((s, t) => s + (Number(t.actual_cost) || 0), 0);
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
                        const rows = (drivers as any[]).map((d) => [
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
                        const rows = (records as any[]).map((r) => [
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
                            const totalLitres = (records as any[]).reduce((s, r) => s + (Number(r.litres_filled) || 0), 0);
                            const totalCost = (records as any[]).reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
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
                        const rows = (entries as any[]).map((e) => [
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
                        <div className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">Workshop Management</h2>
                            <Badge variant="secondary" className="ml-1">{workshopSections.reduce((s, sec) => s + sec.reports.length, 0)}</Badge>
                        </div>
                        <div className="space-y-2">
                            {workshopSections.map((section) => {
                                const Icon = section.icon;
                                return (
                                    <div key={section.title} className="space-y-1">
                                        <div className="flex items-center gap-2 px-1 pt-2">
                                            <Icon className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-semibold">{section.title}</span>
                                            <span className="text-xs text-muted-foreground">— {section.description}</span>
                                        </div>
                                        {section.reports.map((report) => (
                                            <ReportRow
                                                key={report.id}
                                                report={report}
                                                loadingKey={loadingKey}
                                                onExport={(fmt) => runExport(report.id, fmt, () => report.onExport(fmt))}
                                            />
                                        ))}
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
                        <div className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">Operations</h2>
                            <Badge variant="secondary" className="ml-1">{operationsSections.reduce((s, sec) => s + sec.reports.length, 0)}</Badge>
                        </div>
                        <div className="space-y-2">
                            {operationsSections.map((section) => {
                                const Icon = section.icon;
                                return (
                                    <div key={section.title} className="space-y-1">
                                        <div className="flex items-center gap-2 px-1 pt-2">
                                            <Icon className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-semibold">{section.title}</span>
                                            <span className="text-xs text-muted-foreground">— {section.description}</span>
                                        </div>
                                        {section.reports.map((report) => (
                                            <ReportRow
                                                key={report.id}
                                                report={report}
                                                loadingKey={loadingKey}
                                                onExport={(fmt) => runExport(report.id, fmt, () => report.onExport(fmt))}
                                            />
                                        ))}
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
