import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
    calculateSystemCosts,
    computeOverlapAdjustments,
    EffectiveRate,
    getEffectiveRatesForDate,
    recalculateSystemCostsForTrips,
    SystemCostRate,
    useEffectiveRates,
    useSystemCostRatesAll,
    useUpdateCostRate,
} from '@/hooks/useSystemCostRates';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    AlertTriangle,
    ArrowRight,
    Calculator,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    DollarSign,
    History,
    Loader2,
    RefreshCw,
    Settings,
    TrendingUp,
} from 'lucide-react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

// ─── Formatting helpers ───
const formatUSD = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Section A: Rate Management ───
function RateManagementSection() {
    const { effectiveRates, isLoading } = useEffectiveRates();
    const { data: allRates = [] } = useSystemCostRatesAll();
    const updateRate = useUpdateCostRate();

    const [editingRate, setEditingRate] = useState<EffectiveRate | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const perKmRates = effectiveRates.filter(r => r.rate_type === 'per_km');
    const perDayRates = effectiveRates.filter(r => r.rate_type === 'per_day');

    const handleOpenEdit = (rate: EffectiveRate) => {
        setEditingRate(rate);
        setEditAmount(rate.amount.toString());
        setEditDate(format(new Date(), 'yyyy-MM-dd'));
        setEditNotes('');
    };

    const handleSaveRate = async () => {
        if (!editingRate) return;
        const amount = parseFloat(editAmount);
        if (isNaN(amount) || amount < 0) return;

        const { data: { user } } = await supabase.auth.getUser();

        await updateRate.mutateAsync({
            rate_key: editingRate.rate_key,
            rate_type: editingRate.rate_type,
            amount,
            display_name: editingRate.display_name,
            effective_date: editDate,
            created_by: user?.email || 'unknown',
            notes: editNotes || undefined,
        });
        setEditingRate(null);
    };

    const getHistoryForKey = (rateKey: string) =>
        allRates
            .filter(r => r.rate_key === rateKey)
            .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading rates...</div>;
    }

    const renderRateTable = (rates: EffectiveRate[], title: string, unitLabel: string) => (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Cost Category</TableHead>
                            <TableHead className="text-right">Rate ({unitLabel})</TableHead>
                            <TableHead>Effective From</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rates.map(rate => {
                            const history = getHistoryForKey(rate.rate_key);
                            const isExpanded = expandedKey === rate.rate_key;
                            return (
                                <Fragment key={rate.rate_key}>
                                    <TableRow className="group">
                                        <TableCell className="w-8 pr-0">
                                            {history.length > 1 ? (
                                                <button
                                                    onClick={() => setExpandedKey(isExpanded ? null : rate.rate_key)}
                                                    className="p-1 hover:bg-muted rounded"
                                                >
                                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                </button>
                                            ) : null}
                                        </TableCell>
                                        <TableCell className="font-medium">{rate.display_name}</TableCell>
                                        <TableCell className="text-right font-mono">{formatUSD(rate.amount)}</TableCell>
                                        <TableCell>{rate.effective_date}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(rate)}>
                                                <Settings className="h-3.5 w-3.5 mr-1" />
                                                Adjust
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow key={`${rate.rate_key}-history`} className="bg-muted/30 hover:bg-muted/30">
                                            <TableCell colSpan={5} className="p-0">
                                                <div className="px-4 py-2">
                                                    <div className="flex items-center gap-2 pb-1.5 text-xs font-medium text-muted-foreground">
                                                        <History className="h-3 w-3" /> Rate History ({history.length} entries)
                                                    </div>
                                                    <div className="space-y-1">
                                                        {history.map((h: SystemCostRate) => (
                                                            <div key={h.id} className="flex items-center gap-4 text-sm py-1 px-2 bg-background rounded">
                                                                <span className="font-mono font-medium w-20">{formatUSD(h.amount)}</span>
                                                                <span className="text-muted-foreground">{h.effective_date}</span>
                                                                <span className="text-muted-foreground text-xs">{h.created_by || 'System'}</span>
                                                                {h.notes && <span className="text-muted-foreground text-xs italic truncate">{h.notes}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4">
            {renderRateTable(perKmRates, 'Per-Kilometer Rates', '$/km')}
            {renderRateTable(perDayRates, 'Per-Day Rates', '$/day')}

            {/* Adjust Rate Dialog */}
            <Dialog open={!!editingRate} onOpenChange={() => setEditingRate(null)}>
                <DialogContent className="max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Adjust Rate: {editingRate?.display_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="text-sm text-muted-foreground">
                            Current rate: <strong>{editingRate && formatUSD(editingRate.amount)}</strong>{' '}
                            {editingRate?.rate_type === 'per_km' ? '/km' : '/day'}
                        </div>
                        <div className="space-y-2">
                            <Label>New Amount ($)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editAmount}
                                onChange={e => setEditAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Effective Date</Label>
                            <Input
                                type="date"
                                value={editDate}
                                onChange={e => setEditDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (optional)</Label>
                            <Textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                placeholder="Reason for rate change..."
                                rows={2}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingRate(null)}>Cancel</Button>
                            <Button
                                onClick={handleSaveRate}
                                disabled={updateRate.isPending || !editAmount || !editDate}
                            >
                                {updateRate.isPending ? 'Saving...' : 'Save Rate'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Section B: System Costs Overview ───
function SystemCostsOverview() {
    const { data: systemCosts = [], isLoading } = useQuery({
        queryKey: ['system-generated-costs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cost_entries')
                .select('*')
                .eq('is_system_generated', true)
                .eq('category', 'System Costs')
                .order('date', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        staleTime: 30 * 1000,
    });

    // Fetch trip info for display
    const tripIds = useMemo(
        () => [...new Set(systemCosts.map(c => c.trip_id).filter(Boolean))],
        [systemCosts]
    );

    const { data: trips = [] } = useQuery({
        queryKey: ['system-cost-trips', tripIds],
        queryFn: async () => {
            if (tripIds.length === 0) return [];
            const { data, error } = await supabase
                .from('trips')
                .select('id, trip_number, route, departure_date, arrival_date, status, distance_km')
                .in('id', tripIds);

            if (error) throw error;
            return data || [];
        },
        enabled: tripIds.length > 0,
        staleTime: 60 * 1000,
    });

    // Group costs by trip
    const groupedByTrip = useMemo(() => {
        const map = new Map<string, { trip: typeof trips[0] | null; costs: typeof systemCosts; total: number }>();

        for (const cost of systemCosts) {
            const tid = cost.trip_id || 'unknown';
            if (!map.has(tid)) {
                map.set(tid, { trip: trips.find(t => t.id === tid) || null, costs: [], total: 0 });
            }
            const group = map.get(tid)!;
            group.costs.push(cost);
            group.total += cost.amount;
        }

        return [...map.entries()]
            .sort((a, b) => {
                const dateA = a[1].trip?.departure_date || '';
                const dateB = b[1].trip?.departure_date || '';
                return dateB.localeCompare(dateA);
            });
    }, [systemCosts, trips]);

    const totalSystemCosts = systemCosts.reduce((sum, c) => sum + c.amount, 0);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading system costs...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <DollarSign className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total System Costs</p>
                            <p className="text-xl font-bold">{formatUSD(totalSystemCosts)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Calculator className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Cost Entries</p>
                            <p className="text-xl font-bold">{systemCosts.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Trips with System Costs</p>
                            <p className="text-xl font-bold">{groupedByTrip.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Per-trip breakdown */}
            {groupedByTrip.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No system-generated costs yet. Costs are auto-created when new trips are added.
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Cost Breakdown by Trip</CardTitle>
                        <CardDescription>All auto-generated operational costs grouped by trip</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Trip #</TableHead>
                                    <TableHead>Route</TableHead>
                                    <TableHead>Dates</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">System Costs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedByTrip.map(([tripId, { trip, total }]) => (
                                    <TableRow key={tripId}>
                                        <TableCell className="font-medium">{trip?.trip_number || tripId.slice(0, 8)}</TableCell>
                                        <TableCell>{trip?.route || '-'}</TableCell>
                                        <TableCell className="text-sm">
                                            {trip?.departure_date || '-'} → {trip?.arrival_date || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={trip?.status === 'active' ? 'default' : 'secondary'}>
                                                {trip?.status || 'unknown'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">{formatUSD(total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── Section C: Apply Rate Changes to Period ───
interface TripPreview {
    id: string;
    trip_number: string | null;
    route: string | null;
    departure_date: string | null;
    arrival_date: string | null;
    distance_km: number | null;
    fleet_vehicle_id: string | null;
    status: string | null;
    currentTotal: number;
    newTotal: number;
    difference: number;
    isNew: boolean;
    overlapDays: number;
}

function ApplyRatesToPeriodSection() {
    const { data: allRates = [], isLoading: ratesLoading } = useSystemCostRatesAll();
    const queryClient = useQueryClient();

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [previewing, setPreviewing] = useState(false);
    const [applying, setApplying] = useState(false);
    const [tripPreviews, setTripPreviews] = useState<TripPreview[] | null>(null);
    const [applyResult, setApplyResult] = useState<{ updated: number; totalOld: number; totalNew: number } | null>(null);
    const [showRates, setShowRates] = useState(false);
    const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});

    // Compute the effective rates that would apply for the selected period boundaries
    const periodRates = useMemo(() => {
        if (!dateFrom || !dateTo || allRates.length === 0) return null;
        const ratesAtStart = getEffectiveRatesForDate(allRates, dateFrom);
        const ratesAtEnd = getEffectiveRatesForDate(allRates, dateTo);

        const combined = ratesAtStart.map(startRate => {
            const endRate = ratesAtEnd.find(r => r.rate_key === startRate.rate_key);
            return {
                rate_key: startRate.rate_key,
                rate_type: startRate.rate_type,
                display_name: startRate.display_name,
                amountAtStart: startRate.amount,
                effectiveDateStart: startRate.effective_date,
                amountAtEnd: endRate?.amount ?? startRate.amount,
                effectiveDateEnd: endRate?.effective_date ?? startRate.effective_date,
                changed: endRate ? Math.abs(endRate.amount - startRate.amount) >= 0.001 : false,
            };
        });

        return combined;
    }, [dateFrom, dateTo, allRates]);

    const hasOverrides = Object.keys(rateOverrides).length > 0;

    // Build a numeric overrides map from the string inputs (for preview/apply)
    const numericOverrides = useMemo(() => {
        const map: Record<string, number> = {};
        for (const [key, val] of Object.entries(rateOverrides)) {
            const n = parseFloat(val);
            if (!isNaN(n) && n >= 0) map[key] = n;
        }
        return map;
    }, [rateOverrides]);

    const handleOverrideChange = (rateKey: string, value: string) => {
        setRateOverrides(prev => {
            const next = { ...prev };
            if (value === '') {
                delete next[rateKey];
            } else {
                next[rateKey] = value;
            }
            return next;
        });
        // Reset preview when overrides change
        setTripPreviews(null);
        setApplyResult(null);
    };

    const handlePreview = useCallback(async () => {
        if (!dateFrom || !dateTo) return;
        setPreviewing(true);
        setTripPreviews(null);
        setApplyResult(null);

        try {
            // Fetch trips in the date range (by departure_date)
            const { data: trips, error } = await supabase
                .from('trips')
                .select('id, trip_number, route, departure_date, arrival_date, distance_km, status, fleet_vehicle_id')
                .gte('departure_date', dateFrom)
                .lte('departure_date', dateTo)
                .order('departure_date', { ascending: false });

            if (error) throw error;
            if (!trips || trips.length === 0) {
                setTripPreviews([]);
                setPreviewing(false);
                return;
            }

            // Fetch existing system costs for these trips
            const tripIds = trips.map(t => t.id);
            const { data: existingCosts } = await supabase
                .from('cost_entries')
                .select('trip_id, amount')
                .in('trip_id', tripIds)
                .eq('is_system_generated', true)
                .eq('category', 'System Costs');

            // Sum existing costs per trip
            const existingTotals = new Map<string, number>();
            for (const c of existingCosts || []) {
                existingTotals.set(c.trip_id, (existingTotals.get(c.trip_id) || 0) + (c.amount || 0));
            }

            // Compute overlap adjustments for same-vehicle trips
            const overlapAdj = computeOverlapAdjustments(trips);

            // Calculate new costs for each trip (applying overrides if any)
            const previews: TripPreview[] = trips.map(trip => {
                const tripDate = trip.departure_date || new Date().toISOString().split('T')[0];
                let rates = getEffectiveRatesForDate(allRates, tripDate);

                // Apply local overrides without touching the saved rate schedule
                if (Object.keys(numericOverrides).length > 0) {
                    rates = rates.map(r =>
                        numericOverrides[r.rate_key] !== undefined
                            ? { ...r, amount: numericOverrides[r.rate_key] }
                            : r
                    );
                }

                const dayAdj = overlapAdj.get(trip.id) || 0;
                const newEntries = calculateSystemCosts(trip, rates, dayAdj);
                const newTotal = newEntries.reduce((sum, e) => sum + e.amount, 0);
                const currentTotal = existingTotals.get(trip.id) || 0;
                const isNew = !existingTotals.has(trip.id);

                return {
                    id: trip.id,
                    trip_number: trip.trip_number,
                    route: trip.route,
                    departure_date: trip.departure_date,
                    arrival_date: trip.arrival_date,
                    distance_km: trip.distance_km,
                    fleet_vehicle_id: trip.fleet_vehicle_id,
                    status: trip.status,
                    currentTotal,
                    newTotal,
                    difference: newTotal - currentTotal,
                    isNew,
                    overlapDays: dayAdj,
                };
            });

            setTripPreviews(previews);
        } catch (err) {
            console.error('Preview error:', err);
            toast.error('Failed to preview trips');
        } finally {
            setPreviewing(false);
        }
    }, [dateFrom, dateTo, allRates, numericOverrides]);

    const tripsWithChanges = useMemo(() =>
        (tripPreviews || []).filter(t => Math.abs(t.difference) >= 0.01),
        [tripPreviews]
    );

    const newTrips = useMemo(() =>
        (tripPreviews || []).filter(t => t.isNew),
        [tripPreviews]
    );

    const overlapTrips = useMemo(() =>
        (tripPreviews || []).filter(t => t.overlapDays > 0),
        [tripPreviews]
    );

    const totalDifference = useMemo(() =>
        tripsWithChanges.reduce((sum, t) => sum + t.difference, 0),
        [tripsWithChanges]
    );

    const handleApply = useCallback(async () => {
        if (!tripPreviews || tripPreviews.length === 0) return;
        setApplying(true);
        setApplyResult(null);

        try {
            const tripsToUpdate = tripPreviews.map(t => ({
                id: t.id,
                departure_date: t.departure_date,
                arrival_date: t.arrival_date,
                distance_km: t.distance_km,
                fleet_vehicle_id: t.fleet_vehicle_id,
            }));

            const result = await recalculateSystemCostsForTrips(tripsToUpdate, allRates, numericOverrides);
            setApplyResult(result);

            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ['system-generated-costs'] });
            queryClient.invalidateQueries({ queryKey: ['all-expenses'] });

            toast.success(`Updated system costs for ${result.updated} trip${result.updated !== 1 ? 's' : ''}`);
        } catch (err) {
            console.error('Apply error:', err);
            toast.error('Failed to apply rate changes');
        } finally {
            setApplying(false);
        }
    }, [tripPreviews, allRates, numericOverrides, queryClient]);

    if (ratesLoading) {
        return <div className="text-sm text-muted-foreground">Loading rates...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Date range selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Recalculate System Costs for Period
                    </CardTitle>
                    <CardDescription>
                        Select a date range to preview and apply updated rates to all trips within that period.
                        System costs will be recalculated using the effective rates for each trip's departure date.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="space-y-2 flex-1">
                            <Label>From (Departure Date)</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={e => { setDateFrom(e.target.value); setTripPreviews(null); setApplyResult(null); }}
                            />
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label>To (Departure Date)</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={e => { setDateTo(e.target.value); setTripPreviews(null); setApplyResult(null); }}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={handlePreview}
                                disabled={!dateFrom || !dateTo || previewing}
                            >
                                {previewing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                Preview Changes
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Effective Rates for Period */}
            {dateFrom && dateTo && periodRates && (
                <Card>
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowRates(!showRates)}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Rate Overrides for Period
                                {hasOverrides && (
                                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                                        {Object.keys(rateOverrides).length} override{Object.keys(rateOverrides).length !== 1 ? 's' : ''}
                                    </Badge>
                                )}
                            </CardTitle>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                {showRates ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                        </div>
                        <CardDescription className="text-xs">
                            {showRates
                                ? 'Override rates below to fix past costs. These overrides only apply to this recalculation — saved rates are not changed.'
                                : 'Click to view current rates and optionally override them for this recalculation'}
                        </CardDescription>
                    </CardHeader>
                    {showRates && (
                        <CardContent className="pt-0 space-y-3">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cost Category</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Saved Rate</TableHead>
                                        <TableHead className="text-right">Override</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {periodRates.map(rate => {
                                        const overrideValue = rateOverrides[rate.rate_key];
                                        const currentAmount = rate.amountAtEnd;
                                        const unit = rate.rate_type === 'per_km' ? '/km' : '/day';
                                        return (
                                            <TableRow key={rate.rate_key} className={overrideValue !== undefined ? 'bg-blue-50/50' : ''}>
                                                <TableCell className="font-medium">{rate.display_name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        ${unit}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    {formatUSD(currentAmount)}
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        (from {rate.effectiveDateEnd})
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="w-28 ml-auto text-right font-mono h-8 text-sm"
                                                        placeholder={currentAmount.toFixed(2)}
                                                        value={overrideValue ?? ''}
                                                        onChange={e => handleOverrideChange(rate.rate_key, e.target.value)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {hasOverrides && (
                                <div className="flex items-center justify-between pt-1 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        Overrides are temporary — they only affect this recalculation. Your saved rate schedule is not modified.
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setRateOverrides({}); setTripPreviews(null); setApplyResult(null); }}
                                    >
                                        Clear Overrides
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Preview results */}
            {tripPreviews !== null && (
                <>
                    {tripPreviews.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                No trips found with departure dates between {dateFrom} and {dateTo}.
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <Card>
                                    <CardContent className="p-3">
                                        <p className="text-xs text-muted-foreground">Trips in Period</p>
                                        <p className="text-lg font-bold">{tripPreviews.length}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-3">
                                        <p className="text-xs text-muted-foreground">New (No Costs Yet)</p>
                                        <p className="text-lg font-bold text-blue-600">{newTrips.length}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-3">
                                        <p className="text-xs text-muted-foreground">With Changes</p>
                                        <p className="text-lg font-bold">{tripsWithChanges.length}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-3">
                                        <p className="text-xs text-muted-foreground">Current Total</p>
                                        <p className="text-lg font-bold">{formatUSD(tripPreviews.reduce((s, t) => s + t.currentTotal, 0))}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-3">
                                        <p className="text-xs text-muted-foreground">Net Difference</p>
                                        <p className={`text-lg font-bold ${totalDifference > 0 ? 'text-red-600' : totalDifference < 0 ? 'text-green-600' : ''}`}>
                                            {totalDifference > 0 ? '+' : ''}{formatUSD(totalDifference)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {overlapTrips.length > 0 && (
                                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800">Overlap Detected</p>
                                        <p className="text-amber-700">
                                            {overlapTrips.length} trip{overlapTrips.length !== 1 ? 's' : ''} share a start date with another trip's end date on the same vehicle.
                                            Per-day costs have been reduced by 1 day for the later trip to avoid double-charging.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Trip breakdown table */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Trip-by-Trip Preview</CardTitle>
                                    <CardDescription>
                                        Comparison of current vs recalculated system costs per trip
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[400px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Trip #</TableHead>
                                                    <TableHead>Route</TableHead>
                                                    <TableHead>Departure</TableHead>
                                                    <TableHead>Arrival</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Current</TableHead>
                                                    <TableHead className="text-center"><ArrowRight className="h-3.5 w-3.5 mx-auto" /></TableHead>
                                                    <TableHead className="text-right">New</TableHead>
                                                    <TableHead className="text-right">Difference</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {tripPreviews.map(trip => (
                                                    <TableRow key={trip.id} className={trip.isNew ? 'bg-blue-50/50' : Math.abs(trip.difference) >= 0.01 ? 'bg-amber-50/50' : ''}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-1.5">
                                                                {trip.trip_number || trip.id.slice(0, 8)}
                                                                {trip.isNew && (
                                                                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] px-1 py-0">New</Badge>
                                                                )}
                                                                {trip.overlapDays > 0 && (
                                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1 py-0">−{trip.overlapDays}d</Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="max-w-[150px] truncate">{trip.route || '-'}</TableCell>
                                                        <TableCell className="text-sm">{trip.departure_date || '-'}</TableCell>
                                                        <TableCell className="text-sm">{trip.arrival_date || '-'}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={trip.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                                                {trip.status || 'unknown'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            {trip.isNew ? <span className="text-muted-foreground italic">none</span> : formatUSD(trip.currentTotal)}
                                                        </TableCell>
                                                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatUSD(trip.newTotal)}</TableCell>
                                                        <TableCell className={`text-right font-mono text-sm font-semibold ${trip.isNew ? 'text-blue-600' : trip.difference > 0.01 ? 'text-red-600' : trip.difference < -0.01 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                            {trip.isNew
                                                                ? `+${formatUSD(trip.newTotal)}`
                                                                : Math.abs(trip.difference) < 0.01
                                                                    ? 'No change'
                                                                    : `${trip.difference > 0 ? '+' : ''}${formatUSD(trip.difference)}`
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Apply button */}
                            {applyResult ? (
                                <Card className="border-green-200 bg-green-50">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-green-800">
                                                Rate changes applied successfully
                                            </p>
                                            <p className="text-sm text-green-700">
                                                Updated {applyResult.updated} trip{applyResult.updated !== 1 ? 's' : ''}.
                                                Previous total: {formatUSD(applyResult.totalOld)} → New total: {formatUSD(applyResult.totalNew)}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                    <div className="text-sm">
                                        <p className="font-medium">
                                            {tripsWithChanges.length > 0
                                                ? `${tripsWithChanges.length} trip${tripsWithChanges.length !== 1 ? 's' : ''} will be updated${newTrips.length > 0 ? ` (${newTrips.length} new)` : ''}`
                                                : 'All trips already have up-to-date system costs'
                                            }
                                        </p>
                                        {tripsWithChanges.length > 0 && (
                                            <p className="text-muted-foreground">
                                                This will delete and regenerate system cost entries for all {tripPreviews.length} trip{tripPreviews.length !== 1 ? 's' : ''} in the period.
                                                {newTrips.length > 0 && ` ${newTrips.length} trip${newTrips.length !== 1 ? 's' : ''} without costs will receive new system cost entries.`}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleApply}
                                        disabled={applying || tripPreviews.length === 0}
                                        variant={tripsWithChanges.length > 0 ? 'default' : 'outline'}
                                    >
                                        {applying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                        {applying ? 'Applying...' : `Apply to ${tripPreviews.length} Trip${tripPreviews.length !== 1 ? 's' : ''}`}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )
            }
        </div >
    );
}

// ─── Main Component ───
const OperationalCostsTab = () => {
    const [section, setSection] = useState<'rates' | 'costs' | 'apply'>('rates');

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Operational Costs</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage system cost rates and view auto-generated trip expenses
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={section === 'rates' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSection('rates')}
                    >
                        <Settings className="h-4 w-4 mr-1" />
                        Rate Management
                    </Button>
                    <Button
                        variant={section === 'apply' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSection('apply')}
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Apply Rate Changes
                    </Button>
                    <Button
                        variant={section === 'costs' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSection('costs')}
                    >
                        <DollarSign className="h-4 w-4 mr-1" />
                        System Costs
                    </Button>
                </div>
            </div>

            {section === 'rates' ? <RateManagementSection /> : section === 'apply' ? <ApplyRatesToPeriodSection /> : <SystemCostsOverview />}
        </div>
    );
};

export default OperationalCostsTab;
