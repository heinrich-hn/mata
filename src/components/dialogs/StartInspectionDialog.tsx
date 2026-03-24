import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BreakdownPrefill {
  breakdownId: string;
  vehicleId?: string | null;
  vehicleRegistration?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  notes?: string;
}

interface StartInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInspectionCreated: (inspectionId: string) => void;
  breakdownPrefill?: BreakdownPrefill | null;
}

const StartInspectionDialog = ({ open, onOpenChange, onInspectionCreated, breakdownPrefill }: StartInspectionDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: undefined as string | undefined,
    vehicle_registration: "",
    vehicle_make: "",
    vehicle_model: "",
    inspector_id: undefined as string | undefined,
    inspector_name: "",
    template_id: undefined as string | undefined,
    inspection_type: "",
    odometer_reading: "",
    notes: "",
  });

  // Pre-fill from breakdown when dialog opens
  useEffect(() => {
    if (breakdownPrefill && open) {
      setFormData(prev => ({
        ...prev,
        vehicle_id: breakdownPrefill.vehicleId || undefined,
        vehicle_registration: breakdownPrefill.vehicleRegistration || "",
        vehicle_make: breakdownPrefill.vehicleMake || "",
        vehicle_model: breakdownPrefill.vehicleModel || "",
        notes: breakdownPrefill.notes || "",
      }));
    }
  }, [breakdownPrefill, open]);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, make, model, fleet_number")
        .order("registration_number");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: inspectors = [] } = useQuery({
    queryKey: ["inspector_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspector_profiles")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["inspection_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_templates")
        .select("id, name, template_code, description")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v.id === vehicleId) : null;
    if (vehicle) {
      setFormData({
        ...formData,
        vehicle_id: vehicleId,
        vehicle_registration: vehicle.registration_number,
        vehicle_make: vehicle.make || "",
        vehicle_model: vehicle.model || "",
      });
    }
  };

  const handleInspectorSelect = (inspectorId: string) => {
    const inspector = Array.isArray(inspectors) ? inspectors.find(i => i.id === inspectorId) : null;
    if (inspector) {
      setFormData({
        ...formData,
        inspector_id: inspectorId,
        inspector_name: inspector.name,
      });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = Array.isArray(templates) ? templates.find(t => t.id === templateId) : null;
    if (template) {
      setFormData({
        ...formData,
        template_id: templateId,
        inspection_type: template.name,
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.vehicle_id || !formData.inspector_name || !formData.template_id) {
      toast.error("Please fill in all required fields (Vehicle, Inspector, and Inspection Template)");
      return;
    }

    setLoading(true);
    try {
      const inspectionNumber = `INS-${Date.now()}`;
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .insert({
          inspection_number: inspectionNumber,
          inspection_type: formData.inspection_type || "routine",
          template_id: formData.template_id,
          inspection_date: new Date().toISOString().split('T')[0],
          vehicle_id: formData.vehicle_id,
          vehicle_registration: formData.vehicle_registration,
          vehicle_make: formData.vehicle_make,
          vehicle_model: formData.vehicle_model,
          inspector_name: formData.inspector_name,
          odometer_reading: formData.odometer_reading ? parseInt(formData.odometer_reading) : null,
          notes: formData.notes || null,
          status: "in_progress",
          ...(breakdownPrefill?.breakdownId ? { initiated_via: "breakdown" } : {}),
        })
        .select()
        .single();

      if (error) throw error;

      // If created from a breakdown, link the inspection back
      if (breakdownPrefill?.breakdownId) {
        const dbAny = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        await dbAny
          .from("fleet_breakdowns")
          .update({
            status: "scheduled_for_inspection",
            linked_inspection_id: data.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", breakdownPrefill.breakdownId);
      }

      toast.success("Inspection started successfully");
      onInspectionCreated(data.id);
      onOpenChange(false);

      // Reset form
      setFormData({
        vehicle_id: "",
        vehicle_registration: "",
        vehicle_make: "",
        vehicle_model: "",
        inspector_id: "",
        inspector_name: "",
        template_id: "",
        inspection_type: "",
        odometer_reading: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error starting inspection:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start inspection";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start New Inspection</DialogTitle>
          <DialogDescription>
            Fill in the details below to start a new vehicle inspection
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
            <Select value={formData.vehicle_id || undefined} onValueChange={handleVehicleSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(vehicles) && vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    <div className="flex items-center gap-2">
                      {vehicle.fleet_number && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {vehicle.fleet_number}
                        </Badge>
                      )}
                      <span className="font-medium">{vehicle.registration_number}</span>
                      <span className="text-muted-foreground text-sm">
                        {vehicle.make} {vehicle.model}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspector">Inspector *</Label>
            <Select value={formData.inspector_id || undefined} onValueChange={handleInspectorSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select inspector" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(inspectors) && inspectors.map((inspector) => (
                  <SelectItem key={inspector.id} value={inspector.id}>
                    {inspector.name} {inspector.email ? `(${inspector.email})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Inspection Template *</Label>
            <Select value={formData.template_id || undefined} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select inspection template" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(templates) && templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        - {template.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="odometer">Odometer Reading (km)</Label>
            <Input
              id="odometer"
              type="number"
              value={formData.odometer_reading}
              onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
              placeholder="Current odometer reading"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Initial Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any preliminary observations..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Starting..." : "Start Inspection"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StartInspectionDialog;