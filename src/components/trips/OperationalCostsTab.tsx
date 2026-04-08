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
    EffectiveRate,
    SystemCostRate,
    useEffectiveRates,
    useSystemCostRatesAll,
    useUpdateCostRate,
} from '@/hooks/useSystemCostRates';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Calculator,
    ChevronDown,
    ChevronRight,
    DollarSign,
    History,
    Settings,
    TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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
                                <TableRow key={rate.rate_key} className="group">
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
                            );
                        })}
                    </TableBody>
                </Table>

                {/* Expanded history rows */}
                {expandedKey && rates.some(r => r.rate_key === expandedKey) && (
                    <div className="px-4 pb-4 bg-muted/30">
                        <div className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground">
                            <History className="h-3.5 w-3.5" /> Rate History
                        </div>
                        <div className="space-y-1">
                            {getHistoryForKey(expandedKey).map((h: SystemCostRate) => (
                                <div key={h.id} className="flex justify-between text-sm py-1 px-2 bg-background rounded">
                                    <span>{formatUSD(h.amount)}</span>
                                    <span className="text-muted-foreground">{h.effective_date}</span>
                                    <span className="text-muted-foreground text-xs">{h.created_by || 'System'}</span>
                                    {h.notes && <span className="text-muted-foreground text-xs italic">{h.notes}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4">
            {renderRateTable(perKmRates, 'Per-Kilometer Rates', '$/km')}
            {renderRateTable(perDayRates, 'Per-Day Rates', '$/day')}

            {/* Adjust Rate Dialog */}
            <Dialog open={!!editingRate} onOpenChange={() => setEditingRate(null)}>
                <DialogContent className="max-w-md">
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

// ─── Main Component ───
const OperationalCostsTab = () => {
    const [section, setSection] = useState<'rates' | 'costs'>('rates');

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
                        variant={section === 'costs' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSection('costs')}
                    >
                        <DollarSign className="h-4 w-4 mr-1" />
                        System Costs
                    </Button>
                </div>
            </div>

            {section === 'rates' ? <RateManagementSection /> : <SystemCostsOverview />}
        </div>
    );
};

export default OperationalCostsTab;
