import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { extractRegistrationNumber, getFleetConfig } from "@/constants/fleetTyreConfig";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { exportVehicleTyresToExcel, exportVehicleTyresToPDF } from "@/utils/tyreExport";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle, Download, FileSpreadsheet, FileText } from "lucide-react";

interface FleetTyreLayoutDiagramProps {
  vehicleId?: string;
  registrationNumber: string;
  fleetNumber: string;
}

// Types for fleet position data
type FleetPositionRow = {
  fleet_number: string;
  position: string;
  tyre_code?: string | null;
  registration_no: string;
  [key: string]: unknown;
};

type TyreRow = Database["public"]["Tables"]["tyres"]["Row"];

interface FleetPositionStatus {
  position: string;
  positionLabel: string;
  tyreCode: string | null;
  tyreDetails: {
    brand?: string;
    model?: string;
    size?: string;
    currentTreadDepth?: number;
    healthStatus?: string;
    lastInspectionDate?: string;
  } | null;
  installationDate?: string | null;
}

// Tyre wheel component that looks like an actual tyre
interface TyreWheelProps {
  status: FleetPositionStatus;
  size?: "sm" | "md" | "lg";
  isDual?: boolean;
}

const TyreWheel = ({ status, size = "md", isDual = false }: TyreWheelProps) => {
  const sizeClasses = {
    sm: "w-8 h-12",
    md: "w-10 h-14",
    lg: "w-12 h-16",
  };

  const lastInspectionDate = status.tyreDetails?.lastInspectionDate
    ? new Date(status.tyreDetails.lastInspectionDate)
    : null;
  const daysSinceInspection = lastInspectionDate && !isNaN(lastInspectionDate.getTime())
    ? Math.floor((Date.now() - lastInspectionDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const recentlyInspected = typeof daysSinceInspection === "number" && daysSinceInspection <= 30;

  const getHealthColor = (healthStatus?: string) => {
    switch (healthStatus) {
      case "excellent": return "from-green-600 to-green-400 border-green-700";
      case "good": return "from-blue-600 to-blue-400 border-blue-700";
      case "warning": return "from-yellow-600 to-yellow-400 border-yellow-700";
      case "critical": return "from-red-600 to-red-400 border-red-700";
      default: return "from-gray-400 to-gray-300 border-gray-500";
    }
  };

  const getHealthIcon = (healthStatus?: string) => {
    switch (healthStatus) {
      case "excellent":
      case "good":
        return <CheckCircle className="h-3 w-3 text-white" />;
      case "warning":
        return <AlertTriangle className="h-3 w-3 text-white" />;
      case "critical":
        return <AlertCircle className="h-3 w-3 text-white" />;
      default:
        return null;
    }
  };

  const isEmpty = !status.tyreCode;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              sizeClasses[size],
              "relative cursor-pointer transition-all hover:scale-110",
              isDual ? "mx-0.5" : ""
            )}
          >
            {/* Tyre shape - rounded rectangle to look like a tyre from above/side */}
            <div
              className={cn(
                "w-full h-full rounded-sm border-2 flex items-center justify-center",
                isEmpty
                  ? "border-dashed border-gray-400 bg-gray-100"
                  : `bg-gradient-to-b ${getHealthColor(status.tyreDetails?.healthStatus)}`
              )}
              style={{
                borderRadius: "4px 4px 4px 4px",
                boxShadow: isEmpty ? "none" : "inset 0 2px 4px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              {/* Tyre tread pattern */}
              {!isEmpty && (
                <div className="absolute inset-1 flex flex-col justify-evenly">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-0.5 bg-black/20 rounded-full mx-0.5" />
                  ))}
                </div>
              )}

              {/* Position label */}
              <span className={cn(
                "text-[8px] font-bold z-10 px-1 rounded",
                isEmpty ? "text-gray-500 bg-white/80" : "text-white bg-black/30"
              )}>
                {status.position}
              </span>
            </div>

            {/* Health indicator */}
            {!isEmpty && status.tyreDetails?.healthStatus && (
              <div className="absolute -top-1 -right-1 z-20">
                {getHealthIcon(status.tyreDetails.healthStatus)}
              </div>
            )}

            {/* Recent inspection badge */}
            {!isEmpty && recentlyInspected && (
              <div className="absolute -bottom-2 left-0 z-20">
                <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                  Inspected ≤30d
                </Badge>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{status.positionLabel}</p>
            {status.tyreCode ? (
              <>
                <p className="text-xs font-mono">{status.tyreCode}</p>
                {status.tyreDetails && (
                  <>
                    <p className="text-xs">{status.tyreDetails.brand} {status.tyreDetails.model}</p>
                    <p className="text-xs">{status.tyreDetails.size}</p>
                    {status.tyreDetails.currentTreadDepth && (
                      <p className="text-xs">Tread: {status.tyreDetails.currentTreadDepth}mm</p>
                    )}
                    <p className="text-xs">
                      Last inspection: {lastInspectionDate
                        ? `${lastInspectionDate.toLocaleDateString()}${daysSinceInspection !== null ? ` (${daysSinceInspection}d ago)` : ""}`
                        : "Not recorded"}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {status.tyreDetails.healthStatus || "Unknown"}
                    </Badge>
                  </>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">No tyre installed</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Dual wheel pair (for rear axles on trucks)
interface DualWheelProps {
  innerStatus: FleetPositionStatus;
  outerStatus: FleetPositionStatus;
  side: "left" | "right";
}

const DualWheel = ({ innerStatus, outerStatus, side }: DualWheelProps) => {
  return (
    <div className={cn(
      "flex",
      side === "left" ? "flex-row" : "flex-row-reverse"
    )}>
      <TyreWheel status={outerStatus} size="md" isDual />
      <TyreWheel status={innerStatus} size="md" isDual />
    </div>
  );
};

// Horse/Truck diagram (11 positions - front single, 2 rear dual axles)
interface TruckDiagramProps {
  positions: FleetPositionStatus[];
}

const TruckDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="relative flex flex-col items-center py-4">
      {/* Direction indicator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-muted-foreground">
        <span>← Front</span>
      </div>

      <div className="flex flex-col items-center gap-2 mt-6">
        {/* Truck body */}
        <svg viewBox="0 0 200 380" className="w-48 h-auto">
          {/* Cab */}
          <rect x="40" y="10" width="120" height="80" rx="10" fill="currentColor" className="text-slate-700" />
          <rect x="50" y="20" width="100" height="40" rx="5" fill="currentColor" className="text-slate-500" />
          {/* Windshield */}
          <rect x="55" y="25" width="90" height="30" rx="3" fill="currentColor" className="text-sky-200/50" />

          {/* Chassis/Frame */}
          <rect x="50" y="90" width="100" height="260" rx="5" fill="currentColor" className="text-slate-600" />

          {/* Frame rails */}
          <rect x="55" y="95" width="8" height="250" fill="currentColor" className="text-slate-800" />
          <rect x="137" y="95" width="8" height="250" fill="currentColor" className="text-slate-800" />

          {/* Cross members */}
          <rect x="55" y="120" width="90" height="4" fill="currentColor" className="text-slate-800" />
          <rect x="55" y="200" width="90" height="4" fill="currentColor" className="text-slate-800" />
          <rect x="55" y="280" width="90" height="4" fill="currentColor" className="text-slate-800" />

          {/* Fifth wheel */}
          <ellipse cx="100" cy="320" rx="35" ry="15" fill="currentColor" className="text-slate-400" />
        </svg>

        {/* Wheel positions - overlaid on SVG */}
        <div className="absolute flex flex-col gap-0" style={{ top: "85px" }}>
          {/* Front Axle */}
          <div className="flex justify-between w-56 mb-32">
            <div className="flex flex-col items-center">
              {getPosition("V1") && <TyreWheel status={getPosition("V1")!} size="lg" />}
            </div>
            <div className="flex flex-col items-center">
              {getPosition("V2") && <TyreWheel status={getPosition("V2")!} size="lg" />}
            </div>
          </div>

          {/* Rear Axle 1 (Dual) */}
          <div className="flex justify-between w-64 mb-6">
            <div className="flex flex-col items-center">
              {getPosition("V3") && getPosition("V4") && (
                <DualWheel
                  outerStatus={getPosition("V3")!}
                  innerStatus={getPosition("V4")!}
                  side="left"
                />
              )}
            </div>
            <div className="flex flex-col items-center">
              {getPosition("V5") && getPosition("V6") && (
                <DualWheel
                  innerStatus={getPosition("V5")!}
                  outerStatus={getPosition("V6")!}
                  side="right"
                />
              )}
            </div>
          </div>

          {/* Rear Axle 2 (Dual) */}
          <div className="flex justify-between w-64 mb-4">
            <div className="flex flex-col items-center">
              {getPosition("V7") && getPosition("V8") && (
                <DualWheel
                  outerStatus={getPosition("V7")!}
                  innerStatus={getPosition("V8")!}
                  side="left"
                />
              )}
            </div>
            <div className="flex flex-col items-center">
              {getPosition("V9") && getPosition("V10") && (
                <DualWheel
                  innerStatus={getPosition("V9")!}
                  outerStatus={getPosition("V10")!}
                  side="right"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spare tyre */}
      {getPosition("SP") && (
        <div className="mt-4 flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="md" />
        </div>
      )}

      {/* Direction indicator */}
      <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        <span>Rear →</span>
      </div>
    </div>
  );
};

// Single Axle Truck diagram (7 positions - 4H, 6H, 30H, UD)
// 2 steer tyres + 4 drive tyres (dual on single rear axle) + 1 spare
const SingleAxleTruckDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="relative flex flex-col items-center py-4">
      {/* Direction indicator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-muted-foreground">
        <span>← Front</span>
      </div>

      <div className="flex flex-col items-center gap-2 mt-6">
        {/* Truck body - shorter for single axle */}
        <svg viewBox="0 0 200 300" className="w-44 h-auto">
          {/* Cab */}
          <rect x="40" y="10" width="120" height="80" rx="10" fill="currentColor" className="text-slate-700" />
          <rect x="50" y="20" width="100" height="40" rx="5" fill="currentColor" className="text-slate-500" />
          {/* Windshield */}
          <rect x="55" y="25" width="90" height="30" rx="3" fill="currentColor" className="text-sky-200/50" />
          {/* Mirrors */}
          <rect x="25" y="35" width="12" height="6" rx="2" fill="currentColor" className="text-slate-600" />
          <rect x="163" y="35" width="12" height="6" rx="2" fill="currentColor" className="text-slate-600" />

          {/* Chassis/Frame - shorter */}
          <rect x="50" y="90" width="100" height="180" rx="5" fill="currentColor" className="text-slate-600" />

          {/* Frame rails */}
          <rect x="55" y="95" width="8" height="170" fill="currentColor" className="text-slate-800" />
          <rect x="137" y="95" width="8" height="170" fill="currentColor" className="text-slate-800" />

          {/* Cross members */}
          <rect x="55" y="120" width="90" height="4" fill="currentColor" className="text-slate-800" />
          <rect x="55" y="180" width="90" height="4" fill="currentColor" className="text-slate-800" />

          {/* Fifth wheel */}
          <ellipse cx="100" cy="240" rx="35" ry="15" fill="currentColor" className="text-slate-400" />

          {/* Axle indicators */}
          <text x="100" y="65" textAnchor="middle" className="text-[8px] fill-white font-bold">STEER</text>
          <text x="100" y="205" textAnchor="middle" className="text-[8px] fill-white font-bold">DRIVE</text>
        </svg>

        {/* Wheel positions - overlaid on SVG */}
        <div className="absolute flex flex-col gap-0" style={{ top: "80px" }}>
          {/* Front Steer Axle - single tyres */}
          <div className="flex justify-between w-52 mb-20">
            <div className="flex flex-col items-center">
              {getPosition("V1") && <TyreWheel status={getPosition("V1")!} size="lg" />}
              <span className="text-[9px] text-muted-foreground mt-1">Steer L</span>
            </div>
            <div className="flex flex-col items-center">
              {getPosition("V2") && <TyreWheel status={getPosition("V2")!} size="lg" />}
              <span className="text-[9px] text-muted-foreground mt-1">Steer R</span>
            </div>
          </div>

          {/* Rear Drive Axle - dual wheels */}
          <div className="flex justify-between w-60">
            <div className="flex flex-col items-center">
              {getPosition("V3") && getPosition("V4") && (
                <DualWheel
                  outerStatus={getPosition("V3")!}
                  innerStatus={getPosition("V4")!}
                  side="left"
                />
              )}
              <span className="text-[9px] text-muted-foreground mt-1">Drive L</span>
            </div>
            <div className="flex flex-col items-center">
              {getPosition("V5") && getPosition("V6") && (
                <DualWheel
                  innerStatus={getPosition("V5")!}
                  outerStatus={getPosition("V6")!}
                  side="right"
                />
              )}
              <span className="text-[9px] text-muted-foreground mt-1">Drive R</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spare tyre */}
      {getPosition("SP") && (
        <div className="mt-6 flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="md" />
        </div>
      )}

      {/* Direction indicator */}
      <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        <span>Rear →</span>
      </div>
    </div>
  );
};

// LMV/Light Vehicle diagram (5 positions - 4 corners + spare)
const LMVDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="relative flex flex-col items-center py-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        ← Front
      </div>

      <div className="flex flex-col items-center gap-2 mt-6">
        {/* LMV body */}
        <svg viewBox="0 0 160 240" className="w-36 h-auto">
          {/* Body */}
          <rect x="30" y="10" width="100" height="200" rx="15" fill="currentColor" className="text-slate-600" />
          {/* Windshield */}
          <rect x="40" y="20" width="80" height="35" rx="5" fill="currentColor" className="text-sky-200/50" />
          {/* Roof */}
          <rect x="40" y="60" width="80" height="60" rx="3" fill="currentColor" className="text-slate-500" />
          {/* Rear window */}
          <rect x="45" y="130" width="70" height="30" rx="5" fill="currentColor" className="text-sky-200/30" />
          {/* Bed/cargo */}
          <rect x="35" y="165" width="90" height="40" rx="5" fill="currentColor" className="text-slate-700" />
        </svg>

        {/* Wheel positions */}
        <div className="absolute flex flex-col" style={{ top: "70px" }}>
          {/* Front wheels */}
          <div className="flex justify-between w-44 mb-24">
            {getPosition("V1") && <TyreWheel status={getPosition("V1")!} size="md" />}
            {getPosition("V2") && <TyreWheel status={getPosition("V2")!} size="md" />}
          </div>

          {/* Rear wheels */}
          <div className="flex justify-between w-44">
            {getPosition("V3") && <TyreWheel status={getPosition("V3")!} size="md" />}
            {getPosition("V4") && <TyreWheel status={getPosition("V4")!} size="md" />}
          </div>
        </div>
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-4 flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="sm" />
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">Rear →</div>
    </div>
  );
};

