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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateTyreInspectionPDF } from "@/lib/tyreInspectionPdfExport";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, MoreVertical, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Inspection {
  id: string;
  inspection_number: string;
  inspection_date: string;
  vehicle_id: string | null;
  vehicle_registration: string | null;
  inspector_name: string | null;
  odometer_reading: number | null;
  has_fault: boolean | null;
  status: string | null;
  notes: string | null;
}

interface Vehicle {
  id: string;
  fleet_number: string | null;
  registration_number: string | null;
  current_odometer: number | null;
}

interface QuickActionButtonProps {
  label: string;
  description?: string;
  onClick: () => void;
  variant?: "default" | "outline";
}

const QuickActionButton = ({ label, description, onClick }: QuickActionButtonProps) => (
  <Button
    variant="outline"
    className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl border-2 hover:bg-accent active:scale-[0.97] transition-all w-full group"
    onClick={onClick}
  >
    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
      <span className="text-lg font-bold text-primary">+</span>
    </div>
    <div className="text-center">
      <span className="text-sm font-semibold block">{label}</span>
      {description && (
        <span className="text-[10px] text-muted-foreground">{description}</span>
      )}
    </div>
  </Button>
);

const InspectionCardSkeleton = () => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

const MobileTyresTab = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Inspection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Recent tyre inspections
  const { data: recentInspections = [], isLoading: inspectionsLoading } = useQuery<Inspection[]>({
    queryKey: ["tyre-inspections-recent-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("id, inspection_number, inspection_date, vehicle_id, vehicle_registration, inspector_name, odometer_reading, has_fault, status, notes")
        .eq("inspection_type", "tyre")
        .order("inspection_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Vehicles lookup
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["vehicles-lookup-tyres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number, current_odometer");
      if (error) throw error;
      return data || [];
    },
  });

  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  const handleExportPDF = async (insp: Inspection) => {
    try {
      // Fetch inspection items for this tyre inspection
      const { data: items } = await supabase
        .from("inspection_items")
        .select("item_name, category, status, notes")
        .eq("inspection_id", insp.id)
        .eq("category", "tyre");

      const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;
      const fleetNumber = vehicle?.fleet_number || null;
      const registrationNo = vehicle?.registration_number || insp.vehicle_registration || "-";

      // Fetch real tyre data from fleet_tyre_positions + tyres for enrichment
      const tyreDataMap = new Map<string, {
        serial_number: string | null;
        dot_code: string | null;
        km_travelled: number | null;
        installation_km: number | null;
        initial_tread_depth: number | null;
        current_tread_depth: number | null;
        purchase_cost_zar: number | null;
        brand: string | null;
        size: string | null;
      }>();

      if (fleetNumber && registrationNo !== "-") {
        // Extract registration number (strip fleet prefix if present)
        const regParts = registrationNo.split('-');
        const regNo = regParts.length > 1 ? regParts.slice(1).join('-') : registrationNo;

        const { data: fpData } = await supabase
          .from("fleet_tyre_positions")
          .select("position, tyre_code")
          .eq("fleet_number", fleetNumber)
          .eq("registration_no", regNo);

        const tyreCodes = (fpData || [])
          .map(fp => fp.tyre_code)
          .filter((code): code is string => code != null && code.trim() !== '' && !code.startsWith('NEW_CODE_'));

        if (tyreCodes.length > 0) {
          const { data: tyresData } = await supabase
            .from("tyres")
            .select("id, serial_number, dot_code, km_travelled, installation_km, initial_tread_depth, current_tread_depth, purchase_cost_zar, brand, size, inventory_id")
            .in("id", tyreCodes);

          // Fetch DOT codes from inventory as fallback
          const inventoryIds = (tyresData || []).map(t => t.inventory_id).filter((id): id is string => id != null);
          const dotCodeLookup = new Map<string, string | null>();
          if (inventoryIds.length > 0) {
            const { data: invData } = await supabase.from("tyre_inventory").select("id, dot_code").in("id", inventoryIds);
            (invData || []).forEach(inv => dotCodeLookup.set(inv.id, inv.dot_code));
          }

          // Map tyre codes to positions
          (fpData || []).forEach(fp => {
            if (fp.tyre_code) {
              const tyre = (tyresData || []).find(t => t.id === fp.tyre_code);
              if (tyre) {
                const dotCode = tyre.dot_code || (tyre.inventory_id ? dotCodeLookup.get(tyre.inventory_id) || null : null);
                tyreDataMap.set(fp.position, {
                  serial_number: tyre.serial_number,
                  dot_code: dotCode,
                  km_travelled: tyre.km_travelled,
                  installation_km: tyre.installation_km,
                  initial_tread_depth: tyre.initial_tread_depth,
                  current_tread_depth: tyre.current_tread_depth,
                  purchase_cost_zar: tyre.purchase_cost_zar,
                  brand: tyre.brand,
                  size: tyre.size,
                });
              }
            }
          });
        }
      }

      const positions = (items || []).map((item) => {
        const notesParts: Record<string, string> = {};
        (item.notes || "").split(" | ").forEach((part) => {
          const [key, ...rest] = part.split(": ");
          if (key && rest.length) notesParts[key.trim()] = rest.join(": ").trim();
        });

        // Try to find matching tyre data by position label pattern or index
        const posLabel = item.item_name?.replace("Tyre - ", "") || "-";
        // Match by common position label patterns (e.g., "V1", "1L - Front Left Steer")
        const posCode = posLabel.split(' - ')[0]?.trim() || posLabel;
        const tyreData = tyreDataMap.get(posCode);

        // Parse existing notes fields with fallback to tyre database data
        const serial = notesParts["Serial"] || tyreData?.serial_number || "";
        const dotCode = notesParts["DOT"] || tyreData?.dot_code || serial || "";
        const kmTravelled = (() => {
          // Compute actual KM travelled = odometer - installation odometer
          // Priority: 1) KM from inspection notes, 2) inspection odometer, 3) vehicle current_odometer
          const inspOdometer = notesParts["KM"] ? parseInt(notesParts["KM"]) : (insp.odometer_reading ?? null);
          const vehicleOdometer = vehicle?.current_odometer ?? null;
          const bestOdometer = (inspOdometer != null && inspOdometer > 0) ? inspOdometer : vehicleOdometer;
          const installKm = tyreData?.installation_km ?? null;
          if (bestOdometer != null && installKm != null && bestOdometer > installKm) {
            return bestOdometer - installKm;
          }
          // Fallback to DB value
          return tyreData?.km_travelled ?? null;
        })();
        const initialTread = notesParts["InitialTread"] ? parseFloat(notesParts["InitialTread"]) : (tyreData?.initial_tread_depth ?? null);
        const currentTreadStr = notesParts["Tread"]?.replace("mm", "").trim() || "";
        const currentTread = currentTreadStr ? parseFloat(currentTreadStr) : (tyreData?.current_tread_depth ?? null);
        const purchaseCost = tyreData?.purchase_cost_zar ?? null;

        const treadWorn = (initialTread != null && currentTread != null && initialTread > currentTread)
          ? initialTread - currentTread : null;
        const wearRate = (treadWorn != null && treadWorn > 0 && kmTravelled != null && kmTravelled > 0)
          ? treadWorn / (kmTravelled / 1000) : null;
        const costPerMm = (treadWorn != null && treadWorn > 0 && purchaseCost != null && purchaseCost > 0)
          ? purchaseCost / treadWorn : null;

        return {
          position: posCode,
          positionLabel: posLabel,
          brand: notesParts["Brand"] || tyreData?.brand || "",
          size: notesParts["Size"] || tyreData?.size || "",
          dotCode,
          treadDepth: currentTreadStr || (currentTread != null ? currentTread.toString() : ""),
          pressure: notesParts["Pressure"]?.replace(" PSI", "") || "",
          condition: notesParts["Condition"] || "",
          wearPattern: notesParts["Wear"] || "",
          kmTravelled,
          installationKm: tyreData?.installation_km ?? null,
          purchaseCost: purchaseCost,
          initialTreadDepth: initialTread,
          treadWorn,
          wearRate,
          costPerMm,
          notes: item.notes || "",
        };
      });

      // Sort positions in canonical order: V1, V2, ... V10, SP/Spare last
      const positionOrder = (code: string): number => {
        if (code === 'SP' || code === 'SPARE') return 9999;
        const match = code.match(/^V?(\d+)/i);
        return match ? parseInt(match[1], 10) : 5000;
      };
      positions.sort((a, b) => positionOrder(a.position) - positionOrder(b.position));

      // Fetch inspection history for this vehicle
      const inspHistoryEntries = [];
      if (insp.vehicle_id) {
        const { data: inspHistoryData } = await supabase
          .from("vehicle_inspections")
          .select("inspection_number, inspection_date, inspector_name, inspection_type, odometer_reading, status, has_fault")
          .eq("vehicle_id", insp.vehicle_id)
          .order("inspection_date", { ascending: false })
          .limit(20);

        for (const h of inspHistoryData || []) {
          inspHistoryEntries.push({
            inspectionNumber: h.inspection_number,
            inspectionDate: h.inspection_date,
            inspectorName: h.inspector_name,
            inspectionType: h.inspection_type,
            odometerReading: h.odometer_reading,
            status: h.status,
            hasFault: h.has_fault || false,
          });
        }
      }

      // Use the best available odometer: prefer inspection reading, fallback to vehicle current_odometer
      const bestOdometerForReport = (() => {
        const inspOdo = insp.odometer_reading;
        const vehOdo = vehicle?.current_odometer ?? null;
        // If inspection odometer exists and is reasonable, use it
        if (inspOdo != null && inspOdo > 0) {
          // But if vehicle odometer is significantly higher, note it
          if (vehOdo != null && vehOdo > inspOdo) {
            return vehOdo; // Use the higher (more current) odometer
          }
          return inspOdo;
        }
        return vehOdo;
      })();

      generateTyreInspectionPDF({
        inspectionNumber: insp.inspection_number,
        inspectionDate: insp.inspection_date,
        vehicleRegistration: insp.vehicle_registration || vehicle?.registration_number || "-",
        fleetNumber: vehicle?.fleet_number || null,
        inspectorName: insp.inspector_name || "-",
        odometerReading: bestOdometerForReport,
        status: insp.status || "completed",
        hasFault: insp.has_fault || false,
        positions,
        inspectionHistory: inspHistoryEntries,
      });

      toast({ title: "PDF exported", description: "Tyre inspection report downloaded" });
    } catch {
      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
    }
  };

  const handleDelete = async (insp: Inspection) => {
    setIsDeleting(true);
    try {
      // 1. Get inspection items and their linked tyre codes
      const { data: items } = await supabase
        .from("inspection_items")
        .select("id, item_name, notes")
        .eq("inspection_id", insp.id);

      const itemIds = (items || []).map((i) => i.id);

      // 2. Delete vehicle_faults promoted from this inspection's faults
      if (itemIds.length > 0) {
        const { data: faults } = await supabase
          .from("inspection_faults")
          .select("id")
          .in("inspection_item_id", itemIds);

        const faultIds = (faults || []).map((f) => f.id);
        if (faultIds.length > 0) {
          await supabase.from("vehicle_faults").delete().in("inspection_fault_id", faultIds);
        }
        await supabase.from("inspection_faults").delete().in("inspection_item_id", itemIds);
        await supabase.from("inspection_items").delete().eq("inspection_id", insp.id);
      }

      // 3. Delete tyre_inspections for this vehicle on this date
      const inspDate = insp.inspection_date?.split("T")[0] || "";
      if (insp.vehicle_id && inspDate) {
        await supabase
          .from("tyre_inspections")
          .delete()
          .eq("vehicle_id", insp.vehicle_id)
          .eq("inspection_date", inspDate);
      }

      // 4. Delete tyre_lifecycle_events created by this inspection
      // These are matched by vehicle_id + event_date on the same day + event_type 'inspection'
      if (insp.vehicle_id && inspDate) {
        await supabase
          .from("tyre_lifecycle_events")
          .delete()
          .eq("vehicle_id", insp.vehicle_id)
          .eq("event_type", "inspection")
          .gte("event_date", `${inspDate}T00:00:00`)
          .lte("event_date", `${inspDate}T23:59:59`);
      }

      // 5. Revert tyres table: restore last_inspection_date from previous inspection, clear current values
      if (insp.vehicle_id) {
        // Find which tyre IDs were inspected by looking up fleet positions for this vehicle
        const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;
        const fleetNumber = vehicle?.fleet_number;
        const regNo = vehicle?.registration_number;

        if (fleetNumber && regNo) {
          const { data: fpData } = await supabase
            .from("fleet_tyre_positions")
            .select("tyre_code")
            .eq("fleet_number", fleetNumber)
            .eq("registration_no", regNo);

          const tyreIds = (fpData || [])
            .map((fp) => fp.tyre_code)
            .filter((code): code is string => code != null && code.trim() !== "" && !code.startsWith("NEW_CODE_"));

          if (tyreIds.length > 0) {
            // For each tyre, find the most recent remaining lifecycle event to restore from
            for (const tyreId of tyreIds) {
              const { data: prevEvent } = await supabase
                .from("tyre_lifecycle_events")
                .select("event_date, tread_depth_at_event, km_reading")
                .eq("tyre_id", tyreId)
                .eq("event_type", "inspection")
                .order("event_date", { ascending: false })
                .limit(1)
                .single();

              if (prevEvent) {
                // Restore from previous inspection event
                const updates: Record<string, unknown> = {
                  last_inspection_date: new Date(prevEvent.event_date).toISOString().split("T")[0],
                };
                if (prevEvent.tread_depth_at_event != null) {
                  updates.current_tread_depth = prevEvent.tread_depth_at_event;
                }
                await supabase.from("tyres").update(updates).eq("id", tyreId);
              } else {
                // No previous inspection — clear the inspection-set fields
                await supabase
                  .from("tyres")
                  .update({ last_inspection_date: null })
                  .eq("id", tyreId);
              }
            }
          }
        }
      }

      // 6. Delete the main inspection record
      const { error } = await supabase
        .from("vehicle_inspections")
        .delete()
        .eq("id", insp.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["tyre-inspections-recent-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle_inspections"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_inspections"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_lifecycle"] });
      queryClient.invalidateQueries({ queryKey: ["fleet_tyre_positions"] });
      queryClient.invalidateQueries({ queryKey: ["tyres"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      toast({ title: "Deleted", description: "Inspection and all related data have been removed" });
    } catch {
      toast({ title: "Error", description: "Failed to delete inspection", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleShare = async (insp: Inspection) => {
    const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;
    const text = [
      `Tyre Inspection: ${insp.inspection_number}`,
      `Vehicle: ${vehicle?.fleet_number || vehicle?.registration_number || "-"}`,
      `Date: ${new Date(insp.inspection_date).toLocaleDateString("en-GB")}`,
      `Inspector: ${insp.inspector_name || "-"}`,
      `Status: ${insp.has_fault ? "Faults found" : "Passed"}`,
    ].join("\n");

    if (navigator.share) {
      await navigator.share({ title: "Tyre Inspection Report", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Inspection details copied to clipboard" });
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 pb-safe-bottom">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickActionButton
          label="Tyre Inspection"
          description="Record new inspection"
          onClick={() => navigate("/inspections/tyre")}
        />
        <QuickActionButton
          label="Vehicle Store"
          description="Manage positions"
          onClick={() => navigate("/tyre-management")}
        />
      </div>

      {/* Recent Tyre Inspections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Inspections
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate("/inspections?type=tyre")}
          >
            View all
          </Button>
        </div>

        {inspectionsLoading ? (
          <div className="space-y-2">
            <InspectionCardSkeleton />
            <InspectionCardSkeleton />
            <InspectionCardSkeleton />
          </div>
        ) : recentInspections.length === 0 ? (
          <Card className="rounded-2xl shadow-sm border border-border/40 bg-muted/30">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/60 mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground">0</span>
              </div>
              <h3 className="font-bold mb-1">No inspections yet</h3>
              <p className="text-sm text-muted-foreground">
                Start recording tyre inspections
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentInspections.map((insp) => {
              const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;

              return (
                <Card
                  key={insp.id}
                  className="active:scale-[0.98] transition-transform cursor-pointer rounded-2xl shadow-sm border border-border/40 hover:shadow-md"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => navigate(`/inspections/${insp.id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            {insp.inspection_number}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(insp.inspection_date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {vehicle && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 font-medium text-xs">
                              {vehicle.fleet_number || vehicle.registration_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {insp.has_fault ? (
                          <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-lg font-semibold">
                            Fault Found
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] px-2 py-0.5 rounded-lg font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
                            Passed
                          </Badge>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/inspections/${insp.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShare(insp)}>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExportPDF(insp)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(insp)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspection</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inspection{" "}
              <span className="font-semibold">{deleteTarget?.inspection_number}</span>{" "}
              and all associated records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MobileTyresTab;