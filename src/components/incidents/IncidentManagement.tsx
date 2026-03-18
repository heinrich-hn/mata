import AddIncidentDialog from "@/components/dialogs/AddIncidentDialog";
import CreateCARFromIncidentDialog from "@/components/dialogs/CreateCARFromIncidentDialog";
import DeleteIncidentDialog from "@/components/dialogs/DeleteIncidentDialog";
import EditIncidentDialog from "@/components/dialogs/EditIncidentDialog";
import IncidentChecklistDialog from "@/components/dialogs/IncidentChecklistDialog";
import IncidentClosureDialog from "@/components/dialogs/IncidentClosureDialog";
import IncidentDetailsDialog from "@/components/dialogs/IncidentDetailsDialog";
import CarReportsGrid from "@/components/driver/CarReportsGrid";
import AccidentResponseGuide from "@/components/incidents/AccidentResponseGuide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useIncidents, type Incident } from "@/hooks/useIncidents";
import { useRealtimeIncidents } from "@/hooks/useRealtimeIncidents";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import generateIncidentPDF from "@/utils/generateIncidentPDF";
import {
    AlertTriangle,
    ArrowUpDown,
    CheckCircle,
    ClipboardCheck,
    Clock,
    Download,
    Edit,
    Eye,
    FileSpreadsheet,
    FileText,
    MoreHorizontal,
    Plus,
    Search,
    Share2,
    Shield,
    Trash2,
    XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// ──────────────────────────────────────────────────────────────
// Reusable Hook: PDF Download with Loading State
// ──────────────────────────────────────────────────────────────
const useDownloadIncidentPdf = () => {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const download = useCallback(async (incident: Incident) => {
    setLoadingId(incident.id);
    try {
      toast({ title: "Generating PDF...", description: "Please wait..." });

      const [{ data: documents = [] }, { data: rawTimeline = [] }] = await Promise.all([
        supabase
          .from("incident_documents")
          .select("*")
          .eq("incident_id", incident.id),
        supabase
          .from("incident_timeline")
          .select("*")
          .eq("incident_id", incident.id)
          .order("created_at", { ascending: true }),
      ]);

      // Cast timeline metadata from Json to Record<string, unknown>
      const timeline = rawTimeline.map(t => ({
        ...t,
        metadata: (t.metadata as Record<string, unknown>) || {},
      }));

      await generateIncidentPDF({ incident, documents, timeline });

      toast({
        title: "Success",
        description: `PDF downloaded: ${incident.incident_number}`,
      });
    } catch (err) {
      console.error("PDF error:", err);
      toast({
        title: "Error",
        description: "Failed to generate PDF.",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  }, [toast]);

  return { download, isLoading: (id: string) => loadingId === id };
};

// ──────────────────────────────────────────────────────────────
// Reusable Components
// ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "open":
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Open</Badge>;
    case "processing":
      return <Badge className="gap-1 bg-yellow-500 text-white"><Clock className="h-3 w-3" /> Processing</Badge>;
    case "closed":
      return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> Closed</Badge>;
    case "claimed":
      return <Badge variant="outline" className="gap-1 border-green-500 text-green-600"><Shield className="h-3 w-3" /> Claimed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const SortableHeader = ({
  field,
  label,
  currentField,
  direction,
  onSort,
}: {
  field: string;
  label: string;
  currentField: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
}) => {
  const active = currentField === field;
  return (
    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => onSort(field)}>
      {label}
      <ArrowUpDown className={`ml-2 h-4 w-4 transition-transform ${active ? (direction === "asc" ? "rotate-180" : "") : "opacity-40"}`} />
    </Button>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────
const IncidentManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<"incident_date" | "incident_number" | "location" | "status">("incident_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeMainTab, setActiveMainTab] = useState<"incidents" | "reports">("incidents");

  // Dialogs
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [dialogs, setDialogs] = useState({
    add: false,
    details: false,
    edit: false,
    closure: false,
    delete: false,
    checklist: false,
    createCAR: false,
  });

  const openDialog = (key: keyof typeof dialogs, incident?: Incident) => {
    if (incident) setSelectedIncident(incident);
    setDialogs(prev => ({ ...prev, [key]: true }));
  };

  const closeDialog = (key: keyof typeof dialogs) => {
    setDialogs(prev => ({ ...prev, [key]: false }));
    if (key !== "add") setSelectedIncident(null);
  };

  const { data: incidents = [], isLoading } = useIncidents(statusFilter);
  useRealtimeIncidents();
  const { download: downloadPdf, isLoading: isDownloadingPdf } = useDownloadIncidentPdf();

  // Filtering & Sorting
  const filteredAndSortedIncidents = useMemo(() => {
    let result = incidents;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        [i.incident_number, i.location, i.reported_by, i.vehicles?.registration_number, i.vehicles?.fleet_number]
          .some(field => field?.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "incident_number": cmp = a.incident_number.localeCompare(b.incident_number); break;
        case "incident_date": cmp = new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime(); break;
        case "location": cmp = a.location.localeCompare(b.location); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [incidents, searchQuery, sortField, sortDirection]);

  const stats = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter(i => i.status === "open").length,
    processing: incidents.filter(i => i.status === "processing").length,
    closed: incidents.filter(i => i.status === "closed").length,
    claimed: incidents.filter(i => i.status === "claimed").length,
  }), [incidents]);

  const handleSort = useCallback((field: typeof sortField) => {
    setSortDirection(prev => sortField === field ? (prev === "asc" ? "desc" : "asc") : "desc");
    setSortField(field);
  }, [sortField]);

  const exportToExcel = useCallback(() => {
    const headers = ["Incident #", "Date", "Time", "Vehicle", "Location", "Type", "Reported By", "Status"];
    const rows = filteredAndSortedIncidents.map(i => [
      i.incident_number,
      i.incident_date,
      i.incident_time,
      i.vehicles?.registration_number || i.vehicle_number || "",
      i.location,
      i.incident_type.replace(/_/g, " "),
      i.reported_by,
      i.status,
    ]);

    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidents_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSortedIncidents]);

  return (
    <>
      {/* Dialogs */}
      <AddIncidentDialog open={dialogs.add} onOpenChange={(o) => o || closeDialog("add")} />
      <IncidentDetailsDialog incident={selectedIncident} open={dialogs.details} onOpenChange={(o) => !o && closeDialog("details")} />
      <EditIncidentDialog incident={selectedIncident} open={dialogs.edit} onOpenChange={(o) => !o && closeDialog("edit")} />
      <IncidentClosureDialog incident={selectedIncident} open={dialogs.closure} onOpenChange={(o) => !o && closeDialog("closure")} />
      <DeleteIncidentDialog incident={selectedIncident} open={dialogs.delete} onOpenChange={(o) => !o && closeDialog("delete")} />
      <IncidentChecklistDialog incident={selectedIncident} open={dialogs.checklist} onOpenChange={(o) => !o && closeDialog("checklist")} />
      <CreateCARFromIncidentDialog incident={selectedIncident} open={dialogs.createCAR} onOpenChange={(o) => !o && closeDialog("createCAR")} />

      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          {activeMainTab === "incidents" && (
            <Button onClick={() => openDialog("add")}>
              <Plus className="mr-2 h-4 w-4" />
              Report Incident
            </Button>
          )}
        </div>

        {/* Main Tabs: Incidents vs CAR/CRA Reports */}
        <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as "incidents" | "reports")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Incidents
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CAR / CRA Reports
            </TabsTrigger>
          </TabsList>

          {/* Incidents Tab Content */}
          <TabsContent value="incidents" className="space-y-6 mt-6">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Total", value: stats.total },
                { label: "Open", value: stats.open },
                { label: "Processing", value: stats.processing },
                { label: "Closed", value: stats.closed },
                { label: "Claimed", value: stats.claimed },
              ].map(s => (
                <Card key={s.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{s.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Accident Response Guide */}
            <AccidentResponseGuide />

        {/* Toolbar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search incidents..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export
                </Button>
                <Button variant="outline" size="sm" disabled><FileText className="mr-2 h-4 w-4" /> PDF</Button>
                <Button variant="outline" size="sm" disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Incidents</CardTitle>
                <CardDescription>{filteredAndSortedIncidents.length} incident{filteredAndSortedIncidents.length !== 1 ? "s" : ""} found</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {filteredAndSortedIncidents.length} Records
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <Clock className="h-10 w-10 opacity-40 animate-spin" />
                  <p>Loading incidents...</p>
                </div>
              </div>
            ) : filteredAndSortedIncidents.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="h-10 w-10 opacity-40" />
                  <p className="text-sm">No incidents found.</p>
                  <p className="text-xs">Try adjusting your search or filters.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[50px] py-3 font-semibold text-center sticky left-0 bg-muted/50">Actions</TableHead>
                        <TableHead className="min-w-[110px] py-3"><SortableHeader field="incident_number" label="Incident #" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                        <TableHead className="min-w-[130px] py-3"><SortableHeader field="incident_date" label="Date & Time" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                        <TableHead className="min-w-[140px] py-3 font-semibold">Vehicle</TableHead>
                        <TableHead className="min-w-[180px] py-3"><SortableHeader field="location" label="Location" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                        <TableHead className="min-w-[120px] py-3 font-semibold">Type</TableHead>
                        <TableHead className="min-w-[120px] py-3 font-semibold">Reported By</TableHead>
                        <TableHead className="min-w-[110px] py-3"><SortableHeader field="status" label="Status" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                        <TableHead className="w-[60px] py-3 font-semibold text-center sticky right-0 bg-muted/50">PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedIncidents.map((incident, index) => (
                        <TableRow key={incident.id} className={cn("transition-colors", index % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                          <TableCell className="py-3 text-center sticky left-0 bg-inherit">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => openDialog("details", incident)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog("edit", incident)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                {(incident.status === "open" || incident.status === "processing") && (
                                  <DropdownMenuItem onClick={() => openDialog("closure", incident)}><XCircle className="mr-2 h-4 w-4" /> Close Incident</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => downloadPdf(incident)} disabled={isDownloadingPdf(incident.id)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  {isDownloadingPdf(incident.id) ? "Generating..." : "Download PDF"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog("checklist", incident)}><ClipboardCheck className="mr-2 h-4 w-4" /> Checklist</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openDialog("createCAR", incident)}>
                                  <FileText className="mr-2 h-4 w-4" /> Create CAR Report
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => openDialog("delete", incident)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="py-3 font-mono text-sm font-medium">{incident.incident_number}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{incident.incident_date}</span>
                              <span className="text-xs text-muted-foreground">{incident.incident_time}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{incident.vehicles?.registration_number || incident.vehicle_number || "-"}</span>
                              {incident.vehicles?.fleet_number && (
                                <span className="text-xs text-muted-foreground">Fleet: {incident.vehicles.fleet_number}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 max-w-[200px]">
                            <span className="line-clamp-2 text-sm">{incident.location}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="font-normal capitalize">
                              {incident.incident_type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm">{incident.reported_by}</TableCell>
                          <TableCell className="py-3"><StatusBadge status={incident.status} /></TableCell>
                          <TableCell className="py-3 text-center sticky right-0 bg-inherit">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => downloadPdf(incident)}
                              disabled={isDownloadingPdf(incident.id)}
                              title="Download PDF"
                            >
                              {isDownloadingPdf(incident.id) ? <Clock className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* CAR/CRA Reports Tab Content */}
          <TabsContent value="reports" className="mt-6">
            <CarReportsGrid />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default IncidentManagement;