import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PressureHealthStatus } from "@/types/tyre";
import { AlertTriangle, Gauge, Info, TrendingDown, TrendingUp } from "lucide-react";

interface PressureIndicatorProps {
  current: number;
  recommended?: number;
  min?: number;
  max?: number;
  health: PressureHealthStatus;
  unit?: "psi" | "kpa" | "bar";
  className?: string;
  showDetails?: boolean;
  showActions?: boolean;
  onActionClick?: (action: "inflate" | "deflate" | "check") => void;
}

// Configuration for pressure states
const PRESSURE_CONFIG = {
  normal: {
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-300",
    barColor: "bg-emerald-500",
    icon: Gauge,
    label: "Normal",
    description: "Pressure is within optimal range",
    alert: null,
    action: null,
  },
  low: {
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300",
    barColor: "bg-amber-500",
    icon: TrendingDown,
    label: "Low",
    description: "Pressure is below recommended level",
    alert: {
      message: "Pressure is below recommended. Inflate to optimal level.",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    },
    action: "inflate",
  },
  high: {
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
    barColor: "bg-orange-500",
    icon: TrendingUp,
    label: "High",
    description: "Pressure is above recommended level",
    alert: {
      message: "Pressure is above recommended. Deflate to optimal level.",
      bg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-700",
    },
    action: "deflate",
  },
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
    barColor: "bg-red-500",
    icon: AlertTriangle,
    label: "Critical",
    description: "Pressure is dangerously low",
    alert: {
      message: "Pressure is critically low. Check for punctures immediately.",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
    },
    action: "check",
  },
} as const;

// Unit conversions and display
const UNIT_CONFIG = {
  psi: {
    symbol: "PSI",
    conversion: 1,
    precision: 0,
  },
  kpa: {
    symbol: "kPa",
    conversion: 6.89476,
    precision: 1,
  },
  bar: {
    symbol: "bar",
    conversion: 0.0689476,
    precision: 2,
  },
} as const;

