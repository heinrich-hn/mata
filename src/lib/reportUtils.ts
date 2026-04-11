import { CostEntry, Trip } from '@/types/operations';
import { formatDate } from './formatters';

export interface TripKPIs {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  costPerKm: number | null;
  expenseCount: number;
  currency: string;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
  color: string;
}

export interface MissingReceiptInfo {
  count: number;
  entries: CostEntry[];
}

export interface InvestigationInfo {
  date: string;
  notes: string;
}

export interface ProcessedTripReport {
  trip: Trip;
  costs: CostEntry[];
  kpis: TripKPIs;
  categoryBreakdown: CategoryBreakdown[];
  missingReceipts: MissingReceiptInfo;
  hasInvestigation: boolean;
  investigationInfo?: InvestigationInfo;
}

export const generateReport = (trip: Trip, costs: CostEntry[]): ProcessedTripReport => {
  const tripCosts = costs.filter(cost => cost.trip_id === trip.id);
  const kpis = calculateKPIs(trip, tripCosts);
  const categoryBreakdown = processCostBreakdown(tripCosts);
  const missingReceipts = checkMissingReceipts(tripCosts);
  const hasInvestigation = tripCosts.some(cost => cost.investigation_status === 'pending' || cost.investigation_status === 'in_progress');

  const investigationInfo = hasInvestigation
    ? {
        date: formatDate(tripCosts.find(c => c.investigation_status)?.created_at || new Date()),
        notes: tripCosts.find(c => c.investigation_notes)?.investigation_notes || 'Under investigation',
      }
    : undefined;

  return {
    trip,
    costs: tripCosts,
    kpis,
    categoryBreakdown,
    missingReceipts,
    hasInvestigation,
    investigationInfo,
  };
};

export const calculateKPIs = (trip: Trip, costs: CostEntry[]): TripKPIs => {
  const currency = (trip.revenue_currency as string) || 'USD';
  const totalRevenue = trip.base_revenue || 0;

  // Only sum costs that match the trip's revenue currency for accurate profit calculation
  const costsSameCurrency = costs.filter(cost => {
    const costCurrency = cost.currency || 'USD';
    return costCurrency === currency;
  });
  const totalExpenses = costsSameCurrency.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const costPerKm = trip.distance_km && trip.distance_km > 0
    ? totalExpenses / trip.distance_km
    : null;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    costPerKm,
    expenseCount: costsSameCurrency.length,
    currency,
  };
};

export const processCostBreakdown = (costs: CostEntry[]): CategoryBreakdown[] => {
  const totalExpenses = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);

  if (totalExpenses === 0) return [];

  const categoryTotals = costs.reduce((acc, cost) => {
    const category = cost.category;
    acc[category] = (acc[category] || 0) + Number(cost.amount);
    return acc;
  }, {} as Record<string, number>);

  const categories = Object.keys(categoryTotals);
  const colors = generateColorPalette(categories.length);

  return Object.entries(categoryTotals)
    .map(([category, total], index) => ({
      category,
      total,
      percentage: (total / totalExpenses) * 100,
      color: colors[index],
    }))
    .sort((a, b) => b.total - a.total);
};

export const checkMissingReceipts = (costs: CostEntry[]): MissingReceiptInfo => {
  const missingReceiptEntries = costs.filter(
    cost => !cost.attachments || (Array.isArray(cost.attachments) && cost.attachments.length === 0)
  );

  return {
    count: missingReceiptEntries.length,
    entries: missingReceiptEntries.slice(0, 3), // Show first 3
  };
};

export const generateColorPalette = (count: number): string[] => {
  const colors: string[] = [];
  const goldenRatio = 0.618033988749895;
  let hue = Math.random();

  for (let i = 0; i < count; i++) {
    hue += goldenRatio;
    hue %= 1;
    const saturation = 65 + Math.random() * 10; // 65-75%
    const lightness = 50 + Math.random() * 10; // 50-60%
    colors.push(`hsl(${Math.floor(hue * 360)}, ${saturation}%, ${lightness}%)`);
  }

  return colors;
};