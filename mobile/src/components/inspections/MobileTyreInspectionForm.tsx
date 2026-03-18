import PositionQRScanner, { ScanResult } from "@/components/tyres/PositionQRScanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFleetConfig } from "@/constants/fleetTyreConfig";
import { toast } from "@/hooks/use-toast";
import { updateFleetTyrePosition, useFleetTyrePositions } from "@/hooks/useFleetTyrePositions";
import { usePromoteToVehicleFault } from "@/hooks/usePromoteToVehicleFault";
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, Search, Truck, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type TyreCondition = "excellent" | "good" | "fair" | "poor" | "needs_replacement";

// TypeScript interface for vehicle inspection record
interface VehicleInspectionRecord {
  vehicle_id: string;
  inspector_profile_id: string | null;
  inspector_name: string;
  inspection_date: string;
  inspection_type: 'tyre';
  inspection_number: string;
  initiated_via: string;
  scanned_vehicle_qr: string | null;
  vehicle_registration: string;
  notes: string;
  odometer_reading?: number | null;
}

interface TyreData {
  position: string;
  positionLabel: string;
  brand: string;
  size: string;
  treadDepth: string;
  pressure: string;
  condition: TyreCondition;
  wearPattern: string;
  notes: string;
  tyreCode?: string;
  /** DOT code from the tyre inventory */
  dotCode?: string;
  /** Model of the tyre */
  model?: string;
  /** Type of the tyre (e.g., steer, drive) */
  type?: string;
  /** Serial number from tyres table */
  serialNumber?: string;
  /** Kilometres travelled since installation */
  kmTravelled?: number;
  /** Initial tread depth when installed */
  initialTreadDepth?: number;
  /** Installation date */
  installationDate?: string;
  /** Odometer at installation */
  installationKm?: number;
}

const MobileTyreInspectionForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as {
    vehicleId?: string;
    vehicleData?: { id: string; fleet_number: string; registration_number: string; make?: string; model?: string };
    inspectorId?: string;
    inspectorName?: string;
    scannedVehicleData?: {
      fleetNumber: string;
      registration: string;
      fullCode: string;
    };
    initiatedVia?: string;
    odometerReading?: number | null;
  } | null;

  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [tyreData, setTyreData] = useState<TyreData[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  // Accept vehicleId directly OR extract from vehicleData object
  const vehicleId = locationState?.vehicleId || locationState?.vehicleData?.id || selectedVehicleId;
  const inspectorName = locationState?.inspectorName || "";

  const { data: vehicles } = useVehicles();
  const queryClient = useQueryClient();
  const { promoteToVehicleFault } = usePromoteToVehicleFault();

  const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);
  const vehicleRegistration = selectedVehicle?.registration_number || "";
  const vehicleFleetNumber = selectedVehicle?.fleet_number || null;

  // Get fleet configuration using fleet_number from vehicles table
  const fleetConfig = vehicleFleetNumber ? getFleetConfig(vehicleFleetNumber) : null;
  const { data: fleetPositions } = useFleetTyrePositions({
    vehicleRegistration,
    fleetNumber: vehicleFleetNumber
  });

  // Initialize odometer from location state
  useEffect(() => {
    if (locationState?.odometerReading) {
      setOdometerReading(locationState.odometerReading.toString());
    }
  }, [locationState]);

  // Initialize tyre data with details from installed tyres
  useEffect(() => {
    if (fleetConfig && fleetPositions) {
      const initialData = fleetConfig.positions.map((pos) => {
        const existingData = fleetPositions.find((fp) => fp.position === pos.position);
        const tyreDetails = existingData?.tyre_details;
        return {
          position: pos.position,
          positionLabel: pos.label,
          brand: tyreDetails?.brand || "",
          size: tyreDetails?.size || "",
          treadDepth: tyreDetails?.current_tread_depth?.toString() || "",
          pressure: "",
          condition: (tyreDetails?.condition as TyreCondition) || "good" as TyreCondition,
          wearPattern: "",
          notes: "",
          tyreCode: existingData?.tyre_code || undefined,
          dotCode: tyreDetails?.dot_code || undefined,
          model: tyreDetails?.model || undefined,
          type: tyreDetails?.type || undefined,
          serialNumber: tyreDetails?.serial_number || undefined,
          kmTravelled: tyreDetails?.km_travelled ?? undefined,
          initialTreadDepth: tyreDetails?.initial_tread_depth ?? undefined,
          installationDate: tyreDetails?.installation_date || undefined,
          installationKm: tyreDetails?.installation_km ?? undefined,
        };
      });
      setTyreData(initialData);
    }
  }, [fleetConfig, fleetPositions]);

  // Swipe detection
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentPositionIndex < tyreData.length - 1) {
      setCurrentPositionIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentPositionIndex > 0) {
      setCurrentPositionIndex(prev => prev - 1);
    }
  };

  const currentTyre = tyreData[currentPositionIndex];
  const progress = ((currentPositionIndex + 1) / tyreData.length) * 100;

  const updateCurrentTyre = (field: keyof TyreData, value: string) => {
    setTyreData((prev) =>
      prev.map((tyre, idx) =>
        idx === currentPositionIndex ? { ...tyre, [field]: value } : tyre
      )
    );
  };

  const handleQRScan = (result: ScanResult) => {
    if (result.type === "tyre" && 'tin' in result.data) {
      updateCurrentTyre("tyreCode", result.data.tin);
      setShowQRScanner(false);
      toast({
        title: "Tyre Scanned",
        description: `Code: ${result.data.tin}`,
      });
    } else {
      toast({
        title: "Invalid QR Code",
        description: "Please scan a tyre QR code",
        variant: "destructive",
      });
    }
  };

  const saveInspection = useMutation({
    mutationFn: async () => {
      if (!vehicleId || !inspectorName) {
        throw new Error("Missing required information");
      }

      if (!odometerReading) {
        throw new Error("Please enter the current odometer reading");
      }

      // Generate professional inspection number: TYRE-YYYYMMDD-HHMMSS
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const inspectionNumber = `TYRE-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      const inspectionRecord: VehicleInspectionRecord = {
        vehicle_id: vehicleId,
        inspector_name: inspectorName,
        inspector_profile_id: locationState?.inspectorId || null,
        inspection_date: now.toISOString().split('T')[0],
        inspection_type: 'tyre',
        inspection_number: inspectionNumber,
        initiated_via: locationState?.initiatedVia || 'manual',
        scanned_vehicle_qr: locationState?.scannedVehicleData?.fullCode || null,
        vehicle_registration: vehicleRegistration,
        notes: `Mobile tyre inspection for ${vehicleRegistration} - ${tyreData.length} positions inspected`,
        odometer_reading: odometerReading ? parseInt(odometerReading) : null,
      };

      // 1. Create vehicle_inspections record and get the ID back
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("vehicle_inspections")
        .insert([inspectionRecord])
        .select("id")
        .single();

      if (inspectionError) throw inspectionError;
      const inspectionId = inspectionData.id;

      let hasFault = false;

      // 2. Create inspection_items + inspection_faults for each tyre position
      for (const tyre of tyreData) {
        const isFailed = tyre.condition === 'poor' || tyre.condition === 'needs_replacement';
        const itemStatus = isFailed ? 'fail' : 'pass';

        // Create inspection_item for this position
        const { data: itemData, error: itemError } = await supabase
          .from("inspection_items")
          .insert({
            inspection_id: inspectionId,
            item_name: `Tyre - ${tyre.positionLabel}`,
            category: "tyre",
            status: itemStatus,
            notes: [
              tyre.brand && `Brand: ${tyre.brand}`,
              tyre.size && `Size: ${tyre.size}`,
              tyre.treadDepth && `Tread: ${tyre.treadDepth}mm`,
              tyre.pressure && `Pressure: ${tyre.pressure} PSI`,
              tyre.condition && `Condition: ${tyre.condition}`,
              tyre.wearPattern && `Wear: ${tyre.wearPattern}`,
              tyre.notes,
            ].filter(Boolean).join(' | '),
          })
          .select("id")
          .single();

        if (itemError) {
          console.error(`Error creating inspection_item for ${tyre.positionLabel}:`, itemError);
          continue;
        }

        // If condition is poor or critical, create inspection_fault
        if (isFailed && itemData) {
          hasFault = true;
          const severity = tyre.condition === 'needs_replacement' ? 'critical' : 'high';
          const faultDescription = `Tyre at ${tyre.positionLabel} in ${tyre.condition} condition` +
            (tyre.wearPattern ? ` — wear: ${tyre.wearPattern}` : '') +
            (tyre.treadDepth ? ` — tread: ${tyre.treadDepth}mm` : '') +
            (tyre.notes ? ` — ${tyre.notes}` : '');

          const { data: faultData, error: faultError } = await supabase
            .from("inspection_faults")
            .insert({
              inspection_id: inspectionId,
              inspection_item_id: itemData.id,
              fault_description: faultDescription,
              severity: severity as "critical" | "high" | "medium" | "low",
              corrective_action_status: 'pending',
              requires_immediate_attention: tyre.condition === 'needs_replacement',
            })
            .select("id")
            .single();

          if (faultError) {
            console.error(`Error creating inspection_fault for ${tyre.positionLabel}:`, faultError);
          }

          // Auto-promote to vehicle fault
          if (faultData) {
            try {
              await promoteToVehicleFault({
                inspectionFaultId: faultData.id,
                inspectionId,
                vehicleId,
                faultDescription,
                severity: severity as "critical" | "high" | "medium" | "low",
                reportedBy: inspectorName,
                faultCategory: 'tyre',
                component: tyre.positionLabel,
              });
            } catch (promoteError) {
              console.error(`Error promoting fault for ${tyre.positionLabel}:`, promoteError);
            }
          }
        }

        // 3. Update fleet tyre position (tyre_code assignment)
        if (tyre.tyreCode && vehicleFleetNumber) {
          await updateFleetTyrePosition(
            vehicleFleetNumber,
            vehicleRegistration,
            tyre.position,
            tyre.tyreCode
          );
        }

        // 4. Update tyre metadata (tread depth, condition, last inspection date)
        if (tyre.tyreCode) {
          const tyreUpdates: Record<string, unknown> = {
            last_inspection_date: now.toISOString().split('T')[0],
          };
          if (tyre.treadDepth) {
            tyreUpdates.current_tread_depth = parseFloat(tyre.treadDepth);
          }
          if (tyre.condition) {
            tyreUpdates.condition = tyre.condition;
          }

          const { error: tyreUpdateError } = await supabase
            .from("tyres")
            .update(tyreUpdates)
            .eq("id", tyre.tyreCode);

          if (tyreUpdateError) {
            console.error(`Error updating tyre metadata for ${tyre.positionLabel}:`, tyreUpdateError);
          }

          // 5. Create tyre_lifecycle_event so inspection shows in tyre lifecycle view
          const { error: lifecycleError } = await supabase
            .from("tyre_lifecycle_events")
            .insert({
              tyre_id: tyre.tyreCode,
              tyre_code: tyre.dotCode || tyre.tyreCode,
              vehicle_id: vehicleId,
              event_type: "inspection",
              event_date: now.toISOString(),
              fleet_position: tyre.position,
              performed_by: inspectorName,
              tread_depth_at_event: tyre.treadDepth ? parseFloat(tyre.treadDepth) : null,
              pressure_at_event: tyre.pressure ? parseFloat(tyre.pressure) : null,
              km_reading: odometerReading ? parseInt(odometerReading) : null,
              notes: `Condition: ${tyre.condition}` +
                (tyre.wearPattern ? ` | Wear: ${tyre.wearPattern}` : '') +
                (tyre.notes ? ` | ${tyre.notes}` : ''),
              metadata: {
                inspection_id: inspectionId,
                inspection_number: inspectionNumber,
                condition: tyre.condition,
                brand: tyre.brand || null,
                size: tyre.size || null,
                wear_pattern: tyre.wearPattern || null,
              },
            });

          if (lifecycleError) {
            console.error(`Error creating lifecycle event for ${tyre.positionLabel}:`, lifecycleError);
          }
        }
      }

      // 6. Mark inspection as having faults if any were found
      if (hasFault) {
        await supabase
          .from("vehicle_inspections")
          .update({ has_fault: true })
          .eq("id", inspectionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tyre_inspections"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle_inspections"] });
      queryClient.invalidateQueries({ queryKey: ["fleet_tyre_positions"] });
      queryClient.invalidateQueries({ queryKey: ["inspection_faults"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      queryClient.invalidateQueries({ queryKey: ["tyres"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_lifecycle"] });
      toast({
        title: "Inspection Saved",
        description: "Tyre inspection completed and faults logged",
      });
      navigate("/inspections/mobile");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getConditionColor = (condition: TyreCondition) => {
    const colors = {
      excellent: "text-green-600",
      good: "text-blue-600",
      fair: "text-yellow-600",
      poor: "text-orange-600",
      needs_replacement: "text-red-600",
    };
    return colors[condition];
  };

  const getConditionIcon = (condition: TyreCondition) => {
    const icons = {
      excellent: CheckCircle2,
      good: CheckCircle2,
      fair: AlertTriangle,
      poor: AlertTriangle,
      needs_replacement: XCircle,
    };
    return icons[condition];
  };

  // If no vehicle selected at all, show vehicle picker
  if (!vehicleId) {
    const filteredVehicles = vehicles?.filter((v) => {
      if (!vehicleSearch) return true;
      const term = vehicleSearch.toLowerCase();
      return (
        v.fleet_number?.toLowerCase().includes(term) ||
        v.registration_number?.toLowerCase().includes(term) ||
        v.make?.toLowerCase().includes(term)
      );
    }) || [];

    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-11 w-11 p-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Tyre Inspection</h1>
              <p className="text-xs text-muted-foreground">Select a vehicle to inspect</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by fleet number or registration..."
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="space-y-2 max-h-[calc(100vh-160px)] overflow-y-auto">
            {filteredVehicles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No vehicles found</p>
            ) : (
              filteredVehicles.map((v) => (
                <Card
                  key={v.id}
                  className="cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => setSelectedVehicleId(v.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <Truck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{v.fleet_number || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.registration_number} · {v.make} {v.model}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!currentTyre) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <Truck className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No tyre positions configured for this vehicle</p>
            <p className="text-xs text-muted-foreground">Fleet number may not have a tyre layout defined</p>
            <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ConditionIcon = getConditionIcon(currentTyre.condition);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="h-11 w-11 p-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-center flex-1">
              <h1 className="font-semibold">{vehicleRegistration}</h1>
              <p className="text-xs text-muted-foreground">Position {currentPositionIndex + 1} of {tyreData.length}</p>
            </div>
            <Badge variant="secondary" className="h-11 px-3">
              {currentTyre.positionLabel}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Main Content - Swipeable */}
      <div
        ref={cardRef}
        className="flex-1 overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="p-4 space-y-4 pb-32">
          {/* Current KM */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Current Odometer (km) *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value)}
                  placeholder="Enter current km reading"
                  className="h-12 text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Condition Badge */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-3">
                <ConditionIcon className={`w-8 h-8 ${getConditionColor(currentTyre.condition)}`} />
                <span className={`text-lg font-semibold ${getConditionColor(currentTyre.condition)}`}>
                  {currentTyre.condition.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              {currentTyre.pressure && (
                <div className="text-sm text-muted-foreground text-center mt-1">
                  PSI: <span className="font-semibold text-foreground">{currentTyre.pressure}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Fields */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Installed Tyre Information (read-only display) */}
              {(currentTyre.tyreCode || currentTyre.dotCode) && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Installed Tyre Details</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {currentTyre.dotCode && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">DOT: </span>
                        <span className="font-semibold text-primary">{currentTyre.dotCode}</span>
                      </div>
                    )}
                    {currentTyre.serialNumber && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Serial: </span>
                        <span className="font-mono text-xs">{currentTyre.serialNumber}</span>
                      </div>
                    )}
                    {currentTyre.model && (
                      <div>
                        <span className="text-muted-foreground">Model: </span>
                        <span>{currentTyre.model}</span>
                      </div>
                    )}
                    {currentTyre.type && (
                      <div>
                        <span className="text-muted-foreground">Type: </span>
                        <span className="capitalize">{currentTyre.type}</span>
                      </div>
                    )}
                    {currentTyre.initialTreadDepth != null && (
                      <div>
                        <span className="text-muted-foreground">Initial Tread: </span>
                        <span>{currentTyre.initialTreadDepth}mm</span>
                      </div>
                    )}
                    {currentTyre.kmTravelled != null && (
                      <div>
                        <span className="text-muted-foreground">KM: </span>
                        <span>{currentTyre.kmTravelled.toLocaleString()}</span>
                      </div>
                    )}
                    {currentTyre.installationDate && (
                      <div>
                        <span className="text-muted-foreground">Installed: </span>
                        <span>{new Date(currentTyre.installationDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {currentTyre.installationKm != null && (
                      <div>
                        <span className="text-muted-foreground">Install KM: </span>
                        <span>{currentTyre.installationKm.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DOT Code — read-only if already set from installed tyre */}
              <div className="space-y-2">
                <Label className="text-base">DOT Code</Label>
                {currentTyre.dotCode ? (
                  <Input
                    value={currentTyre.dotCode}
                    readOnly
                    className="h-12 text-base bg-muted"
                  />
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={currentTyre.dotCode || ""}
                      onChange={(e) => updateCurrentTyre("dotCode", e.target.value)}
                      placeholder="Enter DOT code"
                      className="h-12 text-base"
                    />
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => setShowQRScanner(true)}
                      className="h-12 w-12 p-0 shrink-0"
                    >
                      <Camera className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Brand */}
              <div className="space-y-2">
                <Label className="text-base">Brand</Label>
                <Input
                  value={currentTyre.brand}
                  onChange={(e) => updateCurrentTyre("brand", e.target.value)}
                  placeholder="Enter brand"
                  className="h-12 text-base"
                />
              </div>

              {/* Size */}
              <div className="space-y-2">
                <Label className="text-base">Size</Label>
                <Input
                  value={currentTyre.size}
                  onChange={(e) => updateCurrentTyre("size", e.target.value)}
                  placeholder="e.g., 295/80R22.5"
                  className="h-12 text-base"
                />
              </div>

              {/* Tread Depth and Pressure */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base">Tread (mm)</Label>
                  <Input
                    type="number"
                    value={currentTyre.treadDepth}
                    onChange={(e) => updateCurrentTyre("treadDepth", e.target.value)}
                    placeholder="0.0"
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Pressure (PSI)</Label>
                  <Input
                    type="number"
                    value={currentTyre.pressure}
                    onChange={(e) => updateCurrentTyre("pressure", e.target.value)}
                    placeholder="0"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label className="text-base">Condition</Label>
                <Select
                  value={currentTyre.condition}
                  onValueChange={(value: TyreCondition) =>
                    updateCurrentTyre("condition", value)
                  }
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="needs_replacement">Needs Replacement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Wear Pattern */}
              <div className="space-y-2">
                <Label className="text-base">Wear Pattern</Label>
                <Select
                  value={currentTyre.wearPattern || undefined}
                  onValueChange={(value) => updateCurrentTyre("wearPattern", value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select wear pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Even Wear</SelectItem>
                    <SelectItem value="center">Center Wear</SelectItem>
                    <SelectItem value="edge">Edge Wear (Both)</SelectItem>
                    <SelectItem value="inner">Inner Edge Wear</SelectItem>
                    <SelectItem value="outer">Outer Edge Wear</SelectItem>
                    <SelectItem value="cupping">Cupping/Scalloping</SelectItem>
                    <SelectItem value="flat_spot">Flat Spots</SelectItem>
                    <SelectItem value="feathering">Feathering</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-base">Notes</Label>
                <Textarea
                  value={currentTyre.notes}
                  onChange={(e) => updateCurrentTyre("notes", e.target.value)}
                  placeholder="Additional observations"
                  rows={4}
                  className="text-base resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Bottom Navigation */}
      <div className="sticky bottom-0 z-10 bg-background border-t shadow-lg">
        <div className="p-4 space-y-3">
          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentPositionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentPositionIndex === 0}
              className="flex-1 h-14"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>

            {currentPositionIndex < tyreData.length - 1 ? (
              <Button
                size="lg"
                onClick={() => setCurrentPositionIndex(prev => prev + 1)}
                className="flex-1 h-14"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => saveInspection.mutate()}
                disabled={saveInspection.isPending}
                className="flex-1 h-14"
              >
                <Check className="w-5 h-5 mr-2" />
                Save Inspection
              </Button>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-1.5">
            {tyreData.map((_, idx) => (
              <Button
                key={idx}
                onClick={() => setCurrentPositionIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentPositionIndex
                    ? "w-8 bg-primary"
                    : idx <= currentPositionIndex
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <Modal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        title="Scan Tyre QR Code"
        maxWidth="lg"
      >
        <PositionQRScanner
          onScanSuccess={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      </Modal>
    </div>
  );
};

export default MobileTyreInspectionForm;