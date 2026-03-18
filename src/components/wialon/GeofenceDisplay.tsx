/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Circle as CircleIcon, MapPin, Route, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Geofence {
  id: string;
  name: string;
  description: string | null;
  type: "circle" | "polygon" | "line";
  center_lat: number | null;
  center_lng: number | null;
  radius: number | null;
  coordinates: unknown;
  color: string | null;
  groups: string | null;
  metadata: Record<string, unknown>;
  is_active?: boolean;
}

interface GeofenceDisplayProps {
  map?: any;
}

export default function GeofenceDisplay({ map }: GeofenceDisplayProps) {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [allGeofences, setAllGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [geofenceLayers, setGeofenceLayers] = useState<any[]>([]);
  const { toast } = useToast();

  const loadGeofences = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      // Load all geofences
      const { data: allData, error: allError } = await supabase
        .from('geofences' as any)
        .select('*')
        .eq('is_active', true) as any;

      if (allError) throw allError;
      setAllGeofences((allData as Geofence[]) || []);

      // Load geofences with coordinates
      const { data, error } = await supabase
        .from('geofences' as any)
        .select('*')
        .eq('is_active', true)
        .not('center_lat', 'is', null)
        .not('center_lng', 'is', null) as any;

      if (error) throw error;

      const withCoords = (data as Geofence[]) || [];
      setGeofences(withCoords);

      console.log(`📍 Loaded ${withCoords.length} geofences with coordinates (${allData?.length || 0} total)`);
    } catch (error: any) {
      console.error('Failed to load geofences:', error);
      toast({
        title: "Error",
        description: "Failed to load geofences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadGeofences();

    // Subscribe to changes
    const channel = supabase
      .channel('geofences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'geofences'
        },
        () => {
          loadGeofences(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGeofences]);

  // Render geofences on the map using raw Leaflet API
  useEffect(() => {
    if (!map || !geofences.length || typeof window === 'undefined') return;

    const L = (window as any).L;
    if (!L) {
      console.warn('Leaflet not available');
      return;
    }

    // Clear existing geofence layers
    geofenceLayers.forEach(layer => {
      try {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      } catch (e) {
        console.warn('Error removing layer:', e);
      }
    });

    const newLayers: any[] = [];

    geofences.forEach(geofence => {
      const color = geofence.color || '#3B82F6';
      let layer = null;

      try {
        if (geofence.type === 'circle' && geofence.center_lat && geofence.center_lng) {
          const radius = geofence.radius || 500;

          layer = L.circle([geofence.center_lat, geofence.center_lng], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2
          });

          layer.bindPopup(`
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">${geofence.name}</h3>
              ${geofence.description ? `<p style="font-size: 0.875rem; color: #666; margin-top: 4px;">${geofence.description}</p>` : ''}
              <div style="font-size: 0.75rem; color: #999; margin-top: 8px;">
                <div>Type: ${geofence.type}</div>
                <div>Radius: ${radius}m</div>
                ${geofence.groups ? `<div>Groups: ${geofence.groups}</div>` : ''}
              </div>
            </div>
          `);
        }

        else if (geofence.type === 'polygon' && geofence.coordinates) {
          const positions = Array.isArray(geofence.coordinates)
            ? geofence.coordinates.map((coord: any) => [coord.lat || coord[1], coord.lng || coord[0]])
            : [];

          if (positions.length > 0) {
            layer = L.polygon(positions, {
              color: color,
              weight: 3,
              fillColor: color,
              fillOpacity: 0.2
            });

            layer.bindPopup(`
              <div style="padding: 8px;">
                <h3 style="font-weight: 600; margin-bottom: 4px;">${geofence.name}</h3>
                ${geofence.description ? `<p style="font-size: 0.875rem; color: #666; margin-top: 4px;">${geofence.description}</p>` : ''}
                <div style="font-size: 0.75rem; color: #999; margin-top: 8px;">
                  <div>Type: ${geofence.type}</div>
                  <div>Points: ${positions.length}</div>
                </div>
              </div>
            `);
          }
        }

        else if (geofence.type === 'line' && geofence.coordinates) {
          const positions = Array.isArray(geofence.coordinates)
            ? geofence.coordinates.map((coord: any) => [coord.lat || coord[1], coord.lng || coord[0]])
            : [];

          if (positions.length > 0) {
            layer = L.polyline(positions, {
              color: color,
              weight: 4,
              opacity: 0.7
            });

            layer.bindPopup(`
              <div style="padding: 8px;">
                <h3 style="font-weight: 600; margin-bottom: 4px;">${geofence.name}</h3>
                ${geofence.description ? `<p style="font-size: 0.875rem; color: #666; margin-top: 4px;">${geofence.description}</p>` : ''}
                <div style="font-size: 0.75rem; color: #999; margin-top: 8px;">
                  <div>Type: ${geofence.type}</div>
                  <div>Points: ${positions.length}</div>
                </div>
              </div>
            `);
          }
        }

        // Fallback: marker
        else if (geofence.center_lat && geofence.center_lng) {
          layer = L.marker([geofence.center_lat, geofence.center_lng]);

          layer.bindPopup(`
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">${geofence.name}</h3>
              ${geofence.description ? `<p style="font-size: 0.875rem; color: #666; margin-top: 4px;">${geofence.description}</p>` : ''}
            </div>
          `);
        }

        if (layer) {
          layer.addTo(map);
          newLayers.push(layer);
        }
      } catch (error) {
        console.error(`Error rendering geofence ${geofence.name}:`, error);
      }
    });

    setGeofenceLayers(newLayers);

    console.log(`✅ Rendered ${newLayers.length} geofences on map`);

    // Cleanup on unmount
    return () => {
      newLayers.forEach(layer => {
        try {
          if (map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
        } catch (e) {
          console.warn('Error cleaning up layer:', e);
        }
      });
    };
  }, [map, geofences]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeofenceClick = (geofence: Geofence) => {
    if (!map || !geofence.center_lat || !geofence.center_lng) return;

    try {
      map.setView([geofence.center_lat, geofence.center_lng], 14);
      toast({
        title: "Zoomed to Geofence",
        description: geofence.name
      });
    } catch (error) {
      console.error('Error zooming to geofence:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Loading geofences...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Geofences ({geofences.length})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadGeofences()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {geofences.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No geofences with coordinates found. Run the geocoding script to add coordinates.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {geofences.map(geofence => (
              <div
                key={geofence.id}
                className="p-2 border rounded hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleGeofenceClick(geofence)}
              >
                <div className="flex items-start gap-2">
                  {geofence.type === 'circle' && <CircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  {geofence.type === 'line' && <Route className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  {geofence.type === 'polygon' && <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{geofence.name}</p>
                    {geofence.description && (
                      <p className="text-xs text-muted-foreground truncate">{geofence.description}</p>
                    )}
                    {geofence.metadata && 'city' in geofence.metadata && (
                      <p className="text-xs text-muted-foreground">{String(geofence.metadata.city)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary stats */}
        {allGeofences.length > geofences.length && (
          <Alert className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {allGeofences.length - geofences.length} geofences need geocoding
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
