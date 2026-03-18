/**
 * WialonSensorMonitor Component
 *
 * Enhanced component for monitoring Wialon unit sensors.
 * Provides a full-featured interface for selecting units, viewing sensors, and monitoring values.
 * New features: multi-sensor monitoring, historical data, alerts, and better error handling.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWialonSensors } from '@/hooks/useWialonSensors';
import { Activity, AlertTriangle, History, List, Plus, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { SensorValueDisplay } from './SensorValueDisplay';
import { WialonSensorSelector } from './WialonSensorSelector';

interface WialonSensorMonitorProps {
  defaultUnitId?: number;
  className?: string;
  maxMonitoredSensors?: number;
  enableMultiMonitoring?: boolean;
  showHistoricalData?: boolean;
}

interface MonitoredSensor {
  id: string;
  unitId: number;
  timestamp: Date;
}

export const WialonSensorMonitor: React.FC<WialonSensorMonitorProps> = ({
  defaultUnitId,
  className,
  maxMonitoredSensors = 5,
  enableMultiMonitoring = false,
  showHistoricalData = false,
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<number | undefined>(defaultUnitId);
  const [selectedSensorId, setSelectedSensorId] = useState<string | undefined>();
  const [monitoredSensors, setMonitoredSensors] = useState<MonitoredSensor[]>([]);
  const [activeTab, setActiveTab] = useState<string>('current');

  const {
    units,
    sensors,
    isLoading,
    error,
    calculateSensorValue,
    refetchSensors,
    isConnected,
  } = useWialonSensors({
    unitId: selectedUnitId,
  });

  const selectedSensor = sensors.find(s => s.id === selectedSensorId);
  const sensorValue = selectedSensor ? calculateSensorValue(selectedSensor) : null;

  // Add sensor to monitored list
  const addToMonitoredSensors = useCallback(() => {
    if (!selectedSensorId || !selectedUnitId || monitoredSensors.length >= maxMonitoredSensors) {
      return;
    }

    const alreadyMonitored = monitoredSensors.find(ms =>
      ms.id === selectedSensorId && ms.unitId === selectedUnitId
    );

    if (!alreadyMonitored) {
      setMonitoredSensors(prev => [
        ...prev,
        {
          id: selectedSensorId,
          unitId: selectedUnitId,
          timestamp: new Date(),
        }
      ]);
    }
  }, [selectedSensorId, selectedUnitId, monitoredSensors, maxMonitoredSensors]);

  // Remove sensor from monitored list
  const removeFromMonitoredSensors = useCallback((sensorId: string, unitId: number) => {
    setMonitoredSensors(prev =>
      prev.filter(ms => !(ms.id === sensorId && ms.unitId === unitId))
    );
  }, []);

  // Get monitored sensors data
  const getMonitoredSensorsData = useCallback(() => {
    return monitoredSensors.map(monitored => {
      const sensor = sensors.find(s => s.id === monitored.id);
      const value = sensor ? calculateSensorValue(sensor) : null;
      return {
        ...monitored,
        sensor,
        value,
      };
    });
  }, [monitoredSensors, sensors, calculateSensorValue]);

  const monitoredSensorsData = getMonitoredSensorsData();

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          Wialon Sensor Monitor
          {monitoredSensors.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {monitoredSensors.length}/{maxMonitoredSensors}
            </Badge>
          )}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchSensors()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load sensor data: {error}
            </AlertDescription>
          </Alert>
        )}

        <WialonSensorSelector
          units={units}
          sensors={sensors}
          selectedUnitId={selectedUnitId}
          selectedSensorId={selectedSensorId}
          onUnitChange={setSelectedUnitId}
          onSensorChange={setSelectedSensorId}
          isLoading={isLoading}
          isConnected={isConnected}
          error={error}
        />

        {/* Multi-sensor monitoring section */}
        {enableMultiMonitoring && selectedSensor && selectedUnitId && (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
            <div className="flex-1">
              <p className="text-sm font-medium">Monitor multiple sensors</p>
              <p className="text-xs text-muted-foreground">
                Track up to {maxMonitoredSensors} sensors simultaneously
              </p>
            </div>
            <Button
              size="sm"
              onClick={addToMonitoredSensors}
              disabled={
                monitoredSensors.length >= maxMonitoredSensors ||
                monitoredSensors.some(ms =>
                  ms.id === selectedSensorId && ms.unitId === selectedUnitId
                )
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to Monitor
            </Button>
          </div>
        )}

        {/* Monitored sensors quick view */}
        {enableMultiMonitoring && monitoredSensorsData.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Monitored Sensors</h4>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              {monitoredSensorsData.map(({ id, unitId, sensor, value, timestamp }) => (
                <Card key={`${unitId}-${id}`} className="p-3 relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                    onClick={() => removeFromMonitoredSensors(id, unitId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {sensor?.n || 'Unknown Sensor'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {sensor?.m}
                      </Badge>
                    </div>
                    {value && (
                      <SensorValueDisplay
                        sensorValue={value}
                        compact
                      />
                    )}
                    <div className="text-xs text-muted-foreground">
                      Added: {timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Single sensor detailed view */}
        {selectedSensor && sensorValue && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="current">
                <Activity className="h-4 w-4 mr-2" />
                Current Value
              </TabsTrigger>
              <TabsTrigger value="details">
                <List className="h-4 w-4 mr-2" />
                Sensor Details
              </TabsTrigger>
              {showHistoricalData && (
                <TabsTrigger value="history" disabled={!showHistoricalData}>
                  <History className="h-4 w-4 mr-2" />
                  History
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="current" className="mt-4">
              <div className="space-y-4">
                <SensorValueDisplay sensorValue={sensorValue} />
                {sensorValue.timestamp && (
                  <div className="text-xs text-muted-foreground text-right">
                    Last updated: {new Date(sensorValue.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sensor ID:</span>
                  <span className="font-mono">{selectedSensor.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{selectedSensor.n}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{selectedSensor.t}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit:</span>
                  <span>{selectedSensor.m}</span>
                </div>
                {selectedSensor.d && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span>{selectedSensor.d}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parameter:</span>
                  <span className="font-mono">{selectedSensor.p}</span>
                </div>
              </div>
            </TabsContent>

            {showHistoricalData && (
              <TabsContent value="history" className="mt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Historical data feature coming soon</p>
                  <p className="text-sm">This will show sensor value trends over time</p>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Empty state */}
        {!selectedSensor && !isLoading && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a unit and sensor to monitor</p>
            <p className="text-sm">Choose from the dropdown above to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WialonSensorMonitor;