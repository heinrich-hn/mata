import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SurfsightEventMedia from "@/components/driver/SurfsightEventMedia";
import { isSurfsightUrl } from "@/hooks/useSurfsight";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  Pencil,
  Shield,
  User,
} from "lucide-react";

type DriverEvent = Database["public"]["Tables"]["driver_behavior_events"]["Row"];

interface DriverBehaviorDetailsDialogProps {
  event: DriverEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDebrief: () => void;
  onExportPDF: () => void;
  onEdit?: () => void;
}

const DriverBehaviorDetailsDialog = ({
  event,
  open,
  onOpenChange,
  onStartDebrief,
  onExportPDF,
  onEdit,
}: DriverBehaviorDetailsDialogProps) => {
  const isDebriefed = !!event.debriefed_at;

  const getSeverityConfig = (severity: string = "medium") => {
    const config = {
      low: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "text-blue-500" },
      medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "text-amber-500" },
      high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "text-orange-500" },
      critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "text-red-500" },
    };
    return config[severity as keyof typeof config] || config.medium;
  };

  const severity = getSeverityConfig(event.severity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-white flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${severity.bg} ${severity.border} border`}>
                <AlertTriangle className={`w-6 h-6 ${severity.icon}`} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Behavior Event Details
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-1">
                  Complete incident report and coaching status
                </DialogDescription>
              </div>
            </div>
            <Badge className={`${severity.bg} ${severity.text} border ${severity.border} font-semibold px-3 py-1`}>
              {event.severity || "medium"} severity
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Driver & Vehicle */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-full p-2">
                    <User className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{event.driver_name}</h3>
                    {event.fleet_number && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Car className="w-4 h-4" />
                        Fleet #{event.fleet_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-700">
                    {format(new Date(event.event_date), "MMM dd, yyyy")}
                  </span>
                </div>
                {event.event_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-700">{event.event_time}</span>
                  </div>
                )}
                {event.location && isSurfsightUrl(event.location) && (
                  <div className="md:col-span-3 mt-2">
                    <SurfsightEventMedia
                      location={event.location}
                      fleetNumber={event.fleet_number}
                      driverName={event.driver_name}
                      eventType={event.event_type}
                    />
                  </div>
                )}
                {event.location && !isSurfsightUrl(event.location) && (
                  <div className="flex items-center gap-2 md:col-span-3 text-sm text-muted-foreground">
                    <span>Location: {event.location}</span>
                  </div>
                )}
                {!event.location && (
                  <div className="flex items-center gap-2 md:col-span-3 text-sm text-muted-foreground">
                    <span>No event video URL — add one via Edit</span>
                  </div>
                )}
              </div>
            </div>

            {/* Event Type & Points */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">Event Type</p>
                <Badge variant="outline" className="text-base font-medium px-3 py-1">
                  {event.event_type}
                </Badge>
              </div>
              <div className="flex items-center gap-6">
                {event.risk_score != null && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Risk Score</p>
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-xl">
                      <Shield className="w-6 h-6" />
                      <span>{event.risk_score}/5</span>
                    </div>
                  </div>
                )}
                {event.points !== undefined && event.points !== null && event.points > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Points Assigned</p>
                    <div className="flex items-center gap-2 text-orange-600 font-bold text-xl">
                      <AlertCircle className="w-6 h-6" />
                      <span>{event.points}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Incident Description */}
            <div>
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800">
                <FileText className="w-5 h-5 text-gray-600" />
                Incident Description
              </h4>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {event.description || "No description provided."}
                </p>
              </div>
            </div>

            {/* Witness Information */}
            {(event.witness_name || event.witness_statement) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800">
                    <User className="w-5 h-5 text-gray-600" />
                    Witness Information
                  </h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                    {event.witness_name && (
                      <p className="text-sm">
                        <span className="font-medium text-gray-800">Name:</span>{" "}
                        <span className="text-gray-700">{event.witness_name}</span>
                      </p>
                    )}
                    {event.witness_statement && (
                      <div>
                        <p className="font-medium text-gray-800 mb-1">Statement:</p>
                        <p className="text-sm text-gray-700 bg-white rounded-md p-3 border border-amber-100">
                          {event.witness_statement}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Immediate Action */}
            {event.corrective_action_taken && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800">
                    <Shield className="w-5 h-5 text-green-600" />
                    Immediate Corrective Action
                  </h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-gray-700 leading-relaxed">
                      {event.corrective_action_taken}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Coaching Session */}
            {isDebriefed && (
              <>
                <Separator />
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-emerald-100 rounded-full p-2">
                      <CheckCircle className="w-6 h-6 text-emerald-700" />
                    </div>
                    <h4 className="font-bold text-xl text-emerald-900">
                      Coaching Session Completed
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">Date</p>
                      <p className="text-gray-700">
                        {format(new Date(event.debriefed_at), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                    {event.debrief_conducted_by && (
                      <div>
                        <p className="font-medium text-gray-800">Conducted By</p>
                        <p className="text-gray-700">{event.debrief_conducted_by}</p>
                      </div>
                    )}
                  </div>

                  {event.debrief_notes && (
                    <div className="mt-4">
                      <p className="font-medium text-gray-800 mb-1">Discussion Notes</p>
                      <div className="bg-white rounded-lg p-3 border border-emerald-100">
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {event.debrief_notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {event.coaching_action_plan && (
                    <div className="mt-4">
                      <p className="font-medium text-gray-800 mb-1">Action Plan</p>
                      <div className="bg-white rounded-lg p-3 border border-emerald-100">
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {event.coaching_action_plan}
                        </p>
                      </div>
                    </div>
                  )}

                  {event.driver_acknowledged && (
                    <div className="mt-4 flex items-center gap-2 text-emerald-700 font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Driver acknowledgment confirmed
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Current Status</p>
              <Badge
                variant={event.status === "resolved" ? "default" : "destructive"}
                className="font-semibold"
              >
                {event.status || "open"}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4">
              {!isDebriefed && (
                <Button
                  onClick={onStartDebrief}
                  className="flex-1 h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Start Coaching Session
                </Button>
              )}
              {onEdit && (
                <Button
                  onClick={onEdit}
                  variant="outline"
                  className="flex-1 h-12 text-base font-medium border-amber-300 text-amber-700 hover:bg-amber-50"
                  title={isDebriefed ? "Adjust points or risk score for this debriefed event" : "Edit event details"}
                >
                  <Pencil className="w-5 h-5 mr-2" />
                  {isDebriefed ? "Edit Points & Risk" : "Edit"}
                </Button>
              )}
              <Button
                onClick={onExportPDF}
                variant="secondary"
                className="flex-1 h-12 text-base font-medium hover:bg-gray-100"
              >
                <FileText className="w-5 h-5 mr-2" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-12 px-6 border-gray-300"
              >
                Close
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DriverBehaviorDetailsDialog;
