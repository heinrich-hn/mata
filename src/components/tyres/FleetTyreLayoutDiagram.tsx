import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
import { AlertCircle, AlertTriangle, CheckCircle, FileSpreadsheet, FileText } from "lucide-react";

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
  serialNumber: string | null;
  tyreDetails: {
    brand?: string;
    model?: string;
    size?: string;
    type?: string;
    dotCode?: string;
    currentTreadDepth?: number;
    initialTreadDepth?: number;
    pressureRating?: string;
    healthStatus?: string;
    status?: string;
    lastInspectionDate?: string;
    purchaseDate?: string;
    notes?: string;
  } | null;
  installationDate?: string | null;
}

// Tyre wheel component — professional look with proper rubber/rim styling
interface TyreWheelProps {
  status: FleetPositionStatus;
  size?: "sm" | "md" | "lg";
  isDual?: boolean;
}

const TyreWheel = ({ status, size = "md", isDual = false }: TyreWheelProps) => {
  const sizeClasses = {
    sm: "w-10 h-14",
    md: "w-12 h-16",
    lg: "w-14 h-[72px]",
  };

  const lastInspectionDate = status.tyreDetails?.lastInspectionDate
    ? new Date(status.tyreDetails.lastInspectionDate)
    : null;
  const daysSinceInspection = lastInspectionDate && !isNaN(lastInspectionDate.getTime())
    ? Math.floor((Date.now() - lastInspectionDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const getHealthBorder = (healthStatus?: string) => {
    switch (healthStatus) {
      case "excellent": return "ring-2 ring-green-500";
      case "good": return "ring-2 ring-blue-500";
      case "warning": return "ring-2 ring-yellow-500";
      case "critical": return "ring-2 ring-red-500 animate-pulse";
      default: return "";
    }
  };

  const getHealthIcon = (healthStatus?: string) => {
    switch (healthStatus) {
      case "excellent":
      case "good":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
      case "critical":
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
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
              "relative cursor-pointer transition-transform hover:scale-110",
              isDual ? "mx-px" : ""
            )}
          >
            {isEmpty ? (
              /* Empty slot — dashed outline */
              <div className="w-full h-full rounded-[5px] border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-gray-400">{status.position}</span>
              </div>
            ) : (
              /* Filled tyre — dark rubber look with rim and tread */
              <div className={cn(
                "w-full h-full rounded-[5px] overflow-hidden flex flex-col relative",
                getHealthBorder(status.tyreDetails?.healthStatus)
              )}>
                {/* Outer rubber */}
                <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-900 to-gray-800 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700" />
                {/* Tread grooves */}
                <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-evenly px-[3px] py-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-[2px]">
                      <div className="flex-1 h-[2px] rounded-full bg-gray-600/50" />
                      <div className="w-[3px]" />
                      <div className="flex-1 h-[2px] rounded-full bg-gray-600/50" />
                    </div>
                  ))}
                </div>
                {/* Centre rim/hub */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[60%] h-[45%] rounded-[3px] bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600 border border-slate-500/40 flex items-center justify-center shadow-inner">
                    <span className="text-[8px] font-bold text-slate-800 dark:text-slate-200 leading-none">
                      {status.position}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Health indicator dot */}
            {!isEmpty && status.tyreDetails?.healthStatus && (
              <div className="absolute -top-1.5 -right-1.5 z-20 bg-white dark:bg-gray-950 rounded-full p-px">
                {getHealthIcon(status.tyreDetails.healthStatus)}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{status.positionLabel}</p>
            {status.tyreCode ? (
              <>
                {status.serialNumber && (
                  <p className="text-xs font-mono font-semibold">{status.serialNumber}</p>
                )}
                {status.tyreDetails && (
                  <>
                    <p className="text-xs">{status.tyreDetails.brand} {status.tyreDetails.model}</p>
                    <p className="text-xs text-muted-foreground">{status.tyreDetails.size}</p>
                    {status.tyreDetails.currentTreadDepth != null && (
                      <p className="text-xs">Tread: <span className="font-medium">{status.tyreDetails.currentTreadDepth}mm</span></p>
                    )}
                    <p className="text-xs text-muted-foreground">
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
    <div className="relative flex flex-col items-center py-6 px-4">
      <div className="text-xs font-medium text-muted-foreground mb-2 tracking-wide uppercase">Front</div>

      <div className="relative">
        {/* Truck body outline */}
        <svg viewBox="0 0 160 340" className="w-40 h-auto" aria-label="Truck chassis">
          {/* Cab */}
          <rect x="30" y="8" width="100" height="70" rx="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
          <rect x="40" y="18" width="80" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <text x="80" y="56" textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">CAB</text>

          {/* Chassis */}
          <rect x="35" y="82" width="90" height="230" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" className="text-slate-300" />
          {/* Frame rails */}
          <line x1="50" y1="82" x2="50" y2="312" stroke="currentColor" strokeWidth="2" className="text-slate-350" />
          <line x1="110" y1="82" x2="110" y2="312" stroke="currentColor" strokeWidth="2" className="text-slate-350" />

          {/* Axle lines */}
          <line x1="10" y1="45" x2="150" y2="45" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <line x1="10" y1="210" x2="150" y2="210" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <line x1="10" y1="265" x2="150" y2="265" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />

          {/* Axle labels */}
          <text x="80" y="100" textAnchor="middle" className="fill-slate-400 text-[8px]">STEER AXLE</text>
          <text x="80" y="200" textAnchor="middle" className="fill-slate-400 text-[8px]">DRIVE AXLE 1</text>
          <text x="80" y="255" textAnchor="middle" className="fill-slate-400 text-[8px]">DRIVE AXLE 2</text>

          {/* Fifth wheel */}
          <ellipse cx="80" cy="300" rx="25" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <text x="80" y="303" textAnchor="middle" className="fill-slate-400 text-[7px]">5TH WHEEL</text>
        </svg>

        {/* Wheel positions overlaid */}
        <div className="absolute inset-0 flex flex-col items-center">
          {/* Front Axle */}
          <div className="flex justify-between w-52 absolute" style={{ top: "26px" }}>
            {getPosition("V1") && <TyreWheel status={getPosition("V1")!} size="lg" />}
            {getPosition("V2") && <TyreWheel status={getPosition("V2")!} size="lg" />}
          </div>

          {/* Rear Axle 1 (Dual) */}
          <div className="flex justify-between w-56 absolute" style={{ top: "174px" }}>
            {getPosition("V3") && getPosition("V4") && (
              <DualWheel outerStatus={getPosition("V3")!} innerStatus={getPosition("V4")!} side="left" />
            )}
            {getPosition("V5") && getPosition("V6") && (
              <DualWheel innerStatus={getPosition("V5")!} outerStatus={getPosition("V6")!} side="right" />
            )}
          </div>

          {/* Rear Axle 2 (Dual) */}
          <div className="flex justify-between w-56 absolute" style={{ top: "230px" }}>
            {getPosition("V7") && getPosition("V8") && (
              <DualWheel outerStatus={getPosition("V7")!} innerStatus={getPosition("V8")!} side="left" />
            )}
            {getPosition("V9") && getPosition("V10") && (
              <DualWheel innerStatus={getPosition("V9")!} outerStatus={getPosition("V10")!} side="right" />
            )}
          </div>
        </div>
      </div>

      {/* Spare tyre */}
      {getPosition("SP") && (
        <div className="mt-6 flex flex-col items-center">
          <span className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="md" />
        </div>
      )}

      <div className="text-xs font-medium text-muted-foreground mt-3 tracking-wide uppercase">Rear</div>
    </div>
  );
};

// Single Axle Truck diagram (7 positions - 4H, 6H, 30H, UD)
// 2 steer tyres + 4 drive tyres (dual on single rear axle) + 1 spare
const SingleAxleTruckDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="relative flex flex-col items-center py-6 px-4">
      <div className="text-xs font-medium text-muted-foreground mb-2 tracking-wide uppercase">Front</div>

      <div className="relative">
        <svg viewBox="0 0 160 260" className="w-36 h-auto" aria-label="Single axle truck chassis">
          {/* Cab */}
          <rect x="30" y="8" width="100" height="70" rx="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
          <rect x="40" y="18" width="80" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <text x="80" y="56" textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">CAB</text>

          {/* Chassis */}
          <rect x="35" y="82" width="90" height="150" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" className="text-slate-300" />
          <line x1="50" y1="82" x2="50" y2="232" stroke="currentColor" strokeWidth="2" className="text-slate-350" />
          <line x1="110" y1="82" x2="110" y2="232" stroke="currentColor" strokeWidth="2" className="text-slate-350" />

          {/* Axle lines */}
          <line x1="10" y1="45" x2="150" y2="45" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <line x1="10" y1="180" x2="150" y2="180" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />

          {/* Axle labels */}
          <text x="80" y="100" textAnchor="middle" className="fill-slate-400 text-[8px]">STEER</text>
          <text x="80" y="170" textAnchor="middle" className="fill-slate-400 text-[8px]">DRIVE</text>

          {/* Fifth wheel */}
          <ellipse cx="80" cy="220" rx="25" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <text x="80" y="223" textAnchor="middle" className="fill-slate-400 text-[7px]">5TH WHEEL</text>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center">
          {/* Front Steer Axle */}
          <div className="flex justify-between w-48 absolute" style={{ top: "26px" }}>
            {getPosition("V1") && <TyreWheel status={getPosition("V1")!} size="lg" />}
            {getPosition("V2") && <TyreWheel status={getPosition("V2")!} size="lg" />}
          </div>

          {/* Rear Drive Axle (Dual) */}
          <div className="flex justify-between w-52 absolute" style={{ top: "148px" }}>
            {getPosition("V3") && getPosition("V4") && (
              <DualWheel outerStatus={getPosition("V3")!} innerStatus={getPosition("V4")!} side="left" />
            )}
            {getPosition("V5") && getPosition("V6") && (
              <DualWheel innerStatus={getPosition("V5")!} outerStatus={getPosition("V6")!} side="right" />
            )}
          </div>
        </div>
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-6 flex flex-col items-center">
          <span className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="md" />
        </div>
      )}

      <div className="text-xs font-medium text-muted-foreground mt-3 tracking-wide uppercase">Rear</div>
    </div>
  );
};

// LMV/Light Vehicle diagram (5 positions - 4 corners + spare)
const LMVDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="relative flex flex-col items-center py-6 px-4">
      <div className="text-xs font-medium text-muted-foreground mb-2 tracking-wide uppercase">Front</div>

      <div className="relative">
        <svg viewBox="0 0 140 220" className="w-32 h-auto" aria-label="Light vehicle">
          {/* Body outline */}
          <rect x="25" y="8" width="90" height="200" rx="12" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
          {/* Windshield */}
          <rect x="35" y="18" width="70" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          {/* Roof */}
          <rect x="35" y="55" width="70" height="50" rx="3" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" className="text-slate-200" />
          {/* Rear window */}
          <rect x="38" y="115" width="64" height="25" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />

          {/* Axle lines */}
          <line x1="8" y1="40" x2="132" y2="40" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />
          <line x1="8" y1="170" x2="132" y2="170" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" />

          <text x="70" y="90" textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">LMV</text>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center">
          {/* Front wheels */}
          <div className="flex justify-between w-40 absolute" style={{ top: "22px" }}>
            {getPosition("V1") && <TyreWheel status={getPosition("V1")!} size="md" />}
            {getPosition("V2") && <TyreWheel status={getPosition("V2")!} size="md" />}
          </div>

          {/* Rear wheels */}
          <div className="flex justify-between w-40 absolute" style={{ top: "142px" }}>
            {getPosition("V3") && <TyreWheel status={getPosition("V3")!} size="md" />}
            {getPosition("V4") && <TyreWheel status={getPosition("V4")!} size="md" />}
          </div>
        </div>
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-6 flex flex-col items-center">
          <span className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="sm" />
        </div>
      )}

      <div className="text-xs font-medium text-muted-foreground mt-3 tracking-wide uppercase">Rear</div>
    </div>
  );
};

