import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  exportAllTyresToExcel,
  exportAllTyresToPDF,
  exportBayTyresToExcel,
  exportBayTyresToPDF,
} from "@/utils/tyreExport";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Ban, Download, Eye, FileSpreadsheet, FileText, History, Package, Pencil, Plus, Trash2, Truck, Wrench } from "lucide-react";
import { useState } from "react";
import AddBayTyreDialog from "../dialogs/AddBayTyreDialog";
import AddTyreDialog from "../dialogs/AddTyreDialog";
import BulkTyreInstallImportModal from "../dialogs/BulkTyreInstallImportModal";
import EditBayTyreDialog from "../dialogs/EditBayTyreDialog";
import EditInstalledTyreDialog from "../dialogs/EditInstalledTyreDialog";
import EditTyreDialog from "../dialogs/EditTyreDialog";
import InstallBayTyreToVehicleDialog from "../dialogs/InstallBayTyreToVehicleDialog";
import InstallTyreDialog from "../dialogs/InstallTyreDialog";
import MoveTyreToBayDialog from "../dialogs/MoveTyreToBayDialog";
import RemoveTyreDialog from "../dialogs/RemoveTyreDialog";
import TyreInventoryImportModal from "../dialogs/TyreInventoryImportModal";
import ViewTyreDialog from "../dialogs/ViewTyreDialog";
import ViewInstalledTyreDialog from "../dialogs/ViewInstalledTyreDialog";

// Extend Tyre type with optional vehicle-related fields
type TyreWithPosition = Database["public"]["Tables"]["tyres"]["Row"] & {
  current_fleet_position?: string | null;
};

type InstalledTyreWithVehicle = TyreWithPosition & {
  vehicles?: {
    id: string;
    registration_number: string;
    fleet_number: string;
    current_odometer: number | null;
  } | null;
  dot_code?: string | null;
};

type TyrePositionHistoryRow = {
  id: string;
  action: string;
  performed_at: string;
  tyre_id: string;
  vehicle_id: string;
  fleet_position: string;
  from_position: string;
  to_position: string;
  km_reading: number;
  performed_by: string;
  notes: string;
  tyres?: Pick<Database["public"]["Tables"]["tyres"]["Row"], "brand" | "model" | "serial_number"> | null;
  vehicles?: {
    registration_number: string;
    fleet_number: string;
  } | null;
};

interface TyreStock {
  id: string;
  brand: string;
  model: string;
  dotCode: string;
  size: string;
  type: string;
  pressureRating: number | null;
  initialTreadDepth: number | null;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  purchaseCostZar: number | null;
  purchaseCostUsd: number | null;
  location: string;
  supplier: string;
  status: string;
}

