import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { generateTyreLifecyclePDF } from "@/lib/tyreInspectionPdfExport";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Clock,
  DollarSign,
  Download,
  Loader2,
  Package,
  RotateCcw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";

interface TyreLifecycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tyreCode: string | null;
  dotCode: string | null;
  position: string;
  positionLabel: string;
  vehicleOdometer?: number | null;
  vehicleRegistration?: string | null;
}

const TyreLifecycleDialog = ({
  open,
  onOpenChange,
  tyreCode,
  dotCode,
  position,
  positionLabel,
  vehicleOdometer,
  vehicleRegistration,
}: TyreLifecycleDialogProps) => {
  // Fetch lifecycle events and inspections for this tyre
  const { data: lifecycleData, isLoading } = useQuery({
    queryKey: ["tyre_lifecycle", tyreCode],
    queryFn: async () => {
      if (!tyreCode || tyreCode.startsWith("NEW_CODE_")) {
        return { tyre: null, events: [], inspections: [] };
      }

      // Fetch tyre info
      const { data: tyre, error: tyreError } = await supabase
        .from("tyres")
        .select("*")
        .eq("id", tyreCode)
        .single();

      if (tyreError) {
        console.error("Error fetching tyre:", tyreError);
        return { tyre: null, events: [], inspections: [] };
      }

      // Fetch lifecycle events
      const { data: events, error: eventsError } = await supabase
        .from("tyre_lifecycle_events")
        .select("*")
        .eq("tyre_id", tyreCode)
        .order("event_date", { ascending: false });

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
      }

      // Fetch tyre inspections
      const { data: inspections, error: inspError } = await supabase
        .from("tyre_inspections")
        .select("*")
        .eq("tyre_id", tyreCode)
        .order("inspection_date", { ascending: false });

      if (inspError) {
        console.error("Error fetching tyre inspections:", inspError);
      }

      return { tyre, events: events || [], inspections: inspections || [] };
    },
    enabled: open && !!tyreCode && !tyreCode.startsWith("NEW_CODE_"),
  });

  // Compute actual KM travelled
  const computedKmTravelled = (() => {
    const tyre = lifecycleData?.tyre;
    if (!tyre) return null;
    if (vehicleOdometer != null && tyre.installation_km != null && vehicleOdometer > tyre.installation_km) {
      return vehicleOdometer - tyre.installation_km;
    }
    return tyre.km_travelled ?? null;
  })();

  const handleExportPDF = () => {
    const tyre = lifecycleData?.tyre;
    if (!tyre || !tyreCode) return;

    generateTyreLifecyclePDF({
      tyreId: tyreCode,
      dotCode: tyre.dot_code || dotCode,
      serialNumber: tyre.serial_number,
      brand: tyre.brand,
      model: tyre.model,
      size: tyre.size,
      condition: tyre.condition,
      currentTreadDepth: tyre.current_tread_depth,
      initialTreadDepth: tyre.initial_tread_depth,
      installationDate: tyre.installation_date,
      installationKm: tyre.installation_km,
      kmTravelled: computedKmTravelled,
      purchaseCost: tyre.purchase_cost_zar,
      currentVehicle: vehicleRegistration || null,
      currentPosition: positionLabel,
      events: (lifecycleData?.events || []).map((e) => ({
        eventType: e.event_type,
        eventDate: e.event_date,
        notes: e.notes,
        metadata: e.metadata as Record<string, unknown> | null,
      })),
      inspections: (lifecycleData?.inspections || []).map((insp) => ({
        inspectionDate: insp.inspection_date || insp.created_at || '',
        position: insp.position || position,
        treadDepth: insp.tread_depth,
        pressure: insp.pressure,
        condition: insp.condition,
        wearPattern: insp.wear_pattern,
        inspectorName: insp.inspector_name,
        vehicleRegistration: vehicleRegistration || null,
      })),
    });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "installation":
        return <Package className="w-4 h-4" />;
      case "inspection":
        return <Search className="w-4 h-4" />;
      case "rotation":
        return <RotateCcw className="w-4 h-4" />;
      case "repair":
        return <Wrench className="w-4 h-4" />;
      case "removal":
        return <Trash2 className="w-4 h-4" />;
      case "retread":
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "installation":
        return "bg-green-100 text-green-800 border-green-200";
      case "inspection":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "rotation":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "repair":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "removal":
        return "bg-red-100 text-red-800 border-red-200";
      case "retread":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const noTyreAssigned = !tyreCode || tyreCode.startsWith("NEW_CODE_");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Tyre Lifecycle - {positionLabel}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">Position: {position}</Badge>
            {dotCode && <Badge variant="secondary">DOT: {dotCode}</Badge>}
            {lifecycleData?.tyre?.brand && (
              <Badge variant="outline">{lifecycleData.tyre.brand}</Badge>
            )}
            {lifecycleData?.tyre?.model && (
              <Badge variant="outline">{lifecycleData.tyre.model}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {noTyreAssigned ? (
          <div className="py-8 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Tyre Assigned</p>
            <p className="text-sm">
              This position does not have a tyre assigned yet.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Tyre Summary */}
            {lifecycleData?.tyre && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="font-medium">
                    {lifecycleData.tyre.brand || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="font-medium">
                    {lifecycleData.tyre.size || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Tread</p>
                  <p className="font-medium">
                    {lifecycleData.tyre.current_tread_depth
                      ? `${lifecycleData.tyre.current_tread_depth}mm`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Condition</p>
                  <Badge
                    variant={
                      lifecycleData.tyre.condition === "excellent" ||
                        lifecycleData.tyre.condition === "good"
                        ? "default"
                        : lifecycleData.tyre.condition === "fair"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {lifecycleData.tyre.condition || "Unknown"}
                  </Badge>
                </div>
                {lifecycleData.tyre.installation_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Installed</p>
                    <p className="font-medium">
                      {format(
                        new Date(lifecycleData.tyre.installation_date),
                        "dd MMM yyyy"
                      )}
                    </p>
                  </div>
                )}
                {computedKmTravelled !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">KM Travelled</p>
                    <p className="font-medium">
                      {computedKmTravelled.toLocaleString()} km
                    </p>
                  </div>
                )}
                {lifecycleData.tyre.purchase_cost_zar != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Price (USD)</p>
                    <p className="font-medium">
                      ${lifecycleData.tyre.purchase_cost_zar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Lifecycle Events */}
            <ScrollArea className="h-[300px] pr-4">
              {lifecycleData?.events && lifecycleData.events.length > 0 ? (
                <div className="space-y-4">
                  {lifecycleData.events.map((event) => (
                    <div
                      key={event.id}
                      className="relative pl-8 pb-4 border-l-2 border-muted last:border-l-0"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full flex items-center justify-center ${getEventColor(
                          event.event_type
                        )}`}
                      >
                        {getEventIcon(event.event_type)}
                      </div>

                      <div className="bg-card border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getEventColor(event.event_type)}>
                            {event.event_type.replace("_", " ").toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(event.event_date),
                              "dd MMM yyyy, HH:mm"
                            )}
                          </span>
                        </div>

                        {event.notes && (
                          <p className="text-sm text-muted-foreground">
                            {event.notes}
                          </p>
                        )}

                        {event.metadata && typeof event.metadata === "object" && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(
                              event.metadata as Record<string, unknown>
                            ).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">
                                  {key.replace(/([A-Z])/g, " $1").trim()}:
                                </span>{" "}
                                <span className="font-medium">
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No lifecycle events recorded yet</p>
                </div>
              )}
            </ScrollArea>

            {/* Tyre Inspections */}
            {lifecycleData?.inspections && lifecycleData.inspections.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Inspection History ({lifecycleData.inspections.length})</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Position</th>
                        <th className="px-3 py-2 text-center font-medium">Tread</th>
                        <th className="px-3 py-2 text-center font-medium">PSI</th>
                        <th className="px-3 py-2 text-left font-medium">Condition</th>
                        <th className="px-3 py-2 text-left font-medium">Inspector</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lifecycleData.inspections.map((insp) => (
                        <tr key={insp.id} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5">{insp.inspection_date ? format(new Date(insp.inspection_date), "dd MMM yyyy") : "-"}</td>
                          <td className="px-3 py-1.5">{insp.position || "-"}</td>
                          <td className="px-3 py-1.5 text-center">{insp.tread_depth != null ? `${insp.tread_depth} mm` : "-"}</td>
                          <td className="px-3 py-1.5 text-center">{insp.pressure != null ? insp.pressure : "-"}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {(insp.condition || "-").replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5">{insp.inspector_name || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PDF Export Button */}
            {lifecycleData?.tyre && (
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Lifecycle PDF
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TyreLifecycleDialog;