import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Calendar, Gauge, MapPin, Ruler, Tag, Truck } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type TyreRow = Database["public"]["Tables"]["tyres"]["Row"];

type InstalledTyre = TyreRow & {
    vehicles?: {
        id: string;
        registration_number: string;
        fleet_number: string;
        current_odometer: number | null;
    } | null;
};

interface ViewInstalledTyreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tyre: InstalledTyre | null;
}

const ViewInstalledTyreDialog = ({ open, onOpenChange, tyre }: ViewInstalledTyreDialogProps) => {
    if (!tyre) return null;

    const getTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            steer: "bg-primary text-primary-foreground",
            Steer: "bg-primary text-primary-foreground",
            drive: "bg-accent text-accent-foreground",
            Drive: "bg-accent text-accent-foreground",
            trailer: "bg-secondary text-secondary-foreground",
            Trailer: "bg-secondary text-secondary-foreground",
        };
        return <Badge className={colors[type] || "bg-muted"}>{type}</Badge>;
    };

    const getHealthBadge = (health: string | null) => {
        if (!health) return <span className="text-muted-foreground">-</span>;
        const variants: Record<string, string> = {
            excellent: "bg-green-100 text-green-800 border-green-200",
            good: "bg-blue-100 text-blue-800 border-blue-200",
            warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
            critical: "bg-red-100 text-red-800 border-red-200",
        };
        return <Badge className={variants[health] || "bg-muted"} variant="outline">{health}</Badge>;
    };

    const getConditionBadge = (condition: string | null) => {
        if (!condition) return <span className="text-muted-foreground">-</span>;
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            excellent: "default",
            good: "secondary",
            fair: "outline",
            poor: "destructive",
            needs_replacement: "destructive",
        };
        return (
            <Badge variant={variants[condition] || "outline"} className="capitalize">
                {condition.replace(/_/g, " ")}
            </Badge>
        );
    };

    const formatDate = (date: string | null) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="h-5 w-5" />
                        {tyre.brand} {tyre.model}
                    </DialogTitle>
                    <DialogDescription>
                        {tyre.serial_number ? `Serial: ${tyre.serial_number}` : "Tyre details"}
                        {tyre.dot_code ? ` • DOT: ${tyre.dot_code}` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Basic Information */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                            <div>
                                <p className="text-sm text-muted-foreground">Brand</p>
                                <p className="font-medium">{tyre.brand}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Model</p>
                                <p className="font-medium">{tyre.model}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Serial Number</p>
                                <p className="font-mono font-medium">{tyre.serial_number || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">DOT Code</p>
                                <p className="font-mono font-medium">{tyre.dot_code || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Type</p>
                                <div className="mt-0.5">{getTypeBadge(tyre.type)}</div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Condition</p>
                                <div className="mt-0.5">{getConditionBadge(tyre.condition)}</div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Technical Specifications */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Gauge className="h-4 w-4" />
                            Tread & Health
                        </h3>
                        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                            <div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Ruler className="h-3.5 w-3.5" />
                                    Size
                                </p>
                                <p className="font-mono font-medium text-lg">{tyre.size}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Initial Tread Depth</p>
                                <p className="font-mono font-medium text-lg">
                                    {tyre.initial_tread_depth != null ? `${tyre.initial_tread_depth}mm` : "-"}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Current Tread Depth</p>
                                <p className="font-mono font-medium text-lg">
                                    {tyre.current_tread_depth != null ? `${tyre.current_tread_depth}mm` : "-"}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Tread Health</p>
                                <div className="mt-0.5">{getHealthBadge(tyre.tread_depth_health)}</div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pressure Health</p>
                                <div className="mt-0.5">{getHealthBadge(tyre.pressure_health)}</div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">KM Travelled</p>
                                <p className="font-mono font-medium">
                                    {tyre.km_travelled != null ? `${tyre.km_travelled.toLocaleString()} km` : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Position & Vehicle */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Position & Vehicle
                        </h3>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                            <div>
                                <p className="text-sm text-muted-foreground">Position</p>
                                <p className="font-medium">{tyre.position || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Fleet Position</p>
                                <p className="font-medium">{tyre.current_fleet_position || "-"}</p>
                            </div>
                            {tyre.vehicles && (
                                <>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vehicle Registration</p>
                                        <p className="font-medium">{tyre.vehicles.registration_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Fleet Number</p>
                                        <p className="font-medium">{tyre.vehicles.fleet_number}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Dates */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Dates
                        </h3>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                            <div>
                                <p className="text-sm text-muted-foreground">Installation Date</p>
                                <p className="font-medium">{formatDate(tyre.installation_date)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Purchase Date</p>
                                <p className="font-medium">{formatDate(tyre.purchase_date)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Last Inspection</p>
                                <p className="font-medium">{formatDate(tyre.last_inspection_date)}</p>
                            </div>
                            {tyre.removal_date && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Removal Date</p>
                                    <p className="font-medium">{formatDate(tyre.removal_date)}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    {tyre.notes && (
                        <>
                            <Separator />
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
                                <p className="text-sm p-4 bg-muted/30 rounded-lg whitespace-pre-wrap">{tyre.notes}</p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ViewInstalledTyreDialog;
