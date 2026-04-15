import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  generateAllFleetsDieselExcel,
  generateAllFleetsDieselPDF,
  generateFleetDieselExcel,
  generateFleetDieselPDF,
  generateStyledDieselExcel,
  generateComprehensiveDieselPDF,
  generateYearlyWeeklyDieselExcel,
  type DieselExportRecord,
  type ExportSheetSelection,
} from '@/lib/dieselFleetExport';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import type { DieselConsumptionRecord, DieselNorms } from '@/types/operations';
import { BarChart3, Calendar, CalendarRange, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Fuel, Snowflake, Truck, User } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// Report data types
interface DriverReport {
  driver: string;
  totalLitres: number;
  totalCost: number;
  totalDistance: number;
  avgKmPerLitre: number;
  fillCount: number;
  lastFillDate: string;
}

interface ReeferDriverReport {
  driver: string;
  totalLitres: number;
  totalCost: number;
  fillCount: number;
  lastFillDate: string;
  fleets: string[];
  avgLitresPerHour: number;
  totalHoursOperated: number;
}

interface FleetReport {
  fleet: string;
  totalLitres: number;
  totalCost: number;
  totalDistance: number;
  avgKmPerLitre: number;
  fillCount: number;
  drivers: string[];
}

interface ReeferFleetReport {
  fleet: string;
  totalLitres: number;
  totalCost: number;
  fillCount: number;
  drivers: string[];
  avgLitresPerHour: number;
  totalHoursOperated: number;
}

interface StationReport {
  station: string;
  totalLitres: number;
  totalCost: number;
  avgCostPerLitre: number;
  fillCount: number;
  fleetsServed: string[];
}

interface WeeklyFleetData {
  fleet: string;
  totalLitres: number;
  totalKm: number;
  consumption: number | null;
  totalHours: number;
  reeferConsumption: number | null;
  totalCost: number;
}

interface WeeklySectionData {
  name: string;
  fleets: string[];
  isReeferSection: boolean;
  data: WeeklyFleetData[];
  sectionTotal: { totalLitres: number; totalKm: number; consumption: number | null; totalHours: number; reeferConsumption: number | null; totalCost: number; };
}

interface WeeklyReport {
  weekNumber: number;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  sections: WeeklySectionData[];
  grandTotal: { totalLitres: number; totalKm: number; consumption: number | null; totalCost: number; };
}

// Fleet category definitions
const FLEET_CATEGORIES: Record<string, string[]> = {
  '30 Ton Trucks': ['21H', '22H', '23H', '24H', '26H', '28H', '31H', '32H', '33H', '34H'],
  'Reefers (L/H)': ['4F', '5F', '6F', '7F', '8F', '9F'],
  'Farm Lmv': ['1H', '4H', '6H'],
  'Bulawayo Truck': ['29H'],
  'Nyamagay Truck': ['30H'],
};

const REEFER_SECTION_NAME = 'Reefers (L/H)';
const isReeferFleet = (fleet?: string | null) => !!fleet && fleet.toUpperCase().trim().endsWith('F');

// Shared week-boundary helpers
const _wkStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};
const _wkNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dn = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7);
};
const _wkLabel = (start: Date, end: Date): string => {
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-ZA', o)} \u2013 ${end.toLocaleDateString('en-ZA', o)}`;
};

interface DieselReportsTabProps {
  dieselRecords: DieselConsumptionRecord[];
  dieselNorms: DieselNorms[];
  truckRecords: DieselConsumptionRecord[];
  reeferRecords: DieselConsumptionRecord[];
  reeferFleetNumbers: string[];
  reeferLhrMap: Map<string, { avgLitresPerHour: number; totalHoursOperated: number }>;
}

