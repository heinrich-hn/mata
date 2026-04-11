import { LatLng, Map } from 'leaflet';
import GeometryUtil from 'leaflet-geometryutil';

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
}

export interface HarshCorner {
  position: { lat: number; lng: number };
  angle: number;
  severity: 'mild' | 'moderate' | 'harsh';
  timestamp: number;
}

export interface SpeedingEvent {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  maxSpeed: number;
  duration: number;
}

export interface DriverScore {
  score: number;
  smoothness: number;
  harshCorners: number;
  speedingEvents: number;
  breakdown: { category: string; points: number }[];
}

export class DriverBehaviorAnalyzer {
  /**
   * Analyze route for harsh cornering
   */
  detectHarshCorners(map: Map, trackPoints: TrackPoint[]): HarshCorner[] {
    if (trackPoints.length < 3) return [];

    const corners: HarshCorner[] = [];

    for (let i = 1; i < trackPoints.length - 1; i++) {
      const pointA = new LatLng(trackPoints[i - 1].lat, trackPoints[i - 1].lng);
      const pointC = new LatLng(trackPoints[i + 1].lat, trackPoints[i + 1].lng);

      const angle = GeometryUtil.angle(map, pointA, pointC);
      const absDegrees = Math.abs(angle);

      if (absDegrees > 30) {
        corners.push({
          position: { lat: trackPoints[i].lat, lng: trackPoints[i].lng },
          angle: absDegrees,
          severity: absDegrees > 60 ? 'harsh' : absDegrees > 45 ? 'moderate' : 'mild',
          timestamp: trackPoints[i].timestamp,
        });
      }
    }

    return corners;
  }

  /**
   * Calculate route smoothness score (0-100)
   */
  calculateSmoothness(map: Map, trackPoints: TrackPoint[]): number {
    if (trackPoints.length < 3) return 100;

    const angles: number[] = [];

    for (let i = 1; i < trackPoints.length - 1; i++) {
      const pointA = new LatLng(trackPoints[i - 1].lat, trackPoints[i - 1].lng);
      const pointC = new LatLng(trackPoints[i + 1].lat, trackPoints[i + 1].lng);

      const angle = Math.abs(GeometryUtil.angle(map, pointA, pointC));
      angles.push(angle);
    }

    if (angles.length === 0) return 100;

    const avgAngle = angles.reduce((sum, a) => sum + a, 0) / angles.length;
    const smoothness = Math.max(0, 100 - avgAngle);

    return Math.round(smoothness);
  }

  /**
   * Detect speeding events
   */
  detectSpeedingEvents(
    trackPoints: TrackPoint[],
    speedLimit: number
  ): SpeedingEvent[] {
    const events: SpeedingEvent[] = [];
    let currentEvent: {
      start: TrackPoint;
      startIndex: number;
      maxSpeed: number;
    } | null = null;

    trackPoints.forEach((point, index) => {
      if (point.speed > speedLimit) {
        if (!currentEvent) {
          currentEvent = {
            start: point,
            startIndex: index,
            maxSpeed: point.speed,
          };
        } else {
          currentEvent.maxSpeed = Math.max(currentEvent.maxSpeed, point.speed);
        }
      } else if (currentEvent && index > 0) {
        const prevPoint = trackPoints[index - 1];
        events.push({
          start: { lat: currentEvent.start.lat, lng: currentEvent.start.lng },
          end: { lat: prevPoint.lat, lng: prevPoint.lng },
          maxSpeed: currentEvent.maxSpeed,
          duration: prevPoint.timestamp - currentEvent.start.timestamp,
        });
        currentEvent = null;
      }
    });

    // Handle ongoing speeding event at end of track
    if (currentEvent) {
      const lastPoint = trackPoints[trackPoints.length - 1];
      events.push({
        start: { lat: currentEvent.start.lat, lng: currentEvent.start.lng },
        end: { lat: lastPoint.lat, lng: lastPoint.lng },
        maxSpeed: currentEvent.maxSpeed,
        duration: lastPoint.timestamp - currentEvent.start.timestamp,
      });
    }

    return events;
  }

  /**
   * Calculate overall driver score
   */
  calculateDriverScore(
    map: Map,
    trackPoints: TrackPoint[],
    speedLimit: number
  ): DriverScore {
    const smoothness = this.calculateSmoothness(map, trackPoints);
    const corners = this.detectHarshCorners(map, trackPoints);
    const speeding = this.detectSpeedingEvents(trackPoints, speedLimit);

    // Scoring system
    const breakdown: { category: string; points: number }[] = [];

    // Smoothness (40 points max)
    const smoothnessPoints = (smoothness / 100) * 40;
    breakdown.push({ category: 'Route Smoothness', points: Math.round(smoothnessPoints) });

    // Harsh corners penalty (30 points max)
    const cornerPenalty = Math.min(30, corners.length * 5);
    breakdown.push({ category: 'Cornering', points: 30 - cornerPenalty });

    // Speeding penalty (30 points max)
    const speedingPenalty = Math.min(30, speeding.length * 10);
    breakdown.push({ category: 'Speed Compliance', points: 30 - speedingPenalty });

    const score = smoothnessPoints + (30 - cornerPenalty) + (30 - speedingPenalty);

    return {
      score: Math.round(score),
      smoothness,
      harshCorners: corners.length,
      speedingEvents: speeding.length,
      breakdown,
    };
  }

  /**
   * Calculate total distance traveled
   */
  calculateTotalDistance(trackPoints: TrackPoint[]): number {
    if (trackPoints.length < 2) return 0;

    const latLngs = trackPoints.map(p => new LatLng(p.lat, p.lng));
    return GeometryUtil.length(latLngs);
  }

  /**
   * Calculate average speed
   */
  calculateAverageSpeed(trackPoints: TrackPoint[]): number {
    if (trackPoints.length === 0) return 0;

    const validSpeeds = trackPoints.filter(p => p.speed > 0);
    if (validSpeeds.length === 0) return 0;

    const sum = validSpeeds.reduce((acc, p) => acc + p.speed, 0);
    return sum / validSpeeds.length;
  }
}

export const driverAnalyzer = new DriverBehaviorAnalyzer();