import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CostEntry, Trip } from '@/types/operations';
import
  {
    endOfWeek,
    format,
    getISOWeek,
    getISOWeekYear,
    parseISO,
    startOfWeek,
    subWeeks,
  } from 'date-fns';
import { Calendar, ChevronDown, ChevronRight, TrendingUp, Truck } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// Depot configuration with trucks
const DEPOT_CONFIG = {
  '30_ton': {
    name: '30 Ton Trucks',
    trucks: ['21H', '22H', '23H', '24H', '26H', '28H', '31H', '32H', '34H'],
    color: 'blue',
  },
  lmv: {
    name: 'LMV',
    trucks: ['UD', '4H', '6H'],
    color: 'emerald',
  },
  bulawayo: {
    name: 'Bulawayo',
    trucks: ['29H'],
    color: 'purple',
  },
  nyamagay: {
    name: 'Nyamagay',
    trucks: ['30H'],
    color: 'orange',
  },
} as const;

// Display name mapping for trucks with aliases (if any needed)
const TRUCK_DISPLAY_NAMES: Record<string, string> = {
  // Add any display name overrides here
};

// Helper to get display name for a truck
const getTruckDisplayName = (fleetNumber: string): string => {
  return TRUCK_DISPLAY_NAMES[fleetNumber] || fleetNumber;
};

type DepotKey = keyof typeof DEPOT_CONFIG;

interface CurrencyAmounts {
  USD: number;
}

interface TruckWeeklySummary {
  weekKey: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  tripCount: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
  totalKm: number;
}

interface TruckSummary {
  fleetNumber: string;
  tripCount: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
  totalKm: number;
  weeklySummaries: TruckWeeklySummary[];
}

interface TruckReportsTabProps {
  trips: Trip[];
  costEntries: CostEntry[];
}

// Helper to display currency amounts with modern styling
const CurrencyDisplay = ({
  amounts,
  type = 'default',
  size = 'default',
}: {
  amounts: CurrencyAmounts;
  type?: 'revenue' | 'expense' | 'profit' | 'default';
  size?: 'default' | 'lg';
}) => {
  const hasAmount = amounts.USD !== 0;
  const hasUSD = amounts.USD !== 0;

  if (!hasAmount && !hasUSD) {
    return <span className="text-muted-foreground/60 text-sm italic">No data</span>;
  }

  const getColorClass = (value: number) => {
    if (type === 'revenue') return 'text-emerald-600 dark:text-emerald-400';
    if (type === 'expense') return 'text-rose-600 dark:text-rose-400';
    if (type === 'profit') return value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
    return 'text-foreground';
  };

  const sizeClass = size === 'lg' ? 'text-base font-bold' : 'text-sm font-semibold';

  return (
    <div className={cn(sizeClass, 'tracking-tight tabular-nums', getColorClass(amounts.USD))}>
      {formatCurrency(amounts.USD)}
    </div>
  );
};

// Get current week key for default selection
const getCurrentWeekKey = () => {
  const now = new Date();
  const weekNumber = getISOWeek(now);
  const year = getISOWeekYear(now);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
};

// Generate week options for dropdown (last 12 weeks)
const getWeekOptions = () => {
  const options: { value: string; label: string; shortLabel: string; weekNumber: number; year: number }[] = [
    { value: 'all', label: 'All Time', shortLabel: 'All', weekNumber: 0, year: 0 },
  ];

  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = subWeeks(now, i);
    const weekNumber = getISOWeek(date);
    const year = getISOWeekYear(date);
    const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;

    const isCurrentWeek = i === 0;
    const label = isCurrentWeek
      ? `This Week (W${weekNumber})`
      : `Week ${weekNumber}`;

    options.push({
      value: weekKey,
      label,
      shortLabel: `W${weekNumber}`,
      weekNumber,
      year,
    });
  }

  return options;
};

