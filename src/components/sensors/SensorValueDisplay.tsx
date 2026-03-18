/**
 * SensorValueDisplay Component
 *
 * Displays real-time sensor values with visual indicators and formatting.
 * Shows sensor history, trends, and status badges.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SensorValue } from '@/hooks/useWialonSensors';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Clock,
  Fuel,
  Gauge,
  Thermometer,
  TrendingUp,
  Zap
} from 'lucide-react';
import React from 'react';

interface SensorValueDisplayProps {
  sensorValue: SensorValue | null;
  showTrend?: boolean;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
}

export const SensorValueDisplay: React.FC<SensorValueDisplayProps> = ({
  sensorValue,
  showTrend = false,
  showProgress = true,
  compact = false,
  className = '',
}) => {
  if (!sensorValue) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-500">No sensor data available</p>
        </CardContent>
      </Card>
    );
  }

  const { sensorName, sensorType, formattedValue, unit, isValid, timestamp } = sensorValue;

  // Get icon based on sensor type
  const Icon = getSensorIcon(sensorType);

  // Get status color
  const statusColor = isValid ? 'text-green-600' : 'text-red-600';
  const statusBg = isValid ? 'bg-green-50' : 'bg-red-50';

  // Calculate progress percentage for compatible sensors
  const progressValue = calculateProgress(sensorValue);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border', statusBg, className)}>
        <Icon className={cn('h-5 w-5', statusColor)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{sensorName}</p>
          <p className="text-xs text-gray-500">{sensorType}</p>
        </div>
        <div className="text-right">
          <p className={cn('text-lg font-bold', statusColor)}>{formattedValue}</p>
          {showProgress && progressValue !== null && (
            <Progress value={progressValue} className="h-1 w-16" />
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', statusBg)}>
              <Icon className={cn('h-5 w-5', statusColor)} aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">{sensorName}</CardTitle>
              <CardDescription className="text-xs">{sensorType}</CardDescription>
            </div>
          </div>
          <Badge variant={isValid ? 'default' : 'destructive'}>
            {isValid ? 'Active' : 'N/A'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Value Display */}
        <div className="text-center py-4">
          <p className={cn('text-4xl font-bold', statusColor)}>
            {isValid ? formattedValue : 'N/A'}
          </p>
          {isValid && (
            <p className="text-sm text-gray-500 mt-1">{unit}</p>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && progressValue !== null && isValid && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>{progressValue.toFixed(0)}%</span>
              <span>100%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}

        {/* Trend Indicator */}
        {showTrend && (
          <div className="flex items-center justify-center gap-2 py-2 border-t">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-gray-600">Stable</span>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2 border-t">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>
            {timestamp.toLocaleTimeString()} - {timestamp.toLocaleDateString()}
          </span>
        </div>

        {/* Warning for invalid data */}
        {!isValid && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <p className="text-xs text-yellow-800">
              Sensor data unavailable or invalid
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Multi-sensor grid display
 */
interface SensorGridProps {
  sensorValues: SensorValue[];
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
  className?: string;
}

export const SensorGrid: React.FC<SensorGridProps> = ({
  sensorValues,
  columns = 3,
  compact = true,
  className = '',
}) => {
  if (sensorValues.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No sensors available</p>
      </div>
    );
  }

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {sensorValues.map((sensorValue) => (
        <SensorValueDisplay
          key={sensorValue.sensorId}
          sensorValue={sensorValue}
          compact={compact}
        />
      ))}
    </div>
  );
};

/**
 * Helper: Get icon for sensor type
 */
function getSensorIcon(sensorType: string) {
  const type = sensorType.toLowerCase();

  if (type.includes('fuel')) return Fuel;
  if (type.includes('temperature') || type.includes('temp')) return Thermometer;
  if (type.includes('speed') || type.includes('mileage') || type.includes('odometer')) return Gauge;
  if (type.includes('ignition') || type.includes('voltage') || type.includes('engine')) return Zap;

  return Gauge; // Default icon
}

/**
 * Helper: Calculate progress percentage
 */
function calculateProgress(sensorValue: SensorValue): number | null {
  const { sensorType, value } = sensorValue;

  if (typeof value !== 'number') return null;

  const type = sensorType.toLowerCase();

  // Fuel level (0-100%)
  if (type.includes('fuel') && type.includes('level')) {
    return Math.min(100, Math.max(0, value));
  }

  // Temperature (-20 to 120°C) where 0 represents minimum
  if (type.includes('temperature')) {
    return Math.min(100, Math.max(0, ((value + 20) / 140) * 100));
  }

  // Speed (0-120 km/h)
  if (type.includes('speed')) {
    return Math.min(100, Math.max(0, (value / 120) * 100));
  }

  // Voltage (0-30V)
  if (type.includes('voltage')) {
    return Math.min(100, Math.max(0, (value / 30) * 100));
  }

  return null;
}

export default SensorValueDisplay;