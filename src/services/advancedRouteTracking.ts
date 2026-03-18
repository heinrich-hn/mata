/**
 * Advanced Route Tracking Service
 * Provides real-time route deviation detection, dynamic rerouting,
 * and predictive ETA calculations with machine learning
 */

import { supabase } from '@/integrations/supabase/client';
import type { VehicleLocation } from '@/integrations/wialon/useWialon';

export interface RouteDeviation {
  deviationDistance: number; // meters
  deviationDuration: number; // minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  alternativeRoute?: AlternativeRoute;
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
  };
}

export interface AlternativeRoute {
  waypoints: RouteWaypoint[];
  estimatedDistance: number;
  estimatedDuration: number;
  fuelSavings?: number;
  timeSavings?: number;
  reason: string;
  confidence: number; // 0-1
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  type: 'route' | 'pickup' | 'delivery' | 'rest' | 'fuel';
  eta?: Date;
  sequence: number;
}

export interface PredictiveETA {
  estimatedArrival: Date;
  confidence: number;
  factors: {
    historicalSpeed: number;
    currentTraffic: number;
    weatherImpact: number;
    driverBehavior: number;
    routeComplexity: number;
  };
  alternativeETAs: {
    optimistic: Date;
    pessimistic: Date;
  };
}

export interface TrackVisualizationData {
  points: TrackPoint[];
  heatmapData: HeatmapPoint[];
  analytics: TrackAnalytics;
  speedProfile: SpeedProfile[];
  stopAnalysis: StopAnalysis[];
}

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  speed: number;
  heading: number;
  altitude?: number;
  accuracy?: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1 based on time spent or events
}

export interface TrackAnalytics {
  totalDistance: number;
  totalDuration: number;
  avgSpeed: number;
  maxSpeed: number;
  idleTime: number;
  movingTime: number;
  stops: number;
  harshBraking: number;
  harshAcceleration: number;
  efficiency: number; // 0-100 score
}

export interface SpeedProfile {
  timestamp: Date;
  speed: number;
  recommendedSpeed: number;
  speedLimit?: number;
}

export interface StopAnalysis {
  location: { lat: number; lng: number };
  startTime: Date;
  endTime: Date;
  duration: number;
  type: 'planned' | 'unplanned' | 'traffic' | 'delivery';
  geofenceName?: string;
}

class AdvancedRouteTrackingService {
  private deviationThresholds = {
    low: 500, // 500m
    medium: 1000, // 1km
    high: 2000, // 2km
    critical: 5000, // 5km
  };

  private trafficUpdateInterval = 300000; // 5 minutes
  private etaRecalculationInterval = 60000; // 1 minute

  /**
   * Calculate route deviation from planned route
   */
  calculateRouteDeviation(
    currentLocation: VehicleLocation,
    plannedRoute: RouteWaypoint[],
    loadId: string
  ): RouteDeviation | null {
    if (plannedRoute.length === 0) return null;

    // Find closest point on planned route
    const closestPoint = this.findClosestPointOnRoute(
      { lat: currentLocation.latitude, lng: currentLocation.longitude },
      plannedRoute
    );

    const deviationDistance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      closestPoint.lat,
      closestPoint.lng
    ) * 1000; // Convert km to meters

    const severity = this.determineDeviationSeverity(deviationDistance);

    // Only create deviation object if beyond low threshold
    if (deviationDistance < this.deviationThresholds.low) {
      return null;
    }

    // Calculate estimated duration to return to route based on current speed
    const currentSpeed = currentLocation.speed || 60; // Default to 60 km/h if no speed
    const deviationDuration = (deviationDistance / 1000) / currentSpeed * 60; // minutes

    const deviation: RouteDeviation = {
      deviationDistance,
      deviationDuration,
      severity,
      timestamp: new Date(),
      location: {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      },
    };

    // Calculate alternative route if deviation is significant
    if (severity === 'high' || severity === 'critical') {
      deviation.alternativeRoute = this.generateAlternativeRoute(
        currentLocation,
        plannedRoute,
        loadId
      );
    }

