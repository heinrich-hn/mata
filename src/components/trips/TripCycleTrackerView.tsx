import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { generateCycleTrackerPDF } from '@/lib/cycleTrackerPdfExport';
import {
  CheckCircle,
  Clock,
  Download,
  MapPin,
  Package,
  Thermometer,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ─── Local Type Definitions (until Supabase types are updated) ─────

interface CycleTracker {
  id: string;
  trip_id: string;
  truck_type: 'reefer' | 'flatbed' | null;
  route: string | null;
  current_phase: number;
  is_completed: boolean;
  created_at: string | null;
  updated_at: string | null;

  // Phase 1: Preparation
  p1_inspection_start: string | null;
  p1_inspection_end: string | null;
  p1_refuel_start: string | null;
  p1_refuel_end: string | null;
  p1_reefer_start_time: string | null;
  p1_reefer_start_temp: number | null;
  p1_yard_departure: string | null;

  // Phase 2: Farm Loading
  p2_farm_arrival: string | null;
  p2_loading_start: string | null;
  p2_loading_end: string | null;
  p2_farm_departure: string | null;
  p2_delay_reason: string[] | null;
  p2_delay_other_detail: string | null;
  p2_farm_supervisor: string | null;

  // Phase 3: In-Transit (handled by transit_stops table)

  // Phase 4: Depot Arrival
  p4_depot_arrival: string | null;
  p4_offloading_start: string | null;
  p4_offloading_end: string | null;
  p4_reefer_arrival_temp: number | null;

  // Phase 5: Return Leg
  p5_crates_count: number | null;
  p5_bins_count: number | null;
  p5_damaged_packaging: boolean | null;
  p5_damaged_details: string | null;
  p5_depot_departure: string | null;
  p5_depot_supervisor: string | null;

  // Phase 6: Completing the Loop
  p6_yard_arrival: string | null;
  p6_unloading_start: string | null;
  p6_unloading_end: string | null;
  p6_road_comments: string | null;
}

interface TransitStop {
  id: string;
  tracker_id: string;
  sort_order: number;
  location: string;
  reason: string;
  time_in: string | null;
  time_out: string | null;
  duration_mins: number | null;
  created_at: string | null;
}

interface TripCycleTrackerViewProps {
  tripId: string;
  tripNumber?: string;
  route?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDT(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calcDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  return `${hrs}h ${rm}m`;
}

function calcMins(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}

const DELAY_LABELS: Record<string, string> = {
  packaging_shortage: 'Packaging Shortage',
  labor_shortage: 'Labor Shortage',
  fruit_not_harvested: 'Fruit not Harvested',
  qc_delay: 'QC Delay',
  mechanical: 'Mechanical',
  other: 'Other',
};

// ─── Component ───────────────────────────────────────────────────────

export default function TripCycleTrackerView({ tripId, tripNumber, route }: TripCycleTrackerViewProps) {
  const [tracker, setTracker] = useState<CycleTracker | null>(null);
  const [stops, setStops] = useState<TransitStop[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch cycle tracker data
      const { data: trackerData, error: trackerError } = await supabase
        .from('trip_cycle_tracker')
        .select('*')
        .eq('trip_id', tripId)
        .maybeSingle();

      if (trackerError && trackerError.code !== 'PGRST116') throw trackerError;

      // Transform the data to ensure truck_type matches the expected type
      if (trackerData) {
        const transformedData: CycleTracker = {
          ...trackerData,
          // Cast truck_type to the expected union type, defaulting to null if invalid
          truck_type: (trackerData.truck_type === 'reefer' || trackerData.truck_type === 'flatbed')
            ? trackerData.truck_type
            : null,
        };
        setTracker(transformedData);
      } else {
        setTracker(null);
      }

      // Fetch transit stops if tracker exists
      if (trackerData?.id) {
        const { data: stopsData, error: stopsError } = await supabase
          .from('trip_transit_stops')
          .select('*')
          .eq('tracker_id', trackerData.id)
          .order('sort_order', { ascending: true });

        if (stopsError) {
          console.error('Stops fetch error:', stopsError);
          setStops([]);
        } else {
          setStops(stopsData ?? []);
        }
      } else {
        setStops([]);
      }
    } catch (err) {
      console.error('Error fetching cycle tracker:', err);
      setTracker(null);
      setStops([]);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
        <p className="text-sm text-muted-foreground">Loading tracker data...</p>
      </div>
    );
  }

  if (!tracker) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Clock className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No 360° Tracker Data</p>
          <p className="text-xs mt-1">The driver has not yet started the time tracker for this trip.</p>
        </CardContent>
      </Card>
    );
  }

  const phaseStatus = (phase: number) => {
    if (tracker.current_phase > phase || tracker.is_completed) return 'completed';
    if (tracker.current_phase === phase) return 'in-progress';
    return 'pending';
  };

  const totalTransitMins = stops.reduce((sum, s) => sum + (s.duration_mins || 0), 0);

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              360° Transport Time Tracker
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateCycleTrackerPDF(tracker, stops, tripNumber || 'Unknown', route)}
              >
                <Download className="w-4 h-4 mr-1" />
                Export PDF
              </Button>
              <Badge variant={tracker.is_completed ? 'default' : 'secondary'}>
                {tracker.is_completed ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> Completed</>
                ) : (
                  `Phase ${tracker.current_phase}/6`
                )}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Truck Type</p>
              <p className="font-medium capitalize flex items-center gap-1">
                {tracker.truck_type === 'reefer' && <Thermometer className="w-4 h-4" />}
                {tracker.truck_type === 'flatbed' && <Truck className="w-4 h-4" />}
                {tracker.truck_type || '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Route</p>
              <p className="font-medium capitalize">{tracker.route || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium text-sm">{formatDT(tracker.updated_at)}</p>
            </div>
          </div>

          {/* Phase Progress Bar */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((phase) => {
              const status = phaseStatus(phase);
              return (
                <div
                  key={phase}
                  className={`flex-1 h-2 rounded-full ${status === 'completed'
                    ? 'bg-emerald-500'
                    : status === 'in-progress'
                      ? 'bg-blue-500'
                      : 'bg-muted'
                    }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Preparation</span>
            <span>Farm</span>
            <span>Transit</span>
            <span>Depot</span>
            <span>Return</span>
            <span>Complete</span>
          </div>
        </CardContent>
      </Card>

      {/* Phase 1: Preparation */}
      <PhaseCard title="Phase 1: Preparation (Transport Yard)" phase={1} status={phaseStatus(1)}>
        <div className="grid grid-cols-2 gap-4">
          <TimeRow label="Inspection Start" value={tracker.p1_inspection_start} />
          <TimeRow label="Inspection End" value={tracker.p1_inspection_end} />
          <DurationRow
            label="Inspection Duration"
            start={tracker.p1_inspection_start}
            end={tracker.p1_inspection_end}
            target={45}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <TimeRow label="Refuel Start" value={tracker.p1_refuel_start} />
          <TimeRow label="Refuel End" value={tracker.p1_refuel_end} />
          <DurationRow
            label="Refuel Duration"
            start={tracker.p1_refuel_start}
            end={tracker.p1_refuel_end}
            target={60}
          />
        </div>
        {tracker.truck_type === 'reefer' && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <TimeRow label="Reefer Unit Started" value={tracker.p1_reefer_start_time} />
            <div>
              <p className="text-sm text-muted-foreground">Start Temperature</p>
              <p className="font-medium">
                {tracker.p1_reefer_start_temp != null ? `${tracker.p1_reefer_start_temp}°C` : '—'}
              </p>
            </div>
          </div>
        )}
        <div className="mt-3 pt-3 border-t">
          <TimeRow label="Departure from Yard" value={tracker.p1_yard_departure} highlight />
        </div>
      </PhaseCard>

      {/* Phase 2: Farm Loading */}
      <PhaseCard title="Phase 2: Farm Loading (Origin)" phase={2} status={phaseStatus(2)}>
        <div className="grid grid-cols-2 gap-4">
          <TimeRow label="Arrival at Farm Gate" value={tracker.p2_farm_arrival} />
          <TimeRow label="Loading Start" value={tracker.p2_loading_start} />
          <TimeRow label="Loading End" value={tracker.p2_loading_end} />
          <TimeRow label="Departure from Farm" value={tracker.p2_farm_departure} highlight />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <DurationRow label="Loading Duration" start={tracker.p2_loading_start} end={tracker.p2_loading_end} />
          <DurationRow label="Farm Dwell Time" start={tracker.p2_farm_arrival} end={tracker.p2_farm_departure} target={120} />
        </div>
        {tracker.p2_delay_reason && tracker.p2_delay_reason.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-1">Delay Reasons:</p>
            <div className="flex flex-wrap gap-1">
              {tracker.p2_delay_reason.map((r) => (
                <Badge key={r} variant="outline" className="text-xs text-amber-700 border-amber-300">
                  {DELAY_LABELS[r] || r}
                </Badge>
              ))}
            </div>
            {tracker.p2_delay_other_detail && (
              <p className="text-sm text-amber-700 mt-1">{tracker.p2_delay_other_detail}</p>
            )}
          </div>
        )}
        {tracker.p2_farm_supervisor && (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Farm Supervisor</p>
            <p className="font-medium">{tracker.p2_farm_supervisor}</p>
          </div>
        )}
      </PhaseCard>

      {/* Phase 3: In-Transit Log */}
      <PhaseCard title="Phase 3: In-Transit Log" phase={3} status={phaseStatus(3)}>
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transit stops logged.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Location</th>
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Time In</th>
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Time Out</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((stop) => (
                  <tr key={stop.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {stop.location}
                    </td>
                    <td className="py-2 pr-3">{stop.reason}</td>
                    <td className="py-2 pr-3 text-xs">{formatDT(stop.time_in)}</td>
                    <td className="py-2 pr-3 text-xs">{formatDT(stop.time_out)}</td>
                    <td className="py-2 text-right font-medium">
                      {stop.duration_mins != null ? `${stop.duration_mins} min` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-2 pt-2 border-t">
              <p className="text-sm font-semibold">
                Total Stop Time: <span className="text-primary">{totalTransitMins} min</span>
              </p>
            </div>
          </div>
        )}
      </PhaseCard>

      {/* Phase 4: Depot Arrival */}
      <PhaseCard title="Phase 4: Depot Arrival & Offloading" phase={4} status={phaseStatus(4)}>
        <div className="grid grid-cols-2 gap-4">
          <TimeRow label="Arrival at Depot" value={tracker.p4_depot_arrival} />
          {tracker.truck_type === 'reefer' && (
            <div>
              <p className="text-sm text-muted-foreground">Reefer Temp on Arrival</p>
              <p className="font-medium">
                {tracker.p4_reefer_arrival_temp != null ? `${tracker.p4_reefer_arrival_temp}°C` : '—'}
              </p>
            </div>
          )}
          <TimeRow label="Offloading Start" value={tracker.p4_offloading_start} />
          <TimeRow label="Offloading End" value={tracker.p4_offloading_end} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <DurationRow label="Offloading Duration" start={tracker.p4_offloading_start} end={tracker.p4_offloading_end} />
          <DurationRow label="Depot Dwell Time" start={tracker.p4_depot_arrival} end={tracker.p4_offloading_end} />
        </div>
      </PhaseCard>

      {/* Phase 5: Return Leg */}
      <PhaseCard title="Phase 5: Return Leg (Packaging)" phase={5} status={phaseStatus(5)}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Crates</p>
            <p className="text-lg font-semibold flex items-center gap-1">
              <Package className="w-4 h-4 text-muted-foreground" />
              {tracker.p5_crates_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bins</p>
            <p className="text-lg font-semibold flex items-center gap-1">
              <Package className="w-4 h-4 text-muted-foreground" />
              {tracker.p5_bins_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Damaged?</p>
            <Badge variant={tracker.p5_damaged_packaging ? 'destructive' : 'secondary'}>
              {tracker.p5_damaged_packaging ? 'Yes' : 'No'}
            </Badge>
          </div>
        </div>
        {tracker.p5_damaged_packaging && tracker.p5_damaged_details && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{tracker.p5_damaged_details}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <TimeRow label="Departure from Depot" value={tracker.p5_depot_departure} highlight />
          {tracker.p5_depot_supervisor && (
            <div>
              <p className="text-sm text-muted-foreground">Depot Supervisor</p>
              <p className="font-medium">{tracker.p5_depot_supervisor}</p>
            </div>
          )}
        </div>
      </PhaseCard>

      {/* Phase 6: Completing the Loop */}
      <PhaseCard title="Phase 6: Completing the Loop" phase={6} status={phaseStatus(6)}>
        <div className="grid grid-cols-2 gap-4">
          <TimeRow label="Arrival at Yard/Farm" value={tracker.p6_yard_arrival} highlight />
          <TimeRow label="Unloading Start" value={tracker.p6_unloading_start} />
          <TimeRow label="Unloading End" value={tracker.p6_unloading_end} />
          <DurationRow label="Unloading Duration" start={tracker.p6_unloading_start} end={tracker.p6_unloading_end} />
        </div>
        {tracker.p6_road_comments && (
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-muted-foreground mb-1">Road Conditions / Comments:</p>
            <p className="text-sm">{tracker.p6_road_comments}</p>
          </div>
        )}
      </PhaseCard>

      {/* Cycle Summary */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">Total Cycle Summary (Office Use)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <SummaryRow label="Transport Yard → Farm" value={calcDuration(tracker.p1_yard_departure, tracker.p2_farm_arrival)} />
            <SummaryRow label="Farm Dwell Time" value={calcDuration(tracker.p2_farm_arrival, tracker.p2_farm_departure)} />
            <SummaryRow
              label="Transit Time (incl. stops)"
              value={calcDuration(tracker.p2_farm_departure, tracker.p4_depot_arrival)}
              sub={totalTransitMins > 0 ? `(${totalTransitMins} min in stops)` : undefined}
            />
            <SummaryRow label="Depot Dwell Time" value={calcDuration(tracker.p4_depot_arrival, tracker.p5_depot_departure)} />
            <SummaryRow label="Return Leg" value={calcDuration(tracker.p5_depot_departure, tracker.p6_yard_arrival)} />
            <div className="border-t pt-2 mt-2">
              <SummaryRow
                label="TOTAL 360° CYCLE TIME"
                value={calcDuration(tracker.p1_yard_departure, tracker.p6_yard_arrival)}
                highlight
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function PhaseCard({
  title,
  phase,
  status,
  children,
}: {
  title: string;
  phase: number;
  status: 'completed' | 'in-progress' | 'pending';
  children: React.ReactNode;
}) {
  return (
    <Card className={status === 'pending' ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${status === 'completed'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'in-progress'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-muted text-muted-foreground'
              }`}
          >
            {status === 'completed' ? <CheckCircle className="w-3.5 h-3.5" /> : phase}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TimeRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium ${highlight ? 'text-primary' : ''}`}>{formatDT(value)}</p>
    </div>
  );
}

function DurationRow({
  label,
  start,
  end,
  target,
}: {
  label: string;
  start: string | null;
  end: string | null;
  target?: number;
}) {
  const dur = calcDuration(start, end);
  const mins = calcMins(start, end);
  const overTarget = target && mins ? mins > target : false;

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium ${overTarget ? 'text-amber-600' : ''}`}>
        {dur}
        {target && <span className="text-xs text-muted-foreground ml-1">(target: {target}m)</span>}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  sub,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className={`text-sm ${highlight ? 'font-bold' : 'text-muted-foreground'}`}>{label}</span>
        {sub && <span className="text-xs text-muted-foreground ml-2">{sub}</span>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-primary text-base' : ''}`}>{value}</span>
    </div>
  );
}