import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ensureAlert } from '@/lib/alertUtils';
import { resolveMissingRevenueAlert } from '@/lib/alertResolution';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, format, getISOWeek, parseISO, startOfWeek } from 'date-fns';
import {
  AlertTriangle,
  Building,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Download,
  Edit,
  Eye,
  Filter,
  FilterX,
  Gauge,
  MoreVertical,
  Plus,
  RefreshCw,
  RouteIcon,
  Search,

  Trash2,
  Truck,
  Upload,
  User,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import TripExportDialog from './TripExportDialog';

// Helper function to get week key (Monday of the week)
const getWeekKey = (dateString: string): string => {
  const date = parseISO(dateString);
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
};

// Helper function to get week number of the year (ISO week)
const getWeekNumber = (dateString: string): number => {
  const date = parseISO(dateString);
  return getISOWeek(date);
};

// Helper function to format week range (Monday - Sunday)
const formatWeekRange = (mondayKey: string): string => {
  const monday = parseISO(mondayKey);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'dd MMM')} - ${format(sunday, 'dd MMM yyyy')}`;
};

interface CostEntry {
  amount: number;
  currency?: string;
  description?: string;
  is_flagged?: boolean;
  investigation_status?: string;
  flag_reason?: string;
}

interface AdditionalCost {
  amount: number;
  currency?: string;
  description?: string;
}

interface Trip {
  id: string;
  trip_number: string;
  route?: string;
  driver_name?: string;
  client_name?: string;
  vehicle_id?: string;
  fleet_number?: string;
  fleet_vehicle_id?: string;
  base_revenue?: number;
  additional_revenue?: number;
  additional_revenue_reason?: string;
  revenue_currency?: string;
  distance_km?: number;
  empty_km?: number;
  starting_km?: number;
  ending_km?: number;
  departure_date?: string;
  costs?: CostEntry[];
  additional_costs?: AdditionalCost[];
  pod_verified?: boolean;
  notes?: string;
  zero_revenue_comment?: string;
  // Warning/validation fields
  hasFlaggedCosts?: boolean;
  flaggedCostCount?: number;
  hasPendingCosts?: boolean;
  pendingCostCount?: number;
  hasNoCosts?: boolean;
  daysInProgress?: number;
  payment_status?: string;
}

interface ActiveTripsProps {
  trips: Trip[];
  onEdit: (trip: Trip) => void;
  onDelete: (id: string) => void;
  onView: (trip: Trip) => void;
  onAddTrip: () => void;
  onImport: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const ActiveTrips = ({
  trips,
  onEdit,
  onDelete,
  onView,
  onAddTrip,
  onImport,
  onRefresh,
  isLoading = false
}: ActiveTripsProps) => {
  const { userName } = useAuth();

  // Compute KM mismatches: for each trip, check if starting_km matches previous trip's ending_km on same vehicle
  const vehicleIds = useMemo(() => [...new Set(trips.map(t => t.fleet_vehicle_id || t.vehicle_id).filter(Boolean))] as string[], [trips]);

  const { data: previousEndingKmMap } = useQuery({
    queryKey: ['previous-ending-km', vehicleIds.join(',')],
    queryFn: async () => {
      if (vehicleIds.length === 0) return new Map<string, { ending_km: number; trip_number: string }[]>();
      // For each vehicle, get all trips with ending_km ordered by departure_date
      const { data, error } = await supabase
        .from('trips')
        .select('id, fleet_vehicle_id, trip_number, ending_km, departure_date')
        .in('fleet_vehicle_id', vehicleIds)
        .not('ending_km', 'is', null)
        .order('departure_date', { ascending: false });

      if (error) return new Map<string, { ending_km: number; trip_number: string }[]>();

      const map = new Map<string, { ending_km: number; trip_number: string }[]>();
      for (const row of data || []) {
        const vid = row.fleet_vehicle_id as string;
        if (!map.has(vid)) map.set(vid, []);
        map.get(vid)!.push({ ending_km: row.ending_km as number, trip_number: row.trip_number as string });
      }
      return map;
    },
    enabled: vehicleIds.length > 0,
    staleTime: 30_000,
  });

  // Map tripId → km mismatch info
  const kmMismatches = useMemo(() => {
    const result = new Map<string, { gap: number; previousEndingKm: number; previousTripNumber: string }>();
    if (!previousEndingKmMap) return result;

    for (const trip of trips) {
      if (!trip.starting_km || !trip.fleet_vehicle_id) continue;
      const vehicleTrips = previousEndingKmMap.get(trip.fleet_vehicle_id);
      if (!vehicleTrips) continue;

      // Find the first trip that isn't this one (already sorted by departure desc, so first non-self is the previous)
      const prev = vehicleTrips.find(vt => vt.trip_number !== trip.trip_number);
      if (!prev) continue;

      const gap = trip.starting_km - prev.ending_km;
      if (gap !== 0) {
        result.set(trip.id, { gap, previousEndingKm: prev.ending_km, previousTripNumber: prev.trip_number });
      }
    }
    return result;
  }, [trips, previousEndingKmMap]);

  // Filter state
  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [showMissingRevenueOnly, setShowMissingRevenueOnly] = useState<boolean>(false);
  const [isResolvingAlert, setIsResolvingAlert] = useState<Record<string, boolean>>({});

  // Export dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Expanded state
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedFleets, setExpandedFleets] = useState<Set<string>>(new Set());

  // Toggle functions
  const toggleWeekCollapse = (weekKey: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekKey)) {
        newSet.delete(weekKey);
      } else {
        newSet.add(weekKey);
      }
      return newSet;
    });
  };

  const toggleFleetCollapse = (fleetKey: string) => {
    setExpandedFleets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fleetKey)) {
        newSet.delete(fleetKey);
      } else {
        newSet.add(fleetKey);
      }
      return newSet;
    });
  };

  const collapseAll = () => {
    setExpandedWeeks(new Set());
    setExpandedFleets(new Set());
  };

  const expandAll = () => {
    const allWeeks = Object.keys(tripsByWeek);
    setExpandedWeeks(new Set(allWeeks));
  };

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const fleets = [...new Set(trips.map(t => t.fleet_number).filter(Boolean))] as string[];
    const drivers = [...new Set(trips.map(t => t.driver_name).filter(Boolean))] as string[];
    const clients = [...new Set(trips.map(t => t.client_name).filter(Boolean))] as string[];
    return {
      fleets: fleets.sort(),
      drivers: drivers.sort(),
      clients: clients.sort(),
    };
  }, [trips]);

  // Filter trips based on selected filters
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      if (fleetFilter !== 'all' && trip.fleet_number !== fleetFilter) return false;
      if (driverFilter !== 'all' && trip.driver_name !== driverFilter) return false;
      if (clientFilter !== 'all' && trip.client_name !== clientFilter) return false;
      if (showMissingRevenueOnly && trip.base_revenue && trip.base_revenue > 0) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          trip.trip_number.toLowerCase().includes(query) ||
          trip.route?.toLowerCase().includes(query) ||
          trip.driver_name?.toLowerCase().includes(query) ||
          trip.client_name?.toLowerCase().includes(query) ||
          trip.fleet_number?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [trips, fleetFilter, driverFilter, clientFilter, searchQuery, showMissingRevenueOnly]);

  // Group trips by week
  const tripsByWeek = useMemo(() => {
    const grouped: Record<string, Trip[]> = {};

    filteredTrips.forEach(trip => {
      const weekKey = trip.departure_date ? getWeekKey(trip.departure_date) : 'No Date';
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(trip);
    });

    // Sort weeks in descending order (newest first)
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'No Date') return 1;
      if (b === 'No Date') return -1;
      return b.localeCompare(a);
    });

    const sorted: Record<string, Trip[]> = {};
    sortedKeys.forEach(key => {
      sorted[key] = grouped[key];
    });

    return sorted;
  }, [filteredTrips]);

  const hasActiveFilters = fleetFilter !== 'all' || driverFilter !== 'all' || clientFilter !== 'all' || searchQuery !== '' || showMissingRevenueOnly;

  const clearFilters = () => {
    setFleetFilter('all');
    setDriverFilter('all');
    setClientFilter('all');
    setSearchQuery('');
    setShowMissingRevenueOnly(false);
  };

  // Detect duplicate POD numbers
  const duplicatePods = useMemo(() => {
    const counts: Record<string, number> = {};
    trips.forEach(t => {
      counts[t.trip_number] = (counts[t.trip_number] || 0) + 1;
    });
    return Object.entries(counts).filter(([, count]) => count > 1).map(([pod, count]) => ({ pod, count }));
  }, [trips]);

  useEffect(() => {
    duplicatePods.forEach(async ({ pod, count }) => {
      try {
        const duplicateTrips = trips.filter(t => t.trip_number === pod).map(t => t.id);
        await ensureAlert({
          sourceType: 'system',
          sourceId: pod,
          sourceLabel: `Duplicate POD ${pod}`,
          category: 'duplicate_pod',
          severity: 'medium',
          title: 'Duplicate POD Detected in Active Trips',
          message: `POD number ${pod} is used in ${count} active trips`,
          metadata: { pod_number: pod, count, tripIds: duplicateTrips }
        });
      } catch (err) {
        console.error('Alert creation skipped for pod:', pod, err);
      }
    });
  }, [duplicatePods, trips]);

  const handleEdit = async (trip: Trip) => {
    // Check if this trip has missing revenue and no comment yet
    const hasMissingRevenue = (!trip.base_revenue || trip.base_revenue === 0) && !trip.zero_revenue_comment;

    if (hasMissingRevenue) {
      setIsResolvingAlert(prev => ({ ...prev, [trip.id]: true }));

      // Resolve the missing revenue alert before opening edit modal
      await resolveMissingRevenueAlert(
        trip.id,
        trip.trip_number,
        'Opening edit modal to add reason',
        userName || 'System'
      );

      setIsResolvingAlert(prev => ({ ...prev, [trip.id]: false }));
    }

    onEdit(trip);
  };

  const handleDelete = (id: string) => {
    const trip = trips.find((t) => t.id === id);
    if (trip && confirm(`Are you sure you want to delete trip ${trip.trip_number}? This action cannot be undone.`)) {
      onDelete(id);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const formatter = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(amount);
  };

  const calculateProfit = (trip: Trip): { amount: number; currency: string } | null => {
    const revenue = (trip.base_revenue || 0) + (trip.additional_revenue || 0);
    const expenses = [...(trip.costs || []), ...(trip.additional_costs || [])].reduce((sum, c) => sum + (c.amount || 0), 0);
    const currency = trip.revenue_currency || 'USD';
    return { amount: revenue - expenses, currency };
  };

  // Stats calculation
  const stats = useMemo(() => {
    const totalRevenue = filteredTrips.reduce((sum, t) => sum + (t.base_revenue || 0) + (t.additional_revenue || 0), 0);
    const totalExpenses = filteredTrips.reduce((sum, t) => {
      const tripExpenses = [...(t.costs || []), ...(t.additional_costs || [])].reduce((s, c) => s + (c.amount || 0), 0);
      return sum + tripExpenses;
    }, 0);
    const totalDistance = filteredTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
    const avgRevenuePerTrip = filteredTrips.length > 0 ? totalRevenue / filteredTrips.length : 0;

    // Warning stats
    const tripsWithFlaggedCosts = filteredTrips.filter(t => t.hasFlaggedCosts).length;
    const tripsWithNoCosts = filteredTrips.filter(t => t.hasNoCosts).length;
    const tripsWithPendingCosts = filteredTrips.filter(t => t.hasPendingCosts).length;
    const tripsWithNoBaseRevenue = filteredTrips.filter(t => (!t.base_revenue || t.base_revenue === 0) && !t.zero_revenue_comment).length;
    const tripsWithZeroRevenueComment = filteredTrips.filter(t => (!t.base_revenue || t.base_revenue === 0) && !!t.zero_revenue_comment).length;
    const tripsNeedingAttention = filteredTrips.filter(t => t.hasFlaggedCosts || t.hasNoCosts || t.hasPendingCosts || ((!t.base_revenue || t.base_revenue === 0) && !t.zero_revenue_comment)).length;

    return {
      totalTrips: filteredTrips.length,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalDistance,
      avgRevenuePerTrip,
      tripsWithFlaggedCosts,
      tripsWithNoCosts,
      tripsWithPendingCosts,
      tripsWithNoBaseRevenue,
      tripsWithZeroRevenueComment,
      tripsNeedingAttention,
    };
  }, [filteredTrips]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Missing Base Revenue Banner Alert */}
        {filteredTrips.filter(t => (!t.base_revenue || t.base_revenue === 0) && !t.zero_revenue_comment).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Missing Base Revenue</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {filteredTrips.filter(t => (!t.base_revenue || t.base_revenue === 0) && !t.zero_revenue_comment).length} trip(s) have no base revenue set.
                Please update these trips to ensure accurate profit calculations.
                {stats.tripsWithZeroRevenueComment > 0 && (
                  <span className="text-amber-600"> ({stats.tripsWithZeroRevenueComment} trip(s) with zero revenue have been acknowledged with a comment.)</span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMissingRevenueOnly(true)}
              className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              View Missing Revenue
            </Button>
          </div>
        )}

        {/* Premium Toolbar */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-end gap-2 p-3 bg-muted/30 border-b">

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grouped' | 'list')} className="mr-2">
              <TabsList className="h-9">
                <TabsTrigger value="grouped" className="text-xs px-3">Grouped View</TabsTrigger>
                <TabsTrigger value="list" className="text-xs px-3">List View</TabsTrigger>
              </TabsList>
            </Tabs>

            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} className="h-9 gap-2">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)} className="h-9 gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>

            <Button variant="outline" size="sm" onClick={onImport} className="h-9 gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>

            <Button size="sm" onClick={onAddTrip} className="h-9 gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              New Trip
            </Button>
          </div>

          {/* Enhanced Filter Bar */}
          <div className="p-4 space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by POD, route, driver, client, fleet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {searchQuery && (
                  <button
                    title="Clear search"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <Select value={fleetFilter} onValueChange={setFleetFilter}>
                  <SelectTrigger className="w-[140px] h-10">
                    <Truck className="h-3.5 w-3.5 mr-2" />
                    <SelectValue placeholder="Fleet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fleets</SelectItem>
                    {filterOptions.fleets.map(fleet => (
                      <SelectItem key={fleet} value={fleet}>{fleet}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="w-[160px] h-10">
                    <User className="h-3.5 w-3.5 mr-2" />
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {filterOptions.drivers.map(driver => (
                      <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-[160px] h-10">
                    <Building className="h-3.5 w-3.5 mr-2" />
                    <SelectValue placeholder="Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {filterOptions.clients.map(client => (
                      <SelectItem key={client} value={client}>{client}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={showMissingRevenueOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowMissingRevenueOnly(!showMissingRevenueOnly)}
                  className={`h-10 gap-2 ${showMissingRevenueOnly ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                >
                  <DollarSign className="h-4 w-4" />
                  {showMissingRevenueOnly ? 'Showing Missing Revenue' : 'Show Missing Revenue'}
                </Button>
              </div>
            </div>

            {/* Filter Status Bar */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Active filters:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {fleetFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Truck className="h-2.5 w-2.5" />
                        {fleetFilter}
                      </Badge>
                    )}
                    {driverFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <User className="h-2.5 w-2.5" />
                        {driverFilter}
                      </Badge>
                    )}
                    {clientFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Building className="h-2.5 w-2.5" />
                        {clientFilter}
                      </Badge>
                    )}
                    {showMissingRevenueOnly && (
                      <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 text-amber-700">
                        <DollarSign className="h-2.5 w-2.5" />
                        Missing Revenue
                      </Badge>
                    )}
                    {searchQuery && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Search className="h-2.5 w-2.5" />
                        "{searchQuery}"
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 text-xs">
                  <FilterX className="h-3 w-3" />
                  Clear all
                </Button>
              </div>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filteredTrips.length}</span> of{' '}
                <span className="font-medium text-foreground">{trips.length}</span> trips
              </span>
              {Object.keys(tripsByWeek).length > 0 && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">
                    Collapse All
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Duplicate POD Alert */}
        {duplicatePods.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Duplicate POD Numbers Detected</p>
              <p className="text-sm text-destructive/70 mt-0.5">
                Duplicates: {duplicatePods.map(d => d.pod).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && trips.length === 0 && (
          <Card className="border-dashed">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <RouteIcon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No active trips</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                Get started by creating your first trip or importing existing data from a CSV file.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={onImport} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Import Data
                </Button>
                <Button size="lg" onClick={onAddTrip} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Trip
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* No Results State */}
        {!isLoading && trips.length > 0 && filteredTrips.length === 0 && (
          <Card className="border-dashed">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-20 w-20 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                <Filter className="h-10 w-10 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No matching trips</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                No trips match your current filter criteria. Try adjusting or clearing the filters.
              </p>
              <Button variant="outline" size="lg" onClick={clearFilters} className="gap-2">
                <FilterX className="h-4 w-4" />
                Clear All Filters
              </Button>
            </div>
          </Card>
        )}

        {/* Trip Cards - Grouped View */}
        {!isLoading && viewMode === 'grouped' && filteredTrips.length > 0 && (
          <div className="space-y-4">
            {Object.entries(tripsByWeek).map(([weekKey, weekTrips]) => {
              const isCollapsed = !expandedWeeks.has(weekKey);
              const weekNumber = weekKey === 'No Date' ? null : getWeekNumber(weekKey);
              const formattedWeek = weekKey === 'No Date'
                ? 'No Loading Date'
                : formatWeekRange(weekKey);

              // Calculate week totals
              const weekRevenue = weekTrips.reduce((sum, t) => sum + (t.base_revenue || 0) + (t.additional_revenue || 0), 0);
              const weekExpenses = weekTrips.reduce((sum, t) => {
                return sum + [...(t.costs || []), ...(t.additional_costs || [])].reduce((s, c) => s + (c.amount || 0), 0);
              }, 0);

              return (
                <Collapsible
                  key={weekKey}
                  open={!isCollapsed}
                  onOpenChange={() => toggleWeekCollapse(weekKey)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="group flex items-center justify-between p-5 bg-card border rounded-xl hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 cursor-pointer shadow-sm">
                      <div className="flex items-center gap-5">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${isCollapsed
                          ? 'bg-muted group-hover:bg-primary/10'
                          : 'bg-primary/20'
                          }`}>
                          {isCollapsed ? (
                            <ChevronRight className={`h-5 w-5 transition-colors ${isCollapsed ? 'text-muted-foreground' : 'text-primary'
                              }`} />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          )}
                        </div>

                        {weekNumber && (
                          <div className="flex flex-col items-center justify-center w-16 h-16 bg-primary/10 rounded-xl">
                            <span className="text-xs text-muted-foreground">Week</span>
                            <span className="text-2xl font-bold text-primary tabular-nums leading-none">{weekNumber}</span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold">{formattedWeek}</h3>
                            <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
                              {weekTrips.length} {weekTrips.length === 1 ? 'trip' : 'trips'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5">
                              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="font-medium text-emerald-600">{formatCurrency(weekRevenue)}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <DollarSign className="h-3.5 w-3.5 text-rose-500" />
                              <span className="font-medium text-rose-600">{formatCurrency(weekExpenses)}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Gauge className="h-3.5 w-3.5 text-blue-500" />
                              <span className="font-medium">{weekTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0).toLocaleString()} km</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3 pl-6 border-l-2 border-primary/20 ml-6">
                      {(() => {
                        // Group by fleet
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
                              <Collapsible key={fleetKey} open={isFleetExpanded} onOpenChange={() => toggleFleetCollapse(fleetKey)}>
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                        {isFleetExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-primary" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-primary" />
                                        )}
                                      </div>
                                      <Truck className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-semibold">{fleetNumber}</span>
                                      <Badge variant="secondary" className="text-xs font-medium">
                                        {fleetTrips.length} trips
                                      </Badge>
                                    </div>
                                    <span className="text-sm font-medium text-emerald-600">
                                      {formatCurrency(fleetTrips.reduce((sum, t) => sum + (t.base_revenue || 0) + (t.additional_revenue || 0), 0))}
                                    </span>
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent className="mt-1">
                                  <div className="ml-10 border rounded-lg overflow-hidden bg-card">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-muted/40 border-b">
                                          <th className="text-left py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[80px]">POD</th>
                                          <th className="text-left py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Route</th>
                                          <th className="text-left py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                                          <th className="text-left py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                                          <th className="text-left py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[90px]">Date</th>
                                          <th className="text-right py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[80px]">Start KM</th>
                                          <th className="text-right py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[80px]">End KM</th>
                                          <th className="text-right py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[85px]">Distance</th>
                                          <th className="text-right py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Revenue</th>
                                          <th className="text-right py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Expenses</th>
                                          <th className="text-right py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[90px]">Profit</th>
                                          <th className="text-center py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[60px]"></th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50">
                                        {fleetTrips.map((trip) => {
                                          const profit = calculateProfit(trip);
                                          const isDuplicate = duplicatePods.some(d => d.pod === trip.trip_number);
                                          const needsAttention = trip.hasFlaggedCosts || trip.hasPendingCosts || trip.hasNoCosts;
                                          const noRevenue = !trip.base_revenue || trip.base_revenue === 0;
                                          const missingRevenue = noRevenue && !trip.zero_revenue_comment;
                                          const hasZeroRevenueComment = noRevenue && !!trip.zero_revenue_comment;
                                          const expenses = [...(trip.costs || []), ...(trip.additional_costs || [])].reduce((s, c) => s + (c.amount || 0), 0);

                                          return (
                                            <tr
                                              key={trip.id}
                                              className={`group transition-colors cursor-pointer ${isDuplicate ? 'bg-destructive/5 hover:bg-destructive/10' :
                                                missingRevenue ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                                                  needsAttention ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                                                    'hover:bg-muted/40'
                                                }`}
                                              onClick={() => onView(trip)}
                                            >
                                              <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-semibold text-primary tabular-nums">{trip.trip_number}</span>
                                                  {isDuplicate && (
                                                    <Tooltip>
                                                      <TooltipTrigger><AlertTriangle className="h-3 w-3 text-destructive shrink-0" /></TooltipTrigger>
                                                      <TooltipContent><p>Duplicate POD</p></TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <span className="font-medium truncate max-w-[180px]">{trip.route || '—'}</span>
                                                  {missingRevenue && (
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5 shrink-0">
                                                          <DollarSign className="h-2.5 w-2.5" />No revenue
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>Base revenue not set</p></TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                  {hasZeroRevenueComment && (
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 rounded px-1 py-0.5 shrink-0">
                                                          <DollarSign className="h-2.5 w-2.5" />$0
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>Zero revenue: {trip.zero_revenue_comment}</p></TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                  {trip.hasFlaggedCosts && (
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5 shrink-0">
                                                          <AlertTriangle className="h-2.5 w-2.5" />{trip.flaggedCostCount}
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>{trip.flaggedCostCount} cost{trip.flaggedCostCount === 1 ? '' : 's'} flagged</p></TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                  {trip.hasPendingCosts && !trip.hasFlaggedCosts && (
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 rounded px-1 py-0.5 shrink-0">
                                                          <RefreshCw className="h-2.5 w-2.5" />{trip.pendingCostCount}
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>{trip.pendingCostCount} cost{trip.pendingCostCount === 1 ? '' : 's'} pending</p></TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                  {trip.hasNoCosts && !missingRevenue && (
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <span className="inline-flex items-center text-[10px] font-medium text-rose-700 bg-rose-100 rounded px-1 py-0.5 shrink-0">!</span>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>No costs recorded</p></TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{trip.driver_name || '—'}</td>
                                              <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="truncate">{trip.client_name || '—'}</span>
                                                  {trip.payment_status && (
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${trip.payment_status === 'paid' ? 'bg-emerald-500' :
                                                      trip.payment_status === 'partial' ? 'bg-amber-500' :
                                                        'bg-slate-400'
                                                      }`} title={trip.payment_status === 'paid' ? 'Paid' : trip.payment_status === 'partial' ? 'Partial' : 'Unpaid'} />
                                                  )}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-muted-foreground tabular-nums text-xs">
                                                {trip.departure_date ? format(parseISO(trip.departure_date), 'dd MMM') : '—'}
                                                {trip.daysInProgress && trip.daysInProgress > 7 && (
                                                  <span className={`ml-1 text-[10px] font-medium ${trip.daysInProgress > 14 ? 'text-amber-600' : 'text-blue-600'}`}>
                                                    {trip.daysInProgress}d
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground text-xs">
                                                <div className="flex items-center justify-end gap-1">
                                                  {trip.starting_km ? trip.starting_km.toLocaleString() : '—'}
                                                  {kmMismatches.has(trip.id) && (
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                                      </TooltipTrigger>
                                                      <TooltipContent side="left" className="max-w-xs">
                                                        <p className="font-medium">KM Mismatch</p>
                                                        <p className="text-xs">Previous trip {kmMismatches.get(trip.id)!.previousTripNumber} ended at {kmMismatches.get(trip.id)!.previousEndingKm.toLocaleString()} km. Gap: {kmMismatches.get(trip.id)!.gap > 0 ? '+' : ''}{kmMismatches.get(trip.id)!.gap.toLocaleString()} km</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground text-xs">
                                                {trip.ending_km ? trip.ending_km.toLocaleString() : '—'}
                                              </td>
                                              <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                                                {trip.distance_km ? `${trip.distance_km.toLocaleString()}` : '—'}
                                              </td>
                                              <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                                                {missingRevenue ? (
                                                  <div className="flex items-center justify-end gap-1">
                                                    <span className="text-amber-600">—</span>
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>No base revenue set</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </div>
                                                ) : hasZeroRevenueComment ? (
                                                  <Tooltip>
                                                    <TooltipTrigger>
                                                      <span className="text-blue-600">$0</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p className="font-medium">Zero revenue (acknowledged)</p>
                                                      <p className="text-xs">{trip.zero_revenue_comment}</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                ) : (
                                                  <span className="text-emerald-600">{formatCurrency((trip.base_revenue || 0) + (trip.additional_revenue || 0), trip.revenue_currency)}</span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-right tabular-nums font-medium text-rose-600">
                                                {expenses > 0 ? formatCurrency(expenses) : '—'}
                                              </td>
                                              <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${profit?.amount && profit.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                                }`}>
                                                {profit ? formatCurrency(profit.amount, profit.currency) : '—'}
                                              </td>
                                              <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => onView(trip)} className="gap-2 text-xs">
                                                      <Eye className="h-3.5 w-3.5" /> View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() => handleEdit(trip)}
                                                      className="gap-2 text-xs"
                                                      disabled={isResolvingAlert[trip.id]}
                                                    >
                                                      <Edit className="h-3.5 w-3.5" />
                                                      {isResolvingAlert[trip.id] ? 'Resolving Alert...' : 'Edit Trip'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleDelete(trip.id)} className="gap-2 text-xs text-destructive">
                                                      <Trash2 className="h-3.5 w-3.5" /> Delete
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          });
                      })()}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Trip List - List View */}
        {!isLoading && viewMode === 'list' && filteredTrips.length > 0 && (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">POD</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fleet</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Route</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Start KM</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">End KM</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Distance</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Expenses</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Profit</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {[...filteredTrips].sort((a, b) => {
                    const numA = Number(a.trip_number);
                    const numB = Number(b.trip_number);
                    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
                    return b.trip_number.localeCompare(a.trip_number, undefined, { numeric: true });
                  }).map((trip) => {
                    const profit = calculateProfit(trip);
                    const isDuplicate = duplicatePods.some(d => d.pod === trip.trip_number);
                    const needsAttention = trip.hasFlaggedCosts || trip.hasPendingCosts || trip.hasNoCosts;
                    const noRevenue = !trip.base_revenue || trip.base_revenue === 0;
                    const missingRevenue = noRevenue && !trip.zero_revenue_comment;
                    const hasZeroRevenueComment = noRevenue && !!trip.zero_revenue_comment;
                    const expenses = [...(trip.costs || []), ...(trip.additional_costs || [])].reduce((s, c) => s + (c.amount || 0), 0);
                    return (
                      <tr
                        key={trip.id}
                        className={`group transition-colors cursor-pointer ${isDuplicate ? 'bg-destructive/5 hover:bg-destructive/10' :
                          missingRevenue ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                            needsAttention ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                              'hover:bg-muted/40'
                          }`}
                        onClick={() => onView(trip)}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-primary tabular-nums">{trip.trip_number}</span>
                            {isDuplicate && <AlertTriangle className="h-3 w-3 text-destructive" />}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs text-muted-foreground">{trip.fleet_number || '—'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{trip.driver_name || '—'}</td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{trip.client_name || '—'}</span>
                            {trip.payment_status && (
                              <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${trip.payment_status === 'paid' ? 'bg-emerald-500' :
                                trip.payment_status === 'partial' ? 'bg-amber-500' : 'bg-slate-400'
                                }`} title={trip.payment_status === 'paid' ? 'Paid' : trip.payment_status === 'partial' ? 'Partial' : 'Unpaid'} />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate max-w-[150px]">{trip.route || '—'}</span>
                            {missingRevenue && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5 shrink-0">
                                <DollarSign className="h-2.5 w-2.5" />No revenue
                              </span>
                            )}
                            {hasZeroRevenueComment && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 rounded px-1 py-0.5 shrink-0">
                                    <DollarSign className="h-2.5 w-2.5" />$0
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>Zero revenue: {trip.zero_revenue_comment}</p></TooltipContent>
                              </Tooltip>
                            )}
                            {trip.hasFlaggedCosts && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5 shrink-0">
                                <AlertTriangle className="h-2.5 w-2.5" />{trip.flaggedCostCount}
                              </span>
                            )}
                            {trip.hasNoCosts && !missingRevenue && (
                              <span className="inline-flex items-center text-[10px] font-medium text-rose-700 bg-rose-100 rounded px-1 py-0.5 shrink-0">!</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground tabular-nums text-xs">
                          {trip.departure_date ? format(parseISO(trip.departure_date), 'dd MMM') : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground text-xs">
                          <div className="flex items-center justify-end gap-1">
                            {trip.starting_km ? trip.starting_km.toLocaleString() : '—'}
                            {kmMismatches.has(trip.id) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <p className="font-medium">KM Mismatch</p>
                                  <p className="text-xs">Previous trip {kmMismatches.get(trip.id)!.previousTripNumber} ended at {kmMismatches.get(trip.id)!.previousEndingKm.toLocaleString()} km. Gap: {kmMismatches.get(trip.id)!.gap > 0 ? '+' : ''}{kmMismatches.get(trip.id)!.gap.toLocaleString()} km</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground text-xs">
                          {trip.ending_km ? trip.ending_km.toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                          {trip.distance_km ? `${trip.distance_km.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                          {missingRevenue ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-amber-600">—</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>No base revenue set</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : hasZeroRevenueComment ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="text-blue-600">$0</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Zero revenue (acknowledged)</p>
                                <p className="text-xs">{trip.zero_revenue_comment}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-emerald-600">{formatCurrency((trip.base_revenue || 0) + (trip.additional_revenue || 0), trip.revenue_currency)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium text-rose-600">
                          {expenses > 0 ? formatCurrency(expenses) : '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${profit?.amount && profit.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                          {profit ? formatCurrency(profit.amount, profit.currency) : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => onView(trip)} className="gap-2 text-xs">
                                <Eye className="h-3.5 w-3.5" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEdit(trip)}
                                className="gap-2 text-xs"
                                disabled={isResolvingAlert[trip.id]}
                              >
                                <Edit className="h-3.5 w-3.5" />
                                {isResolvingAlert[trip.id] ? 'Resolving Alert...' : 'Edit Trip'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(trip.id)} className="gap-2 text-xs text-destructive">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Export Dialog */}
        <TripExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          trips={trips}
          tripType="active"
        />
      </div>
    </TooltipProvider >
  );
};

export default ActiveTrips;