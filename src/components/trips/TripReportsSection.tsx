import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CostEntry, Trip } from '@/types/operations';
import
  {
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
import
  {
    Building,
    Calendar,
    CalendarRange,
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

interface TripReportsSectionProps {
  trips: Trip[];
  costEntries: CostEntry[];
}

interface CurrencyAmounts {
  ZAR: number;
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
  const hasZAR = amounts.ZAR !== 0;
  const hasUSD = amounts.USD !== 0;

  if (!hasZAR && !hasUSD) {
    return <span className="text-muted-foreground">-</span>;
  }

  const getColorClass = (value: number) => {
    if (type === 'revenue') return 'text-green-600';
    if (type === 'expense') return 'text-red-600';
    if (type === 'profit') return value >= 0 ? 'text-emerald-600' : 'text-orange-600';
    return '';
  };

  return (
    <div className="space-y-0.5">
      {hasZAR && (
        <div className={cn('font-semibold', getColorClass(amounts.ZAR))}>
          {formatCurrency(amounts.ZAR, 'ZAR')}
        </div>
      )}
      {hasUSD && (
        <div className={cn('font-semibold', getColorClass(amounts.USD))}>
          {formatCurrency(amounts.USD, 'USD')}
        </div>
      )}
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
      ZAR: tripCosts
        .filter(cost => cost.currency === 'ZAR')
        .reduce((sum, cost) => sum + Number(cost.amount || 0), 0),
      USD: tripCosts
        .filter(cost => (cost.currency || 'USD') === 'USD')
        .reduce((sum, cost) => sum + Number(cost.amount || 0), 0),
    };
  }, [costEntries]);

  // Overall Summary Stats
  const overallStats = useMemo(() => {
    const revenueZAR = filteredTrips
      .filter(t => t.revenue_currency === 'ZAR')
      .reduce((sum, t) => sum + (t.base_revenue || 0), 0);
    const revenueUSD = filteredTrips
      .filter(t => (t.revenue_currency || 'USD') === 'USD')
      .reduce((sum, t) => sum + (t.base_revenue || 0), 0);

    let expensesZAR = 0;
    let expensesUSD = 0;
    filteredTrips.forEach(t => {
      const costs = getTripCostsByCurrency(t.id);
      expensesZAR += costs.ZAR;
      expensesUSD += costs.USD;
    });

    const profitZAR = revenueZAR - expensesZAR;
    const profitUSD = revenueUSD - expensesUSD;
    const totalKm = filteredTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
    const completedTrips = filteredTrips.filter(t => t.status === 'completed').length;

    return {
      totalTrips: filteredTrips.length,
      completedTrips,
      activeTrips: filteredTrips.length - completedTrips,
      revenue: { ZAR: revenueZAR, USD: revenueUSD },
      expenses: { ZAR: expensesZAR, USD: expensesUSD },
      profit: { ZAR: profitZAR, USD: profitUSD },
      totalKm,
      hasUSD: revenueUSD > 0 || expensesUSD > 0,
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
        revenue: { ZAR: 0, USD: 0 },
        expenses: { ZAR: 0, USD: 0 },
        profit: { ZAR: 0, USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as 'ZAR' | 'USD';
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.ZAR += tripCosts.ZAR;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.ZAR = existing.revenue.ZAR - existing.expenses.ZAR;
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
        revenue: { ZAR: 0, USD: 0 },
        expenses: { ZAR: 0, USD: 0 },
        profit: { ZAR: 0, USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as 'ZAR' | 'USD';
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      if (trip.status === 'completed') existing.completedTrips += 1;
      else existing.activeTrips += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.ZAR += tripCosts.ZAR;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.ZAR = existing.revenue.ZAR - existing.expenses.ZAR;
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
        revenue: { ZAR: 0, USD: 0 },
        expenses: { ZAR: 0, USD: 0 },
        profit: { ZAR: 0, USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as 'ZAR' | 'USD';
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      if (trip.status === 'completed') existing.completedTrips += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.ZAR += tripCosts.ZAR;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.ZAR = existing.revenue.ZAR - existing.expenses.ZAR;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;

      driverMap.set(driverName, existing);
    });

    return Array.from(driverMap.values()).sort((a, b) => (b.revenue.ZAR + b.revenue.USD) - (a.revenue.ZAR + a.revenue.USD));
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
        revenue: { ZAR: 0, USD: 0 },
        expenses: { ZAR: 0, USD: 0 },
        profit: { ZAR: 0, USD: 0 },
        totalKm: 0,
        emptyKm: 0,
        lastTripDate: '',
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as 'ZAR' | 'USD';
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      if (trip.status === 'completed') existing.completedTrips += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.ZAR += tripCosts.ZAR;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.ZAR = existing.revenue.ZAR - existing.expenses.ZAR;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;
      existing.emptyKm += trip.empty_km || 0;

      if (trip.departure_date && (!existing.lastTripDate || trip.departure_date > existing.lastTripDate)) {
        existing.lastTripDate = trip.departure_date;
      }

      clientMap.set(clientName, existing);
    });

    return Array.from(clientMap.values()).sort((a, b) => (b.revenue.ZAR + b.revenue.USD) - (a.revenue.ZAR + a.revenue.USD));
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
        revenue: { ZAR: 0, USD: 0 },
        expenses: { ZAR: 0, USD: 0 },
        profit: { ZAR: 0, USD: 0 },
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as 'ZAR' | 'USD';
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.ZAR += tripCosts.ZAR;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.ZAR = existing.revenue.ZAR - existing.expenses.ZAR;
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
        revenue: { ZAR: 0, USD: 0 },
        expenses: { ZAR: 0, USD: 0 },
        profit: { ZAR: 0, USD: 0 },
        totalKm: 0,
      };

      const tripCosts = getTripCostsByCurrency(trip.id);
      const tripCurrency = (trip.revenue_currency || 'USD') as 'ZAR' | 'USD';
      const revenue = trip.base_revenue || 0;

      existing.tripCount += 1;
      existing.revenue[tripCurrency] += revenue;
      existing.expenses.ZAR += tripCosts.ZAR;
      existing.expenses.USD += tripCosts.USD;
      existing.profit.ZAR = existing.revenue.ZAR - existing.expenses.ZAR;
      existing.profit.USD = existing.revenue.USD - existing.expenses.USD;
      existing.totalKm += trip.distance_km || 0;

      truckMap.set(fleetNumber, existing);
    });

    return Array.from(truckMap.values()).sort((a, b) => (b.revenue.ZAR + b.revenue.USD) - (a.revenue.ZAR + a.revenue.USD));
  }, [filteredTrips, getTripCostsByCurrency]);

  // Expense summaries - group cost entries by category for filtered trips
  const expenseSummaries = useMemo(() => {
    const filteredTripIds = new Set(filteredTrips.map(t => t.id));
    const filteredCosts = costEntries.filter(c => filteredTripIds.has(c.trip_id));

    // By category
    const categoryMap = new Map<string, { category: string; count: number; amounts: CurrencyAmounts }>();
    filteredCosts.forEach(cost => {
      const cat = cost.category || 'Uncategorized';
      const existing = categoryMap.get(cat) || { category: cat, count: 0, amounts: { ZAR: 0, USD: 0 } };
      existing.count += 1;
      const currency = (cost.currency || 'USD') as 'ZAR' | 'USD';
      existing.amounts[currency] += Number(cost.amount || 0);
      categoryMap.set(cat, existing);
    });
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => (b.amounts.ZAR + b.amounts.USD) - (a.amounts.ZAR + a.amounts.USD));

    // By sub-category (within each category)
    const subCatMap = new Map<string, { category: string; subCategory: string; count: number; amounts: CurrencyAmounts }>();
    filteredCosts.forEach(cost => {
      const cat = cost.category || 'Uncategorized';
      const sub = cost.sub_category || 'General';
      const key = `${cat}||${sub}`;
      const existing = subCatMap.get(key) || { category: cat, subCategory: sub, count: 0, amounts: { ZAR: 0, USD: 0 } };
      existing.count += 1;
      const currency = (cost.currency || 'USD') as 'ZAR' | 'USD';
      existing.amounts[currency] += Number(cost.amount || 0);
      subCatMap.set(key, existing);
    });
    const bySubCategory = Array.from(subCatMap.values()).sort((a, b) => (b.amounts.ZAR + b.amounts.USD) - (a.amounts.ZAR + a.amounts.USD));

    // By vehicle
    const vehicleMap = new Map<string, { vehicle: string; count: number; amounts: CurrencyAmounts }>();
    filteredCosts.forEach(cost => {
      const vehicle = cost.vehicle_identifier || 'Unknown';
      const existing = vehicleMap.get(vehicle) || { vehicle, count: 0, amounts: { ZAR: 0, USD: 0 } };
      existing.count += 1;
      const currency = (cost.currency || 'USD') as 'ZAR' | 'USD';
      existing.amounts[currency] += Number(cost.amount || 0);
      vehicleMap.set(vehicle, existing);
    });
    const byVehicle = Array.from(vehicleMap.values()).sort((a, b) => (b.amounts.ZAR + b.amounts.USD) - (a.amounts.ZAR + a.amounts.USD));

    // Totals
    const totals: CurrencyAmounts = { ZAR: 0, USD: 0 };
    filteredCosts.forEach(cost => {
      const currency = (cost.currency || 'USD') as 'ZAR' | 'USD';
      totals[currency] += Number(cost.amount || 0);
    });

    return { byCategory, bySubCategory, byVehicle, totals, totalEntries: filteredCosts.length, rawCosts: filteredCosts };
  }, [filteredTrips, costEntries]);

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
      const marginZAR = overallStats.revenue.ZAR > 0 ? ((overallStats.profit.ZAR / overallStats.revenue.ZAR) * 100).toFixed(2) + '%' : '0%';
      const marginUSD = overallStats.revenue.USD > 0 ? ((overallStats.profit.USD / overallStats.revenue.USD) * 100).toFixed(2) + '%' : '0%';

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
        ['Revenue (ZAR)', overallStats.revenue.ZAR],
        ['Expenses (ZAR)', overallStats.expenses.ZAR],
        ['Net Profit (ZAR)', overallStats.profit.ZAR],
        ['Profit Margin (ZAR)', marginZAR],
        ['Revenue (USD)', overallStats.revenue.USD],
        ['Expenses (USD)', overallStats.expenses.USD],
        ['Net Profit (USD)', overallStats.profit.USD],
        ['Profit Margin (USD)', marginUSD],
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
      cWs.getRow(1).values = ['Client', 'Trips', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'];
      styleHeader(cWs, 1);
      clientSummaries.forEach((c, i) => {
        cWs.getRow(i + 2).values = [c.clientName, c.tripCount, c.revenue.ZAR, c.revenue.USD, c.expenses.ZAR, c.expenses.USD, c.profit.ZAR, c.profit.USD];
      });
      styleData(cWs, 2, clientSummaries.length, [3,4,5,6,7,8]);
      addTotalsRow(cWs, clientSummaries.length + 2, [
        'TOTAL', clientSummaries.reduce((s,c) => s+c.tripCount, 0),
        clientSummaries.reduce((s,c) => s+c.revenue.ZAR, 0), clientSummaries.reduce((s,c) => s+c.revenue.USD, 0),
        clientSummaries.reduce((s,c) => s+c.expenses.ZAR, 0), clientSummaries.reduce((s,c) => s+c.expenses.USD, 0),
        clientSummaries.reduce((s,c) => s+c.profit.ZAR, 0), clientSummaries.reduce((s,c) => s+c.profit.USD, 0),
      ], [3,4,5,6,7,8]);
      cWs.autoFilter = { from: 'A1', to: `H${clientSummaries.length + 1}` };
      cWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(cWs);

      // ═══ BY DRIVER ═══
      const dWs = wb.addWorksheet('By Driver');
      dWs.getRow(1).values = ['Driver', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'];
      styleHeader(dWs, 1);
      driverSummaries.forEach((d, i) => {
        dWs.getRow(i + 2).values = [d.driverName, d.tripCount, d.totalKm, d.revenue.ZAR, d.revenue.USD, d.expenses.ZAR, d.expenses.USD, d.profit.ZAR, d.profit.USD];
      });
      styleData(dWs, 2, driverSummaries.length, [4,5,6,7,8,9]);
      addTotalsRow(dWs, driverSummaries.length + 2, [
        'TOTAL', driverSummaries.reduce((s,d) => s+d.tripCount, 0), driverSummaries.reduce((s,d) => s+d.totalKm, 0),
        driverSummaries.reduce((s,d) => s+d.revenue.ZAR, 0), driverSummaries.reduce((s,d) => s+d.revenue.USD, 0),
        driverSummaries.reduce((s,d) => s+d.expenses.ZAR, 0), driverSummaries.reduce((s,d) => s+d.expenses.USD, 0),
        driverSummaries.reduce((s,d) => s+d.profit.ZAR, 0), driverSummaries.reduce((s,d) => s+d.profit.USD, 0),
      ], [4,5,6,7,8,9]);
      dWs.autoFilter = { from: 'A1', to: `I${driverSummaries.length + 1}` };
      dWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(dWs);

      // ═══ BY TRUCK ═══
      const tWs = wb.addWorksheet('By Truck');
      tWs.getRow(1).values = ['Truck', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'];
      styleHeader(tWs, 1);
      truckSummaries.forEach((t, i) => {
        tWs.getRow(i + 2).values = [t.fleetNumber, t.tripCount, t.totalKm, t.revenue.ZAR, t.revenue.USD, t.expenses.ZAR, t.expenses.USD, t.profit.ZAR, t.profit.USD];
      });
      styleData(tWs, 2, truckSummaries.length, [4,5,6,7,8,9]);
      addTotalsRow(tWs, truckSummaries.length + 2, [
        'TOTAL', truckSummaries.reduce((s,t) => s+t.tripCount, 0), truckSummaries.reduce((s,t) => s+t.totalKm, 0),
        truckSummaries.reduce((s,t) => s+t.revenue.ZAR, 0), truckSummaries.reduce((s,t) => s+t.revenue.USD, 0),
        truckSummaries.reduce((s,t) => s+t.expenses.ZAR, 0), truckSummaries.reduce((s,t) => s+t.expenses.USD, 0),
        truckSummaries.reduce((s,t) => s+t.profit.ZAR, 0), truckSummaries.reduce((s,t) => s+t.profit.USD, 0),
      ], [4,5,6,7,8,9]);
      tWs.autoFilter = { from: 'A1', to: `I${truckSummaries.length + 1}` };
      tWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(tWs);

      // ═══ WEEKLY ═══
      const wWs = wb.addWorksheet('Weekly');
      wWs.getRow(1).values = ['Week', 'Year', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'];
      styleHeader(wWs, 1);
      weeklySummaries.forEach((w, i) => {
        wWs.getRow(i + 2).values = [w.weekNumber, w.year, w.tripCount, w.totalKm, w.revenue.ZAR, w.revenue.USD, w.expenses.ZAR, w.expenses.USD, w.profit.ZAR, w.profit.USD];
      });
      styleData(wWs, 2, weeklySummaries.length, [5,6,7,8,9,10]);
      wWs.autoFilter = { from: 'A1', to: `J${weeklySummaries.length + 1}` };
      wWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(wWs);

      // ═══ MONTHLY ═══
      const mWs = wb.addWorksheet('Monthly');
      mWs.getRow(1).values = ['Month', 'Year', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'];
      styleHeader(mWs, 1);
      monthlySummaries.forEach((m, i) => {
        mWs.getRow(i + 2).values = [m.monthName, m.year, m.tripCount, m.totalKm, m.revenue.ZAR, m.revenue.USD, m.expenses.ZAR, m.expenses.USD, m.profit.ZAR, m.profit.USD];
      });
      styleData(mWs, 2, monthlySummaries.length, [5,6,7,8,9,10]);
      mWs.autoFilter = { from: 'A1', to: `J${monthlySummaries.length + 1}` };
      mWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(mWs);

      // ═══ BY ROUTE ═══
      const rWs = wb.addWorksheet('By Route');
      rWs.getRow(1).values = ['Route', 'Origin', 'Destination', 'Trips', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'];
      styleHeader(rWs, 1);
      routeSummaries.forEach((r, i) => {
        rWs.getRow(i + 2).values = [r.route, r.origin, r.destination, r.tripCount, r.revenue.ZAR, r.revenue.USD, r.expenses.ZAR, r.expenses.USD, r.profit.ZAR, r.profit.USD];
      });
      styleData(rWs, 2, routeSummaries.length, [5,6,7,8,9,10]);
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
        ['Total (ZAR)', expenseSummaries.totals.ZAR],
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
      catWs.getRow(1).values = ['Category', 'Entries', 'Amount (ZAR)', 'Amount (USD)'];
      styleH(catWs, 1);
      expenseSummaries.byCategory.forEach((c, i) => {
        catWs.getRow(i + 2).values = [c.category, c.count, c.amounts.ZAR, c.amounts.USD];
      });
      styleD(catWs, 2, expenseSummaries.byCategory.length, [3,4]);
      catWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(catWs);

      // By Sub-Category
      const subWs = wb.addWorksheet('By Sub-Category');
      subWs.getRow(1).values = ['Category', 'Sub-Category', 'Entries', 'Amount (ZAR)', 'Amount (USD)'];
      styleH(subWs, 1);
      expenseSummaries.bySubCategory.forEach((s, i) => {
        subWs.getRow(i + 2).values = [s.category, s.subCategory, s.count, s.amounts.ZAR, s.amounts.USD];
      });
      styleD(subWs, 2, expenseSummaries.bySubCategory.length, [4,5]);
      subWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoW(subWs);

      // By Vehicle
      const vWs = wb.addWorksheet('By Vehicle');
      vWs.getRow(1).values = ['Vehicle', 'Entries', 'Amount (ZAR)', 'Amount (USD)'];
      styleH(vWs, 1);
      expenseSummaries.byVehicle.forEach((v, i) => {
        vWs.getRow(i + 2).values = [v.vehicle, v.count, v.amounts.ZAR, v.amounts.USD];
      });
      styleD(vWs, 2, expenseSummaries.byVehicle.length, [3,4]);
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
          ['ZAR', formatCurrency(expenseSummaries.totals.ZAR, 'ZAR')],
          ['USD', formatCurrency(expenseSummaries.totals.USD, 'USD')],
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
        head: [['Category', 'Entries', 'Amount (ZAR)', 'Amount (USD)']],
        body: expenseSummaries.byCategory.map(c => [
          c.category,
          c.count.toString(),
          formatCurrency(c.amounts.ZAR, 'ZAR'),
          formatCurrency(c.amounts.USD, 'USD'),
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
        head: [['Vehicle', 'Entries', 'Amount (ZAR)', 'Amount (USD)']],
        body: expenseSummaries.byVehicle.map(v => [
          v.vehicle,
          v.count.toString(),
          formatCurrency(v.amounts.ZAR, 'ZAR'),
          formatCurrency(v.amounts.USD, 'USD'),
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

  return (
    <div className="space-y-5">
      {/* Glass Toolbar */}
      <div className="flex flex-col gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">Performance insights for {filteredTrips.length} trips</span>
          <div className="flex items-center gap-2.5">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[180px] h-9 text-sm bg-background/80 border-border/50 rounded-lg">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
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
                    <CalendarRange className="w-3.5 h-3.5" />
                    Custom Range
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9 gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {selectedPeriod === 'custom' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 pt-1 border-t border-border/40">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo}
                  className="h-9 w-[160px] text-sm"
                />
              </div>
              <span className="text-muted-foreground mt-5">→</span>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom}
                  className="h-9 w-[160px] text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Trips</p>
              <p className="text-xl font-bold tabular-nums">{overallStats.totalTrips}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(overallStats.revenue.ZAR, 'ZAR')}</p>
              {overallStats.revenue.USD > 0 && (
                <p className="text-sm font-semibold text-emerald-600/70 tabular-nums">{formatCurrency(overallStats.revenue.USD, 'USD')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses</p>
              <p className="text-lg font-bold text-rose-600 tabular-nums">{formatCurrency(overallStats.expenses.ZAR, 'ZAR')}</p>
              {overallStats.expenses.USD > 0 && (
                <p className="text-sm font-semibold text-rose-600/70 tabular-nums">{formatCurrency(overallStats.expenses.USD, 'USD')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center",
              overallStats.profit.ZAR >= 0 ? "bg-emerald-500/10" : "bg-orange-500/10"
            )}>
              {overallStats.profit.ZAR >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Profit (ZAR)</p>
              <p className={cn(
                "text-lg font-bold tabular-nums",
                overallStats.profit.ZAR >= 0 ? "text-emerald-600" : "text-orange-600"
              )}>{formatCurrency(overallStats.profit.ZAR, 'ZAR')}</p>
              {overallStats.hasUSD && (
                <p className={cn(
                  "text-sm font-semibold tabular-nums",
                  overallStats.profit.USD >= 0 ? "text-emerald-600/70" : "text-orange-600/70"
                )}>{formatCurrency(overallStats.profit.USD, 'USD')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total KM</p>
              <p className="text-lg font-bold tabular-nums">{overallStats.totalKm.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Reports Tabs */}
      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-1.5 shadow-sm h-auto inline-flex">
          <TabsTrigger value="monthly" className="rounded-lg px-3.5 py-2 text-sm font-medium">Monthly</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-lg px-3.5 py-2 text-sm font-medium">Weekly</TabsTrigger>
          <TabsTrigger value="trucks" className="rounded-lg px-3.5 py-2 text-sm font-medium">Trucks</TabsTrigger>
          <TabsTrigger value="drivers" className="rounded-lg px-3.5 py-2 text-sm font-medium">Drivers</TabsTrigger>
          <TabsTrigger value="clients" className="rounded-lg px-3.5 py-2 text-sm font-medium">Clients</TabsTrigger>
          <TabsTrigger value="routes" className="rounded-lg px-3.5 py-2 text-sm font-medium">Routes</TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg px-3.5 py-2 text-sm font-medium">Expenses</TabsTrigger>
        </TabsList>

        {/* Monthly Summary Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Monthly Performance Summary
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Revenue, expenses and profit breakdown by month</p>
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
                        {month.revenue.ZAR > 0 && (
                          <div className="mt-3">
                            <Progress
                              value={Math.min(100, Math.max(0, (month.profit.ZAR / month.revenue.ZAR) * 100))}
                              className={cn("h-2", month.profit.ZAR >= 0 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-orange-500")}
                            />
                          </div>
                        )}
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
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Weekly Performance Summary
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Detailed week-by-week breakdown</p>
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
          <TruckReportsTab trips={filteredTrips} costEntries={costEntries} />
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers" className="space-y-4">
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Driver Performance Report
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Revenue and profit contribution by driver</p>
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
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Client Revenue Report
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Revenue breakdown by client</p>
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
                          revenueZAR: acc.revenueZAR + c.revenue.ZAR,
                          revenueUSD: acc.revenueUSD + c.revenue.USD,
                          totalKm: acc.totalKm + c.totalKm,
                          emptyKm: acc.emptyKm + c.emptyKm,
                        }),
                        { trips: 0, revenueZAR: 0, revenueUSD: 0, totalKm: 0, emptyKm: 0 }
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
                              {summary.revenueUSD > 0 && summary.revenueZAR > 0 ? ' + ' : ''}
                              {summary.revenueZAR > 0 ? `R${summary.revenueZAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}
                              {summary.revenueUSD === 0 && summary.revenueZAR === 0 ? '$0.00' : ''}
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
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Route Profitability Report
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Performance analysis by route</p>
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

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          {/* Export buttons */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {expenseSummaries.totalEntries} expense entries across {expenseSummaries.byCategory.length} categories
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportExpensesToExcel} className="h-9 gap-2 bg-background/80 border-border/50 rounded-lg hover:bg-accent/80 transition-colors">
                <Download className="w-4 h-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportExpensesToPDF} className="h-9 gap-2 bg-background/80 border-border/50 rounded-lg hover:bg-accent/80 transition-colors">
                <FileText className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </div>

          {/* Totals summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1">Total Expenses (ZAR)</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(expenseSummaries.totals.ZAR, 'ZAR')}</p>
            </div>
            <div className="p-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1">Total Expenses (USD)</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(expenseSummaries.totals.USD, 'USD')}</p>
            </div>
            <div className="p-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1">Expense Entries</p>
              <p className="text-xl font-bold tabular-nums">{expenseSummaries.totalEntries}</p>
            </div>
          </div>

          {/* By Category */}
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Expenses by Category
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Cost breakdown across expense categories</p>
            </div>
            <div className="p-5">
              {expenseSummaries.byCategory.length > 0 ? (
                <div className="space-y-3">
                  {expenseSummaries.byCategory.map((cat) => {
                    const totalAll = expenseSummaries.totals.ZAR + expenseSummaries.totals.USD;
                    const catTotal = cat.amounts.ZAR + cat.amounts.USD;
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
                          <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">ZAR</p>
                              <p className="font-semibold tabular-nums">{formatCurrency(cat.amounts.ZAR, 'ZAR')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">USD</p>
                              <p className="font-semibold tabular-nums">{formatCurrency(cat.amounts.USD, 'USD')}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Progress value={pct} className="h-1.5" />
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
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Expenses by Vehicle
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Cost allocation per fleet vehicle</p>
            </div>
            <div className="p-5">
              {expenseSummaries.byVehicle.length > 0 ? (
                <div className="space-y-3">
                  {expenseSummaries.byVehicle.map((veh) => {
                    const totalAll = expenseSummaries.totals.ZAR + expenseSummaries.totals.USD;
                    const vehTotal = veh.amounts.ZAR + veh.amounts.USD;
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
                          <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">ZAR</p>
                              <p className="font-semibold tabular-nums">{formatCurrency(veh.amounts.ZAR, 'ZAR')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">USD</p>
                              <p className="font-semibold tabular-nums">{formatCurrency(veh.amounts.USD, 'USD')}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Progress value={pct} className="h-1.5" />
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
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Detailed Sub-Category Breakdown
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Granular expense breakdown by category and sub-category</p>
            </div>
            <div className="p-5">
              {expenseSummaries.bySubCategory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Category</th>
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Sub-Category</th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Entries</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">ZAR</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseSummaries.bySubCategory.map((row, idx) => (
                        <tr key={`${row.category}-${row.subCategory}`} className={cn("border-b border-border/30", idx % 2 === 0 && "bg-accent/20")}>
                          <td className="py-2.5 px-3 font-medium">{row.category}</td>
                          <td className="py-2.5 px-3">{row.subCategory}</td>
                          <td className="py-2.5 px-3 text-center tabular-nums">{row.count}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(row.amounts.ZAR, 'ZAR')}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(row.amounts.USD, 'USD')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/60 font-semibold">
                        <td className="py-2.5 px-3" colSpan={2}>Total</td>
                        <td className="py-2.5 px-3 text-center tabular-nums">{expenseSummaries.totalEntries}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(expenseSummaries.totals.ZAR, 'ZAR')}</td>
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