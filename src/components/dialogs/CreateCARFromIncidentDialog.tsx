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
import { DriverSelect } from "@/components/ui/driver-select";
import { InspectorSelect } from "@/components/ui/inspector-select";
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
import { VehicleSelect } from "@/components/ui/vehicle-select";
import { useToast } from "@/hooks/use-toast";
import type { Incident } from "@/hooks/useIncidents";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  vehicle_id: string;
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
  actual_completion_date: string;
  status: string;
  reference_event_id: string;
}

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

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
    vehicle_id: "",
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
    actual_completion_date: "",
    status: "open",
    reference_event_id: "",
  });

  // Look up an existing CAR report linked to this incident
  const { data: existingReport, isLoading: loadingExisting } = useQuery({
    queryKey: ["car_report_for_incident", incident?.id],
    enabled: !!incident?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("car_reports")
        .select("*")
        .eq("reference_event_id", incident!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isEditMode = !!existingReport;

  // Pre-populate form: from existing CAR report if one exists, otherwise from incident
  useEffect(() => {
    if (!open || !incident) return;

    if (existingReport) {
      setFormData({
        report_number: existingReport.report_number || "",
        driver_name: existingReport.driver_name || "",
        fleet_number: existingReport.fleet_number || "",
        vehicle_id: incident.vehicle_id || "",
        incident_date: existingReport.incident_date || incident.incident_date,
        incident_time: existingReport.incident_time || "",
        incident_location: existingReport.incident_location || "",
        incident_type: existingReport.incident_type || "",
        severity: existingReport.severity || "medium",
        description: existingReport.description || "",
        immediate_action_taken: existingReport.immediate_action_taken || "",
        root_cause_analysis: existingReport.root_cause_analysis || "",
        corrective_actions: existingReport.corrective_actions || "",
        preventive_measures: existingReport.preventive_measures || "",
        responsible_person: existingReport.responsible_person || "",
        target_completion_date: existingReport.target_completion_date || "",
        actual_completion_date: existingReport.actual_completion_date || "",
        status: existingReport.status || "open",
        reference_event_id: existingReport.reference_event_id || incident.id,
      });
      return;
    }

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
      vehicle_id: incident.vehicle_id || "",
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
      actual_completion_date: "",
      status: "open",
      reference_event_id: incident.id,
    });
  }, [incident, open, existingReport]);

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
          actual_completion_date: data.actual_completion_date || null,
          reference_event_id: data.reference_event_id || null,
          status: data.status || "open",
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car_reports'] });
      queryClient.invalidateQueries({ queryKey: ['car_report_for_incident', incident?.id] });
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

  const updateMutation = useMutation({
    mutationFn: async (data: CARFormData) => {
      if (!existingReport) throw new Error("No existing report to update");
      const { error } = await supabase
        .from('car_reports')
        .update({
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
          actual_completion_date: data.actual_completion_date || null,
          status: data.status || "open",
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReport.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car_reports'] });
      queryClient.invalidateQueries({ queryKey: ['car_report_for_incident', incident?.id] });
      toast({
        title: "CAR Report Updated",
        description: `Report ${formData.report_number} has been updated.`,
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
    if (isEditMode) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {isEditMode ? "View / Edit CAR Report" : "Create CAR Report from Incident"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the" : "Create a"} Corrective Action Request (CAR) report linked to incident{" "}
            <Badge variant="outline">{incident.incident_number}</Badge>
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading existing CAR report…
          </div>
        ) : (
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
                  <Label>Driver Name *</Label>
                  <DriverSelect
                    value={formData.driver_name || undefined}
                    onValueChange={(value) => handleInputChange('driver_name', value)}
                    placeholder="Select driver"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fleet Number / Vehicle</Label>
                  <VehicleSelect
                    value={formData.vehicle_id || undefined}
                    onValueChange={(vehicleId) =>
                      handleInputChange('vehicle_id', vehicleId)
                    }
                    onVehicleChange={(vehicle) => {
                      if (vehicle) {
                        handleInputChange('fleet_number', vehicle.fleet_number || '');
                      }
                    }}
                    placeholder="Select vehicle"
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
                <Label>Responsible Person</Label>
                <InspectorSelect
                  value={formData.responsible_person || undefined}
                  onValueChange={(value) => handleInputChange('responsible_person', value)}
                  placeholder="Select responsible person"
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

            {/* Status & Actual completion */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="car_status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleInputChange('status', v)}
                >
                  <SelectTrigger id="car_status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual_completion_date">Actual Completion Date</Label>
                <DatePicker
                  id="actual_completion_date"
                  value={formData.actual_completion_date}
                  onChange={(date) => handleInputChange('actual_completion_date', date ? date.toISOString().split('T')[0] : '')}
                  placeholder="Select actual completion date"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending || loadingExisting}>
            {(createMutation.isPending || updateMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {isEditMode ? "Update CAR Report" : "Create CAR Report"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}