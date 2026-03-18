/**
 * WialonSensorWidget Component
 *
 * Compact sensor display widget for embedding in dashboards, vehicle pages, etc.
 * Shows key sensor values without full selection UI.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWialonSensors } from '@/hooks/useWialonSensors';
import { cn } from '@/lib/utils';
import
  {
    AlertCircle,
    Fuel,
    Gauge,
    Radio,
    RefreshCw,
    Thermometer,
    Zap,
  } from 'lucide-react';
import React from 'react';

interface WialonSensorWidgetProps {
  unitId: number;
  sensorTypes?: string[];
  maxSensors?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
  title?: string;
  showRefreshButton?: boolean;
  compact?: boolean;
}

// Map sensor types to icons
const getSensorIcon = (sensorType: string) => {
  const type = sensorType.toLowerCase();
  if (type.includes('fuel')) return Fuel;
  if (type.includes('temp')) return Thermometer;
  if (type.includes('speed')) return Gauge;
  if (type.includes('ignition') || type.includes('engine')) return Zap;
  return Radio;
};

const WialonSensorWidget: React.FC<WialonSensorWidgetProps> = ({
  unitId,
  sensorTypes,
  maxSensors = 6,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  title = "Vehicle Sensors",
  showRefreshButton = true,
  compact = false,
}) => {
  const {
    sensors,
    sensorValues,
    isLoading,
    isConnected,
    error,
    refetchSensors,
  } = useWialonSensors({
    unitId,
    autoRefresh,
    refreshInterval,
  });

  // Filter sensors by type if specified
  const filteredSensors = React.useMemo(() => {
    let result = sensors;

    if (sensorTypes && sensorTypes.length > 0) {
      result = sensors.filter(s =>
        sensorTypes.some(type => s.t.toLowerCase().includes(type.toLowerCase()))
      );
    }

    return result.slice(0, maxSensors);
  }, [sensors, sensorTypes, maxSensors]);

  // Get sensor values for filtered sensors
  const displayValues = React.useMemo(() => {
    return filteredSensors.map(sensor => {
      const value = sensorValues.find(v => String(v.sensorId) === String(sensor.id));
      return { sensor, value };
    });
  }, [filteredSensors, sensorValues]);

  // Show not connected state (waiting for global Wialon connection)
  if (!isConnected && !error && !isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className={compact ? "text-base" : "text-lg"}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-center py-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Radio className="h-5 w-5" />
              <span className="text-sm">Waiting for Wialon connection</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Connect to Wialon from the main map to view live sensors
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className={compact ? "text-base" : "text-lg"}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-center py-4">
            <div className="flex items-center justify-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Connection Error</span>
            </div>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while connecting or fetching data
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (sensors.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">No sensors configured for this unit</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={compact ? "text-base" : "text-lg"}>
            {title}
          </CardTitle>
          {showRefreshButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchSensors()}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={compact ? "space-y-2" : "space-y-3"}>
        {displayValues.map(({ sensor, value }) => {
          const Icon = getSensorIcon(sensor.t);

          return (
            <div
              key={sensor.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{sensor.n}</div>
                  <div className="text-xs text-muted-foreground">{sensor.t}</div>
                </div>
              </div>
              <div className="text-right">
                {value && value.isValid ? (
                  <>
                    <div className="font-semibold">
                      {value.formattedValue}
                    </div>
                    <Badge variant="outline" className="text-xs mt-1">
                      Live
                    </Badge>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">N/A</div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default WialonSensorWidget;