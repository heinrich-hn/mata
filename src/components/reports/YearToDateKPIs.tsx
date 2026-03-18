import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOperations } from '@/contexts/OperationsContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trip } from '@/types/operations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfWeek, format, getISOWeek, getISOWeekYear, parseISO, startOfWeek } from 'date-fns';
import
  {
    Activity,
    AlertTriangle,
    Award,
    BarChart3,
    Calendar,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Download,
    Edit,
    FileText,
    Navigation,
    Save,
    Target,
    TrendingDown,
    TrendingUp,
    X,
    Zap
  } from 'lucide-react';
import React, { useMemo, useState } from 'react';

// Helper functions
const formatCurrency = (amount: number | null | undefined, currency: string = 'ZAR') => {
  if (!amount) return `${currency} 0.00`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatPercentage = (num: number) => {
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
};

const calculateTotalCosts = (costs: { amount?: number }[] | null | undefined) => {
  if (!costs || !Array.isArray(costs)) return 0;
  return costs.reduce((sum, cost) => sum + (cost.amount || 0), 0);
};

interface YTDMetrics {
  year: number;
  totalKms: number;
  ipk: number;
  operationalCpk: number;
  revenue: number;
  ebit: number;
  ebitMargin: number;
  netProfit: number;
  netProfitMargin: number;
  roe: number;
  roic: number;
  lastUpdated: string;
  updatedBy: string;
}

interface WeeklyMetrics {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  totalRevenue: number;
  totalCosts: number;
  dieselCosts: number;
  otherCosts: number;
  grossProfit: number;
  totalKilometers: number;
  ipk: number;
  cpk: number;
  tripCount: number;
  profitMargin: number;
  currency: 'ZAR' | 'USD';
}

interface YearToDateKPIsProps {
  trips: Trip[];
}

const YearToDateKPIs: React.FC<YearToDateKPIsProps> = ({ trips }) => {
  const { dieselRecords } = useOperations();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingYear, setEditingYear] = useState<2024 | 2025 | 2026 | null>(null);
  const [formData, setFormData] = useState<Partial<YTDMetrics>>({});
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Auto-calculate 2026 metrics from live trip and diesel data
  const computed2026Metrics = useMemo(() => {
    const year2026Trips = trips.filter(trip => {
      if (trip.status !== 'completed' && trip.status !== 'paid') return false;
      if (!trip.arrival_date) return false;
      return new Date(trip.arrival_date).getFullYear() === 2026;
    });

    const year2026Diesel = dieselRecords.filter(record => {
      if (!record.date) return false;
      return new Date(record.date).getFullYear() === 2026;
    });

    const totalRevenue = year2026Trips.reduce((sum, trip) => sum + (trip.base_revenue || 0), 0);
    const totalKms = year2026Trips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
    const tripCosts = year2026Trips.reduce((sum, trip) => {
      const costs = calculateTotalCosts(trip.costs);
      const additionalCosts = trip.additional_costs?.reduce((s, c) => s + (c.amount || 0), 0) || 0;
      return sum + costs + additionalCosts;
    }, 0);
    const dieselCosts = year2026Diesel.reduce((sum, record) => sum + (record.total_cost || 0), 0);
    const totalCosts = tripCosts + dieselCosts;

    const ipk = totalKms > 0 ? totalRevenue / totalKms : 0;
    const operationalCpk = totalKms > 0 ? totalCosts / totalKms : 0;
    const grossProfit = totalRevenue - totalCosts;
    const ebitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalKms,
      revenue: totalRevenue,
      ipk,
      operationalCpk,
      ebit: grossProfit,
      ebitMargin,
      netProfit: grossProfit,
      netProfitMargin,
      tripCount: year2026Trips.length,
      totalCosts,
      dieselCosts,
      tripCosts,
    };
  }, [trips, dieselRecords]);

  // Fetch YTD metrics
  const { data: dbYtdMetrics = [], isLoading } = useQuery({
    queryKey: ['ytd-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ytd_metrics')
        .select('*')
        .in('year', [2024, 2025, 2026])
        .order('year', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const ytdData = useMemo(() => {
    const defaultData: Record<number, YTDMetrics> = {
      2026: {
        year: 2026,
        totalKms: 0,
        ipk: 0,
        operationalCpk: 0,
        revenue: 0,
        ebit: 0,
        ebitMargin: 0,
        netProfit: 0,
        netProfitMargin: 0,
        roe: 0,
        roic: 0,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Pending Update'
      },
      2025: {
        year: 2025,
        totalKms: 0,
        ipk: 0,
        operationalCpk: 0,
        revenue: 0,
        ebit: 0,
        ebitMargin: 0,
        netProfit: 0,
        netProfitMargin: 0,
        roe: 0,
        roic: 0,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Pending Update'
      },
      2024: {
        year: 2024,
        totalKms: 0,
        ipk: 0,
        operationalCpk: 0,
        revenue: 0,
        ebit: 0,
        ebitMargin: 0,
        netProfit: 0,
        netProfitMargin: 0,
        roe: 0,
        roic: 0,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Pending Update'
      }
    };

    dbYtdMetrics.forEach((record) => {
      if (record.year in defaultData) {
        defaultData[record.year] = {
          year: record.year,
          totalKms: record.total_kms || 0,
          ipk: record.ipk || 0,
          operationalCpk: record.operational_cpk || 0,
          revenue: record.revenue || 0,
          ebit: record.ebit || 0,
          ebitMargin: record.ebit_margin || 0,
          netProfit: record.net_profit || 0,
          netProfitMargin: record.net_profit_margin || 0,
          roe: record.roe || 0,
          roic: record.roic || 0,
          lastUpdated: record.last_updated || record.updated_at || record.created_at || new Date().toISOString(),
          updatedBy: record.updated_by || 'System'
        };
      }
    });

    // Override 2026 auto-computable fields with live data from trips & diesel records.
    // ROE and ROIC require balance-sheet data so they remain from the DB (manually entered).
    defaultData[2026] = {
      ...defaultData[2026],
      totalKms: computed2026Metrics.totalKms,
      revenue: computed2026Metrics.revenue,
      ipk: computed2026Metrics.ipk,
      operationalCpk: computed2026Metrics.operationalCpk,
      ebit: computed2026Metrics.ebit,
      ebitMargin: computed2026Metrics.ebitMargin,
      netProfit: computed2026Metrics.netProfit,
      netProfitMargin: computed2026Metrics.netProfitMargin,
      lastUpdated: new Date().toISOString(),
      updatedBy: `Auto-calculated · ${computed2026Metrics.tripCount} trips`,
    };

    return defaultData;
  }, [dbYtdMetrics, computed2026Metrics]);

  const saveYtdMutation = useMutation({
    mutationFn: async (data: YTDMetrics) => {
      const safeData = {
        total_kms: data.totalKms || 0,
        ipk: data.ipk || 0,
        operational_cpk: data.operationalCpk || 0,
        revenue: data.revenue || 0,
        ebit: data.ebit || 0,
        ebit_margin: data.ebitMargin || 0,
        net_profit: data.netProfit || 0,
        net_profit_margin: data.netProfitMargin || 0,
        roe: data.roe || 0,
        roic: data.roic || 0,
        last_updated: new Date().toISOString(),
        updated_by: data.updatedBy || 'Current User',
        updated_at: new Date().toISOString()
      };

      const { data: existing } = await supabase
        .from('ytd_metrics')
        .select('id')
        .eq('year', data.year)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('ytd_metrics')
          .update(safeData)
          .eq('year', data.year);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ytd_metrics')
          .insert({
            year: data.year,
            ...safeData
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ytd-metrics'] });
      toast({
        title: 'Metrics Updated',
        description: `${editingYear} metrics have been saved successfully`,
      });
      setShowEditModal(false);
      setEditingYear(null);
      setFormData({});
      setErrors({});
    },
    onError: (error) => {
      toast({
        title: 'Error Saving Metrics',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { weeklyMetricsZAR, weeklyMetricsUSD } = useMemo(() => {
    const completedTrips = trips.filter(trip => {
      if (trip.status !== 'completed' && trip.status !== 'paid') return false;
      if (!trip.arrival_date) return false;
      const tripYear = new Date(trip.arrival_date).getFullYear();
      return tripYear === selectedYear;
    });

    const yearDieselRecords = dieselRecords.filter(record => {
      if (!record.date) return false;
      const recordYear = new Date(record.date).getFullYear();
      return recordYear === selectedYear;
    });

    const createEmptyWeek = (weekStart: Date, weekEnd: Date, weekNum: number, currency: 'ZAR' | 'USD'): WeeklyMetrics => ({
      weekNumber: weekNum,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      totalRevenue: 0,
      totalCosts: 0,
      dieselCosts: 0,
      otherCosts: 0,
      grossProfit: 0,
      totalKilometers: 0,
      ipk: 0,
      cpk: 0,
      tripCount: 0,
      profitMargin: 0,
      currency
    });

    const zarData: Record<string, WeeklyMetrics> = {};
    const usdData: Record<string, WeeklyMetrics> = {};

    completedTrips.forEach(trip => {
      const offloadDate = trip.arrival_date;
      if (!offloadDate) return;

      const date = parseISO(offloadDate);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(date);
      const year = getISOWeekYear(date);

      if (year !== selectedYear) return;

      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      const currency = trip.revenue_currency || 'ZAR';
      const targetData = currency === 'USD' ? usdData : zarData;

      if (!targetData[weekKey]) {
        targetData[weekKey] = createEmptyWeek(weekStart, weekEnd, weekNumber, currency);
      }

      const week = targetData[weekKey];
      const tripCosts = calculateTotalCosts(trip.costs);
      const additionalCosts = trip.additional_costs?.reduce((sum, cost) => sum + (cost.amount || 0), 0) || 0;
      const totalTripCosts = tripCosts + additionalCosts;

      week.totalRevenue += trip.base_revenue || 0;
      week.otherCosts += totalTripCosts;
      week.totalKilometers += trip.distance_km || 0;
      week.tripCount += 1;
    });

    yearDieselRecords.forEach(record => {
      if (!record.date) return;

      const date = parseISO(record.date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(date);
      const year = getISOWeekYear(date);

      if (year !== selectedYear) return;

      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      const currency = (record.currency?.toUpperCase() === 'USD' ? 'USD' : 'ZAR') as 'ZAR' | 'USD';
      const targetData = currency === 'USD' ? usdData : zarData;

      if (!targetData[weekKey]) {
        targetData[weekKey] = createEmptyWeek(weekStart, weekEnd, weekNumber, currency);
      }

      const week = targetData[weekKey];
      week.dieselCosts += record.total_cost || 0;
    });

    const calculateWeekTotals = (data: Record<string, WeeklyMetrics>) => {
      Object.values(data).forEach(week => {
        week.totalCosts = week.dieselCosts + week.otherCosts;
        week.grossProfit = week.totalRevenue - week.totalCosts;
        week.ipk = week.totalKilometers > 0 ? week.totalRevenue / week.totalKilometers : 0;
        week.cpk = week.totalKilometers > 0 ? week.totalCosts / week.totalKilometers : 0;
        week.profitMargin = week.totalRevenue > 0 ? (week.grossProfit / week.totalRevenue) * 100 : 0;
      });
      return Object.values(data).sort((a, b) =>
        new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
      );
    };

    return {
      weeklyMetricsZAR: calculateWeekTotals(zarData),
      weeklyMetricsUSD: calculateWeekTotals(usdData)
    };
  }, [trips, dieselRecords, selectedYear]);

  const current2026 = ytdData[2026];
  const current2025 = ytdData[2025];
  const previous2024 = ytdData[2024];

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, percentage: 0 };
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { value: change, percentage };
  };

  const kmsChange2026 = calculateChange(current2026.totalKms, current2025.totalKms);
  const ipkChange2026 = calculateChange(current2026.ipk, current2025.ipk);
  const cpkChange2026 = calculateChange(current2026.operationalCpk, current2025.operationalCpk);
  const revenueChange2026 = calculateChange(current2026.revenue, current2025.revenue);
  const ebitChange2026 = calculateChange(current2026.ebit, current2025.ebit);
  const netProfitChange2026 = calculateChange(current2026.netProfit, current2025.netProfit);
  const roeChange2026 = calculateChange(current2026.roe, current2025.roe);
  const roicChange2026 = calculateChange(current2026.roic, current2025.roic);

  const kmsChange = calculateChange(current2025.totalKms, previous2024.totalKms);
  const ipkChange = calculateChange(current2025.ipk, previous2024.ipk);
  const cpkChange = calculateChange(current2025.operationalCpk, previous2024.operationalCpk);
  const revenueChange = calculateChange(current2025.revenue, previous2024.revenue);
  const ebitChange = calculateChange(current2025.ebit, previous2024.ebit);
  const netProfitChange = calculateChange(current2025.netProfit, previous2024.netProfit);
  const roeChange = calculateChange(current2025.roe, previous2024.roe);
  const roicChange = calculateChange(current2025.roic, previous2024.roic);

  const handleEdit = (year: 2024 | 2025 | 2026) => {
    setEditingYear(year);
    setFormData({ ...ytdData[year] });
    setShowEditModal(true);
  };

  const handleChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: numValue }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // For 2026, core metrics are auto-calculated from trips — only validate ROE/ROIC if provided
    if (editingYear !== 2026) {
      if (!formData.totalKms || formData.totalKms <= 0) {
        newErrors.totalKms = 'Total KMs must be greater than 0';
      }
      if (!formData.revenue || formData.revenue <= 0) {
        newErrors.revenue = 'Revenue must be greater than 0';
      }
      if (!formData.ipk || formData.ipk <= 0) {
        newErrors.ipk = 'IPK must be greater than 0';
      }
      if (!formData.operationalCpk || formData.operationalCpk <= 0) {
        newErrors.operationalCpk = 'Operational CPK must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!editingYear || !validateForm()) return;

    const updatedData = {
      ...formData,
      year: editingYear,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Current User'
    } as YTDMetrics;

    saveYtdMutation.mutate(updatedData);
  };

  const handleClose = () => {
    setShowEditModal(false);
    setEditingYear(null);
    setFormData({});
    setErrors({});
  };

  const exportWeeklyReport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "WEEKLY REVENUE REPORTING - AUTOMATED CYCLE\n";
    csvContent += `Generated on,${new Date().toLocaleDateString()}\n`;
    csvContent += `Year,${selectedYear}\n\n`;

    if (weeklyMetricsZAR.length > 0) {
      csvContent += "=== ZAR TRANSACTIONS ===\n";
      csvContent += "Week Number,Week Start,Week End,Trip Count,Total Revenue (ZAR),Diesel Costs (ZAR),Other Costs (ZAR),Total Costs (ZAR),Gross Profit (ZAR),Profit Margin %,Total KM,IPK,CPK\n";
      weeklyMetricsZAR.forEach(week => {
        csvContent += `${week.weekNumber},"${week.weekStart}","${week.weekEnd}",${week.tripCount},${week.totalRevenue.toFixed(2)},${week.dieselCosts.toFixed(2)},${week.otherCosts.toFixed(2)},${week.totalCosts.toFixed(2)},${week.grossProfit.toFixed(2)},${week.profitMargin.toFixed(2)},${week.totalKilometers},${week.ipk.toFixed(3)},${week.cpk.toFixed(3)}\n`;
      });
      csvContent += "\n";
    }

    if (weeklyMetricsUSD.length > 0) {
      csvContent += "=== USD TRANSACTIONS ===\n";
      csvContent += "Week Number,Week Start,Week End,Trip Count,Total Revenue (USD),Diesel Costs (USD),Other Costs (USD),Total Costs (USD),Gross Profit (USD),Profit Margin %,Total KM,IPK,CPK\n";
      weeklyMetricsUSD.forEach(week => {
        csvContent += `${week.weekNumber},"${week.weekStart}","${week.weekEnd}",${week.tripCount},${week.totalRevenue.toFixed(2)},${week.dieselCosts.toFixed(2)},${week.otherCosts.toFixed(2)},${week.totalCosts.toFixed(2)},${week.grossProfit.toFixed(2)},${week.profitMargin.toFixed(2)},${week.totalKilometers},${week.ipk.toFixed(3)},${week.cpk.toFixed(3)}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `weekly-revenue-report-${selectedYear}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  interface MetricCardProps {
    title: string;
    current2026: number;
    current2025: number;
    previous2024: number;
    change2026vs2025: { value: number; percentage: number };
    change2025vs2024: { value: number; percentage: number };
    format?: 'number' | 'currency' | 'percentage';
    suffix?: string;
    icon: React.ElementType;
    description?: string;
  }

  const MetricCard: React.FC<MetricCardProps> = ({
    title,
    current2026,
    current2025,
    previous2024,
    change2026vs2025,
    change2025vs2024,
    format = 'number',
    suffix = '',
    icon: Icon,
    description
  }) => {
    const formatValue = (value: number) => {
      switch (format) {
        case 'currency':
          return formatCurrency(value, 'USD');
        case 'percentage':
          return `${value.toFixed(1)}%`;
        default:
          return formatNumber(value);
      }
    };

    const isGoodChange2026 = title.includes('Operational') || title.includes('Cost')
      ? change2026vs2025.percentage < 0
      : change2026vs2025.percentage > 0;
    const isGoodChange2025 = title.includes('Operational') || title.includes('Cost')
      ? change2025vs2024.percentage < 0
      : change2025vs2024.percentage > 0;

    return (
      <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* 2026 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-muted-foreground">2026 YTD</span>
                {change2026vs2025.percentage !== 0 && (
                  <Badge variant={isGoodChange2026 ? "default" : "destructive"} className={`text-xs ${isGoodChange2026 ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10' : ''}`}>
                    {isGoodChange2026 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {formatPercentage(change2026vs2025.percentage)}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatValue(current2026)}{suffix}
              </div>
            </div>

            {/* 2025 */}
            <div className="pt-3 border-t border-border/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-muted-foreground">2025 YTD</span>
                {change2025vs2024.percentage !== 0 && (
                  <span className={`text-xs font-medium ${isGoodChange2025 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatPercentage(change2025vs2024.percentage)}
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold tabular-nums">
                {formatValue(current2025)}{suffix}
              </div>
            </div>

            {/* 2024 */}
            <div className="pt-3 border-t border-border/60">
              <div className="text-sm font-medium text-muted-foreground mb-1">2024 YTD</div>
              <div className="text-base font-medium text-muted-foreground tabular-nums">
                {formatValue(previous2024)}{suffix}
              </div>
            </div>
          </div>
      </div>
    );
  };

  const PerformanceCard: React.FC<{
    title: string;
    value: number;
    change: number;
    format: 'currency' | 'percentage' | 'number';
    icon: React.ElementType;
    color: string;
  }> = ({ title, value, change, format, icon: Icon, color }) => {
    const isPositive = change > 0;
    const displayValue = format === 'currency'
      ? formatCurrency(value, 'USD')
      : format === 'percentage'
      ? `${value.toFixed(1)}%`
      : formatNumber(value);

    return (
      <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color === 'text-green-600' ? 'bg-emerald-500/10' : color === 'text-blue-600' ? 'bg-blue-500/10' : color === 'text-purple-600' ? 'bg-violet-500/10' : 'bg-amber-500/10'}`}>
            <Icon className={`w-5 h-5 ${color === 'text-green-600' ? 'text-emerald-600' : color === 'text-blue-600' ? 'text-blue-600' : color === 'text-purple-600' ? 'text-violet-600' : 'text-amber-600'}`} />
          </div>
          <Badge variant={isPositive ? "default" : "destructive"} className={`text-xs ${isPositive ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10' : ''}`}>
            {isPositive ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            {formatPercentage(change)}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums">{displayValue}</p>
          <p className="text-xs text-muted-foreground">Year-over-Year Change</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading performance metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Glass Toolbar */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Year-to-Date KPIs & Metrics</span>
            <Badge variant="secondary" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              2024 & 2025 manual
            </Badge>
            <Badge className="text-xs bg-blue-500/10 text-blue-700 hover:bg-blue-500/10 border-blue-300/40" variant="outline">
              <Zap className="w-3 h-3 mr-1" />
              2026 live · {computed2026Metrics.tripCount} trips
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-sm" onClick={() => handleEdit(2024)}>
                    <Edit className="w-4 h-4" />
                    2024
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit 2024 metrics</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-sm" onClick={() => handleEdit(2025)}>
                    <Edit className="w-4 h-4" />
                    2025
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit 2025 metrics</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-9 gap-2 text-sm bg-blue-600 hover:bg-blue-700" onClick={() => handleEdit(2026)}>
                    <Edit className="w-4 h-4" />
                    2026 Returns
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enter ROE & ROIC for 2026 (other fields are auto-calculated)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-auto bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-1.5 shadow-sm mb-4">
          <TabsTrigger value="overview" className="rounded-lg px-3.5 py-2 text-sm font-medium gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-lg px-3.5 py-2 text-sm font-medium gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600">
            <Calendar className="w-4 h-4" />
            Weekly Reports
          </TabsTrigger>
          <TabsTrigger value="insights" className="rounded-lg px-3.5 py-2 text-sm font-medium gap-2 data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-600">
            <Target className="w-4 h-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Performance Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PerformanceCard
              title="Revenue Growth"
              value={revenueChange.value}
              change={revenueChange.percentage}
              format="currency"
              icon={TrendingUp}
              color="text-green-600"
            />
            <PerformanceCard
              title="Profit Margin"
              value={current2025.netProfitMargin}
              change={calculateChange(current2025.netProfitMargin, previous2024.netProfitMargin).percentage}
              format="percentage"
              icon={Award}
              color="text-blue-600"
            />
            <PerformanceCard
              title="Operational Efficiency"
              value={current2025.operationalCpk}
              change={cpkChange.percentage}
              format="currency"
              icon={Zap}
              color="text-purple-600"
            />
            <PerformanceCard
              title="Distance Covered"
              value={current2025.totalKms}
              change={kmsChange.percentage}
              format="number"
              icon={Navigation}
              color="text-orange-600"
            />
          </div>

          {/* Key Metrics Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Key Performance Indicators</h2>
              <p className="text-sm text-muted-foreground">3-Year Comparison</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Total Kilometers"
                current2026={current2026.totalKms}
                current2025={current2025.totalKms}
                previous2024={previous2024.totalKms}
                change2026vs2025={kmsChange2026}
                change2025vs2024={kmsChange}
                icon={Navigation}
                description="Total distance covered"
              />

              <MetricCard
                title="Income Per KM"
                current2026={current2026.ipk}
                current2025={current2025.ipk}
                previous2024={previous2024.ipk}
                change2026vs2025={ipkChange2026}
                change2025vs2024={ipkChange}
                format="currency"
                icon={DollarSign}
                description="Revenue per kilometer"
              />

              <MetricCard
                title="Operational Cost Per KM"
                current2026={current2026.operationalCpk}
                current2025={current2025.operationalCpk}
                previous2024={previous2024.operationalCpk}
                change2026vs2025={cpkChange2026}
                change2025vs2024={cpkChange}
                format="currency"
                icon={TrendingDown}
                description="Cost efficiency metric"
              />

              <MetricCard
                title="Total Revenue"
                current2026={current2026.revenue}
                current2025={current2025.revenue}
                previous2024={previous2024.revenue}
                change2026vs2025={revenueChange2026}
                change2025vs2024={revenueChange}
                format="currency"
                icon={DollarSign}
                description="Gross revenue"
              />

              <MetricCard
                title="Net Profit"
                current2026={current2026.netProfit}
                current2025={current2025.netProfit}
                previous2024={previous2024.netProfit}
                change2026vs2025={netProfitChange2026}
                change2025vs2024={netProfitChange}
                format="currency"
                icon={Award}
                description="Bottom line performance"
              />

              <MetricCard
                title="EBIT Margin"
                current2026={current2026.ebitMargin}
                current2025={current2025.ebitMargin}
                previous2024={previous2024.ebitMargin}
                change2026vs2025={ebitChange2026}
                change2025vs2024={ebitChange}
                format="percentage"
                icon={BarChart3}
                description="Operating profitability"
              />
            </div>
          </div>

          {/* Financial Ratios */}
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
              <Target className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">Financial Ratios & Returns</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Net Profit Margin"
                  current2026={current2026.netProfitMargin}
                  current2025={current2025.netProfitMargin}
                  previous2024={previous2024.netProfitMargin}
                  change2026vs2025={calculateChange(current2026.netProfitMargin, current2025.netProfitMargin)}
                  change2025vs2024={calculateChange(current2025.netProfitMargin, previous2024.netProfitMargin)}
                  format="percentage"
                  icon={Target}
                />

                <MetricCard
                  title="Return on Equity"
                  current2026={current2026.roe}
                  current2025={current2025.roe}
                  previous2024={previous2024.roe}
                  change2026vs2025={roeChange2026}
                  change2025vs2024={roeChange}
                  format="percentage"
                  icon={TrendingUp}
                />

                <MetricCard
                  title="Return on Invested Capital"
                  current2026={current2026.roic}
                  current2025={current2025.roic}
                  previous2024={previous2024.roic}
                  change2026vs2025={roicChange2026}
                  change2025vs2024={roicChange}
                  format="percentage"
                  icon={Activity}
                />

                <MetricCard
                  title="EBIT Margin"
                  current2026={current2026.ebitMargin}
                  current2025={current2025.ebitMargin}
                  previous2024={previous2024.ebitMargin}
                  change2026vs2025={calculateChange(current2026.ebitMargin, current2025.ebitMargin)}
                  change2025vs2024={calculateChange(current2025.ebitMargin, previous2024.ebitMargin)}
                  format="percentage"
                  icon={BarChart3}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Weekly Reports Tab */}
        <TabsContent value="weekly" className="space-y-5">
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Automated Weekly Revenue Reporting</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fixed weekly cycle (Monday to Sunday) based on trip offloading dates and diesel transactions
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                    <SelectTrigger className="w-[120px] h-9 text-sm">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={exportWeeklyReport} className="h-9 gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    Export Report
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-5">
              {/* Information Panel */}
              <div className="bg-emerald-500/5 border border-emerald-300/30 rounded-xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-2">Calculation Methodology</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span>Revenue: Base revenue from completed trips</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span>Diesel Costs: From diesel_records by fill date</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span>Cycle: Monday to Sunday weekly rollover</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span>IPK/CPK: Calculated per total kilometers</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ZAR Section */}
              {weeklyMetricsZAR.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                        ZAR
                      </Badge>
                      <h3 className="font-semibold">South African Rand Transactions</h3>
                    </div>
                    <span className="text-sm text-muted-foreground">{weeklyMetricsZAR.length} weeks</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Week</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Period</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Trips</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Revenue</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Profit</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margin</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">IPK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyMetricsZAR.slice(0, 8).map((week) => (
                          <tr key={`zar-${week.weekStart}`} className="border-t border-border/50 hover:bg-accent/50">
                            <td className="py-3 px-4">
                              <div className="font-medium">Week {week.weekNumber}</div>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' - '}
                              {new Date(week.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant="outline">{week.tripCount}</Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {formatCurrency(week.totalRevenue, 'ZAR')}
                            </td>
                            <td className={`py-3 px-4 text-right font-medium tabular-nums ${week.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCurrency(week.grossProfit, 'ZAR')}
                            </td>
                            <td className={`py-3 px-4 text-right font-medium tabular-nums ${week.profitMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {week.profitMargin.toFixed(1)}%
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              {formatCurrency(week.ipk, 'ZAR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* USD Section */}
              {weeklyMetricsUSD.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/10">
                        USD
                      </Badge>
                      <h3 className="font-semibold">US Dollar Transactions</h3>
                    </div>
                    <span className="text-sm text-muted-foreground">{weeklyMetricsUSD.length} weeks</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Week</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Period</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Trips</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Revenue</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Profit</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margin</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">IPK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyMetricsUSD.slice(0, 8).map((week) => (
                          <tr key={`usd-${week.weekStart}`} className="border-t border-border/50 hover:bg-accent/50">
                            <td className="py-3 px-4">
                              <div className="font-medium">Week {week.weekNumber}</div>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' - '}
                              {new Date(week.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant="outline">{week.tripCount}</Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {formatCurrency(week.totalRevenue, 'USD')}
                            </td>
                            <td className={`py-3 px-4 text-right font-medium tabular-nums ${week.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCurrency(week.grossProfit, 'USD')}
                            </td>
                            <td className={`py-3 px-4 text-right font-medium tabular-nums ${week.profitMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {week.profitMargin.toFixed(1)}%
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              {formatCurrency(week.ipk, 'USD')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {weeklyMetricsZAR.length === 0 && weeklyMetricsUSD.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No data for {selectedYear}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Weekly metrics will appear here once trips are completed or diesel transactions are recorded.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Operational Insights */}
            <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
                <Zap className="w-5 h-5 text-violet-600" />
                <span className="font-semibold">Operational Efficiency</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-violet-500/5 border border-violet-300/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cost per KM Trend</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">
                        {formatCurrency(current2025.operationalCpk, 'USD')}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cpkChange.percentage < 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {cpkChange.percentage < 0 ? (
                        <TrendingDown className="w-5 h-5" />
                      ) : (
                        <TrendingUp className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {cpkChange.percentage < 0 ? 'Improved' : 'Increased'} by {Math.abs(cpkChange.percentage).toFixed(1)}% from previous year
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <span className="text-sm font-medium">Distance Coverage</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-violet-600 tabular-nums">
                        +{kmsChange.value.toLocaleString()} km
                      </span>
                      <p className="text-xs text-muted-foreground tabular-nums">{kmsChange.percentage.toFixed(1)}% increase</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <span className="text-sm font-medium">Revenue per KM</span>
                    <div className="text-right">
                      <span className={`text-lg font-bold tabular-nums ${ipkChange.percentage > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(ipkChange.value, 'USD')}
                      </span>
                      <p className="text-xs text-muted-foreground tabular-nums">{ipkChange.percentage.toFixed(1)}% change</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Insights */}
            <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold">Financial Performance</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-emerald-500/5 border border-emerald-300/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Net Profit Growth</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">
                        {formatCurrency(netProfitChange.value, 'USD')}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Increased by {netProfitChange.percentage.toFixed(0)}% year-over-year
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <span className="text-sm font-medium">Revenue Growth</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-600 tabular-nums">
                        +{formatCurrency(revenueChange.value, 'USD')}
                      </span>
                      <p className="text-xs text-muted-foreground tabular-nums">{revenueChange.percentage.toFixed(1)}% increase</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <span className="text-sm font-medium">Return on Equity</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-600 tabular-nums">
                        {current2025.roe.toFixed(1)}%
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {roeChange.percentage > 0 ? '+' : ''}{roeChange.percentage.toFixed(1)}% from {previous2024.roe.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Insights */}
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
              <Target className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">Performance Insights</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-blue-500/5 border border-blue-300/30 rounded-xl p-4">
                  <div className="text-sm font-medium text-blue-700 mb-2">Strong Growth</div>
                  <p className="text-sm text-muted-foreground">
                    Revenue increased by {revenueChange.percentage.toFixed(1)}% year-over-year
                  </p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-300/30 rounded-xl p-4">
                  <div className="text-sm font-medium text-emerald-700 mb-2">Profitability</div>
                  <p className="text-sm text-muted-foreground">
                    Net profit margin at {current2025.netProfitMargin.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-violet-500/5 border border-violet-300/30 rounded-xl p-4">
                  <div className="text-sm font-medium text-violet-700 mb-2">Efficiency</div>
                  <p className="text-sm text-muted-foreground">
                    {cpkChange.percentage < 0 ? 'Cost reduction' : 'Cost increase'} of {Math.abs(cpkChange.percentage).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-amber-500/5 border border-amber-300/30 rounded-xl p-4">
                  <div className="text-sm font-medium text-amber-700 mb-2">Scale</div>
                  <p className="text-sm text-muted-foreground">
                    {kmsChange.percentage.toFixed(1)}% increase in distance coverage
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingYear === 2026 ? '2026 Returns — Manual Entry' : `Edit ${editingYear} YTD Metrics`}
            </DialogTitle>
            <DialogDescription>
              {editingYear === 2026
                ? 'Revenue, KMs and costs are auto-calculated from completed trips. Enter Return on Equity and ROIC below.'
                : `Update strategic metrics for ${editingYear}. These values are updated monthly on the 15th.`}
            </DialogDescription>
          </DialogHeader>

          {formData && editingYear && (
            <div className="space-y-6">
              {editingYear === 2026 ? (
                <div className="bg-blue-500/5 border border-blue-300/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold">2026 — Live Auto-Calculated Data</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Revenue, KMs, costs, IPK, CPK and profit figures are computed automatically from {computed2026Metrics.tripCount} completed trip{computed2026Metrics.tripCount !== 1 ? 's' : ''} and diesel records.
                        Only <strong>Return on Equity</strong> and <strong>Return on Invested Capital</strong> require manual entry (balance-sheet data).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/5 border border-amber-300/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold">Monthly Strategic Update</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        These metrics are independent of trip-based calculations and should reflect comprehensive financial analysis.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { id: 'totalKms', label: 'Total Kilometers', type: 'number', step: '1', autoCalc: true },
                  { id: 'ipk', label: 'Income Per KM (USD)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'operationalCpk', label: 'Operational Cost Per KM (USD)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'revenue', label: 'Total Revenue (USD)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'ebit', label: 'EBIT (USD)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'ebitMargin', label: 'EBIT Margin (%)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'netProfit', label: 'Net Profit (USD)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'netProfitMargin', label: 'Net Profit Margin (%)', type: 'number', step: '0.01', autoCalc: true },
                  { id: 'roe', label: 'Return on Equity (%)', type: 'number', step: '0.01', autoCalc: false },
                  { id: 'roic', label: 'Return on Invested Capital (%)', type: 'number', step: '0.01', autoCalc: false },
                ].map((field) => {
                  const isReadOnly = editingYear === 2026 && field.autoCalc;
                  return (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="flex items-center gap-2">
                        {field.label}
                        {isReadOnly && (
                          <Badge variant="secondary" className="text-xs font-normal py-0">
                            <Zap className="w-2.5 h-2.5 mr-1" />Auto
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id={field.id}
                        type={field.type}
                        step={field.step}
                        value={isReadOnly
                          ? (computed2026Metrics as Record<string, number>)[field.id]?.toFixed(field.step === '1' ? 0 : 2) || '0'
                          : formData[field.id as keyof YTDMetrics]?.toString() || ''
                        }
                        onChange={(e) => !isReadOnly && handleChange(field.id, e.target.value)}
                        readOnly={isReadOnly}
                        className={`${errors[field.id] ? 'border-destructive' : ''} ${isReadOnly ? 'bg-muted/40 text-muted-foreground cursor-default' : ''}`}
                      />
                      {errors[field.id] && (
                        <p className="text-sm text-destructive">{errors[field.id]}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={saveYtdMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveYtdMutation.isPending}
                  className="min-w-[160px]"
                >
                  {saveYtdMutation.isPending ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingYear === 2026 ? 'Save 2026 Returns' : `Save ${editingYear} Metrics`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default YearToDateKPIs;