const DieselReportsTab = ({
  dieselRecords,
  dieselNorms,
  truckRecords,
  reeferRecords,
  reeferFleetNumbers,
  reeferLhrMap,
}: DieselReportsTabProps) => {
  const getNormForFleet = (fleetNumber: string): DieselNorms | undefined => {
    return dieselNorms.find(norm => norm.fleet_number === fleetNumber);
  };
  const [reportType, setReportType] = useState<'driver' | 'fleet' | 'station' | 'weekly' | 'reefer'>('fleet');
  const [reportPeriod, setReportPeriod] = useState<string>('3months');
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [reportDateFrom, setReportDateFrom] = useState(thirtyDaysAgoStr);
  const [reportDateTo, setReportDateTo] = useState(todayStr);

  const [weeklyView, setWeeklyView] = useState(false);
  const [expandedBreakdownWeeks, setExpandedBreakdownWeeks] = useState<Set<string>>(new Set());
  const toggleBreakdownWeek = (weekKey: string) =>
    setExpandedBreakdownWeeks(prev => {
      const n = new Set(prev);
      if (n.has(weekKey)) { n.delete(weekKey); } else { n.add(weekKey); }
      return n;
    });

  const [expandedReportWeeks, setExpandedReportWeeks] = useState<Set<string>>(new Set());
  const toggleReportWeekExpanded = (weekKey: string) => {
    setExpandedReportWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekKey)) { newSet.delete(weekKey); } else { newSet.add(weekKey); }
      return newSet;
    });
  };

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [exportSel, setExportSel] = useState<ExportSheetSelection>({
    overview: true, truckByDriver: true, truckByFleet: true, truckByStation: true,
    weekly: true, reeferByFleet: true, reeferByDriver: true, reeferByStation: true,
    truckTransactions: false, reeferTransactions: false,
  });
  const [isExporting, setIsExporting] = useState(false);

  const toggleSheet = (key: keyof ExportSheetSelection) =>
    setExportSel(prev => ({ ...prev, [key]: !prev[key] }));

  const filterByPeriod = useCallback((records: DieselConsumptionRecord[]) => {
    if (reportPeriod === 'all') return records;
    let fromDate: string;
    if (reportPeriod === 'custom') {
      return records.filter(r => r.date >= reportDateFrom && r.date <= reportDateTo);
    }
    const now = new Date();
    switch (reportPeriod) {
      case '1month': fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0]; break;
      case '3months': fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0]; break;
      case '6months': fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0]; break;
      case '1year': fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0]; break;
      default: return records;
    }
    return records.filter(r => r.date >= fromDate && r.date <= todayStr);
  }, [reportPeriod, reportDateFrom, reportDateTo, todayStr]);

  const filteredTruckRecords = useMemo(() => filterByPeriod(truckRecords), [truckRecords, filterByPeriod]);
  const filteredReeferRecords = useMemo(() => filterByPeriod(reeferRecords), [reeferRecords, filterByPeriod]);

  const driverReports = useMemo((): DriverReport[] => {
    const driverMap = new Map<string, DriverReport>();

    filteredTruckRecords.forEach(record => {
      const driver = record.driver_name || 'Unknown Driver';
      const existing = driverMap.get(driver);

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCost += (record.total_cost || 0);
        existing.totalDistance += record.distance_travelled || 0;
        existing.fillCount += 1;
        if (record.date > existing.lastFillDate) existing.lastFillDate = record.date;
      } else {
        driverMap.set(driver, {
          driver,
          totalLitres: record.litres_filled || 0,
          totalCost: (record.total_cost || 0),

          totalDistance: record.distance_travelled || 0,
          avgKmPerLitre: 0,
          fillCount: 1,
          lastFillDate: record.date,
        });
      }
    });

    // Calculate averages
    driverMap.forEach(report => {
      report.avgKmPerLitre = report.totalLitres > 0 ? report.totalDistance / report.totalLitres : 0;
    });

    return Array.from(driverMap.values()).sort((a, b) => b.totalLitres - a.totalLitres);
  }, [filteredTruckRecords]);

  const reeferDriverReports = useMemo((): ReeferDriverReport[] => {
    const driverMap = new Map<string, ReeferDriverReport>();

    filteredReeferRecords.forEach(record => {
      const driver = record.driver_name || 'Unknown Driver';
      const existing = driverMap.get(driver);
      const fleet = record.fleet_number;

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCost += (record.total_cost || 0);
        existing.fillCount += 1;
        if (record.date > existing.lastFillDate) existing.lastFillDate = record.date;
        if (fleet && !existing.fleets.includes(fleet)) existing.fleets.push(fleet);
      } else {
        driverMap.set(driver, {
          driver,
          totalLitres: record.litres_filled || 0,
          totalCost: (record.total_cost || 0),

          fillCount: 1,
          lastFillDate: record.date,
          fleets: fleet ? [fleet] : [],
          avgLitresPerHour: 0,
          totalHoursOperated: 0,
        });
      }
    });

    // Enrich with L/hr data: compute from per-record data, fall back to reefer consumption summary
    driverMap.forEach((report) => {
      let totalHrs = 0;
      let totalLitresWithHours = 0;
      report.fleets.forEach(fleet => {
        const fleetRecs = filteredReeferRecords.filter(r => r.fleet_number === fleet);
        fleetRecs.forEach(r => {

          const hrs = r.hours_operated;
          if (hrs != null && hrs > 0) {
            totalHrs += hrs;
            totalLitresWithHours += r.litres_filled || 0;
          }
        });
      });
      if (totalHrs > 0) {
        report.totalHoursOperated = totalHrs;
        report.avgLitresPerHour = totalLitresWithHours / totalHrs;
      } else {
        // Fall back to consumption summary map
        let totalLph = 0;
        let lphCount = 0;
        report.fleets.forEach(fleet => {
          const lhrData = reeferLhrMap.get(fleet);
          if (lhrData && lhrData.avgLitresPerHour > 0) {
            totalLph += lhrData.avgLitresPerHour;
            lphCount += 1;
            report.totalHoursOperated += lhrData.totalHoursOperated;
          }
        });
        if (lphCount > 0) {
          report.avgLitresPerHour = totalLph / lphCount;
        }
      }
    });

    return Array.from(driverMap.values()).sort((a, b) => b.totalLitres - a.totalLitres);
  }, [filteredReeferRecords, reeferLhrMap]);

  // Generate reports by fleet
  const fleetReports = useMemo((): FleetReport[] => {
    const fleetMap = new Map<string, FleetReport>();

    filteredTruckRecords.forEach(record => {
      const fleet = record.fleet_number;
      const existing = fleetMap.get(fleet);
      const driver = record.driver_name || 'Unknown';

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCost += (record.total_cost || 0);
        existing.totalDistance += record.distance_travelled || 0;
        existing.fillCount += 1;
        if (!existing.drivers.includes(driver)) existing.drivers.push(driver);
      } else {
        fleetMap.set(fleet, {
          fleet,
          totalLitres: record.litres_filled || 0,
          totalCost: (record.total_cost || 0),

          totalDistance: record.distance_travelled || 0,
          avgKmPerLitre: 0,
          fillCount: 1,
          drivers: [driver],
        });
      }
    });

    // Calculate averages
    fleetMap.forEach(report => {
      report.avgKmPerLitre = report.totalLitres > 0 ? report.totalDistance / report.totalLitres : 0;
    });

    return Array.from(fleetMap.values()).sort((a, b) => b.totalLitres - a.totalLitres);
  }, [filteredTruckRecords]);

  const reeferFleetReports = useMemo((): ReeferFleetReport[] => {
    const fleetMap = new Map<string, ReeferFleetReport>();

    filteredReeferRecords.forEach(record => {
      const fleet = record.fleet_number;
      const existing = fleetMap.get(fleet);
      const driver = record.driver_name || 'Unknown';

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCost += (record.total_cost || 0);
        existing.fillCount += 1;
        if (!existing.drivers.includes(driver)) existing.drivers.push(driver);
      } else {
        fleetMap.set(fleet, {
          fleet,
          totalLitres: record.litres_filled || 0,
          totalCost: (record.total_cost || 0),

          fillCount: 1,
          drivers: [driver],
          avgLitresPerHour: 0,
          totalHoursOperated: 0,
        });
      }
    });

    // Enrich with L/hr data: prefer per-record data, fall back to reefer consumption summary
    fleetMap.forEach((report) => {
      // Calculate from per-record hours_operated and litres
      const fleetRecs = filteredReeferRecords.filter(r => r.fleet_number === report.fleet);

      const recsWithHours = fleetRecs.filter(r => r.hours_operated != null && r.hours_operated > 0);
      if (recsWithHours.length > 0) {

        const totalHrs = recsWithHours.reduce((sum, r) => sum + (r.hours_operated || 0), 0);
        const totalLitresWithHours = recsWithHours.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
        report.totalHoursOperated = totalHrs;
        report.avgLitresPerHour = totalHrs > 0 ? totalLitresWithHours / totalHrs : 0;
      } else {
        // Fall back to consumption summary map
        const lhrData = reeferLhrMap.get(report.fleet);
        if (lhrData) {
          report.avgLitresPerHour = lhrData.avgLitresPerHour;
          report.totalHoursOperated = lhrData.totalHoursOperated;
        }
      }
    });

    return Array.from(fleetMap.values()).sort((a, b) => b.totalLitres - a.totalLitres);
  }, [filteredReeferRecords, reeferLhrMap]);

  // Generate reports by filling station
  const stationReports = useMemo((): StationReport[] => {
    const stationMap = new Map<string, StationReport>();

    filteredTruckRecords.forEach(record => {
      const station = record.fuel_station || 'Unknown Station';
      const existing = stationMap.get(station);
      const fleet = record.fleet_number;

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCost += (record.total_cost || 0);
        existing.fillCount += 1;
        if (!existing.fleetsServed.includes(fleet)) existing.fleetsServed.push(fleet);
      } else {
        stationMap.set(station, {
          station,
          totalLitres: record.litres_filled || 0,
          totalCost: (record.total_cost || 0),

          avgCostPerLitre: 0,
          fillCount: 1,
          fleetsServed: [fleet],
        });
      }
    });

    // Calculate averages
    stationMap.forEach(report => {
      report.avgCostPerLitre = report.totalLitres > 0 ? report.totalCost / report.totalLitres : 0;
    });

    return Array.from(stationMap.values()).sort((a, b) => b.totalLitres - a.totalLitres);
  }, [filteredTruckRecords]);

  const reeferStationReports = useMemo((): StationReport[] => {
    const stationMap = new Map<string, StationReport>();

    filteredReeferRecords.forEach(record => {
      const station = record.fuel_station || 'Unknown Station';
      const existing = stationMap.get(station);
      const fleet = record.fleet_number;

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCost += (record.total_cost || 0);
        existing.fillCount += 1;
        if (!existing.fleetsServed.includes(fleet)) existing.fleetsServed.push(fleet);
      } else {
        stationMap.set(station, {
          station,
          totalLitres: record.litres_filled || 0,
          totalCost: (record.total_cost || 0),

          avgCostPerLitre: 0,
          fillCount: 1,
          fleetsServed: [fleet],
        });
      }
    });

    stationMap.forEach(report => {
      report.avgCostPerLitre = report.totalLitres > 0 ? report.totalCost / report.totalLitres : 0;
    });

    return Array.from(stationMap.values()).sort((a, b) => b.totalLitres - a.totalLitres);
  }, [filteredReeferRecords]);

  // Generate weekly consumption report by fleet categories
  const weeklyReports = useMemo((): WeeklyReport[] => {
    // Helper to get week start (Monday) from a date
    const getWeekStart = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // Helper to get ISO week number
    const getWeekNumber = (date: Date): number => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    // Helper to format week label (dates only)
    const formatWeekLabel = (start: Date, end: Date): string => {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      return `${start.toLocaleDateString('en-ZA', options)} - ${end.toLocaleDateString('en-ZA', options)}`;
    };

    // Group truck records by week
    const weekMap = new Map<string, { weekStart: Date; weekEnd: Date; truckRecords: typeof dieselRecords; reeferRecs: typeof reeferRecords }>();

    // Add truck records (non-reefer from dieselRecords)
    dieselRecords.filter(r => !isReeferFleet(r.fleet_number)).forEach(record => {
      const recordDate = new Date(record.date);
      // Apply report period filter
      const dateStr = record.date;
      if (reportPeriod !== 'all') {
        if (reportPeriod === 'custom') {
          if (dateStr < reportDateFrom || dateStr > reportDateTo) return;
        } else {
          const now = new Date();
          let fromDate: string;
          switch (reportPeriod) {
            case '1month': fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0]; break;
            case '3months': fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0]; break;
            case '6months': fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0]; break;
            case '1year': fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0]; break;
            default: fromDate = '1900-01-01';
          }
          if (dateStr < fromDate) return;
          const todayStr = now.toISOString().split('T')[0];
          if (dateStr > todayStr) return;
        }
      }
      const weekStart = getWeekStart(recordDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { weekStart, weekEnd, truckRecords: [], reeferRecs: [] });
      }
      weekMap.get(weekKey)!.truckRecords.push(record);
    });

    // Add reefer records (from merged reeferRecords which includes both legacy + new)
    filteredReeferRecords.forEach(record => {
      const recordDate = new Date(record.date);
      const weekStart = getWeekStart(recordDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { weekStart, weekEnd, truckRecords: [], reeferRecs: [] });
      }
      weekMap.get(weekKey)!.reeferRecs.push(record);
    });

    // Build weekly reports with sections
    const reports: WeeklyReport[] = [];
    const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])); // Most recent first

    for (const [_weekKey, { weekStart, weekEnd, truckRecords: weekTruckRecords, reeferRecs: weekReeferRecords }] of sortedWeeks) {
      const sections: WeeklySectionData[] = [];
      let grandTotalLitres = 0;
      let grandTotalKm = 0;
      let grandTotalCost = 0;

      for (const [sectionName, fleetList] of Object.entries(FLEET_CATEGORIES)) {
        const isReeferSection = sectionName === REEFER_SECTION_NAME;
        const sectionFleetList = isReeferSection ? reeferFleetNumbers : fleetList;
        const sectionData: WeeklyFleetData[] = [];
        let sectionTotalLitres = 0;
        let sectionTotalKm = 0;
        let sectionTotalHours = 0;
        let sectionTotalCost = 0;

        if (isReeferSection) {
          // Use merged reefer records for the reefer section
          for (const fleet of sectionFleetList) {
            const fleetRecords = weekReeferRecords.filter(r => r.fleet_number === fleet);
            if (fleetRecords.length > 0) {
              const totalLitres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);

              const totalHours = fleetRecords.reduce((sum, r) => sum + (r.hours_operated || 0), 0);
              const totalCost = fleetRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
              const reeferConsumption = totalHours > 0 ? totalLitres / totalHours : null;

              sectionData.push({ fleet, totalLitres, totalKm: 0, consumption: null, totalHours, reeferConsumption, totalCost });
              sectionTotalLitres += totalLitres;
              sectionTotalHours += totalHours;
              sectionTotalCost += totalCost;
            }
          }
        } else {
          // Use truck records for non-reefer sections
          const sectionRecords = weekTruckRecords.filter(r => fleetList.includes(r.fleet_number));
          for (const fleet of sectionFleetList) {
            const fleetRecords = sectionRecords.filter(r => r.fleet_number === fleet);
            if (fleetRecords.length > 0) {
              const totalLitres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
              const totalKm = fleetRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
              const totalCost = fleetRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
              const consumption = totalLitres > 0 ? totalKm / totalLitres : null;

              sectionData.push({ fleet, totalLitres, totalKm, consumption, totalHours: 0, reeferConsumption: null, totalCost });
              sectionTotalLitres += totalLitres;
              sectionTotalKm += totalKm;
              sectionTotalCost += totalCost;
            }
          }
        }

        // Add fleets with 0 litres if they're in the category (to show all fleets)
        for (const fleet of sectionFleetList) {
          if (!sectionData.find(d => d.fleet === fleet)) {
            sectionData.push({ fleet, totalLitres: 0, totalKm: 0, consumption: null, totalHours: 0, reeferConsumption: null, totalCost: 0 });
          }
        }

        // Sort by fleet number naturally
        sectionData.sort((a, b) => {
          const numA = parseInt(a.fleet.replace(/\D/g, '')) || 999;
          const numB = parseInt(b.fleet.replace(/\D/g, '')) || 999;
          return numA - numB;
        });

        const sectionConsumption = isReeferSection ? null : (sectionTotalLitres > 0 ? sectionTotalKm / sectionTotalLitres : null);
        const sectionReeferConsumption = isReeferSection && sectionTotalHours > 0 ? sectionTotalLitres / sectionTotalHours : null;
        sections.push({
          name: sectionName,
          fleets: sectionFleetList,
          isReeferSection,
          data: sectionData,
          sectionTotal: { totalLitres: sectionTotalLitres, totalKm: sectionTotalKm, consumption: sectionConsumption, totalHours: sectionTotalHours, reeferConsumption: sectionReeferConsumption, totalCost: sectionTotalCost },
        });

        if (!isReeferSection) {
          grandTotalLitres += sectionTotalLitres;
          grandTotalKm += sectionTotalKm;
          grandTotalCost += sectionTotalCost;
        }
      }

      const grandConsumption = grandTotalLitres > 0 ? grandTotalKm / grandTotalLitres : null;
      reports.push({
        weekNumber: getWeekNumber(weekStart),
        weekLabel: formatWeekLabel(weekStart, weekEnd),
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        sections,
        grandTotal: { totalLitres: grandTotalLitres, totalKm: grandTotalKm, consumption: grandConsumption, totalCost: grandTotalCost },
      });
    }

    return reports;
  }, [dieselRecords, filteredReeferRecords, reeferFleetNumbers, reportPeriod, reportDateFrom, reportDateTo]);

  // ── Weekly breakdowns for each individual report type (Mon–Sun grouping) ──

  /** One entry per ISO week, containing FleetReport rows for that week's truck records. */
  const weeklyFleetBreakdown = useMemo(() => {
    const weekMap = new Map<string, { ws: Date; we: Date; recs: typeof truckRecords }>();
    filteredTruckRecords.forEach(r => {
      const ws = _wkStart(new Date(r.date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const k = ws.toISOString().split('T')[0];
      if (!weekMap.has(k)) weekMap.set(k, { ws, we, recs: [] });
      weekMap.get(k)!.recs.push(r);
    });
    return Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, { ws, we, recs }]) => {
      const fm = new Map<string, FleetReport>();
      recs.forEach(r => {
        const fl = r.fleet_number; const dr = r.driver_name || 'Unknown';
        const ex = fm.get(fl);
        if (ex) {
          ex.totalLitres += r.litres_filled || 0;
          ex.totalCost += (r.total_cost || 0);
          ex.totalDistance += r.distance_travelled || 0;
          ex.fillCount += 1;
          if (!ex.drivers.includes(dr)) ex.drivers.push(dr);
        } else {
          fm.set(fl, { fleet: fl, totalLitres: r.litres_filled || 0, totalCost: (r.total_cost || 0), totalDistance: r.distance_travelled || 0, avgKmPerLitre: 0, fillCount: 1, drivers: [dr] });
        }
      });
      fm.forEach(rp => { rp.avgKmPerLitre = rp.totalLitres > 0 ? rp.totalDistance / rp.totalLitres : 0; });
      const data = Array.from(fm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCost: data.reduce((s, r) => s + r.totalCost, 0), totalDistance: data.reduce((s, r) => s + r.totalDistance, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredTruckRecords]);

  /** One entry per ISO week, containing DriverReport rows for that week's truck records. */
  const weeklyDriverBreakdown = useMemo(() => {
    const weekMap = new Map<string, { ws: Date; we: Date; recs: typeof truckRecords }>();
    filteredTruckRecords.forEach(r => {
      const ws = _wkStart(new Date(r.date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const k = ws.toISOString().split('T')[0];
      if (!weekMap.has(k)) weekMap.set(k, { ws, we, recs: [] });
      weekMap.get(k)!.recs.push(r);
    });
    return Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, { ws, we, recs }]) => {
      const dm = new Map<string, DriverReport>();
      recs.forEach(r => {
        const dr = r.driver_name || 'Unknown Driver';
        const ex = dm.get(dr);
        if (ex) {
          ex.totalLitres += r.litres_filled || 0;
          ex.totalCost += (r.total_cost || 0);
          ex.totalDistance += r.distance_travelled || 0;
          ex.fillCount += 1;
          if (r.date > ex.lastFillDate) ex.lastFillDate = r.date;
        } else {
          dm.set(dr, { driver: dr, totalLitres: r.litres_filled || 0, totalCost: (r.total_cost || 0), totalDistance: r.distance_travelled || 0, avgKmPerLitre: 0, fillCount: 1, lastFillDate: r.date });
        }
      });
      dm.forEach(rp => { rp.avgKmPerLitre = rp.totalLitres > 0 ? rp.totalDistance / rp.totalLitres : 0; });
      const data = Array.from(dm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCost: data.reduce((s, r) => s + r.totalCost, 0), totalDistance: data.reduce((s, r) => s + r.totalDistance, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredTruckRecords]);

  /** One entry per ISO week, containing StationReport rows for that week's truck records. */
  const weeklyStationBreakdown = useMemo(() => {
    const weekMap = new Map<string, { ws: Date; we: Date; recs: typeof truckRecords }>();
    filteredTruckRecords.forEach(r => {
      const ws = _wkStart(new Date(r.date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const k = ws.toISOString().split('T')[0];
      if (!weekMap.has(k)) weekMap.set(k, { ws, we, recs: [] });
      weekMap.get(k)!.recs.push(r);
    });
    return Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, { ws, we, recs }]) => {
      const sm = new Map<string, StationReport>();
      recs.forEach(r => {
        const st = r.fuel_station || 'Unknown Station'; const fl = r.fleet_number;
        const ex = sm.get(st);
        if (ex) {
          ex.totalLitres += r.litres_filled || 0;
          ex.totalCost += (r.total_cost || 0);
          ex.fillCount += 1;
          if (!ex.fleetsServed.includes(fl)) ex.fleetsServed.push(fl);
        } else {
          sm.set(st, { station: st, totalLitres: r.litres_filled || 0, totalCost: (r.total_cost || 0), avgCostPerLitre: 0, fillCount: 1, fleetsServed: [fl] });
        }
      });
      sm.forEach(rp => { rp.avgCostPerLitre = rp.totalLitres > 0 ? rp.totalCost / rp.totalLitres : 0; });
      const data = Array.from(sm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCost: data.reduce((s, r) => s + r.totalCost, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredTruckRecords]);

  /** One entry per ISO week, containing ReeferFleetReport rows for that week's reefer records. */
  const weeklyReeferFleetBreakdown = useMemo(() => {
    const weekMap = new Map<string, { ws: Date; we: Date; recs: typeof reeferRecords }>();
    filteredReeferRecords.forEach(r => {
      const ws = _wkStart(new Date(r.date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const k = ws.toISOString().split('T')[0];
      if (!weekMap.has(k)) weekMap.set(k, { ws, we, recs: [] });
      weekMap.get(k)!.recs.push(r);
    });
    return Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, { ws, we, recs }]) => {
      const fm = new Map<string, ReeferFleetReport>();
      recs.forEach(r => {
        const fl = r.fleet_number; const dr = r.driver_name || 'Unknown';
        const ex = fm.get(fl);
        if (ex) {
          ex.totalLitres += r.litres_filled || 0;
          ex.totalCost += (r.total_cost || 0);
          ex.fillCount += 1;
          if (!ex.drivers.includes(dr)) ex.drivers.push(dr);

          const hrs = r.hours_operated;
          if (hrs && hrs > 0) ex.totalHoursOperated += hrs;
        } else {

          const hrs = r.hours_operated;
          fm.set(fl, { fleet: fl, totalLitres: r.litres_filled || 0, totalCost: (r.total_cost || 0), fillCount: 1, drivers: [dr], avgLitresPerHour: 0, totalHoursOperated: (hrs && hrs > 0) ? hrs : 0 });
        }
      });
      fm.forEach(rp => { rp.avgLitresPerHour = rp.totalHoursOperated > 0 ? rp.totalLitres / rp.totalHoursOperated : 0; });
      const data = Array.from(fm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCost: data.reduce((s, r) => s + r.totalCost, 0), totalHoursOperated: data.reduce((s, r) => s + r.totalHoursOperated, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredReeferRecords]);

  /** One entry per ISO week, containing ReeferDriverReport rows for that week's reefer records. */
  const weeklyReeferDriverBreakdown = useMemo(() => {
    const weekMap = new Map<string, { ws: Date; we: Date; recs: typeof reeferRecords }>();
    filteredReeferRecords.forEach(r => {
      const ws = _wkStart(new Date(r.date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const k = ws.toISOString().split('T')[0];
      if (!weekMap.has(k)) weekMap.set(k, { ws, we, recs: [] });
      weekMap.get(k)!.recs.push(r);
    });
    return Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, { ws, we, recs }]) => {
      const dm = new Map<string, ReeferDriverReport>();
      recs.forEach(r => {
        const dr = r.driver_name || 'Unknown Driver'; const fl = r.fleet_number;
        const ex = dm.get(dr);
        if (ex) {
          ex.totalLitres += r.litres_filled || 0;
          ex.totalCost += (r.total_cost || 0);
          ex.fillCount += 1;
          if (r.date > ex.lastFillDate) ex.lastFillDate = r.date;
          if (fl && !ex.fleets.includes(fl)) ex.fleets.push(fl);

          const hrs = r.hours_operated;
          if (hrs && hrs > 0) ex.totalHoursOperated += hrs;
        } else {

          const hrs = r.hours_operated;
          dm.set(dr, { driver: dr, totalLitres: r.litres_filled || 0, totalCost: (r.total_cost || 0), fillCount: 1, lastFillDate: r.date, fleets: fl ? [fl] : [], avgLitresPerHour: 0, totalHoursOperated: (hrs && hrs > 0) ? hrs : 0 });
        }
      });
      dm.forEach(rp => { rp.avgLitresPerHour = rp.totalHoursOperated > 0 ? rp.totalLitres / rp.totalHoursOperated : 0; });
      const data = Array.from(dm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCost: data.reduce((s, r) => s + r.totalCost, 0), totalHoursOperated: data.reduce((s, r) => s + r.totalHoursOperated, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredReeferRecords]);

  /** One entry per ISO week, containing StationReport rows for that week's reefer records. */
  const weeklyReeferStationBreakdown = useMemo(() => {
    const weekMap = new Map<string, { ws: Date; we: Date; recs: typeof reeferRecords }>();
    filteredReeferRecords.forEach(r => {
      const ws = _wkStart(new Date(r.date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const k = ws.toISOString().split('T')[0];
      if (!weekMap.has(k)) weekMap.set(k, { ws, we, recs: [] });
      weekMap.get(k)!.recs.push(r);
    });
    return Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, { ws, we, recs }]) => {
      const sm = new Map<string, StationReport>();
      recs.forEach(r => {
        const st = r.fuel_station || 'Unknown Station'; const fl = r.fleet_number;
        const ex = sm.get(st);
        if (ex) {
          ex.totalLitres += r.litres_filled || 0;
          ex.totalCost += (r.total_cost || 0);
          ex.fillCount += 1;
          if (!ex.fleetsServed.includes(fl)) ex.fleetsServed.push(fl);
        } else {
          sm.set(st, { station: st, totalLitres: r.litres_filled || 0, totalCost: (r.total_cost || 0), avgCostPerLitre: 0, fillCount: 1, fleetsServed: [fl] });
        }
      });
      sm.forEach(rp => { rp.avgCostPerLitre = rp.totalLitres > 0 ? rp.totalCost / rp.totalLitres : 0; });
      const data = Array.from(sm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCost: data.reduce((s, r) => s + r.totalCost, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredReeferRecords]);


  const getExportDateRange = (): { from: string; to: string } | undefined => {
    if (reportPeriod === 'all') return undefined;
    if (reportPeriod === 'custom') return { from: reportDateFrom, to: reportDateTo };
    const now = new Date();
    let fromDate: string;
    switch (reportPeriod) {
      case '1month': fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0]; break;
      case '3months': fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0]; break;
      case '6months': fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0]; break;
      case '1year': fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0]; break;
      default: return undefined;
    }
    return { from: fromDate, to: todayStr };
  };

  const buildExportInput = () => ({
    driverReports,
    reeferDriverReports,
    fleetReports,
    reeferFleetReports,
    stationReports,
    reeferStationReports,
    weeklyReports,
    truckRecords: filteredTruckRecords as unknown as DieselExportRecord[],
    reeferRecords: filteredReeferRecords as unknown as DieselExportRecord[],
    dateRange: getExportDateRange(),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'pdf') {
        generateComprehensiveDieselPDF(buildExportInput(), exportSel);
      } else {
        await generateStyledDieselExcel(buildExportInput(), exportSel);
      }
      setExportOpen(false);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Open the export dialog pre-configured for a specific tab.
   * All sheets default to false; only the supplied overrides are enabled.
   */
  const openTabExport = (overrides: Partial<ExportSheetSelection>) => {
    setExportSel({
      overview: false, truckByDriver: false, truckByFleet: false, truckByStation: false,
      weekly: false, reeferByFleet: false, reeferByDriver: false, reeferByStation: false,
      truckTransactions: false, reeferTransactions: false,
      ...overrides,
    });
    setExportOpen(true);
  };

  // Export yearly weekly-filtered Excel with separate Trucks & Reefers sheets
  const handleExportYearlyWeekly = async (year: number) => {
    setIsExporting(true);
    try {
      await generateYearlyWeeklyDieselExcel({
        year,
        truckRecords: truckRecords as unknown as DieselExportRecord[],
        reeferRecords: reeferRecords as unknown as DieselExportRecord[],
      });
    } catch (e) {
      console.error('Yearly export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // Export all diesel transactions to Excel (XLSX format using CSV with Excel compatibility)

  return (
    <>
      <div className="space-y-6">
        {/* Report Type Selector */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Diesel Reports</CardTitle>
                  <CardDescription>
                    Analyze fuel consumption by driver, fleet, or filling station
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {/* Overall / Weekly toggle */}
                  <div className="flex border border-border rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setWeeklyView(false)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${!weeklyView ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      Overall
                    </button>
                    <button
                      type="button"
                      onClick={() => { setWeeklyView(true); setExpandedBreakdownWeeks(new Set()); }}
                      className={`px-3 py-1.5 text-sm font-medium border-l border-border transition-colors ${weeklyView ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      Weekly
                    </button>
                  </div>
                  <Button onClick={() => setExportOpen(true)} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Reports
                  </Button>
                </div>
              </div>
              {/* Report Period Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger className="w-[180px] h-9 text-sm">
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
                </div>
                {reportPeriod === 'custom' && (
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} max={reportDateTo} className="h-9 w-[160px] text-sm" />
                    </div>
                    <span className="text-muted-foreground mt-5">→</span>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} min={reportDateFrom} className="h-9 w-[160px] text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={reportType === 'fleet' ? 'default' : 'outline'}
                onClick={() => setReportType('fleet')}
                className="gap-2"
              >
                <Truck className="h-4 w-4" />
                By Fleet
              </Button>
              <Button
                variant={reportType === 'driver' ? 'default' : 'outline'}
                onClick={() => setReportType('driver')}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                By Driver
              </Button>
              <Button
                variant={reportType === 'station' ? 'default' : 'outline'}
                onClick={() => setReportType('station')}
                className="gap-2"
              >
                <Fuel className="h-4 w-4" />
                By Station
              </Button>
              <Button
                variant={reportType === 'weekly' ? 'default' : 'outline'}
                onClick={() => setReportType('weekly')}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Weekly Consumption
              </Button>
              <Button
                variant={reportType === 'reefer' ? 'default' : 'outline'}
                onClick={() => setReportType('reefer')}
                className="gap-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-400 dark:hover:bg-cyan-950"
              >
                <Snowflake className="h-4 w-4" />
                Reefer (L/hr)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Report */}
        {reportType === 'fleet' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Fleet Consumption Report
                  </CardTitle>
                  <CardDescription>
                    {fleetReports.length} fleets with diesel records
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export All Fleets
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          const exportRecords: DieselExportRecord[] = truckRecords.map(r => ({
                            id: r.id,
                            date: r.date,
                            fleet_number: r.fleet_number,
                            driver_name: r.driver_name,
                            fuel_station: r.fuel_station,
                            litres_filled: r.litres_filled,
                            cost_per_litre: r.cost_per_litre,
                            total_cost: r.total_cost,
                            currency: r.currency,
                            km_reading: r.km_reading,
                            previous_km_reading: r.previous_km_reading,
                            distance_travelled: r.distance_travelled,
                            km_per_litre: r.km_per_litre,
                            trip_id: r.trip_id,
                            debrief_signed: r.debrief_signed,
                            debrief_signed_by: r.debrief_signed_by,
                            debrief_date: r.debrief_date,
                            notes: r.notes,
                          }));
                          generateAllFleetsDieselPDF(exportRecords);
                        }}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Export All as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const exportRecords: DieselExportRecord[] = truckRecords.map(r => ({
                            id: r.id,
                            date: r.date,
                            fleet_number: r.fleet_number,
                            driver_name: r.driver_name,
                            fuel_station: r.fuel_station,
                            litres_filled: r.litres_filled,
                            cost_per_litre: r.cost_per_litre,
                            total_cost: r.total_cost,
                            currency: r.currency,
                            km_reading: r.km_reading,
                            previous_km_reading: r.previous_km_reading,
                            distance_travelled: r.distance_travelled,
                            km_per_litre: r.km_per_litre,
                            trip_id: r.trip_id,
                            debrief_signed: r.debrief_signed,
                            debrief_signed_by: r.debrief_signed_by,
                            debrief_date: r.debrief_date,
                            notes: r.notes,
                          }));
                          generateAllFleetsDieselExcel(exportRecords);
                        }}
                        className="gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Export All as Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {weeklyView ? (
                weeklyFleetBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    {weeklyFleetBreakdown.map(week => (
                      <Collapsible key={week.weekKey} open={expandedBreakdownWeeks.has(`fleet-${week.weekKey}`)} onOpenChange={() => toggleBreakdownWeek(`fleet-${week.weekKey}`)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-md cursor-pointer border">
                            <div className="flex items-center gap-3">
                              <ChevronRight className={`h-4 w-4 transition-transform ${expandedBreakdownWeeks.has(`fleet-${week.weekKey}`) ? 'rotate-90' : ''}`} />
                              <span className="font-semibold">Week {week.weekNumber}</span>
                              <span className="text-muted-foreground text-sm">{week.weekLabel}</span>
                              <Badge variant="secondary" className="text-xs">{week.data.length} fleets</Badge>
                            </div>
                            <div className="flex gap-6 text-sm text-muted-foreground">
                              <span>{formatNumber(week.totals.totalLitres)} L</span>
                              <span>{formatCurrency(week.totals.totalCost)}</span>
                              <span>{week.totals.fillCount} fills</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="overflow-x-auto mt-1 rounded-md border bg-muted/10">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-3 font-medium">Fleet</th>
                                  <th className="text-right p-3 font-medium">Total Litres</th>
                                  <th className="text-right p-3 font-medium">Total Cost</th>
                                  <th className="text-right p-3 font-medium">Distance (km)</th>
                                  <th className="text-right p-3 font-medium">Avg km/L</th>
                                  <th className="text-right p-3 font-medium">Fills</th>
                                  <th className="text-left p-3 font-medium">Drivers</th>
                                </tr>
                              </thead>
                              <tbody>
                                {week.data.map((report, i) => {
                                  const norm = getNormForFleet(report.fleet);
                                  const isLow = norm && report.avgKmPerLitre < norm.min_acceptable;
                                  return (
                                    <tr key={report.fleet} className={`border-b hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                      <td className="p-3 font-medium">{report.fleet}</td>
                                      <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                                      <td className="p-3 text-right">
                                        {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                                      </td>
                                      <td className="p-3 text-right">{formatNumber(report.totalDistance)}</td>
                                      <td className={`p-3 text-right font-medium ${isLow ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                                        {formatNumber(report.avgKmPerLitre, 2)}
                                      </td>
                                      <td className="p-3 text-right">{report.fillCount}</td>
                                      <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                          {report.drivers.slice(0, 3).map(d => <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>)}
                                          {report.drivers.length > 3 && <Badge variant="outline" className="text-xs">+{report.drivers.length - 3}</Badge>}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-muted/50 font-medium border-t-2">
                                  <td className="p-3">Week Total</td>
                                  <td className="p-3 text-right">{formatNumber(week.totals.totalLitres)} L</td>
                                  <td className="p-3 text-right">{formatCurrency(week.totals.totalCost)}</td>
                                  <td className="p-3 text-right">{formatNumber(week.totals.totalDistance)}</td>
                                  <td className="p-3 text-right">—</td>
                                  <td className="p-3 text-right">{week.totals.fillCount}</td>
                                  <td className="p-3"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8"><p className="text-muted-foreground">No diesel records to report</p></div>
                )
              ) : fleetReports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Fleet</th>
                        <th className="text-right p-3 font-medium">Total Litres</th>
                        <th className="text-right p-3 font-medium">Total Cost</th>
                        <th className="text-right p-3 font-medium">Distance (km)</th>
                        <th className="text-right p-3 font-medium">Avg km/L</th>
                        <th className="text-right p-3 font-medium">Fills</th>
                        <th className="text-left p-3 font-medium">Drivers</th>
                        <th className="text-center p-3 font-medium">Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetReports.map((report) => {
                        const norm = getNormForFleet(report.fleet);
                        const isLow = norm && report.avgKmPerLitre < norm.min_acceptable;
                        return (
                          <tr key={report.fleet} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{report.fleet}</td>
                            <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                            <td className="p-3 text-right">
                              {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                            </td>
                            <td className="p-3 text-right">{formatNumber(report.totalDistance)}</td>
                            <td className={`p-3 text-right font-medium ${isLow ? 'text-destructive' : 'text-success'}`}>
                              {formatNumber(report.avgKmPerLitre, 2)}
                            </td>
                            <td className="p-3 text-right">{report.fillCount}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {report.drivers.slice(0, 3).map(d => (
                                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                                ))}
                                {report.drivers.length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{report.drivers.length - 3}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 gap-1">
                                    <Download className="h-3 w-3" />
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const exportRecords: DieselExportRecord[] = truckRecords.map(r => ({
                                        id: r.id,
                                        date: r.date,
                                        fleet_number: r.fleet_number,
                                        driver_name: r.driver_name,
                                        fuel_station: r.fuel_station,
                                        litres_filled: r.litres_filled,
                                        cost_per_litre: r.cost_per_litre,
                                        total_cost: r.total_cost,
                                        currency: r.currency,
                                        km_reading: r.km_reading,
                                        previous_km_reading: r.previous_km_reading,
                                        distance_travelled: r.distance_travelled,
                                        km_per_litre: r.km_per_litre,
                                        trip_id: r.trip_id,
                                        debrief_signed: r.debrief_signed,
                                        debrief_signed_by: r.debrief_signed_by,
                                        debrief_date: r.debrief_date,
                                        notes: r.notes,
                                      }));
                                      generateFleetDieselPDF({
                                        fleetNumber: report.fleet,
                                        records: exportRecords,
                                      });
                                    }}
                                    className="gap-2"
                                  >
                                    <FileText className="h-4 w-4" />
                                    Export PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const exportRecords: DieselExportRecord[] = truckRecords.map(r => ({
                                        id: r.id,
                                        date: r.date,
                                        fleet_number: r.fleet_number,
                                        driver_name: r.driver_name,
                                        fuel_station: r.fuel_station,
                                        litres_filled: r.litres_filled,
                                        cost_per_litre: r.cost_per_litre,
                                        total_cost: r.total_cost,
                                        currency: r.currency,
                                        km_reading: r.km_reading,
                                        previous_km_reading: r.previous_km_reading,
                                        distance_travelled: r.distance_travelled,
                                        km_per_litre: r.km_per_litre,
                                        trip_id: r.trip_id,
                                        debrief_signed: r.debrief_signed,
                                        debrief_signed_by: r.debrief_signed_by,
                                        debrief_date: r.debrief_date,
                                        notes: r.notes,
                                      }));
                                      generateFleetDieselExcel({
                                        fleetNumber: report.fleet,
                                        records: exportRecords,
                                      });
                                    }}
                                    className="gap-2"
                                  >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Export Excel
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-medium">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">{formatNumber(fleetReports.reduce((s, r) => s + r.totalLitres, 0))} L</td>
                        <td className="p-3 text-right">
                          <div>{formatCurrency(fleetReports.reduce((s, r) => s + r.totalCost, 0))}</div>
                        </td>
                        <td className="p-3 text-right">{formatNumber(fleetReports.reduce((s, r) => s + r.totalDistance, 0))}</td>
                        <td className="p-3 text-right">—</td>
                        <td className="p-3 text-right">{fleetReports.reduce((s, r) => s + r.fillCount, 0)}</td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No diesel records to report</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Driver Report */}
        {reportType === 'driver' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Driver Consumption Report
                  </CardTitle>
                  <CardDescription>
                    {driverReports.length} drivers with diesel records
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, truckByDriver: true })} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Driver Report (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setExportFormat('pdf'); openTabExport({ overview: true, truckByDriver: true }); }} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Driver Report (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, truckByDriver: true, truckByFleet: true, truckByStation: true, weekly: true })} className="gap-2">
                      <Download className="h-4 w-4" />
                      All Truck Reports
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              {weeklyView ? (
                weeklyDriverBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    {weeklyDriverBreakdown.map(week => (
                      <Collapsible key={week.weekKey} open={expandedBreakdownWeeks.has(`driver-${week.weekKey}`)} onOpenChange={() => toggleBreakdownWeek(`driver-${week.weekKey}`)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-md cursor-pointer border">
                            <div className="flex items-center gap-3">
                              <ChevronRight className={`h-4 w-4 transition-transform ${expandedBreakdownWeeks.has(`driver-${week.weekKey}`) ? 'rotate-90' : ''}`} />
                              <span className="font-semibold">Week {week.weekNumber}</span>
                              <span className="text-muted-foreground text-sm">{week.weekLabel}</span>
                              <Badge variant="secondary" className="text-xs">{week.data.length} drivers</Badge>
                            </div>
                            <div className="flex gap-6 text-sm text-muted-foreground">
                              <span>{formatNumber(week.totals.totalLitres)} L</span>
                              <span>{formatCurrency(week.totals.totalCost)}</span>
                              <span>{week.totals.fillCount} fills</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="overflow-x-auto mt-1 rounded-md border bg-muted/10">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-3 font-medium">Driver</th>
                                  <th className="text-right p-3 font-medium">Total Litres</th>
                                  <th className="text-right p-3 font-medium">Total Cost</th>
                                  <th className="text-right p-3 font-medium">Distance (km)</th>
                                  <th className="text-right p-3 font-medium">Avg km/L</th>
                                  <th className="text-right p-3 font-medium">Fills</th>
                                  <th className="text-right p-3 font-medium">Last Fill</th>
                                </tr>
                              </thead>
                              <tbody>
                                {week.data.map((report, i) => (
                                  <tr key={report.driver} className={`border-b hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                    <td className="p-3 font-medium">{report.driver}</td>
                                    <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                                    <td className="p-3 text-right">
                                      {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                                    </td>
                                    <td className="p-3 text-right">{formatNumber(report.totalDistance)}</td>
                                    <td className="p-3 text-right font-medium">{report.avgKmPerLitre > 0 ? formatNumber(report.avgKmPerLitre, 2) : '—'}</td>
                                    <td className="p-3 text-right">{report.fillCount}</td>
                                    <td className="p-3 text-right text-muted-foreground">{formatDate(report.lastFillDate)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-muted/50 font-medium border-t-2">
                                  <td className="p-3">Week Total</td>
                                  <td className="p-3 text-right">{formatNumber(week.totals.totalLitres)} L</td>
                                  <td className="p-3 text-right">{formatCurrency(week.totals.totalCost)}</td>
                                  <td className="p-3 text-right">{formatNumber(week.totals.totalDistance)}</td>
                                  <td className="p-3 text-right">—</td>
                                  <td className="p-3 text-right">{week.totals.fillCount}</td>
                                  <td className="p-3"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8"><p className="text-muted-foreground">No diesel records to report</p></div>
                )
              ) : driverReports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Driver</th>
                        <th className="text-right p-3 font-medium">Total Litres</th>
                        <th className="text-right p-3 font-medium">Total Cost</th>
                        <th className="text-right p-3 font-medium">Distance (km)</th>
                        <th className="text-right p-3 font-medium">Avg km/L</th>
                        <th className="text-right p-3 font-medium">Fills</th>
                        <th className="text-right p-3 font-medium">Last Fill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverReports.map((report) => (
                        <tr key={report.driver} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{report.driver}</td>
                          <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                          <td className="p-3 text-right">
                            {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                          </td>
                          <td className="p-3 text-right">{formatNumber(report.totalDistance)}</td>
                          <td className="p-3 text-right font-medium">
                            {report.avgKmPerLitre > 0 ? formatNumber(report.avgKmPerLitre, 2) : '—'}
                          </td>
                          <td className="p-3 text-right">{report.fillCount}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatDate(report.lastFillDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-medium">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">{formatNumber(driverReports.reduce((s, r) => s + r.totalLitres, 0))} L</td>
                        <td className="p-3 text-right">
                          <div>{formatCurrency(driverReports.reduce((s, r) => s + r.totalCost, 0))}</div>
                        </td>
                        <td className="p-3 text-right">{formatNumber(driverReports.reduce((s, r) => s + r.totalDistance, 0))}</td>
                        <td className="p-3 text-right">—</td>
                        <td className="p-3 text-right">{driverReports.reduce((s, r) => s + r.fillCount, 0)}</td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No diesel records to report</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Station Report */}
        {reportType === 'station' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Fuel className="h-5 w-5" />
                    Filling Station Report
                  </CardTitle>
                  <CardDescription>
                    {stationReports.length} filling stations used
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, truckByStation: true })} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Station Report (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setExportFormat('pdf'); openTabExport({ overview: true, truckByStation: true }); }} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Station Report (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, truckByDriver: true, truckByFleet: true, truckByStation: true, weekly: true })} className="gap-2">
                      <Download className="h-4 w-4" />
                      All Truck Reports
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              {weeklyView ? (
                weeklyStationBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    {weeklyStationBreakdown.map(week => (
                      <Collapsible key={week.weekKey} open={expandedBreakdownWeeks.has(`station-${week.weekKey}`)} onOpenChange={() => toggleBreakdownWeek(`station-${week.weekKey}`)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-md cursor-pointer border">
                            <div className="flex items-center gap-3">
                              <ChevronRight className={`h-4 w-4 transition-transform ${expandedBreakdownWeeks.has(`station-${week.weekKey}`) ? 'rotate-90' : ''}`} />
                              <span className="font-semibold">Week {week.weekNumber}</span>
                              <span className="text-muted-foreground text-sm">{week.weekLabel}</span>
                              <Badge variant="secondary" className="text-xs">{week.data.length} stations</Badge>
                            </div>
                            <div className="flex gap-6 text-sm text-muted-foreground">
                              <span>{formatNumber(week.totals.totalLitres)} L</span>
                              <span>{formatCurrency(week.totals.totalCost)}</span>
                              <span>{week.totals.fillCount} fills</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="overflow-x-auto mt-1 rounded-md border bg-muted/10">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-3 font-medium">Station</th>
                                  <th className="text-right p-3 font-medium">Total Litres</th>
                                  <th className="text-right p-3 font-medium">Total Cost</th>
                                  <th className="text-right p-3 font-medium">Avg Cost/L</th>
                                  <th className="text-right p-3 font-medium">Fills</th>
                                  <th className="text-left p-3 font-medium">Fleets Served</th>
                                </tr>
                              </thead>
                              <tbody>
                                {week.data.map((report, i) => (
                                  <tr key={report.station} className={`border-b hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                    <td className="p-3 font-medium">{report.station}</td>
                                    <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                                    <td className="p-3 text-right">
                                      {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                                    </td>
                                    <td className="p-3 text-right">{formatNumber(report.avgCostPerLitre, 2)}/L</td>
                                    <td className="p-3 text-right">{report.fillCount}</td>
                                    <td className="p-3">
                                      <div className="flex flex-wrap gap-1">
                                        {report.fleetsServed.slice(0, 4).map(f => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                                        {report.fleetsServed.length > 4 && <Badge variant="outline" className="text-xs">+{report.fleetsServed.length - 4}</Badge>}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-muted/50 font-medium border-t-2">
                                  <td className="p-3">Week Total</td>
                                  <td className="p-3 text-right">{formatNumber(week.totals.totalLitres)} L</td>
                                  <td className="p-3 text-right">{formatCurrency(week.totals.totalCost)}</td>
                                  <td className="p-3 text-right">—</td>
                                  <td className="p-3 text-right">{week.totals.fillCount}</td>
                                  <td className="p-3"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8"><p className="text-muted-foreground">No diesel records to report</p></div>
                )
              ) : stationReports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Station</th>
                        <th className="text-right p-3 font-medium">Total Litres</th>
                        <th className="text-right p-3 font-medium">Total Cost</th>
                        <th className="text-right p-3 font-medium">Avg Cost/L</th>
                        <th className="text-right p-3 font-medium">Fills</th>
                        <th className="text-left p-3 font-medium">Fleets Served</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationReports.map((report) => (
                        <tr key={report.station} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{report.station}</td>
                          <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                          <td className="p-3 text-right">
                            {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                          </td>
                          <td className="p-3 text-right">
                            {formatNumber(report.avgCostPerLitre, 2)}/L
                          </td>
                          <td className="p-3 text-right">{report.fillCount}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {report.fleetsServed.slice(0, 4).map(f => (
                                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                              ))}
                              {report.fleetsServed.length > 4 && (
                                <Badge variant="outline" className="text-xs">+{report.fleetsServed.length - 4}</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-medium">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">{formatNumber(stationReports.reduce((s, r) => s + r.totalLitres, 0))} L</td>
                        <td className="p-3 text-right">
                          <div>{formatCurrency(stationReports.reduce((s, r) => s + r.totalCost, 0))}</div>
                        </td>
                        <td className="p-3 text-right">—</td>
                        <td className="p-3 text-right">{stationReports.reduce((s, r) => s + r.fillCount, 0)}</td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No diesel records to report</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reefer Reports */}
        {reportType === 'reefer' && (
          <Card className="border-cyan-200/60 dark:border-cyan-900/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="h-5 w-5 text-cyan-500" />
                    Reefer Reports (L/hr)
                  </CardTitle>
                  <CardDescription>
                    Fleet, driver, and station reports for reefer units
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export Reefer
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, reeferByFleet: true, reeferByDriver: true, reeferByStation: true })} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      All Reefer Reports (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setExportFormat('pdf'); openTabExport({ overview: true, reeferByFleet: true, reeferByDriver: true, reeferByStation: true }); }} className="gap-2">
                      <FileText className="h-4 w-4" />
                      All Reefer Reports (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, reeferByFleet: true })} className="gap-2">
                      <Truck className="h-4 w-4" />
                      By Reefer Unit only
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, reeferByDriver: true })} className="gap-2">
                      <User className="h-4 w-4" />
                      By Driver only
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openTabExport({ overview: true, reeferByStation: true })} className="gap-2">
                      <Fuel className="h-4 w-4" />
                      By Station only
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Reefer Fleet Report */}
              {weeklyView ? (
                weeklyReeferFleetBreakdown.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Truck className="h-4 w-4 text-cyan-500" />
                      <h4 className="font-semibold text-lg">Reefer Fleet Report — Weekly</h4>
                    </div>
                    <div className="space-y-1">
                      {weeklyReeferFleetBreakdown.map(week => (
                        <Collapsible key={week.weekKey} open={expandedBreakdownWeeks.has(`reefer-fleet-${week.weekKey}`)} onOpenChange={() => toggleBreakdownWeek(`reefer-fleet-${week.weekKey}`)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-cyan-50/40 dark:bg-cyan-900/20 hover:bg-cyan-50/70 dark:hover:bg-cyan-900/30 rounded-md cursor-pointer border border-cyan-200/40 dark:border-cyan-700/30">
                              <div className="flex items-center gap-3">
                                <ChevronRight className={`h-4 w-4 transition-transform ${expandedBreakdownWeeks.has(`reefer-fleet-${week.weekKey}`) ? 'rotate-90' : ''}`} />
                                <span className="font-semibold">Week {week.weekNumber}</span>
                                <span className="text-muted-foreground text-sm">{week.weekLabel}</span>
                                <Badge variant="secondary" className="text-xs">{week.data.length} units</Badge>
                              </div>
                              <div className="flex gap-6 text-sm text-muted-foreground">
                                <span>{formatNumber(week.totals.totalLitres)} L</span>
                                <span>{formatCurrency(week.totals.totalCost)}</span>
                                <span>{week.totals.fillCount} fills</span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="overflow-x-auto mt-1 rounded-md border bg-muted/10">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-cyan-50/50 dark:bg-cyan-900/20">
                                    <th className="text-left p-3 font-medium">Fleet</th>
                                    <th className="text-right p-3 font-medium">Total Litres</th>
                                    <th className="text-right p-3 font-medium">Total Cost</th>
                                    <th className="text-right p-3 font-medium">Avg L/hr</th>
                                    <th className="text-right p-3 font-medium">Hours Operated</th>
                                    <th className="text-right p-3 font-medium">Fills</th>
                                    <th className="text-left p-3 font-medium">Drivers</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {week.data.map((report, i) => (
                                    <tr key={report.fleet} className={`border-b hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                      <td className="p-3 font-medium">{report.fleet}</td>
                                      <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                                      <td className="p-3 text-right">
                                        {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                                      </td>
                                      <td className="p-3 text-right">
                                        {report.avgLitresPerHour > 0 ? <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{formatNumber(report.avgLitresPerHour, 2)} L/hr</Badge> : <span className="text-muted-foreground">—</span>}
                                      </td>
                                      <td className="p-3 text-right">{report.totalHoursOperated > 0 ? `${formatNumber(report.totalHoursOperated)} hrs` : '—'}</td>
                                      <td className="p-3 text-right">{report.fillCount}</td>
                                      <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                          {report.drivers.slice(0, 3).map(d => <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>)}
                                          {report.drivers.length > 3 && <Badge variant="outline" className="text-xs">+{report.drivers.length - 3}</Badge>}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-muted/50 font-medium border-t-2">
                                    <td className="p-3">Week Total</td>
                                    <td className="p-3 text-right">{formatNumber(week.totals.totalLitres)} L</td>
                                    <td className="p-3 text-right">{formatCurrency(week.totals.totalCost)}</td>
                                    <td className="p-3 text-right">—</td>
                                    <td className="p-3 text-right">{formatNumber(week.totals.totalHoursOperated)} hrs</td>
                                    <td className="p-3 text-right">{week.totals.fillCount}</td>
                                    <td className="p-3"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8"><p className="text-muted-foreground">No reefer records to report</p></div>
                )
              ) : reeferFleetReports.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="h-4 w-4 text-cyan-500" />
                    <h4 className="font-semibold text-lg">Reefer Fleet Report</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-cyan-50/50 dark:bg-cyan-900/20">
                          <th className="text-left p-3 font-medium">Fleet</th>
                          <th className="text-right p-3 font-medium">Total Litres</th>
                          <th className="text-right p-3 font-medium">Total Cost</th>
                          <th className="text-right p-3 font-medium">Avg L/hr</th>
                          <th className="text-right p-3 font-medium">Hours Operated</th>
                          <th className="text-right p-3 font-medium">Fills</th>
                          <th className="text-left p-3 font-medium">Drivers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reeferFleetReports.map((report) => (
                          <tr key={report.fleet} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{report.fleet}</td>
                            <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                            <td className="p-3 text-right">
                              {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                            </td>
                            <td className="p-3 text-right">
                              {report.avgLitresPerHour > 0 ? (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  {formatNumber(report.avgLitresPerHour, 2)} L/hr
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {report.totalHoursOperated > 0 ? `${formatNumber(report.totalHoursOperated)} hrs` : '—'}
                            </td>
                            <td className="p-3 text-right">{report.fillCount}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {report.drivers.slice(0, 3).map(d => (
                                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                                ))}
                                {report.drivers.length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{report.drivers.length - 3}</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-medium">
                          <td className="p-3">Total</td>
                          <td className="p-3 text-right">{formatNumber(reeferFleetReports.reduce((s, r) => s + r.totalLitres, 0))} L</td>
                          <td className="p-3 text-right">
                            <div>{formatCurrency(reeferFleetReports.reduce((s, r) => s + r.totalCost, 0))}</div>
                          </td>
                          <td className="p-3 text-right">—</td>
                          <td className="p-3 text-right">
                            {formatNumber(reeferFleetReports.reduce((s, r) => s + r.totalHoursOperated, 0))} hrs
                          </td>
                          <td className="p-3 text-right">{reeferFleetReports.reduce((s, r) => s + r.fillCount, 0)}</td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Reefer Driver Report */}
              {weeklyView ? (
                weeklyReeferDriverBreakdown.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-cyan-500" />
                      <h4 className="font-semibold text-lg">Reefer Driver Report — Weekly</h4>
                    </div>
                    <div className="space-y-1">
                      {weeklyReeferDriverBreakdown.map(week => (
                        <Collapsible key={week.weekKey} open={expandedBreakdownWeeks.has(`reefer-driver-${week.weekKey}`)} onOpenChange={() => toggleBreakdownWeek(`reefer-driver-${week.weekKey}`)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-cyan-50/40 dark:bg-cyan-900/20 hover:bg-cyan-50/70 dark:hover:bg-cyan-900/30 rounded-md cursor-pointer border border-cyan-200/40 dark:border-cyan-700/30">
                              <div className="flex items-center gap-3">
                                <ChevronRight className={`h-4 w-4 transition-transform ${expandedBreakdownWeeks.has(`reefer-driver-${week.weekKey}`) ? 'rotate-90' : ''}`} />
                                <span className="font-semibold">Week {week.weekNumber}</span>
                                <span className="text-muted-foreground text-sm">{week.weekLabel}</span>
                                <Badge variant="secondary" className="text-xs">{week.data.length} drivers</Badge>
                              </div>
                              <div className="flex gap-6 text-sm text-muted-foreground">
                                <span>{formatNumber(week.totals.totalLitres)} L</span>
                                <span>{formatCurrency(week.totals.totalCost)}</span>
                                <span>{week.totals.fillCount} fills</span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="overflow-x-auto mt-1 rounded-md border bg-muted/10">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-cyan-50/50 dark:bg-cyan-900/20">
                                    <th className="text-left p-3 font-medium">Driver</th>
                                    <th className="text-right p-3 font-medium">Total Litres</th>
                                    <th className="text-right p-3 font-medium">Total Cost</th>
                                    <th className="text-right p-3 font-medium">Avg L/hr</th>
                                    <th className="text-right p-3 font-medium">Fills</th>
                                    <th className="text-right p-3 font-medium">Last Fill</th>
                                    <th className="text-left p-3 font-medium">Fleets</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {week.data.map((report, i) => (
                                    <tr key={report.driver} className={`border-b hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                      <td className="p-3 font-medium">{report.driver}</td>
                                      <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                                      <td className="p-3 text-right">
                                        {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                                      </td>
                                      <td className="p-3 text-right">
                                        {report.avgLitresPerHour > 0 ? <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{formatNumber(report.avgLitresPerHour, 2)} L/hr</Badge> : <span className="text-muted-foreground">—</span>}
                                      </td>
                                      <td className="p-3 text-right">{report.fillCount}</td>
                                      <td className="p-3 text-right text-muted-foreground">{formatDate(report.lastFillDate)}</td>
                                      <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                          {report.fleets.slice(0, 3).map(f => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                                          {report.fleets.length > 3 && <Badge variant="outline" className="text-xs">+{report.fleets.length - 3}</Badge>}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-muted/50 font-medium border-t-2">
                                    <td className="p-3">Week Total</td>
                                    <td className="p-3 text-right">{formatNumber(week.totals.totalLitres)} L</td>
                                    <td className="p-3 text-right">{formatCurrency(week.totals.totalCost)}</td>
                                    <td className="p-3 text-right">—</td>
                                    <td className="p-3 text-right">{week.totals.fillCount}</td>
                                    <td className="p-3"></td>
                                    <td className="p-3"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8"><p className="text-muted-foreground">No reefer records to report</p></div>
                )
              ) : reeferDriverReports.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-cyan-500" />
                    <h4 className="font-semibold text-lg">Reefer Driver Report</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-cyan-50/50 dark:bg-cyan-900/20">
                          <th className="text-left p-3 font-medium">Driver</th>
                          <th className="text-right p-3 font-medium">Total Litres</th>
                          <th className="text-right p-3 font-medium">Total Cost</th>
                          <th className="text-right p-3 font-medium">Avg L/hr</th>
                          <th className="text-right p-3 font-medium">Fills</th>
                          <th className="text-right p-3 font-medium">Last Fill</th>
                          <th className="text-left p-3 font-medium">Fleets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reeferDriverReports.map((report) => (
                          <tr key={report.driver} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{report.driver}</td>
                            <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                            <td className="p-3 text-right">
                              {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                            </td>
                            <td className="p-3 text-right">
                              {report.avgLitresPerHour > 0 ? (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  {formatNumber(report.avgLitresPerHour, 2)} L/hr
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right">{report.fillCount}</td>
                            <td className="p-3 text-right text-muted-foreground">{formatDate(report.lastFillDate)}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {report.fleets.slice(0, 3).map(fleet => (
                                  <Badge key={fleet} variant="secondary" className="text-xs">{fleet}</Badge>
                                ))}
                                {report.fleets.length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{report.fleets.length - 3}</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-medium">
                          <td className="p-3">Total</td>
                          <td className="p-3 text-right">{formatNumber(reeferDriverReports.reduce((s, r) => s + r.totalLitres, 0))} L</td>
                          <td className="p-3 text-right">
                            <div>{formatCurrency(reeferDriverReports.reduce((s, r) => s + r.totalCost, 0))}</div>
                          </td>
                          <td className="p-3 text-right">—</td>
                          <td className="p-3 text-right">{reeferDriverReports.reduce((s, r) => s + r.fillCount, 0)}</td>
                          <td className="p-3"></td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Reefer Station Report */}
              {weeklyView ? (
                weeklyReeferStationBreakdown.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Fuel className="h-4 w-4 text-cyan-500" />
                      <h4 className="font-semibold text-lg">Reefer Station Report — Weekly</h4>
                    </div>
                    <div className="space-y-1">
                      {weeklyReeferStationBreakdown.map(week => (
                        <Collapsible key={week.weekKey} open={expandedBreakdownWeeks.has(`reefer-station-${week.weekKey}`)} onOpenChange={() => toggleBreakdownWeek(`reefer-station-${week.weekKey}`)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-cyan-50/40 dark:bg-cyan-900/20 hover:bg-cyan-50/70 dark:hover:bg-cyan-900/30 rounded-md cursor-pointer border border-cyan-200/40 dark:border-cyan-700/30">
                              <div className="flex items-center gap-3">
                                <ChevronRight className={`h-4 w-4 transition-transform ${expandedBreakdownWeeks.has(`reefer-station-${week.weekKey}`) ? 'rotate-90' : ''}`} />
                                <span className="font-semibold">Week {week.weekNumber}</span>
                                <span className="text-muted-foreground text-sm">{week.weekLabel}</span>
                                <Badge variant="secondary" className="text-xs">{week.data.length} stations</Badge>
                              </div>
                              <div className="flex gap-6 text-sm text-muted-foreground">
                                <span>{formatNumber(week.totals.totalLitres)} L</span>
                                <span>{formatCurrency(week.totals.totalCost)}</span>
                                <span>{week.totals.fillCount} fills</span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="overflow-x-auto mt-1 rounded-md border bg-muted/10">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-cyan-50/50 dark:bg-cyan-900/20">
                                    <th className="text-left p-3 font-medium">Station</th>
                                    <th className="text-right p-3 font-medium">Total Litres</th>
                                    <th className="text-right p-3 font-medium">Total Cost</th>
                                    <th className="text-right p-3 font-medium">Avg Cost/L</th>
                                    <th className="text-right p-3 font-medium">Fills</th>
                                    <th className="text-left p-3 font-medium">Reefer Units</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {week.data.map((report, i) => (
                                    <tr key={report.station} className={`border-b hover:bg-muted/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                      <td className="p-3 font-medium">{report.station}</td>
                                      <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                                      <td className="p-3 text-right">
                                        {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                                      </td>
                                      <td className="p-3 text-right">{formatNumber(report.avgCostPerLitre, 2)}/L</td>
                                      <td className="p-3 text-right">{report.fillCount}</td>
                                      <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                          {report.fleetsServed.slice(0, 4).map(f => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                                          {report.fleetsServed.length > 4 && <Badge variant="outline" className="text-xs">+{report.fleetsServed.length - 4}</Badge>}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-muted/50 font-medium border-t-2">
                                    <td className="p-3">Week Total</td>
                                    <td className="p-3 text-right">{formatNumber(week.totals.totalLitres)} L</td>
                                    <td className="p-3 text-right">{formatCurrency(week.totals.totalCost)}</td>
                                    <td className="p-3 text-right">—</td>
                                    <td className="p-3 text-right">{week.totals.fillCount}</td>
                                    <td className="p-3"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8"><p className="text-muted-foreground">No reefer records to report</p></div>
                )
              ) : reeferStationReports.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Fuel className="h-4 w-4 text-cyan-500" />
                    <h4 className="font-semibold text-lg">Reefer Station Report</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-cyan-50/50 dark:bg-cyan-900/20">
                          <th className="text-left p-3 font-medium">Station</th>
                          <th className="text-right p-3 font-medium">Total Litres</th>
                          <th className="text-right p-3 font-medium">Total Cost</th>
                          <th className="text-right p-3 font-medium">Avg Cost/L</th>
                          <th className="text-right p-3 font-medium">Fills</th>
                          <th className="text-left p-3 font-medium">Fleets Served</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reeferStationReports.map((report) => (
                          <tr key={report.station} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{report.station}</td>
                            <td className="p-3 text-right">{formatNumber(report.totalLitres)} L</td>
                            <td className="p-3 text-right">
                              {report.totalCost > 0 && <div>{formatCurrency(report.totalCost)}</div>}
                            </td>
                            <td className="p-3 text-right">
                              {formatNumber(report.avgCostPerLitre, 2)}/L
                            </td>
                            <td className="p-3 text-right">{report.fillCount}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {report.fleetsServed.slice(0, 4).map(f => (
                                  <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                                ))}
                                {report.fleetsServed.length > 4 && (
                                  <Badge variant="outline" className="text-xs">+{report.fleetsServed.length - 4}</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-medium">
                          <td className="p-3">Total</td>
                          <td className="p-3 text-right">{formatNumber(reeferStationReports.reduce((s, r) => s + r.totalLitres, 0))} L</td>
                          <td className="p-3 text-right">
                            <div>{formatCurrency(reeferStationReports.reduce((s, r) => s + r.totalCost, 0))}</div>
                          </td>
                          <td className="p-3 text-right">—</td>
                          <td className="p-3 text-right">{reeferStationReports.reduce((s, r) => s + r.fillCount, 0)}</td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Weekly Consumption Report */}
        {reportType === 'weekly' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Weekly Consumption Report
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {weeklyReports.length} week{weeklyReports.length !== 1 ? 's' : ''} of diesel data
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Weekly
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openTabExport({ overview: true, weekly: true })} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Weekly Report (Excel)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setExportFormat('pdf'); openTabExport({ overview: true, weekly: true }); }} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Weekly Report (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openTabExport({ overview: true, truckByDriver: true, truckByFleet: true, truckByStation: true, weekly: true })} className="gap-2">
                    <Download className="h-4 w-4" />
                    All Truck Reports
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {weeklyReports.length > 0 ? (
              weeklyReports.map((weekReport) => {
                const isExpanded = expandedReportWeeks.has(weekReport.weekStart);
                return (
                  <Collapsible key={weekReport.weekStart} open={isExpanded} onOpenChange={() => toggleReportWeekExpanded(weekReport.weekStart)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ChevronRight className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <div>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <BarChart3 className="h-5 w-5" />
                                  Week {weekReport.weekNumber} — {weekReport.weekLabel}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {formatNumber(weekReport.grandTotal.totalLitres)} L | {formatNumber(weekReport.grandTotal.totalKm)} km |{' '}
                                  {weekReport.grandTotal.consumption !== null && <span className="font-medium">{formatNumber(weekReport.grandTotal.consumption, 2)} km/L</span>}
                                  {weekReport.grandTotal.totalCost > 0 && ` | ${formatCurrency(weekReport.grandTotal.totalCost)}`}
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="space-y-6">
                            {weekReport.sections.map((section) => (
                              <div key={section.name} className="border rounded-lg p-4">
                                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                  {section.name}
                                  {section.isReeferSection && section.sectionTotal.reeferConsumption !== null && (
                                    <Badge variant="secondary" className="ml-2">
                                      Avg: {formatNumber(section.sectionTotal.reeferConsumption, 2)} L/H
                                    </Badge>
                                  )}
                                  {!section.isReeferSection && section.sectionTotal.consumption !== null && (
                                    <Badge variant="secondary" className="ml-2">
                                      Avg: {formatNumber(section.sectionTotal.consumption, 2)} km/L
                                    </Badge>
                                  )}
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b bg-muted/30">
                                        <th className="text-left p-2 font-medium">Fleet</th>
                                        <th className="text-right p-2 font-medium">Litres</th>
                                        <th className="text-right p-2 font-medium">
                                          {section.isReeferSection ? 'Hours' : 'Km'}
                                        </th>
                                        <th className="text-right p-2 font-medium">
                                          {section.isReeferSection ? 'L/H' : 'km/L'}
                                        </th>
                                        <th className="text-right p-2 font-medium">Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {section.data.map((fleetData) => (
                                        <tr key={fleetData.fleet} className="border-b hover:bg-muted/50">
                                          <td className="p-2 font-medium">{fleetData.fleet}</td>
                                          <td className="p-2 text-right">
                                            {fleetData.totalLitres > 0 ? (
                                              <span>{formatNumber(fleetData.totalLitres)} L</span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className="p-2 text-right">
                                            {section.isReeferSection ? (
                                              fleetData.totalHours > 0 ? (
                                                <span>{formatNumber(fleetData.totalHours, 1)}</span>
                                              ) : (
                                                <span className="text-muted-foreground">—</span>
                                              )
                                            ) : (
                                              fleetData.totalKm > 0 ? (
                                                <span>{formatNumber(fleetData.totalKm)}</span>
                                              ) : (
                                                <span className="text-muted-foreground">—</span>
                                              )
                                            )}
                                          </td>
                                          <td className="p-2 text-right">
                                            {section.isReeferSection ? (
                                              fleetData.reeferConsumption !== null ? (
                                                <span className="font-medium text-cyan-600">{formatNumber(fleetData.reeferConsumption, 2)}</span>
                                              ) : (
                                                <span className="text-muted-foreground">—</span>
                                              )
                                            ) : (
                                              fleetData.consumption !== null ? (
                                                <span className="font-medium text-primary">{formatNumber(fleetData.consumption, 2)}</span>
                                              ) : (
                                                <span className="text-muted-foreground">—</span>
                                              )
                                            )}
                                          </td>
                                          <td className="p-2 text-right">
                                            {fleetData.totalCost > 0 ? (
                                              <div>{formatCurrency(fleetData.totalCost)}</div>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-muted/50 font-medium">
                                        <td className="p-2">Section Total</td>
                                        <td className="p-2 text-right">{formatNumber(section.sectionTotal.totalLitres)} L</td>
                                        <td className="p-2 text-right">
                                          {section.isReeferSection
                                            ? (section.sectionTotal.totalHours > 0 ? formatNumber(section.sectionTotal.totalHours, 1) : '—')
                                            : formatNumber(section.sectionTotal.totalKm)}
                                        </td>
                                        <td className="p-2 text-right text-primary">
                                          {section.isReeferSection
                                            ? (section.sectionTotal.reeferConsumption !== null ? <span className="text-cyan-600">{formatNumber(section.sectionTotal.reeferConsumption, 2)}</span> : '—')
                                            : (section.sectionTotal.consumption !== null ? formatNumber(section.sectionTotal.consumption, 2) : '—')}
                                        </td>
                                        <td className="p-2 text-right">
                                          {section.sectionTotal.totalCost > 0 && <div>{formatCurrency(section.sectionTotal.totalCost)}</div>}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No diesel records to report</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>


      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Export Diesel Reports
            </DialogTitle>
            <DialogDescription>
              Choose format and select which reports to include in your export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Format selector */}
            <div>
              <p className="text-sm font-semibold mb-2">Export Format</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('excel')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${exportFormat === 'excel' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${exportFormat === 'pdf' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </div>

            {/* Report sections */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Reports to Include</p>

              <div className="flex items-center gap-2">
                <Checkbox id="exp-overview" checked={!!exportSel.overview} onCheckedChange={() => toggleSheet('overview')} />
                <Label htmlFor="exp-overview">Overview / Summary</Label>
              </div>

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-1">Truck Fleet</p>
              {([
                { key: 'truckByDriver', label: 'By Driver' },
                { key: 'truckByFleet', label: 'By Fleet Number' },
                { key: 'truckByStation', label: 'By Fuel Station' },
                { key: 'weekly', label: 'Weekly Consumption' },
              ] as { key: keyof ExportSheetSelection; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 ml-2">
                  <Checkbox id={`exp-${key}`} checked={!!exportSel[key]} onCheckedChange={() => toggleSheet(key)} />
                  <Label htmlFor={`exp-${key}`}>{label}</Label>
                </div>
              ))}

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-1">Reefer Fleet</p>
              {([
                { key: 'reeferByFleet', label: 'By Reefer Unit' },
                { key: 'reeferByDriver', label: 'By Driver' },
                { key: 'reeferByStation', label: 'By Fuel Station' },
              ] as { key: keyof ExportSheetSelection; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 ml-2">
                  <Checkbox id={`exp-${key}`} checked={!!exportSel[key]} onCheckedChange={() => toggleSheet(key)} />
                  <Label htmlFor={`exp-${key}`}>{label}</Label>
                </div>
              ))}

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-1">Raw Transaction Data</p>
              {([
                { key: 'truckTransactions', label: 'Truck Transactions' },
                { key: 'reeferTransactions', label: 'Reefer Transactions' },
              ] as { key: keyof ExportSheetSelection; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 ml-2">
                  <Checkbox id={`exp-${key}`} checked={!!exportSel[key]} onCheckedChange={() => toggleSheet(key)} />
                  <Label htmlFor={`exp-${key}`} className="text-muted-foreground">{label}</Label>
                </div>
              ))}
            </div>

            {/* Yearly Weekly Export */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-semibold">Yearly Weekly Export</p>
              <p className="text-xs text-muted-foreground">
                Export all transactions for a full year, grouped by week, with separate sheets for Trucks and Reefers.
              </p>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <Button
                    key={y}
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportYearlyWeekly(y)}
                    disabled={isExporting}
                    className="gap-1"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {y}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={isExporting}>Cancel</Button>
            <Button onClick={handleExport} disabled={isExporting} className="gap-2">
              {isExporting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full inline-block" />
                  Exporting...
                </>
              ) : (
                <>
                  {exportFormat === 'pdf' ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Export {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DieselReportsTab;