const TruckReportsTab = ({ trips, costEntries }: TruckReportsTabProps) => {
  // Expanded depots state
  const [expandedDepots, setExpandedDepots] = useState<Set<DepotKey>>(new Set(['30_ton']));
  // Week filter per truck (key = fleet number)
  const [truckWeekFilters, setTruckWeekFilters] = useState<Record<string, string>>({});

  const weekOptions = useMemo(() => getWeekOptions(), []);

  const toggleDepot = (depotKey: DepotKey) => {
    setExpandedDepots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(depotKey)) {
        newSet.delete(depotKey);
      } else {
        newSet.add(depotKey);
      }
      return newSet;
    });
  };

  const setTruckWeekFilter = (fleetNumber: string, weekKey: string) => {
    setTruckWeekFilters((prev) => ({
      ...prev,
      [fleetNumber]: weekKey,
    }));
  };

  // Calculate costs for each trip by currency
  const getTripCostsByCurrency = useCallback(
    (tripId: string): CurrencyAmounts => {
      const tripCosts = costEntries.filter((cost) => cost.trip_id === tripId);
      return {
        USD: tripCosts
          .reduce((sum, cost) => sum + Number(cost.amount || 0), 0),
      };
    },
    [costEntries]
  );

  // Get trips by fleet number with weekly breakdown
  const truckSummaries = useMemo(() => {
    const summariesMap = new Map<string, TruckSummary>();

    // Get all trucks from config
    Object.values(DEPOT_CONFIG).forEach((depot) => {
      depot.trucks.forEach((truck) => {
        summariesMap.set(truck, {
          fleetNumber: truck,
          tripCount: 0,
          revenue: { USD: 0 },
          expenses: { USD: 0 },
          profit: { USD: 0 },
          totalKm: 0,
          weeklySummaries: [],
        });
      });
    });

    // Group trips by truck and week
    const weeklyMap = new Map<string, Map<string, TruckWeeklySummary>>();

    trips.forEach((trip) => {
      // Normalize fleet_number - handle various formats like "21H", "21h", etc.
      // Fix: Handle trips from the database which may have fleet_number with different casing
      const fleetNumber = ((trip as Trip & { fleet_number?: string }).fleet_number || '')
        .toUpperCase()
        .trim();
      if (!fleetNumber) return;

      // Check if this truck is in our config
      const isInConfig = Object.values(DEPOT_CONFIG).some((depot) =>
        (depot.trucks as readonly string[]).includes(fleetNumber)
      );
      if (!isInConfig) return;

      const dateToUse = trip.arrival_date || trip.departure_date;
      if (!dateToUse) return;

      const date = parseISO(dateToUse);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(date);
      const year = getISOWeekYear(date);
      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;

      // Get or create truck's weekly map
      if (!weeklyMap.has(fleetNumber)) {
        weeklyMap.set(fleetNumber, new Map());
      }
      const truckWeeklyMap = weeklyMap.get(fleetNumber)!;

      // Get or create week summary
      const existing = truckWeeklyMap.get(weekKey) || {
        weekKey,
        weekNumber,
        year,
        startDate: format(weekStart, 'dd MMM'),
        endDate: format(weekEnd, 'dd MMM yyyy'),
        tripCount: 0,
        revenue: { USD: 0 },
        expenses: { USD: 0 },
        profit: { USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as string;
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;

      truckWeeklyMap.set(weekKey, existing);

      // Update overall truck summary
      const summary = summariesMap.get(fleetNumber)!;
      summary.tripCount += 1;
      summary.revenue[tripCurrency] += revenue;
      summary.expenses.USD += tripCosts.USD;
      summary.profit.USD = summary.revenue.USD - summary.expenses.USD;
      summary.totalKm += trip.distance_km || 0;
    });

    // Attach weekly summaries to each truck
    summariesMap.forEach((summary, fleetNumber) => {
      const truckWeeklyMap = weeklyMap.get(fleetNumber);
      if (truckWeeklyMap) {
        summary.weeklySummaries = Array.from(truckWeeklyMap.values()).sort((a, b) =>
          b.weekKey.localeCompare(a.weekKey)
        );
      }
    });

    return summariesMap;
  }, [trips, getTripCostsByCurrency]);

  // Get filtered data for a depot
  const getDepotData = useCallback(
    (depotKey: DepotKey) => {
      const depot = DEPOT_CONFIG[depotKey];

      const trucksData = depot.trucks.map((truck) => {
        const summary = truckSummaries.get(truck);
        // Default to current week instead of 'all'
        const weekFilter = truckWeekFilters[truck] || 'all';

        if (!summary) {
          return {
            fleetNumber: truck,
            tripCount: 0,
            revenue: { USD: 0 },
            expenses: { USD: 0 },
            profit: { USD: 0 },
            totalKm: 0,
            filteredWeeklySummaries: [],
            selectedWeek: weekFilter,
          };
        }

        // Filter weekly summaries if a specific week is selected
        const filteredWeeklySummaries =
          weekFilter === 'all'
            ? summary.weeklySummaries
            : summary.weeklySummaries.filter((w) => w.weekKey === weekFilter);

        // Calculate filtered totals
        if (weekFilter === 'all') {
          return {
            ...summary,
            filteredWeeklySummaries,
            selectedWeek: weekFilter,
          };
        }

        // Sum up only filtered weeks
        const filteredRevenue = { USD: 0 };
        const filteredExpenses = { USD: 0 };
        let filteredTrips = 0;
        let filteredKm = 0;

        filteredWeeklySummaries.forEach((w) => {
          filteredRevenue.USD += w.revenue.USD;
          filteredExpenses.USD += w.expenses.USD;
          filteredTrips += w.tripCount;
          filteredKm += w.totalKm;
        });

        return {
          fleetNumber: truck,
          tripCount: filteredTrips,
          revenue: filteredRevenue,
          expenses: filteredExpenses,
          profit: {
            USD: filteredRevenue.USD - filteredExpenses.USD,
          },
          totalKm: filteredKm,
          filteredWeeklySummaries,
          selectedWeek: weekFilter,
        };
      });

      // Calculate depot totals
      const depotTotals = trucksData.reduce(
        (acc, truck) => ({
          tripCount: acc.tripCount + truck.tripCount,
          revenue: {
            USD: acc.revenue.USD + truck.revenue.USD,
          },
          expenses: {
            USD: acc.expenses.USD + truck.expenses.USD,
          },
          profit: {
            USD: acc.profit.USD + truck.profit.USD,
          },
          totalKm: acc.totalKm + truck.totalKm,
        }),
        {
          tripCount: 0,
          revenue: { USD: 0 },
          expenses: { USD: 0 },
          profit: { USD: 0 },
          totalKm: 0,
        }
      );

      return { trucksData, depotTotals };
    },
    [truckSummaries, truckWeekFilters]
  );

  const getDepotColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20',
          border: 'border-blue-200/60 dark:border-blue-800/40',
          icon: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
          badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50',
          ring: 'ring-blue-500/20',
        };
      case 'emerald':
        return {
          bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20',
          border: 'border-emerald-200/60 dark:border-emerald-800/40',
          icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-700/50',
          ring: 'ring-emerald-500/20',
        };
      case 'purple':
        return {
          bg: 'bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20',
          border: 'border-purple-200/60 dark:border-purple-800/40',
          icon: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/50 dark:border-purple-700/50',
          ring: 'ring-purple-500/20',
        };
      case 'orange':
        return {
          bg: 'bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20',
          border: 'border-orange-200/60 dark:border-orange-800/40',
          icon: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
          badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200/50 dark:border-orange-700/50',
          ring: 'ring-orange-500/20',
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/20',
          border: 'border-slate-200/60 dark:border-slate-800/40',
          icon: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
          badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50',
          ring: 'ring-slate-500/20',
        };
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20">
        <CardContent className="space-y-4 pt-6">
          {(Object.keys(DEPOT_CONFIG) as DepotKey[]).map((depotKey) => {
            const depot = DEPOT_CONFIG[depotKey];
            const colors = getDepotColorClasses(depot.color);
            const { trucksData, depotTotals } = getDepotData(depotKey);
            const isExpanded = expandedDepots.has(depotKey);

            return (
              <Collapsible
                key={depotKey}
                open={isExpanded}
                onOpenChange={() => toggleDepot(depotKey)}
              >
                <Card className={cn('border shadow-sm overflow-hidden transition-all duration-200', colors.border, isExpanded && colors.ring && 'ring-1 ' + colors.ring)}>
                  <CollapsibleTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center justify-between p-5 cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110 transition-all duration-200',
                        colors.bg
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'h-11 w-11 rounded-xl flex items-center justify-center shadow-sm',
                            colors.icon
                          )}
                        >
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base tracking-tight">{depot.name}</h3>
                          <p className="text-sm text-muted-foreground/80 font-medium">
                            {depot.trucks.length} trucks • {depotTotals.tripCount.toLocaleString()} trips
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-200',
                          'bg-background/50 border shadow-sm',
                          isExpanded && 'rotate-0'
                        )}>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="p-4 border-t space-y-4">
                      {/* Individual Trucks */}
                      <div className="space-y-3">
                        {trucksData.map((truck) => {
                          const hasData = truck.tripCount > 0;
                          const profitMargin =
                            truck.revenue.USD > 0
                              ? (truck.profit.USD / truck.revenue.USD) * 100
                              : 0;

                          return (
                            <div
                              key={truck.fleetNumber}
                              className={cn(
                                'group p-5 rounded-xl border bg-card/50 backdrop-blur-sm transition-all duration-200',
                                hasData
                                  ? 'hover:shadow-md hover:border-primary/20 hover:bg-card'
                                  : 'opacity-50 grayscale-[30%]'
                              )}
                            >
                              {/* Truck header with week dropdown */}
                              <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'px-3 py-1.5 text-sm font-bold tracking-wide border shadow-sm',
                                        colors.badge
                                      )}
                                    >
                                      {getTruckDisplayName(truck.fleetNumber)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs font-medium">
                                      {truck.tripCount} trips
                                    </Badge>
                                  </div>

                                  {/* Per-truck week filter - Modern professional styling */}
                                  <Select
                                    value={truck.selectedWeek}
                                    onValueChange={(value) => setTruckWeekFilter(truck.fleetNumber, value)}
                                  >
                                    <SelectTrigger className="w-[160px] h-10 px-3 text-sm font-semibold rounded-lg bg-gradient-to-r from-background to-muted/30 border-2 border-primary/20 hover:border-primary/50 hover:shadow-md shadow-sm transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary/60">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-primary/70" />
                                        <SelectValue placeholder="Select week" />
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent
                                      align="end"
                                      className="w-[180px] rounded-xl border-2 border-primary/20 shadow-xl bg-background/98 backdrop-blur-lg"
                                    >
                                      <div className="p-1">
                                        {weekOptions.map((option, index) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                            className={cn(
                                              "text-sm cursor-pointer rounded-lg my-0.5 px-3 py-2.5 transition-all duration-150",
                                              "hover:bg-primary/10 focus:bg-primary/15",
                                              option.value === getCurrentWeekKey() && "bg-primary/5 font-bold",
                                              index === 0 && "border-b border-muted mb-1 pb-2"
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              {option.value === getCurrentWeekKey() && (
                                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                              )}
                                              <span className={cn(
                                                "font-medium",
                                                option.value === getCurrentWeekKey() && "text-primary"
                                              )}>
                                                {option.label}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </div>
                                    </SelectContent>
                                  </Select>
                                </div>


                              </div>

                              {/* Profit margin progress bar - Modern styling */}
                              {hasData && truck.revenue.USD > 0 && (
                                <div className="mt-4 pt-4 border-t border-muted/50">
                                  <div className="flex justify-between items-center text-xs mb-2">
                                    <span className="text-muted-foreground/70 font-medium flex items-center gap-1.5">
                                      <TrendingUp className="h-3 w-3" />
                                      Profit Margin
                                    </span>
                                    <span className={cn(
                                      'font-bold tabular-nums',
                                      profitMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                    )}>
                                      {profitMargin.toFixed(1)}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={Math.min(100, Math.max(0, profitMargin))}
                                    className={cn(
                                      'h-2 rounded-full',
                                      truck.profit.USD >= 0
                                        ? '[&>div]:bg-emerald-500'
                                        : '[&>div]:bg-orange-500'
                                    )}
                                  />
                                </div>
                              )}

                              {/* Weekly breakdown */}
                              {truck.filteredWeeklySummaries.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {truck.filteredWeeklySummaries.map((week) => (
                                      <div
                                        key={week.weekKey}
                                        className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 text-sm p-3 rounded-lg bg-muted/30 border border-muted/40"
                                      >
                                        <div>
                                          <span className="font-semibold text-xs">W{week.weekNumber}</span>
                                          <span className="text-muted-foreground text-xs ml-1.5">
                                            {week.startDate} – {week.endDate}
                                          </span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-medium">
                                          {week.tripCount} trips
                                        </Badge>
                                        <div className="text-right min-w-[70px]">
                                          <p className="text-[9px] uppercase text-muted-foreground/60">KM</p>
                                          <p className="text-xs font-bold tabular-nums text-primary">{week.totalKm.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right min-w-[80px]">
                                          <p className="text-[9px] uppercase text-muted-foreground/60">Revenue</p>
                                          <CurrencyDisplay amounts={week.revenue} type="revenue" />
                                        </div>
                                        <div className="text-right min-w-[80px]">
                                          <p className="text-[9px] uppercase text-muted-foreground/60">Expenses</p>
                                          <CurrencyDisplay amounts={week.expenses} type="expense" />
                                        </div>
                                        <div className="text-right min-w-[80px]">
                                          <p className="text-[9px] uppercase text-muted-foreground/60">Profit</p>
                                          <CurrencyDisplay amounts={week.profit} type="profit" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default TruckReportsTab;