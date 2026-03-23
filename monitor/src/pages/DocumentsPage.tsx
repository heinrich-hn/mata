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
  MessageCircle,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";

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
      const { data, error } = await supabase
        .from("driver_documents")
        .select("id, document_type, document_number, expiry_date, drivers!inner(id, first_name, last_name, driver_number, status)")
        .not("expiry_date", "is", null);

      if (error) throw error;

      const today = new Date();
      const rows: DocRow[] = [];

      for (const doc of data || []) {
        const driver = doc.drivers as unknown as {
          id: string;
          first_name: string;
          last_name: string;
          driver_number: string;
          status: string;
        };
        if (driver.status !== "active") continue;

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
          id, registration_number, fleet_number, make, model,
          work_documents ( id, document_type, document_number, title, metadata )
        `);

      if (error) throw error;

      const today = new Date();
      const rows: DocRow[] = [];

      for (const vehicle of data || []) {
        const docs = (vehicle as { work_documents: { id: string; document_type: string | null; document_number: string; title: string; metadata: { expiry_date?: string } | null }[] }).work_documents || [];
        for (const doc of docs) {
          const expDateStr = doc.metadata?.expiry_date;
          if (!expDateStr) continue;

          const daysUntil = calcDays(expDateStr);
          const expiry = new Date(expDateStr);
          const isOverdue = expiry < today;

          if (!isOverdue && daysUntil > 30) continue;

          rows.push({
            id: doc.id,
            entityType: "vehicle",
            entityName: (vehicle as { registration_number: string }).registration_number || (vehicle as { fleet_number: string | null }).fleet_number || "Unknown",
            entityDetail: `${(vehicle as { make: string }).make || ""} ${(vehicle as { model: string }).model || ""}`.trim(),
            documentType: doc.document_type || "Document",
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
      overdue: currentFiltered.filter((r) => r.isOverdue).length,
      expiringSoon: currentFiltered.filter((r) => !r.isOverdue).length,
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
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading document alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Document Expiry Alerts
          </h1>
          <p className="text-sm text-slate-500 font-normal">
            Monitor expiring and expired documents
          </p>
        </div>
      </div>

      {/* Stats Cards - Neutral colors */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <p className="text-[10px] text-slate-400">{stats.vehicle} vehicle · {stats.driver} driver</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-slate-700">{stats.overdue}</div>
            <p className="text-[10px] text-slate-400">Requires action</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-slate-700">{stats.expiringSoon}</div>
            <p className="text-[10px] text-slate-400">Within 30 days</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-slate-900">{stats.vehicle}</div>
            <p className="text-[10px] text-slate-400">With alerts</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Drivers
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-slate-900">{stats.driver}</div>
            <p className="text-[10px] text-slate-400">With alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => openWhatsApp(buildDocumentsWhatsAppMessage(toExportAlerts(filtered), entityFilter))}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp Report
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => generateDocumentsPDF(toExportAlerts(filtered), entityFilter)}
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => generateDocumentsExcel(toExportAlerts(filtered), entityFilter)}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-1.5 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={entityFilter} onValueChange={(v) => setEntityFilter(v as EntityType)} className="w-full">
        <TabsList className="w-full sm:w-auto bg-slate-100 border border-slate-200">
          <TabsTrigger value="vehicle" className="gap-1.5 flex-1 sm:flex-none text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900">
            <Truck className="h-3.5 w-3.5" />
            Vehicles ({stats.vehicle})
          </TabsTrigger>
          <TabsTrigger value="driver" className="gap-1.5 flex-1 sm:flex-none text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900">
            <User className="h-3.5 w-3.5" />
            Drivers ({stats.driver})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <FileText className="h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-sm font-medium text-slate-700 mb-1">No document alerts</h3>
              <p className="text-xs text-slate-500">
                All {entityFilter} documents are up to date.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
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
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                {/* Document info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-slate-900">{row.entityName}</span>
                    {row.entityDetail && (
                      <span className="text-xs text-slate-500">{row.entityDetail}</span>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600">
                      {formatDocumentType(row.documentType)}
                    </Badge>
                  </div>
                  {row.documentNumber && (
                    <span className="text-[11px] text-slate-400 font-mono">{row.documentNumber}</span>
                  )}
                </div>

                {/* Expiry info */}
                <div className="shrink-0 text-right">
                  <div className="text-xs font-medium text-slate-700 flex items-center gap-1 justify-end">
                    <CalendarDays className="h-3 w-3 text-slate-400" />
                    {format(new Date(row.expiryDate), "dd MMM yyyy")}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {row.isOverdue
                      ? `${Math.abs(row.daysUntilExpiry)}d overdue`
                      : `${row.daysUntilExpiry}d remaining`}
                  </span>
                </div>

                {/* Status badge - neutral */}
                <div className="shrink-0">
                  <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200">
                    {row.isOverdue ? "OVERDUE" : "EXPIRING"}
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