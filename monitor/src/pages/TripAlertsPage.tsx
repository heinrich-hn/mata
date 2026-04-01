import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, getISOWeek, parseISO, startOfWeek } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  DollarSign,
  Filter,
  FilterX,
  RefreshCw,
  Search,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const getWeekKey = (dateString: string): string => {
  const date = parseISO(dateString);
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
};

const getWeekNumber = (dateString: string): number => {
  return getISOWeek(parseISO(dateString));
};

const formatWeekRange = (mondayKey: string): string => {
  const monday = parseISO(mondayKey);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'dd MMM')} – ${format(sunday, 'dd MMM yyyy')}`;
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  id: string;
  trip_number: string;
  route?: string;
  driver_name?: string;
  client_name?: string;
  fleet_number?: string;
  base_revenue?: number;
  revenue_currency?: string;
  departure_date?: string;
  arrival_date?: string;
  completed_at?: string;
  origin?: string;
  destination?: string;
  status?: string;
  zero_revenue_comment?: string | null;
}

type RawTrip = Trip & { vehicles: { fleet_number: string | null } | { fleet_number: string | null }[] | null };

function mapTrip(trip: RawTrip): Trip {
  const vehicleData = Array.isArray(trip.vehicles) ? trip.vehicles[0] : trip.vehicles;
  return {
    id: trip.id,
    trip_number: trip.trip_number,
    route: trip.route ?? undefined,
    driver_name: trip.driver_name ?? undefined,
    client_name: trip.client_name ?? undefined,
    fleet_number: vehicleData?.fleet_number ?? undefined,
    base_revenue: trip.base_revenue ?? undefined,
    revenue_currency: trip.revenue_currency ?? undefined,
    departure_date: trip.departure_date ?? undefined,
    arrival_date: trip.arrival_date ?? undefined,
    completed_at: trip.completed_at ?? undefined,
    origin: trip.origin ?? undefined,
    destination: trip.destination ?? undefined,
    status: trip.status ?? undefined,
    zero_revenue_comment: trip.zero_revenue_comment,
  };
}

const EMPTY_TRIPS: Trip[] = [];

// ── Component ────────────────────────────────────────────────────────────────

export default function TripAlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fleetFilter, setFleetFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedFleets, setExpandedFleets] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'missing_revenue' | 'duplicate_pods'>('missing_revenue');
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const SELECT_FIELDS = `
    id, trip_number, route, driver_name, client_name,
    base_revenue, revenue_currency, departure_date, arrival_date,
    completed_at, origin, destination, status, zero_revenue_comment,
    fleet_vehicle_id, vehicles:fleet_vehicle_id (fleet_number)
  `;

  // ── Fetch completed trips with missing revenue ───────────────────────────

  const { data: missingRevenueTrips = [], isLoading: isLoadingRevenue, refetch: refetchRevenue, isRefetching: isRefetchingRevenue } = useQuery<Trip[]>({
    queryKey: ['missing-revenue-trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(SELECT_FIELDS)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) throw error;

      return ((data || []) as unknown as RawTrip[])
        .map(mapTrip)
        .filter(t => (!t.base_revenue || t.base_revenue <= 0) && !t.zero_revenue_comment);
    },
    refetchInterval: 60000,
  });

  // ── Fetch all non-completed trips to detect duplicate PODs ───────────────

  const { data: duplicateGroups = [], isLoading: isLoadingDuplicates, refetch: refetchDuplicates, isRefetching: isRefetchingDuplicates } = useQuery<{ tripNumber: string; trips: Trip[] }[]>({
    queryKey: ['duplicate-pod-trips'],
    queryFn: async () => {
      // Fetch active/in-progress trips (non-completed) to find duplicates
      const { data, error } = await supabase
        .from('trips')
        .select(SELECT_FIELDS)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allTrips = ((data || []) as unknown as RawTrip[]).map(mapTrip);

      // Count occurrences of each trip_number
      const counts: Record<string, Trip[]> = {};
      allTrips.forEach(t => {
        if (!counts[t.trip_number]) counts[t.trip_number] = [];
        counts[t.trip_number].push(t);
      });

      // Only keep groups with more than 1 trip (the duplicates)
      return Object.entries(counts)
        .filter(([, trips]) => trips.length > 1)
        .map(([tripNumber, trips]) => ({ tripNumber, trips }))
        .sort((a, b) => b.trips.length - a.trips.length);
    },
    refetchInterval: 60000,
  });

  // Real-time subscription for trip changes
  useEffect(() => {
    const subscription = supabase
      .channel('trip-alerts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['missing-revenue-trips'] });
          queryClient.invalidateQueries({ queryKey: ['duplicate-pod-trips'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // ── Derived data for the active tab ──────────────────────────────────────

  const trips = activeTab === 'missing_revenue' ? missingRevenueTrips : EMPTY_TRIPS;
  const isRefetching = activeTab === 'missing_revenue' ? isRefetchingRevenue : isRefetchingDuplicates;

  const refetch = () => {
    refetchRevenue();
    refetchDuplicates();
  };

  // ── Filter options (for missing revenue tab) ─────────────────────────────

  const filterOptions = useMemo(() => {
    const fleets = [...new Set(trips.map(t => t.fleet_number).filter(Boolean))] as string[];
    const drivers = [...new Set(trips.map(t => t.driver_name).filter(Boolean))] as string[];
    const clients = [...new Set(trips.map(t => t.client_name).filter(Boolean))] as string[];
    return { fleets: fleets.sort(), drivers: drivers.sort(), clients: clients.sort() };
  }, [trips]);

  // ── Filter trips (missing revenue) ───────────────────────────────────────

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      if (fleetFilter !== 'all' && trip.fleet_number !== fleetFilter) return false;
      if (driverFilter !== 'all' && trip.driver_name !== driverFilter) return false;
      if (clientFilter !== 'all' && trip.client_name !== clientFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          trip.trip_number?.toLowerCase().includes(q) ||
          trip.route?.toLowerCase().includes(q) ||
          trip.driver_name?.toLowerCase().includes(q) ||
          trip.client_name?.toLowerCase().includes(q) ||
          trip.fleet_number?.toLowerCase().includes(q) ||
          trip.origin?.toLowerCase().includes(q) ||
          trip.destination?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [trips, fleetFilter, driverFilter, clientFilter, searchQuery]);

  // ── Filter duplicate groups ──────────────────────────────────────────────

  const filteredDuplicateGroups = useMemo(() => {
    if (!searchQuery) return duplicateGroups;
    const q = searchQuery.toLowerCase();
    return duplicateGroups.filter(g =>
      g.tripNumber.toLowerCase().includes(q) ||
      g.trips.some(t =>
        t.driver_name?.toLowerCase().includes(q) ||
        t.fleet_number?.toLowerCase().includes(q) ||
        t.client_name?.toLowerCase().includes(q) ||
        t.route?.toLowerCase().includes(q)
      )
    );
  }, [duplicateGroups, searchQuery]);

  // ── Group trips by week (missing revenue) ────────────────────────────────

  const tripsByWeek = useMemo(() => {
    const grouped: Record<string, Trip[]> = {};

    filteredTrips.forEach(trip => {
      const dateToUse = trip.arrival_date || trip.departure_date || trip.completed_at;
      const weekKey = dateToUse ? getWeekKey(dateToUse) : 'No Date';
      if (!grouped[weekKey]) grouped[weekKey] = [];
      grouped[weekKey].push(trip);
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'No Date') return 1;
      if (b === 'No Date') return -1;
      return b.localeCompare(a);
    });

    const sorted: Record<string, Trip[]> = {};
    sortedKeys.forEach(key => { sorted[key] = grouped[key]; });
    return sorted;
  }, [filteredTrips]);

  // ── Expand / collapse helpers ────────────────────────────────────────────

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

  const toggleFleet = (key: string) => {
    setExpandedFleets(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleDuplicate = (pod: string) => {
    setExpandedDuplicates(prev => {
      const next = new Set(prev);
      if (next.has(pod)) {
        next.delete(pod);
      } else {
        next.add(pod);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedWeeks(new Set(Object.keys(tripsByWeek)));
  const collapseAll = () => { setExpandedWeeks(new Set()); setExpandedFleets(new Set()); };

  const hasActiveFilters = fleetFilter !== 'all' || driverFilter !== 'all' || clientFilter !== 'all' || searchQuery !== '';
  const clearFilters = () => { setFleetFilter('all'); setDriverFilter('all'); setClientFilter('all'); setSearchQuery(''); };

  // Reset filters when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'missing_revenue' | 'duplicate_pods');
    clearFilters();
    setExpandedWeeks(new Set());
    setExpandedFleets(new Set());
    setExpandedDuplicates(new Set());
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoadingRevenue && isLoadingDuplicates) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading trip alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monitor-page">

      {/* ── Summary cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          className={cn(
            "border-slate-200 cursor-pointer transition-all hover:shadow-md",
            activeTab === 'missing_revenue' && "ring-1 ring-slate-400"
          )}
          onClick={() => handleTabChange('missing_revenue')}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Missing Revenue</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{missingRevenueTrips.length}</p>
              </div>
              <DollarSign className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "border-slate-200 cursor-pointer transition-all hover:shadow-md",
            activeTab === 'duplicate_pods' && "ring-1 ring-slate-400"
          )}
          onClick={() => handleTabChange('duplicate_pods')}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Duplicate Load Ref / POD</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{duplicateGroups.length}</p>
              </div>
              <Copy className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="missing_revenue" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Missing Revenue ({missingRevenueTrips.length})
          </TabsTrigger>
          <TabsTrigger value="duplicate_pods" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Duplicate POD / Load Ref ({duplicateGroups.length})
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════
            TAB 1: Missing Revenue
            ════════════════════════════════════════════════════════ */}
        <TabsContent value="missing_revenue" className="mt-4 space-y-6">

          {/* Banner */}
          {missingRevenueTrips.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Missing Base Revenue in Completed Trips</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {missingRevenueTrips.length} completed trip(s) have no base revenue set.
                  Update these trips in the Dashboard for accurate profit calculations.
                </p>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="border border-slate-200 rounded-lg bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-slate-400" />
                <div>
                  <h2 className="text-sm font-medium text-slate-900">Missing Revenue Trips</h2>
                  <p className="text-xs text-slate-500">Completed trips without base revenue</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
                Refresh
              </Button>
            </div>

            {/* Filter bar */}
            <div className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by POD, route, driver, client, fleet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 h-10 text-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={fleetFilter} onValueChange={setFleetFilter}>
                    <SelectTrigger className="w-[140px] h-10">
                      <Truck className="h-3.5 w-3.5 mr-2" />
                      <SelectValue placeholder="Fleet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fleets</SelectItem>
                      {filterOptions.fleets.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={driverFilter} onValueChange={setDriverFilter}>
                    <SelectTrigger className="w-[160px] h-10">
                      <User className="h-3.5 w-3.5 mr-2" />
                      <SelectValue placeholder="Driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drivers</SelectItem>
                      {filterOptions.drivers.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-[160px] h-10">
                      <User className="h-3.5 w-3.5 mr-2" />
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {filterOptions.clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active filters */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Active filters:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {fleetFilter !== 'all' && <Badge variant="secondary" className="text-xs gap-1"><Truck className="h-2.5 w-2.5" />{fleetFilter}</Badge>}
                      {driverFilter !== 'all' && <Badge variant="secondary" className="text-xs gap-1"><User className="h-2.5 w-2.5" />{driverFilter}</Badge>}
                      {clientFilter !== 'all' && <Badge variant="secondary" className="text-xs gap-1"><User className="h-2.5 w-2.5" />{clientFilter}</Badge>}
                      {searchQuery && <Badge variant="secondary" className="text-xs gap-1"><Search className="h-2.5 w-2.5" />"{searchQuery}"</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 text-xs">
                    <FilterX className="h-3 w-3" />Clear all
                  </Button>
                </div>
              )}

              {/* Results summary */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{filteredTrips.length}</span> of{' '}
                  <span className="font-medium text-foreground">{missingRevenueTrips.length}</span> trips missing revenue
                </span>
                {Object.keys(tripsByWeek).length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">Expand All</Button>
                    <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">Collapse All</Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Empty state */}
          {missingRevenueTrips.length === 0 && !isLoadingRevenue && (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-1">All trips have revenue</h3>
                <p className="text-sm text-slate-500">Every completed trip has a base revenue value set.</p>
              </CardContent>
            </Card>
          )}

          {/* No results for filters */}
          {missingRevenueTrips.length > 0 && filteredTrips.length === 0 && (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <Filter className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-1">No matching trips</h3>
                <p className="text-sm text-slate-500 mb-6">No trips match your current filter criteria.</p>
                <Button variant="outline" size="sm" onClick={clearFilters} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                  <FilterX className="h-4 w-4 mr-2" />Clear All Filters
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Grouped trip table (week → fleet → rows) */}
          {filteredTrips.length > 0 && (
            <div className="space-y-4">
              {Object.entries(tripsByWeek).map(([weekKey, weekTrips]) => {
                const isExpanded = expandedWeeks.has(weekKey);
                const weekNumber = weekKey === 'No Date' ? null : getWeekNumber(weekKey);
                const formattedWeek = weekKey === 'No Date' ? 'No Offloading Date' : formatWeekRange(weekKey);

                return (
                  <div key={weekKey} className="space-y-3">
                    <button
                      onClick={() => toggleWeek(weekKey)}
                      className="w-full flex items-center justify-between p-4 bg-card border border-slate-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </div>
                        {weekNumber && (
                          <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-100 rounded-lg">
                            <span className="text-xs text-slate-500">Week</span>
                            <span className="text-lg font-bold text-slate-900 tabular-nums leading-none">{weekNumber}</span>
                          </div>
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-slate-900">{formattedWeek}</h3>
                            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 border-slate-200">
                              {weekTrips.length} {weekTrips.length === 1 ? 'trip' : 'trips'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 pl-4 border-l-2 border-slate-200 ml-4">
                        {(() => {
                          const fleetGroups = weekTrips.reduce<Record<string, Trip[]>>((acc, trip) => {
                            const fleet = trip.fleet_number || 'Unassigned';
                            if (!acc[fleet]) acc[fleet] = [];
                            acc[fleet].push(trip);
                            return acc;
                          }, {});

                          return Object.entries(fleetGroups)
                            .sort(([a], [b]) => {
                              if (a === 'Unassigned') return 1;
                              if (b === 'Unassigned') return -1;
                              return a.localeCompare(b);
                            })
                            .map(([fleetNumber, fleetTrips]) => {
                              const fleetKey = `${weekKey}-${fleetNumber}`;
                              const isFleetExpanded = expandedFleets.has(fleetKey);

                              return (
                                <div key={fleetKey}>
                                  <button
                                    onClick={() => toggleFleet(fleetKey)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      {isFleetExpanded ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                      <Truck className="h-4 w-4 text-slate-500" />
                                      <span className="font-medium text-slate-900">{fleetNumber}</span>
                                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">{fleetTrips.length} trips</Badge>
                                    </div>
                                  </button>

                                  {isFleetExpanded && (
                                    <div className="ml-7 mt-1 border border-slate-200 rounded-lg overflow-hidden bg-card">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-slate-200">
                                            <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 w-[80px]">POD</th>
                                            <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Route</th>
                                            <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Driver</th>
                                            <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Client</th>
                                            <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 w-[90px]">Date</th>
                                            <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 w-[80px]">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {fleetTrips.map(trip => (
                                            <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="py-2.5 px-3">
                                                <span className="font-medium text-slate-900 tabular-nums">{trip.trip_number}</span>
                                              </td>
                                              <td className="py-2.5 px-3">
                                                <span className="text-slate-600 truncate max-w-[180px]">{trip.route || (trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : '—')}</span>
                                              </td>
                                              <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">{trip.driver_name || '—'}</td>
                                              <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">{trip.client_name || '—'}</td>
                                              <td className="py-2.5 px-3 text-slate-500 tabular-nums text-xs">
                                                {trip.arrival_date ? format(parseISO(trip.arrival_date), 'dd MMM')
                                                  : trip.departure_date ? format(parseISO(trip.departure_date), 'dd MMM')
                                                    : '—'}
                                              </td>
                                              <td className="py-2.5 px-3">
                                                <Badge className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 border-slate-200">
                                                  Missing
                                                </Badge>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════
            TAB 2: Duplicate POD / Load Reference Numbers
            ════════════════════════════════════════════════════════ */}
        <TabsContent value="duplicate_pods" className="mt-4 space-y-6">

          {/* Banner */}
          {duplicateGroups.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Duplicate POD / Load Reference Numbers Detected</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {duplicateGroups.length} load reference / POD number(s) appear on multiple active trips.
                  Review and correct these in the Dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="border border-slate-200 rounded-lg bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Copy className="h-4 w-4 text-slate-400" />
                <div>
                  <h2 className="text-sm font-medium text-slate-900">Duplicate Load Ref / POD Numbers</h2>
                  <p className="text-xs text-slate-500">Active trips sharing the same reference number</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
                Refresh
              </Button>
            </div>

            {/* Search */}
            <div className="p-4 space-y-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by POD number, driver, fleet, client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-10 text-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{filteredDuplicateGroups.length}</span> of{' '}
                  <span className="font-medium text-foreground">{duplicateGroups.length}</span> duplicated numbers
                </span>
                {filteredDuplicateGroups.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedDuplicates(new Set(filteredDuplicateGroups.map(g => g.tripNumber)))} className="h-7 text-xs">Expand All</Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedDuplicates(new Set())} className="h-7 text-xs">Collapse All</Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Empty state */}
          {duplicateGroups.length === 0 && !isLoadingDuplicates && (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-1">No duplicate POD numbers</h3>
                <p className="text-sm text-slate-500">All active trips have unique load reference / POD numbers.</p>
              </CardContent>
            </Card>
          )}

          {/* Duplicate groups */}
          {filteredDuplicateGroups.length > 0 && (
            <div className="space-y-4">
              {filteredDuplicateGroups.map(({ tripNumber, trips: dupTrips }) => {
                const isExpanded = expandedDuplicates.has(tripNumber);

                return (
                  <div key={tripNumber} className="space-y-2">
                    {/* Duplicate group header */}
                    <button
                      onClick={() => toggleDuplicate(tripNumber)}
                      className="w-full flex items-center justify-between p-4 bg-card border border-slate-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </div>

                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-slate-900">Load Ref #{tripNumber}</h3>
                            <Badge className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 border-slate-200">
                              {dupTrips.length}x duplicate
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{dupTrips.length} trips share this number</p>
                        </div>
                      </div>
                    </button>

                    {/* Duplicate group content */}
                    {isExpanded && (
                      <div className="ml-4 pl-4 border-l-2 border-slate-200">
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-card">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 w-[80px]">POD</th>
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Route</th>
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Fleet</th>
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Driver</th>
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Client</th>
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 w-[90px]">Date</th>
                                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 w-[80px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {dupTrips.map(trip => (
                                <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-medium text-slate-900 tabular-nums">{trip.trip_number}</span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="text-slate-600 truncate max-w-[180px]">{trip.route || (trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : '—')}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    {trip.fleet_number || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">{trip.driver_name || '—'}</td>
                                  <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">{trip.client_name || '—'}</td>
                                  <td className="py-2.5 px-3 text-slate-500 tabular-nums text-xs">
                                    {trip.departure_date ? format(parseISO(trip.departure_date), 'dd MMM') : '—'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 border-slate-200">
                                      Duplicate
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}