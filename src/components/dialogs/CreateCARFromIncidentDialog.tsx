// src/components/dialogs/CreateCARFromIncidentDialog.tsx
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Incident } from "@/hooks/useIncidents";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface CreateCARFromIncidentDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CARFormData {
  report_number: string;
  driver_name: string;
  fleet_number: string;
  incident_date: string;
  incident_time: string;
  incident_location: string;
  incident_type: string;
  severity: string;
  description: string;
  immediate_action_taken: string;
  root_cause_analysis: string;
  corrective_actions: string;
  preventive_measures: string;
  responsible_person: string;
  target_completion_date: string;
  reference_event_id: string;
}

const severityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function CreateCARFromIncidentDialog({
  incident,
  open,
  onOpenChange,
}: CreateCARFromIncidentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateCARNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CAR-${year}${month}-${random}`;
  };

  const [formData, setFormData] = useState<CARFormData>({
    report_number: "",
    driver_name: "",
    fleet_number: "",
    incident_date: "",
    incident_time: "",
    incident_location: "",
    incident_type: "",
    severity: "medium",
    description: "",
    immediate_action_taken: "",
    root_cause_analysis: "",
    corrective_actions: "",
    preventive_measures: "",
    responsible_person: "",
    target_completion_date: "",
    reference_event_id: "",
  });

  // Pre-populate form when incident changes
  useEffect(() => {
    if (incident && open) {
      const driverName = incident.drivers
        ? `${incident.drivers.first_name} ${incident.drivers.last_name}`
        : incident.driver_name || "Unknown";

      const fleetNumber = incident.vehicles?.fleet_number || "";

      // Map incident severity to CAR severity
      let severity = "medium";
      if (incident.severity_rating) {
        if (incident.severity_rating >= 8) severity = "critical";
        else if (incident.severity_rating >= 6) severity = "high";
        else if (incident.severity_rating >= 4) severity = "medium";
        else severity = "low";
      }

      setFormData({
        report_number: generateCARNumber(),
        driver_name: driverName,
        fleet_number: fleetNumber,
        incident_date: incident.incident_date,
        incident_time: incident.incident_time || "",
        incident_location: incident.location || "",
        incident_type: incident.incident_type.replace(/_/g, " "),
        severity,
        description: incident.description || "",
        immediate_action_taken: "",
        root_cause_analysis: "",
        corrective_actions: "",
        preventive_measures: "",
        responsible_person: "",
        target_completion_date: "",
        reference_event_id: incident.id,
      });
    }
  }, [incident, open]);

  const createMutation = useMutation({
    mutationFn: async (data: CARFormData) => {
      const { error } = await supabase
        .from('car_reports')
        .insert([{
          report_number: data.report_number,
          driver_name: data.driver_name,
          fleet_number: data.fleet_number || null,
          incident_date: data.incident_date,
          incident_time: data.incident_time || null,
          incident_location: data.incident_location || null,
          incident_type: data.incident_type,
          severity: data.severity,
          description: data.description,
          immediate_action_taken: data.immediate_action_taken || null,
          root_cause_analysis: data.root_cause_analysis || null,
          corrective_actions: data.corrective_actions || null,
          preventive_measures: data.preventive_measures || null,
          responsible_person: data.responsible_person || null,
          target_completion_date: data.target_completion_date || null,
          reference_event_id: data.reference_event_id || null,
          status: "open",
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car_reports'] });
      toast({
        title: "CAR Report Created",
        description: `Report ${formData.report_number} has been created from incident ${incident?.incident_number}`,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof CARFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.report_number || !formData.driver_name || !formData.incident_date || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Create CAR Report from Incident
          </DialogTitle>
          <DialogDescription>
            Create a Corrective Action Request (CAR) report based on incident{" "}
            <Badge variant="outline">{incident.incident_number}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report_number">CAR Report Number *</Label>
              <Input
                id="report_number"
                value={formData.report_number}
                onChange={(e) => handleInputChange('report_number', e.target.value)}
                placeholder="CAR-YYYYMM-XXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={formData.severity}
                onValueChange={(v) => handleInputChange('severity', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Incident Details (Pre-filled) */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Incident Details (from {incident.incident_number})</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driver_name">Driver Name *</Label>
                <Input
                  id="driver_name"
                  value={formData.driver_name}
                  onChange={(e) => handleInputChange('driver_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fleet_number">Fleet Number</Label>
                <Input
                  id="fleet_number"
                  value={formData.fleet_number}
                  onChange={(e) => handleInputChange('fleet_number', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incident_date">Incident Date *</Label>
                <DatePicker
                  id="incident_date"
                  value={formData.incident_date}
                  onChange={(date) => handleInputChange('incident_date', date ? date.toISOString().split('T')[0] : '')}
                  placeholder="Select incident date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident_time">Incident Time</Label>
                <Input
                  id="incident_time"
                  type="time"
                  value={formData.incident_time}
                  onChange={(e) => handleInputChange('incident_time', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident_type">Incident Type *</Label>
                <Input
                  id="incident_type"
                  value={formData.incident_type}
                  onChange={(e) => handleInputChange('incident_type', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident_location">Location</Label>
              <Input
                id="incident_location"
                value={formData.incident_location}
                onChange={(e) => handleInputChange('incident_location', e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Detailed description of the incident..."
            />
          </div>

          {/* Immediate Action */}
          <div className="space-y-2">
            <Label htmlFor="immediate_action_taken">Immediate Action Taken</Label>
            <Textarea
              id="immediate_action_taken"
              rows={2}
              value={formData.immediate_action_taken}
              onChange={(e) => handleInputChange('immediate_action_taken', e.target.value)}
              placeholder="What immediate actions were taken to address the issue?"
            />
          </div>

          {/* Root Cause Analysis */}
          <div className="space-y-2">
            <Label htmlFor="root_cause_analysis">Root Cause Analysis</Label>
            <Textarea
              id="root_cause_analysis"
              rows={3}
              value={formData.root_cause_analysis}
              onChange={(e) => handleInputChange('root_cause_analysis', e.target.value)}
              placeholder="What was the root cause of this incident?"
            />
          </div>

          {/* Corrective Actions */}
          <div className="space-y-2">
            <Label htmlFor="corrective_actions">Corrective Actions</Label>
            <Textarea
              id="corrective_actions"
              rows={3}
              value={formData.corrective_actions}
              onChange={(e) => handleInputChange('corrective_actions', e.target.value)}
              placeholder="What corrective actions will be taken?"
            />
          </div>

          {/* Preventive Measures */}
          <div className="space-y-2">
            <Label htmlFor="preventive_measures">Preventive Measures</Label>
            <Textarea
              id="preventive_measures"
              rows={2}
              value={formData.preventive_measures}
              onChange={(e) => handleInputChange('preventive_measures', e.target.value)}
              placeholder="What measures will prevent recurrence?"
            />
          </div>

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsible_person">Responsible Person</Label>
              <Input
                id="responsible_person"
                value={formData.responsible_person}
                onChange={(e) => handleInputChange('responsible_person', e.target.value)}
                placeholder="Who is responsible for follow-up?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_completion_date">Target Completion Date</Label>
              <DatePicker
                id="target_completion_date"
                value={formData.target_completion_date}
                onChange={(date) => handleInputChange('target_completion_date', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select target date"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Create CAR Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}