const TyreInventory = () => {
  const { toast } = useToast();

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addBayTyreDialogOpen, setAddBayTyreDialogOpen] = useState(false);
  const [addBayType, setAddBayType] = useState<"holding-bay" | "retread-bay">("holding-bay");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkInstallDialogOpen, setBulkInstallDialogOpen] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editInstalledDialogOpen, setEditInstalledDialogOpen] = useState(false);
  const [editBayTyreDialogOpen, setEditBayTyreDialogOpen] = useState(false);
  const [installBayTyreToVehicleDialogOpen, setInstallBayTyreToVehicleDialogOpen] = useState(false);
  const [moveTyreToBayDialogOpen, setMoveTyreToBayDialogOpen] = useState(false);
  const [selectedTyre, setSelectedTyre] = useState<InstalledTyreWithVehicle | null>(null);
  const [selectedBayTyre, setSelectedBayTyre] = useState<TyreWithPosition | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<TyreStock | null>(null);
  const [activeTab, setActiveTab] = useState("holding-bay");

  const { data: _tyreStock = [], refetch } = useQuery({
    queryKey: ["tyre_inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyre_inventory")
        .select("*")
        .order("brand");

      if (error) throw error;
      return data.map(item => ({
        id: item.id,
        brand: item.brand,
        model: item.model,
        dotCode: item.dot_code || "",
        size: item.size,
        type: item.type,
        pressureRating: item.pressure_rating,
        initialTreadDepth: item.initial_tread_depth,
        quantity: item.quantity,
        minQuantity: item.min_quantity,
        unitPrice: item.unit_price || 0,
        purchaseCostZar: item.purchase_cost_zar,
        purchaseCostUsd: item.purchase_cost_usd,
        location: item.location || "",
        supplier: item.supplier || "",
        status: item.status || "new",
      }));
    },
  });

  // Fetch installed tyres (data used for refetch operations)
  const { data: installedTyres = [], refetch: refetchInstalled } = useQuery({
    queryKey: ["installed_tyres"],
    queryFn: async () => {
      const { data: tyres, error } = await supabase
        .from("tyres")
        .select("*")
        .not("current_fleet_position", "is", null)
        .order("installation_date", { ascending: false });

      if (error) throw error;

      // Fetch all vehicles to match with tyres
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id, registration_number, fleet_number");

      // Fetch DOT codes from tyre_inventory for all inventory_ids
      const inventoryIds = (tyres || [])
        .map(t => t.inventory_id)
        .filter((id): id is string => id !== null);

      const dotCodeMap: Map<string, string | null> = new Map();
      if (inventoryIds.length > 0) {
        const { data: inventoryData } = await supabase
          .from("tyre_inventory")
          .select("id, dot_code")
          .in("id", inventoryIds);

        if (inventoryData) {
          inventoryData.forEach(inv => {
            dotCodeMap.set(inv.id, inv.dot_code);
          });
        }
      }

      // Match tyres to vehicles by parsing current_fleet_position
      return ((tyres || []) as TyreWithPosition[]).map(tyre => {
        // current_fleet_position format: "33H JFK963FS-V3" or "1T ADZ9011/ADZ9010-T1"
        // Parse to extract registration number (handle spaces and slashes in registration)
        const positionMatch = tyre.current_fleet_position?.match(/^(\d+[A-Z]+)\s+([A-Z0-9/\s]+)-([A-Z0-9]+)$/);
        const registration = positionMatch ? positionMatch[2].trim() : null;
        const vehicle = vehicles?.find(v => v.registration_number === registration);
        const dotCode = tyre.inventory_id ? dotCodeMap.get(tyre.inventory_id) || null : null;

        return {
          ...tyre,
          vehicles: vehicle ? {
            id: vehicle.id,
            registration_number: vehicle.registration_number,
            fleet_number: vehicle.fleet_number,
            current_odometer: null // Odometer to be fetched from trip records if needed
          } : null,
          dot_code: dotCode,
        };
      });
    },
  });

  // Fetch tyres by bay/location (not installed on vehicles)
  const { data: bayTyres = [], refetch: refetchBays } = useQuery({
    queryKey: ["tyre_bays"],
    queryFn: async () => {
      const { data: tyres, error } = await supabase
        .from("tyres")
        .select("*")
        .is("current_fleet_position", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (tyres || []) as TyreWithPosition[];
    },
  });

  // Filter tyres by bay position (using position field to track bay location)
  const holdingBayTyres = bayTyres.filter(t => t.position === "holding-bay" || t.position === "main-warehouse" || !t.position);
  const retreadBayTyres = bayTyres.filter(t => t.position === "retread-bay");
  const scrapAndSoldTyres = bayTyres.filter(t => t.position === "scrap" || t.position === "sold");

  // Fetch position history
  const { data: positionHistory = [] } = useQuery({
    queryKey: ["tyre_position_history"],
    queryFn: async () => {
      // Fetch position history records
      const { data: historyData, error: historyError } = await supabase
        .from("tyre_position_history")
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      // Fetch related tyres and vehicles separately
      const tyreIds = historyData?.map(h => h.tyre_id).filter(Boolean) || [];
      const vehicleIds = historyData?.map(h => h.vehicle_id).filter(Boolean) || [];

      const [tyresResponse, vehiclesResponse] = await Promise.all([
        tyreIds.length > 0
          ? supabase.from("tyres").select("id, serial_number, brand, model").in("id", tyreIds)
          : { data: [] },
        vehicleIds.length > 0
          ? supabase.from("vehicles").select("id, registration_number, fleet_number").in("id", vehicleIds)
          : { data: [] }
      ]);

      // Map the relationships manually
      const tyresMap = new Map(
        (tyresResponse.data || []).map(t => [t.id, t] as [string, typeof t])
      );
      const vehiclesMap = new Map(
        (vehiclesResponse.data || []).map(v => [v.id, v] as [string, typeof v])
      );

      return (historyData || []).map(history => ({
        ...history,
        tyres: history.tyre_id ? tyresMap.get(history.tyre_id) || null : null,
        vehicles: history.vehicle_id ? vehiclesMap.get(history.vehicle_id) || null : null,
      })) as unknown as TyrePositionHistoryRow[];
    },
  });

  // Enhanced Tread Depth Progress Bar Component
  const TreadDepthProgress = ({ depth, maxDepth = 12 }: { depth: number | null; maxDepth?: number }) => {
    if (!depth) return <span className="text-muted-foreground">-</span>;

    const percentage = Math.min((depth / maxDepth) * 100, 100);
    const getColor = () => {
      if (percentage >= 70) return "bg-gradient-to-r from-emerald-500 to-green-400";
      if (percentage >= 40) return "bg-gradient-to-r from-amber-500 to-yellow-400";
      return "bg-gradient-to-r from-red-500 to-rose-400";
    };
    const getTextColor = () => {
      if (percentage >= 70) return "text-emerald-600";
      if (percentage >= 40) return "text-amber-600";
      return "text-red-600";
    };

    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor()} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`font-mono text-xs font-semibold ${getTextColor()}`}>{depth}mm</span>
      </div>
    );
  };

  const getTyreBadge = (type: string) => {
    const colors: Record<string, string> = {
      steer: "bg-blue-50 text-blue-700 border border-blue-200",
      Steer: "bg-blue-50 text-blue-700 border border-blue-200",
      drive: "bg-purple-50 text-purple-700 border border-purple-200",
      Drive: "bg-purple-50 text-purple-700 border border-purple-200",
      trailer: "bg-slate-50 text-slate-700 border border-slate-200",
      Trailer: "bg-slate-50 text-slate-700 border border-slate-200",
    };
    return (
      <Badge className={`${colors[type] || "bg-muted"} transition-all duration-200 hover:scale-105 hover:shadow-md`}>
        {type}
      </Badge>
    );
  };

  const _getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      new: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      used: "bg-slate-50 text-slate-700 border border-slate-200",
      refurbished: "bg-amber-50 text-amber-700 border border-amber-200",
      scrap: "bg-red-50 text-red-700 border border-red-200",
      "in-service": "bg-blue-50 text-blue-700 border border-blue-200",
    };
    return (
      <Badge className={`${statusStyles[status] || "bg-muted"} capitalize transition-all duration-200 hover:scale-105`}>
        {status}
      </Badge>
    );
  };

  const _getStockStatus = (tyre: TyreStock) => {
    if (tyre.quantity < tyre.minQuantity) {
      return (
        <Badge className="bg-red-50 text-red-700 border border-red-200 animate-pulse">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            Low Stock
          </span>
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
        In Stock
      </Badge>
    );
  };

  const _getActionBadge = (action: string) => {
    const actionStyles: Record<string, string> = {
      installed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      removed: "bg-amber-50 text-amber-700 border border-amber-200",
      rotated: "bg-blue-50 text-blue-700 border border-blue-200",
    };
    return (
      <Badge className={`${actionStyles[action] || "bg-muted"} capitalize transition-all duration-200`}>
        {action}
      </Badge>
    );
  };

  const _getLocationBadge = (location: string) => {
    const locationStyles: Record<string, { bg: string; icon: string }> = {
      "main-warehouse": { bg: "bg-gradient-to-r from-blue-600 to-blue-500 shadow-sm shadow-blue-500/30", icon: "🏭" },
      "service-bay": { bg: "bg-gradient-to-r from-emerald-600 to-green-500 shadow-sm shadow-emerald-500/30", icon: "🔧" },
      "retread-bay": { bg: "bg-gradient-to-r from-orange-600 to-amber-500 shadow-sm shadow-orange-500/30", icon: "♻️" },
      "scrap-store": { bg: "bg-gradient-to-r from-red-600 to-rose-500 shadow-sm shadow-red-500/30", icon: "🗑️" },
      "holding-bay": { bg: "bg-gradient-to-r from-purple-600 to-violet-500 shadow-sm shadow-purple-500/30", icon: "📦" },
    };
    const style = locationStyles[location] || { bg: "bg-gradient-to-r from-gray-600 to-gray-500", icon: "📍" };
    const displayName = location.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    return (
      <Badge className={`${style.bg} text-white gap-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md`}>
        <span className="text-sm">{style.icon}</span>
        {displayName}
      </Badge>
    );
  };

  const getInstalledTypeBadge = (type: string | null) => {
    const normalized = (type || "unknown").toLowerCase();

    const styles: Record<string, string> = {
      new: "bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-sm",
      retread: "bg-gradient-to-r from-amber-500 to-yellow-400 text-white shadow-sm",
      used: "bg-gradient-to-r from-slate-600 to-gray-500 text-white shadow-sm",
      unknown: "bg-muted text-muted-foreground",
    };

    return (
      <Badge className={styles[normalized] || styles.unknown}>
        {type || "unknown"}
      </Badge>
    );
  };

  // Render tyre table for bay tabs
  const renderTyreTable = (tyres: TyreWithPosition[], bayType: string) => {
    if (tyres.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Package className="h-10 w-10 opacity-40" />
            <p className="text-sm">No tyres in this bay.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/80 to-muted/50 hover:from-muted/80 hover:to-muted/50 border-b-2 border-muted">
                <TableHead className="min-w-[120px] py-3.5 font-semibold text-foreground/80">Serial Number</TableHead>
                <TableHead className="min-w-[160px] py-3.5 font-semibold text-foreground/80">Brand / Model</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Size</TableHead>
                <TableHead className="min-w-[90px] py-3.5 font-semibold text-foreground/80">Type</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Condition</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Tread Depth</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Lifetime KM</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Added</TableHead>
                <TableHead className="min-w-[120px] py-3.5 font-semibold text-foreground/80 text-center sticky right-0 bg-gradient-to-r from-muted/80 to-muted/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tyres.map((tyre, index) => (
                <TableRow
                  key={tyre.id}
                  className={`
                    ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                    transition-all duration-200 ease-in-out
                    hover:bg-primary/5 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary))]
                    group cursor-pointer
                  `}
                >
                  <TableCell className="font-mono text-sm py-3.5 text-muted-foreground">
                    {tyre.serial_number || tyre.id.substring(0, 8)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold group-hover:text-primary transition-colors">{tyre.brand}</span>
                      <span className="text-xs text-muted-foreground">{tyre.model}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="inline-flex items-center px-2 py-1 bg-muted/50 rounded font-mono text-sm">
                      {tyre.size}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5">{getTyreBadge(tyre.type)}</TableCell>
                  <TableCell className="py-3.5">
                    {tyre.condition ? (
                      <Badge className={`capitalize transition-all duration-200 ${tyre.condition === 'excellent' ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-sm' :
                        tyre.condition === 'good' ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-sm' :
                          tyre.condition === 'fair' ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white shadow-sm' :
                            'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-sm'
                        }`}>
                        {tyre.condition.replace('_', ' ')}
                      </Badge>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <TreadDepthProgress depth={tyre.current_tread_depth} />
                  </TableCell>
                  <TableCell className="py-3.5 text-sm font-mono">
                    {tyre.km_travelled ? tyre.km_travelled.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {tyre.created_at ? new Date(tyre.created_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="py-3.5 sticky right-0 bg-inherit">
                    <div className="flex items-center justify-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedTyre(tyre as InstalledTyreWithVehicle);
                          setViewDialogOpen(true);
                        }}
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {bayType !== "scrap" && bayType !== "sold" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:border-green-300"
                          onClick={() => {
                            setSelectedBayTyre(tyre);
                            setInstallBayTyreToVehicleDialogOpen(true);
                          }}
                          title="Install to Vehicle"
                        >
                          <Truck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:border-blue-300"
                        onClick={() => {
                          setSelectedBayTyre(tyre);
                          setMoveTyreToBayDialogOpen(true);
                        }}
                        title="Move to Store"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedBayTyre(tyre);
                          setEditBayTyreDialogOpen(true);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={async () => {
                          if (confirm('Are you sure you want to permanently delete this tyre?')) {
                            const { error } = await supabase.from('tyres').delete().eq('id', tyre.id);
                            if (error) {
                              toast({ title: "Error", description: error.message, variant: "destructive" });
                            } else {
                              toast({ title: "Deleted", description: "Tyre removed from system" });
                              requestGoogleSheetsSync('tyres');
                              refetch();
                            }
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // Render tyre table for Scrap & Sold tab with status column
  const renderScrapSoldTable = (tyres: TyreWithPosition[]) => {
    if (tyres.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Ban className="h-10 w-10 opacity-40" />
            <p className="text-sm">No scrapped or sold tyres.</p>
          </div>
        </div>
      );
    }

    const getStatusBadge = (position: string | null) => {
      if (position === "scrap") {
        return (
          <Badge className="bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-sm shadow-red-500/30">
            Scrapped
          </Badge>
        );
      }
      return (
        <Badge className="bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-sm shadow-emerald-500/30">
          Sold
        </Badge>
      );
    };

    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/80 to-muted/50 hover:from-muted/80 hover:to-muted/50 border-b-2 border-muted">
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Status</TableHead>
                <TableHead className="min-w-[120px] py-3.5 font-semibold text-foreground/80">Serial Number</TableHead>
                <TableHead className="min-w-[160px] py-3.5 font-semibold text-foreground/80">Brand / Model</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Size</TableHead>
                <TableHead className="min-w-[90px] py-3.5 font-semibold text-foreground/80">Type</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Condition</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Tread Depth</TableHead>
                <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Date</TableHead>
                <TableHead className="min-w-[120px] py-3.5 font-semibold text-foreground/80 text-center sticky right-0 bg-gradient-to-r from-muted/80 to-muted/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tyres.map((tyre, index) => (
                <TableRow
                  key={tyre.id}
                  className={`
                    ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                    transition-all duration-200 ease-in-out
                    hover:bg-primary/5 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary))]
                    group cursor-pointer
                  `}
                >
                  <TableCell className="py-3.5">
                    {getStatusBadge(tyre.position)}
                  </TableCell>
                  <TableCell className="font-mono text-sm py-3.5 text-muted-foreground">
                    {tyre.serial_number || tyre.id.substring(0, 8)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold group-hover:text-primary transition-colors">{tyre.brand}</span>
                      <span className="text-xs text-muted-foreground">{tyre.model}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="inline-flex items-center px-2 py-1 bg-muted/50 rounded font-mono text-sm">
                      {tyre.size}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5">{getTyreBadge(tyre.type)}</TableCell>
                  <TableCell className="py-3.5">
                    {tyre.condition ? (
                      <Badge className={`capitalize transition-all duration-200 ${tyre.condition === 'excellent' ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white shadow-sm' :
                        tyre.condition === 'good' ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-sm' :
                          tyre.condition === 'fair' ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white shadow-sm' :
                            'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-sm'
                        }`}>
                        {tyre.condition.replace('_', ' ')}
                      </Badge>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <TreadDepthProgress depth={tyre.current_tread_depth} />
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {tyre.updated_at ? new Date(tyre.updated_at).toLocaleDateString() : tyre.created_at ? new Date(tyre.created_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="py-3.5 sticky right-0 bg-inherit">
                    <div className="flex items-center justify-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedTyre(tyre as InstalledTyreWithVehicle);
                          setViewDialogOpen(true);
                        }}
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:border-blue-300"
                        onClick={() => {
                          setSelectedBayTyre(tyre);
                          setMoveTyreToBayDialogOpen(true);
                        }}
                        title="Move to Store"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedBayTyre(tyre);
                          setEditBayTyreDialogOpen(true);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={async () => {
                          if (confirm('Are you sure you want to permanently delete this tyre?')) {
                            const { error } = await supabase.from('tyres').delete().eq('id', tyre.id);
                            if (error) {
                              toast({ title: "Error", description: error.message, variant: "destructive" });
                            } else {
                              toast({ title: "Deleted", description: "Tyre removed from system" });
                              requestGoogleSheetsSync('tyres');
                              refetchBays();
                            }
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Global Export All Tyres Button */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export All Tyres
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={async () => {
                const allTyres = [...holdingBayTyres, ...retreadBayTyres, ...scrapAndSoldTyres];
                await exportAllTyresToExcel(allTyres);
                toast({ title: "Exported", description: `${allTyres.length} tyres exported to Excel` });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const allTyres = [...holdingBayTyres, ...retreadBayTyres, ...scrapAndSoldTyres];
                exportAllTyresToPDF(allTyres);
                toast({ title: "Exported", description: `${allTyres.length} tyres exported to PDF` });
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export to PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex overflow-x-auto w-full lg:grid lg:grid-cols-5">
          <TabsTrigger value="installed">
            <Truck className="h-4 w-4 mr-2" />
            Installed
          </TabsTrigger>
          <TabsTrigger value="holding-bay">
            <Package className="h-4 w-4 mr-2" />
            Holding Bay
          </TabsTrigger>
          <TabsTrigger value="retread-bay">
            <Wrench className="h-4 w-4 mr-2" />
            Retread Bay
          </TabsTrigger>
          <TabsTrigger value="scrap-sold">
            <Ban className="h-4 w-4 mr-2" />
            Scrap & Sold
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Movement History
          </TabsTrigger>
        </TabsList>

        {/* Installed Tyres Tab */}
        <TabsContent value="installed">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Installed Tyres</CardTitle>
                  <CardDescription>Tyres currently installed on vehicles</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="text-lg px-4 py-1.5 bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-sm shadow-green-500/30">
                    {installedTyres.length} Tyres
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {installedTyres.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="h-10 w-10 opacity-40" />
                    <p className="text-sm">No tyres currently installed.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-muted/80 to-muted/50 hover:from-muted/80 hover:to-muted/50 border-b-2 border-muted">
                          <TableHead className="min-w-[120px] py-3.5 font-semibold text-foreground/80">Serial Number</TableHead>
                          <TableHead className="min-w-[160px] py-3.5 font-semibold text-foreground/80">Brand / Model</TableHead>
                          <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Size</TableHead>
                          <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Type</TableHead>
                          <TableHead className="min-w-[120px] py-3.5 font-semibold text-foreground/80">Vehicle</TableHead>
                          <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80">Position</TableHead>
                          <TableHead className="min-w-[100px] py-3.5 font-semibold text-foreground/80 text-center sticky right-0 bg-gradient-to-r from-muted/80 to-muted/50">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {installedTyres.map((tyre, index) => {
                          const tyreWithVehicle = tyre as InstalledTyreWithVehicle;
                          return (
                            <TableRow
                              key={tyre.id}
                              className={`
                                ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                                transition-all duration-200 ease-in-out
                                hover:bg-primary/5 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary))]
                                group cursor-pointer
                              `}
                            >
                              <TableCell className="font-mono text-sm py-3.5 text-muted-foreground">
                                {tyre.serial_number || tyre.id.substring(0, 8)}
                              </TableCell>
                              <TableCell className="py-3.5">
                                <div className="flex flex-col">
                                  <span className="font-semibold group-hover:text-primary transition-colors">{tyre.brand}</span>
                                  <span className="text-xs text-muted-foreground">{tyre.model}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3.5">
                                <span className="inline-flex items-center px-2 py-1 bg-muted/50 rounded font-mono text-sm">
                                  {tyre.size}
                                </span>
                              </TableCell>
                              <TableCell className="py-3.5">
                                {getInstalledTypeBadge(tyre.type)}
                              </TableCell>
                              <TableCell className="py-3.5">
                                <div className="flex flex-col">
                                  <span className="font-semibold">{tyreWithVehicle.vehicles?.registration_number || '-'}</span>
                                  <span className="text-xs text-muted-foreground">Fleet: {tyreWithVehicle.vehicles?.fleet_number || '-'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3.5">
                                <span className="font-mono text-sm">{tyre.current_fleet_position || '-'}</span>
                              </TableCell>
                              <TableCell className="py-3.5 text-center sticky right-0 bg-inherit">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTyre(tyreWithVehicle);
                                      setViewDialogOpen(true);
                                    }}
                                    title="View tyre details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTyre(tyreWithVehicle);
                                      setEditInstalledDialogOpen(true);
                                    }}
                                    title="Edit tyre"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holding Bay Tab */}
        <TabsContent value="holding-bay">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Holding Bay</CardTitle>
                  <CardDescription>Tyres awaiting allocation or inspection</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={async () => {
                          await exportBayTyresToExcel(holdingBayTyres, "holding-bay");
                          toast({ title: "Exported", description: `${holdingBayTyres.length} tyres exported to Excel` });
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          exportBayTyresToPDF(holdingBayTyres, "holding-bay");
                          toast({ title: "Exported", description: `${holdingBayTyres.length} tyres exported to PDF` });
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={() => {
                      setAddBayType("holding-bay");
                      setAddBayTyreDialogOpen(true);
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tyre
                  </Button>
                  <Badge className="text-lg px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-sm shadow-blue-500/30">
                    {holdingBayTyres.length} Tyres
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderTyreTable(holdingBayTyres, "holding-bay")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retread Bay Tab */}
        <TabsContent value="retread-bay">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Retread Bay</CardTitle>
                  <CardDescription>Tyres sent for retreading</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={async () => {
                          await exportBayTyresToExcel(retreadBayTyres, "retread-bay");
                          toast({ title: "Exported", description: `${retreadBayTyres.length} tyres exported to Excel` });
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          exportBayTyresToPDF(retreadBayTyres, "retread-bay");
                          toast({ title: "Exported", description: `${retreadBayTyres.length} tyres exported to PDF` });
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={() => {
                      setAddBayType("retread-bay");
                      setAddBayTyreDialogOpen(true);
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tyre
                  </Button>
                  <Badge className="text-lg px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-sm shadow-orange-500/30">
                    {retreadBayTyres.length} Tyres
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderTyreTable(retreadBayTyres, "retread-bay")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scrap & Sold Tab */}
        <TabsContent value="scrap-sold">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scrap & Sold</CardTitle>
                  <CardDescription>Tyres marked for disposal or that have been sold</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={async () => {
                          await exportBayTyresToExcel(scrapAndSoldTyres, "scrap");
                          toast({ title: "Exported", description: `${scrapAndSoldTyres.length} tyres exported to Excel` });
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          exportBayTyresToPDF(scrapAndSoldTyres, "scrap");
                          toast({ title: "Exported", description: `${scrapAndSoldTyres.length} tyres exported to PDF` });
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Badge className="text-lg px-4 py-1.5 bg-gradient-to-r from-slate-600 to-gray-500 text-white shadow-sm shadow-slate-500/30">
                    {scrapAndSoldTyres.length} Tyres
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderScrapSoldTable(scrapAndSoldTyres)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movement History Tab */}
        <TabsContent value="history">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tyre Movement History</CardTitle>
                  <CardDescription>Recent tyre installations, removals, and rotations</CardDescription>
                </div>
                <Badge className="text-lg px-4 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm shadow-purple-500/30">
                  {positionHistory.length} Records
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="py-4 font-semibold">Date</TableHead>
                      <TableHead className="py-4 font-semibold">Action</TableHead>
                      <TableHead className="py-4 font-semibold">Tyre</TableHead>
                      <TableHead className="py-4 font-semibold">Vehicle</TableHead>
                      <TableHead className="py-4 font-semibold">Position</TableHead>
                      <TableHead className="py-4 font-semibold">KM Reading</TableHead>
                      <TableHead className="py-4 font-semibold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positionHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                          <div className="flex flex-col items-center gap-3">
                            <History className="h-12 w-12 opacity-30" />
                            <p className="text-sm font-medium">No movement history yet</p>
                            <p className="text-xs">Install or rotate tyres to see history</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      positionHistory.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="py-3">
                            <span className="text-sm">{new Date(record.performed_at).toLocaleDateString()}</span>
                            <span className="text-xs text-muted-foreground block">
                              {new Date(record.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              record.action === 'install' ? 'default' :
                                record.action === 'remove' ? 'destructive' :
                                  record.action === 'rotate' ? 'secondary' : 'outline'
                            }>
                              {record.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.tyres ? (
                              <div>
                                <span className="font-medium">{record.tyres.brand} {record.tyres.model}</span>
                                <span className="text-xs text-muted-foreground block">{record.tyres.serial_number}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.vehicles ? (
                              <div>
                                <span className="font-medium">{record.vehicles.fleet_number}</span>
                                <span className="text-xs text-muted-foreground block">{record.vehicles.registration_number}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.to_position ? (
                              <Badge variant="outline">{record.to_position}</Badge>
                            ) : record.fleet_position ? (
                              <Badge variant="outline">{record.fleet_position}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.km_reading ? `${record.km_reading.toLocaleString()} km` : '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddTyreDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={refetch}
      />

      <InstallTyreDialog
        open={installDialogOpen}
        onOpenChange={(open) => {
          setInstallDialogOpen(open);
          if (!open) {
            setSelectedInventoryItem(null);
          }
        }}
        preSelectedInventoryItem={selectedInventoryItem ? {
          id: selectedInventoryItem.id,
          brand: selectedInventoryItem.brand,
          model: selectedInventoryItem.model,
          size: selectedInventoryItem.size,
          type: selectedInventoryItem.type,
          quantity: selectedInventoryItem.quantity,
          initial_tread_depth: selectedInventoryItem.initialTreadDepth,
          pressure_rating: selectedInventoryItem.pressureRating,
          purchase_cost_zar: selectedInventoryItem.purchaseCostZar,
          purchase_cost_usd: selectedInventoryItem.purchaseCostUsd,
          location: selectedInventoryItem.location,
          status: selectedInventoryItem.status,
          dot_code: selectedInventoryItem.dotCode,
          min_quantity: selectedInventoryItem.minQuantity,
          supplier: selectedInventoryItem.supplier,
          vendor: null,
          unit_price: selectedInventoryItem.unitPrice,
          created_at: new Date().toISOString(),
          updated_at: null,
          warranty_km: 0,
          warranty_months: 0,
        } : null}
        onInstallationComplete={() => {
          refetch();
          refetchBays();
          refetchInstalled();
          setSelectedInventoryItem(null);
        }}
      />

      <RemoveTyreDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        tyre={selectedTyre}
        onRemovalComplete={() => {
          refetch();
          refetchBays();
          refetchInstalled();
          setSelectedTyre(null);
        }}
      />

      <TyreInventoryImportModal
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={refetch}
      />

      <BulkTyreInstallImportModal
        open={bulkInstallDialogOpen}
        onOpenChange={setBulkInstallDialogOpen}
        onImportComplete={() => {
          refetch();
          refetchBays();
          refetchInstalled();
        }}
      />

      <ViewTyreDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        tyre={selectedInventoryItem}
        onInstall={(tyre) => {
          setSelectedInventoryItem(tyre);
          setInstallDialogOpen(true);
        }}
        onEdit={(tyre) => {
          setSelectedInventoryItem(tyre);
          setEditDialogOpen(true);
        }}
      />

      <ViewInstalledTyreDialog
        open={viewDialogOpen && selectedTyre !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewDialogOpen(false);
            setSelectedTyre(null);
          }
        }}
        tyre={selectedTyre}
      />

      <EditTyreDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tyre={selectedInventoryItem}
        onUpdate={() => {
          refetch();
          setSelectedInventoryItem(null);
        }}
      />

      <EditInstalledTyreDialog
        open={editInstalledDialogOpen}
        onOpenChange={setEditInstalledDialogOpen}
        tyre={selectedTyre}
        onUpdate={() => {
          refetchInstalled();
          setSelectedTyre(null);
        }}
      />

      <AddBayTyreDialog
        open={addBayTyreDialogOpen}
        onOpenChange={setAddBayTyreDialogOpen}
        bayType={addBayType}
        onAdd={() => {
          refetchBays();
        }}
      />

      <EditBayTyreDialog
        open={editBayTyreDialogOpen}
        onOpenChange={setEditBayTyreDialogOpen}
        tyre={selectedBayTyre}
        onUpdate={() => {
          refetchBays();
          setSelectedBayTyre(null);
        }}
      />

      <InstallBayTyreToVehicleDialog
        open={installBayTyreToVehicleDialogOpen}
        onOpenChange={setInstallBayTyreToVehicleDialogOpen}
        tyre={selectedBayTyre}
        onInstallationComplete={() => {
          refetchBays();
          refetch();
          setSelectedBayTyre(null);
        }}
      />

      <MoveTyreToBayDialog
        open={moveTyreToBayDialogOpen}
        onOpenChange={setMoveTyreToBayDialogOpen}
        tyre={selectedBayTyre}
        onMoved={() => {
          refetchBays();
          setSelectedBayTyre(null);
        }}
      />
    </div>
  );
};

export default TyreInventory;