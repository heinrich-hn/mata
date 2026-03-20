import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Gauge, ClipboardCheck, FileText, Loader2 } from "lucide-react";
import InspectorProfileSelector from "./InspectorProfileSelector";
import { getFleetConfig } from "@/constants/fleetTyreConfig";
import { toast } from "@/hooks/use-toast";

const MobileInspectionStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [inspectionType, setInspectionType] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [notes, setNotes] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [inspectorName, setInspectorName] = useState("");

  // Fetch all active vehicles for dropdown
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-inspection-start"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, make, model, fleet_number")
        .eq("active", true)
        .order("fleet_number");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active inspection templates
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

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;

  // Parse URL parameters for deep link support
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const vehicleParam = searchParams.get('vehicle');

    if (vehicleParam && !selectedVehicleId) {
      const match = vehicles.find(v => v.registration_number === vehicleParam);
      if (match) {
        setSelectedVehicleId(match.id);
        toast({
          title: "Vehicle Loaded",
          description: `${vehicleParam} loaded from URL`,
        });
      }
    }
  }, [location.search, selectedVehicleId, vehicles]);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setOdometerReading("");
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setInspectionType(template.name);
    }
  };

  const handleStartInspection = async () => {
    if (!selectedVehicle || !inspectorName || !selectedTemplateId) {
      toast({
        title: "Missing Information",
        description: "Please select a vehicle, inspector, and inspection template",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const inspectionNumber = `INS-${Date.now()}`;
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .insert({
          inspection_number: inspectionNumber,
          inspection_type: inspectionType || "routine",
          template_id: selectedTemplateId,
          inspection_date: new Date().toISOString().split('T')[0],
          vehicle_id: selectedVehicle.id,
          vehicle_registration: selectedVehicle.registration_number,
          vehicle_make: selectedVehicle.make || null,
          vehicle_model: selectedVehicle.model || null,
          inspector_name: inspectorName,
          inspector_profile_id: inspectorId || null,
          odometer_reading: odometerReading ? parseInt(odometerReading) : null,
          notes: notes || null,
          status: "in_progress",
          initiated_via: "mobile_app",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Inspection Started",
        description: `${inspectionType || "Inspection"} created successfully`,
      });

      // Navigate to the inspection details page
      navigate(`/inspections/${data.id}`);
    } catch (error) {
      console.error("Error starting inspection:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start inspection";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fleetConfig = selectedVehicle
    ? getFleetConfig(selectedVehicle.registration_number)
    : null;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 safe-area-top">
        <div className="text-center space-y-1 py-4 px-4">
          <h1 className="text-2xl font-bold">New Vehicle Inspection</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the details below to start an inspection
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Step 1: Select Vehicle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Step 1: Select Vehicle *
            </CardTitle>
            <CardDescription>Choose a fleet vehicle from the list</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedVehicleId || undefined} onValueChange={handleVehicleSelect}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select a vehicle..." />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
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
          </CardContent>
        </Card>

        {/* Selected Vehicle Info */}
        {selectedVehicle && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Registration:</span>
                <span className="font-semibold">{selectedVehicle.registration_number}</span>
              </div>
              {selectedVehicle.fleet_number && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fleet:</span>
                  <Badge variant="secondary">{selectedVehicle.fleet_number}</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vehicle:</span>
                <span className="font-medium">{selectedVehicle.make} {selectedVehicle.model}</span>
              </div>
              {fleetConfig && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tyre Positions:</span>
                  <Badge variant="outline">{fleetConfig.positions.length} tyres</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Inspector */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select Inspector *</CardTitle>
            <CardDescription>Who is conducting this inspection?</CardDescription>
          </CardHeader>
          <CardContent>
            <InspectorProfileSelector
              value={inspectorId}
              onChange={(id: string, name: string) => {
                setInspectorId(id);
                setInspectorName(name);
              }}
            />
          </CardContent>
        </Card>

        {/* Step 3: Select Inspection Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Step 3: Inspection Template *
            </CardTitle>
            <CardDescription>Choose the type of inspection to perform</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTemplateId || undefined} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select inspection template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">
                          {template.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 4: Odometer / KM Reading */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Step 4: Current KM
            </CardTitle>
            <CardDescription>Enter the vehicle's current odometer reading</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer Reading (km)</Label>
              <Input
                id="odometer"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 125000"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Step 5: Initial Notes
            </CardTitle>
            <CardDescription>Any preliminary observations (optional)</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any preliminary observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-base"
            />
          </CardContent>
        </Card>

        {/* Start Inspection Button - Sticky at bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border/50 z-10 safe-area-bottom">
          <Button
            onClick={handleStartInspection}
            disabled={!selectedVehicle || !inspectorName || !selectedTemplateId || loading}
            className="w-full h-14 text-lg"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Inspection"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileInspectionStart;