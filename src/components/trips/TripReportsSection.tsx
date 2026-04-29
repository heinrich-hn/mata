import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CostEntry, Trip } from '@/types/operations';
import { ADDITIONAL_REVENUE_REASONS } from '@/constants/additionalRevenueReasons';
import {
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  getYear,
  parseISO,
  startOfWeek,
  subMonths,
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart3,
  Building,
  BadgeCheck,
  Calendar,
  CalendarRange,
  CircleAlert,
  DollarSign,
  Download,
  FileText,
  MapPin,
  Receipt,
  TrendingDown,
  TrendingUp,
  Truck,
  User
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import TruckReportsTab from './TruckReportsTab';
import ReportExportToolbar from './ReportExportToolbar';
import {
  generateReportExcel,
  generateReportPDF,
  type ReportSpec,
} from '@/lib/tripReportExports';

const fmtUsd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface TripReportsSectionProps {
  trips: Trip[];
  costEntries: CostEntry[];
}

interface CurrencyAmounts {
  USD: number;
}

interface WeeklySummary {
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

interface MonthlySummary {
  monthKey: string;
  monthName: string;
  year: number;
  tripCount: number;
  completedTrips: number;
  activeTrips: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
  totalKm: number;
}

interface DriverSummary {
  driverName: string;
  tripCount: number;
  completedTrips: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
  totalKm: number;
}

interface ClientSummary {
  clientName: string;
  tripCount: number;
  completedTrips: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
  totalKm: number;
  emptyKm: number;
  lastTripDate: string;
}

interface RouteSummary {
  route: string;
  origin: string;
  destination: string;
  tripCount: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
}

interface TruckSummary {
  fleetNumber: string;
  tripCount: number;
  revenue: CurrencyAmounts;
  expenses: CurrencyAmounts;
  profit: CurrencyAmounts;
  totalKm: number;
}

// Helper to display currency amounts
const CurrencyDisplay = ({ amounts, type = 'default' }: { amounts: CurrencyAmounts; type?: 'revenue' | 'expense' | 'profit' | 'default' }) => {
  if (amounts.USD === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const getColorClass = (value: number) => {
    if (type === 'revenue') return 'text-green-600';
    if (type === 'expense') return 'text-red-600';
    if (type === 'profit') return value >= 0 ? 'text-emerald-600' : 'text-orange-600';
    return '';
  };

  return (
    <div className={cn('font-semibold', getColorClass(amounts.USD))}>
      {formatCurrency(amounts.USD)}
    </div>
  );
};

const TripReportsSection = ({ trips, costEntries }: TripReportsSectionProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3months');
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
  const [customFrom, setCustomFrom] = useState(thirtyDaysAgo);
  const [customTo, setCustomTo] = useState(today);
  const { toast } = useToast();

  // Human-readable period label for exports
  const periodLabel = selectedPeriod === 'custom'
    ? `${customFrom} to ${customTo}`
    : selectedPeriod;

  // Filter trips by period
  const filteredTrips = useMemo(() => {
    const now = new Date();

    // Custom date range
    if (selectedPeriod === 'custom') {
      const from = parseISO(customFrom);
      const to = parseISO(customTo);
      return trips.filter(trip => {
        const tripDate = trip.departure_date ? parseISO(trip.departure_date) : null;
        return tripDate && tripDate >= from && tripDate <= to;
      });
    }

    let startDate: Date;

    switch (selectedPeriod) {
      case '1month':
        startDate = subMonths(now, 1);
        break;
      case '3months':
        startDate = subMonths(now, 3);
        break;
      case '6months':
        startDate = subMonths(now, 6);
        break;
      case '1year':
        startDate = subMonths(now, 12);
        break;
      case 'all':
      default:
        return trips;
    }

    return trips.filter(trip => {
      const tripDate = trip.departure_date ? parseISO(trip.departure_date) : null;
      return tripDate && tripDate >= startDate;
    });
  }, [trips, selectedPeriod, customFrom, customTo]);

  // Calculate costs for each trip by currency
  const getTripCostsByCurrency = useCallback((tripId: string): CurrencyAmounts => {
    const tripCosts = costEntries.filter(cost => cost.trip_id === tripId);
    return {
      USD: tripCosts
        .reduce((sum, cost) => sum + Number(cost.amount || 0), 0),
    };
  }, [costEntries]);

  // Overall Summary Stats
  const overallStats = useMemo(() => {
    const revenue = filteredTrips
      .reduce((sum, t) => sum + (t.base_revenue || 0), 0);

    let expenses = 0;
    filteredTrips.forEach(t => {
      const costs = getTripCostsByCurrency(t.id);
      expenses += costs.USD;
    });

    const profit = revenue - expenses;
    const totalKm = filteredTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
    const completedTrips = filteredTrips.filter(t => t.status === 'completed').length;

    return {
      totalTrips: filteredTrips.length,
      completedTrips,
      activeTrips: filteredTrips.length - completedTrips,
      revenue: { USD: revenue },
      expenses: { USD: expenses },
      profit: { USD: profit },
      totalKm,
      hasUSD: revenue > 0 || expenses > 0,
    };
  }, [filteredTrips, getTripCostsByCurrency]);

  // Weekly Summary - uses arrival_date (offloading date) for grouping, fallback to departure_date
  const weeklySummaries = useMemo(() => {
    const weekMap = new Map<string, WeeklySummary>();

    filteredTrips.forEach(trip => {
      const dateToUse = trip.arrival_date || trip.departure_date;
      if (!dateToUse) return;

      const date = parseISO(dateToUse);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(date);
      const year = getISOWeekYear(date);
      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;

      const existing = weekMap.get(weekKey) || {
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

      weekMap.set(weekKey, existing);
    });

    return Array.from(weekMap.values()).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  }, [filteredTrips, getTripCostsByCurrency]);

  // Monthly Summary - uses arrival_date (offloading date) for grouping, fallback to departure_date
  const monthlySummaries = useMemo(() => {
    const monthMap = new Map<string, MonthlySummary>();

    filteredTrips.forEach(trip => {
      const dateToUse = trip.arrival_date || trip.departure_date;
      if (!dateToUse) return;

      const date = parseISO(dateToUse);
      const monthKey = format(date, 'yyyy-MM');
      const monthName = format(date, 'MMMM');
      const year = getYear(date);

      const existing = monthMap.get(monthKey) || {
        monthKey,
        monthName,
        year,
        tripCount: 0,
        completedTrips: 0,
        activeTrips: 0,
        revenue: { USD: 0 },
        expenses: { USD: 0 },
        profit: { USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as string;
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      if (trip.status === 'completed') existing.completedTrips += 1;
      else existing.activeTrips += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;

      monthMap.set(monthKey, existing);
    });

    return Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredTrips, getTripCostsByCurrency]);

  // Driver Performance Summary
  const driverSummaries = useMemo(() => {
    const driverMap = new Map<string, DriverSummary>();

    filteredTrips.forEach(trip => {
      const driverName = trip.driver_name || 'Unassigned';

      const existing = driverMap.get(driverName) || {
        driverName,
        tripCount: 0,
        completedTrips: 0,
        revenue: { USD: 0 },
        expenses: { USD: 0 },
        profit: { USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as string;
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      if (trip.status === 'completed') existing.completedTrips += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;

      driverMap.set(driverName, existing);
    });

    return Array.from(driverMap.values()).sort((a, b) => b.revenue.USD - a.revenue.USD);
  }, [filteredTrips, getTripCostsByCurrency]);

  // Client Revenue Summary
  const clientSummaries = useMemo(() => {
    const clientMap = new Map<string, ClientSummary>();

    filteredTrips.forEach(trip => {
      const clientName = trip.client_name || 'No Client';

      const existing = clientMap.get(clientName) || {
        clientName,
        tripCount: 0,
        completedTrips: 0,
        revenue: { USD: 0 },
        expenses: { USD: 0 },
        profit: { USD: 0 },
        totalKm: 0,
        emptyKm: 0,
        lastTripDate: '',
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as string;
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      if (trip.status === 'completed') existing.completedTrips += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;
      existing.emptyKm += trip.empty_km || 0;

      if (trip.departure_date && (!existing.lastTripDate || trip.departure_date > existing.lastTripDate)) {
        existing.lastTripDate = trip.departure_date;
      }

      clientMap.set(clientName, existing);
    });

    return Array.from(clientMap.values()).sort((a, b) => b.revenue.USD - a.revenue.USD);
  }, [filteredTrips, getTripCostsByCurrency]);

  // Route Summary
  const routeSummaries = useMemo(() => {
    const routeMap = new Map<string, RouteSummary>();

    filteredTrips.forEach(trip => {
      if (!trip.origin || !trip.destination) return;

      const routeKey = `${trip.origin} → ${trip.destination}`;

      const existing = routeMap.get(routeKey) || {
        route: routeKey,
        origin: trip.origin,
        destination: trip.destination,
        tripCount: 0,
        revenue: { USD: 0 },
        expenses: { USD: 0 },
        profit: { USD: 0 },
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as string;
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;

      routeMap.set(routeKey, existing);
    });

    return Array.from(routeMap.values()).sort((a, b) => b.tripCount - a.tripCount);
  }, [filteredTrips, getTripCostsByCurrency]);

  // Truck Summary - grouped by fleet number only
  const truckSummaries = useMemo(() => {
    const truckMap = new Map<string, TruckSummary>();

    filteredTrips.forEach(trip => {
      // Access fleet_number from trip (may not be in type but comes from DB)
      const fleetNumber = ((trip as Trip & { fleet_number?: string }).fleet_number || '').toUpperCase().trim();
      if (!fleetNumber) return;

      const existing = truckMap.get(fleetNumber) || {
        fleetNumber,
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

      truckMap.set(fleetNumber, existing);
    });

    return Array.from(truckMap.values()).sort((a, b) => b.revenue.USD - a.revenue.USD);
  }, [filteredTrips, getTripCostsByCurrency]);

  // Revenue Types Summary — classifies ALL trips with revenue by tick status.
  // Ticked = "Real Money"; unticked = "Funny Money".
  // The reason breakdown still groups trips that have additional (third-party) revenue by reason.
  const revenueTypeSummaries = useMemo(() => {
    type Bucket = {
      reason: string;
      label: string;
      tripCount: number;
      realCount: number;
      funnyCount: number;
      realAmount: number;
      funnyAmount: number;
      totalAmount: number;
    };

    const labelByValue = new Map<string, string>(
      ADDITIONAL_REVENUE_REASONS.map(r => [r.value as string, r.label])
    );
    const buckets = new Map<string, Bucket>();
    const funnyMoneyTrips: Array<{
      id: string;
      trip_number: string;
      driver_name: string;
      client_name: string;
      route: string;
      reason: string;
      reasonLabel: string;
      baseRevenue: number;
      additionalRevenue: number;
      totalRevenue: number;
      currency: string;
      date: string;
      status: string;
    }> = [];

    // Headline totals across ALL trips that have any revenue
    let totalRevenueAll = 0;
    let realMoneyAmount = 0;
    let funnyMoneyAmount = 0;
    let realTripCount = 0;
    let funnyTripCount = 0;
    let realMoneyKm = 0;
    let funnyMoneyKm = 0;

    // For the by-reason breakdown (only trips with additional revenue > 0)
    let additionalTotal = 0;
    let additionalReal = 0;
    let additionalFunny = 0;

    filteredTrips.forEach(trip => {
      const baseRev = Number(trip.base_revenue || 0);
      const addRev = Number(trip.additional_revenue || 0);
      const totalRev = baseRev + addRev;
      const tripKm = Number(trip.distance_km || 0);
      const isReal = !!trip.additional_revenue_verified;

      if (totalRev > 0) {
        totalRevenueAll += totalRev;
        if (isReal) {
          realMoneyAmount += totalRev;
          realTripCount += 1;
          realMoneyKm += tripKm;
        } else {
          funnyMoneyAmount += totalRev;
          funnyTripCount += 1;
          funnyMoneyKm += tripKm;
          funnyMoneyTrips.push({
            id: trip.id,
            trip_number: trip.trip_number || '—',
            driver_name: trip.driver_name || '—',
            client_name: trip.client_name || '—',
            route: trip.route || `${trip.origin || ''}${trip.origin && trip.destination ? ' → ' : ''}${trip.destination || ''}` || '—',
            reason: trip.additional_revenue_reason || '',
            reasonLabel: trip.additional_revenue_reason
              ? (labelByValue.get(trip.additional_revenue_reason) || trip.additional_revenue_reason)
              : '—',
            baseRevenue: baseRev,
            additionalRevenue: addRev,
            totalRevenue: totalRev,
            currency: trip.revenue_currency || 'USD',
            date: trip.arrival_date || trip.departure_date || '',
            status: trip.status || 'active',
          });
        }
      }

      // Reason buckets only for trips that actually have additional revenue
      if (addRev > 0) {
        const reason = trip.additional_revenue_reason || 'unspecified';
        const label = labelByValue.get(reason) || (reason === 'unspecified' ? 'Unspecified' : reason);
        let bucket = buckets.get(reason);
        if (!bucket) {
          bucket = {
            reason,
            label,
            tripCount: 0,
            realCount: 0,
            funnyCount: 0,
            realAmount: 0,
            funnyAmount: 0,
            totalAmount: 0,
          };
          buckets.set(reason, bucket);
        }
        bucket.tripCount += 1;
        bucket.totalAmount += addRev;
        additionalTotal += addRev;
        if (isReal) {
          bucket.realCount += 1;
          bucket.realAmount += addRev;
          additionalReal += addRev;
        } else {
          bucket.funnyCount += 1;
          bucket.funnyAmount += addRev;
          additionalFunny += addRev;
        }
      }
    });

    const byReason = Array.from(buckets.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    funnyMoneyTrips.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const realPct = totalRevenueAll > 0 ? (realMoneyAmount / totalRevenueAll) * 100 : 0;
    const funnyPct = totalRevenueAll > 0 ? (funnyMoneyAmount / totalRevenueAll) * 100 : 0;

    return {
      byReason,
      funnyMoneyTrips,
      totals: {
        tripCount: realTripCount + funnyTripCount,
        realTripCount,
        funnyTripCount,
        totalRevenue: totalRevenueAll,
        realMoneyAmount,
        funnyMoneyAmount,
        realMoneyKm,
        funnyMoneyKm,
        totalKm: realMoneyKm + funnyMoneyKm,
        realPct,
        funnyPct,
        additionalTotal,
        additionalReal,
        additionalFunny,
      },
    };
  }, [filteredTrips]);

  // Expense summaries - group cost entries by category for filtered trips
  const expenseSummaries = useMemo(() => {
    const filteredTripIds = new Set(filteredTrips.map(t => t.id));
    const filteredCosts = costEntries.filter(c => filteredTripIds.has(c.trip_id));

    // Build trip → fleet_number lookup for vehicle grouping
    const tripFleetMap = new Map<string, string>();
    filteredTrips.forEach(t => {
      const fn = (t as Trip & { fleet_number?: string }).fleet_number;
      if (fn) tripFleetMap.set(t.id, fn);
    });

    // By category
    const categoryMap = new Map<string, { category: string; count: number; amounts: CurrencyAmounts }>();
    filteredCosts.forEach(cost => {
      const cat = cost.category || 'Uncategorized';
      const existing = categoryMap.get(cat) || { category: cat, count: 0, amounts: { USD: 0 } };
      existing.count += 1;
      const currency = (cost.currency || 'USD') as string;
      existing.amounts[currency] += Number(cost.amount || 0);
      categoryMap.set(cat, existing);
    });
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.amounts.USD - a.amounts.USD);

    // By sub-category (within each category)
    const subCatMap = new Map<string, { category: string; subCategory: string; count: number; amounts: CurrencyAmounts }>();
    filteredCosts.forEach(cost => {
      const cat = cost.category || 'Uncategorized';
      const sub = cost.sub_category || 'General';
      const key = `${cat}||${sub}`;
      const existing = subCatMap.get(key) || { category: cat, subCategory: sub, count: 0, amounts: { USD: 0 } };
      existing.count += 1;
      const currency = (cost.currency || 'USD') as string;
      existing.amounts[currency] += Number(cost.amount || 0);
      subCatMap.set(key, existing);
    });
    const bySubCategory = Array.from(subCatMap.values()).sort((a, b) => b.amounts.USD - a.amounts.USD);

    // By vehicle — prefer trip's fleet_number, fall back to cost.vehicle_identifier
    const vehicleMap = new Map<string, { vehicle: string; count: number; amounts: CurrencyAmounts }>();
    filteredCosts.forEach(cost => {
      const vehicle = (cost.trip_id && tripFleetMap.get(cost.trip_id)) || cost.vehicle_identifier || 'Unknown';
      const existing = vehicleMap.get(vehicle) || { vehicle, count: 0, amounts: { USD: 0 } };
      existing.count += 1;
      const currency = (cost.currency || 'USD') as string;
      existing.amounts[currency] += Number(cost.amount || 0);
      vehicleMap.set(vehicle, existing);
    });
    const byVehicle = Array.from(vehicleMap.values()).sort((a, b) => b.amounts.USD - a.amounts.USD);

    // Totals
    const totals: CurrencyAmounts = { USD: 0 };
    filteredCosts.forEach(cost => {
      const currency = (cost.currency || 'USD') as string;
      totals[currency] += Number(cost.amount || 0);
    });

    return { byCategory, bySubCategory, byVehicle, totals, totalEntries: filteredCosts.length, rawCosts: filteredCosts };
  }, [filteredTrips, costEntries]);

  // ──────────────────────────────────────────────────────────────────────
  // Per-tab export builders (each report individually exportable to PDF/Excel)
  // ──────────────────────────────────────────────────────────────────────
  // Effective default From/To used to seed the per-tab toolbars.
  const { effectiveFrom, effectiveTo } = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (selectedPeriod === 'custom') return { effectiveFrom: customFrom, effectiveTo: customTo };
    if (selectedPeriod === 'all') {
      const dates = trips
        .map(t => t.arrival_date || t.departure_date)
        .filter((d): d is string => !!d)
        .sort();
      return { effectiveFrom: dates[0] || todayStr, effectiveTo: todayStr };
    }
    const months = selectedPeriod === '1month' ? 1
      : selectedPeriod === '3months' ? 3
        : selectedPeriod === '6months' ? 6
          : selectedPeriod === '1year' ? 12
            : 3;
    return { effectiveFrom: format(subMonths(new Date(), months), 'yyyy-MM-dd'), effectiveTo: todayStr };
  }, [selectedPeriod, customFrom, customTo, trips]);

  const filterTripsByRange = useCallback((from: string, to: string): Trip[] => {
    if (!from || !to) return [];
    const f = parseISO(from);
    const t = parseISO(to);
    return trips.filter(trip => {
      const d = trip.arrival_date || trip.departure_date;
      if (!d) return false;
      const td = parseISO(d);
      return td >= f && td <= t;
    });
  }, [trips]);

  const tripCostsUSD = useCallback((tripId: string): number => {
    return costEntries
      .filter(c => c.trip_id === tripId)
      .reduce((s, c) => s + Number(c.amount || 0), 0);
  }, [costEntries]);

  // Export all trip reports to Excel
  const exportToExcel = useCallback(async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Car Craft Co Fleet Management';
      wb.created = new Date();

      // Shared styles
      const hFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
      const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' };
      const hAlign: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const cFmt = '#,##0.00';
      const bdr: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
        left: { style: 'thin', color: { argb: 'D9D9D9' } },
        right: { style: 'thin', color: { argb: 'D9D9D9' } },
      };
      const zFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F6FC' } };
      const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };

      const styleHeader = (ws: ExcelJS.Worksheet, row: number) => {
        const r = ws.getRow(row);
        r.eachCell(c => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
        r.height = 28;
      };

      const styleData = (ws: ExcelJS.Worksheet, startRow: number, count: number, currCols: number[]) => {
        for (let i = 0; i < count; i++) {
          const r = ws.getRow(startRow + i);
          r.eachCell(c => { c.border = bdr; c.font = bodyFont; c.alignment = { vertical: 'middle' }; });
          if (i % 2 === 1) r.eachCell(c => { c.fill = zFill; });
          currCols.forEach(col => { r.getCell(col).numFmt = cFmt; });
        }
      };

      const addTotalsRow = (ws: ExcelJS.Worksheet, rowNum: number, values: (string | number)[], currCols: number[]) => {
        const r = ws.getRow(rowNum);
        r.values = values;
        r.eachCell(c => {
          c.font = { bold: true, size: 10, name: 'Calibri' };
          c.border = { top: { style: 'double', color: { argb: '1F3864' } }, bottom: { style: 'double', color: { argb: '1F3864' } }, left: bdr.left!, right: bdr.right! };
        });
        currCols.forEach(col => { r.getCell(col).numFmt = cFmt; });
      };

      const autoW = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach(col => { let m = 12; col.eachCell?.({ includeEmpty: false }, c => { const l = c.value ? String(c.value).length + 2 : 0; if (l > m) m = l; }); col.width = Math.min(m, 40); });
      };

      // Calculate margins
      const margin = overallStats.revenue.USD > 0 ? ((overallStats.profit.USD / overallStats.revenue.USD) * 100).toFixed(2) + '%' : '0%';

      // ═══ SUMMARY ═══
      const sWs = wb.addWorksheet('Summary');
      sWs.mergeCells('A1:D1');
      const tc = sWs.getCell('A1');
      tc.value = 'TRIP REPORTS SUMMARY';
      tc.font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      sWs.getRow(1).height = 32;

      sWs.mergeCells('A2:D2');
      const sc = sWs.getCell('A2');
      sc.value = `Period: ${periodLabel} \u2022 Generated: ${format(new Date(), 'dd MMMM yyyy, HH:mm')} \u2022 Car Craft Co`;
      sc.font = { italic: true, size: 9, color: { argb: '666666' }, name: 'Calibri' };

      sWs.getRow(4).values = ['Metric', 'Value'];
      styleHeader(sWs, 4);

      const sRows: [string, string | number][] = [
        ['Total Trips', overallStats.totalTrips],
        ['Total Kilometers', overallStats.totalKm],
        ['Revenue (USD)', overallStats.revenue.USD],
        ['Expenses (USD)', overallStats.expenses.USD],
        ['Net Profit (USD)', overallStats.profit.USD],
        ['Profit Margin (USD)', margin],
      ];
      sRows.forEach((row, i) => {
        const r = sWs.getRow(5 + i);
        r.values = [row[0], row[1]];
        r.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
        r.getCell(2).font = { size: 10, name: 'Calibri' };
        if (typeof row[1] === 'number') r.getCell(2).numFmt = cFmt;
        r.eachCell(c => { c.border = bdr; });
        if (i % 2 === 1) r.eachCell(c => { c.fill = zFill; });
      });
      sWs.getColumn(1).width = 25;
      sWs.getColumn(2).width = 22;

      // ═══ BY CLIENT ═══
      const cWs = wb.addWorksheet('By Client');
      cWs.getRow(1).values = ['Client', 'Trips', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'];
      styleHeader(cWs, 1);
      clientSummaries.forEach((c, i) => {
        cWs.getRow(i + 2).values = [c.clientName, c.tripCount, c.revenue.USD, c.expenses.USD, c.profit.USD];
      });
      styleData(cWs, 2, clientSummaries.length, [3, 4, 5, 6, 7, 8]);
      addTotalsRow(cWs, clientSummaries.length + 2, [
        'TOTAL', clientSummaries.reduce((s, c) => s + c.tripCount, 0),
        clientSummaries.reduce((s, c) => s + c.revenue.USD, 0), clientSummaries.reduce((s, c) => s + c.revenue.USD, 0),
        clientSummaries.reduce((s, c) => s + c.expenses.USD, 0), clientSummaries.reduce((s, c) => s + c.expenses.USD, 0),
        clientSummaries.reduce((s, c) => s + c.profit.USD, 0), clientSummaries.reduce((s, c) => s + c.profit.USD, 0),
      ], [3, 4, 5, 6, 7, 8]);
      cWs.autoFilter = { from: 'A1', to: `H${clientSummaries.length + 1}` };
      cWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(cWs);

      // ═══ BY DRIVER ═══
      const dWs = wb.addWorksheet('By Driver');
      dWs.getRow(1).values = ['Driver', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'];
      styleHeader(dWs, 1);
      driverSummaries.forEach((d, i) => {
        dWs.getRow(i + 2).values = [d.driverName, d.tripCount, d.totalKm, d.revenue.USD, d.expenses.USD, d.profit.USD];
      });
      styleData(dWs, 2, driverSummaries.length, [4, 5, 6, 7, 8, 9]);
      addTotalsRow(dWs, driverSummaries.length + 2, [
        'TOTAL', driverSummaries.reduce((s, d) => s + d.tripCount, 0), driverSummaries.reduce((s, d) => s + d.totalKm, 0),
        driverSummaries.reduce((s, d) => s + d.revenue.USD, 0), driverSummaries.reduce((s, d) => s + d.revenue.USD, 0),
        driverSummaries.reduce((s, d) => s + d.expenses.USD, 0), driverSummaries.reduce((s, d) => s + d.expenses.USD, 0),
        driverSummaries.reduce((s, d) => s + d.profit.USD, 0), driverSummaries.reduce((s, d) => s + d.profit.USD, 0),
      ], [4, 5, 6, 7, 8, 9]);
      dWs.autoFilter = { from: 'A1', to: `I${driverSummaries.length + 1}` };
      dWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(dWs);

      // ═══ BY TRUCK ═══
      const tWs = wb.addWorksheet('By Truck');
      tWs.getRow(1).values = ['Truck', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'];
      styleHeader(tWs, 1);
      truckSummaries.forEach((t, i) => {
        tWs.getRow(i + 2).values = [t.fleetNumber, t.tripCount, t.totalKm, t.revenue.USD, t.expenses.USD, t.profit.USD];
      });
      styleData(tWs, 2, truckSummaries.length, [4, 5, 6, 7, 8, 9]);
      addTotalsRow(tWs, truckSummaries.length + 2, [
        'TOTAL', truckSummaries.reduce((s, t) => s + t.tripCount, 0), truckSummaries.reduce((s, t) => s + t.totalKm, 0),
        truckSummaries.reduce((s, t) => s + t.revenue.USD, 0), truckSummaries.reduce((s, t) => s + t.revenue.USD, 0),
        truckSummaries.reduce((s, t) => s + t.expenses.USD, 0), truckSummaries.reduce((s, t) => s + t.expenses.USD, 0),
        truckSummaries.reduce((s, t) => s + t.profit.USD, 0), truckSummaries.reduce((s, t) => s + t.profit.USD, 0),
      ], [4, 5, 6, 7, 8, 9]);
      tWs.autoFilter = { from: 'A1', to: `I${truckSummaries.length + 1}` };
      tWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(tWs);

      // ═══ WEEKLY ═══
      const wWs = wb.addWorksheet('Weekly');
      wWs.getRow(1).values = ['Week', 'Year', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'];
      styleHeader(wWs, 1);
      weeklySummaries.forEach((w, i) => {
        wWs.getRow(i + 2).values = [w.weekNumber, w.year, w.tripCount, w.totalKm, w.revenue.USD, w.expenses.USD, w.profit.USD];
      });
      styleData(wWs, 2, weeklySummaries.length, [5, 6, 7, 8, 9, 10]);
      wWs.autoFilter = { from: 'A1', to: `J${weeklySummaries.length + 1}` };
      wWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(wWs);

      // ═══ MONTHLY ═══
      const mWs = wb.addWorksheet('Monthly');
      mWs.getRow(1).values = ['Month', 'Year', 'Trips', 'KM', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'];
      styleHeader(mWs, 1);
      monthlySummaries.forEach((m, i) => {
        mWs.getRow(i + 2).values = [m.monthName, m.year, m.tripCount, m.totalKm, m.revenue.USD, m.expenses.USD, m.profit.USD];
      });
      styleData(mWs, 2, monthlySummaries.length, [5, 6, 7, 8, 9, 10]);
      mWs.autoFilter = { from: 'A1', to: `J${monthlySummaries.length + 1}` };
      mWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(mWs);

      // ═══ BY ROUTE ═══
      const rWs = wb.addWorksheet('By Route');
      rWs.getRow(1).values = ['Route', 'Origin', 'Destination', 'Trips', 'Revenue (USD)', 'Expenses (USD)', 'Profit (USD)'];
      styleHeader(rWs, 1);
      routeSummaries.forEach((r, i) => {
        rWs.getRow(i + 2).values = [r.route, r.origin, r.destination, r.tripCount, r.revenue.USD, r.expenses.USD, r.profit.USD];
      });
      styleData(rWs, 2, routeSummaries.length, [5, 6, 7, 8, 9, 10]);
      rWs.autoFilter = { from: 'A1', to: `J${routeSummaries.length + 1}` };
      rWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(rWs);

      // Save
      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Trip_Reports_${periodLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Export Successful',
        description: 'Trip reports have been exported to Excel.',
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to export reports. Please try again.',
        variant: 'destructive',
      });
    }
  }, [periodLabel, overallStats, weeklySummaries, monthlySummaries, driverSummaries, clientSummaries, routeSummaries, truckSummaries, toast]);

  // Export expenses to Excel
  const exportExpensesToExcel = useCallback(async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Car Craft Co Fleet Management';
      wb.created = new Date();

      const hFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
      const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' };
      const hAlign: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const cFmt = '#,##0.00';
      const bdr: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
        left: { style: 'thin', color: { argb: 'D9D9D9' } },
        right: { style: 'thin', color: { argb: 'D9D9D9' } },
      };
      const zFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F6FC' } };
      const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };

      const styleH = (ws: ExcelJS.Worksheet, r: number) => {
        const row = ws.getRow(r);
        row.eachCell(c => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
        row.height = 28;
      };
      const styleD = (ws: ExcelJS.Worksheet, start: number, count: number, cc: number[]) => {
        for (let i = 0; i < count; i++) {
          const r = ws.getRow(start + i);
          r.eachCell(c => { c.border = bdr; c.font = bodyFont; c.alignment = { vertical: 'middle' }; });
          if (i % 2 === 1) r.eachCell(c => { c.fill = zFill; });
          cc.forEach(col => { r.getCell(col).numFmt = cFmt; });
        }
      };
      const autoW = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach(col => { let m = 12; col.eachCell?.({ includeEmpty: false }, c => { const l = c.value ? String(c.value).length + 2 : 0; if (l > m) m = l; }); col.width = Math.min(m, 40); });
      };

      // Summary
      const sWs = wb.addWorksheet('Summary');
      sWs.mergeCells('A1:D1');
      sWs.getCell('A1').value = 'EXPENSE REPORT';
      sWs.getCell('A1').font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      sWs.getRow(1).height = 32;
      sWs.mergeCells('A2:D2');
      sWs.getCell('A2').value = `Period: ${periodLabel} \u2022 Generated: ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`;
      sWs.getCell('A2').font = { italic: true, size: 9, color: { argb: '666666' }, name: 'Calibri' };
      sWs.getRow(4).values = ['Metric', 'Value'];
      styleH(sWs, 4);
      const sRows: [string, number][] = [
        ['Total Entries', expenseSummaries.totalEntries],
        ['Total (USD)', expenseSummaries.totals.USD],
      ];
      sRows.forEach((row, i) => {
        const r = sWs.getRow(5 + i);
        r.values = [row[0], row[1]];
        r.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
        r.getCell(2).numFmt = cFmt; r.getCell(2).font = bodyFont;
        r.eachCell(c => { c.border = bdr; });
        if (i % 2 === 1) r.eachCell(c => { c.fill = zFill; });
      });
      sWs.getColumn(1).width = 22;
      sWs.getColumn(2).width = 20;

      // By Category
      const catWs = wb.addWorksheet('By Category');
      catWs.getRow(1).values = ['Category', 'Entries', 'Amount (USD)'];
      styleH(catWs, 1);
      expenseSummaries.byCategory.forEach((c, i) => {
        catWs.getRow(i + 2).values = [c.category, c.count, c.amounts.USD];
      });
      styleD(catWs, 2, expenseSummaries.byCategory.length, [3, 4]);
      catWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(catWs);

      // By Sub-Category
      const subWs = wb.addWorksheet('By Sub-Category');
      subWs.getRow(1).values = ['Category', 'Sub-Category', 'Entries', 'Amount (USD)'];
      styleH(subWs, 1);
      expenseSummaries.bySubCategory.forEach((s, i) => {
        subWs.getRow(i + 2).values = [s.category, s.subCategory, s.count, s.amounts.USD];
      });
      styleD(subWs, 2, expenseSummaries.bySubCategory.length, [4, 5]);
      subWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(subWs);

      // By Vehicle
      const vWs = wb.addWorksheet('By Vehicle');
      vWs.getRow(1).values = ['Vehicle', 'Entries', 'Amount (USD)'];
      styleH(vWs, 1);
      expenseSummaries.byVehicle.forEach((v, i) => {
        vWs.getRow(i + 2).values = [v.vehicle, v.count, v.amounts.USD];
      });
      styleD(vWs, 2, expenseSummaries.byVehicle.length, [3, 4]);
      vWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(vWs);

      // All detail
      const aWs = wb.addWorksheet('All Expenses');
      aWs.getRow(1).values = ['Date', 'Category', 'Sub-Category', 'Vehicle', 'Amount', 'Currency', 'Reference', 'Notes', 'Flagged'];
      styleH(aWs, 1);
      expenseSummaries.rawCosts.forEach((c, i) => {
        aWs.getRow(i + 2).values = [
          c.date ? format(parseISO(c.date), 'yyyy-MM-dd') : '',
          c.category || '', c.sub_category || '', c.vehicle_identifier || '',
          Number(c.amount || 0), c.currency || 'USD', c.reference_number || '',
          c.notes || '', c.is_flagged ? 'Yes' : 'No',
        ];
      });
      styleD(aWs, 2, expenseSummaries.rawCosts.length, [5]);
      aWs.autoFilter = { from: 'A1', to: `I${expenseSummaries.rawCosts.length + 1}` };
      aWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(aWs);

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Expense_Report_${periodLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Export Successful',
        description: 'Expense report has been exported to Excel.',
      });
    } catch (error) {
      console.error('Expense export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to export expense report. Please try again.',
        variant: 'destructive',
      });
    }
  }, [periodLabel, expenseSummaries, toast]);

  // Export expenses to PDF
  const exportExpensesToPDF = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Expense Report', 14, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Period: ${periodLabel} | Generated: ${new Date().toLocaleDateString()}`, 14, 25);
      doc.text(`Total entries: ${expenseSummaries.totalEntries}`, 14, 31);

      // Summary totals
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 14, 40);

      autoTable(doc, {
        startY: 43,
        head: [['Currency', 'Total Expenses']],
        body: [
          ['USD', formatCurrency(expenseSummaries.totals.USD)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
        tableWidth: 120,
      });

      // Expenses by Category
      const catStartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 10 || 75;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Expenses by Category', 14, catStartY);

      autoTable(doc, {
        startY: catStartY + 3,
        head: [['Category', 'Entries', 'Amount (USD)']],
        body: expenseSummaries.byCategory.map(c => [
          c.category,
          c.count.toString(),
          formatCurrency(c.amounts.USD),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      // Expenses by Vehicle
      const vehStartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 10 || 130;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Expenses by Vehicle', 14, vehStartY);

      autoTable(doc, {
        startY: vehStartY + 3,
        head: [['Vehicle', 'Entries', 'Amount (USD)']],
        body: expenseSummaries.byVehicle.map(v => [
          v.vehicle,
          v.count.toString(),
          formatCurrency(v.amounts.USD),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      // Detailed expenses on new page
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Expenses', 14, 18);

      autoTable(doc, {
        startY: 23,
        head: [['Date', 'Category', 'Sub-Category', 'Vehicle', 'Amount', 'Currency', 'Reference', 'Flagged']],
        body: expenseSummaries.rawCosts.map(c => [
          c.date ? format(parseISO(c.date), 'yyyy-MM-dd') : '-',
          c.category || '-',
          c.sub_category || '-',
          c.vehicle_identifier || '-',
          Number(c.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          c.currency || 'USD',
          c.reference_number || '-',
          c.is_flagged ? 'Yes' : 'No',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 25 },
          4: { halign: 'right' },
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${i} of ${pageCount} | Car Craft Co Fleet Management`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      doc.save(`Expense_Report_${periodLabel}_${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: 'PDF Generated',
        description: 'Expense report has been exported as PDF.',
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  }, [periodLabel, expenseSummaries, toast]);

  // ──────────────────────────────────────────────────────────────────────
  // Per-tab report builders → ReportSpec for tripReportExports
  // ──────────────────────────────────────────────────────────────────────
  const buildReportSpec = useCallback(
    (
      tabKey:
        | "monthly"
        | "weekly"
        | "trucks"
        | "drivers"
        | "clients"
        | "routes"
        | "revenue-types"
        | "expenses",
      from: string,
      to: string,
    ): ReportSpec | null => {
      const trips = filterTripsByRange(from, to);
      if (trips.length === 0 && tabKey !== "expenses") {
        return {
          title: `${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)} Report`,
          subtitle: "No data in selected range",
          dateFrom: from,
          dateTo: to,
          filenameBase: `trip-${tabKey}-report`,
          sections: [{ columns: [{ header: "Notice" }], rows: [["No trips found in this date range."]] }],
        };
      }

      // ─── Monthly ───
      if (tabKey === "monthly") {
        const map = new Map<
          string,
          { monthName: string; year: number; trips: number; completed: number; active: number; km: number; rev: number; exp: number }
        >();
        trips.forEach(t => {
          const dateStr = t.arrival_date || t.departure_date;
          if (!dateStr) return;
          const d = parseISO(dateStr);
          const key = format(d, "yyyy-MM");
          const e = map.get(key) || { monthName: format(d, "MMMM"), year: getYear(d), trips: 0, completed: 0, active: 0, km: 0, rev: 0, exp: 0 };
          e.trips += 1;
          if (t.status === "completed") e.completed += 1;
          else e.active += 1;
          e.km += t.distance_km || 0;
          e.rev += t.base_revenue || 0;
          e.exp += tripCostsUSD(t.id);
          map.set(key, e);
        });
        const rows = Array.from(map.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([, m]) => {
            const profit = m.rev - m.exp;
            const margin = m.rev > 0 ? (profit / m.rev) * 100 : 0;
            return [m.monthName, m.year, m.trips, m.completed, m.active, m.km, m.rev, m.exp, profit, margin];
          });
        const totals = rows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[2] as number), completed: acc.completed + (r[3] as number), active: acc.active + (r[4] as number), km: acc.km + (r[5] as number), rev: acc.rev + (r[6] as number), exp: acc.exp + (r[7] as number) }),
          { trips: 0, completed: 0, active: 0, km: 0, rev: 0, exp: 0 },
        );
        const totalProfit = totals.rev - totals.exp;
        const totalMargin = totals.rev > 0 ? (totalProfit / totals.rev) * 100 : 0;
        return {
          title: "Monthly Performance Report",
          subtitle: `${trips.length} trips • ${rows.length} month(s)`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-monthly-report",
          sheetName: "Monthly",
          summary: [
            { label: "Trips", value: trips.length },
            { label: "Total Revenue", value: fmtUsd(totals.rev) },
            { label: "Total Expenses", value: fmtUsd(totals.exp) },
            { label: "Profit", value: fmtUsd(totalProfit) },
            { label: "Margin", value: `${totalMargin.toFixed(1)}%` },
          ],
          sections: [{
            columns: [
              { header: "Month", width: 14 },
              { header: "Year", width: 8, align: "center", format: "integer" },
              { header: "Trips", width: 8, align: "center", format: "integer" },
              { header: "Completed", width: 11, align: "center", format: "integer" },
              { header: "Active", width: 9, align: "center", format: "integer" },
              { header: "KM", width: 12, format: "integer" },
              { header: "Revenue (USD)", width: 16, format: "currency" },
              { header: "Expenses (USD)", width: 16, format: "currency" },
              { header: "Profit (USD)", width: 16, format: "currency" },
              { header: "Margin %", width: 11, format: "decimal" },
            ],
            rows,
            totalsRow: ["TOTAL", "", totals.trips, totals.completed, totals.active, totals.km, totals.rev, totals.exp, totalProfit, totalMargin],
          }],
        };
      }

      // ─── Weekly ───
      if (tabKey === "weekly") {
        const map = new Map<string, { week: number; year: number; start: string; end: string; trips: number; km: number; rev: number; exp: number }>();
        trips.forEach(t => {
          const dateStr = t.arrival_date || t.departure_date;
          if (!dateStr) return;
          const d = parseISO(dateStr);
          const ws = startOfWeek(d, { weekStartsOn: 1 });
          const we = endOfWeek(d, { weekStartsOn: 1 });
          const wn = getISOWeek(d);
          const yr = getISOWeekYear(d);
          const key = `${yr}-W${String(wn).padStart(2, "0")}`;
          const e = map.get(key) || { week: wn, year: yr, start: format(ws, "dd MMM"), end: format(we, "dd MMM yyyy"), trips: 0, km: 0, rev: 0, exp: 0 };
          e.trips += 1;
          e.km += t.distance_km || 0;
          e.rev += t.base_revenue || 0;
          e.exp += tripCostsUSD(t.id);
          map.set(key, e);
        });
        const rows = Array.from(map.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([, w]) => [w.week, w.year, w.start, w.end, w.trips, w.km, w.rev, w.exp, w.rev - w.exp]);
        const totals = rows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[4] as number), km: acc.km + (r[5] as number), rev: acc.rev + (r[6] as number), exp: acc.exp + (r[7] as number) }),
          { trips: 0, km: 0, rev: 0, exp: 0 },
        );
        return {
          title: "Weekly Performance Report",
          subtitle: `${trips.length} trips • ${rows.length} week(s)`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-weekly-report",
          sheetName: "Weekly",
          summary: [
            { label: "Trips", value: trips.length },
            { label: "Revenue", value: fmtUsd(totals.rev) },
            { label: "Expenses", value: fmtUsd(totals.exp) },
            { label: "Profit", value: fmtUsd(totals.rev - totals.exp) },
          ],
          sections: [{
            columns: [
              { header: "Week #", width: 8, align: "center", format: "integer" },
              { header: "Year", width: 8, align: "center", format: "integer" },
              { header: "Start", width: 12 },
              { header: "End", width: 14 },
              { header: "Trips", width: 8, align: "center", format: "integer" },
              { header: "KM", width: 12, format: "integer" },
              { header: "Revenue (USD)", width: 16, format: "currency" },
              { header: "Expenses (USD)", width: 16, format: "currency" },
              { header: "Profit (USD)", width: 16, format: "currency" },
            ],
            rows,
            totalsRow: ["TOTAL", "", "", "", totals.trips, totals.km, totals.rev, totals.exp, totals.rev - totals.exp],
          }],
        };
      }

      // ─── Trucks ───
      if (tabKey === "trucks") {
        const map = new Map<string, { trips: number; km: number; rev: number; exp: number }>();
        trips.forEach(t => {
          const fleet = ((t as Trip & { fleet_number?: string }).fleet_number || "").toUpperCase().trim();
          if (!fleet) return;
          const e = map.get(fleet) || { trips: 0, km: 0, rev: 0, exp: 0 };
          e.trips += 1;
          e.km += t.distance_km || 0;
          e.rev += t.base_revenue || 0;
          e.exp += tripCostsUSD(t.id);
          map.set(fleet, e);
        });
        const rows = Array.from(map.entries())
          .sort((a, b) => b[1].rev - a[1].rev)
          .map(([fleet, m]) => {
            const profit = m.rev - m.exp;
            const margin = m.rev > 0 ? (profit / m.rev) * 100 : 0;
            return [fleet, m.trips, m.km, m.rev, m.exp, profit, margin];
          });
        const totals = rows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[1] as number), km: acc.km + (r[2] as number), rev: acc.rev + (r[3] as number), exp: acc.exp + (r[4] as number) }),
          { trips: 0, km: 0, rev: 0, exp: 0 },
        );
        const totalProfit = totals.rev - totals.exp;
        return {
          title: "Truck Performance Report",
          subtitle: `${rows.length} truck(s) • ${trips.length} trips`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-trucks-report",
          sheetName: "Trucks",
          summary: [
            { label: "Trucks", value: rows.length },
            { label: "Revenue", value: fmtUsd(totals.rev) },
            { label: "Expenses", value: fmtUsd(totals.exp) },
            { label: "Profit", value: fmtUsd(totalProfit) },
          ],
          sections: [{
            columns: [
              { header: "Fleet #", width: 12 },
              { header: "Trips", width: 8, align: "center", format: "integer" },
              { header: "KM", width: 12, format: "integer" },
              { header: "Revenue (USD)", width: 16, format: "currency" },
              { header: "Expenses (USD)", width: 16, format: "currency" },
              { header: "Profit (USD)", width: 16, format: "currency" },
              { header: "Margin %", width: 11, format: "decimal" },
            ],
            rows,
            totalsRow: ["TOTAL", totals.trips, totals.km, totals.rev, totals.exp, totalProfit, totals.rev > 0 ? (totalProfit / totals.rev) * 100 : 0],
          }],
        };
      }

      // ─── Drivers ───
      if (tabKey === "drivers") {
        const map = new Map<string, { trips: number; completed: number; km: number; rev: number; exp: number }>();
        trips.forEach(t => {
          const driver = t.driver_name || "Unassigned";
          const e = map.get(driver) || { trips: 0, completed: 0, km: 0, rev: 0, exp: 0 };
          e.trips += 1;
          if (t.status === "completed") e.completed += 1;
          e.km += t.distance_km || 0;
          e.rev += t.base_revenue || 0;
          e.exp += tripCostsUSD(t.id);
          map.set(driver, e);
        });
        const rows = Array.from(map.entries())
          .sort((a, b) => b[1].rev - a[1].rev)
          .map(([driver, m], i) => {
            const profit = m.rev - m.exp;
            const margin = m.rev > 0 ? (profit / m.rev) * 100 : 0;
            return [i + 1, driver, m.trips, m.completed, m.km, m.rev, m.exp, profit, margin];
          });
        const totals = rows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[2] as number), completed: acc.completed + (r[3] as number), km: acc.km + (r[4] as number), rev: acc.rev + (r[5] as number), exp: acc.exp + (r[6] as number) }),
          { trips: 0, completed: 0, km: 0, rev: 0, exp: 0 },
        );
        const totalProfit = totals.rev - totals.exp;
        return {
          title: "Driver Performance Report",
          subtitle: `${rows.length} driver(s) • ${trips.length} trips`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-drivers-report",
          sheetName: "Drivers",
          summary: [
            { label: "Drivers", value: rows.length },
            { label: "Revenue", value: fmtUsd(totals.rev) },
            { label: "Expenses", value: fmtUsd(totals.exp) },
            { label: "Profit", value: fmtUsd(totalProfit) },
          ],
          sections: [{
            columns: [
              { header: "#", width: 5, align: "center", format: "integer" },
              { header: "Driver", width: 24 },
              { header: "Trips", width: 8, align: "center", format: "integer" },
              { header: "Completed", width: 11, align: "center", format: "integer" },
              { header: "KM", width: 12, format: "integer" },
              { header: "Revenue (USD)", width: 16, format: "currency" },
              { header: "Expenses (USD)", width: 16, format: "currency" },
              { header: "Profit (USD)", width: 16, format: "currency" },
              { header: "Margin %", width: 11, format: "decimal" },
            ],
            rows,
            totalsRow: ["", "TOTAL", totals.trips, totals.completed, totals.km, totals.rev, totals.exp, totalProfit, totals.rev > 0 ? (totalProfit / totals.rev) * 100 : 0],
          }],
        };
      }

      // ─── Clients ───
      if (tabKey === "clients") {
        const map = new Map<string, { trips: number; completed: number; km: number; emptyKm: number; rev: number; exp: number; lastDate: string }>();
        trips.forEach(t => {
          const client = t.client_name || "No Client";
          const e = map.get(client) || { trips: 0, completed: 0, km: 0, emptyKm: 0, rev: 0, exp: 0, lastDate: "" };
          e.trips += 1;
          if (t.status === "completed") e.completed += 1;
          e.km += t.distance_km || 0;
          e.emptyKm += t.empty_km || 0;
          e.rev += t.base_revenue || 0;
          e.exp += tripCostsUSD(t.id);
          if (t.departure_date && (!e.lastDate || t.departure_date > e.lastDate)) e.lastDate = t.departure_date;
          map.set(client, e);
        });
        const rows = Array.from(map.entries())
          .sort((a, b) => b[1].rev - a[1].rev)
          .map(([client, m]) => [client, m.trips, m.completed, m.km, m.emptyKm, m.rev, m.exp, m.rev - m.exp, m.lastDate || "—"]);
        const totals = rows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[1] as number), completed: acc.completed + (r[2] as number), km: acc.km + (r[3] as number), emptyKm: acc.emptyKm + (r[4] as number), rev: acc.rev + (r[5] as number), exp: acc.exp + (r[6] as number) }),
          { trips: 0, completed: 0, km: 0, emptyKm: 0, rev: 0, exp: 0 },
        );
        return {
          title: "Client Revenue Report",
          subtitle: `${rows.length} client(s) • ${trips.length} trips`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-clients-report",
          sheetName: "Clients",
          summary: [
            { label: "Clients", value: rows.length },
            { label: "Revenue", value: fmtUsd(totals.rev) },
            { label: "Profit", value: fmtUsd(totals.rev - totals.exp) },
            { label: "Empty KM", value: totals.emptyKm.toLocaleString() },
          ],
          sections: [{
            columns: [
              { header: "Client", width: 26 },
              { header: "Trips", width: 8, align: "center", format: "integer" },
              { header: "Completed", width: 11, align: "center", format: "integer" },
              { header: "KM", width: 12, format: "integer" },
              { header: "Empty KM", width: 12, format: "integer" },
              { header: "Revenue (USD)", width: 16, format: "currency" },
              { header: "Expenses (USD)", width: 16, format: "currency" },
              { header: "Profit (USD)", width: 16, format: "currency" },
              { header: "Last Trip", width: 12 },
            ],
            rows,
            totalsRow: ["TOTAL", totals.trips, totals.completed, totals.km, totals.emptyKm, totals.rev, totals.exp, totals.rev - totals.exp, ""],
          }],
        };
      }

      // ─── Routes ───
      if (tabKey === "routes") {
        const map = new Map<string, { origin: string; destination: string; trips: number; rev: number; exp: number }>();
        trips.forEach(t => {
          if (!t.origin || !t.destination) return;
          const key = `${t.origin} → ${t.destination}`;
          const e = map.get(key) || { origin: t.origin, destination: t.destination, trips: 0, rev: 0, exp: 0 };
          e.trips += 1;
          e.rev += t.base_revenue || 0;
          e.exp += tripCostsUSD(t.id);
          map.set(key, e);
        });
        const rows = Array.from(map.entries())
          .sort((a, b) => b[1].trips - a[1].trips)
          .map(([route, m]) => [route, m.origin, m.destination, m.trips, m.rev, m.exp, m.rev - m.exp]);
        const totals = rows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[3] as number), rev: acc.rev + (r[4] as number), exp: acc.exp + (r[5] as number) }),
          { trips: 0, rev: 0, exp: 0 },
        );
        return {
          title: "Route Performance Report",
          subtitle: `${rows.length} route(s) • ${trips.length} trips`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-routes-report",
          sheetName: "Routes",
          summary: [
            { label: "Routes", value: rows.length },
            { label: "Revenue", value: fmtUsd(totals.rev) },
            { label: "Profit", value: fmtUsd(totals.rev - totals.exp) },
          ],
          sections: [{
            columns: [
              { header: "Route", width: 32 },
              { header: "Origin", width: 16 },
              { header: "Destination", width: 16 },
              { header: "Trips", width: 8, align: "center", format: "integer" },
              { header: "Revenue (USD)", width: 16, format: "currency" },
              { header: "Expenses (USD)", width: 16, format: "currency" },
              { header: "Profit (USD)", width: 16, format: "currency" },
            ],
            rows,
            totalsRow: ["TOTAL", "", "", totals.trips, totals.rev, totals.exp, totals.rev - totals.exp],
          }],
        };
      }

      // ─── Revenue Types ───
      if (tabKey === "revenue-types") {
        const labelByValue = new Map<string, string>(
          ADDITIONAL_REVENUE_REASONS.map(r => [r.value as string, r.label]),
        );
        const buckets = new Map<string, { label: string; trips: number; real: number; funny: number; realAmt: number; funnyAmt: number; total: number }>();
        const funnyTrips: Array<[string, string, string, string, string, number, number, number, string, string]> = [];
        let realCount = 0, funnyCount = 0, realAmt = 0, funnyAmt = 0, realKm = 0, funnyKm = 0;

        trips.forEach(t => {
          const baseRev = Number(t.base_revenue || 0);
          const addRev = Number(t.additional_revenue || 0);
          const totalRev = baseRev + addRev;
          const km = Number(t.distance_km || 0);
          const isReal = !!t.additional_revenue_verified;
          if (totalRev > 0) {
            if (isReal) { realCount++; realAmt += totalRev; realKm += km; }
            else {
              funnyCount++; funnyAmt += totalRev; funnyKm += km;
              funnyTrips.push([
                t.trip_number || "—",
                t.driver_name || "—",
                t.client_name || "—",
                t.route || `${t.origin || ""}${t.origin && t.destination ? " → " : ""}${t.destination || ""}` || "—",
                t.additional_revenue_reason ? (labelByValue.get(t.additional_revenue_reason) || t.additional_revenue_reason) : "—",
                baseRev,
                addRev,
                totalRev,
                t.arrival_date || t.departure_date || "—",
                t.status || "active",
              ]);
            }
          }
          if (addRev > 0) {
            const reason = t.additional_revenue_reason || "unspecified";
            const label = labelByValue.get(reason) || (reason === "unspecified" ? "Unspecified" : reason);
            const b = buckets.get(reason) || { label, trips: 0, real: 0, funny: 0, realAmt: 0, funnyAmt: 0, total: 0 };
            b.trips++;
            b.total += addRev;
            if (isReal) { b.real++; b.realAmt += addRev; }
            else { b.funny++; b.funnyAmt += addRev; }
            buckets.set(reason, b);
          }
        });

        const totalRev = realAmt + funnyAmt;
        const realPct = totalRev > 0 ? (realAmt / totalRev) * 100 : 0;
        const funnyPct = totalRev > 0 ? (funnyAmt / totalRev) * 100 : 0;
        const reasonRows = Array.from(buckets.values())
          .sort((a, b) => b.total - a.total)
          .map(b => [b.label, b.trips, b.real, b.funny, b.realAmt, b.funnyAmt, b.total]);
        const reasonTotals = reasonRows.reduce(
          (acc, r) => ({ trips: acc.trips + (r[1] as number), real: acc.real + (r[2] as number), funny: acc.funny + (r[3] as number), realAmt: acc.realAmt + (r[4] as number), funnyAmt: acc.funnyAmt + (r[5] as number), total: acc.total + (r[6] as number) }),
          { trips: 0, real: 0, funny: 0, realAmt: 0, funnyAmt: 0, total: 0 },
        );

        return {
          title: "Revenue Types Report",
          subtitle: `${trips.length} trips • Real vs Funny Money breakdown`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-revenue-types-report",
          sheetName: "Revenue Types",
          summary: [
            { label: "Total Revenue", value: fmtUsd(totalRev) },
            { label: "Real Money", value: fmtUsd(realAmt) },
            { label: "Funny Money", value: fmtUsd(funnyAmt) },
            { label: "Real %", value: `${realPct.toFixed(1)}%` },
            { label: "Funny %", value: `${funnyPct.toFixed(1)}%` },
          ],
          sections: [
            {
              heading: "Real Money vs Funny Money",
              columns: [
                { header: "Type", width: 18 },
                { header: "Trips", width: 8, align: "center", format: "integer" },
                { header: "Amount (USD)", width: 16, format: "currency" },
                { header: "KM", width: 12, format: "integer" },
                { header: "% of Total", width: 11, format: "decimal" },
              ],
              rows: [
                ["Real Money", realCount, realAmt, realKm, realPct],
                ["Funny Money", funnyCount, funnyAmt, funnyKm, funnyPct],
              ],
              totalsRow: ["TOTAL", realCount + funnyCount, totalRev, realKm + funnyKm, 100],
            },
            {
              heading: "Additional Revenue by Reason",
              columns: [
                { header: "Reason", width: 22 },
                { header: "Trips", width: 8, align: "center", format: "integer" },
                { header: "Real #", width: 8, align: "center", format: "integer" },
                { header: "Funny #", width: 9, align: "center", format: "integer" },
                { header: "Real Amount", width: 14, format: "currency" },
                { header: "Funny Amount", width: 14, format: "currency" },
                { header: "Total (USD)", width: 14, format: "currency" },
              ],
              rows: reasonRows,
              totalsRow: ["TOTAL", reasonTotals.trips, reasonTotals.real, reasonTotals.funny, reasonTotals.realAmt, reasonTotals.funnyAmt, reasonTotals.total],
            },
            {
              heading: `Funny Money Trips (${funnyTrips.length})`,
              columns: [
                { header: "Trip #", width: 12 },
                { header: "Driver", width: 18 },
                { header: "Client", width: 18 },
                { header: "Route", width: 26 },
                { header: "Reason", width: 18 },
                { header: "Base Rev", width: 12, format: "currency" },
                { header: "Add Rev", width: 12, format: "currency" },
                { header: "Total Rev", width: 12, format: "currency" },
                { header: "Date", width: 12 },
                { header: "Status", width: 10 },
              ],
              rows: funnyTrips,
            },
          ],
        };
      }

      // ─── Expenses ───
      if (tabKey === "expenses") {
        const tripIds = new Set(trips.map(t => t.id));
        const costs = costEntries.filter(c => tripIds.has(c.trip_id));
        const tripFleetMap = new Map<string, string>();
        trips.forEach(t => {
          const fn = (t as Trip & { fleet_number?: string }).fleet_number;
          if (fn) tripFleetMap.set(t.id, fn);
        });

        const catMap = new Map<string, { count: number; amount: number }>();
        const subMap = new Map<string, { category: string; sub: string; count: number; amount: number }>();
        const vehMap = new Map<string, { count: number; amount: number }>();
        let total = 0;
        costs.forEach(c => {
          const amt = Number(c.amount || 0);
          total += amt;
          const cat = c.category || "Uncategorized";
          const sub = c.sub_category || "General";
          const veh = (c.trip_id && tripFleetMap.get(c.trip_id)) || c.vehicle_identifier || "Unknown";
          const ce = catMap.get(cat) || { count: 0, amount: 0 };
          ce.count++; ce.amount += amt; catMap.set(cat, ce);
          const sk = `${cat}||${sub}`;
          const se = subMap.get(sk) || { category: cat, sub, count: 0, amount: 0 };
          se.count++; se.amount += amt; subMap.set(sk, se);
          const ve = vehMap.get(veh) || { count: 0, amount: 0 };
          ve.count++; ve.amount += amt; vehMap.set(veh, ve);
        });
        const catRows = Array.from(catMap.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([cat, e]) => [cat, e.count, e.amount, total > 0 ? (e.amount / total) * 100 : 0]);
        const subRows = Array.from(subMap.values())
          .sort((a, b) => b.amount - a.amount)
          .map(s => [s.category, s.sub, s.count, s.amount]);
        const vehRows = Array.from(vehMap.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([veh, e]) => [veh, e.count, e.amount, total > 0 ? (e.amount / total) * 100 : 0]);
        const detailRows = costs
          .slice()
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .map(c => [
            c.date || "—",
            (c.trip_id && tripFleetMap.get(c.trip_id)) || c.vehicle_identifier || "—",
            c.category || "—",
            c.sub_category || "—",
            c.notes || c.reference_number || "—",
            Number(c.amount || 0),
          ]);

        return {
          title: "Expenses Report",
          subtitle: `${costs.length} entries • ${catRows.length} categories`,
          dateFrom: from,
          dateTo: to,
          filenameBase: "trip-expenses-report",
          sheetName: "Expenses",
          summary: [
            { label: "Total Expenses", value: fmtUsd(total) },
            { label: "Entries", value: costs.length },
            { label: "Categories", value: catRows.length },
            { label: "Vehicles", value: vehRows.length },
          ],
          sections: [
            {
              heading: "By Category",
              columns: [
                { header: "Category", width: 22 },
                { header: "Entries", width: 9, align: "center", format: "integer" },
                { header: "Amount (USD)", width: 16, format: "currency" },
                { header: "% of Total", width: 11, format: "decimal" },
              ],
              rows: catRows,
              totalsRow: ["TOTAL", catRows.reduce((s, r) => s + (r[1] as number), 0), total, 100],
            },
            {
              heading: "By Sub-Category",
              columns: [
                { header: "Category", width: 22 },
                { header: "Sub-Category", width: 22 },
                { header: "Entries", width: 9, align: "center", format: "integer" },
                { header: "Amount (USD)", width: 16, format: "currency" },
              ],
              rows: subRows,
              totalsRow: ["", "TOTAL", subRows.reduce((s, r) => s + (r[2] as number), 0), total],
            },
            {
              heading: "By Vehicle",
              columns: [
                { header: "Vehicle", width: 14 },
                { header: "Entries", width: 9, align: "center", format: "integer" },
                { header: "Amount (USD)", width: 16, format: "currency" },
                { header: "% of Total", width: 11, format: "decimal" },
              ],
              rows: vehRows,
              totalsRow: ["TOTAL", vehRows.reduce((s, r) => s + (r[1] as number), 0), total, 100],
            },
            {
              heading: `Detail (${detailRows.length} entries)`,
              columns: [
                { header: "Date", width: 12 },
                { header: "Vehicle", width: 12 },
                { header: "Category", width: 18 },
                { header: "Sub-Category", width: 18 },
                { header: "Description", width: 32 },
                { header: "Amount (USD)", width: 14, format: "currency" },
              ],
              rows: detailRows,
            },
          ],
        };
      }

      return null;
    },
    [filterTripsByRange, tripCostsUSD, costEntries],
  );

  const runReportExport = useCallback(
    async (
      tabKey:
        | "monthly"
        | "weekly"
        | "trucks"
        | "drivers"
        | "clients"
        | "routes"
        | "revenue-types"
        | "expenses",
      formatType: "pdf" | "excel",
      from: string,
      to: string,
    ) => {
      try {
        const spec = buildReportSpec(tabKey, from, to);
        if (!spec) return;
        if (formatType === "pdf") {
          generateReportPDF(spec);
          toast({ title: "PDF Generated", description: `${spec.title} exported.` });
        } else {
          await generateReportExcel(spec);
          toast({ title: "Excel Generated", description: `${spec.title} exported.` });
        }
      } catch (err) {
        console.error("Report export failed", err);
        toast({ title: "Export Failed", description: "Unable to generate the report.", variant: "destructive" });
      }
    },
    [buildReportSpec, toast],
  );

  return (
    <div className="space-y-5">
      {/* Page Header + Period Filter */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-slate-900 via-slate-700 to-slate-400 dark:from-slate-100 dark:via-slate-300 dark:to-slate-600" />
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Reports Overview</p>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Performance insights for <span className="tabular-nums">{filteredTrips.length.toLocaleString()}</span> trips
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-9 w-[180px] rounded-lg border-slate-200 bg-slate-50/60 text-sm font-medium text-slate-800 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
                  <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">Last Month</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">
                    <span className="flex items-center gap-1.5">
                      <CalendarRange className="h-3.5 w-3.5" />
                      Custom Range
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="h-9 gap-2 border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {selectedPeriod === 'custom' && (
            <div className="flex flex-col items-start gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-800 sm:flex-row sm:items-end">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Date Range</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">From</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    max={customTo}
                    className="h-9 w-[160px] border-slate-200 bg-slate-50/60 font-medium text-slate-800 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                  />
                </div>
                <span className="mt-5 text-slate-400">→</span>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">To</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    min={customFrom}
                    className="h-9 w-[160px] border-slate-200 bg-slate-50/60 font-medium text-slate-800 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-blue-500/70" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Total Trips</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{overallStats.totalTrips.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Revenue</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(overallStats.revenue.USD)}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-rose-500/70" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Expenses</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">{formatCurrency(overallStats.expenses.USD)}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className={cn(
            "absolute inset-x-0 top-0 h-[2px]",
            overallStats.profit.USD >= 0 ? "bg-emerald-500/70" : "bg-orange-500/70"
          )} />
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              overallStats.profit.USD >= 0
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                : "bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400"
            )}>
              {overallStats.profit.USD >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Net Profit (USD)</p>
              <p className={cn(
                "mt-0.5 text-lg font-semibold tabular-nums",
                overallStats.profit.USD >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-orange-700 dark:text-orange-400"
              )}>{formatCurrency(overallStats.profit.USD)}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-violet-500/70" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Total KM</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{overallStats.totalKm.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Reports Tabs */}
      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList className="inline-flex h-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <TabsTrigger value="monthly" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Monthly</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Weekly</TabsTrigger>
          <TabsTrigger value="trucks" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Trucks</TabsTrigger>
          <TabsTrigger value="drivers" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Drivers</TabsTrigger>
          <TabsTrigger value="clients" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Clients</TabsTrigger>
          <TabsTrigger value="routes" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Routes</TabsTrigger>
          <TabsTrigger value="revenue-types" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Revenue Types</TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Expenses</TabsTrigger>
        </TabsList>

        {/* Monthly Summary Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('monthly', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('monthly', 'excel', f, t)}
            label="Monthly report"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Monthly</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Monthly Performance Summary</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Revenue, expenses and profit breakdown by month</p>
              </div>
            </div>
            <div className="p-5">
              {monthlySummaries.length > 0 ? (
                <div className="space-y-4">
                  {monthlySummaries.map((month) => {
                    return (
                      <div key={month.monthKey} className="p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-accent/50 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Calendar className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{month.monthName} {month.year}</h3>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{month.tripCount} trips</span>
                                <Badge variant="outline" className="text-xs">{month.completedTrips} completed</Badge>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {month.totalKm.toLocaleString()} km
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
                            <div className="text-center lg:text-right">
                              <p className="text-xs text-muted-foreground">Distance</p>
                              <p className="font-semibold tabular-nums">{month.totalKm.toLocaleString()} km</p>
                            </div>
                            <div className="text-center lg:text-right">
                              <p className="text-xs text-muted-foreground">Revenue</p>
                              <CurrencyDisplay amounts={month.revenue} type="revenue" />
                            </div>
                            <div className="text-center lg:text-right">
                              <p className="text-xs text-muted-foreground">Expenses</p>
                              <CurrencyDisplay amounts={month.expenses} type="expense" />
                            </div>
                            <div className="text-center lg:text-right">
                              <p className="text-xs text-muted-foreground">Profit</p>
                              <CurrencyDisplay amounts={month.profit} type="profit" />
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trip data available for the selected period</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Weekly Summary Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('weekly', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('weekly', 'excel', f, t)}
            label="Weekly report"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Weekly</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Weekly Performance Summary</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Detailed week-by-week breakdown</p>
              </div>
            </div>
            <div className="p-5">
              {weeklySummaries.length > 0 ? (
                <div className="space-y-3">
                  {weeklySummaries.slice(0, 12).map((week) => (
                    <div key={week.weekKey} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border border-border/50 hover:bg-accent/50 transition-colors gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono">W{week.weekNumber}</Badge>
                        <div>
                          <p className="font-medium">{week.startDate} - {week.endDate}</p>
                          <p className="text-sm text-muted-foreground">{week.tripCount} trips • {week.totalKm.toLocaleString()} km</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <CurrencyDisplay amounts={week.revenue} type="revenue" />
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Profit</p>
                          <CurrencyDisplay amounts={week.profit} type="profit" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No weekly data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Trucks Tab */}
        <TabsContent value="trucks" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('trucks', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('trucks', 'excel', f, t)}
            label="Trucks report"
          />
          <TruckReportsTab trips={filteredTrips} costEntries={costEntries} />
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('drivers', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('drivers', 'excel', f, t)}
            label="Drivers report"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Drivers</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Driver Performance Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Revenue and profit contribution by driver</p>
              </div>
            </div>
            <div className="p-5">
              {driverSummaries.length > 0 ? (
                <div className="space-y-3">
                  {driverSummaries.map((driver, index) => (
                    <div key={driver.driverName} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border/50 hover:bg-accent/50 transition-colors gap-3">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary tabular-nums">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{driver.driverName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{driver.tripCount} trips</span>
                            <span>•</span>
                            <span>{driver.totalKm.toLocaleString()} km</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 sm:gap-6">
                        <div className="text-center sm:text-right">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <CurrencyDisplay amounts={driver.revenue} type="revenue" />
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xs text-muted-foreground">Expenses</p>
                          <CurrencyDisplay amounts={driver.expenses} type="expense" />
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xs text-muted-foreground">Profit</p>
                          <CurrencyDisplay amounts={driver.profit} type="profit" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No driver data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('clients', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('clients', 'excel', f, t)}
            label="Clients report"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Building className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Clients</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Client Revenue Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Revenue breakdown by client</p>
              </div>
            </div>
            <div className="p-5">
              {clientSummaries.length > 0 ? (
                <div className="space-y-6">
                  {(() => {
                    const INTERNAL_CLIENTS = ['Marketing', 'Burma Valley', 'Nyamagaya', 'Nyamagay', 'Marketing Export'];

                    const internalClients = clientSummaries.filter(c =>
                      INTERNAL_CLIENTS.some(ic => c.clientName.toLowerCase() === ic.toLowerCase())
                    );
                    const emptyKmClients = clientSummaries.filter(c =>
                      c.clientName.toLowerCase().includes('empty') && c.clientName.toLowerCase().includes('km')
                    );
                    const thirdPartyClients = clientSummaries.filter(c =>
                      !INTERNAL_CLIENTS.some(ic => c.clientName.toLowerCase() === ic.toLowerCase()) &&
                      !(c.clientName.toLowerCase().includes('empty') && c.clientName.toLowerCase().includes('km'))
                    );

                    const getCategorySummary = (clients: ClientSummary[]) => {
                      const totals = clients.reduce(
                        (acc, c) => ({
                          trips: acc.trips + c.tripCount,
                          revenue: acc.revenue + c.revenue.USD,
                          revenueUSD: acc.revenueUSD + c.revenue.USD,
                          totalKm: acc.totalKm + c.totalKm,
                          emptyKm: acc.emptyKm + c.emptyKm,
                        }),
                        { trips: 0, revenue: 0, revenueUSD: 0, totalKm: 0, emptyKm: 0 }
                      );
                      return totals;
                    };

                    const renderCategoryHeader = (title: string, color: string, clients: ClientSummary[]) => {
                      const summary = getCategorySummary(clients);
                      return (
                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border ${color}`}>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm uppercase tracking-wide">{title}</h3>
                            <span className="text-xs text-muted-foreground">({summary.trips} trips)</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 sm:mt-0 text-xs">
                            <span className="font-medium text-green-700">
                              Revenue: {summary.revenueUSD > 0 ? `$${summary.revenueUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}
                              {summary.revenueUSD > 0 && summary.revenue > 0 ? ' + ' : ''}
                              {summary.revenue > 0 ? `R${summary.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}
                              {summary.revenueUSD === 0 && summary.revenue === 0 ? '$0.00' : ''}
                            </span>
                            <span className="text-gray-600">{summary.totalKm.toLocaleString()} km</span>
                            {summary.emptyKm > 0 && (
                              <span className="text-amber-600">{summary.emptyKm.toLocaleString()} km empty</span>
                            )}
                          </div>
                        </div>
                      );
                    };

                    const renderClientRow = (client: ClientSummary) => (
                      <div key={client.clientName} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border/50 hover:bg-accent/50 transition-colors gap-3">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Building className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{client.clientName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{client.tripCount} trips</span>
                              <span>•</span>
                              <span>{client.totalKm.toLocaleString()} km</span>
                              {client.emptyKm > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600">{client.emptyKm.toLocaleString()} km empty</span>
                                </>
                              )}
                              {client.lastTripDate && (
                                <>
                                  <span>•</span>
                                  <span>Last: {formatDate(client.lastTripDate)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 sm:gap-6">
                          <div className="text-center sm:text-right">
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <CurrencyDisplay amounts={client.revenue} type="revenue" />
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="text-xs text-muted-foreground">Expenses</p>
                            <CurrencyDisplay amounts={client.expenses} type="expense" />
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="text-xs text-muted-foreground">Profit</p>
                            <CurrencyDisplay amounts={client.profit} type="profit" />
                          </div>
                        </div>
                      </div>
                    );

                    return (
                      <>
                        {/* INTERNAL Section */}
                        {renderCategoryHeader('Internal', 'border-blue-400/30 bg-blue-500/5', internalClients)}
                        <div className="space-y-2 pl-2">
                          {internalClients.length > 0 ? (
                            internalClients.map(renderClientRow)
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4 py-2">No internal client trips in this period</p>
                          )}
                        </div>

                        {/* THIRD PARTY Section */}
                        {renderCategoryHeader('Third Party', 'border-violet-400/30 bg-violet-500/5', thirdPartyClients)}
                        <div className="space-y-2 pl-2">
                          {thirdPartyClients.length > 0 ? (
                            thirdPartyClients.map(renderClientRow)
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4 py-2">No third party client trips in this period</p>
                          )}
                        </div>

                        {/* EMPTY KM Section */}
                        {renderCategoryHeader('Empty KM', 'border-amber-400/30 bg-amber-500/5', emptyKmClients)}
                        <div className="space-y-2 pl-2">
                          {emptyKmClients.length > 0 ? (
                            emptyKmClients.map(renderClientRow)
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4 py-2">No empty KM trips in this period</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No client data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Routes Tab */}
        <TabsContent value="routes" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('routes', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('routes', 'excel', f, t)}
            label="Routes report"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Routes</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Route Profitability Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Performance analysis by route</p>
              </div>
            </div>
            <div className="p-5">
              {routeSummaries.length > 0 ? (
                <div className="space-y-3">
                  {routeSummaries.slice(0, 15).map((route) => (
                    <div key={route.route} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border/50 hover:bg-accent/50 transition-colors gap-3">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-semibold">{route.route}</p>
                          <p className="text-sm text-muted-foreground">{route.tripCount} trips</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 sm:gap-6">
                        <div className="text-center sm:text-right">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <CurrencyDisplay amounts={route.revenue} type="revenue" />
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xs text-muted-foreground">Expenses</p>
                          <CurrencyDisplay amounts={route.expenses} type="expense" />
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xs text-muted-foreground">Profit</p>
                          <CurrencyDisplay amounts={route.profit} type="profit" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No route data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Revenue Types Tab */}
        <TabsContent value="revenue-types" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('revenue-types', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('revenue-types', 'excel', f, t)}
            label="Revenue Types report"
          />
          {/* Real Money banner */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-emerald-700" />
            <div className="flex flex-col gap-3 px-5 py-4 pl-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Real Money</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Verified Revenue</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{revenueTypeSummaries.totals.realTripCount} trip(s) marked as Real Money</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(revenueTypeSummaries.totals.realMoneyAmount)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {revenueTypeSummaries.totals.realMoneyKm.toLocaleString()} km
                </p>
              </div>
            </div>
          </div>

          {/* Funny Money banner */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-amber-700" />
            <div className="flex flex-col gap-3 px-5 py-4 pl-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                  <CircleAlert className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">Funny Money</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Unverified Revenue</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{revenueTypeSummaries.totals.funnyTripCount} trip(s) not marked as Real Money</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatCurrency(revenueTypeSummaries.totals.funnyMoneyAmount)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {revenueTypeSummaries.totals.funnyMoneyKm.toLocaleString()} km
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <ReportExportToolbar
            defaultFrom={effectiveFrom}
            defaultTo={effectiveTo}
            onExportPdf={(f, t) => runReportExport('expenses', 'pdf', f, t)}
            onExportExcel={(f, t) => runReportExport('expenses', 'excel', f, t)}
            label="Expenses report"
          />
          {/* Export buttons */}
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <span className="tabular-nums text-slate-700 dark:text-slate-200">{expenseSummaries.totalEntries}</span> expense entries across <span className="tabular-nums text-slate-700 dark:text-slate-200">{expenseSummaries.byCategory.length}</span> categories
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportExpensesToExcel}
                className="h-9 gap-2 border-emerald-200 bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button
                size="sm"
                onClick={exportExpensesToPDF}
                className="h-9 gap-2 bg-slate-900 font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          {/* Totals summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-rose-500/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Total Expenses (USD)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(expenseSummaries.totals.USD)}</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-slate-500/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Expense Entries</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{expenseSummaries.totalEntries.toLocaleString()}</p>
            </div>
          </div>

          {/* By Category */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Categories</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Expenses by Category</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cost breakdown across expense categories</p>
              </div>
            </div>
            <div className="p-5">
              {expenseSummaries.byCategory.length > 0 ? (
                <div className="space-y-3">
                  {expenseSummaries.byCategory.map((cat) => {
                    const totalAll = expenseSummaries.totals.USD;
                    const catTotal = cat.amounts.USD;
                    const pct = totalAll > 0 ? (catTotal / totalAll) * 100 : 0;
                    return (
                      <div key={cat.category} className="p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-accent/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <DollarSign className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{cat.category}</p>
                              <p className="text-sm text-muted-foreground">{cat.count} entries • {pct.toFixed(1)}% of total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">USD</p>
                            <p className="font-semibold tabular-nums">{formatCurrency(cat.amounts.USD)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No expense data available</p>
                </div>
              )}
            </div>
          </div>

          {/* By Vehicle */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Vehicles</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Expenses by Vehicle</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cost allocation per fleet vehicle</p>
              </div>
            </div>
            <div className="p-5">
              {expenseSummaries.byVehicle.length > 0 ? (
                <div className="space-y-3">
                  {expenseSummaries.byVehicle.map((veh) => {
                    const totalAll = expenseSummaries.totals.USD;
                    const vehTotal = veh.amounts.USD;
                    const pct = totalAll > 0 ? (vehTotal / totalAll) * 100 : 0;
                    return (
                      <div key={veh.vehicle} className="p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-accent/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                              <Truck className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{veh.vehicle}</p>
                              <p className="text-sm text-muted-foreground">{veh.count} entries • {pct.toFixed(1)}% of total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">USD</p>
                            <p className="font-semibold tabular-nums">{formatCurrency(veh.amounts.USD)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No vehicle expense data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Sub-Category Breakdown */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3 border-b border-slate-200/70 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Detailed</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Detailed Sub-Category Breakdown</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Granular expense breakdown by category and sub-category</p>
              </div>
            </div>
            <div className="p-5">
              {expenseSummaries.bySubCategory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
                        <th className="py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Category</th>
                        <th className="py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Sub-Category</th>
                        <th className="py-2.5 px-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Entries</th>
                        <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">USD</th>
                        <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseSummaries.bySubCategory.map((row, idx) => (
                        <tr key={`${row.category}-${row.subCategory}`} className={cn("border-b border-slate-200/70 dark:border-slate-800", idx % 2 === 0 && "bg-slate-50/40 dark:bg-slate-900/20")}>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{row.category}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{row.subCategory}</td>
                          <td className="py-2.5 px-3 text-center tabular-nums text-slate-700 dark:text-slate-200">{row.count}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(row.amounts.USD)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(row.amounts.USD, 'USD')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50/60 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
                        <td className="py-2.5 px-3" colSpan={2}>Total</td>
                        <td className="py-2.5 px-3 text-center tabular-nums">{expenseSummaries.totalEntries}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(expenseSummaries.totals.USD)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(expenseSummaries.totals.USD, 'USD')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No expense data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TripReportsSection;