import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft, CheckCheck, MessageSquare, Send, Clock, AlertCircle,
  Truck, User, Wrench, Fuel, MapPin, Server, Package,
  DollarSign, ExternalLink,
} from "lucide-react";
import { useAlert, useAlertComments, useAddAlertComment } from "@/hooks/useAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { navigateToTrip } from "@/lib/crossAppNavigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  duplicate_pod: AlertCircle,
  load_exception: DollarSign,
  trip_delay: Clock,
  fuel_anomaly: Fuel,
};

export default function AlertDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState<{ fleet_number?: string } | null>(null);

  const { data: alert, isLoading } = useAlert(id);
  const { data: comments = [] } = useAlertComments(id);
  const addComment = useAddAlertComment();

  useEffect(() => {
    async function fetchVehicleDetails() {
      const vehicleId = alert?.metadata?.vehicle_id as string | undefined;
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
  }, [alert?.metadata]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading alert details...</p>
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Alert record could not be located.{" "}
        <Link to="/alerts" className="text-slate-700 hover:underline font-medium">Return to Alert Feed</Link>
      </div>
    );
  }

  const metadata = alert.metadata as {
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
  };

  const isTripAlert = ['duplicate_pod', 'load_exception', 'trip_delay', 'fuel_anomaly'].includes(alert.category);
  const SourceIcon = SOURCE_ICONS[isTripAlert ? alert.category : alert.source_type] ?? AlertCircle;

  const displayFleetNumber = vehicleDetails?.fleet_number || metadata.fleet_number || 'N/A';

  const handleComment = async () => {
    if (!commentText.trim() || !user) return;
    try {
      await addComment.mutateAsync({ alertId: alert.id, userId: user.id, comment: commentText.trim() });
      setCommentText("");
    } catch {
      toast.error("Failed to post comment.");
    }
  };

  const handleViewTrip = () => {
    if (metadata?.trip_id) {
      navigateToTrip(metadata.trip_id);
    }
  };

  const metaEntries = Object.entries(alert.metadata ?? {}).filter(
    ([key]) => !["trip_id", "trip_number", "fleet_number", "driver_name", "client_name", "issue_type", "vehicle_id"].includes(key)
  );

  return (
    <div className="h-full overflow-y-auto pb-10">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Navigation */}
        <Link
          to="/alerts"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Alerts
        </Link>

        {/* Primary Header Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <SourceIcon className="h-5 w-5 text-slate-600" strokeWidth={1.5} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm border",
                      "bg-slate-100 text-slate-700 border-slate-200"
                    )}>
                      {alert.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{alert.title}</h2>
                  {alert.source_label && (
                    <p className="text-sm font-medium text-slate-500">{alert.source_label}</p>
                  )}
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">{alert.message}</p>
                </div>
              </div>

              {/* Status indicator — alerts are resolved from the main app */}
              <div className="flex items-center gap-3 shrink-0">
                {alert.status === "active" && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" /> Pending Resolution
                  </span>
                )}
              </div>
            </div>

            {/* Timeline Row */}
            <div className="flex flex-wrap gap-6 text-[13px] text-slate-500 border-t border-slate-100 mt-6 pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-700">Triggered:</span>
                {format(new Date(alert.triggered_at), "MMM d, yyyy HH:mm")}
              </div>
              {alert.resolved_at && (
                <div className="flex items-center gap-2">
                  <CheckCheck className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-700">Resolved:</span>
                  {format(new Date(alert.resolved_at), "MMM d, yyyy HH:mm")}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trip Info Panel */}
            {isTripAlert && metadata?.trip_number && (
              <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-slate-500" />
                    Trip Context
                  </h3>
                  {metadata.trip_id && (
                    <button
                      onClick={handleViewTrip}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Full Trip
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Trip No.</p>
                    <p className="text-sm font-medium text-slate-900">{metadata.trip_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Fleet ID</p>
                    <p className="text-sm font-medium text-slate-900">{displayFleetNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Driver</p>
                    <p className="text-sm font-medium text-slate-900">{metadata.driver_name || "Unassigned"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Client</p>
                    <p className="text-sm font-medium text-slate-900">{metadata.client_name || "N/A"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* General Metadata Panel */}
            <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Alert Details</h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                <div className="space-y-1">
                  <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Category</dt>
                  <dd className="text-sm text-slate-900 font-medium capitalize">{alert.category.replace(/_/g, " ")}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Source Type</dt>
                  <dd className="text-sm text-slate-900 font-medium capitalize">{alert.source_type}</dd>
                </div>

                {metadata.duplicate_count !== undefined && (
                  <div className="space-y-1">
                    <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Duplicate Count</dt>
                    <dd className="text-sm font-medium text-slate-900">{metadata.duplicate_count}</dd>
                  </div>
                )}
                {metadata.days_in_progress !== undefined && (
                  <div className="space-y-1">
                    <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Days In Progress</dt>
                    <dd className="text-sm font-medium text-slate-900">{metadata.days_in_progress}</dd>
                  </div>
                )}
                {metadata.flagged_count !== undefined && (
                  <div className="space-y-1">
                    <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Flagged Costs</dt>
                    <dd className="text-sm font-medium text-slate-900">{metadata.flagged_count}</dd>
                  </div>
                )}

                {metaEntries.map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-sm text-slate-900 font-medium">{String(value)}</dd>
                  </div>
                ))}
              </div>

              {alert.resolution_note && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <dt className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Resolution Note</dt>
                  <dd className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-200">
                    {alert.resolution_note}
                  </dd>
                </div>
              )}
            </div>
          </div>

          {/* Activity Sidebar */}
          <div className="bg-white border border-slate-200 rounded-md shadow-sm flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Activity & Notes ({comments.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
                  <MessageSquare className="h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">No notes recorded.</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-700 uppercase">
                        {(comment.profile?.full_name ?? "U").charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className="text-[13px] font-semibold text-slate-900">
                          {comment.profile?.full_name ?? "System User"}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-200 mt-1">
                        {comment.comment}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="relative">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                  placeholder="Add a resolution note or comment..."
                  className="w-full bg-white border border-slate-200 rounded-md pl-3 pr-10 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all shadow-sm"
                />
                <button
                  onClick={handleComment}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-slate-800 text-white rounded block hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}