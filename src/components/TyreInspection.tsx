import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"; // ✅ ADDED: Missing cn import
import { getFleetConfig } from "@/constants/fleetTyreConfig";
import { useFleetTyrePositions } from "@/hooks/useFleetTyrePositions";
import { useRealtimeTyres } from "@/hooks/useRealtimeTyres";
import { useVehicles } from "@/hooks/useVehicles";
import type { LucideIcon } from "lucide-react";
import
  {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Circle,
    ClipboardCheck,
    Download,
    FileText,
    History,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    XCircle
  } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import TyreInspectionDialog from "./tyres/TyreInspectionDialog";
import TyreLifecycleDialog from "./tyres/TyreLifecycleDialog";
import TyreManagementDialog from "./tyres/TyreManagementDialog";

type TyreCondition = "excellent" | "good" | "fair" | "poor" | "needs_replacement" | "critical";

interface PositionData {
  position: string;
  positionLabel: string;
  tyreCode: string | null;
  tyreId: string | null;
  dotCode: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  size: string | null;
  condition: TyreCondition | null;
  currentTreadDepth: number | null;
  initialTreadDepth: number | null;
  kmTravelled: number | null;
  installationKm: number | null;
  type: string | null;
  nextInspectionDate: string | null;
  lastInspectionDate: string | null;
}