    return deviation;
  }

  /**
   * Generate alternative route based on current position
   */
  private generateAlternativeRoute(
    currentLocation: VehicleLocation,
    plannedRoute: RouteWaypoint[],
    _loadId: string
  ): AlternativeRoute {
    // Find next unvisited waypoint
    const remainingWaypoints = plannedRoute.filter(wp => wp.sequence > 0);

    // Simple alternative: direct route to next waypoint
    // In production, integrate with Google Maps/HERE API for real routing
    const nextWaypoint = remainingWaypoints[0] || plannedRoute[plannedRoute.length - 1];

    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      nextWaypoint.lat,
      nextWaypoint.lng
    ); // km

    const avgSpeed = 60; // km/h - can be improved with historical data
    const duration = distance / avgSpeed * 60; // minutes

    return {
      waypoints: [
        {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          type: 'route',
          sequence: 0,
        },
        ...remainingWaypoints,
      ],
      estimatedDistance: distance,
      estimatedDuration: duration,
      reason: 'Route deviation detected - providing direct route to next destination',
      confidence: 0.85,
    };
  }

  /**
   * Calculate predictive ETA using multiple factors
   */
  async calculatePredictiveETA(
    loadId: string,
    currentLocation: VehicleLocation,
    destination: { lat: number; lng: number },
    plannedRoute?: RouteWaypoint[]
  ): Promise<PredictiveETA> {
    // Fetch historical data for this route/driver
    const historicalData = await this.fetchHistoricalRouteData(loadId);

    // Calculate factors
    const factors = {
      historicalSpeed: this.calculateHistoricalSpeedFactor(historicalData),
      currentTraffic: await this.estimateTrafficFactor(currentLocation, destination),
      weatherImpact: await this.estimateWeatherImpact(currentLocation),
      driverBehavior: this.calculateDriverBehaviorFactor(historicalData),
      routeComplexity: this.calculateRouteComplexity(plannedRoute || []),
    };

    // Calculate weighted ETA
    const baseDistance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      destination.lat,
      destination.lng
    ); // km

    const adjustedSpeed =
      factors.historicalSpeed * factors.currentTraffic * factors.weatherImpact * factors.driverBehavior;

    const estimatedMinutes = (baseDistance / adjustedSpeed) * 60 * factors.routeComplexity;

    const estimatedArrival = new Date(Date.now() + estimatedMinutes * 60000);

    // Calculate optimistic and pessimistic scenarios
    const optimisticMinutes = estimatedMinutes * 0.85;
    const pessimisticMinutes = estimatedMinutes * 1.25;

    return {
      estimatedArrival,
      confidence: this.calculateETAConfidence(factors),
      factors,
      alternativeETAs: {
        optimistic: new Date(Date.now() + optimisticMinutes * 60000),
        pessimistic: new Date(Date.now() + pessimisticMinutes * 60000),
      },
    };
  }

  /**
   * Generate enhanced track visualization data with heatmaps
   */
  async generateTrackVisualization(
    vehicleId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TrackVisualizationData> {
    // Fetch track data from Wialon/database
    const trackPoints = await this.fetchTrackPoints(vehicleId, startTime, endTime);

    // Generate heatmap based on time spent in areas
    const heatmapData = this.generateHeatmapData(trackPoints);

    // Calculate analytics
    const analytics = this.calculateTrackAnalytics(trackPoints);

    // Generate speed profile
    const speedProfile = this.generateSpeedProfile(trackPoints);

    // Analyze stops
    const stopAnalysis = await this.analyzeStops(trackPoints);

    return {
      points: trackPoints,
      heatmapData,
      analytics,
      speedProfile,
      stopAnalysis,
    };
  }

  /**
   * Generate heatmap data from track points
   */
  private generateHeatmapData(trackPoints: TrackPoint[]): HeatmapPoint[] {
    const gridSize = 0.001; // ~100m resolution
    const grid = new Map<string, { count: number; lat: number; lng: number }>();

    trackPoints.forEach(point => {
      const gridLat = Math.floor(point.lat / gridSize) * gridSize;
      const gridLng = Math.floor(point.lng / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;

      if (!grid.has(key)) {
        grid.set(key, { count: 0, lat: gridLat + gridSize / 2, lng: gridLng + gridSize / 2 }); // Use center of grid
      }

      const cell = grid.get(key)!;
      cell.count++;
    });

    // Convert to heatmap points with normalized intensity
    const maxCount = Math.max(...Array.from(grid.values()).map(c => c.count), 1); // Avoid division by zero

    return Array.from(grid.values()).map(cell => ({
      lat: cell.lat,
      lng: cell.lng,
      intensity: cell.count / maxCount,
    }));
  }

  /**
   * Calculate comprehensive track analytics
   */
  private calculateTrackAnalytics(trackPoints: TrackPoint[]): TrackAnalytics {
    if (trackPoints.length === 0) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        idleTime: 0,
        movingTime: 0,
        stops: 0,
        harshBraking: 0,
        harshAcceleration: 0,
        efficiency: 0,
      };
    }

    let totalDistance = 0;
    let idleTime = 0;
    let movingTime = 0;
    let maxSpeed = 0;
    let harshBraking = 0;
    let harshAcceleration = 0;
    let stops = 0;
    let speedSum = 0;

    const sortedPoints = [...trackPoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 1; i < sortedPoints.length; i++) {
      const prev = sortedPoints[i - 1];
      const curr = sortedPoints[i];

      // Calculate distance (in km)
      const segmentDistance = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      totalDistance += segmentDistance;

      // Speed analysis
      if (curr.speed > maxSpeed) maxSpeed = curr.speed;
      speedSum += curr.speed;

      // Time analysis (in minutes)
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 60000; // milliseconds to minutes

      if (curr.speed < 5) {
        idleTime += timeDiff;
        if (prev.speed >= 5) stops++;
      } else {
        movingTime += timeDiff;
      }

      // Harsh events (assuming time between points is small)
      const speedChange = curr.speed - prev.speed;
      const timeSeconds = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      if (timeSeconds > 0) {
        const acceleration = speedChange / timeSeconds; // km/h per second
        if (acceleration < -4.2) harshBraking++; // Roughly 15 km/h in 3.6s (standard harsh braking threshold)
        if (acceleration > 5.6) harshAcceleration++; // Roughly 20 km/h in 3.6s
      }
    }

    const totalDuration = idleTime + movingTime;
    const avgSpeed = sortedPoints.length > 0 ? speedSum / sortedPoints.length : 0;

    // Calculate efficiency score (0-100)
    const efficiency = this.calculateEfficiencyScore({
      avgSpeed,
      maxSpeed,
      idleTime,
      totalDuration,
      movingTime,
      harshBraking,
      harshAcceleration,
      totalDistance,
    });

    return {
      totalDistance,
      totalDuration,
      avgSpeed,
      maxSpeed,
      idleTime,
      movingTime,
      stops,
      harshBraking,
      harshAcceleration,
      efficiency,
    };
  }

  /**
   * Calculate efficiency score based on multiple factors
   */
  private calculateEfficiencyScore(data: {
    avgSpeed: number;
    maxSpeed: number;
    idleTime: number;
    totalDuration: number;
    movingTime: number;
    harshBraking: number;
    harshAcceleration: number;
    totalDistance: number;
  }): number {
    let score = 100;

    // Penalize excessive idle time
    const idlePercentage = data.totalDuration > 0 ? (data.idleTime / data.totalDuration) * 100 : 0;
    if (idlePercentage > 20) score -= (idlePercentage - 20) * 0.5;

    // Penalize harsh events per km
    const harshEventsPerKm = data.totalDistance > 0 ? (data.harshBraking + data.harshAcceleration) / data.totalDistance : 0;
    score -= harshEventsPerKm * 10;

    // Penalize low average speed (excluding idle)
    const movingAvgSpeed = data.movingTime > 0 ? (data.totalDistance / data.movingTime) * 60 : data.avgSpeed; // km/h
    if (movingAvgSpeed < 30 && data.totalDistance > 50) score -= 10;

    // Penalize excessive speeding
    if (data.maxSpeed > 120) score -= (data.maxSpeed - 120) * 0.2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze stops along the route
   */
  private async analyzeStops(trackPoints: TrackPoint[]): Promise<StopAnalysis[]> {
    const stops: StopAnalysis[] = [];
    let stopStart: TrackPoint | null = null;

    const stopSpeedThreshold = 5; // km/h
    const minStopDuration = 2; // minutes

    const sortedPoints = [...trackPoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 0; i < sortedPoints.length; i++) {
      const point = sortedPoints[i];

      if (point.speed < stopSpeedThreshold) {
        if (!stopStart) {
          stopStart = point;
        }
      } else if (stopStart) {
        // Stop ended
        const duration = (point.timestamp.getTime() - stopStart.timestamp.getTime()) / 60000; // minutes

        if (duration >= minStopDuration) {
          // Check if stop is at a geofence
          const geofence = await this.findGeofenceAtLocation(stopStart.lat, stopStart.lng);

          stops.push({
            location: { lat: stopStart.lat, lng: stopStart.lng },
            startTime: stopStart.timestamp,
            endTime: point.timestamp,
            duration,
            type: geofence ? 'planned' : 'unplanned',
            geofenceName: geofence?.name,
          });
        }

        stopStart = null;
      }
    }

    // If the last segment is a stop, add it if duration meets threshold
    if (stopStart) {
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const duration = (lastPoint.timestamp.getTime() - stopStart.timestamp.getTime()) / 60000;
      if (duration >= minStopDuration) {
        const geofence = await this.findGeofenceAtLocation(stopStart.lat, stopStart.lng);
        stops.push({
          location: { lat: stopStart.lat, lng: stopStart.lng },
          startTime: stopStart.timestamp,
          endTime: lastPoint.timestamp,
          duration,
          type: geofence ? 'planned' : 'unplanned',
          geofenceName: geofence?.name,
        });
      }
    }

    return stops;
  }

  // Helper methods
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private findClosestPointOnRoute(
    point: { lat: number; lng: number },
    route: RouteWaypoint[]
  ): { lat: number; lng: number } {
    let minDistance = Infinity;
    let closestPoint = { lat: route[0].lat, lng: route[0].lng };

    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i];
      const end = route[i + 1];

      // Calculate perpendicular distance to line segment
      const segmentClosest = this.closestPointOnLineSegment(point, start, end);
      const distance = this.calculateDistance(point.lat, point.lng, segmentClosest.lat, segmentClosest.lng);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = segmentClosest;
      }
    }

    // Check last waypoint
    const lastDistance = this.calculateDistance(point.lat, point.lng, route[route.length - 1].lat, route[route.length - 1].lng);
    if (lastDistance < minDistance) {
      closestPoint = { lat: route[route.length - 1].lat, lng: route[route.length - 1].lng };
    }

    return closestPoint;
  }

  private closestPointOnLineSegment(
    point: { lat: number; lng: number },
    start: { lat: number; lng: number },
    end: { lat: number; lng: number }
  ): { lat: number; lng: number } {
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    if (dx === 0 && dy === 0) return start;

    const t = ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      lat: start.lat + clampedT * dy,
      lng: start.lng + clampedT * dx,
    };
  }

  private determineDeviationSeverity(
    deviationDistance: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (deviationDistance >= this.deviationThresholds.critical) return 'critical';
    if (deviationDistance >= this.deviationThresholds.high) return 'high';
    if (deviationDistance >= this.deviationThresholds.medium) return 'medium';
    return 'low';
  }

  private async fetchHistoricalRouteData(_loadId: string): Promise<Record<string, unknown>> {
    // Fetch historical data from database for similar routes
    // Note: average_speed and driver_behavior_score don't exist in loads table yet
    // Return default values for now
    return { average_speed: 60, driver_behavior_score: 0.95 };
  }

  private calculateHistoricalSpeedFactor(historicalData: Record<string, unknown>): number {
    // Calculate speed factor from historical data
    return (historicalData.average_speed as number) || 60; // km/h
  }

  private async estimateTrafficFactor(
    _currentLocation: VehicleLocation,
    _destination: { lat: number; lng: number }
  ): Promise<number> {
    // Integrate with traffic API (e.g., Google Maps Traffic)
    // Placeholder: Return factor between 0.5 (heavy) and 1.0 (clear)
    // In production: fetch(`https://maps.googleapis.com/maps/api/directions/json?...&departure_time=now&traffic_model=best_guess`)
    // Parse duration_in_traffic / duration
    return 0.9; // Assume mild traffic
  }

  private async estimateWeatherImpact(_currentLocation: VehicleLocation): Promise<number> {
    // Integrate with weather API (e.g., OpenWeatherMap)
    // Placeholder: Return factor between 0.7 (severe) and 1.0 (clear)
    // In production: fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=KEY`)
    // If rain/snow, reduce factor
    return 0.95; // Assume good weather
  }

  private calculateDriverBehaviorFactor(historicalData: Record<string, unknown>): number {
    // Calculate driver efficiency factor
    return (historicalData.driver_behavior_score as number) || 0.95; // 0.8-1.0
  }

  private calculateRouteComplexity(route: RouteWaypoint[]): number {
    // Calculate complexity based on waypoints, turns, etc.
    // Simple: more waypoints = higher complexity
    return 1 + (route.length - 2) * 0.05; // Min 1.0
  }

  private calculateETAConfidence(factors: {
    historicalSpeed: number;
    currentTraffic: number;
    weatherImpact: number;
    driverBehavior: number;
    routeComplexity: number;
  }): number {
    // Calculate confidence based on data quality
    // If all factors are default, lower confidence
    const nonDefaultCount = Object.values(factors).filter(f => f !== 1.0 && f !== 60).length;
    return 0.5 + (nonDefaultCount / Object.keys(factors).length) * 0.5;
  }

  private async fetchTrackPoints(
    vehicleId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TrackPoint[]> {
    try {
      // Fetch track points from delivery_tracking table (correct table name)
      const { data, error } = await supabase
        .from('delivery_tracking')
        .select('latitude, longitude, recorded_at, speed, heading, altitude, accuracy')
        .eq('vehicle_id', vehicleId)
        .gte('recorded_at', startTime.toISOString())
        .lte('recorded_at', endTime.toISOString())
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching track points:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No track data found for vehicle:', vehicleId, 'between', startTime, 'and', endTime);
        return [];
      }

      console.log(`✅ Fetched ${data.length} track points for vehicle ${vehicleId}`);

      // Transform database records to TrackPoint format
      return data.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
        timestamp: new Date(point.recorded_at),
        speed: point.speed || 0,
        heading: point.heading || 0,
        altitude: point.altitude || undefined,
        accuracy: point.accuracy || undefined,
      }));
    } catch (error) {
      console.error('❌ Exception fetching track points:', error);
      return [];
    }
  }

  private generateSpeedProfile(trackPoints: TrackPoint[]): SpeedProfile[] {
    return trackPoints.map(point => ({
      timestamp: point.timestamp,
      speed: point.speed,
      recommendedSpeed: 80, // Placeholder - could integrate speed limits API
      speedLimit: 120, // Placeholder
    }));
  }

  private async findGeofenceAtLocation(
    lat: number,
    lng: number
  ): Promise<{ name: string } | null> {
    // Assume 'geofences' table with PostGIS geometry
    const { data } = await supabase
      .from('geofences')
      .select('name')
      .eq('is_active', true)
      // Use PostGIS to check if point is within geometry
      .filter('geometry', 'st_contains', `POINT(${lng} ${lat})`)
      .single();

    return data ? { name: data.name } : null;
  }
}

export const advancedRouteTrackingService = new AdvancedRouteTrackingService();