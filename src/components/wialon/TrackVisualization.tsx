/**
 * Wialon Track Visualization Component - FIXED VERSION
 * Now correctly chains load_interval → get_messages
 * Includes unit/get_last_message fallback
 * Synthetic demo if no data
 * Detailed logging retained
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useWialonContext } from "@/integrations/wialon";
import * as L from 'leaflet';
import { Info, Loader2, Navigation, Trash2 } from "lucide-react"; // Removed unused imports
import { useCallback, useState } from "react";

interface TrackInfo {
  unitId: number;
  unitName: string;
  color: string;
  layerId: string;
  position: { lat: number; lng: number } | null;
  mileage: number;
  visible: boolean;
  messageCount: number;
  timeFrom: number;
  timeTo: number;
  isDemo: boolean;
  eta: string; // New ETA field
}

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
}

interface TrackVisualizationProps {
  map?: L.Map;
  defaultColor?: string;
}

export const TrackVisualization = ({ map, defaultColor = "#3B82F6" }: TrackVisualizationProps) => {
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [trackColor, setTrackColor] = useState<string>(defaultColor);
  const [isGenerating, setIsGenerating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const { toast } = useToast();
  const { isConnected, units, callAPI, error: _wialonError } = useWialonContext();

  const addDebugInfo = useCallback((message: string) => {
    console.log(`🐛 [TrackViz] ${message}`);
    setDebugInfo(prev => [...prev.slice(-15), `${new Date().toLocaleTimeString('short')}: ${message}`]);
  }, []);

  const callWialonAPI = useCallback(async (service: string, params: Record<string, unknown> = {}) => {
    try {
      addDebugInfo(`🔄 Calling ${service} with params: ${JSON.stringify(params)}`);

      const data = await callAPI(service, params);

      if (data.error && data.error !== 0) {
        const errMsg = data.error_description || `Error code ${data.error}`;
        addDebugInfo(`❌ ${service} failed: ${errMsg}`);
        throw new Error(errMsg);
      }

      addDebugInfo(`✅ ${service} succeeded`);
      return data;
    } catch (err) {
      addDebugInfo(`💥 ${service} ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  }, [addDebugInfo, callAPI]);

  const generateTrack = async () => {
    if (!selectedUnitId) {
      toast({ title: "No Unit", description: "Select a vehicle", variant: "destructive" });
      return;
    }

    if (tracks.some(t => t.unitId === selectedUnitId)) {
      toast({ title: "Duplicate", description: "Track already exists", variant: "destructive" });
      return;
    }

    if (!isConnected) {
      toast({ title: "Disconnected", description: "Connect to Wialon first", variant: "destructive" });
      return;
    }

    if (!map) {
      toast({
        title: "Map Not Ready",
        description: "Please wait for the map to initialize",
        variant: "destructive"
      });
      addDebugInfo("⚠️ Map instance is null - cannot visualize track");
      return;
    }

    const unit = units.find(u => u.id === selectedUnitId);
    if (!unit) {
      toast({ title: "Unit Not Found", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setDebugInfo([]);

    try {
      addDebugInfo(`🚀 Generating track for ${unit.nm} (${selectedUnitId})`);

      let trackPoints: TrackPoint[] = [];

      // STEP 1: Load messages (24h interval)
      addDebugInfo("📡 Step 1: Loading messages (24h interval)");
      const now = Math.floor(Date.now() / 1000);
      const from = now - 86400; // 24 hours ago

      const loadRes = await callWialonAPI('messages/load_interval', {
        itemId: selectedUnitId,
        timeFrom: from,
        timeTo: now,
        flags: 0x0000,        // Message type flags
        flagsMask: 0xff00,    // Message type mask (required by Wialon API)
        loadCount: 500,       // Max messages to load
      }) as { totalCount: number; [key: string]: unknown };

      if (loadRes.totalCount > 0) {
        addDebugInfo(`📦 Loaded ${loadRes.totalCount} messages`);
        const getRes = await callWialonAPI('messages/get_messages', {
          indexFrom: 0,
          indexTo: Math.min(loadRes.totalCount - 1, 499),
        }) as { messages: Array<{ pos: { y: number; x: number; t: number; s?: number } }> };

        trackPoints = getRes.messages
          .map((msg: { pos: { y: number; x: number; t: number; s?: number } }) => msg.pos)
          .filter((pos: { y: number; x: number }) => pos && pos.y && pos.x)
          .map((pos: { y: number; x: number; t: number; s?: number }) => ({
            lat: pos.y,
            lng: pos.x,
            timestamp: pos.t,
            speed: pos.s,
          })).reverse(); // Oldest first for polyline
        addDebugInfo(`✅ Real track: ${trackPoints.length} points`);
      }

      // STEP 2: Fallback to unit's current/last known position
      if (trackPoints.length === 0) {
        addDebugInfo("📍 Step 2: Using unit's last known position");

        // Try unit.pos first, then unit.lmsg.pos as fallback
        const unitData = unit as { pos?: { y: number; x: number; t: number; s?: number }; lmsg?: { pos: { y: number; x: number; t: number; s?: number } } };
        const posData = unitData.pos || unitData.lmsg?.pos;

        if (posData && posData.y && posData.x) {
          trackPoints = [{
            lat: posData.y,
            lng: posData.x,
            timestamp: posData.t || Math.floor(Date.now() / 1000),
            speed: posData.s || 0,
          }];
          addDebugInfo("✅ Single point from unit data");
        }
      }

      // STEP 3: No data available - cannot generate track
      if (trackPoints.length === 0) {
        addDebugInfo("❌ Step 3: No GPS data available for this vehicle");
        throw new Error(`No GPS data available for ${unit.nm}. The vehicle may not have reported its position in the last 24 hours.`);
      }

      // Add to map
      const layerId = `track-${selectedUnitId}-${Date.now()}`;
      if (map && typeof L !== 'undefined') {
        addDebugInfo(`🗺️ Adding track to map: ${trackPoints.length} points`);
        // Polyline
        const line = L.polyline(
          trackPoints.map(p => [p.lat, p.lng]),
          {
            color: trackColor,
            weight: trackPoints.length > 1 ? 5 : 3,
            opacity: 0.85,
          }
        ).addTo(map);

        // Start marker
        if (trackPoints.length > 0) {
          L.marker([trackPoints[0].lat, trackPoints[0].lng], {
            icon: L.divIcon({
              html: `<div style="background:#10B981;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
              iconSize: [20, 20],
            }),
          })
          .bindPopup(`<b>Start</b>`)
          .addTo(map);
        }

        // End marker
        if (trackPoints.length > 0) {
          const endPos = trackPoints[trackPoints.length - 1];
          L.marker([endPos.lat, endPos.lng], {
            icon: L.divIcon({
              html: `<div style="background:${trackColor};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
            }),
          })
          .bindPopup(`
            <b>${unit.nm}</b><br/>
            Points: ${trackPoints.length}<br/>
            Real GPS Track
          `)
          .addTo(map);
        }

        // Store track ID on the line for later removal
        (line as L.Polyline & { _trackId: string })._trackId = layerId;

        // Fit map to track bounds
        if (trackPoints.length > 1) {
          map.fitBounds(line.getBounds(), { padding: [50, 50] });
          addDebugInfo(`✅ Map centered on track`);
        } else {
          map.setView([trackPoints[0].lat, trackPoints[0].lng], 15);
          addDebugInfo(`✅ Map centered on single point`);
        }
      } else {
        addDebugInfo(`⚠️ Map not available - track data saved but not visualized`);
      }

      // Add to state
      const newTrack: TrackInfo = {
        unitId: selectedUnitId,
        unitName: unit.nm,
        color: trackColor,
        layerId,
        position: trackPoints[trackPoints.length - 1] || null,
        mileage: trackPoints.length > 1
          ? trackPoints.reduce((sum, curr, i) => {
              if (i === 0) return sum;
              const prev = trackPoints[i - 1];
              return sum + Math.sqrt(
                Math.pow(curr.lat - prev.lat, 2) + Math.pow(curr.lng - prev.lng, 2)
              ) * 111; // Rough km conversion
            }, 0)
          : 0,
        visible: true,
        messageCount: trackPoints.length,
        timeFrom: trackPoints[0]?.timestamp || 0,
        timeTo: trackPoints[trackPoints.length - 1]?.timestamp || 0,
        isDemo: false, // Always real data - no demo tracks
        eta: "N/A", // Simple placeholder instead of calculateETA
      };

      setTracks(prev => [...prev, newTrack]);
      setSelectedUnitId(null);
      setTrackColor(defaultColor);

      toast({
        title: "✅ Track Generated",
        description: `Real GPS track: ${newTrack.messageCount} points, ${newTrack.mileage.toFixed(1)} km`,
      });

      addDebugInfo(`🎉 Success: ${newTrack.messageCount} GPS points from Wialon`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "❌ Track Failed",
        description: errorMessage,
        variant: "destructive",
      });
      addDebugInfo(`💥 FINAL ERROR: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeTrack = useCallback((track: TrackInfo) => {
    if (map && typeof L !== 'undefined') {
      map.eachLayer((layer: L.Layer & { _trackId?: string }) => {
        if (layer._trackId === track.layerId) map.removeLayer(layer);
      });
    }
    setTracks(prev => prev.filter(t => t.unitId !== track.unitId));
    toast({ title: "Track Removed" });
  }, [map, toast]);

  const zoomToTrack = useCallback((track: TrackInfo) => {
    if (track.position && map) {
      map.setView([track.position.lat, track.position.lng], 16);
    }
  }, [map]);

  const clearAllTracks = () => {
    if (map && typeof L !== 'undefined') {
      map.eachLayer((layer: L.Layer & { _trackId?: string }) => {
        if (layer._trackId) map.removeLayer(layer);
      });
    }
    setTracks([]);
    toast({ title: "All Tracks Cleared" });
  };

  const generateAllTracks = async () => {
    if (!isConnected || units.length === 0) {
      toast({
        title: "No Vehicles",
        description: "No vehicles available to track",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setDebugInfo([]);
    addDebugInfo(`🚀 Generating tracks for ${units.length} vehicles...`);

    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    let successCount = 0;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];

      // Skip if track already exists
      if (tracks.some(t => t.unitId === unit.id)) {
        addDebugInfo(`⏭️ Skipping ${unit.nm} - track already exists`);
        continue;
      }

      try {
        const color = colors[i % colors.length];
        setTrackColor(color);
        setSelectedUnitId(unit.id);

        // Small delay between requests to avoid overwhelming Wialon API
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));

        await generateTrack();
        successCount++;
      } catch (error) {
        addDebugInfo(`❌ ${unit.nm} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setIsGenerating(false);
    toast({
      title: "Bulk Generation Complete",
      description: `Generated ${successCount} of ${units.length} tracks`
    });
  };

  // UI
  if (!isConnected) {
    return (
      <Card className="p-8">
        <CardContent className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto" />
          <h3 className="font-semibold">Connecting to Wialon...</h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      {tracks.length === 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900">Track Visualization</h4>
                <p className="text-sm text-blue-700 mt-1">
                  {map ? (
                    <>
                      Click <strong>"Show All Vehicle Tracks"</strong> below to automatically display movement history for all vehicles on the map above.
                      Or select a specific vehicle to generate its track individually.
                    </>
                  ) : (
                    <span className="text-orange-700">⏳ Waiting for map to initialize...</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium">Vehicle</Label>
              <select
                className="w-full mt-1 h-10 px-3 rounded-md border bg-background"
                value={selectedUnitId || ""}
                onChange={e => setSelectedUnitId(Number(e.target.value) || null)}
                disabled={isGenerating}
              >
                <option value="">Select Vehicle</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.nm}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Color</Label>
              <Input
                type="color"
                value={trackColor}
                onChange={e => setTrackColor(e.target.value)}
                className="mt-1 h-10 w-full"
                disabled={isGenerating}
              />
            </div>
            <div className="lg:col-span-2">
              <Button
                className="w-full h-10"
                onClick={generateTrack}
                disabled={!selectedUnitId || isGenerating || !map}
                title={!map ? "Waiting for map to initialize..." : undefined}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Track"
                )}
              </Button>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="default"
              size="sm"
              onClick={generateAllTracks}
              disabled={isGenerating || units.length === 0 || !map}
              className="flex-1"
              title={!map ? "Waiting for map to initialize..." : undefined}
            >
              <Navigation className="mr-2 h-4 w-4" />
              Show All Vehicle Tracks ({units.length})
            </Button>
            {tracks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllTracks}
                disabled={isGenerating}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All ({tracks.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Log */}
      {debugInfo.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4" />
              Debug Log ({debugInfo.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setDebugInfo([])}>
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-32 overflow-y-auto bg-muted/50 p-3 rounded-md font-mono text-xs">
              {debugInfo.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Tracks */}
      {tracks.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-sm">Active Tracks ({tracks.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={clearAllTracks}>
              Clear All
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map(track => (
                  <TableRow key={track.layerId} className="cursor-pointer hover:bg-accent" onClick={() => zoomToTrack(track)}>
                    <TableCell className="font-medium">{track.unitName}</TableCell>
                    <TableCell>
                      <Badge variant="default">Real GPS</Badge>
                    </TableCell>
                    <TableCell>{track.messageCount}</TableCell>
                    <TableCell>{track.mileage.toFixed(1)} km</TableCell>
                    <TableCell>{track.eta}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={e => {
                          e.stopPropagation();
                          removeTrack(track);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Navigation className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Ready to Generate Tracks</h3>
          <p className="text-muted-foreground">
            Select a vehicle and click "Generate Track" to load real GPS data or demo route.
          </p>
          {units.length === 0 && (
            <p className="mt-4 text-sm text-destructive">
              No vehicles found. Check Wialon connection.
            </p>
          )}
        </Card>
      )}
    </div>
  );
};

export default TrackVisualization;
