import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Gauge, ArrowLeft, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface LocationState {
  vehicleData: {
    id: string;
    fleet_number: string;
    registration_number: string;
    make: string;
    model: string;
  };
  inspectorId: string;
  inspectorName: string;
  scannedVehicleData: {
    fleetNumber: string;
    registration: string;
    fullCode: string;
  } | null;
  odometerReading: number | null;
}

const InspectionTypeSelector = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const [isCreating, setIsCreating] = useState(false);

  if (!state?.vehicleData || !state?.inspectorId) {
    navigate("/inspections/mobile");
    return null;
  }

  const { vehicleData, inspectorId, inspectorName, scannedVehicleData } = state;

  const handleTyreInspection = () => {
    navigate("/inspections/tyre", {
      state: {
        vehicleData,
        inspectorId,
        inspectorName,
        scannedVehicleData,
        initiatedVia: "mobile_app",
        odometerReading: state.odometerReading || null,
      },
    });
  };

  const handleRoutineInspection = async () => {
    setIsCreating(true);

    try {
      // Step 1: Get the routine inspection template
      const { data: template, error: templateError } = await supabase
        .from("inspection_templates")
        .select("id, name")
        .eq("is_active", true)
        .or('name.ilike.%routine%,name.ilike.%vehicle%')
        .limit(1)
        .single();

      if (templateError || !template) {
        console.error("Template error:", templateError);
        toast.error("Routine inspection template not found");
        setIsCreating(false);
        return;
      }

      // Step 2: Create the inspection
      const { data: newInspection, error: inspectionError } = await supabase
        .from("inspections")
        .insert({
          vehicle_id: vehicleData.id,
          inspector_id: inspectorId,
          template_id: template.id,
          status: "in_progress",
          inspection_date: new Date().toISOString(),
          initiated_via: "mobile_app",
        })
        .select()
        .single();

      if (inspectionError || !newInspection) {
        console.error("Inspection creation error:", inspectionError);
        toast.error("Failed to create inspection");
        setIsCreating(false);
        return;
      }

      toast.success(`${template.name} started!`);

      // Step 3: Navigate to the inspection details page
      navigate(`/inspections/${newInspection.id}`, {
        state: {
          vehicleData,
          inspectorId,
          inspectorName,
          scannedVehicleData,
          initiatedVia: "mobile_app",
          odometerReading: state.odometerReading || null,
        },
      });

    } catch (error) {
      console.error("Error creating routine inspection:", error);
      toast.error("An unexpected error occurred");
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b shadow-sm">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/inspections/mobile")}
            disabled={isCreating}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Select Inspection Type</h1>
            <p className="text-sm text-muted-foreground">Choose the type of inspection to perform</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Vehicle Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Fleet Number</span>
                <span className="font-bold">{vehicleData.fleet_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Registration</span>
                <span className="font-semibold">{vehicleData.registration_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Vehicle</span>
                <span className="text-sm">{vehicleData.make} {vehicleData.model}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inspector Badge */}
        <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Inspector: {inspectorName}</span>
          <Badge variant="outline" className="ml-2">Selected</Badge>
        </div>

        {/* Inspection Type Options */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choose Inspection Type</h2>

          {/* Tyre Inspection */}
          <Card
            className={`cursor-pointer hover:border-primary hover:shadow-md transition-all ${isCreating ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={handleTyreInspection}
          >
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Gauge className="h-8 w-8 text-orange-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Tyre Inspection</CardTitle>
                  <CardDescription className="mt-2">
                    Complete tyre-specific checks including tread depth, pressure, and condition assessment for each position
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" size="lg" disabled={isCreating}>
                <Gauge className="h-5 w-5 mr-2" />
                Start Tyre Inspection
              </Button>
            </CardContent>
          </Card>

          {/* Routine Vehicle Inspection */}
          <Card
            className={`cursor-pointer hover:border-primary hover:shadow-md transition-all ${isCreating ? 'opacity-50' : ''}`}
            onClick={!isCreating ? handleRoutineInspection : undefined}
          >
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <ClipboardCheck className="h-8 w-8 text-blue-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Routine Vehicle Inspection</CardTitle>
                  <CardDescription className="mt-2">
                    Comprehensive vehicle inspection covering braking, chassis, electrical, and cargo systems
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-blue-500 hover:bg-blue-600"
                size="lg"
                disabled={isCreating}
              >
                <ClipboardCheck className="h-5 w-5 mr-2" />
                {isCreating ? "Creating Inspection..." : "Start Routine Inspection"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Help Text */}
        <Card className="bg-muted/50 border-muted">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Select the inspection type that matches your current task. Both inspections will be saved with the scanned vehicle details.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InspectionTypeSelector;