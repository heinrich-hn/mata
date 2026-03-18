import { useResolveAlert } from "@/hooks/useAlerts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  CheckCheck,
  ChevronDown, ChevronUp, Clock,
  DollarSign, ExternalLink,
  Fuel, MapPin,
  MessageSquare,
  Package,
  Server,
  Truck, User, Wrench
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import SeverityBadge from "./SeverityBadge";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  vehicle: Truck,
  driver: User,
  maintenance: Wrench,
  fuel: Fuel,
  geofence: MapPin,
  system: Server,
  load: Package,
  tyre: AlertCircle,
  trip: MapPin,
  manual: AlertCircle,
  // Trip alert categories
  duplicate_pod: AlertTriangle,
  load_exception: DollarSign,
  trip_delay: Clock,
  fuel_anomaly: Fuel,
};

/* Enhanced severity border colors with glow effects */
const SEVERITY_STYLES: Record<string, { border: string; glow?: string; bgIcon: string }> = {
  critical: {
    border: "border-l-destructive",
    glow: "severity-critical-glow",
    bgIcon: "bg-destructive/10",
  },
  high: {
    border: "border-l-severity-high",
    glow: "severity-high-glow",
    bgIcon: "bg-severity-high/10",
  },
  medium: {
    border: "border-l-severity-medium",
    bgIcon: "bg-severity-medium/10",
  },
  low: {
    border: "border-l-severity-low",
    bgIcon: "bg-severity-low/10",
  },
  info: {
    border: "border-l-severity-info",
    bgIcon: "bg-muted",
  },
};

interface AlertCardProps {
  alert: Alert;
}

interface TripMetadata {
  trip_id?: string;
  trip_number?: string;
  fleet_number?: string;
  driver_name?: string;
  client_name?: string;
  issue_type?: string;
  duplicate_count?: number;
  flagged_count?: number;
  days_in_progress?: number;
  payment_status?: string;
  vehicle_id?: string;
  [key: string]: unknown;
}

export default function AlertCard({ alert }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const resolve = useResolveAlert();
  const [vehicleDetails, setVehicleDetails] = useState<{ fleet_number?: string } | null>(null);

  // Cast metadata to access trip-specific fields
  const metadata = alert.metadata as TripMetadata;

  // Fetch real vehicle data if available
  useEffect(() => {
    async function fetchVehicleDetails() {
      const vehicleId = metadata?.vehicle_id;
      if (vehicleId) {
        const { data } = await supabase
          .from('vehicles')
          .select('fleet_number')
          .eq('id', vehicleId)
          .single();

        if (data) {
          setVehicleDetails(data);
        }
      }
    }
    fetchVehicleDetails();
  }, [metadata?.vehicle_id]);

  const isTripAlert = ['duplicate_pod', 'load_exception', 'trip_delay', 'fuel_anomaly'].includes(alert.category);
  const SourceIcon = SOURCE_ICONS[isTripAlert ? alert.category : alert.source_type] ?? AlertCircle;
  const isActive = alert.status === "active";

  // Use real fleet number if available, otherwise fall back to metadata
  const displayFleetNumber = vehicleDetails?.fleet_number || metadata?.fleet_number;

  const handleResolve = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await resolve.mutateAsync({ alertId: alert.id });
      toast.success("Alert resolved");
    } catch {
      toast.error("Failed to resolve alert");
    }
  };

  const handleViewTrip = (e: React.MouseEvent) => {
    e.preventDefault();
    if (metadata?.trip_id) {
      window.open(`/trips/${metadata.trip_id}`, '_blank');
    }
  };

  const metaKeys = Object.keys(alert.metadata ?? {}).filter(
    (k) => !["lat", "lng", "trip_id", "trip_number", "fleet_number", "driver_name", "client_name", "issue_type", "vehicle_id"].includes(k)
  );

  return (
    <div
      className={cn(
        "bg-card border border-border border-l-[3px] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-card hover-lift",
        SEVERITY_STYLES[alert.severity]?.border ?? "border-l-severity-info",
        SEVERITY_STYLES[alert.severity]?.glow,
        alert.severity === "critical" && isActive && "critical-pulse"
      )}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Source icon - colored by severity */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200",
            SEVERITY_STYLES[alert.severity]?.bgIcon ?? "bg-muted",
            "border border-border"
          )}>
            <SourceIcon className={cn(
              "h-5 w-5",
              alert.severity === "critical" && "text-destructive",
              alert.severity === "high" && "text-severity-high",
              alert.severity === "medium" && "text-severity-medium",
              alert.severity === "low" && "text-severity-low",
              alert.severity === "info" && "text-muted-foreground"
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <SeverityBadge severity={alert.severity} dot />
              {alert.status !== "active" && alert.status === "resolved" && (
                <span className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide">
                  RESOLVED
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto flex-shrink-0 tabular-nums" title={format(new Date(alert.triggered_at), "PPpp")}>
                {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
              </span>
            </div>

            <p className="text-sm font-semibold text-foreground leading-snug">{alert.title}</p>

            {alert.source_label && (
              <p className="text-xs text-primary font-medium mt-1">{alert.source_label}</p>
            )}

            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{alert.message}</p>

            {/* Trip-specific summary - visible even when collapsed */}
            {isTripAlert && metadata?.trip_number && (
              <div className="flex items-center gap-2 mt-2.5 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                <span className="font-medium">{metadata.trip_number}</span>
                {displayFleetNumber && (
                  <>
                    <span className="text-border">|</span>
                    <span>{displayFleetNumber}</span>
                  </>
                )}
                {metadata.issue_type === 'duplicate_pod' && metadata.duplicate_count && (
                  <span className="text-severity-high font-medium">
                    ({metadata.duplicate_count} duplicates)
                  </span>
                )}
                {metadata.issue_type === 'long_running' && metadata.days_in_progress && (
                  <span className="text-severity-high font-medium">
                    ({metadata.days_in_progress} days)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expanded metadata */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border">
            {/* Trip-specific details section */}
            {isTripAlert && metadata && (
              <div className="mb-3 space-y-2 bg-secondary/50 p-3 rounded-md border border-border">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Trip Details</h4>

                {metadata.trip_number && (
                  <div className="flex items-center gap-2 text-xs">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{metadata.trip_number}</span>
                    {metadata.trip_id && (
                      <button
                        onClick={handleViewTrip}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors font-medium"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </button>
                    )}
                  </div>
                )}

                {displayFleetNumber && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    <span>Fleet: {displayFleetNumber}</span>
                  </div>
                )}

                {metadata.driver_name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Driver: {metadata.driver_name}</span>
                  </div>
                )}

                {metadata.client_name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Client: {metadata.client_name}</span>
                  </div>
                )}

                {/* Issue-specific badges */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {metadata.issue_type === 'duplicate_pod' && metadata.duplicate_count && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-severity-high/10 text-severity-high px-2 py-1 rounded border border-severity-high/20">
                      <AlertTriangle className="h-3 w-3" />
                      {metadata.duplicate_count} duplicate{metadata.duplicate_count > 1 ? 's' : ''}
                    </span>
                  )}

                  {metadata.issue_type === 'long_running' && metadata.days_in_progress && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-severity-high/10 text-severity-high px-2 py-1 rounded border border-severity-high/20">
                      <Clock className="h-3 w-3" />
                      {metadata.days_in_progress} days in progress
                    </span>
                  )}

                  {metadata.issue_type === 'flagged_costs' && metadata.flagged_count && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-destructive/10 text-destructive px-2 py-1 rounded border border-destructive/20">
                      <Fuel className="h-3 w-3" />
                      {metadata.flagged_count} flagged cost{metadata.flagged_count > 1 ? 's' : ''}
                    </span>
                  )}

                  {metadata.issue_type === 'payment_status' && metadata.payment_status && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-severity-low/10 text-severity-low px-2 py-1 rounded border border-severity-low/20">
                      <DollarSign className="h-3 w-3" />
                      Payment: {metadata.payment_status}
                    </span>
                  )}

                  {metadata.issue_type === 'missing_revenue' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-severity-medium/10 text-severity-medium px-2 py-1 rounded border border-severity-medium/20">
                      <DollarSign className="h-3 w-3" />
                      Missing Revenue
                    </span>
                  )}

                  {metadata.issue_type === 'no_costs' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-destructive/10 text-destructive px-2 py-1 rounded border border-destructive/20">
                      <AlertCircle className="h-3 w-3" />
                      No Costs
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Regular metadata grid */}
            {metaKeys.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {metaKeys.map((key) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs text-foreground">{String(alert.metadata?.[key])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          {isActive && (
            <button
              onClick={handleResolve}
              disabled={resolve.isPending}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 font-medium border border-emerald-500/20 dark:text-emerald-400"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Resolve
            </button>
          )}
          <Link
            to={`/alerts/${alert.id}`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors font-medium border border-border"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Details
          </Link>

          {(metaKeys.length > 0 || isTripAlert) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {expanded
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}