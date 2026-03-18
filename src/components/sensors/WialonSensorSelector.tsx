/**
 * WialonSensorSelector Component
 *
 * Dropdown component for selecting Wialon units and their sensors.
 * Displays real-time sensor values in a clean, modern interface.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { AlertCircle, Loader2, Radio } from 'lucide-react';
import React from 'react';

interface WialonSensorSelectorProps {
  selectedUnitId?: number;
  selectedSensorId?: string;
  onUnitChange: (unitId: number) => void;
  onSensorChange: (sensorId: string) => void;
  units: Array<{ id: number; name: string; registration?: string }>;
  sensors: Array<{ id: string; n: string; t: string; m: string }>;
  isLoading?: boolean;
  isConnected?: boolean;
  error?: string | null;
  className?: string;
  showHeader?: boolean;
}

export const WialonSensorSelector: React.FC<WialonSensorSelectorProps> = ({
  selectedUnitId,
  selectedSensorId,
  onUnitChange,
  onSensorChange,
  units,
  sensors,
  isLoading = false,
  isConnected = false,
  error = null,
  className = '',
  showHeader = true,
}) => {
  const handleUnitChange = (value: string) => {
    const unitId = parseInt(value, 10);
    if (!isNaN(unitId)) {
      onUnitChange(unitId);
    }
  };

  const handleSensorChange = (value: string) => {
    onSensorChange(value);
  };

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Sensor Selection</CardTitle>
              <CardDescription>
                Select a vehicle unit and sensor to monitor
              </CardDescription>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              <Radio className="w-3 h-3 mr-1" />
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Unit Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Vehicle Unit
          </label>
          <Select
            value={selectedUnitId?.toString() ?? ''}
            onValueChange={handleUnitChange}
            disabled={isLoading || !isConnected || units.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={
                isLoading
                  ? 'Loading units...'
                  : units.length === 0
                  ? 'No units available'
                  : 'Select a vehicle unit'
              } />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{unit.name}</span>
                    {unit.registration && (
                      <span className="text-xs text-gray-500 ml-2">
                        {unit.registration}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sensor Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sensor
          </label>
          <Select
            value={selectedSensorId ?? ''}
            onValueChange={handleSensorChange}
            disabled={!selectedUnitId || isLoading || sensors.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={
                !selectedUnitId
                  ? 'Select a unit first'
                  : isLoading
                  ? 'Loading sensors...'
                  : sensors.length === 0
                  ? 'No sensors available'
                  : 'Select a sensor'
              } />
            </SelectTrigger>
            <SelectContent>
              {sensors.map((sensor) => (
                <SelectItem key={sensor.id} value={sensor.id}>
                  <div className="flex flex-col items-start py-1">
                    <span className="font-medium">{sensor.n}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline" className="text-xs">
                        {sensor.t}
                      </Badge>
                      <span>{sensor.m}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WialonSensorSelector;