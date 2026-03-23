import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Separator } from '@/components/ui/separator';
import { useOperations } from '@/contexts/OperationsContext';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import type { DieselConsumptionRecord, Trip } from '@/types/operations';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Fuel,
  Gauge,
  Route,
  Snowflake,
  Truck,
  User,
  XCircle
} from 'lucide-react';
import { useMemo } from 'react';

interface DieselTransactionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DieselConsumptionRecord | null;
  linkedReeferRecords?: Array<{
    id: string;
    reefer_unit: string;
    litres_filled: number;
    operating_hours: number | null;
    previous_operating_hours: number | null;
    hours_operated: number | null;
    litres_per_hour: number | null;
    total_cost: number;
    date: string;
  }>;
  onLinkTrip?: () => void;
  onLinkReefer?: () => void;
  onDebrief?: () => void;
  onVerifyProbe?: () => void;
}

const DieselTransactionViewModal = ({
  isOpen,
  onClose,
  record,
  linkedReeferRecords = [],
  onLinkTrip,
  onLinkReefer,
  onDebrief,
  onVerifyProbe,
}: DieselTransactionViewModalProps) => {
  const { trips, dieselNorms } = useOperations();

  // Detect reefer fleet (fleet numbers ending in F)
  const isReefer = useMemo(() => {
    return !!record?.fleet_number && record.fleet_number.toUpperCase().trim().endsWith('F');
  }, [record?.fleet_number]);

  // Access reefer-specific fields (carried through from reefer_diesel_records mapping)
  const reeferData = useMemo(() => {
    if (!isReefer || !record) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = record as any;
    return {
      operatingHours: rec.operating_hours as number | null,
      previousOperatingHours: rec.previous_operating_hours as number | null,
      hoursOperated: rec.hours_operated as number | null,
      litresPerHour: rec.litres_per_hour as number | null,
    };
  }, [isReefer, record]);

  // Find linked trip
  const linkedTrip: Trip | undefined = useMemo(() => {
    if (!record?.trip_id) return undefined;
    return trips.find((t) => t.id === record.trip_id);
  }, [record?.trip_id, trips]);

  // Find diesel norm for fleet
  const norm = useMemo(() => {
    if (!record?.fleet_number) return undefined;
    return dieselNorms.find((n) => n.fleet_number === record.fleet_number);
  }, [record?.fleet_number, dieselNorms]);

  // Calculate km/L
  const kmPerLitre = useMemo(() => {
    if (!record?.distance_travelled || !record?.litres_filled) return null;
    // If there are linked trailers, use vehicle_litres_only
    const vehicleLitres = record.vehicle_litres_only ?? record.litres_filled;
    return record.distance_travelled / vehicleLitres;
  }, [record]);

  // Check norm violation
  const isOutsideNorm = useMemo(() => {
    if (!kmPerLitre || !norm) return false;
    return kmPerLitre < norm.min_acceptable;
  }, [kmPerLitre, norm]);

  // Calculate variance
  const variance = useMemo(() => {
    if (!kmPerLitre || !norm) return null;
    return ((kmPerLitre - norm.expected_km_per_litre) / norm.expected_km_per_litre) * 100;
  }, [kmPerLitre, norm]);

  // Calculate total reefer consumption
  const totalReeferStats = useMemo(() => {
    if (linkedReeferRecords.length === 0) return null;
    return {
      totalLitres: linkedReeferRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0),
      totalCost: linkedReeferRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0),
      totalHours: linkedReeferRecords.reduce((sum, r) => sum + (r.hours_operated || 0), 0),
      avgLph:
        linkedReeferRecords.filter((r) => r.litres_per_hour).length > 0
          ? linkedReeferRecords.reduce((sum, r) => sum + (r.litres_per_hour || 0), 0) /
          linkedReeferRecords.filter((r) => r.litres_per_hour).length
          : 0,
    };
  }, [linkedReeferRecords]);

  if (!record) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details" maxWidth="3xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {/* Header Summary */}
        <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-xl font-bold">{record.fleet_number}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(record.date)}</span>
              <span>•</span>
              <User className="h-4 w-4" />
              <span>{record.driver_name || 'Unknown Driver'}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(record.total_cost, (record.currency || 'ZAR') as 'ZAR' | 'USD')}</p>
            <p className="text-sm text-muted-foreground">{formatNumber(record.litres_filled)} L filled</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          {linkedTrip && (
            <Badge variant="default" className="bg-blue-500">
              <Route className="h-3 w-3 mr-1" />
              Trip Linked
            </Badge>
          )}
          {record.probe_verified && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Probe Verified
            </Badge>
          )}
          {record.debrief_signed && (
            <Badge variant="default" className="bg-green-500">
              <FileText className="h-3 w-3 mr-1" />
              Debriefed
            </Badge>
          )}
          {isOutsideNorm && !record.debrief_signed && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Requires Debrief
            </Badge>
          )}
          {linkedReeferRecords.length > 0 && (
            <Badge variant="secondary">
              <Snowflake className="h-3 w-3 mr-1" />
              {linkedReeferRecords.length} Reefer(s) Linked
            </Badge>
          )}
          {record.linked_trailers && record.linked_trailers.length > 0 && (
            <Badge variant="secondary">
              <Truck className="h-3 w-3 mr-1" />
              {record.linked_trailers.length} Trailer(s) Linked
            </Badge>
          )}
        </div>

        <Separator />

        {/* Main Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fuel Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                Fuel Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Station</p>
                  <p className="font-medium">{record.fuel_station || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost per Litre</p>
                  <p className="font-medium">
                    {record.cost_per_litre
                      ? formatCurrency(record.cost_per_litre, (record.currency || 'ZAR') as 'ZAR' | 'USD')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicle Litres</p>
                  <p className="font-medium">{formatNumber(record.vehicle_litres_only ?? record.litres_filled)} L</p>
                </div>
                {record.trailer_litres_total && record.trailer_litres_total > 0 && (
                  <div>
                    <p className="text-muted-foreground">Trailer Litres</p>
                    <p className="font-medium">{formatNumber(record.trailer_litres_total)} L</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Distance & Efficiency Card (Trucks) OR Operating Hours & Efficiency Card (Reefers) */}
          {isReefer ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Operating Hours & Efficiency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Operating Hours</p>
                    <p className="font-medium">
                      {reeferData?.operatingHours != null ? formatNumber(reeferData.operatingHours, 1) + ' hrs' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Previous Hours</p>
                    <p className="font-medium">
                      {reeferData?.previousOperatingHours != null ? formatNumber(reeferData.previousOperatingHours, 1) + ' hrs' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Hours Operated</p>
                    <p className="font-medium">
                      {reeferData?.hoursOperated != null ? formatNumber(reeferData.hoursOperated, 1) + ' hrs' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Efficiency</p>
                    <p className="font-bold text-cyan-600">
                      {reeferData?.litresPerHour != null ? formatNumber(reeferData.litresPerHour, 2) + ' L/hr' : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Distance & Efficiency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">KM Reading</p>
                    <p className="font-medium">{formatNumber(record.km_reading)} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Previous KM</p>
                    <p className="font-medium">
                      {record.previous_km_reading ? formatNumber(record.previous_km_reading) + ' km' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distance Travelled</p>
                    <p className="font-medium">
                      {record.distance_travelled ? formatNumber(record.distance_travelled) + ' km' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Efficiency</p>
                    <p className={`font-bold ${isOutsideNorm ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {kmPerLitre ? formatNumber(kmPerLitre, 2) + ' km/L' : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Norm Comparison */}
                {norm && kmPerLitre && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Expected: {formatNumber(norm.expected_km_per_litre, 2)} km/L</span>
                      <span>
                        Range: {formatNumber(norm.min_acceptable, 2)} - {formatNumber(norm.max_acceptable, 2)} km/L
                      </span>
                    </div>
                    {variance !== null && (
                      <div className={`text-sm font-medium ${variance < -10 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {variance > 0 ? '+' : ''}
                        {variance.toFixed(1)}% from expected
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Linked Trip Section */}
        {linkedTrip ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Route className="h-4 w-4" />
                Linked Trip
              </CardTitle>
              <CardDescription>Trip #{linkedTrip.trip_number || linkedTrip.id.substring(0, 8)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Route</p>
                  <p className="font-medium">{linkedTrip.route || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">{linkedTrip.departure_date ? formatDate(linkedTrip.departure_date) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={linkedTrip.status === 'completed' ? 'default' : 'secondary'}>
                    {linkedTrip.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Distance</p>
                  <p className="font-medium">
                    {linkedTrip.distance_km ? formatNumber(linkedTrip.distance_km) + ' km' : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-6 flex items-center justify-center">
              <div className="text-center">
                <Route className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No trip linked to this transaction</p>
                {onLinkTrip && (
                  <Button size="sm" variant="outline" onClick={onLinkTrip}>
                    Link to Trip
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Linked Reefer Records Section */}
        {linkedReeferRecords.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-blue-500" />
                Linked Reefer Consumption
              </CardTitle>
              <CardDescription>
                {linkedReeferRecords.length} reefer fill(s) linked to this truck transaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              {totalReeferStats && (
                <div className="grid grid-cols-4 gap-4 p-3 bg-blue-500/10 rounded-lg text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Litres</p>
                    <p className="font-bold">{formatNumber(totalReeferStats.totalLitres)} L</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Cost</p>
                    <p className="font-bold">{formatCurrency(totalReeferStats.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Hours</p>
                    <p className="font-bold">{formatNumber(totalReeferStats.totalHours)} hrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg L/hr</p>
                    <p className="font-bold text-blue-600">{formatNumber(totalReeferStats.avgLph, 2)} L/hr</p>
                  </div>
                </div>
              )}

              {/* Individual Records */}
              <div className="space-y-2">
                {linkedReeferRecords.map((reefer) => (
                  <div key={reefer.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Snowflake className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">{reefer.reefer_unit}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(reefer.date)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6 text-sm text-right">
                      <div>
                        <p className="text-muted-foreground">Litres</p>
                        <p className="font-medium">{formatNumber(reefer.litres_filled)} L</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hours</p>
                        <p className="font-medium">{reefer.hours_operated ? formatNumber(reefer.hours_operated, 1) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">L/hr</p>
                        <p className="font-medium text-blue-600">
                          {reefer.litres_per_hour ? formatNumber(reefer.litres_per_hour, 2) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-6 flex items-center justify-center">
              <div className="text-center">
                <Snowflake className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No reefer consumption linked</p>
                {onLinkReefer && (
                  <Button size="sm" variant="outline" onClick={onLinkReefer}>
                    Link Reefer Fill
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Probe Verification Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {record.probe_verified ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              Probe Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.probe_verified ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Probe Reading</p>
                  <p className="font-medium">{record.probe_reading ? formatNumber(record.probe_reading) + ' L' : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Discrepancy</p>
                  <p className={`font-medium ${record.probe_discrepancy && Math.abs(record.probe_discrepancy) > 5 ? 'text-warning' : ''}`}>
                    {record.probe_discrepancy ? formatNumber(record.probe_discrepancy, 1) + ' L' : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verified By</p>
                  <p className="font-medium">{record.probe_verified_by || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verified At</p>
                  <p className="font-medium">{record.probe_verified_at ? formatDate(record.probe_verified_at) : 'N/A'}</p>
                </div>
                {record.probe_action_taken && (
                  <div className="col-span-full">
                    <p className="text-muted-foreground">Action Taken</p>
                    <p className="font-medium">{record.probe_action_taken}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-2">Not yet verified</p>
                {onVerifyProbe && (
                  <Button size="sm" variant="outline" onClick={onVerifyProbe}>
                    Verify Probe Reading
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debrief Section */}
        <Card className={isOutsideNorm && !record.debrief_signed ? 'border-destructive' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {record.debrief_signed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : isOutsideNorm ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              Debrief Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.debrief_signed ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Signed By</p>
                    <p className="font-medium">{record.debrief_signed_by || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Signed At</p>
                    <p className="font-medium">{record.debrief_signed_at ? formatDate(record.debrief_signed_at) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{record.debrief_date ? formatDate(record.debrief_date) : 'N/A'}</p>
                  </div>
                </div>
                {record.debrief_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm bg-muted/50 p-2 rounded mt-1">{record.debrief_notes}</p>
                  </div>
                )}
                {record.debrief_trigger_reason && (
                  <div>
                    <p className="text-sm text-muted-foreground">Trigger Reason</p>
                    <p className="text-sm bg-muted/50 p-2 rounded mt-1">{record.debrief_trigger_reason}</p>
                  </div>
                )}
              </div>
            ) : isOutsideNorm ? (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-destructive font-medium mb-1">Debrief Required</p>
                <p className="text-sm text-muted-foreground mb-3">
                  {record.debrief_trigger_reason || 'Consumption outside acceptable range'}
                </p>
                {onDebrief && (
                  <Button size="sm" variant="destructive" onClick={onDebrief}>
                    Complete Debrief
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No debrief required</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        {record.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Combined Cost Summary */}
        {(totalReeferStats || (record.trailer_fuel_cost && record.trailer_fuel_cost > 0)) && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Vehicle Fuel</span>
                  <span className="font-medium">{formatCurrency(record.vehicle_fuel_cost ?? record.total_cost)}</span>
                </div>
                {record.trailer_fuel_cost && record.trailer_fuel_cost > 0 && (
                  <div className="flex justify-between">
                    <span>Trailer Fuel (from form)</span>
                    <span className="font-medium">{formatCurrency(record.trailer_fuel_cost)}</span>
                  </div>
                )}
                {totalReeferStats && (
                  <div className="flex justify-between text-blue-600">
                    <span>Linked Reefer Fuel</span>
                    <span className="font-medium">{formatCurrency(totalReeferStats.totalCost)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Combined Total</span>
                  <span>
                    {formatCurrency(
                      (record.vehicle_fuel_cost ?? record.total_cost) +
                      (record.trailer_fuel_cost ?? 0) +
                      (totalReeferStats?.totalCost ?? 0)
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default DieselTransactionViewModal;
