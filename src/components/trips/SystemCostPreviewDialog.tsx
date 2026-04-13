import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    calculateSystemCosts,
    type EffectiveRate,
    fetchOverlapAdjustmentForTrip,
} from '@/hooks/useSystemCostRates';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Calculator, Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface SystemCostPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tripId: string;
    departureDate: string | null;
    arrivalDate: string | null;
    distanceKm: number | null;
    effectiveRates: EffectiveRate[];
    /** Vehicle FK identifiers for overlap detection */
    fleetVehicleId?: string | null;
    vehicleId?: string | null;
}

const formatUSD = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SystemCostPreviewDialog = ({
    isOpen,
    onClose,
    tripId,
    departureDate,
    arrivalDate,
    distanceKm,
    effectiveRates,
    fleetVehicleId,
    vehicleId,
}: SystemCostPreviewDialogProps) => {
    const [generating, setGenerating] = useState(false);
    const [overrides, setOverrides] = useState<Record<number, string>>({});
    const [overlapDays, setOverlapDays] = useState(0);
    const [overlapLoading, setOverlapLoading] = useState(false);

    // Reset state and fetch overlap when dialog opens
    useEffect(() => {
        if (isOpen) {
            setOverrides({});
            setGenerating(false);
            setOverlapDays(0);

            // Fetch overlap adjustment from DB
            if (tripId && departureDate && (fleetVehicleId || vehicleId)) {
                setOverlapLoading(true);
                fetchOverlapAdjustmentForTrip(tripId, departureDate, arrivalDate, fleetVehicleId, vehicleId)
                    .then(adj => setOverlapDays(adj))
                    .catch(() => setOverlapDays(0))
                    .finally(() => setOverlapLoading(false));
            }
        }
    }, [isOpen, tripId, departureDate, arrivalDate, fleetVehicleId, vehicleId]);

    const previewCosts = useMemo(
        () =>
            calculateSystemCosts(
                { id: tripId, departure_date: departureDate, arrival_date: arrivalDate, distance_km: distanceKm },
                effectiveRates,
                overlapDays
            ),
        [tripId, departureDate, arrivalDate, distanceKm, effectiveRates, overlapDays]
    );

    const rawDays = useMemo(() => {
        if (!departureDate || !arrivalDate) return 1;
        const days =
            Math.ceil(
                (new Date(arrivalDate).getTime() - new Date(departureDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ) + 1;
        return Math.max(1, days);
    }, [departureDate, arrivalDate]);

    const tripDays = overlapDays > 0 ? Math.max(0, rawDays - overlapDays) : rawDays;

    // Apply overrides to get final amounts
    const finalCosts = previewCosts.map((cost, i) => ({
        ...cost,
        amount:
            overrides[i] !== undefined && overrides[i] !== ''
                ? Math.round(parseFloat(overrides[i]) * 100) / 100
                : cost.amount,
    }));

    const totalCosts = finalCosts.reduce((sum, c) => sum + c.amount, 0);

    const handleAccept = async () => {
        setGenerating(true);
        try {
            // Always delete existing system costs before re-inserting (replace, never duplicate)
            await supabase
                .from('cost_entries')
                .delete()
                .eq('trip_id', tripId)
                .eq('is_system_generated', true)
                .eq('category', 'System Costs');

            // Check if any overrides were applied
            const hasOverrides = Object.keys(overrides).length > 0;

            if (hasOverrides) {
                // Insert with overridden amounts
                const entries = finalCosts.map((cost) => ({
                    ...cost,
                }));

                if (entries.length > 0) {
                    const { error } = await supabase.from('cost_entries').insert(entries as never);
                    if (error) throw error;
                }
            } else {
                // Insert fresh calculated entries
                const entries = calculateSystemCosts(
                    { id: tripId, departure_date: departureDate, arrival_date: arrivalDate, distance_km: distanceKm },
                    effectiveRates,
                    overlapDays
                );
                if (entries.length > 0) {
                    const { error } = await supabase.from('cost_entries').insert(entries as never);
                    if (error) throw error;
                }
            }

            // Auto-resolve any "no_costs" alert
            supabase
                .from('alerts')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString(),
                    resolution_note: 'System costs auto-generated',
                } as never)
                .eq('source_type', 'trip')
                .eq('source_id', tripId)
                .eq('category', 'fuel_anomaly')
                .eq('status', 'active')
                .filter('metadata->>issue_type', 'eq', 'no_costs')
                .then(({ error: resolveErr }) => {
                    if (resolveErr) console.error('Error auto-resolving no_costs alert:', resolveErr);
                });

            onClose();
        } catch (err) {
            console.error('Failed to generate system costs:', err);
        } finally {
            setGenerating(false);
        }
    };

    if (previewCosts.length === 0) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        System Cost Preview
                    </DialogTitle>
                    <DialogDescription>
                        Review and adjust the auto-calculated system costs before they are added to this trip.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Trip info summary */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex justify-between items-center p-2.5 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium">Duration</span>
                            <span className="font-bold text-sm">
                                {overlapLoading ? '...' : (
                                    <>
                                        {tripDays} day{tripDays !== 1 ? 's' : ''}
                                        {overlapDays > 0 && (
                                            <span className="text-xs text-amber-600 font-normal ml-1">
                                                ({rawDays} − {overlapDays} overlap)
                                            </span>
                                        )}
                                    </>
                                )}
                            </span>
                        </div>
                        {(distanceKm ?? 0) > 0 && (
                            <div className="flex justify-between items-center p-2.5 bg-blue-50 rounded-lg">
                                <span className="text-sm font-medium">Distance</span>
                                <span className="font-bold text-sm">{distanceKm?.toLocaleString()} km</span>
                            </div>
                        )}
                    </div>

                    {/* Overlap notice */}
                    {overlapDays > 0 && (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-amber-700">
                                Another trip on this vehicle ends on the same day this trip starts.
                                {tripDays > 0
                                    ? ` Per-day costs have been reduced by ${overlapDays} day to avoid double-charging.`
                                    : ' Per-day costs are fully covered by the other trip — only per-km costs apply here.'}
                            </p>
                        </div>
                    )}

                    {/* Cost breakdown */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="max-h-72 overflow-y-auto divide-y">
                                {previewCosts.map((cost, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{cost.sub_category}</p>
                                            <p className="text-xs text-muted-foreground">{cost.notes}</p>
                                        </div>
                                        <div className="ml-3 w-28 flex-shrink-0">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="h-8 text-right text-sm font-mono"
                                                defaultValue={cost.amount.toFixed(2)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setOverrides((prev) => {
                                                        if (val === '' || parseFloat(val) === cost.amount) {
                                                            const next = { ...prev };
                                                            delete next[i];
                                                            return next;
                                                        }
                                                        return { ...prev, [i]: val };
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Total */}
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                        <span className="font-semibold">Total System Costs</span>
                        <span className="text-lg font-bold text-primary">{formatUSD(totalCosts)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose} disabled={generating}>
                            <X className="w-4 h-4 mr-1" />
                            Skip
                        </Button>
                        <Button onClick={handleAccept} disabled={generating}>
                            <Check className="w-4 h-4 mr-1" />
                            {generating ? 'Generating...' : 'Accept & Add Costs'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SystemCostPreviewDialog;