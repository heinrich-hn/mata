import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDocumentsWhatsAppMessage,
  buildSingleDocWhatsApp,
  type DocumentAlert,
  generateDocumentsExcel,
  generateDocumentsPDF,
  generateSingleDocPDF,
  openWhatsApp,
} from "@/lib/documentExport";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  MessageCircle,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { exportDocumentAlerts } from "@/lib/monitorExport";

type EntityType = "vehicle" | "driver";

interface DocRow {
  id: string;
  entityType: EntityType;
  entityName: string;
  entityDetail: string;
  documentType: string;
  documentNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  isOverdue: boolean;
  isMissing?: boolean;
}

function calcDays(expiryDate: string) {
  const expiry = new Date(expiryDate);
  const today = new Date();
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDocumentType(type: string | null | undefined) {
  if (!type) return "Document";
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function DocumentsPage() {
  const [entityFilter, setEntityFilter] = useState<EntityType>("vehicle");

  // ── Single query for ALL driver documents (fixes N+1) ──
  const { data: driverRows = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ["driver-documents-expiry"],
    queryFn: async () => {
      // Fetch active drivers with their active_document_types
      const { data: drivers, error: drvErr } = await supabase
        .from("drivers")
        .select("id, first_name, last_name, driver_number, status, active_document_types")
        .eq("status", "active");
      if (drvErr) throw drvErr;
      if (!drivers?.length) return [];

      const driverIds = drivers.map(d => d.id);

      // Fetch ALL driver documents (not just those with expiry)
      const { data, error } = await supabase
        .from("driver_documents")
        .select("id, driver_id, document_type, document_number, expiry_date")
        .in("driver_id", driverIds);
      if (error) throw error;

      // Build per-driver map of uploaded types
      const driverDocsMap: Record<string, Set<string>> = {};
      for (const doc of data || []) {
        if (!driverDocsMap[doc.driver_id]) driverDocsMap[doc.driver_id] = new Set();
        driverDocsMap[doc.driver_id].add(doc.document_type);
      }

      const today = new Date();
      const rows: DocRow[] = [];

      // 1. Missing documents — active types with no uploaded doc
      for (const driver of drivers) {
        const activeTypes = (driver as { active_document_types?: string[] | null }).active_document_types || [];
        const uploaded = driverDocsMap[driver.id] || new Set();
        const driverName = `${driver.first_name} ${driver.last_name}`.trim();

        for (const docType of activeTypes) {
          if (uploaded.has(docType)) continue;
          rows.push({
            id: `driver-missing-${driver.id}-${docType}`,
            entityType: "driver",
            entityName: driverName,
            entityDetail: driver.driver_number || "",
            documentType: docType,
            documentNumber: "",
            expiryDate: "",
            daysUntilExpiry: -9999,
            isOverdue: true,
            isMissing: true,
          });
        }
      }

      // 2. Expired / expiring documents
      for (const doc of data || []) {
        if (!doc.expiry_date) continue;
        const driver = drivers.find(d => d.id === doc.driver_id);
        if (!driver) continue;

        const activeTypes = (driver as { active_document_types?: string[] | null }).active_document_types || [];
        if (activeTypes.length > 0 && !activeTypes.includes(doc.document_type)) continue;

        const daysUntil = calcDays(doc.expiry_date);
        const expiry = new Date(doc.expiry_date);
        const isOverdue = expiry < today;

        if (!isOverdue && daysUntil > 30) continue;

        rows.push({
          id: `driver-${doc.id}`,
          entityType: "driver",
          entityName: `${driver.first_name} ${driver.last_name}`.trim(),
          entityDetail: driver.driver_number || "",
          documentType: doc.document_type || "Document",
          documentNumber: doc.document_number || "",
          expiryDate: doc.expiry_date,
          daysUntilExpiry: daysUntil,
          isOverdue,
        });
      }

      return rows;
    },
    refetchInterval: 30000,
  });

  // ── Vehicle documents ──
  const { data: vehicleRows = [], isLoading: isLoadingVehicles, refetch, isRefetching } = useQuery({
    queryKey: ["vehicle-documents-expiry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id, registration_number, fleet_number, make, model, active_document_types,
          work_documents ( id, document_type, document_category, document_number, title, metadata )
        `)
        .eq("active", true);

      if (error) throw error;

      const today = new Date();
      const rows: DocRow[] = [];

      for (const vehicle of data || []) {
        const activeTypes = (vehicle as { active_document_types: string[] | null }).active_document_types || [];
        const docs = (vehicle as { work_documents: { id: string; document_type: string | null; document_category: string | null; document_number: string; title: string; metadata: { expiry_date?: string } | null }[] }).work_documents || [];
        const vehicleName = (vehicle as { registration_number: string }).registration_number || (vehicle as { fleet_number: string | null }).fleet_number || "Unknown";
        const vehicleDetail = `${(vehicle as { make: string }).make || ""} ${(vehicle as { model: string }).model || ""}`.trim();

        // Build set of uploaded categories for missing detection
        const uploadedCategories = new Set<string>();
        for (const doc of docs) {
          const cat = doc.document_category || doc.document_type;
          if (cat) uploadedCategories.add(cat);
        }

        // 1. Missing documents — active categories with no uploaded doc
        for (const cat of activeTypes) {
          if (uploadedCategories.has(cat)) continue;
          rows.push({
            id: `vehicle-missing-${(vehicle as { id: string }).id}-${cat}`,
            entityType: "vehicle",
            entityName: vehicleName,
            entityDetail: vehicleDetail,
            documentType: formatDocumentType(cat),
            documentNumber: "",
            expiryDate: "",
            daysUntilExpiry: -9999,
            isOverdue: true,
            isMissing: true,
          });
        }

        // 2. Expired / expiring documents
        for (const doc of docs) {
          const expDateStr = doc.metadata?.expiry_date;
          if (!expDateStr) continue;

          const category = doc.document_category || doc.document_type;
          if (category && activeTypes.length > 0 && !activeTypes.includes(category)) continue;

          const daysUntil = calcDays(expDateStr);
          const expiry = new Date(expDateStr);
          const isOverdue = expiry < today;

          if (!isOverdue && daysUntil > 30) continue;

          rows.push({
            id: doc.id,
            entityType: "vehicle",
            entityName: vehicleName,
            entityDetail: vehicleDetail,
            documentType: formatDocumentType(category),
            documentNumber: doc.document_number || "",
            expiryDate: expDateStr,
            daysUntilExpiry: daysUntil,
            isOverdue,
          });
        }
      }

      return rows;
    },
    refetchInterval: 30000,
  });

  // ── Combined + filtered ──
  const allRows = useMemo(() => {
    const combined = [...vehicleRows, ...driverRows];
    // Sort by expiry date (closest first)
    return combined.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [vehicleRows, driverRows]);

  const filtered = useMemo(() => allRows.filter((r) => r.entityType === entityFilter), [allRows, entityFilter]);

  // ── Stats (across ALL, not just filtered tab) ──
  const stats = useMemo(() => {
    const vehicleAlerts = allRows.filter((r) => r.entityType === "vehicle");
    const driverAlerts = allRows.filter((r) => r.entityType === "driver");
    const currentFiltered = filtered;
    return {
      total: currentFiltered.length,
      overdue: currentFiltered.filter((r) => r.isOverdue && !r.isMissing).length,
      expiringSoon: currentFiltered.filter((r) => !r.isOverdue && !r.isMissing).length,
      missing: currentFiltered.filter((r) => r.isMissing).length,
      vehicle: vehicleAlerts.length,
      driver: driverAlerts.length,
    };
  }, [allRows, filtered]);

  // ── Export helpers ──
  const toExportAlerts = (rows: DocRow[]): DocumentAlert[] =>
    rows.map((r) => ({
      entityType: r.entityType,
      entityName: r.entityName,
      entityDetail: r.entityDetail,
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      expiryDate: r.expiryDate,
      daysUntilExpiry: r.daysUntilExpiry,
      isOverdue: r.isOverdue,
    }));

  const isLoading = isLoadingDrivers || isLoadingVehicles;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading document alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monitor-page">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2 px-3">
            <div className="text-xl font-semibold text-foreground tabular-nums">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{stats.vehicle} vehicle · {stats.driver} driver</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2 px-3">
            <div className="text-xl font-semibold text-danger tabular-nums">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Requires action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2 px-3">
            <div className="text-xl font-semibold text-warning tabular-nums">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Missing
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2 px-3">
            <div className="text-xl font-semibold text-foreground tabular-nums">{stats.missing}</div>
            <p className="text-xs text-muted-foreground">Not uploaded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2 px-3">
            <div className="text-xl font-semibold text-foreground tabular-nums">{stats.vehicle}</div>
            <p className="text-xs text-muted-foreground">With alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Drivers
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2 px-3">
            <div className="text-xl font-semibold text-foreground tabular-nums">{stats.driver}</div>
            <p className="text-xs text-muted-foreground">With alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => openWhatsApp(buildDocumentsWhatsAppMessage(toExportAlerts(filtered), entityFilter))}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp Report
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => generateDocumentsPDF(toExportAlerts(filtered), entityFilter)}
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => generateDocumentsExcel(toExportAlerts(filtered), entityFilter)}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => exportDocumentAlerts(toExportAlerts(filtered), entityFilter, 'outlook')}
        >
          <Mail className="h-3.5 w-3.5" />
          Outlook
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={entityFilter} onValueChange={(v) => setEntityFilter(v as EntityType)} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="vehicle" className="gap-1.5 flex-1 sm:flex-none text-xs">
            <Truck className="h-3.5 w-3.5" />
            Vehicles ({stats.vehicle})
          </TabsTrigger>
          <TabsTrigger value="driver" className="gap-1.5 flex-1 sm:flex-none text-xs">
            <User className="h-3.5 w-3.5" />
            Drivers ({stats.driver})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <Card className="monitor-soft-panel">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-medium text-foreground mb-1">No document alerts</h3>
              <p className="text-xs text-muted-foreground">
                All {entityFilter} documents are up to date.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="monitor-soft-panel rounded divide-y divide-border overflow-hidden">
          {filtered.map((row) => {
            const exportAlert: DocumentAlert = {
              entityType: row.entityType,
              entityName: row.entityName,
              entityDetail: row.entityDetail,
              documentType: row.documentType,
              documentNumber: row.documentNumber,
              expiryDate: row.expiryDate,
              daysUntilExpiry: row.daysUntilExpiry,
              isOverdue: row.isOverdue,
            };

            return (
              <div
                key={row.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                {/* Document info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-foreground">{row.entityName}</span>
                    {row.entityDetail && (
                      <span className="text-xs text-muted-foreground">{row.entityDetail}</span>
                    )}
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-info/20 text-info bg-info-soft">
                      {formatDocumentType(row.documentType)}
                    </Badge>
                  </div>
                  {row.documentNumber && (
                    <span className="text-xs text-muted-foreground font-mono">{row.documentNumber}</span>
                  )}
                </div>

                {/* Expiry info */}
                <div className="shrink-0 text-right">
                  {row.isMissing ? (
                    <span className="text-xs font-medium text-muted-foreground">Not uploaded</span>
                  ) : (
                    <>
                      <div className="text-xs font-medium text-foreground flex items-center gap-1 justify-end">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(row.expiryDate), "dd MMM yyyy")}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {row.isOverdue
                          ? `${Math.abs(row.daysUntilExpiry)}d overdue`
                          : `${row.daysUntilExpiry}d remaining`}
                      </span>
                    </>
                  )}
                </div>

                {/* Status badge */}
                <div className="shrink-0">
                  <Badge className={`text-xs px-1.5 py-0.5 ${row.isMissing
                    ? 'border-border bg-muted text-muted-foreground'
                    : row.isOverdue
                      ? 'border-danger/20 bg-danger-soft text-danger'
                      : 'border-warning/20 bg-warning-soft text-warning'
                    }`}>
                    {row.isMissing ? "MISSING" : row.isOverdue ? "OVERDUE" : "EXPIRING"}
                  </Badge>
                </div>

                {/* Per-row export buttons */}
                <div className="shrink-0 flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                    onClick={() => openWhatsApp(buildSingleDocWhatsApp(exportAlert))}
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                    onClick={() => generateSingleDocPDF(exportAlert)}
                    title="Export PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}