const PressureIndicator = ({
  current,
  recommended = 110,
  min = 0,
  max = 120,
  health,
  unit = "psi",
  className,
  showDetails = true,
  showActions = true,
  onActionClick,
}: PressureIndicatorProps) => {
  // Validate inputs
  if (current < 0) throw new Error("Pressure cannot be negative");
  if (recommended <= min) throw new Error("Recommended pressure must be greater than minimum");
  if (max <= recommended) throw new Error("Maximum pressure must be greater than recommended");
  if (current > max * 1.5) throw new Error("Pressure reading is unrealistically high");

  // Get configuration
  const config = PRESSURE_CONFIG[health];
  const unitConfig = UNIT_CONFIG[unit];
  const Icon = config.icon;

  // Convert values based on unit
  const convertValue = (value: number) => value * unitConfig.conversion;
  const formatValue = (value: number) => {
    const converted = convertValue(value);
    return converted % 1 === 0 ?
      converted.toString() :
      converted.toFixed(unitConfig.precision);
  };

  // Calculate percentages for visualization
  const currentPercentage = Math.max(0, Math.min(100, (current / max) * 100));
  const recommendedPercentage = (recommended / max) * 100;
  const minPercentage = (min / max) * 100;

  // Calculate deviation from recommended
  const deviation = current - recommended;
  const deviationPercentage = Math.abs(deviation / recommended) * 100;

  // Determine zone classification
  const getPressureZone = () => {
    if (current <= min) return "dangerously-low";
    if (current < recommended * 0.9) return "low";
    if (current < recommended * 1.1) return "optimal";
    if (current < max * 0.95) return "high";
    return "dangerously-high";
  };

  const pressureZone = getPressureZone();

  // Handle action click
  const handleActionClick = (action: typeof config.action) => {
    if (action && onActionClick) {
      onActionClick(action);
    }
  };

  return (
    <TooltipProvider>
      <Card className={cn("p-4 transition-all duration-300 hover:shadow-md", className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground font-medium">Tyre Pressure</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Measured in {unitConfig.symbol}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums">
                {formatValue(current)}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                {unitConfig.symbol}
              </p>
            </div>

            {/* Status badge with deviation */}
            <div className="mt-2">
              <Badge
                variant={health === "critical" ? "destructive" : "outline"}
                className={cn(
                  config.color,
                  "text-xs font-medium gap-1",
                  config.action && "cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={() => handleActionClick(config.action)}
              >
                <Icon className="w-3 h-3" />
                {config.label}
                {deviation !== 0 && (
                  <span className="ml-1 text-xs opacity-80">
                    ({deviation > 0 ? "+" : ""}{formatValue(deviation)})
                  </span>
                )}
              </Badge>
            </div>
          </div>

          <div className={cn(
            "p-2 rounded-lg transition-transform hover:scale-110",
            config.bgColor,
            config.action && "cursor-pointer"
          )} onClick={() => handleActionClick(config.action)}>
            <Icon className="w-8 h-8" />
          </div>
        </div>

        {/* Pressure gauge visualization */}
        <div className="space-y-4">
          <div className="relative">
            {/* Main bar */}
            <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
              {/* Safe zone indicators */}
              <div
                className="absolute inset-y-0 bg-emerald-500/20"
                style={{
                  left: `${minPercentage}%`,
                  width: `${recommendedPercentage - minPercentage}%`
                }}
              />

              {/* Current pressure indicator */}
              <div
                className={cn(
                  "absolute inset-y-0 rounded-full transition-all duration-700 ease-out",
                  config.barColor
                )}
                style={{ width: `${currentPercentage}%` }}
              />

              {/* Recommended marker */}
              <div className="group">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-0.5 bg-blue-600 h-8 -mt-1"
                  style={{ left: `${recommendedPercentage}%` }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
                </div>
                <div className="absolute -top-6 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg">
                    Recommended: {formatValue(recommended)} {unitConfig.symbol}
                  </div>
                </div>
              </div>
            </div>

            {/* Scale labels */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{formatValue(min)}</span>
              <span className="text-blue-600 font-medium">
                Target: {formatValue(recommended)}
              </span>
              <span>{formatValue(max)}</span>
            </div>
          </div>

          {/* Detailed metrics */}
          {showDetails && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Current Status</div>
                <div className={cn("p-2 rounded text-center", config.bgColor)}>
                  <div className={cn("text-sm font-semibold", config.color)}>
                    {config.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {config.description}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Deviation</div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-center">
                  <div className={cn(
                    "text-sm font-semibold",
                    deviation === 0 ? "text-emerald-600" :
                      deviation < 0 ? "text-amber-600" : "text-orange-600"
                  )}>
                    {deviation > 0 ? "+" : ""}{formatValue(deviation)} {unitConfig.symbol}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {deviationPercentage.toFixed(1)}% from target
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pressure zone indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", config.barColor)} />
              <span className="text-sm font-medium">
                Zone: <span className={config.color}>{pressureZone.replace("-", " ")}</span>
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {currentPercentage.toFixed(0)}% of max
            </span>
          </div>
        </div>

        {/* Alert messages */}
        <div className={cn(
          "mt-4 p-3 rounded-md transition-all duration-300",
          config.alert?.bg || "bg-gray-50 dark:bg-gray-900",
          config.alert?.border || "border-gray-200 dark:border-gray-800"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn("p-1 rounded", config.bgColor)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1 text-sm">
                {config.alert ? `⚠ ${config.label} Pressure` : "✓ Optimal Pressure"}
              </p>
              <p className="text-xs leading-relaxed">
                {config.alert?.message || "Pressure is within the optimal range for performance and safety."}
              </p>

              {/* Action buttons */}
              {showActions && config.action && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant={health === "critical" ? "destructive" : "default"}
                    className="text-xs h-7"
                    onClick={() => handleActionClick(config.action)}
                  >
                    {config.action === "inflate" && "Inflate Tyre"}
                    {config.action === "deflate" && "Deflate Tyre"}
                    {config.action === "check" && "Check Tyre"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => handleActionClick("check")}
                  >
                    View Details
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Safety note for critical pressure */}
        {health === "critical" && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400 animate-pulse">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">⚠ Safety Warning</p>
                <p>Do not drive with critically low pressure. Risk of tyre damage and accident.</p>
              </div>
            </div>
          </div>
        )}

        {/* Additional info for normal pressure */}
        {health === "normal" && (
          <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded text-xs text-emerald-700 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <Gauge className="w-3 h-3" />
              <span>Maintain pressure for optimal fuel efficiency and tyre life.</span>
            </div>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
};

// Helper function to determine health status from pressure values
export default PressureIndicator;
