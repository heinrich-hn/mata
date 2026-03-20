/**
 * Wialon GPS Tracking Demo Component
 * Shows real-time vehicle locations from Wialon tracking system
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWialon } from "@/integrations/wialon";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, MapPin, Navigation, RefreshCw, Satellite, TrendingUp } from "lucide-react";

const WialonTrackingDemo = () => {
  const {
    isConnected,
    isLoading,
    error,
    vehicleLocations,
    events,
    connect,
    disconnect,
    refreshUnits,
    refreshEvents,
  } = useWialon();

  const formatCoordinate = (coord: number, isLatitude: boolean): string => {
    const direction = isLatitude
      ? (coord >= 0 ? 'N' : 'S')
      : (coord >= 0 ? 'E' : 'W');
    return `${Math.abs(coord).toFixed(6)}° ${direction}`;
  };

  const getSpeedBadge = (speed: number) => {
    if (speed === 0) return <Badge variant="secondary">Stationary</Badge>;
    if (speed < 40) return <Badge variant="default">Slow</Badge>;
    if (speed < 80) return <Badge className="bg-blue-500">Normal</Badge>;
    return <Badge className="bg-orange-500">Fast</Badge>;
  };

  const getMovingBadge = (isMoving: boolean) => {
    return isMoving ? (
      <Badge className="bg-green-500 gap-1">
        <TrendingUp className="h-3 w-3" />
        Moving
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <MapPin className="h-3 w-3" />
        Stopped
      </Badge>
    );
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'm':
        return 'Message';
      case 'u':
        return 'Update';
      case 'd':
        return 'Delete';
      default:
        return type;
    }
  };

  const getVehicleName = (vehicleId: number) => {
    return vehicleLocations.find(v => v.vehicleId === vehicleId.toString())?.vehicleName || `ID: ${vehicleId}`;
  };

  if (!Array.isArray(vehicleLocations)) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">Data Error</h3>
              <p className="text-sm text-muted-foreground mt-1">Invalid location data format. Please try refreshing.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wialon GPS Tracking</h1>
          <p className="text-muted-foreground">Real-time vehicle location monitoring</p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Badge variant="default" className="gap-2">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
              <Button variant="outline" size="sm" onClick={refreshUnits} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Units
              </Button>
              <Button variant="outline" size="sm" onClick={refreshEvents} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Events
              </Button>
              <Button variant="destructive" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={connect} disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect to Wialon'}
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Connection Error</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <strong>Common solutions:</strong>
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Verify VITE_WIALON_TOKEN is set in your .env file</li>
                    <li>Check that your token hasn't expired (tokens are valid for 30 days)</li>
                    <li>Ensure you have units registered in your Wialon account</li>
                    <li>Try disconnecting and reconnecting</li>
                  </ul>
                  {isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="mt-2"
                    >
                      Reload Page
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {isConnected && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vehicleLocations.length}</div>
              <p className="text-xs text-muted-foreground">Tracked units</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moving</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vehicleLocations.filter(v => v.isMoving).length}
              </div>
              <p className="text-xs text-muted-foreground">Vehicles in motion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stationary</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vehicleLocations.filter(v => !v.isMoving).length}
              </div>
              <p className="text-xs text-muted-foreground">Vehicles stopped</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Speed</CardTitle>
              <Navigation className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vehicleLocations.length > 0
                  ? Math.round(
                      vehicleLocations.reduce((sum, v) => sum + v.speed, 0) /
                        vehicleLocations.length
                    )
                  : 0}{' '}
                km/h
              </div>
              <p className="text-xs text-muted-foreground">Fleet average</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vehicle Locations Table */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Live Vehicle Locations</CardTitle>
            <CardDescription>
              Real-time GPS positions from Wialon tracking system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vehicleLocations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No vehicle locations available</p>
                <p className="text-sm mt-2">Make sure units are registered in Wialon</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latitude</TableHead>
                    <TableHead>Longitude</TableHead>
                    <TableHead>Speed</TableHead>
                    <TableHead>Heading</TableHead>
                    <TableHead className="text-center">Satellites</TableHead>
                    <TableHead>Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleLocations.map((vehicle) => (
                    <TableRow key={vehicle.vehicleId}>
                      <TableCell className="font-medium">{vehicle.vehicleName}</TableCell>
                      <TableCell>{getMovingBadge(vehicle.isMoving)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCoordinate(vehicle.latitude, true)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCoordinate(vehicle.longitude, false)}
                      </TableCell>
                      <TableCell>{getSpeedBadge(Math.round(vehicle.speed))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Navigation
                            className="h-3 w-3"
                            style={{ transform: `rotate(${vehicle.heading}deg)` }}
                          />
                          {Math.round(vehicle.heading)}°
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Satellite className="h-3 w-3" />
                          {vehicle.satelliteCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(vehicle.timestamp, { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events Table */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>
              Events from Wialon system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No events available</p>
                <p className="text-sm mt-2">Try refreshing events</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event, index) => (
                    <TableRow key={index}>
                      <TableCell>{getVehicleName(event.i)}</TableCell>
                      <TableCell>{getEventTypeLabel(event.t)}</TableCell>
                      <TableCell className="font-mono text-sm max-w-2xl overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-words">
                          {JSON.stringify(event.d, null, 2)}
                        </pre>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.timestamp ? formatDistanceToNow(
                          typeof event.timestamp === 'number' ? new Date(event.timestamp * 1000) : new Date(event.timestamp),
                          { addSuffix: true }
                        ) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      {!isConnected && !isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
            <CardDescription>Get started with Wialon GPS tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Configuration Check */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Current Configuration:</h3>
              <div className="text-xs space-y-1 font-mono">
                <div>
                  <strong>Host:</strong> {import.meta.env.VITE_WIALON_HOST || '❌ Not set'}
                </div>
                <div>
                  <strong>Token:</strong>{' '}
                  {import.meta.env.VITE_WIALON_TOKEN
                    ? `✅ Set (${import.meta.env.VITE_WIALON_TOKEN.length} chars)`
                    : '❌ Not set'}
                </div>
                <div>
                  <strong>App Name:</strong> {import.meta.env.VITE_WIALON_APP_NAME || '❌ Not set'}
                </div>
              </div>
              {(!import.meta.env.VITE_WIALON_TOKEN || !import.meta.env.VITE_WIALON_HOST) && (
                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-xs">
                  ⚠️ Configuration incomplete. Make sure to <strong>restart the dev server</strong> after adding variables to .env file.
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">1. Generate Wialon Token</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Visit this URL in your browser (replace YOUR_APP_NAME):
              </p>
              <code className="block p-3 bg-muted rounded text-xs break-all">
                https://hosting.wialon.com/login.html?client_id=CarCraftCo&access_type=0x100&activation_time=0&duration=2592000&flags=0x1&redirect_uri=http://localhost:5173
              </code>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Add Token to .env File</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Copy the access_token from the redirect URL and add it to your .env file:
              </p>
              <code className="block p-3 bg-muted rounded text-xs">
                VITE_WIALON_TOKEN=c1099bc37c906fd0832d8e783b60ae0dCC3725501AE92D98C6E0C1E4A49C23614B0246E7
              </code>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Restart Dev Server</h3>
              <p className="text-sm text-muted-foreground">
                Stop and restart your development server to load the new environment variables.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. Connect</h3>
              <p className="text-sm text-muted-foreground">
                Click the "Connect to Wialon" button button above to establish a connection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WialonTrackingDemo;