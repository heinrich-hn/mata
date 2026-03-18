/**
 * Enhanced Track Visualization Component
 * Provides advanced track playback, heatmaps, speed profiles, and analytics
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import
  {
    advancedRouteTrackingService,
    type StopAnalysis,
    type TrackVisualizationData
  } from '@/services/advancedRouteTracking';
import 'leaflet/dist/leaflet.css';
import { Activity, AlertTriangle, Gauge, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

// Additional interfaces for component props
interface TrackPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: Date;
  heading?: number;
}

interface SpeedProfilePoint {
  timestamp: Date;
  speed: number;
  avgSpeed?: number;
  speedLimit?: number;
}

interface AnalyticsData {
  totalDistance: number;
  totalDuration: number;
  avgSpeed: number;
  maxSpeed: number;
  idleTime: number;
  movingTime: number;
  stopCount?: number;
  fuelConsumption?: number;
  efficiency?: number;
}

// Define prop types for the component
interface EnhancedTrackVisualizationProps {
  vehicleId: string;
  vehicleName: string;
  startTime: Date;
  endTime: Date;
  plannedRoute?: { lat: number; lng: number }[];
  showHeatmap?: boolean;
  showSpeedProfile?: boolean;
  showAnalytics?: boolean;
}

// Speed-based color mapping for track segments
const getSpeedColor = (speed: number): string => {
  if (speed < 20) return '#ef4444';   // Red - very slow/stopped
  if (speed < 40) return '#f97316';   // Orange - slow
  if (speed < 60) return '#eab308';   // Yellow - moderate
  if (speed < 80) return '#22c55e';   // Green - good
  if (speed < 100) return '#3b82f6';  // Blue - fast
  return '#8b5cf6';                   // Purple - very fast
};

// Heatmap Layer Component
const HeatmapLayer: React.FC<{ points: { lat: number; lng: number; intensity: number }[] }> = ({ points }) => (
  <>
    {points.map((point, idx) => (
      <CircleMarker
        key={idx}
        center={[point.lat, point.lng]}
        radius={Math.max(5, point.intensity * 20)}
        fillColor="#dc2626"
        fillOpacity={point.intensity * 0.6}
        stroke={false}
      />
    ))}
  </>
);

// Animated Vehicle Marker Component
const AnimatedVehicleMarker: React.FC<{
  position: [number, number];
  heading: number;
  speed: number;
}> = ({ position, heading, speed }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [position, map]);

  return (
    <CircleMarker
      center={position}
      radius={8}
      fillColor="#2563eb"
      fillOpacity={1}
      color="#ffffff"
      weight={2}
    >
      <Popup>
        <div className="text-sm">
          <p className="font-semibold">Speed: {speed.toFixed(1)} km/h</p>
          <p>Heading: {heading.toFixed(0)}°</p>
        </div>
      </Popup>
    </CircleMarker>
  );
};

export const EnhancedTrackVisualization: React.FC<EnhancedTrackVisualizationProps> = ({
  vehicleId,
  vehicleName,
  startTime,
  endTime,
  plannedRoute,
  showHeatmap = true,
  showSpeedProfile = true,
  showAnalytics = true,
}) => {
  const [trackData, setTrackData] = useState<TrackVisualizationData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load track data
  useEffect(() => {
    const loadTrackData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await advancedRouteTrackingService.generateTrackVisualization(
          vehicleId,
          startTime,
          endTime
        );

        if (!data || data.points.length === 0) {
          setError(`No GPS tracking data found for ${vehicleName} during this time period. The vehicle may not have been active or GPS data was not recorded.`);
        }

        setTrackData(data);
      } catch (error) {
        console.error('Failed to load track data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load track data');
      } finally {
        setLoading(false);
      }
    };

    loadTrackData();
  }, [vehicleId, vehicleName, startTime, endTime]);

  // Playback control
  useEffect(() => {
    if (!isPlaying || !trackData || currentIndex >= trackData.points.length - 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => Math.min(prev + 1, trackData.points.length - 1));
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, trackData, currentIndex]);

  // Create colored track segments based on speed
  const coloredTrackSegments = useMemo(() => {
    if (!trackData) return [];

    const segments: { points: [number, number][]; color: string }[] = [];
    let currentSegment: [number, number][] = [];
    let currentColor = '';

    trackData.points.forEach((point, idx) => {
      const color = getSpeedColor(point.speed);
      const coords: [number, number] = [point.lat, point.lng];

      if (color !== currentColor && currentSegment.length > 0) {
        segments.push({ points: [...currentSegment], color: currentColor });
        currentSegment = [coords];
        currentColor = color;
      } else {
        currentSegment.push(coords);
        if (idx === 0) currentColor = color;
      }
    });

    if (currentSegment.length > 0) {
      segments.push({ points: currentSegment, color: currentColor });
    }

    return segments;
  }, [trackData]);

  // Stop markers
  const stopMarkers = useMemo(() => {
    if (!trackData) return [];
    return trackData.stopAnalysis.filter(stop => stop.duration >= 5); // Show stops >= 5 minutes
  }, [trackData]);

  // Handle playback controls
  const handlePlayPause = () => {
    if (currentIndex >= (trackData?.points.length ?? 0) - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(prev => !prev);
  };

  const handleSkipForward = () => {
    if (!trackData) return;
    setCurrentIndex(Math.min(currentIndex + 10, trackData.points.length - 1));
  };

  const handleSkipBack = () => {
    setCurrentIndex(Math.max(currentIndex - 10, 0));
  };

  const handleSliderChange = (value: number[]) => {
    setCurrentIndex(value[0]);
    setIsPlaying(false);
  };

  // Loading and empty track data handling
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} vehicleName={vehicleName} startTime={startTime} endTime={endTime} />;
  if (!trackData || trackData.points.length === 0) return <EmptyState vehicleName={vehicleName} startTime={startTime} endTime={endTime} />;

  const currentPoint = trackData.points[currentIndex];
  const mapCenter: [number, number] = [
    trackData.points[Math.floor(trackData.points.length / 2)].lat,
    trackData.points[Math.floor(trackData.points.length / 2)].lng,
  ];

  return (
    <div className="space-y-4">
      {/* Map Component */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Track Visualization - {vehicleName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrackMap
            mapCenter={mapCenter}
            plannedRoute={plannedRoute}
            coloredTrackSegments={coloredTrackSegments}
            showHeatmap={showHeatmap}
            heatmapData={trackData.heatmapData}
            stopMarkers={stopMarkers}
            currentPoint={currentPoint}
          />
          <PlaybackControls
            isPlaying={isPlaying}
            onSkipBack={handleSkipBack}
            onPlayPause={handlePlayPause}
            onSkipForward={handleSkipForward}
            onSpeedChange={setPlaybackSpeed}
            currentIndex={currentIndex}
            totalPoints={trackData.points.length}
            onSliderChange={handleSliderChange}
            startTime={startTime}
            endTime={endTime}
            playbackSpeed={playbackSpeed}
            currentPoint={currentPoint}
          />
        </CardContent>
      </Card>

      {/* Analytics Dashboard */}
      {showAnalytics && <AnalyticsDashboard analytics={trackData.analytics} stopMarkers={stopMarkers} />}

      {/* Speed Profile Chart */}
      {showSpeedProfile && <SpeedProfileChart speedProfile={trackData.speedProfile} currentIndex={currentIndex} />}
    </div>
  );
};

// Loading State Component
const LoadingState: React.FC = () => (
  <Card>
    <CardContent className="p-6">
      <p className="text-center text-muted-foreground">Loading track data...</p>
    </CardContent>
  </Card>
);

// Empty State Component
const EmptyState: React.FC<{ vehicleName: string; startTime: Date; endTime: Date }> = ({ vehicleName, startTime, endTime }) => (
  <Card>
    <CardContent className="p-8 text-center space-y-4">
      <div className="flex justify-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">No GPS Data Available</h3>
        <p className="text-sm text-muted-foreground">
          No GPS tracking data found for <strong>{vehicleName}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Period: {startTime.toLocaleString()} - {endTime.toLocaleString()}
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-left">
          <p className="text-sm font-medium mb-2">Possible reasons:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Vehicle was not actively tracked during this period</li>
            <li>GPS device was offline or not transmitting</li>
            <li>Data has not been synced from Wialon yet</li>
            <li>Vehicle assignment may need to be verified</li>
          </ul>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Error State Component
const ErrorState: React.FC<{ message: string; vehicleName: string; startTime: Date; endTime: Date }> = ({ message, vehicleName, startTime, endTime }) => (
  <Card>
    <CardContent className="p-8 text-center space-y-4">
      <div className="flex justify-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-red-600">Unable to Load Track Data</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
          <p className="text-sm font-medium mb-2">Details:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li><strong>Vehicle:</strong> {vehicleName}</li>
            <li><strong>Start:</strong> {startTime.toLocaleString()}</li>
            <li><strong>End:</strong> {endTime.toLocaleString()}</li>
          </ul>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Track Map Component
const TrackMap: React.FC<{
  mapCenter: [number, number];
  plannedRoute?: { lat: number; lng: number }[];
  coloredTrackSegments: { points: [number, number][]; color: string }[];
  showHeatmap: boolean;
  heatmapData: { lat: number; lng: number; intensity: number }[];
  stopMarkers: StopAnalysis[];
  currentPoint: TrackPoint | null;
}> = ({ mapCenter, plannedRoute, coloredTrackSegments, showHeatmap, heatmapData, stopMarkers, currentPoint }) => (
  <div className="relative h-[600px] w-full rounded-lg overflow-hidden">
    <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {plannedRoute && (
        <Polyline positions={plannedRoute.map(p => [p.lat, p.lng])} color="#94a3b8" weight={3} opacity={0.5} dashArray="10, 10" />
      )}
      {coloredTrackSegments.map((segment, idx) => (
        <Polyline key={idx} positions={segment.points} color={segment.color} weight={4} opacity={0.8} />
      ))}
      {showHeatmap && <HeatmapLayer points={heatmapData} />}
      {stopMarkers.map((stop, idx) => (
        <CircleMarker
          key={`stop-${idx}`}
          center={[stop.location.lat, stop.location.lng]}
          radius={6}
          fillColor={stop.type === 'planned' ? '#22c55e' : '#f59e0b'}
          fillOpacity={1}
          color="#ffffff"
          weight={2}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{stop.type === 'planned' ? 'Planned Stop' : 'Unplanned Stop'}</p>
              {stop.geofenceName && <p>Location: {stop.geofenceName}</p>}
              <p>Duration: {stop.duration.toFixed(0)} minutes</p>
              <p>Time: {stop.startTime.toLocaleTimeString()}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {currentPoint && (
        <AnimatedVehicleMarker position={[currentPoint.lat, currentPoint.lng]} heading={currentPoint.heading} speed={currentPoint.speed} />
      )}
    </MapContainer>
  </div>
);

// Playback Controls Component
const PlaybackControls: React.FC<{
  isPlaying: boolean;
  onSkipBack: () => void;
  onPlayPause: () => void;
  onSkipForward: () => void;
  onSpeedChange: (speed: number) => void;
  currentIndex: number;
  totalPoints: number;
  onSliderChange: (value: number[]) => void;
  startTime: Date;
  endTime: Date;
  playbackSpeed: number;
  currentPoint: TrackPoint | null;
}> = ({ isPlaying, onSkipBack, onPlayPause, onSkipForward, onSpeedChange, currentIndex, totalPoints, onSliderChange, startTime, endTime, playbackSpeed, currentPoint }) => {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={onSkipBack} variant="outline" size="sm"><SkipBack className="h-4 w-4" /></Button>
        <Button onClick={onPlayPause} size="sm">{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
        <Button onClick={onSkipForward} variant="outline" size="sm"><SkipForward className="h-4 w-4" /></Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Speed:</span>
          {[0.5, 1, 2, 5, 10].map(speed => (
            <Button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              variant={playbackSpeed === speed ? 'default' : 'outline'}
              size="sm"
            >
              {speed}x
            </Button>
          ))}
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {currentPoint?.timestamp.toLocaleTimeString()}
        </div>
      </div>

      <Slider
        value={[currentIndex]}
        onValueChange={onSliderChange}
        max={totalPoints - 1}
        step={1}
        className="w-full"
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{startTime.toLocaleTimeString()}</span>
        <span>{currentIndex + 1} / {totalPoints}</span>
        <span>{endTime.toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

// Analytics Dashboard Component
const AnalyticsDashboard: React.FC<{ analytics: AnalyticsData; stopMarkers: StopAnalysis[] }> = ({ analytics, stopMarkers: _stopMarkers }) => {
  // Map display labels to actual analytics properties
  const summaryItems = [
    { label: 'Total Distance', value: analytics.totalDistance ?? 0, unit: 'km' },
    { label: 'Duration', value: (analytics.totalDuration ?? 0) / 60, unit: 'min' },
    { label: 'Avg Speed', value: analytics.avgSpeed ?? 0, unit: 'km/h' },
    { label: 'Max Speed', value: analytics.maxSpeed ?? 0, unit: 'km/h' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4" /> Trip Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summaryItems.map((item, index) => (
            <SummaryItem key={index} label={item.label} value={item.value} unit={item.unit} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EfficiencyItem efficiency={analytics.efficiency} totalDuration={analytics.totalDuration} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Driving Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {['Harsh Braking', 'Harsh Acceleration', 'Unplanned Stops'].map((label, index) => (
            <DrivingEventItem key={index} label={label} count={analytics[label.toLowerCase().replace(/\s+/g, '')]} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// Summary Item Component
const SummaryItem: React.FC<{ label: string; value: number; unit?: string }> = ({ label, value, unit = 'km' }) => (
  <div className="flex justify-between">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-semibold">{value.toFixed(1)} {unit}</span>
  </div>
);

// Efficiency Item Component
const EfficiencyItem: React.FC<{ efficiency?: number; totalDuration: number }> = ({ efficiency = 0, totalDuration }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-sm text-muted-foreground">Overall Score</span>
      <span className="font-semibold">{efficiency.toFixed(0)}%</span>
    </div>
    <Progress value={efficiency} className="h-2" />
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">Idle Time</span>
      <span className="font-semibold">{((totalDuration ?? 0) / 60).toFixed(0)} min</span>
    </div>
  </div>
);

// Driving Event Item Component
const DrivingEventItem: React.FC<{ label: string; count?: number }> = ({ label, count = 0 }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <Badge variant={count > 5 ? 'destructive' : 'secondary'}>
      {count}
    </Badge>
  </div>
);

// Speed Profile Chart Component
const SpeedProfileChart: React.FC<{ speedProfile: SpeedProfilePoint[]; currentIndex: number }> = ({ speedProfile, currentIndex }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Speed Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 flex items-end gap-px">
          {speedProfile.slice(0, 100).map((profile, idx) => (
            <div
              key={idx}
              className="flex-1 bg-primary transition-all"
              style={{
                height: `${(profile.speed / (profile.speedLimit || 120)) * 100}%`,
                opacity: idx === currentIndex ? 1 : 0.5,
              }}
              title={`${profile.speed.toFixed(1)} km/h at ${profile.timestamp.toLocaleTimeString()}`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary" />
            <span className="text-muted-foreground">Actual Speed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedTrackVisualization;