// Reefer Trailer diagram — Super Single config (T1-T6 = 3 axles × 2 singles + SP)
// Also supports dual-wheel reefer if T3 is on same axle as T1 (i.e. >6 trailer positions)
const ReeferDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);
  const posCount = positions.filter(p => p.position.startsWith("T")).length;
  const isSuperSingle = posCount <= 6;
  const hasThirdAxle = positions.some(p => p.position === "T5");

  return (
    <div className="flex flex-col items-center py-6 px-4 gap-1">
      <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Kingpin</div>

      {/* Kingpin icon */}
      <svg viewBox="0 0 40 20" className="w-8 h-4">
        <circle cx="20" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
        <line x1="20" y1="13" x2="20" y2="20" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
      </svg>

      {/* Trailer body with reefer unit */}
      <div className="border-2 border-slate-400 rounded px-6 py-3 flex flex-col items-center gap-2 min-w-[160px]">
        {/* Reefer unit header */}
        <div className="border border-slate-300 rounded px-3 py-1 w-full text-center">
          <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Reefer Unit</span>
        </div>

        {/* Cargo area */}
        <div className="border border-dashed border-slate-300 rounded px-4 py-6 w-full text-center">
          <span className="text-[9px] text-slate-300">CARGO</span>
        </div>
      </div>

      {/* Axle section — flows naturally, no overlap possible */}
      <div className="flex flex-col items-center gap-5 mt-2">
        {isSuperSingle ? (
          <>
            {/* Axle 1: T1 left, T2 right */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 1</span>
              <div className="flex items-center gap-8">
                {getPosition("T1") && <TyreWheel status={getPosition("T1")!} size="md" />}
                <div className="w-10 h-[1.5px] bg-slate-300" />
                {getPosition("T2") && <TyreWheel status={getPosition("T2")!} size="md" />}
              </div>
            </div>

            {/* Axle 2: T3 left, T4 right */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 2</span>
              <div className="flex items-center gap-8">
                {getPosition("T3") && <TyreWheel status={getPosition("T3")!} size="md" />}
                <div className="w-10 h-[1.5px] bg-slate-300" />
                {getPosition("T4") && <TyreWheel status={getPosition("T4")!} size="md" />}
              </div>
            </div>

            {/* Axle 3: T5 left, T6 right */}
            {hasThirdAxle && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 3</span>
                <div className="flex items-center gap-8">
                  {getPosition("T5") && <TyreWheel status={getPosition("T5")!} size="md" />}
                  <div className="w-10 h-[1.5px] bg-slate-300" />
                  {getPosition("T6") && <TyreWheel status={getPosition("T6")!} size="md" />}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Dual Wheel Axle 1 */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 1</span>
              <div className="flex items-center gap-6">
                {getPosition("T1") && getPosition("T2") && (
                  <DualWheel outerStatus={getPosition("T1")!} innerStatus={getPosition("T2")!} side="left" />
                )}
                <div className="w-8 h-[1.5px] bg-slate-300" />
                {getPosition("T3") && getPosition("T4") && (
                  <DualWheel innerStatus={getPosition("T3")!} outerStatus={getPosition("T4")!} side="right" />
                )}
              </div>
            </div>

            {/* Dual Wheel Axle 2 */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 2</span>
              <div className="flex items-center gap-6">
                {getPosition("T5") && getPosition("T6") && (
                  <DualWheel outerStatus={getPosition("T5")!} innerStatus={getPosition("T6")!} side="left" />
                )}
                <div className="w-8 h-[1.5px] bg-slate-300" />
                {getPosition("T7") && getPosition("T8") && (
                  <DualWheel innerStatus={getPosition("T7")!} outerStatus={getPosition("T8")!} side="right" />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-4 flex flex-col items-center">
          <span className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="sm" />
        </div>
      )}

      <div className="text-xs font-medium text-muted-foreground mt-2 tracking-wide uppercase">Rear</div>
    </div>
  );
};

// Interlink Trailer diagram (17 positions - 4 axles with dual wheels)
const InterlinkDiagram = ({ positions }: TruckDiagramProps) => {
  const getPosition = (pos: string) => positions.find(p => p.position === pos);

  return (
    <div className="flex flex-col items-center py-6 px-4 gap-1">
      <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Kingpin</div>

      {/* Kingpin icon */}
      <svg viewBox="0 0 40 20" className="w-8 h-4">
        <circle cx="20" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
        <line x1="20" y1="13" x2="20" y2="20" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
      </svg>

      {/* Trailer body */}
      <div className="border-2 border-slate-400 rounded px-6 py-3 flex flex-col items-center gap-1 min-w-[180px]">
        {/* Panel ribs + cargo label */}
        <div className="w-full space-y-3 py-4">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-[0.5px] bg-slate-300 w-full" />
          ))}
        </div>
        <span className="text-[9px] text-slate-300">CARGO</span>
        <div className="w-full space-y-3 py-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[0.5px] bg-slate-300 w-full" />
          ))}
        </div>
      </div>

      {/* 4 Axles with dual wheels — flows naturally, no overlap */}
      <div className="flex flex-col items-center gap-5 mt-2">
        {/* Axle 1: T1-T4 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 1</span>
          <div className="flex items-center gap-4">
            {getPosition("T1") && getPosition("T2") && (
              <DualWheel outerStatus={getPosition("T1")!} innerStatus={getPosition("T2")!} side="left" />
            )}
            <div className="w-8 h-[1.5px] bg-slate-300" />
            {getPosition("T3") && getPosition("T4") && (
              <DualWheel innerStatus={getPosition("T3")!} outerStatus={getPosition("T4")!} side="right" />
            )}
          </div>
        </div>

        {/* Axle 2: T5-T8 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 2</span>
          <div className="flex items-center gap-4">
            {getPosition("T5") && getPosition("T6") && (
              <DualWheel outerStatus={getPosition("T5")!} innerStatus={getPosition("T6")!} side="left" />
            )}
            <div className="w-8 h-[1.5px] bg-slate-300" />
            {getPosition("T7") && getPosition("T8") && (
              <DualWheel innerStatus={getPosition("T7")!} outerStatus={getPosition("T8")!} side="right" />
            )}
          </div>
        </div>

        {/* Axle 3: T9-T12 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 3</span>
          <div className="flex items-center gap-4">
            {getPosition("T9") && getPosition("T10") && (
              <DualWheel outerStatus={getPosition("T9")!} innerStatus={getPosition("T10")!} side="left" />
            )}
            <div className="w-8 h-[1.5px] bg-slate-300" />
            {getPosition("T11") && getPosition("T12") && (
              <DualWheel innerStatus={getPosition("T11")!} outerStatus={getPosition("T12")!} side="right" />
            )}
          </div>
        </div>

        {/* Axle 4: T13-T16 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-medium text-slate-400 uppercase">Axle 4</span>
          <div className="flex items-center gap-4">
            {getPosition("T13") && getPosition("T14") && (
              <DualWheel outerStatus={getPosition("T13")!} innerStatus={getPosition("T14")!} side="left" />
            )}
            <div className="w-8 h-[1.5px] bg-slate-300" />
            {getPosition("T15") && getPosition("T16") && (
              <DualWheel innerStatus={getPosition("T15")!} outerStatus={getPosition("T16")!} side="right" />
            )}
          </div>
        </div>
      </div>

      {/* Spare */}
      {getPosition("SP") && (
        <div className="mt-4 flex flex-col items-center">
          <span className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Spare</span>
          <TyreWheel status={getPosition("SP")!} size="sm" />
        </div>
      )}

      <div className="text-xs font-medium text-muted-foreground mt-2 tracking-wide uppercase">Rear</div>
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

  // Fetch tyre details — query by both fleet position text AND tyre codes from fleet_tyre_positions
  const tyreCodes = fleetPositions
    .map((fp: FleetPositionRow) => fp.tyre_code)
    .filter((c): c is string => !!c && !c.startsWith("NEW_CODE_"));

  const { data: tyreDetails = [] } = useQuery({
    queryKey: ["tyre_details", registrationNumber, fleetNumber, tyreCodes.join(",")],
    queryFn: async () => {
      const results: TyreRow[] = [];

      // Query 1: by current_fleet_position containing registration
      const { data: byPos } = await supabase
        .from("tyres")
        .select("*")
        .like("current_fleet_position", `%${registrationNumber}%`);
      if (byPos) results.push(...byPos);

      // Query 2: by tyre codes (id or serial_number) from fleet_tyre_positions
      if (tyreCodes.length > 0) {
        const { data: byId } = await supabase
          .from("tyres")
          .select("*")
          .in("id", tyreCodes);
        if (byId) {
          for (const t of byId) {
            if (!results.some(r => r.id === t.id)) results.push(t);
          }
        }

        // Also try matching by serial_number in case tyre_code stores serial numbers
        const { data: bySerial } = await supabase
          .from("tyres")
          .select("*")
          .in("serial_number", tyreCodes);
        if (bySerial) {
          for (const t of bySerial) {
            if (!results.some(r => r.id === t.id)) results.push(t);
          }
        }
      }

      return results as TyreRow[];
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
      serialNumber: tyreDetail?.serial_number || null,
      tyreDetails: tyreDetail ? {
        brand: tyreDetail.brand,
        model: tyreDetail.model,
        size: tyreDetail.size,
        type: tyreDetail.type,
        dotCode: tyreDetail.dot_code,
        currentTreadDepth: tyreDetail.current_tread_depth,
        initialTreadDepth: tyreDetail.initial_tread_depth,
        pressureRating: tyreDetail.pressure_health,
        healthStatus: tyreDetail.tread_depth_health,
        status: tyreDetail.condition,
        lastInspectionDate: tyreDetail.last_inspection_date,
        purchaseDate: tyreDetail.purchase_date,
        notes: tyreDetail.notes,
      } : null,
      installationDate: tyreDetail?.installation_date,
    };
  });

  const getExportData = () => {
    return positionStatuses.map((status) => ({
      position: status.position,
      positionLabel: status.positionLabel,
      serial_number: status.tyreDetails?.dotCode || status.tyreCode || "",
      brand: status.tyreDetails?.brand || "",
      model: status.tyreDetails?.model || "",
      size: status.tyreDetails?.size || "",
      type: status.tyreDetails?.type || "",
      dot_code: status.tyreDetails?.dotCode || "",
      status: status.tyreDetails?.status || "",
      initial_tread_depth: status.tyreDetails?.initialTreadDepth ?? null,
      current_tread_depth: status.tyreDetails?.currentTreadDepth ?? null,
      tread_depth_health: status.tyreDetails?.healthStatus || null,
      pressure_rating: status.tyreDetails?.pressureRating ?? null,
      installation_date: status.installationDate || null,
      purchase_date: status.tyreDetails?.purchaseDate || null,
      notes: status.tyreDetails?.notes || "",
    }));
  };

  // Determine which diagram to render based on fleet type and position count
  const renderDiagram = () => {
    const posCount = positionStatuses.length;

    // Use fleetConfig.fleetType when available for correct diagram selection
    if (fleetConfig.fleetType === "reefer") {
      return <ReeferDiagram positions={positionStatuses} />;
    }

    if (fleetConfig.fleetType === "trailer") {
      return <InterlinkDiagram positions={positionStatuses} />;
    }

    // Horse/vehicle types — determine by position count
    // LMV (5 positions or fewer)
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

    // Fallback: trailer-type positions (T-prefix)
    if (positionStatuses.some(p => p.position === "T1")) {
      if (posCount >= 17) {
        return <InterlinkDiagram positions={positionStatuses} />;
      }
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await exportVehicleTyresToExcel(getExportData(), { fleetNumber, registration: registrationNumber });
                  toast({ title: "Exported", description: `Tyres for ${fleetNumber} exported to Excel` });
                } catch (err) {
                  console.error("Excel export failed:", err);
                  toast({ title: "Export Failed", description: "Could not export to Excel.", variant: "destructive" });
                }
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  exportVehicleTyresToPDF(getExportData(), { fleetNumber, registration: registrationNumber });
                  toast({ title: "Exported", description: `Tyres for ${fleetNumber} exported to PDF` });
                } catch (err) {
                  console.error("PDF export failed:", err);
                  toast({ title: "Export Failed", description: "Could not export to PDF.", variant: "destructive" });
                }
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
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
            <div className="w-4 h-4 rounded-full bg-gradient-to-b from-gray-800 to-gray-900 ring-2 ring-green-500"></div>
            <span className="text-xs">Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-b from-gray-800 to-gray-900 ring-2 ring-blue-500"></div>
            <span className="text-xs">Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-b from-gray-800 to-gray-900 ring-2 ring-yellow-500"></div>
            <span className="text-xs">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-b from-gray-800 to-gray-900 ring-2 ring-red-500"></div>
            <span className="text-xs">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-400"></div>
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
                    <div>
                      {status.serialNumber && (
                        <div className="font-mono text-[10px] text-foreground font-semibold truncate">
                          {status.serialNumber}
                        </div>
                      )}
                      <div className="truncate">
                        <span className="font-medium">{status.tyreDetails?.brand} {status.tyreDetails?.model}</span>
                        {status.tyreDetails?.currentTreadDepth != null && (
                          <span className="text-muted-foreground ml-1">
                            {status.tyreDetails.currentTreadDepth}mm
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {status.tyreDetails?.size}
                        {status.tyreDetails?.lastInspectionDate
                          ? ` • Insp: ${new Date(status.tyreDetails.lastInspectionDate).toLocaleDateString()}`
                          : ""}
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