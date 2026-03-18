// src/components/driver/DriverCoachingModal.tsx
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDriverCoaching } from "@/hooks/useDriverCoaching";
import type { Database } from "@/integrations/supabase/types";
import { generateDriverCoachingPDF } from "@/lib/driverBehaviorExport";
import { format } from "date-fns";
import
  {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    FileText,
    MapPin,
    PenTool,
    Save,
    User,
  } from "lucide-react";
import { useState } from "react";

type DriverEvent = Database["public"]["Tables"]["driver_behavior_events"]["Row"];
type CoachingInsert = Database["public"]["Tables"]["driver_behavior_events"]["Update"];

interface DriverCoachingModalProps {
  event: DriverEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export default function DriverCoachingModal({
  event,
  open,
  onOpenChange,
  onComplete,
}: DriverCoachingModalProps) {
  const { toast } = useToast();
  const { saveCoachingSession, isLoading } = useDriverCoaching();

  const [conductedBy, setConductedBy] = useState("");
  const [coachingNotes, setCoachingNotes] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [driverAcknowledged, setDriverAcknowledged] = useState(false);
  const [driverSignature, setDriverSignature] = useState("");
  const [debrieferSignature, setDebrieferSignature] = useState("");
  const [witnessSignature, setWitnessSignature] = useState("");

  const handleSave = async (exportPdf = false) => {
    if (!conductedBy.trim()) {
      toast({ title: "Missing Field", description: "Who conducted the session?", variant: "destructive" });
      return;
    }
    if (!coachingNotes.trim()) {
      toast({ title: "Missing Notes", description: "Add coaching discussion notes", variant: "destructive" });
      return;
    }
    if (!driverAcknowledged) {
      toast({ title: "Acknowledgment Required", description: "Driver must acknowledge", variant: "destructive" });
      return;
    }

    const coachingData: CoachingInsert = {
      debrief_date: format(new Date(), "yyyy-MM-dd"),
      debrief_conducted_by: conductedBy,
      debrief_notes: coachingNotes,
      coaching_action_plan: actionPlan,
      driver_acknowledged: driverAcknowledged,
      driver_signature: driverSignature || null,
      debriefer_signature: debrieferSignature || null,
      witness_signature: witnessSignature || null,
      debriefed_at: new Date().toISOString(),
      status: "resolved",
    };

    try {
      await saveCoachingSession(event.id, coachingData);
      toast({ title: "Saved", description: "Coaching session recorded" });

      if (exportPdf) {
        const updated = { ...event, ...coachingData };
        generateDriverCoachingPDF(updated);
      }

      onComplete();
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
  };

  const getSeverityConfig = (severity: string = "medium") => {
    const cfg = {
      low: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "text-blue-500" },
      medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "text-amber-500" },
      high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "text-orange-500" },
      critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "text-red-500" },
    };
    return cfg[severity as keyof typeof cfg] ?? cfg.medium;
  };

  const sev = getSeverityConfig(event.severity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            Driver Coaching Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Event Summary Card */}
          <div className={`rounded-xl p-5 border-2 ${sev.bg} ${sev.border} bg-opacity-50`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${sev.icon}`} />
                Event Summary
              </h3>
              <Badge className={`${sev.bg} ${sev.text} border ${sev.border} font-medium`}>
                {event.severity || "medium"}
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-gray-900">{event.driver_name}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  {format(new Date(event.event_date), "MMM dd, yyyy")}
                </div>
                {event.event_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    {event.event_time}
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 md:col-span-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    {event.location}
                  </div>
                )}
              </div>

              <div className="bg-white/70 rounded-lg p-3 space-y-2 backdrop-blur-sm">
                <p className="font-medium text-gray-800">Event Type</p>
                <p className="text-gray-600">{event.event_type}</p>
              </div>

              <div className="bg-white/70 rounded-lg p-3 space-y-2 backdrop-blur-sm">
                <p className="font-medium text-gray-800">Description</p>
                <p className="text-gray-600 leading-relaxed">{event.description}</p>
              </div>
            </div>
          </div>

          {/* Coaching Form */}
          <div className="space-y-5">
            <div>
              <Label htmlFor="conductedBy" className="text-base font-medium text-gray-800">
                Conducted By <span className="text-red-500">*</span>
              </Label>
              <Input
                id="conductedBy"
                placeholder="Enter name of coach/debriefer"
                value={conductedBy}
                onChange={(e) => setConductedBy(e.target.value)}
                className="mt-1.5 h-11 text-base"
              />
            </div>

            <div>
              <Label htmlFor="coachingNotes" className="text-base font-medium text-gray-800">
                Coaching Discussion Notes <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="coachingNotes"
                placeholder="Document discussion, driver response, and key points..."
                value={coachingNotes}
                onChange={(e) => setCoachingNotes(e.target.value)}
                rows={5}
                className="mt-1.5 resize-none text-base"
              />
            </div>

            <div>
              <Label htmlFor="actionPlan" className="text-base font-medium text-gray-800">
                Corrective Action Plan
              </Label>
              <Textarea
                id="actionPlan"
                placeholder="Outline agreed actions to prevent recurrence..."
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                rows={3}
                className="mt-1.5 resize-none text-base"
              />
            </div>
          </div>

          {/* Acknowledgment & Signatures */}
          <div className="border-t pt-6 space-y-5">
            <h4 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Acknowledgment & Signatures
            </h4>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <Checkbox
                id="driverAck"
                checked={driverAcknowledged}
                onCheckedChange={(c) => setDriverAcknowledged(c as boolean)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="driverAck" className="font-medium text-gray-800 cursor-pointer">
                  Driver Acknowledgment <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  I acknowledge participation in this coaching session and understand the required corrective actions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverSig" className="text-sm font-medium text-gray-700">
                  Driver Signature
                </Label>
                <div className="relative">
                  <PenTool className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="driverSig"
                    placeholder="Type full name"
                    value={driverSignature}
                    onChange={(e) => setDriverSignature(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="debrieferSig" className="text-sm font-medium text-gray-700">
                  Debriefer Signature
                </Label>
                <div className="relative">
                  <PenTool className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="debrieferSig"
                    placeholder="Type full name"
                    value={debrieferSignature}
                    onChange={(e) => setDebrieferSignature(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="witnessSig" className="text-sm font-medium text-gray-700">
                  Witness (Optional)
                </Label>
                <div className="relative">
                  <PenTool className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="witnessSig"
                    placeholder="Type full name"
                    value={witnessSignature}
                    onChange={(e) => setWitnessSignature(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t">
            <Button
              onClick={() => handleSave(false)}
              disabled={isLoading}
              variant="outline"
              className="flex-1 h-12 text-base font-medium border-gray-300 hover:bg-gray-50"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Session
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isLoading}
              className="flex-1 h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="w-5 h-5 mr-2" />
              Save & Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
