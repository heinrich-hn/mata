import { Badge } from "@/components/ui/badge";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import
  {
    Clock,
    DollarSign,
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
}

const TyreLifecycleDialog = ({
  open,
  onOpenChange,
  tyreCode,
  dotCode,
  position,
  positionLabel,
}: TyreLifecycleDialogProps) => {
  // Fetch lifecycle events for this tyre
  const { data: lifecycleData, isLoading } = useQuery({
    queryKey: ["tyre_lifecycle", tyreCode],
    queryFn: async () => {
      if (!tyreCode || tyreCode.startsWith("NEW_CODE_")) {
        return { tyre: null, events: [] };
      }

      // Fetch tyre info
      const { data: tyre, error: tyreError } = await supabase
        .from("tyres")
        .select("*")
        .eq("id", tyreCode)
        .single();

      if (tyreError) {
        console.error("Error fetching tyre:", tyreError);
        return { tyre: null, events: [] };
      }

      // Fetch lifecycle events
      const { data: events, error: eventsError } = await supabase
        .from("tyre_lifecycle_events")
        .select("*")
        .eq("tyre_id", tyreCode)
        .order("event_date", { ascending: false });

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
        return { tyre, events: [] };
      }

      return { tyre, events: events || [] };
    },
    enabled: open && !!tyreCode && !tyreCode.startsWith("NEW_CODE_"),
  });

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
                {lifecycleData.tyre.km_travelled !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">KM Travelled</p>
                    <p className="font-medium">
                      {lifecycleData.tyre.km_travelled?.toLocaleString()} km
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TyreLifecycleDialog;