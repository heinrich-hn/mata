// src/components/WialonMapView.tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWialonContext } from '@/integrations/wialon';
import type { VehicleLocation as WialonVehicleLocation } from '@/integrations/wialon/types';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MapPin, Power, PowerOff, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import VehicleMap from './VehicleMap';

// Constants
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
const STATS_DECIMAL_PLACES = 1;
const COORDINATE_DECIMAL_PLACES = 6;

// Types
interface VehicleStats {
  total: number;
  moving: number;
  stopped: number;
  avgSpeed: number;
}

export default function WialonMapView() {
  const { toast } = useToast();
  const {
    isConnected,
    isLoading,
    error,
    vehicleLocations,
    connect,
    disconnect,
    refreshUnits
  } = useWialonContext();

  const [selectedVehicle, setSelectedVehicle] = useState<WialonVehicleLocation | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((
    title: string,
    description: string,
    variant: 'default' | 'destructive' = 'default'
  ) => {
    toast({
      title,
      description,
      variant,
    });
  }, [toast]);

  const handleConnect = useCallback(async () => {
    try {
      await connect();
      showToast("Connected", "Successfully connected to Wialon");
    } catch (err) {
      console.error('Connection failed:', err);
      showToast(
        "Connection Failed",
        "Please check your credentials and try again",
        "destructive"
      );
    }
  }, [connect, showToast]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setSelectedVehicle(null);
      showToast("Disconnected", "Disconnected from Wialon");
    } catch (err) {
      console.error('Disconnect failed:', err);
      showToast(
        "Disconnect Failed",
        "An error occurred while disconnecting",
        "destructive"
      );
    }
  }, [disconnect, showToast]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshUnits();
      showToast("Success", "Vehicle data refreshed");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to refresh vehicle data";
      showToast("Refresh Failed", errorMessage, "destructive");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshUnits, showToast]);

  const handleRetry = useCallback(() => {
    handleConnect();
  }, [handleConnect]);

  const handleVehicleClick = useCallback((vehicle: WialonVehicleLocation) => {
    setSelectedVehicle(vehicle);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedVehicle(null);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, vehicle: WialonVehicleLocation) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleVehicleClick(vehicle);
      e.preventDefault();
    }
  }, [handleVehicleClick]);

  // Auto-refresh effect with cleanup
  useEffect(() => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }

    if (isConnected && autoRefresh) {
      autoRefreshIntervalRef.current = setInterval(handleRefresh, AUTO_REFRESH_INTERVAL);
    }

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [isConnected, autoRefresh, handleRefresh]);

  // Filtered vehicles based on search
  const filteredVehicles = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return vehicleLocations.filter(v =>
      v.vehicleName.toLowerCase().includes(query) ||
      v.vehicleId.toLowerCase().includes(query)
    );
  }, [vehicleLocations, searchQuery]);

  // Calculate statistics
  const stats = useMemo<VehicleStats>(() => {
    const moving = filteredVehicles.filter(v => v.speed > 0);
    const stopped = filteredVehicles.filter(v => v.speed === 0);
    const avgSpeed = filteredVehicles.length > 0
      ? filteredVehicles.reduce((sum, v) => sum + v.speed, 0) / filteredVehicles.length
      : 0;

    return {
      total: filteredVehicles.length,
      moving: moving.length,
      stopped: stopped.length,
      avgSpeed
    };
  }, [filteredVehicles]);

  // Convert to VehicleMap format
  const mappedVehicles = useMemo(() => {
    return filteredVehicles.map(v => ({
      ...v,
      heading: v.heading || 0,
      altitude: v.altitude || 0,
      satelliteCount: v.satelliteCount || 0,
      isMoving: v.speed > 0,
    }));
  }, [filteredVehicles]);

  // Clear search handler
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Connection status badge
  const connectionBadge = useMemo(() => {
    if (isConnected) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          🟢 Connected
        </Badge>
      );
    }

    if (isLoading) {
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Connecting...
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        ⚪ Disconnected
      </Badge>
    );
  }, [isConnected, isLoading]);

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sidebar: Controls and Vehicle List */}
      <div className="w-full md:w-80 space-y-4">
        {/* Connection Controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  GPS Tracking
                </CardTitle>
                <CardDescription>Real-time vehicle monitoring</CardDescription>
              </div>
              {connectionBadge}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {!isConnected ? (
                <Button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="gap-2 flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="gap-2"
                  >
                    <PowerOff className="h-4 w-4" />
                    Disconnect
                  </Button>
                  <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </>
              )}
            </div>

            {/* Auto-refresh Toggle */}
            {isConnected && (
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-refresh" className="cursor-pointer">
                  Auto-refresh (30s)
                </Label>
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  aria-label="Toggle auto-refresh"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Alert with Retry */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>Error:</strong>{' '}
                {typeof error === 'string' ? error : 'An error occurred'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Skeletons or Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isConnected && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Vehicles</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Moving</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{stats.moving}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Stopped</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">{stats.stopped}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Speed</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.avgSpeed.toFixed(STATS_DECIMAL_PLACES)} km/h</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Vehicle Search */}
        {isConnected && vehicleLocations.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-10"
              aria-label="Search vehicles"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Vehicle List */}
        {isConnected && filteredVehicles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {filteredVehicles.length} of {vehicleLocations.length}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredVehicles.map((vehicle) => (
                  <div
                    key={vehicle.vehicleId}
                    className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent ${selectedVehicle?.vehicleId === vehicle.vehicleId
                        ? 'bg-accent border border-primary'
                        : 'border border-transparent'
                      }`}
                    onClick={() => handleVehicleClick(vehicle)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => handleKeyDown(e, vehicle)}
                    aria-label={`Select vehicle ${vehicle.vehicleName}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium truncate">{vehicle.vehicleName}</span>
                      <Badge
                        variant={vehicle.speed > 0 ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {vehicle.speed > 0 ? "Moving" : "Stopped"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {vehicle.vehicleId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {vehicle.speed.toFixed(1)} km/h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content: Map and Details */}
      <div className="flex-1 space-y-4">
        {/* Map */}
        <Card className="flex-1">
          <CardContent className="p-0 h-[600px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <VehicleMap
                vehicles={mappedVehicles}
                selectedVehicle={selectedVehicle}
                onVehicleClick={handleVehicleClick}
                className="h-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Selected Vehicle Details */}
        {selectedVehicle && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="min-w-0">
                <CardTitle className="truncate">{selectedVehicle.vehicleName}</CardTitle>
                <CardDescription>Detailed vehicle information</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                aria-label="Close vehicle details"
              >
                Close
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vehicle ID</p>
                  <p className="font-mono text-sm truncate">{selectedVehicle.vehicleId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge variant={selectedVehicle.speed > 0 ? "default" : "secondary"}>
                    {selectedVehicle.speed > 0 ? "Moving" : "Stopped"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Speed</p>
                  <p className="font-medium">{selectedVehicle.speed.toFixed(1)} km/h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Heading</p>
                  <p className="font-medium">{selectedVehicle.heading.toFixed(0)}°</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Altitude</p>
                  <p className="font-medium">{selectedVehicle.altitude.toFixed(0)}m</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Satellites</p>
                  <p className="font-medium">{selectedVehicle.satelliteCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Latitude</p>
                  <p className="font-mono text-sm">{selectedVehicle.latitude.toFixed(COORDINATE_DECIMAL_PLACES)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Longitude</p>
                  <p className="font-mono text-sm">{selectedVehicle.longitude.toFixed(COORDINATE_DECIMAL_PLACES)}</p>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <p className="text-sm text-muted-foreground mb-1">Last Update</p>
                  <p className="font-medium">
                    {formatDistanceToNow(selectedVehicle.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}