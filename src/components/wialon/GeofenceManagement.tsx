/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWialonContext } from "@/integrations/wialon";
import { Circle, MapPin, Plus, Save, Trash2, X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Resource {
  id: number;
  name: string;
  geofenceCount: number;
}

interface Geofence {
  id: number;
  name: string;
  type: number; // 1=polygon, 2=line, 3=circle
  radius?: number;
  color: number;
  area?: number;
}

interface CircleGeofence {
  center: { lat: number; lng: number } | null;
  radius: number;
  name: string;
  color: string;
}

interface GeofenceManagementProps {
  map?: any;
}

export const GeofenceManagement = ({ map }: GeofenceManagementProps) => {
  const { toast } = useToast();
  const { isConnected, connect, error: wialonError } = useWialonContext();

  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoadingGeofences, setIsLoadingGeofences] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  // Circle creation state
  const [isCreatingCircle, setIsCreatingCircle] = useState(false);
  const [circleData, setCircleData] = useState<CircleGeofence>({
    center: null,
    radius: 500,
    name: "",
    color: "#FF0000",
  });
  const [circleOverlay, setCircleOverlay] = useState<any>(null);

  const [availableCreateResources, setAvailableCreateResources] = useState<Resource[]>([]);
  const [targetResourceId, setTargetResourceId] = useState<number | null>(null);

  // Auto-connect
  useEffect(() => {
    if (!isConnected && !wialonError) {
      connect().catch(() => {});
    }
  }, [isConnected, wialonError, connect]);

  // Load resources
  useEffect(() => {
    if (!isConnected || typeof window === "undefined" || !(window as any).wialon) return;

    const loadResources = async () => {
      setIsLoadingResources(true);
      try {
        const wialon = (window as any).wialon;
        const session = wialon.core.Session.getInstance();

        // Load library – we continue regardless of code (library may already be loaded)
        await new Promise<void>((resolve) => {
          session.loadLibrary("resourceZones", (_code: number) => {
            resolve();
          });
        });

        // Update flags
        const flags = wialon.item.Item.dataFlag.base | wialon.item.Resource.dataFlag.zones;
        await new Promise<void>((resolve, reject) => {
          session.updateDataFlags(
            [{ type: "type", data: "avl_resource", flags, mode: 0 }],
            (code: number) => {
              if (code === 1) {
                connect().then(resolve).catch(reject);
                return;
              }
              if (code) reject(new Error(wialon.core.Errors.getErrorText(code)));
              else resolve();
            }
          );
        });

        const resourceItems = session.getItems("avl_resource");
        const resourceList: Resource[] = [];
        const createResourceList: Resource[] = [];

        resourceItems.forEach((res: any) => {
          const zones = res.getZones();
          const zoneCount = zones ? zones.length : 0;
          const resource: Resource = {
            id: res.getId(),
            name: res.getName(),
            geofenceCount: zoneCount,
          };
          resourceList.push(resource);

          const accessFlags = res.getUserAccess();
          const canEdit = (accessFlags & wialon.item.Item.accessFlag.editZones) !== 0;
          if (canEdit) createResourceList.push(resource);
        });

        setResources(resourceList);
        setAvailableCreateResources(createResourceList);

        toast({
          title: "Resources Loaded",
          description: `Found ${resourceList.length} resources (${createResourceList.length} writable)`,
        });
      } catch (error) {
        toast({
          title: "Failed to Load Resources",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsLoadingResources(false);
      }
    };

    loadResources();
  }, [isConnected, connect, toast]);

  const loadGeofences = async (resourceId: number) => {
    if (!isConnected || typeof window === "undefined" || !(window as any).wialon) return;

    setIsLoadingGeofences(true);
    try {
      const wialon = (window as any).wialon;
      const session = wialon.core.Session.getInstance();
      const resource = session.getItem(resourceId);
      if (!resource) throw new Error("Resource not found");

      const zones = resource.getZones();
      const geofenceList: Geofence[] = [];

      if (zones && zones.length > 0) {
        zones.forEach((zone: any, index: number) => {
          let calculatedArea: number | undefined;
          if (zone.t === 3 && zone.w) {
            calculatedArea = Math.PI * Math.pow(zone.w, 2);
          }

          geofenceList.push({
            id: index,
            name: zone.n || `Geofence ${index + 1}`,
            type: zone.t || 1,
            radius: zone.w || undefined,
            color: zone.c || 0,
            area: calculatedArea,
          });
        });
      }

      setGeofences(geofenceList);
      setSelectedResourceId(resourceId);

      toast({
        title: "Geofences Loaded",
        description: `Found ${geofenceList.length} geofences`,
      });
    } catch (error) {
      toast({
        title: "Failed to Load Geofences",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGeofences(false);
    }
  };

  const deleteGeofence = async (geofenceIndex: number, geofenceName: string) => {
    if (!isConnected || !selectedResourceId) return;

    if (!window.confirm(`Delete geofence "${geofenceName}"?`)) return;

    try {
      const wialon = (window as any).wialon;
      const session = wialon.core.Session.getInstance();
      const resource = session.getItem(selectedResourceId);
      if (!resource) throw new Error("Resource not found");

      await new Promise<void>((resolve, reject) => {
        resource.removeZone(geofenceIndex, (code: number) => {
          if (code) reject(new Error(wialon.core.Errors.getErrorText(code)));
          else resolve();
        });
      });

      toast({
        title: "Geofence Deleted",
        description: `"${geofenceName}" deleted successfully`,
      });

      loadGeofences(selectedResourceId);
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const enableCirclePlacement = () => {
    if (!map) {
      toast({ title: "Map Error", description: "Map not initialized", variant: "destructive" });
      return;
    }

    setIsCreatingCircle(true);
    setCircleData({ center: null, radius: 500, name: "", color: "#FF0000" });

    // Auto-select first writable resource
    if (availableCreateResources.length > 0) {
      setTargetResourceId(availableCreateResources[0].id);
    }

    toast({
      title: "Placement Mode Active",
      description: "Click the map to set center",
    });

    const handleMapClick = (e: any) => {
      const latlng = e.latlng;
      setCircleData((prev) => ({ ...prev, center: { lat: latlng.lat, lng: latlng.lng } }));

      if (circleOverlay) map.removeLayer(circleOverlay);

      const L = (window as any).L;
      if (L) {
        const circle = L.circle([latlng.lat, latlng.lng], {
          color: circleData.color,
          fillColor: circleData.color,
          fillOpacity: 0.2,
          radius: circleData.radius,
        }).addTo(map);
        setCircleOverlay(circle);
      }
    };

    map.on("click", handleMapClick);
    (map as any)._circleClickHandler = handleMapClick;
  };

  const updateCircleRadius = (radius: number) => {
    setCircleData((prev) => ({ ...prev, radius }));
    if (circleOverlay) circleOverlay.setRadius(radius);
  };

  const updateCircleColor = (color: string) => {
    setCircleData((prev) => ({ ...prev, color }));
    if (circleOverlay) circleOverlay.setStyle({ color, fillColor: color });
  };

  const cancelCircleCreation = () => {
    setIsCreatingCircle(false);
    setCircleData({ center: null, radius: 500, name: "", color: "#FF0000" });
    if (circleOverlay && map) {
      map.removeLayer(circleOverlay);
      setCircleOverlay(null);
    }
    if (map && (map as any)._circleClickHandler) {
      map.off("click", (map as any)._circleClickHandler);
      delete (map as any)._circleClickHandler;
    }
    toast({ title: "Cancelled", description: "Circle creation cancelled" });
  };

  const saveCircleGeofence = async () => {
    if (!circleData.center || !circleData.name.trim() || !targetResourceId) {
      toast({
        title: "Invalid Data",
        description: "Center, name, and resource required",
        variant: "destructive",
      });
      return;
    }

    try {
      const wialon = (window as any).wialon;
      const session = wialon.core.Session.getInstance();
      const resource = session.getItem(targetResourceId);
      if (!resource) throw new Error("Resource not found");

      const hexToArgb = (hex: string): number => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (255 << 24) | (r << 16) | (g << 8) | b;
      };

      const geofence = {
        n: circleData.name,
        t: 3,
        f: 0,
        w: circleData.radius,
        c: hexToArgb(circleData.color),
        p: [{ x: circleData.center.lng, y: circleData.center.lat, r: circleData.radius }],
      };

      await new Promise<void>((resolve, reject) => {
        resource.addZone(geofence, (code: number) => {
          if (code) reject(new Error(wialon.core.Errors.getErrorText(code)));
          else resolve();
        });
      });

      const areaKm = (Math.PI * Math.pow(circleData.radius, 2) / 1000000).toFixed(2);
      toast({
        title: "Geofence Created",
        description: `"${circleData.name}" created (${areaKm} km²)`,
      });

      cancelCircleCreation();
      if (selectedResourceId === targetResourceId) {
        loadGeofences(targetResourceId);
      }
    } catch (error) {
      toast({
        title: "Create Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const getGeofenceTypeLabel = (type: number) => {
    switch (type) {
      case 1: return "Polygon";
      case 2: return "Line";
      case 3: return "Circle";
      default: return "Unknown";
    }
  };

  const argbToHex = (argb: number): string => {
    const r = (argb >> 16) & 0xFF;
    const g = (argb >> 8) & 0xFF;
    const b = argb & 0xFF;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  const formatArea = (area: number): string => {
    if (area > 1000000) return `${(area / 1000000).toFixed(2)} km²`;
    if (area > 10000) return `${(area / 10000).toFixed(2)} ha`;
    return `${Math.round(area)} m²`;
  };

  // Connection states
  if (!isConnected && !wialonError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Connecting to Wialon</h3>
            <p className="text-muted-foreground">Please wait...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (wialonError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-medium mb-2">Connection Error</h3>
            <p className="text-muted-foreground">{wialonError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="browse">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Geofences</TabsTrigger>
          <TabsTrigger value="create">Create Circle</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Browse Geofences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Resource</Label>
                <Select
                  value={selectedResourceId?.toString() ?? ""}
                  onValueChange={(value) => {
                    const id = value ? Number(value) : null;
                    if (id) loadGeofences(id);
                    else {
                      setGeofences([]);
                      setSelectedResourceId(null);
                    }
                  }}
                  disabled={isLoadingResources}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-- Select Resource --" />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id.toString()}>
                        {resource.name} ({resource.geofenceCount} geofences)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingResources && <p className="text-xs text-muted-foreground">Loading resources...</p>}
              </div>

              {isLoadingGeofences && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading geofences...</p>
                </div>
              )}

              {!isLoadingGeofences && geofences.length > 0 && (
                <div className="space-y-2">
                  <Label>Geofences ({geofences.length})</Label>
                  <div className="border rounded-md max-h-96 overflow-y-auto">
                    {geofences.map((geofence) => (
                      <div
                        key={geofence.id}
                        className="p-3 border-b last:border-b-0 hover:bg-muted/50 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{geofence.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary">{getGeofenceTypeLabel(geofence.type)}</Badge>
                            {geofence.type === 3 && geofence.radius && (
                              <Badge variant="outline">{geofence.radius}m radius</Badge>
                            )}
                            {geofence.area && <Badge variant="outline">{formatArea(geofence.area)}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded border"
                            style={{ backgroundColor: argbToHex(geofence.color) }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteGeofence(geofence.id, geofence.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isLoadingGeofences && selectedResourceId && geofences.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No geofences found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Circle className="h-5 w-5" />
                Create Circle Geofence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isCreatingCircle ? (
                <>
                  <div className="text-sm text-muted-foreground space-y-2 bg-blue-50 p-4 rounded-lg">
                    <p className="font-medium text-blue-900 mb-2">How to create:</p>
                    <p>📍 Click "New Circle Geofence"</p>
                    <p>🎯 Click map to set center</p>
                    <p>📏 Adjust radius/color/name</p>
                    <p>💾 Save to selected resource</p>
                  </div>
                  <Button
                    onClick={enableCirclePlacement}
                    className="w-full"
                    disabled={availableCreateResources.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Circle Geofence
                  </Button>
                  {availableCreateResources.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      No writable resources available
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Geofence Name</Label>
                    <Input
                      placeholder="Enter name"
                      value={circleData.name}
                      onChange={(e) => setCircleData((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Radius (meters)</Label>
                    <Input
                      type="number"
                      min="50"
                      max="50000"
                      step="50"
                      value={circleData.radius}
                      onChange={(e) => updateCircleRadius(Number(e.target.value) || 500)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Area: {formatArea(Math.PI * Math.pow(circleData.radius, 2))}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={circleData.color}
                        onChange={(e) => updateCircleColor(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={circleData.color}
                        onChange={(e) => updateCircleColor(e.target.value)}
                        placeholder="#FF0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Resource</Label>
                    <Select
                      value={targetResourceId?.toString() ?? ""}
                      onValueChange={(value) => setTargetResourceId(value ? Number(value) : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- Select Resource --" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCreateResources.map((resource) => (
                          <SelectItem key={resource.id} value={resource.id.toString()}>
                            {resource.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Only writable resources shown</p>
                  </div>

                  {circleData.center && (
                    <div className="p-3 bg-muted rounded-md text-sm">
                      <p className="font-medium mb-1">Center:</p>
                      <p className="font-mono text-xs">
                        {circleData.center.lat.toFixed(6)}, {circleData.center.lng.toFixed(6)}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={saveCircleGeofence}
                      disabled={!circleData.center || !circleData.name.trim() || !targetResourceId}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button onClick={cancelCircleCreation} variant="outline" className="flex-1">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GeofenceManagement;
