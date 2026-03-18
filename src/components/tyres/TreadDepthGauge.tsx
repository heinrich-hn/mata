import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { TyreHealthStatus } from "@/types/tyre";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TreadDepthGaugeProps {
  current: number;
  minimum: number;
  factory?: number;
  health: TyreHealthStatus;
  className?: string;
  showLabels?: boolean;
  showAlerts?: boolean;
  size?: "sm" | "md" | "lg";
  onHealthClick?: (health: TyreHealthStatus) => void;
}

// Configuration for different health states
const HEALTH_CONFIG = {
  excellent: {
    color: "text-green-600",
    bgColor: "bg-green-500",
    gaugeColor: "bg-green-500",
    icon: CheckCircle2,
    label: "Excellent",
    description: "Tread depth is in excellent condition",
    alert: null,
  },
  good: {
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    gaugeColor: "bg-blue-500",
    icon: CheckCircle2,
    label: "Good",
    description: "Tread depth is in good condition",
    alert: null,
  },
  warning: {
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    gaugeColor: "bg-amber-500",
    icon: AlertCircle,
    label: "Warning",
    description: "Tread depth is approaching minimum",
    alert: {
      message: "Tread depth approaching minimum. Schedule replacement soon.",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    },
  },
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-500",
    gaugeColor: "bg-red-500",
    icon: AlertTriangle,
    label: "Critical",
    description: "Tread depth below safe minimum",
    alert: {
      message: "Tread depth below safe minimum. Schedule replacement immediately.",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
    },
  },
} as const;

const SIZE_CONFIG = {
  sm: {
    cardPadding: "p-3",
    valueSize: "text-xl",
    labelSize: "text-xs",
    iconSize: "w-6 h-6",
    gaugeHeight: "h-2",
    textSize: "text-xs",
  },
  md: {
    cardPadding: "p-4",
    valueSize: "text-2xl",
    labelSize: "text-sm",
    iconSize: "w-8 h-8",
    gaugeHeight: "h-4",
    textSize: "text-sm",
  },
  lg: {
    cardPadding: "p-6",
    valueSize: "text-3xl",
    labelSize: "text-base",
    iconSize: "w-10 h-10",
    gaugeHeight: "h-4",
    textSize: "text-base",
  },
} as const;

const TreadDepthGauge = ({
  current,
  minimum,
  factory = 16,
  health,
  className,
  showLabels = true,
  showAlerts = true,
  size = "md",
  onHealthClick,
}: TreadDepthGaugeProps) => {
  // Validate inputs
  if (current < 0) throw new Error("Current tread depth cannot be negative");
  if (minimum < 0) throw new Error("Minimum tread depth cannot be negative");
  if (factory < minimum) throw new Error("Factory tread depth must be greater than minimum");

  // Calculate safe range percentage
  const safeRange = factory - minimum;
  const usedDepth = current - minimum;
  const percentage = Math.max(0, Math.min(100, (usedDepth / safeRange) * 100));
  
  // Get health configuration
  const config = HEALTH_CONFIG[health];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  // Calculate remaining tread depth percentage
  const remainingPercentage = Math.max(0, (current / factory) * 100);

  // Format value with appropriate precision
  const formatValue = (value: number) => {
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  };

  // Handle health badge click
  const handleHealthClick = () => {
    if (onHealthClick) {
      onHealthClick(health);
    }
  };

  return (
    <TooltipProvider>
      <Card className={cn(
        sizeConfig.cardPadding,
        "transition-all duration-300 hover:shadow-md",
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <div>
            {showLabels && (
              <div className="flex items-center gap-2 mb-1">
                <p className={cn(sizeConfig.labelSize, "text-muted-foreground font-medium")}>
                  Tread Depth
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Measured tread depth in millimeters</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            <p className={cn(sizeConfig.valueSize, "font-bold tabular-nums")}>
              {formatValue(current)}<span className="text-sm font-normal text-muted-foreground ml-1">mm</span>
            </p>
            
            {/* Remaining tread percentage badge */}
            <div className="mt-2">
              <Badge 
                variant="outline" 
                className={cn(
                  config.color,
                  "text-xs font-medium",
                  onHealthClick && "cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={handleHealthClick}
              >
                {config.label} • {remainingPercentage.toFixed(0)}% remaining
              </Badge>
            </div>
          </div>
          
          <div className={cn(
            config.color,
            "transition-transform hover:scale-110",
            onHealthClick && "cursor-pointer"
          )} onClick={handleHealthClick}>
            <Icon className={sizeConfig.iconSize} />
          </div>
        </div>

        {/* Gauge visualization */}
        <div className="space-y-3">
          <div className="relative">
            <div className={cn(
              sizeConfig.gaugeHeight,
              "bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden"
            )}>
              <div
                className={cn(
                  sizeConfig.gaugeHeight,
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                  config.gaugeColor
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            {/* Reference markers */}
            <div className="flex justify-between mt-1 px-1">
              <div className="text-xs text-muted-foreground">{minimum}mm</div>
              <div className="text-xs text-muted-foreground text-center">
                Current: {formatValue(current)}mm
              </div>
              <div className="text-xs text-muted-foreground">{factory}mm</div>
            </div>
          </div>

          {/* Detailed metrics */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
              <p className={cn(sizeConfig.textSize, "font-semibold")}>{formatValue(minimum)}</p>
              <p className="text-xs text-muted-foreground">Minimum</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
              <p className={cn(sizeConfig.textSize, "font-semibold")}>{formatValue(current)}</p>
              <p className="text-xs text-muted-foreground">Current</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
              <p className={cn(sizeConfig.textSize, "font-semibold")}>{formatValue(factory)}</p>
              <p className="text-xs text-muted-foreground">Factory</p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", config.bgColor)} />
              <span className={cn(sizeConfig.textSize, "font-medium", config.color)}>
                {config.label}
              </span>
            </div>
            <span className={cn(sizeConfig.textSize, "text-muted-foreground font-medium tabular-nums")}>
              {safeRange > 0 ? formatValue(factory - current) : 0}mm remaining
            </span>
          </div>
        </div>

        {/* Alert messages */}
        {showAlerts && config.alert && (
          <div className={cn(
            "mt-4 p-3 rounded-md animate-in slide-in-from-bottom-2 duration-300",
            config.alert.bg,
            config.alert.border,
            config.alert.text
          )}>
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">⚠ {config.label} Status</p>
                <p className="text-xs leading-relaxed">{config.alert.message}</p>
                {health === 'critical' && (
                  <button className="mt-2 text-xs font-medium underline hover:no-underline">
                    Schedule Replacement →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Additional info for excellent/good states */}
        {showAlerts && (health === 'excellent' || health === 'good') && (
          <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" />
              <span>Tread depth is healthy. Next inspection recommended in 5,000 km.</span>
            </div>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
};

export default TreadDepthGauge;