// Reefer Trailer diagram (7-9 positions)
const ReeferDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);
  const hasSecondAxle = positions.some(p => p.position === "T5");
  const hasDualWheels = positions.some(p => p.position === "T3"); // 4+ tyres per axle

  return (
    <div className="relative flex flex-col items-center py-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        ← Kingpin
      </div>

      <div className="flex flex-col items-center gap-2 mt-6">
        {/* Reefer trailer body */}
        <svg viewBox="0 0 180 280" className="w-40 h-auto">
          {/* Kingpin */}
          <circle cx="90" cy="15" r="8" fill="currentColor" className="text-slate-400" />
          <rect x="85" y="15" width="10" height="15" fill="currentColor" className="text-slate-500" />

          {/* Trailer body */}
          <rect x="20" y="30" width="140" height="220" rx="5" fill="currentColor" className="text-slate-500" />

          {/* Reefer unit (at front) */}
          <rect x="25" y="35" width="130" height="30" rx="3" fill="currentColor" className="text-slate-700" />
          <rect x="30" y="40" width="40" height="20" rx="2" fill="currentColor" className="text-slate-600" />
          <circle cx="110" cy="50" r="8" fill="currentColor" className="text-slate-800" />

          {/* Insulated walls pattern */}
          <rect x="30" y="70" width="120" height="170" rx="3" fill="currentColor" className="text-slate-400" />

          {/* Door lines */}
          <line x1="90" y1="180" x2="90" y2="245" stroke="currentColor" className="text-slate-600" strokeWidth="2" />
          <circle cx="85" cy="210" r="3" fill="currentColor" className="text-slate-600" />
          <circle cx="95" cy="210" r="3" fill="currentColor" className="text-slate-600" />
        </svg>

        {/* Wheel positions */}
        <div className="absolute flex flex-col gap-4" style={{ top: hasSecondAxle ? "200px" : "230px" }}>
          {/* Axle 1 */}
          <div className="flex justify-between w-52">
            {hasDualWheels ? (
              <>
                {getPosition("T1") && getPosition("T2") && (
                  <DualWheel
                    outerStatus={getPosition("T1")!}
                    innerStatus={getPosition("T2")!}
                    side="left"
                  />
                )}
                {getPosition("T3") && getPosition("T4") && (
                  <DualWheel
                    innerStatus={getPosition("T3")!}
                    outerStatus={getPosition("T4")!}
                    side="right"
                  />
                )}
              </>
            ) : (
              <>
                {getPosition("T1") && <TyreWheel status={getPosition("T1")!} size="md" />}
                {getPosition("T2") && <TyreWheel status={getPosition("T2")!} size="md" />}
              </>
            )}
          </div>

          {/* Axle 2 (if present) */}
          {hasSecondAxle && (
            <div className="flex justify-between w-52">
              {hasDualWheels ? (
                <>
                  {getPosition("T5") && getPosition("T6") && (
                    <DualWheel
                      outerStatus={getPosition("T5")!}
                      innerStatus={getPosition("T6")!}
                      side="left"
                    />
                  )}
                  {getPosition("T7") && getPosition("T8") && (
                    <DualWheel
                      innerStatus={getPosition("T7")!}
                      outerStatus={getPosition("T8")!}
                      side="right"
                    />
                  )}
                </>
              ) : (
                <>
                  {getPosition("T5") && <TyreWheel status={getPosition("T5")!} size="md" />}
                  {getPosition("T6") && <TyreWheel status={getPosition("T6")!} size="md" />}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-4 flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="sm" />
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">Rear →</div>
    </div>
  );
};

// Interlink Trailer diagram (17 positions - 4 axles)
const InterlinkDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="relative flex flex-col items-center py-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        ← Kingpin
      </div>

      <div className="flex flex-col items-center gap-2 mt-6">
        {/* Interlink trailer body */}
        <svg viewBox="0 0 200 400" className="w-44 h-auto">
          {/* Kingpin */}
          <circle cx="100" cy="15" r="10" fill="currentColor" className="text-slate-400" />
          <rect x="95" y="15" width="10" height="20" fill="currentColor" className="text-slate-500" />

          {/* Long trailer body */}
          <rect x="15" y="35" width="170" height="340" rx="5" fill="currentColor" className="text-slate-500" />

          {/* Side ribs/panels */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect
              key={i}
              x="20"
              y={50 + i * 50}
              width="160"
              height="3"
              fill="currentColor"
              className="text-slate-600"
            />
          ))}

          {/* Rear doors */}
          <line x1="100" y1="340" x2="100" y2="370" stroke="currentColor" className="text-slate-600" strokeWidth="2" />
          <circle cx="95" cy="355" r="3" fill="currentColor" className="text-slate-600" />
          <circle cx="105" cy="355" r="3" fill="currentColor" className="text-slate-600" />
        </svg>

        {/* Wheel positions - 4 axles with dual wheels */}
        <div className="absolute flex flex-col gap-3" style={{ top: "260px" }}>
          {/* Axle 1 */}
          <div className="flex justify-between w-56">
            {getPosition("T1") && getPosition("T2") && (
              <DualWheel outerStatus={getPosition("T1")!} innerStatus={getPosition("T2")!} side="left" />
            )}
            {getPosition("T3") && getPosition("T4") && (
              <DualWheel innerStatus={getPosition("T3")!} outerStatus={getPosition("T4")!} side="right" />
            )}
          </div>

          {/* Axle 2 */}
          <div className="flex justify-between w-56">
            {getPosition("T5") && getPosition("T6") && (
              <DualWheel outerStatus={getPosition("T5")!} innerStatus={getPosition("T6")!} side="left" />
            )}
            {getPosition("T7") && getPosition("T8") && (
              <DualWheel innerStatus={getPosition("T7")!} outerStatus={getPosition("T8")!} side="right" />
            )}
          </div>

          {/* Axle 3 */}
          <div className="flex justify-between w-56">
            {getPosition("T9") && getPosition("T10") && (
              <DualWheel outerStatus={getPosition("T9")!} innerStatus={getPosition("T10")!} side="left" />
            )}
            {getPosition("T11") && getPosition("T12") && (
              <DualWheel innerStatus={getPosition("T11")!} outerStatus={getPosition("T12")!} side="right" />
            )}
          </div>

          {/* Axle 4 */}
          <div className="flex justify-between w-56">
            {getPosition("T13") && getPosition("T14") && (
              <DualWheel outerStatus={getPosition("T13")!} innerStatus={getPosition("T14")!} side="left" />
            )}
            {getPosition("T15") && getPosition("T16") && (
              <DualWheel innerStatus={getPosition("T15")!} outerStatus={getPosition("T16")!} side="right" />
            )}
          </div>
        </div>
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-4 flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="sm" />
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">Rear →</div>
    </div>
  );
};

