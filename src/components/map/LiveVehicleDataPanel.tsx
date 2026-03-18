/**
 * LiveVehicleDataPanel Component
 * Full-width bottom panel for displaying live vehicle tracking data
 * Provides a modern, professional table view with real-time updates
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { VehicleLocation } from '@/integrations/wialon';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import
  {
    Activity,
    Download,
    Gauge,
    MapPin,
    Maximize2,
    Minimize2,
    Navigation,
    RefreshCw,
    Satellite,
    Search,
    Truck,
    X,
    Zap,
  } from 'lucide-react';
import { useMemo, useState } from 'react';

interface LiveVehicleDataPanelProps {
  vehicleLocations: VehicleLocation[];
  isConnected: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  onVehicleClick?: (vehicle: VehicleLocation) => void;
  onRefresh?: () => void;
}

export const LiveVehicleDataPanel = ({
  vehicleLocations,
  isConnected,
  isOpen,
  onClose,
  onToggleExpand,
  isExpanded = false,
  onVehicleClick,
  onRefresh,
}: LiveVehicleDataPanelProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'speed' | 'status' | 'lastUpdate'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter and sort vehicles
  const filteredVehicles = useMemo(() => {
    let vehicles = [...vehicleLocations];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      vehicles = vehicles.filter((v) =>
        v.vehicleName.toLowerCase().includes(query)
      );
    }

    // Sort
    vehicles.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.vehicleName.localeCompare(b.vehicleName);
          break;
        case 'speed':
          comparison = a.speed - b.speed;
          break;
        case 'status':
          comparison = (a.speed > 0 ? 1 : 0) - (b.speed > 0 ? 1 : 0);
          break;
        case 'lastUpdate':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return vehicles;
  }, [vehicleLocations, searchQuery, sortField, sortDirection]);

  // Vehicle statistics
  const stats = useMemo(() => {
    const moving = vehicleLocations.filter((v) => v.speed > 0).length;
    const stopped = vehicleLocations.length - moving;
    const avgSpeed =
      vehicleLocations.length > 0
        ? Math.round(
            vehicleLocations.reduce((sum, v) => sum + v.speed, 0) /
              vehicleLocations.length
          )
        : 0;
    const maxSpeed =
      vehicleLocations.length > 0
        ? Math.round(Math.max(...vehicleLocations.map((v) => v.speed)))
        : 0;
    return { total: vehicleLocations.length, moving, stopped, avgSpeed, maxSpeed };
  }, [vehicleLocations]);

  // Toggle sort
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Vehicle', 'Status', 'Speed (km/h)', 'Heading', 'Satellites', 'Latitude', 'Longitude', 'Last Update'];
    const csvRows = [headers.join(',')];

    filteredVehicles.forEach((vehicle) => {
      const row = [
        `"${vehicle.vehicleName}"`,
        vehicle.speed > 0 ? 'Moving' : 'Stopped',
        Math.round(vehicle.speed),
        Math.round(vehicle.heading || 0),
        vehicle.satelliteCount || 0,
        vehicle.latitude.toFixed(6),
        vehicle.longitude.toFixed(6),
        new Date(vehicle.timestamp).toISOString(),
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `vehicle_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-background border-t shadow-lg z-[900] transition-all duration-300',
        isExpanded ? 'h-[60vh]' : 'h-[320px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Live Vehicle Data</h3>
          </div>

          {/* Live Stats Badges */}
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 bg-background">
              <Activity className="h-3 w-3" />
              {stats.total} Total
            </Badge>
            <Badge className="text-xs gap-1.5 bg-green-500 hover:bg-green-500">
              <Zap className="h-3 w-3" />
              {stats.moving} Moving
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1.5">
              <MapPin className="h-3 w-3" />
              {stats.stopped} Stopped
            </Badge>
            <Badge variant="outline" className="text-xs gap-1.5 bg-background">
              <Gauge className="h-3 w-3" />
              Avg: {stats.avgSpeed} km/h
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[180px] pl-8 text-xs"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh Data</TooltipContent>
            </Tooltip>
          )}

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredVehicles.length === 0}
            className="h-8 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>

          {/* Expand/Collapse */}
          {onToggleExpand && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpand}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? 'Minimize' : 'Maximize'}</TooltipContent>
            </Tooltip>
          )}

          {/* Close Button */}
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 53px)' }}>
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MapPin className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Connect to Wialon to view vehicle data</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Truck className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">
              {searchQuery ? 'No vehicles match your search' : 'No vehicle locations available'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="min-w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold py-3 px-4 w-12 text-center">#</TableHead>
                    <TableHead
                      className="text-xs font-semibold py-3 px-4 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Vehicle
                        {sortField === 'name' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-xs font-semibold py-3 px-4 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === 'status' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-xs font-semibold py-3 px-4 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('speed')}
                    >
                      <div className="flex items-center gap-1">
                        Speed
                        {sortField === 'speed' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold py-3 px-4">Heading</TableHead>
                    <TableHead className="text-xs font-semibold py-3 px-4 text-center">Satellites</TableHead>
                    <TableHead className="text-xs font-semibold py-3 px-4">Coordinates</TableHead>
                    <TableHead
                      className="text-xs font-semibold py-3 px-4 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('lastUpdate')}
                    >
                      <div className="flex items-center gap-1">
                        Last Update
                        {sortField === 'lastUpdate' && (
                          <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle, index) => (
                    <TableRow
                      key={vehicle.vehicleId}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-primary/5',
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                      )}
                      onClick={() => onVehicleClick?.(vehicle)}
                    >
                      <TableCell className="text-xs py-2.5 px-4 text-center text-muted-foreground font-mono">
                        {index + 1}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              vehicle.speed > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                            )}
                          />
                          <span className="text-sm font-medium">{vehicle.vehicleName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <Badge
                          variant={vehicle.speed > 0 ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs',
                            vehicle.speed > 0 && 'bg-green-500 hover:bg-green-500'
                          )}
                        >
                          {vehicle.speed > 0 ? 'Moving' : 'Stopped'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <span className="text-sm font-mono font-medium">
                          {Math.round(vehicle.speed)} km/h
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Navigation
                            className="h-4 w-4 text-muted-foreground"
                            style={{ transform: `rotate(${vehicle.heading || 0}deg)` }}
                          />
                          <span className="text-sm font-mono">
                            {Math.round(vehicle.heading || 0)}°
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className="text-xs gap-1">
                          <Satellite className="h-3 w-3" />
                          {vehicle.satelliteCount || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <span className="text-xs font-mono text-muted-foreground">
                          {vehicle.latitude.toFixed(5)}, {vehicle.longitude.toFixed(5)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-xs text-muted-foreground">
                        {formatDistanceToNow(vehicle.timestamp, { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default LiveVehicleDataPanel;