const TyreInspection = () => {
  const { toast } = useToast();
  const [vehicleId, setVehicleId] = useState("");
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
  const [managementDialogOpen, setManagementDialogOpen] = useState(false);
  const [managementMode, setManagementMode] = useState<"install" | "remove" | "edit">("install");
  const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: vehicles } = useVehicles();
  useRealtimeTyres();

  // Determine vehicle category from fleet number
  const getVehicleCategory = (fleetNumber: string | null): string => {
    if (!fleetNumber) return "Unassigned";
    // LMV (Light Motor Vehicles): 14L, 15L, 16L
    if (fleetNumber.endsWith('L')) return "LMV";
    // Trailers: 1T, 2T, 3T, 4T
    if (fleetNumber.endsWith('T')) return "Trailer";
    // Reefers: 4F, 5F, 6F, etc.
    if (fleetNumber.endsWith('F')) return "Reefer";
    // Horses: Everything ending with H, or other trucks
    if (fleetNumber.endsWith('H') || fleetNumber === 'UD') return "Horse";
    return "Other";
  };

  // Group vehicles by category, then by fleet number within each category
  const vehiclesByCategory = (vehicles || []).reduce<Record<string, Record<string, typeof vehicles>>>((acc, vehicle) => {
    const category = getVehicleCategory(vehicle.fleet_number);
    const fleetNumber = vehicle.fleet_number || "Unassigned";
    
    if (!acc[category]) {
      acc[category] = {};
    }
    if (!acc[category][fleetNumber]) {
      acc[category][fleetNumber] = [];
    }
    acc[category][fleetNumber]!.push(vehicle);
    return acc;
  }, {});

  // Define category order
  const categoryConfig: Record<string, { label: string; tyreCount: string; gradient: string }> = {
    Horse: { label: "Horse", tyreCount: "10 + spare", gradient: "from-violet-600 to-indigo-600" },
    Reefer: { label: "Reefer", tyreCount: "12 tyres", gradient: "from-blue-600 to-cyan-600" },
    Trailer: { label: "Interlink", tyreCount: "12 tyres", gradient: "from-emerald-600 to-teal-600" },
    LMV: { label: "LMV", tyreCount: "4–6 tyres", gradient: "from-amber-600 to-orange-600" },
    Other: { label: "Other", tyreCount: "Varies", gradient: "from-gray-600 to-slate-600" },
    Unassigned: { label: "Unassigned", tyreCount: "-", gradient: "from-gray-600 to-slate-600" },
  };

  const sortedCategories = ["Horse", "Reefer", "Trailer", "LMV", "Other", "Unassigned"]
    .filter(cat => vehiclesByCategory[cat] && Object.keys(vehiclesByCategory[cat]).length > 0);

  const filteredVehiclesByCategory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sortedCategories.reduce<Record<string, typeof vehicles>>((acc, category) => {
      if (categoryFilter !== "all" && category !== categoryFilter) return acc;

      const fleetsInCategory = vehiclesByCategory[category] || {};
      const categoryVehicles = Object.values(fleetsInCategory).flat();

      const filtered = !term
        ? categoryVehicles
        : categoryVehicles.filter((vehicle) => {
            const fleet = vehicle.fleet_number?.toLowerCase() || "";
            const reg = vehicle.registration_number?.toLowerCase() || "";
            const make = vehicle.make?.toLowerCase() || "";
            const model = vehicle.model?.toLowerCase() || "";
            return (
              fleet.includes(term) ||
              reg.includes(term) ||
              make.includes(term) ||
              model.includes(term)
            );
          });

      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    }, {});
  }, [sortedCategories, categoryFilter, vehiclesByCategory, searchTerm]);

  const visibleCategories = sortedCategories.filter(
    (category) => (filteredVehiclesByCategory[category] || []).length > 0
  );

  const totalVisibleVehicles = visibleCategories.reduce(
    (sum, category) => sum + (filteredVehiclesByCategory[category]?.length || 0),
    0
  );

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Get selected vehicle
  const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);
  const vehicleRegistration = selectedVehicle?.registration_number || "";
  const vehicleFleetNumber = selectedVehicle?.fleet_number || null;

  // Get fleet configuration and positions
  const fleetConfig = vehicleFleetNumber
    ? getFleetConfig(vehicleFleetNumber)
    : null;
  const { data: fleetPositions } = useFleetTyrePositions({
    vehicleRegistration,
    fleetNumber: vehicleFleetNumber,
  });

  // Build position data when vehicle or fleet positions change
  useEffect(() => {
    // Show positions from fleet config even if no tyres installed yet
    if (fleetConfig) {
      const positionData = fleetConfig.positions.map((pos) => {
        // Find existing position data if available
        const existingData = (fleetPositions || []).find(
          (fp) => fp.position === pos.position
        );
        const tyreDetails = existingData?.tyre_details;
        return {
          position: pos.position,
          positionLabel: pos.label,
          tyreCode: existingData?.tyre_code || null,
          tyreId: tyreDetails?.id || null,
          dotCode: tyreDetails?.dot_code || null,
          serialNumber: tyreDetails?.serial_number || null,
          brand: tyreDetails?.brand || null,
          model: tyreDetails?.model || null,
          size: tyreDetails?.size || null,
          condition: (tyreDetails?.condition as TyreCondition) || null,
          currentTreadDepth: tyreDetails?.current_tread_depth || null,
          initialTreadDepth: tyreDetails?.initial_tread_depth || null,
          kmTravelled: tyreDetails?.km_travelled || null,
          installationKm: tyreDetails?.installation_km || null,
          type: tyreDetails?.type || null,
          nextInspectionDate: tyreDetails?.next_inspection_date || null,
          lastInspectionDate: tyreDetails?.last_inspection_date || null,
        };
      });
      setPositions(positionData);
    } else {
      setPositions([]);
    }
  }, [fleetConfig, fleetPositions]);

  const handleInspect = (position: PositionData) => {
    setSelectedPosition(position);
    setInspectionDialogOpen(true);
  };

  const handleViewLifecycle = (position: PositionData) => {
    setSelectedPosition(position);
    setLifecycleDialogOpen(true);
  };

  const handleInstall = (position: PositionData) => {
    setSelectedPosition(position);
    setManagementMode("install");
    setManagementDialogOpen(true);
  };

  const handleRemove = (position: PositionData) => {
    setSelectedPosition(position);
    setManagementMode("remove");
    setManagementDialogOpen(true);
  };

  const handleEdit = (position: PositionData) => {
    setSelectedPosition(position);
    setManagementMode("edit");
    setManagementDialogOpen(true);
  };

  const getConditionBadge = (condition: TyreCondition | null) => {
    if (!condition) {
      return (
        <Badge variant="outline" className="text-muted-foreground bg-muted/20">
          <Circle className="w-3 h-3 mr-1" />
          Unknown
        </Badge>
      );
    }
    type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
    const variants: Record<
      TyreCondition,
      { icon: LucideIcon; variant: BadgeVariant; className?: string }
    > = {
      excellent: { icon: CheckCircle2, variant: "default", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      good: { icon: CheckCircle2, variant: "secondary", className: "bg-blue-100 text-blue-700 border-blue-200" },
      fair: { icon: AlertTriangle, variant: "outline", className: "bg-amber-100 text-amber-700 border-amber-200" },
      poor: { icon: AlertTriangle, variant: "destructive", className: "bg-orange-100 text-orange-700 border-orange-200" },
      critical: { icon: XCircle, variant: "destructive", className: "bg-rose-100 text-rose-700 border-rose-200" },
      needs_replacement: { icon: XCircle, variant: "destructive", className: "bg-red-100 text-red-700 border-red-200" },
    };

    const { icon: Icon, className } = variants[condition];
    return (
      <Badge variant="outline" className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {condition.replace("_", " ")}
      </Badge>
    );
  };

  const getInspectionExportRows = () => {
    const now = new Date();
    const rows = positions
      .filter((p) => p.tyreCode)
      .map((p) => {
        const lastInspection = p.lastInspectionDate ? new Date(p.lastInspectionDate) : null;
        const daysSinceInspection = lastInspection && !isNaN(lastInspection.getTime())
          ? Math.floor((now.getTime() - lastInspection.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let status = "No Record";
        if (daysSinceInspection !== null) {
          if (daysSinceInspection > 30) status = "Overdue";
          else if (daysSinceInspection >= 25) status = "Due Soon";
          else status = "OK";
        }

        return {
          vehicle: vehicleRegistration || "-",
          fleet: vehicleFleetNumber || "-",
          position: p.position,
          positionLabel: p.positionLabel,
          tyreCode: p.dotCode || p.serialNumber || p.tyreCode || "-",
          brand: p.brand || "-",
          model: p.model || "-",
          lastInspection: p.lastInspectionDate
            ? new Date(p.lastInspectionDate).toLocaleDateString("en-ZA")
            : "Not recorded",
          daysSinceInspection,
          status,
        };
      })
      .filter((r) => r.status === "Overdue" || r.status === "Due Soon");

    return rows;
  };

  const exportDueTyresToExcel = async () => {
    const rows = getInspectionExportRows();
    if (rows.length === 0) {
      toast({ 
        title: "No due tyres", 
        description: "No due or overdue tyre inspections for this vehicle.",
        variant: "default",
      });
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Due Tyre Inspections");
    ws.columns = [
      { header: "Vehicle", key: "vehicle", width: 16 },
      { header: "Fleet", key: "fleet", width: 10 },
      { header: "Position", key: "position", width: 12 },
      { header: "Position Label", key: "positionLabel", width: 24 },
      { header: "Tyre Code", key: "tyreCode", width: 20 },
      { header: "Brand", key: "brand", width: 14 },
      { header: "Model", key: "model", width: 14 },
      { header: "Last Inspection", key: "lastInspection", width: 16 },
      { header: "Days Since", key: "daysSinceInspection", width: 12 },
      { header: "Status", key: "status", width: 12 },
    ];
    rows.forEach((r) => ws.addRow(r));

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `due-tyre-inspections-${vehicleRegistration || "vehicle"}.xlsx`
    );
    toast({ 
      title: "Export Successful", 
      description: `${rows.length} due or overdue tyres exported to Excel.`,
    });
  };

  const exportDueTyresToPDF = () => {
    const rows = getInspectionExportRows();
    if (rows.length === 0) {
      toast({ 
        title: "No due tyres", 
        description: "No due or overdue tyre inspections for this vehicle.",
      });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Due Tyre Inspections", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Vehicle", "Fleet", "Position", "Tyre Code", "Brand", "Model", "Last Inspection", "Days Since", "Status"]],
      body: rows.map((r) => [
        r.vehicle,
        r.fleet,
        r.position,
        r.tyreCode,
        r.brand,
        r.model,
        r.lastInspection,
        r.daysSinceInspection ?? "-",
        r.status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 56, 100] },
    });
    doc.save(`due-tyre-inspections-${vehicleRegistration || "vehicle"}.pdf`);
    toast({ 
      title: "Export Successful", 
      description: `${rows.length} due or overdue tyres exported to PDF.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Vehicle Selection by Fleet */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Vehicle Store
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Select a fleet vehicle and manage tyre positions, inspections, and lifecycle actions
              </CardDescription>
            </div>
            <Badge className="w-fit text-sm px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30 rounded-full">
              {totalVisibleVehicles} Active Vehicle{totalVisibleVehicles === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportDueTyresToExcel} 
              disabled={!vehicleId}
              className="border-2 hover:bg-primary/5 transition-all"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Due (Excel)
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportDueTyresToPDF} 
              disabled={!vehicleId}
              className="border-2 hover:bg-primary/5 transition-all"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export Due (PDF)
            </Button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by fleet, registration, make or model"
                className="pl-9 border-2 focus-visible:ring-1"
              />
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:items-center">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px] border-2">
                  <SelectValue placeholder="Filter category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {sortedCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryConfig[category]?.label || category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="outline" className="h-10 px-4 justify-center sm:justify-start bg-muted/40 border-2 rounded-lg">
                Showing {totalVisibleVehicles} vehicle{totalVisibleVehicles === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>

          {visibleCategories.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No vehicles found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search or filter" : "No vehicles available"}
              </p>
            </div>
          ) : (
            visibleCategories.map((category) => {
              const categoryData = categoryConfig[category];
              const categoryVehicles = filteredVehiclesByCategory[category] || [];
              const fleetNumbers = Array.from(
                new Set(categoryVehicles.map((vehicle) => vehicle.fleet_number || "Unassigned"))
              ).sort((a, b) => {
                const numA = parseInt(a);
                const numB = parseInt(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
              });
              const totalVehicles = categoryVehicles.length;
              const isExpanded = expandedCategories.has(category);

              return (
                <Collapsible
                  key={category}
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between px-5 py-4 h-auto rounded-xl border-2",
                        "bg-gradient-to-r from-muted/50 to-muted/30 hover:from-muted/60 hover:to-muted/40",
                        "transition-all hover:shadow-md group"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200",
                          isExpanded ? "rotate-90 bg-primary/10" : "bg-muted/50"
                        )}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-base">{categoryData?.label || category}</span>
                          <span className="text-xs text-muted-foreground ml-2">{categoryData?.tyreCount || "-"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-medium bg-background/80 border-2 rounded-full px-3">
                          {fleetNumbers.length} fleets
                        </Badge>
                        <Badge className={cn(
                          "text-xs font-medium bg-gradient-to-r text-white shadow-sm rounded-full px-3 py-1",
                          categoryData?.gradient || "from-gray-600 to-slate-600"
                        )}>
                          {totalVehicles} vehicles
                        </Badge>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-3 space-y-2 border-l-2 border-primary/20 pl-4">
                      {fleetNumbers.flatMap((fleetNumber) => {
                        const fleetVehicles = categoryVehicles.filter(
                          (vehicle) => (vehicle.fleet_number || "Unassigned") === fleetNumber
                        );
                        
                        return fleetVehicles.map((vehicle) => {
                          const isSelected = vehicleId === vehicle.id;
                          const fleetConf = fleetNumber !== "Unassigned" ? getFleetConfig(fleetNumber) : null;
                          
                          return (
                            <div key={vehicle.id}>
                              <Button
                                variant={isSelected ? "secondary" : "ghost"}
                                size="sm"
                                className={cn(
                                  "w-full justify-start gap-3 h-12 rounded-xl text-sm transition-all",
                                  isSelected
                                    ? "border-2 border-primary/30 bg-primary/5 text-primary shadow-sm"
                                    : "hover:bg-muted/60 hover:border-2 hover:border-muted"
                                )}
                                onClick={() => setVehicleId(isSelected ? "" : vehicle.id)}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded flex items-center justify-center transition-transform",
                                  isSelected && "rotate-90"
                                )}>
                                  <ChevronRight className="w-3 h-3" />
                                </div>
                                <span className="font-bold">Fleet {fleetNumber}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="font-medium text-muted-foreground">{vehicle.registration_number}</span>
                                {fleetConf && (
                                  <span className="ml-auto px-3 py-1 rounded-full bg-muted text-xs font-medium">
                                    {fleetConf.positions.length} positions
                                  </span>
                                )}
                              </Button>
                                    
                              {/* Inline Tyre Table - appears directly under selected vehicle */}
                              {isSelected && positions.length > 0 && (
                                <div className="mt-4 mb-4 border-2 rounded-xl overflow-hidden bg-background overflow-x-auto shadow-inner">
                                  <Table className="min-w-[800px]">
                                    <TableHeader>
                                      <TableRow className="bg-gradient-to-r from-muted/80 to-muted/50 hover:from-muted/80 hover:to-muted/50 border-b-2">
                                        <TableHead className="min-w-[120px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">Position</TableHead>
                                        <TableHead className="min-w-[160px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">DOT / Serial</TableHead>
                                        <TableHead className="min-w-[140px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">Brand / Model</TableHead>
                                        <TableHead className="min-w-[90px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">Size</TableHead>
                                        <TableHead className="min-w-[120px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">KM Traveled</TableHead>
                                        <TableHead className="min-w-[120px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">Tread (mm)</TableHead>
                                        <TableHead className="min-w-[120px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider">Condition</TableHead>
                                        <TableHead className="min-w-[110px] text-xs py-4 font-bold text-foreground/80 uppercase tracking-wider text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {positions.map((pos, index) => (
                                        <TableRow
                                          key={pos.position}
                                          className={cn(
                                            index % 2 === 0 ? "bg-background" : "bg-muted/5",
                                            "transition-all duration-200 ease-in-out",
                                            "hover:bg-primary/5 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary))]",
                                            "group"
                                          )}
                                        >
                                          <TableCell className="py-3">
                                            <div className="flex items-center gap-2">
                                              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-muted/80 text-foreground font-bold">
                                                {pos.position}
                                              </span>
                                              <span className="text-muted-foreground text-sm">
                                                {pos.positionLabel.split(' - ')[1] || ''}
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="py-3">
                                            {pos.tyreCode ? (
                                              <div className="flex flex-col gap-0.5">
                                                {pos.dotCode && <span className="font-mono font-bold text-foreground">{pos.dotCode}</span>}
                                                {pos.serialNumber && <span className="font-mono text-sm text-muted-foreground">{pos.serialNumber}</span>}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground italic px-3 py-2 rounded-lg bg-muted/30 inline-block">
                                                Empty slot
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell className="py-3">
                                            {pos.brand ? (
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-foreground">{pos.brand}</span>
                                                {pos.model && <span className="text-muted-foreground text-sm">{pos.model}</span>}
                                              </div>
                                            ) : <span className="text-muted-foreground">-</span>}
                                          </TableCell>
                                          <TableCell className="py-3">
                                            <span className="font-medium">{pos.size || '-'}</span>
                                          </TableCell>
                                          <TableCell className="py-3">
                                            {pos.kmTravelled !== null ? (
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-foreground">{pos.kmTravelled.toLocaleString()} km</span>
                                                {pos.installationKm && (
                                                  <span className="text-muted-foreground text-xs">from {pos.installationKm.toLocaleString()}</span>
                                                )}
                                              </div>
                                            ) : <span className="text-muted-foreground">-</span>}
                                          </TableCell>
                                          <TableCell className="py-3">
                                            {pos.currentTreadDepth !== null ? (
                                              <div className="flex flex-col gap-0.5">
                                                <span className={cn(
                                                  "font-bold px-3 py-1.5 rounded-lg inline-block w-fit text-white shadow-sm",
                                                  pos.currentTreadDepth <= 3 ? 'bg-gradient-to-r from-red-600 to-rose-500' :
                                                  pos.currentTreadDepth <= 5 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                                  pos.currentTreadDepth <= 7 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                                                  'bg-gradient-to-r from-emerald-500 to-green-400'
                                                )}>
                                                  {pos.currentTreadDepth} mm
                                                </span>
                                                {pos.initialTreadDepth && (
                                                  <span className="text-muted-foreground text-xs">of {pos.initialTreadDepth} mm</span>
                                                )}
                                              </div>
                                            ) : <span className="text-muted-foreground">-</span>}
                                          </TableCell>
                                          <TableCell className="py-3">
                                            {getConditionBadge(pos.condition)}
                                          </TableCell>
                                          <TableCell className="py-2 text-right">
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button 
                                                  variant="outline" 
                                                  size="sm" 
                                                  className="h-9 w-9 p-0 opacity-70 group-hover:opacity-100 transition-all border-2 hover:border-primary"
                                                >
                                                  <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="w-56 rounded-xl border-2">
                                                {pos.tyreCode ? (
                                                  <>
                                                    <DropdownMenuItem onClick={() => handleInspect(pos)} className="gap-3 py-2.5">
                                                      <ClipboardCheck className="w-4 h-4" />
                                                      Inspect Tyre
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleEdit(pos)} className="gap-3 py-2.5">
                                                      <Pencil className="w-4 h-4" />
                                                      Edit Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleViewLifecycle(pos)} className="gap-3 py-2.5">
                                                      <History className="w-4 h-4" />
                                                      View Lifecycle
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                      onClick={() => handleRemove(pos)} 
                                                      className="gap-3 py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                      Remove Tyre
                                                    </DropdownMenuItem>
                                                  </>
                                                ) : (
                                                  <DropdownMenuItem onClick={() => handleInstall(pos)} className="gap-3 py-2.5">
                                                    <Plus className="w-4 h-4" />
                                                    Install Tyre
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              
                              {/* Show empty positions message */}
                              {isSelected && positions.length === 0 && fleetConfig && (
                                <div className="mt-4 mb-4 p-6 border-2 rounded-xl text-sm bg-muted/20 flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <ChevronRight className="w-5 h-5 animate-pulse" />
                                  </div>
                                  <span className="text-muted-foreground">Loading tyre positions...</span>
                                </div>
                              )}
                              
                              {/* No fleet config warning inline */}
                              {isSelected && !fleetConfig && (
                                <div className="mt-4 mb-4 p-4 border-2 border-amber-500/30 bg-amber-500/10 rounded-xl text-sm">
                                  <span className="font-bold text-amber-700 dark:text-amber-400">No fleet configuration found</span>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    This vehicle doesn't have a fleet configuration assigned.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedPosition && (
        <>
          <TyreInspectionDialog
            open={inspectionDialogOpen}
            onOpenChange={setInspectionDialogOpen}
            vehicleId={vehicleId}
            vehicleRegistration={vehicleRegistration}
            fleetNumber={vehicleFleetNumber}
            tyreCode={selectedPosition.tyreCode}
            dotCode={selectedPosition.dotCode}
            position={selectedPosition.position}
            positionLabel={selectedPosition.positionLabel}
            existingCondition={selectedPosition.condition}
            existingTreadDepth={selectedPosition.currentTreadDepth}
            installationKm={selectedPosition.installationKm}
          />

          <TyreLifecycleDialog
            open={lifecycleDialogOpen}
            onOpenChange={setLifecycleDialogOpen}
            tyreCode={selectedPosition.tyreCode}
            dotCode={selectedPosition.dotCode}
            position={selectedPosition.position}
            positionLabel={selectedPosition.positionLabel}
          />

          <TyreManagementDialog
            open={managementDialogOpen}
            onOpenChange={setManagementDialogOpen}
            mode={managementMode}
            vehicleId={vehicleId}
            vehicleRegistration={vehicleRegistration}
            fleetNumber={vehicleFleetNumber}
            position={selectedPosition.position}
            positionLabel={selectedPosition.positionLabel}
            currentTyreCode={selectedPosition.tyreCode}
            currentDotCode={selectedPosition.dotCode}
            currentTyreId={selectedPosition.tyreId || selectedPosition.tyreCode}
          />
        </>
      )}
    </div>
  );
};

export default TyreInspection;