// Main component
const FleetTyreLayoutDiagram = ({ registrationNumber, fleetNumber }: FleetTyreLayoutDiagramProps) => {
  const { toast } = useToast();
  const fleetConfig = getFleetConfig(fleetNumber);
  const registrationNo = extractRegistrationNumber(registrationNumber);

  // Fetch fleet-specific tyre positions
  const { data: fleetPositions = [], isLoading } = useQuery({
    queryKey: ["fleet_positions", fleetNumber, registrationNo],
    queryFn: async () => {
      if (!fleetConfig || !fleetNumber) return [];

      const { data, error } = await supabase
        .from("fleet_tyre_positions")
        .select("*")
        .eq("fleet_number", fleetNumber)
        .eq("registration_no", registrationNo);

      if (error) throw error;
      return (data || []) as FleetPositionRow[];
    },
    enabled: !!fleetConfig,
  });

  // Fetch tyre details
  const { data: tyreDetails = [] } = useQuery({
    queryKey: ["tyre_details", registrationNumber, fleetNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyres")
        .select("*")
        .like("current_fleet_position", `%${registrationNumber}%`);

      if (error) throw error;
      return (data || []) as TyreRow[];
    },
    enabled: !!registrationNumber,
  });

  if (!fleetConfig) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">No fleet configuration found for {fleetNumber}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  // Map positions to status data
  const positionStatuses: FleetPositionStatus[] = fleetConfig.positions.map(pos => {
    const fleetPos = fleetPositions.find((fp: FleetPositionRow) => fp.position === pos.position);
    const tyreCode = fleetPos?.tyre_code;
    const tyreDetail = tyreCode
      ? tyreDetails.find((t: TyreRow) => t.serial_number === tyreCode || t.id === tyreCode)
      : null;

    return {
      position: pos.position,
      positionLabel: pos.label,
      tyreCode: tyreCode || null,
      tyreDetails: tyreDetail ? {
        brand: tyreDetail.brand,
        model: tyreDetail.model,
        size: tyreDetail.size,
        currentTreadDepth: tyreDetail.current_tread_depth,
        healthStatus: tyreDetail.tread_depth_health,
        lastInspectionDate: tyreDetail.last_inspection_date,
      } : null,
      installationDate: tyreDetail?.installation_date,
    };
  });

  const getExportData = () => {
    return positionStatuses.map((status) => ({
      position: status.position,
      positionLabel: status.positionLabel,
      serial_number: status.tyreCode || "",
      brand: status.tyreDetails?.brand || "",
      model: status.tyreDetails?.model || "",
      size: status.tyreDetails?.size || "",
      current_tread_depth: status.tyreDetails?.currentTreadDepth || null,
      tread_depth_health: status.tyreDetails?.healthStatus || null,
      installation_date: status.installationDate || null,
    }));
  };

  // Determine which diagram to render based on fleet type and position count
  const renderDiagram = () => {
    const posCount = positionStatuses.length;

    // LMV (5 positions)
    if (posCount <= 5 && positionStatuses.some(p => p.position === "V1")) {
      return <LMVDiagram positions={positionStatuses} />;
    }

    // Single Axle Truck (7 positions: V1-V6 + SP) - 4H, 6H, 30H, UD
    // Has V6 but NOT V7 - single rear axle with dual wheels
    if (
      positionStatuses.some(p => p.position === "V6") &&
      !positionStatuses.some(p => p.position === "V7")
    ) {
      return <SingleAxleTruckDiagram positions={positionStatuses} />;
    }

    // Truck/Horse (11 positions with V1-V10 + SP) - dual rear axles
    if (positionStatuses.some(p => p.position === "V1") && positionStatuses.some(p => p.position === "V10")) {
      return <TruckDiagram positions={positionStatuses} />;
    }

    // Interlink trailer (17 positions with T1-T16 + SP)
    if (posCount >= 17 && positionStatuses.some(p => p.position === "T16")) {
      return <InterlinkDiagram positions={positionStatuses} />;
    }

    // Reefer trailer (7-9 positions)
    if (positionStatuses.some(p => p.position === "T1")) {
      return <ReeferDiagram positions={positionStatuses} />;
    }

    // Fallback to LMV for small configs
    return <LMVDiagram positions={positionStatuses} />;
  };

  // Calculate summary stats
  const totalPositions = positionStatuses.length;
  const installedCount = positionStatuses.filter(p => p.tyreCode).length;
  const criticalCount = positionStatuses.filter(p => p.tyreDetails?.healthStatus === "critical").length;
  const warningCount = positionStatuses.filter(p => p.tyreDetails?.healthStatus === "warning").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Fleet Tyre Layout
              <Badge variant="secondary" className="text-sm">
                {fleetNumber}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {registrationNumber} • {fleetConfig.fleetType.charAt(0).toUpperCase() + fleetConfig.fleetType.slice(1)} • {fleetConfig.positions.length} positions
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  await exportVehicleTyresToExcel(getExportData(), { fleetNumber, registration: registrationNumber });
                  toast({ title: "Exported", description: `Tyres for ${fleetNumber} exported to Excel` });
                }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  exportVehicleTyresToPDF(getExportData(), { fleetNumber, registration: registrationNumber });
                  toast({ title: "Exported", description: `Tyres for ${fleetNumber} exported to PDF` });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-3 mt-3">
          <Badge variant="outline" className="bg-slate-50">
            {installedCount}/{totalPositions} Installed
          </Badge>
          {criticalCount > 0 && (
            <Badge variant="destructive">
              {criticalCount} Critical
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className="bg-yellow-500 hover:bg-yellow-600">
              {warningCount} Warning
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Vehicle Diagram */}
        <div className="flex justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg py-6">
          {renderDiagram()}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 items-center justify-center border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-b from-green-600 to-green-400"></div>
            <span className="text-xs">Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-b from-blue-600 to-blue-400"></div>
            <span className="text-xs">Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-b from-yellow-600 to-yellow-400"></div>
            <span className="text-xs">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-b from-red-600 to-red-400"></div>
            <span className="text-xs">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-dashed border-gray-400"></div>
            <span className="text-xs">Empty</span>
          </div>
        </div>

        {/* Position Grid (compact reference) */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Position Details</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {positionStatuses.map((status) => (
              <div
                key={status.position}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border text-xs",
                  status.tyreCode ? "bg-slate-50 dark:bg-slate-800" : "bg-gray-50 dark:bg-gray-900 border-dashed"
                )}
              >
                <Badge variant="outline" className="font-mono text-[10px] px-1">
                  {status.position}
                </Badge>
                <div className="flex-1 min-w-0">
                  {status.tyreCode ? (
                    <div className="truncate">
                      <span className="font-medium">{status.tyreDetails?.brand}</span>
                      {status.tyreDetails?.currentTreadDepth && (
                        <span className="text-muted-foreground ml-1">
                          {status.tyreDetails.currentTreadDepth}mm
                        </span>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {status.tyreDetails?.lastInspectionDate
                          ? `Last insp: ${new Date(status.tyreDetails.lastInspectionDate).toLocaleDateString()}`
                          : "No inspection recorded"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Empty</span>
                  )}
                </div>
                {status.tyreDetails?.healthStatus && (
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      status.tyreDetails.healthStatus === "excellent" && "bg-green-500",
                      status.tyreDetails.healthStatus === "good" && "bg-blue-500",
                      status.tyreDetails.healthStatus === "warning" && "bg-yellow-500",
                      status.tyreDetails.healthStatus === "critical" && "bg-red-500"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FleetTyreLayoutDiagram;