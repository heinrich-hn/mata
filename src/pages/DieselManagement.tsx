import DieselDebriefModal from '@/components/diesel/DieselDebriefModal';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DieselImportModal from '@/components/diesel/DieselImportModal';
import DieselNormsModal from '@/components/diesel/DieselNormsModal';
import DieselTransactionViewModal from '@/components/diesel/DieselTransactionViewModal';
import ManualDieselEntryModal from '@/components/diesel/ManualDieselEntryModal';
import ProbeVerificationModal from '@/components/diesel/ProbeVerificationModal';
import ReeferDieselEntryModal from '@/components/diesel/ReeferDieselEntryModal';
import type { ReeferDieselRecord } from '@/components/diesel/ReeferDieselEntryModal';
import ReeferLinkageModal from '@/components/diesel/ReeferLinkageModal';
import ReeferVehicleLinkModal from '@/components/diesel/ReeferVehicleLinkModal';
import TripLinkageModal from '@/components/diesel/TripLinkageModal';
import Layout from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOperations } from '@/contexts/OperationsContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useReeferConsumptionSummary, useReeferDieselRecords, type ReeferDieselRecordRow } from '@/hooks/useReeferDiesel';
import { generateFleetDebriefSummaryPDF, generateSelectedTransactionsPDF, generateDebriefExcel, generateDebriefPDF, type DebriefExcelRecord } from '@/lib/dieselDebriefExport';
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
import { AlertCircle, BarChart3, Calendar, CalendarRange, CheckCircle, ChevronDown, ChevronRight, DollarSign, Download, Edit, Eye, FileSpreadsheet, FileText, Filter, Fuel, Link, MessageCircle, Plus, Settings, Snowflake, Trash2, Truck, Upload, User } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BatchDebriefModal, { type BatchDebriefData } from '@/components/diesel/BatchDebriefModal';

// Report data types
interface DriverReport {
  driver: string;
  totalLitres: number;
  totalCostZAR: number;
  totalCostUSD: number;
  totalDistance: number;
  avgKmPerLitre: number;
  fillCount: number;
  lastFillDate: string;
}

interface ReeferDriverReport {
  driver: string;
  totalLitres: number;
  totalCostZAR: number;
  totalCostUSD: number;
  fillCount: number;
  lastFillDate: string;
  fleets: string[];
  avgLitresPerHour: number;
  totalHoursOperated: number;
}

interface FleetReport {
  fleet: string;
  totalLitres: number;
  totalCostZAR: number;
  totalCostUSD: number;
  totalDistance: number;
  avgKmPerLitre: number;
  fillCount: number;
  drivers: string[];
}

interface ReeferFleetReport {
  fleet: string;
  totalLitres: number;
  totalCostZAR: number;
  totalCostUSD: number;
  fillCount: number;
  drivers: string[];
  avgLitresPerHour: number;
  totalHoursOperated: number;
}

interface StationReport {
  station: string;
  totalLitres: number;
  totalCostZAR: number;
  totalCostUSD: number;
  avgCostPerLitre: number;
  fillCount: number;
  fleetsServed: string[];
}

interface WeeklyFleetData {
  fleet: string;
  totalLitres: number;
  totalKm: number;
  consumption: number | null; // km/L for trucks
  totalHours: number; // hours operated for reefers
  reeferConsumption: number | null; // L/hr for reefers
  totalCostZAR: number;
  totalCostUSD: number;
}

interface WeeklySectionData {
  name: string;
  fleets: string[];
  isReeferSection: boolean; // Reefers use L/H instead of km/L
  data: WeeklyFleetData[];
  sectionTotal: { totalLitres: number; totalKm: number; consumption: number | null; totalHours: number; reeferConsumption: number | null; totalCostZAR: number; totalCostUSD: number };
}

interface WeeklyReport {
  weekNumber: number;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  sections: WeeklySectionData[];
  grandTotal: { totalLitres: number; totalKm: number; consumption: number | null; totalCostZAR: number; totalCostUSD: number };
}

// Fleet category definitions
const FLEET_CATEGORIES = {
  '30 Ton Trucks': ['21H', '22H', '23H', '24H', '26H', '28H', '31H', '32H', '33H', '34H'],
  'Reefers (L/H)': ['4F', '5F', '6F', '7F', '8F', '9F'],
  'Farm Lmv': ['1H', '4H', '6H'],
  'Bulawayo Truck': ['29H'],
  'Nyamagay Truck': ['30H'],
};

const REEFER_SECTION_NAME = 'Reefers (L/H)';
const isReeferFleet = (fleet?: string | null) => !!fleet && fleet.toUpperCase().trim().endsWith('F');

const getWeekNumberForDateString = (dateStr: string): number => {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
};

// Shared week-boundary helpers for breakdown memos
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
  return `${start.toLocaleDateString('en-ZA', o)} – ${end.toLocaleDateString('en-ZA', o)}`;
};

const DieselManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fleetFilter, _setFleetFilter] = useState<string>('');
  const [weekFilter, _setWeekFilter] = useState<string>('');
  const [reportType, setReportType] = useState<'driver' | 'fleet' | 'station' | 'weekly' | 'reefer'>('fleet');

  // Report date range state
  const [reportPeriod, setReportPeriod] = useState<string>('3months');
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [reportDateFrom, setReportDateFrom] = useState(thirtyDaysAgoStr);
  const [reportDateTo, setReportDateTo] = useState(todayStr);
  const {
    dieselRecords,
    trips,
    dieselNorms,
    addDieselRecord,
    updateDieselRecord,
    deleteDieselRecord,
    linkDieselToTrip,
    unlinkDieselFromTrip,
    addDieselNorm,
    updateDieselNorm,
    deleteDieselNorm,
    addCostEntry: _addCostEntry,
    deleteCostEntry,
  } = useOperations();

  // Batch debrief state
  const [isBatchDebriefOpen, setIsBatchDebriefOpen] = useState(false);
  const [selectedFleetForBatch, setSelectedFleetForBatch] = useState<string>('');

  // Consolidated reefer diesel records hook (CRUD + records from reefer_diesel_records table)
  const { records: allReeferRecords, createRecordAsync, updateRecordAsync, deleteRecordAsync: deleteReeferRecordAsync, linkToVehicleAsync, unlinkFromVehicleAsync } = useReeferDieselRecords({});

  const truckRecords = useMemo(
    () => dieselRecords.filter(record => !isReeferFleet(record.fleet_number)),
    [dieselRecords]
  );
  // Reefer records: merge from BOTH diesel_records table (legacy) AND reefer_diesel_records table (new)
  const reeferRecords = useMemo(() => {
    // 1. Legacy reefer records from diesel_records table
    const legacyReefer = dieselRecords.filter(record => isReeferFleet(record.fleet_number));

    // 2. New reefer records from reefer_diesel_records table (mapped to DieselConsumptionRecord format)
    const newReefer = allReeferRecords.map((r) => ({
      id: r.id,
      fleet_number: r.reefer_unit,
      driver_name: r.driver_name || undefined,
      fuel_station: r.fuel_station,
      litres_filled: r.litres_filled,
      total_cost: r.total_cost,
      cost_per_litre: r.cost_per_litre ?? undefined,
      km_reading: 0,
      date: r.date,
      currency: r.currency,
      notes: r.notes || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
      trip_id: r.trip_id ?? undefined,
      // Reefer-specific fields carried through for display
      operating_hours: r.operating_hours,
      previous_operating_hours: r.previous_operating_hours,
      hours_operated: r.hours_operated,
      litres_per_hour: r.litres_per_hour,
    } as DieselConsumptionRecord));

    // 3. Map legacy records: km_reading was actually hours, compute reefer fields
    const mappedLegacy = legacyReefer.map((r) => {
      const opHours = r.km_reading || null;
      const prevHours = r.previous_km_reading || null;
      const hoursOp = (opHours != null && prevHours != null && opHours > prevHours)
        ? opHours - prevHours : (r.distance_travelled || null);
      const lph = (hoursOp && hoursOp > 0 && r.litres_filled > 0)
        ? r.litres_filled / hoursOp : null;
      return {
        ...r,
        operating_hours: opHours,
        previous_operating_hours: prevHours,
        hours_operated: hoursOp,
        litres_per_hour: lph,
      } as DieselConsumptionRecord;
    });

    // 4. Merge, deduplicating by ID (reefer_diesel_records take precedence)
    const reeferIds = new Set(newReefer.map(r => r.id));
    const dedupedLegacy = mappedLegacy.filter(r => !reeferIds.has(r.id));
    return [...newReefer, ...dedupedLegacy];
  }, [dieselRecords, allReeferRecords]);
  const reeferFleetNumbers = useMemo(() => {
    const fleets = new Set(reeferRecords.map(r => r.fleet_number).filter(Boolean));
    return Array.from(fleets).sort();
  }, [reeferRecords]);

  // Filter records by report period for the reports tab
  const filterByPeriod = useCallback((records: DieselConsumptionRecord[]) => {
    if (reportPeriod === 'all') return records;

    let fromDate: string;

    if (reportPeriod === 'custom') {
      return records.filter(r => r.date >= reportDateFrom && r.date <= reportDateTo);
    }

    const now = new Date();
    switch (reportPeriod) {
      case '1month':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
        break;
      case '3months':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0];
        break;
      case '6months':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0];
        break;
      case '1year':
        fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
        break;
      default:
        return records;
    }

    return records.filter(r => r.date >= fromDate && r.date <= todayStr);
  }, [reportPeriod, reportDateFrom, reportDateTo, todayStr]);

  const filteredTruckRecords = useMemo(() => filterByPeriod(truckRecords), [truckRecords, filterByPeriod]);
  const filteredReeferRecords = useMemo(() => filterByPeriod(reeferRecords), [reeferRecords, filterByPeriod]);

  // Modal states
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTripLinkageOpen, setIsTripLinkageOpen] = useState(false);
  const [isProbeVerificationOpen, setIsProbeVerificationOpen] = useState(false);
  const [isDebriefOpen, setIsDebriefOpen] = useState(false);
  const [isNormsModalOpen, setIsNormsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReeferLinkageOpen, setIsReeferLinkageOpen] = useState(false);
  const [isReeferEntryOpen, setIsReeferEntryOpen] = useState(false);
  const [isReeferVehicleLinkOpen, setIsReeferVehicleLinkOpen] = useState(false);
  const [selectedReeferForVehicle, setSelectedReeferForVehicle] = useState<ReeferDieselRecordRow | null>(null);

  // Selected records
  const [selectedRecord, setSelectedRecord] = useState<DieselConsumptionRecord | null>(null);

  // Vehicles for fleet_number → vehicle_id mapping
  const { data: vehicles = [] } = useVehicles();
  const [selectedReeferEditRecord, setSelectedReeferEditRecord] = useState<ReeferDieselRecord | null>(null);
  const [selectedNorm, setSelectedNorm] = useState<DieselNorms | null>(null);

  // UI state for expanded fleet/week sections
  const [expandedFleets, setExpandedFleets] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedReportWeeks, setExpandedReportWeeks] = useState<Set<string>>(new Set());

  // Export dialog state
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

  // Weekly breakdown view toggle (applies to all report sub-views)
  const [weeklyView, setWeeklyView] = useState(false);
  const [expandedBreakdownWeeks, setExpandedBreakdownWeeks] = useState<Set<string>>(new Set());
  const toggleBreakdownWeek = (weekKey: string) =>
    setExpandedBreakdownWeeks(prev => {
      const n = new Set(prev);
      if (n.has(weekKey)) { n.delete(weekKey); } else { n.add(weekKey); }
      return n;
    });

  // Toggle week expansion in weekly report
  const toggleReportWeekExpanded = (weekKey: string) => {
    setExpandedReportWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekKey)) {
        newSet.delete(weekKey);
      } else {
        newSet.add(weekKey);
      }
      return newSet;
    });
  };

  // Linked reefer records for view modal
  const [linkedReeferRecords, setLinkedReeferRecords] = useState<ReeferDieselRecordRow[]>([]);

  // allReeferRecords already fetched via consolidated hook above

  // Fetch reefer consumption summary for L/hr data
  const { data: reeferConsumptionSummary = [] } = useReeferConsumptionSummary();

  // Create L/hr lookup map: reefer_unit -> { avgLitresPerHour, totalHoursOperated }
  const reeferLhrMap = useMemo(() => {
    const map = new Map<string, { avgLitresPerHour: number; totalHoursOperated: number }>();
    reeferConsumptionSummary.forEach(s => {
      map.set(s.reefer_unit, {
        avgLitresPerHour: s.avg_litres_per_hour,
        totalHoursOperated: s.total_hours_operated,
      });
    });
    return map;
  }, [reeferConsumptionSummary]);

  // Update linked reefer records when selected record changes
  useEffect(() => {
    if (selectedRecord?.id && allReeferRecords.length > 0) {
      const linked = allReeferRecords.filter(
        (r) => r.linked_diesel_record_id === selectedRecord.id
      );
      setLinkedReeferRecords(linked);
    } else {
      setLinkedReeferRecords([]);
    }
  }, [selectedRecord?.id, allReeferRecords]);

  // Debrief fleet filter for PDF export
  const [debriefFleetFilter, setDebriefFleetFilter] = useState<string>('');
  // Pending debrief accordion — tracks which fleet groups are expanded
  const [expandedPendingFleets, setExpandedPendingFleets] = useState<Set<string>>(new Set());
  // WhatsApp-shared record IDs, persisted in localStorage
  const [whatsappSharedIds, setWhatsappSharedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('diesel-wa-shared') || '[]'); } catch { return []; }
  });
  const whatsappSharedSet = useMemo(() => new Set(whatsappSharedIds), [whatsappSharedIds]);
  const handleWhatsappShared = (recordId: string) => {
    setWhatsappSharedIds(prev => {
      if (prev.includes(recordId)) return prev;
      const next = [...prev, recordId];
      try { localStorage.setItem('diesel-wa-shared', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Calculate summary statistics (trucks)
  const _totalRecords = truckRecords.length;
  const totalLitres = truckRecords.reduce((sum, record) => sum + (record.litres_filled || 0), 0);

  // Calculate costs by currency
  const _totalCostZAR = truckRecords
    .filter(r => (r.currency || 'ZAR') === 'ZAR')
    .reduce((sum, record) => sum + (record.total_cost || 0), 0);
  const _totalCostUSD = truckRecords
    .filter(r => r.currency === 'USD')
    .reduce((sum, record) => sum + (record.total_cost || 0), 0);

  const totalDistance = truckRecords.reduce((sum, record) => sum + (record.distance_travelled || 0), 0);
  const _averageKmPerLitre = totalDistance && totalLitres
    ? totalDistance / totalLitres
    : 0;

  // Reefer summary statistics
  const _reeferTotalRecords = reeferRecords.length;
  const _reeferTotalLitres = reeferRecords.reduce((sum, record) => sum + (record.litres_filled || 0), 0);
  const _reeferTotalCostZAR = reeferRecords
    .filter(r => (r.currency || 'ZAR') === 'ZAR')
    .reduce((sum, record) => sum + (record.total_cost || 0), 0);
  const _reeferTotalCostUSD = reeferRecords
    .filter(r => r.currency === 'USD')
    .reduce((sum, record) => sum + (record.total_cost || 0), 0);

  // Helper: Calculate km per litre for a record
  const calculateKmPerLitre = (record: DieselConsumptionRecord): number | null => {
    if (isReeferFleet(record.fleet_number)) return null;
    if (!record.distance_travelled || !record.litres_filled) return null;
    return record.distance_travelled / record.litres_filled;
  };

  // Helper: Get norm for a fleet number
  const getNormForFleet = (fleetNumber: string): DieselNorms | undefined => {
    return dieselNorms.find(norm => norm.fleet_number === fleetNumber);
  };

  // Helper: Check if consumption is BELOW acceptable range (poor efficiency requiring debrief)
  // Only low km/L (poor efficiency) triggers debrief - high km/L is good performance
  const isOutsideNorm = (kmPerLitre: number, norm: DieselNorms | undefined): boolean => {
    if (!norm) return false;
    return kmPerLitre < norm.min_acceptable;
  };

  // Helper: Get variance from expected norm
  const _getVarianceFromNorm = (kmPerLitre: number, norm: DieselNorms | undefined): number | null => {
    if (!norm) return null;
    const variance = ((kmPerLitre - norm.expected_km_per_litre) / norm.expected_km_per_litre) * 100;
    return variance;
  };

  // Calculate records requiring debrief based on norms
  const recordsRequiringDebrief = truckRecords.filter(record => {
    const kmPerLitre = calculateKmPerLitre(record);
    if (!kmPerLitre) return false;
    const norm = getNormForFleet(record.fleet_number);
    return isOutsideNorm(kmPerLitre, norm) && !record.debrief_signed;
  });

  // Count of debriefed vs pending
  const _debriefStats = {
    total: recordsRequiringDebrief.length,
    pending: recordsRequiringDebrief.filter(r => !r.debrief_signed).length,
    completed: truckRecords.filter(r => r.debrief_signed).length,
  };

  // Records with pending cost (submitted by driver without a configured station price)
  const pendingCostRecords = useMemo(
    () => dieselRecords.filter(r => r.cost_per_litre == null || r.cost_per_litre === 0),
    [dieselRecords]
  );

  // Get current week number
  const getCurrentWeekNumber = (): number => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  const currentWeek = getCurrentWeekNumber();

  // Generate week options (1-52)
  const _weekOptions = useMemo(() => {
    return Array.from({ length: 52 }, (_, i) => i + 1);
  }, []);

  // Filter diesel records by fleet and week
  const _filteredDieselRecords = useMemo(() => {
    let filtered = dieselRecords;
    if (fleetFilter) {
      filtered = filtered.filter(record => record.fleet_number === fleetFilter);
    }
    if (weekFilter) {
      const weekNum = parseInt(weekFilter);
      filtered = filtered.filter(record => getWeekNumberForDateString(record.date) === weekNum);
    }
    return filtered;
  }, [dieselRecords, fleetFilter, weekFilter]);

  // Get unique fleet numbers from records for filter dropdown
  const uniqueFleetNumbers = useMemo(() => {
    const fleets = new Set(truckRecords.map(r => r.fleet_number));
    return Array.from(fleets).sort();
  }, [truckRecords]);

  // Helper: Get week date range string (e.g., "Jan 27 - Feb 2")
  const getWeekDateRange = (weekNum: number, year: number = new Date().getFullYear()): string => {
    const jan1 = new Date(year, 0, 1);
    const daysToFirstMonday = (8 - jan1.getDay()) % 7;
    const firstWeekStart = new Date(year, 0, 1 + daysToFirstMonday - 7);
    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const formatShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatShort(weekStart)} - ${formatShort(weekEnd)}`;
  };

  const groupRecordsByFleetAndWeek = useCallback((records: DieselConsumptionRecord[]) => {
    const grouped: Record<string, Record<number, DieselConsumptionRecord[]>> = {};

    records.forEach(record => {
      const fleet = record.fleet_number;
      const week = getWeekNumberForDateString(record.date);

      if (!grouped[fleet]) {
        grouped[fleet] = {};
      }
      if (!grouped[fleet][week]) {
        grouped[fleet][week] = [];
      }
      grouped[fleet][week].push(record);
    });

    // Sort records within each week by date descending
    Object.keys(grouped).forEach(fleet => {
      Object.keys(grouped[fleet]).forEach(weekStr => {
        const week = parseInt(weekStr);
        grouped[fleet][week].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    });

    return grouped;
  }, []);

  // Group records by fleet, then by week
  const truckRecordsGroupedByFleetAndWeek = useMemo(
    () => groupRecordsByFleetAndWeek(truckRecords),
    [groupRecordsByFleetAndWeek, truckRecords]
  );
  const reeferRecordsGroupedByFleetAndWeek = useMemo(
    () => groupRecordsByFleetAndWeek(reeferRecords),
    [groupRecordsByFleetAndWeek, reeferRecords]
  );

  // Get sorted fleet list
  const sortedFleets = useMemo(() => {
    return Object.keys(truckRecordsGroupedByFleetAndWeek).sort();
  }, [truckRecordsGroupedByFleetAndWeek]);
  const sortedReeferFleets = useMemo(() => {
    return Object.keys(reeferRecordsGroupedByFleetAndWeek).sort();
  }, [reeferRecordsGroupedByFleetAndWeek]);

  // Toggle fleet expansion
  const toggleFleetExpanded = (fleet: string) => {
    setExpandedFleets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fleet)) {
        newSet.delete(fleet);
      } else {
        newSet.add(fleet);
      }
      return newSet;
    });
  };

  // Toggle week expansion
  const toggleWeekExpanded = (key: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Calculate fleet totals
  const getFleetTotals = (
    groupedRecords: Record<string, Record<number, DieselConsumptionRecord[]>>,
    fleet: string
  ) => {
    const fleetRecords = Object.values(groupedRecords[fleet] || {}).flat();
    const totalLitres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
    const totalCostZAR = fleetRecords.reduce((sum, r) => sum + ((r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0), 0);
    const totalCostUSD = fleetRecords.reduce((sum, r) => sum + (r.currency === 'USD' ? (r.total_cost || 0) : 0), 0);
    const totalDistance = fleetRecords.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
    const isReefer = isReeferFleet(fleet);
    const avgKmL = !isReefer && totalLitres > 0 ? totalDistance / totalLitres : 0;
    // Calculate pending debrief dynamically based on norms instead of using stored requires_debrief
    const pendingDebrief = isReefer ? 0 : fleetRecords.filter(r => {
      if (r.debrief_signed) return false; // Already debriefed
      const kmPerLitre = calculateKmPerLitre(r);
      if (!kmPerLitre) return false;
      const norm = getNormForFleet(r.fleet_number);
      return isOutsideNorm(kmPerLitre, norm);
    }).length;
    return { totalLitres, totalCostZAR, totalCostUSD, totalDistance, avgKmL, count: fleetRecords.length, pendingDebrief };
  };

  // Calculate week totals for a fleet
  const getWeekTotals = (records: DieselConsumptionRecord[], isReefer = false) => {
    const totalLitres = records.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
    const totalCostZAR = records.reduce((sum, r) => sum + ((r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0), 0);
    const totalCostUSD = records.reduce((sum, r) => sum + (r.currency === 'USD' ? (r.total_cost || 0) : 0), 0);
    const totalDistance = records.reduce((sum, r) => sum + (r.distance_travelled || 0), 0);
    const avgKmL = !isReefer && totalLitres > 0 ? totalDistance / totalLitres : 0;
    // Calculate pending debrief dynamically based on norms instead of using stored requires_debrief
    const pendingDebrief = isReefer ? 0 : records.filter(r => {
      if (r.debrief_signed) return false; // Already debriefed
      const kmPerLitre = calculateKmPerLitre(r);
      if (!kmPerLitre) return false;
      const norm = getNormForFleet(r.fleet_number);
      return isOutsideNorm(kmPerLitre, norm);
    }).length;
    return { totalLitres, totalCostZAR, totalCostUSD, totalDistance, avgKmL, count: records.length, pendingDebrief };
  };

  // Generate reports by driver
  const driverReports = useMemo((): DriverReport[] => {
    const driverMap = new Map<string, DriverReport>();

    filteredTruckRecords.forEach(record => {
      const driver = record.driver_name || 'Unknown Driver';
      const existing = driverMap.get(driver);

      if (existing) {
        existing.totalLitres += record.litres_filled || 0;
        existing.totalCostZAR += (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0;
        existing.totalCostUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
        existing.totalDistance += record.distance_travelled || 0;
        existing.fillCount += 1;
        if (record.date > existing.lastFillDate) existing.lastFillDate = record.date;
      } else {
        driverMap.set(driver, {
          driver,
          totalLitres: record.litres_filled || 0,
          totalCostZAR: (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0,
          totalCostUSD: record.currency === 'USD' ? (record.total_cost || 0) : 0,
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
        existing.totalCostZAR += (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0;
        existing.totalCostUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
        existing.fillCount += 1;
        if (record.date > existing.lastFillDate) existing.lastFillDate = record.date;
        if (fleet && !existing.fleets.includes(fleet)) existing.fleets.push(fleet);
      } else {
        driverMap.set(driver, {
          driver,
          totalLitres: record.litres_filled || 0,
          totalCostZAR: (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0,
          totalCostUSD: record.currency === 'USD' ? (record.total_cost || 0) : 0,
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hrs = (r as any).hours_operated as number | null;
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
        existing.totalCostZAR += (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0;
        existing.totalCostUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
        existing.totalDistance += record.distance_travelled || 0;
        existing.fillCount += 1;
        if (!existing.drivers.includes(driver)) existing.drivers.push(driver);
      } else {
        fleetMap.set(fleet, {
          fleet,
          totalLitres: record.litres_filled || 0,
          totalCostZAR: (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0,
          totalCostUSD: record.currency === 'USD' ? (record.total_cost || 0) : 0,
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
        existing.totalCostZAR += (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0;
        existing.totalCostUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
        existing.fillCount += 1;
        if (!existing.drivers.includes(driver)) existing.drivers.push(driver);
      } else {
        fleetMap.set(fleet, {
          fleet,
          totalLitres: record.litres_filled || 0,
          totalCostZAR: (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0,
          totalCostUSD: record.currency === 'USD' ? (record.total_cost || 0) : 0,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recsWithHours = fleetRecs.filter(r => (r as any).hours_operated != null && (r as any).hours_operated > 0);
      if (recsWithHours.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalHrs = recsWithHours.reduce((sum, r) => sum + ((r as any).hours_operated || 0), 0);
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
        existing.totalCostZAR += (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0;
        existing.totalCostUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
        existing.fillCount += 1;
        if (!existing.fleetsServed.includes(fleet)) existing.fleetsServed.push(fleet);
      } else {
        stationMap.set(station, {
          station,
          totalLitres: record.litres_filled || 0,
          totalCostZAR: (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0,
          totalCostUSD: record.currency === 'USD' ? (record.total_cost || 0) : 0,
          avgCostPerLitre: 0,
          fillCount: 1,
          fleetsServed: [fleet],
        });
      }
    });

    // Calculate averages
    stationMap.forEach(report => {
      const totalCost = report.totalCostZAR + report.totalCostUSD;
      report.avgCostPerLitre = report.totalLitres > 0 ? totalCost / report.totalLitres : 0;
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
        existing.totalCostZAR += (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0;
        existing.totalCostUSD += record.currency === 'USD' ? (record.total_cost || 0) : 0;
        existing.fillCount += 1;
        if (!existing.fleetsServed.includes(fleet)) existing.fleetsServed.push(fleet);
      } else {
        stationMap.set(station, {
          station,
          totalLitres: record.litres_filled || 0,
          totalCostZAR: (record.currency || 'ZAR') === 'ZAR' ? (record.total_cost || 0) : 0,
          totalCostUSD: record.currency === 'USD' ? (record.total_cost || 0) : 0,
          avgCostPerLitre: 0,
          fillCount: 1,
          fleetsServed: [fleet],
        });
      }
    });

    stationMap.forEach(report => {
      const totalCost = report.totalCostZAR + report.totalCostUSD;
      report.avgCostPerLitre = report.totalLitres > 0 ? totalCost / report.totalLitres : 0;
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
      let grandTotalCostZAR = 0;
      let grandTotalCostUSD = 0;

      for (const [sectionName, fleetList] of Object.entries(FLEET_CATEGORIES)) {
        const isReeferSection = sectionName === REEFER_SECTION_NAME;
        const sectionFleetList = isReeferSection ? reeferFleetNumbers : fleetList;
        const sectionData: WeeklyFleetData[] = [];
        let sectionTotalLitres = 0;
        let sectionTotalKm = 0;
        let sectionTotalHours = 0;
        let sectionTotalCostZAR = 0;
        let sectionTotalCostUSD = 0;

        if (isReeferSection) {
          // Use merged reefer records for the reefer section
          for (const fleet of sectionFleetList) {
            const fleetRecords = weekReeferRecords.filter(r => r.fleet_number === fleet);
            if (fleetRecords.length > 0) {
              const totalLitres = fleetRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const totalHours = fleetRecords.reduce((sum, r) => sum + ((r as any).hours_operated || 0), 0);
              const totalCostZAR = fleetRecords.reduce((sum, r) => sum + ((r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0), 0);
              const totalCostUSD = fleetRecords.reduce((sum, r) => sum + (r.currency === 'USD' ? (r.total_cost || 0) : 0), 0);
              const reeferConsumption = totalHours > 0 ? totalLitres / totalHours : null;

              sectionData.push({ fleet, totalLitres, totalKm: 0, consumption: null, totalHours, reeferConsumption, totalCostZAR, totalCostUSD });
              sectionTotalLitres += totalLitres;
              sectionTotalHours += totalHours;
              sectionTotalCostZAR += totalCostZAR;
              sectionTotalCostUSD += totalCostUSD;
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
              const totalCostZAR = fleetRecords.reduce((sum, r) => sum + ((r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0), 0);
              const totalCostUSD = fleetRecords.reduce((sum, r) => sum + (r.currency === 'USD' ? (r.total_cost || 0) : 0), 0);
              const consumption = totalLitres > 0 ? totalKm / totalLitres : null;

              sectionData.push({ fleet, totalLitres, totalKm, consumption, totalHours: 0, reeferConsumption: null, totalCostZAR, totalCostUSD });
              sectionTotalLitres += totalLitres;
              sectionTotalKm += totalKm;
              sectionTotalCostZAR += totalCostZAR;
              sectionTotalCostUSD += totalCostUSD;
            }
          }
        }

        // Add fleets with 0 litres if they're in the category (to show all fleets)
        for (const fleet of sectionFleetList) {
          if (!sectionData.find(d => d.fleet === fleet)) {
            sectionData.push({ fleet, totalLitres: 0, totalKm: 0, consumption: null, totalHours: 0, reeferConsumption: null, totalCostZAR: 0, totalCostUSD: 0 });
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
          sectionTotal: { totalLitres: sectionTotalLitres, totalKm: sectionTotalKm, consumption: sectionConsumption, totalHours: sectionTotalHours, reeferConsumption: sectionReeferConsumption, totalCostZAR: sectionTotalCostZAR, totalCostUSD: sectionTotalCostUSD },
        });

        if (!isReeferSection) {
          grandTotalLitres += sectionTotalLitres;
          grandTotalKm += sectionTotalKm;
          grandTotalCostZAR += sectionTotalCostZAR;
          grandTotalCostUSD += sectionTotalCostUSD;
        }
      }

      const grandConsumption = grandTotalLitres > 0 ? grandTotalKm / grandTotalLitres : null;
      reports.push({
        weekNumber: getWeekNumber(weekStart),
        weekLabel: formatWeekLabel(weekStart, weekEnd),
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        sections,
        grandTotal: { totalLitres: grandTotalLitres, totalKm: grandTotalKm, consumption: grandConsumption, totalCostZAR: grandTotalCostZAR, totalCostUSD: grandTotalCostUSD },
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
          ex.totalCostZAR += (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0;
          ex.totalCostUSD += r.currency === 'USD' ? (r.total_cost || 0) : 0;
          ex.totalDistance += r.distance_travelled || 0;
          ex.fillCount += 1;
          if (!ex.drivers.includes(dr)) ex.drivers.push(dr);
        } else {
          fm.set(fl, { fleet: fl, totalLitres: r.litres_filled || 0, totalCostZAR: (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0, totalCostUSD: r.currency === 'USD' ? (r.total_cost || 0) : 0, totalDistance: r.distance_travelled || 0, avgKmPerLitre: 0, fillCount: 1, drivers: [dr] });
        }
      });
      fm.forEach(rp => { rp.avgKmPerLitre = rp.totalLitres > 0 ? rp.totalDistance / rp.totalLitres : 0; });
      const data = Array.from(fm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCostZAR: data.reduce((s, r) => s + r.totalCostZAR, 0), totalCostUSD: data.reduce((s, r) => s + r.totalCostUSD, 0), totalDistance: data.reduce((s, r) => s + r.totalDistance, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
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
          ex.totalCostZAR += (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0;
          ex.totalCostUSD += r.currency === 'USD' ? (r.total_cost || 0) : 0;
          ex.totalDistance += r.distance_travelled || 0;
          ex.fillCount += 1;
          if (r.date > ex.lastFillDate) ex.lastFillDate = r.date;
        } else {
          dm.set(dr, { driver: dr, totalLitres: r.litres_filled || 0, totalCostZAR: (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0, totalCostUSD: r.currency === 'USD' ? (r.total_cost || 0) : 0, totalDistance: r.distance_travelled || 0, avgKmPerLitre: 0, fillCount: 1, lastFillDate: r.date });
        }
      });
      dm.forEach(rp => { rp.avgKmPerLitre = rp.totalLitres > 0 ? rp.totalDistance / rp.totalLitres : 0; });
      const data = Array.from(dm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCostZAR: data.reduce((s, r) => s + r.totalCostZAR, 0), totalCostUSD: data.reduce((s, r) => s + r.totalCostUSD, 0), totalDistance: data.reduce((s, r) => s + r.totalDistance, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
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
          ex.totalCostZAR += (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0;
          ex.totalCostUSD += r.currency === 'USD' ? (r.total_cost || 0) : 0;
          ex.fillCount += 1;
          if (!ex.fleetsServed.includes(fl)) ex.fleetsServed.push(fl);
        } else {
          sm.set(st, { station: st, totalLitres: r.litres_filled || 0, totalCostZAR: (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0, totalCostUSD: r.currency === 'USD' ? (r.total_cost || 0) : 0, avgCostPerLitre: 0, fillCount: 1, fleetsServed: [fl] });
        }
      });
      sm.forEach(rp => { rp.avgCostPerLitre = rp.totalLitres > 0 ? (rp.totalCostZAR + rp.totalCostUSD) / rp.totalLitres : 0; });
      const data = Array.from(sm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCostZAR: data.reduce((s, r) => s + r.totalCostZAR, 0), totalCostUSD: data.reduce((s, r) => s + r.totalCostUSD, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
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
          ex.totalCostZAR += (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0;
          ex.totalCostUSD += r.currency === 'USD' ? (r.total_cost || 0) : 0;
          ex.fillCount += 1;
          if (!ex.drivers.includes(dr)) ex.drivers.push(dr);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hrs = (r as any).hours_operated as number | null;
          if (hrs && hrs > 0) ex.totalHoursOperated += hrs;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hrs = (r as any).hours_operated as number | null;
          fm.set(fl, { fleet: fl, totalLitres: r.litres_filled || 0, totalCostZAR: (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0, totalCostUSD: r.currency === 'USD' ? (r.total_cost || 0) : 0, fillCount: 1, drivers: [dr], avgLitresPerHour: 0, totalHoursOperated: (hrs && hrs > 0) ? hrs : 0 });
        }
      });
      fm.forEach(rp => { rp.avgLitresPerHour = rp.totalHoursOperated > 0 ? rp.totalLitres / rp.totalHoursOperated : 0; });
      const data = Array.from(fm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCostZAR: data.reduce((s, r) => s + r.totalCostZAR, 0), totalCostUSD: data.reduce((s, r) => s + r.totalCostUSD, 0), totalHoursOperated: data.reduce((s, r) => s + r.totalHoursOperated, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
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
          ex.totalCostZAR += (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0;
          ex.totalCostUSD += r.currency === 'USD' ? (r.total_cost || 0) : 0;
          ex.fillCount += 1;
          if (r.date > ex.lastFillDate) ex.lastFillDate = r.date;
          if (fl && !ex.fleets.includes(fl)) ex.fleets.push(fl);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hrs = (r as any).hours_operated as number | null;
          if (hrs && hrs > 0) ex.totalHoursOperated += hrs;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hrs = (r as any).hours_operated as number | null;
          dm.set(dr, { driver: dr, totalLitres: r.litres_filled || 0, totalCostZAR: (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0, totalCostUSD: r.currency === 'USD' ? (r.total_cost || 0) : 0, fillCount: 1, lastFillDate: r.date, fleets: fl ? [fl] : [], avgLitresPerHour: 0, totalHoursOperated: (hrs && hrs > 0) ? hrs : 0 });
        }
      });
      dm.forEach(rp => { rp.avgLitresPerHour = rp.totalHoursOperated > 0 ? rp.totalLitres / rp.totalHoursOperated : 0; });
      const data = Array.from(dm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCostZAR: data.reduce((s, r) => s + r.totalCostZAR, 0), totalCostUSD: data.reduce((s, r) => s + r.totalCostUSD, 0), totalHoursOperated: data.reduce((s, r) => s + r.totalHoursOperated, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
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
          ex.totalCostZAR += (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0;
          ex.totalCostUSD += r.currency === 'USD' ? (r.total_cost || 0) : 0;
          ex.fillCount += 1;
          if (!ex.fleetsServed.includes(fl)) ex.fleetsServed.push(fl);
        } else {
          sm.set(st, { station: st, totalLitres: r.litres_filled || 0, totalCostZAR: (r.currency || 'ZAR') === 'ZAR' ? (r.total_cost || 0) : 0, totalCostUSD: r.currency === 'USD' ? (r.total_cost || 0) : 0, avgCostPerLitre: 0, fillCount: 1, fleetsServed: [fl] });
        }
      });
      sm.forEach(rp => { rp.avgCostPerLitre = rp.totalLitres > 0 ? (rp.totalCostZAR + rp.totalCostUSD) / rp.totalLitres : 0; });
      const data = Array.from(sm.values()).sort((a, b) => b.totalLitres - a.totalLitres);
      return { weekKey, weekNumber: _wkNumber(ws), weekLabel: _wkLabel(ws, we), weekStart: ws.toISOString().split('T')[0], weekEnd: we.toISOString().split('T')[0], data, totals: { totalLitres: data.reduce((s, r) => s + r.totalLitres, 0), totalCostZAR: data.reduce((s, r) => s + r.totalCostZAR, 0), totalCostUSD: data.reduce((s, r) => s + r.totalCostUSD, 0), fillCount: data.reduce((s, r) => s + r.fillCount, 0) } };
    });
  }, [filteredReeferRecords]);

  const buildExportInput = () => ({
    driverReports,
    reeferDriverReports,
    fleetReports,
    reeferFleetReports,
    stationReports,
    reeferStationReports,
    weeklyReports,
    truckRecords: truckRecords as unknown as DieselExportRecord[],
    reeferRecords: reeferRecords as unknown as DieselExportRecord[],
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
  const exportAllTransactionsToExcel = () => {
    // Create Excel-compatible CSV with all transaction details
    const headers = [
      'Date',
      'Fleet Number',
      'Driver',
      'Fuel Station',
      'Litres Filled',
      'Cost per Litre',
      'Total Cost',
      'Currency',
      'KM Reading',
      'Previous KM',
      'Distance Travelled',
      'km/L',
      'Debrief Status',
      'Debrief Required',
      'Debriefed By',
      'Debrief Date',
      'Debrief Reason',
      'Notes',
      'Trip ID',
      'Probe Verified',
    ].join('\t');

    const rows = dieselRecords.map(record => {
      const kmPerLitre = record.distance_travelled && record.litres_filled
        ? (record.distance_travelled / record.litres_filled).toFixed(2)
        : '';
      const norm = getNormForFleet(record.fleet_number);
      const requiresDebrief = kmPerLitre && norm && parseFloat(kmPerLitre) < norm.min_acceptable;

      return [
        record.date,
        record.fleet_number,
        record.driver_name || '',
        record.fuel_station || '',
        record.litres_filled?.toFixed(2) || '',
        record.cost_per_litre?.toFixed(2) || '',
        record.total_cost?.toFixed(2) || '',
        record.currency || 'ZAR',
        record.km_reading || '',
        record.previous_km_reading || '',
        record.distance_travelled || '',
        kmPerLitre,
        record.debrief_signed ? 'Completed' : (requiresDebrief ? 'Pending' : 'Not Required'),
        requiresDebrief ? 'Yes' : 'No',
        record.debrief_signed_by || '',
        record.debrief_date || '',
        record.debrief_trigger_reason || '',
        (record.notes || '').replace(/[\t\n\r]/g, ' '),
        record.trip_id || '',
        record.probe_verified ? 'Yes' : 'No',
      ].join('\t');
    });

    // Use tab-separated values for better Excel compatibility
    const tsvContent = '\uFEFF' + headers + '\n' + rows.join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `diesel_transactions_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
  };

  // Export debrief transactions to professional Excel or PDF
  const buildDebriefRecords = (type: 'pending' | 'completed' | 'all'): DebriefExcelRecord[] => {
    let recordsToExport: DieselConsumptionRecord[] = [];

    if (type === 'pending') {
      recordsToExport = recordsRequiringDebrief;
    } else if (type === 'completed') {
      recordsToExport = truckRecords.filter(r => r.debrief_signed);
    } else {
      recordsToExport = [...recordsRequiringDebrief, ...truckRecords.filter(r => r.debrief_signed)];
    }

    return recordsToExport.map(record => {
      const kmPerLitre = record.distance_travelled && record.litres_filled
        ? record.distance_travelled / record.litres_filled
        : undefined;
      const norm = getNormForFleet(record.fleet_number);
      const variance = kmPerLitre && norm
        ? ((kmPerLitre - norm.expected_km_per_litre) / norm.expected_km_per_litre * 100)
        : undefined;

      let debriefStatus: 'Pending' | 'Completed' | 'Within Norm' = 'Pending';
      if (record.debrief_signed) {
        debriefStatus = 'Completed';
      } else if (!norm || (kmPerLitre != null && kmPerLitre >= (norm?.min_acceptable ?? 0))) {
        debriefStatus = 'Within Norm';
      }

      return {
        date: record.date,
        fleet_number: record.fleet_number,
        driver_name: record.driver_name,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        total_cost: record.total_cost,
        currency: record.currency,
        distance_travelled: record.distance_travelled,
        km_per_litre: kmPerLitre,
        expected_km_per_litre: norm?.expected_km_per_litre,
        min_acceptable: norm?.min_acceptable,
        variance_pct: variance,
        debrief_status: debriefStatus,
        debrief_signed_by: record.debrief_signed_by,
        debrief_date: record.debrief_date,
        debrief_trigger_reason: record.debrief_trigger_reason,
        notes: record.notes,
      } satisfies DebriefExcelRecord;
    });
  };

  const exportDebriefTransactions = async (type: 'pending' | 'completed' | 'all') => {
    const records = buildDebriefRecords(type);
    await generateDebriefExcel(records, type);
  };

  const exportDebriefTransactionsPDF = (type: 'pending' | 'completed' | 'all') => {
    const records = buildDebriefRecords(type);
    generateDebriefPDF(records, type);
  };

  // Batch debrief handler
  const handleBatchDebrief = async (batchData: BatchDebriefData) => {
    try {
      // Update each record in the batch
      for (const recordId of batchData.recordIds) {
        const record = dieselRecords.find(r => r.id === recordId);
        if (record) {
          const updatedRecord = {
            ...record,
            debrief_notes: batchData.debrief_notes,
            debrief_signed: true,
            debrief_signed_by: batchData.debrief_signed_by,
            debrief_signed_at: batchData.debrief_signed_at,
            debrief_date: batchData.debrief_date,
          };
          await updateDieselRecord(updatedRecord);
        }
      }

      console.log(`Successfully debriefed ${batchData.recordIds.length} records`);
    } catch (error) {
      console.error('Batch debrief failed:', error);
      throw error;
    }
  };

  // Batch WhatsApp share handler
  const handleBatchWhatsappShare = async (recordIds: string[], phoneNumber?: string) => {
    try {
      // Get the selected records
      const selectedRecords = dieselRecords.filter(r => recordIds.includes(r.id));

      // Calculate totals
      const totalLitres = selectedRecords.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
      const totalCost = selectedRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
      const currency = selectedRecords[0]?.currency || 'ZAR';

      // Build the WhatsApp message
      const fleetDisplay = selectedFleetForBatch || 'All Fleets';
      const message = `*Diesel Batch Debrief Summary*\n\n` +
        `*Fleet:* ${fleetDisplay}\n` +
        `*Records:* ${selectedRecords.length} selected\n` +
        `*Total Litres:* ${totalLitres.toFixed(2)} L\n` +
        `*Total Cost:* ${currency} ${totalCost.toFixed(2)}\n\n` +
        `*Records to Debrief:*\n` +
        selectedRecords.map(r =>
          `- ${r.fleet_number || 'N/A'} | ${r.driver_name || 'N/A'} | ${r.litres_filled || 0} L | ${r.fuel_station || 'N/A'}`
        ).join('\n') + '\n\n' +
        `*Status:* Pending Debrief`;

      // Open WhatsApp with the message
      const encodedMessage = encodeURIComponent(message);
      const phone = phoneNumber ? phoneNumber.replace(/\D/g, '') : ''; // Remove non-digits
      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');

      console.log(`Shared ${recordIds.length} records via WhatsApp`);
    } catch (error) {
      console.error('Batch WhatsApp share failed:', error);
      throw error;
    }
  };

  // Handler functions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleManualSave = async (record: any) => {
    if (isReeferFleet(record.fleet_number)) {
      // Reefer fleet selected in truck form - redirect to reefer save
      const reeferRecord: ReeferDieselRecord = {
        id: record.id,
        reefer_unit: record.fleet_number,
        date: record.date,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        cost_per_litre: record.cost_per_litre ?? null,
        total_cost: record.total_cost,
        currency: record.currency || 'ZAR',
        operating_hours: null,
        previous_operating_hours: null,
        hours_operated: null,
        litres_per_hour: null,
        linked_diesel_record_id: null,
        driver_name: record.driver_name || '',
        notes: record.notes || '',
      };
      await handleReeferSave(reeferRecord);
      return;
    }
    if (record.id) {
      await updateDieselRecord(record as unknown as DieselConsumptionRecord);
    } else {
      await addDieselRecord(record as unknown as Omit<DieselConsumptionRecord, 'id' | 'created_at' | 'updated_at'>);
    }
  };

  // Reefer diesel save handler (createRecordAsync & updateRecordAsync from consolidated hook above)
  const handleReeferSave = async (record: ReeferDieselRecord) => {
    if (record.id) {
      // Check if this ID actually exists in reefer_diesel_records table
      // Records from diesel_records table have IDs that don't exist in reefer_diesel_records
      const existsInReeferTable = allReeferRecords.some(r => r.id === record.id);
      if (existsInReeferTable) {
        await updateRecordAsync(record);
      } else {
        // ID is from diesel_records table - migrate: create in reefer_diesel_records, then delete old
        const oldId = record.id;
        const { id: _oldId, ...newRecord } = record;
        await createRecordAsync(newRecord as ReeferDieselRecord);
        // Remove old record from diesel_records so it doesn't show as duplicate
        try {
          await deleteDieselRecord(oldId!);
        } catch {
          // Non-fatal: the reefer record was saved, old diesel record cleanup failed
          console.warn('Could not delete legacy diesel record', oldId);
        }
      }
    } else {
      await createRecordAsync(record);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  const handleImport = async (records: any[]) => {
    for (const record of records) {
      await addDieselRecord(record as unknown as Omit<DieselConsumptionRecord, 'id' | 'created_at' | 'updated_at'>);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLinkToTrip = async (record: any, tripId: string) => {
    await linkDieselToTrip(record as unknown as DieselConsumptionRecord, tripId);
  };

  const handleUnlinkFromTrip = async (recordId: string, tripId?: string) => {
    await unlinkDieselFromTrip(recordId, tripId);
  };

  // Reefer vehicle linkage handlers
  const openReeferVehicleLink = (record: DieselConsumptionRecord) => {
    const reeferRecord = allReeferRecords.find(r => r.id === record.id);
    if (reeferRecord) {
      setSelectedReeferForVehicle(reeferRecord);
      setIsReeferVehicleLinkOpen(true);
    }
  };

  const handleLinkReeferToVehicle = async (reeferRecordId: string, dieselRecordId: string, fleetNumber: string) => {
    await linkToVehicleAsync({ recordId: reeferRecordId, dieselRecordId, fleetNumber });
  };

  const handleUnlinkReeferFromVehicle = async (reeferRecordId: string) => {
    // If reefer has cost entries on a trip, clean them up
    const reeferRecord = allReeferRecords.find(r => r.id === reeferRecordId);
    if (reeferRecord?.cost_entry_ids && reeferRecord.cost_entry_ids.length > 0) {
      for (const costId of reeferRecord.cost_entry_ids) {
        await deleteCostEntry(costId);
      }
    }
    await unlinkFromVehicleAsync({ recordId: reeferRecordId });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleProbeVerification = async (verificationData: any) => {
    await updateDieselRecord(verificationData as unknown as DieselConsumptionRecord);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDebrief = async (debriefData: any) => {
    await updateDieselRecord(debriefData as unknown as DieselConsumptionRecord);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNormSave = async (norm: any) => {
    if (norm.id) {
      await updateDieselNorm(norm as unknown as DieselNorms);
    } else {
      await addDieselNorm(norm as unknown as DieselNorms);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (confirm('Are you sure you want to delete this diesel record?')) {
      await deleteDieselRecord(recordId);
    }
  };

  const handleDeleteReeferRecord = async (recordId: string) => {
    if (confirm('Are you sure you want to delete this reefer diesel record?')) {
      // Check if record exists in reefer_diesel_records table
      const existsInReeferTable = allReeferRecords.some(r => r.id === recordId);
      if (existsInReeferTable) {
        await deleteReeferRecordAsync(recordId);
      } else {
        // Legacy record in diesel_records table
        await deleteDieselRecord(recordId);
      }
    }
  };

  const handleDeleteNorm = async (normId: string) => {
    if (confirm('Are you sure you want to delete this fuel norm?')) {
      await deleteDieselNorm(normId);
    }
  };

  // Export fleet debrief summary PDF
  const handleExportFleetDebriefSummary = (fleetNumber: string, showPendingOnly: boolean = false) => {
    const fleetRecords = truckRecords.filter(r => r.fleet_number === fleetNumber);
    const recordsWithDebriefStatus = fleetRecords.map(record => {
      const kmPerLitre = calculateKmPerLitre(record);
      const norm = getNormForFleet(record.fleet_number);
      const requiresDebrief = kmPerLitre !== null && norm && kmPerLitre < norm.min_acceptable;

      return {
        id: record.id,
        fleet_number: record.fleet_number,
        date: record.date,
        driver_name: record.driver_name,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        total_cost: record.total_cost,
        currency: record.currency,
        km_per_litre: kmPerLitre ?? undefined,
        debrief_signed: record.debrief_signed,
        debrief_signed_by: record.debrief_signed_by,
        debrief_signed_at: record.debrief_signed_at,
        debrief_notes: record.debrief_notes,
        requires_debrief: requiresDebrief,
        debrief_trigger_reason: record.debrief_trigger_reason,
      };
    });

    generateFleetDebriefSummaryPDF({
      fleetNumber,
      records: recordsWithDebriefStatus,
      showPendingOnly,
    });
  };

  // Export all debrief transactions as PDF
  const handleExportAllDebriefsPDF = () => {
    const recordsWithDebriefStatus = truckRecords.map(record => {
      const kmPerLitre = calculateKmPerLitre(record);
      const norm = getNormForFleet(record.fleet_number);
      const requiresDebrief = kmPerLitre !== null && norm && kmPerLitre < norm.min_acceptable;

      return {
        id: record.id,
        fleet_number: record.fleet_number,
        date: record.date,
        driver_name: record.driver_name,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        total_cost: record.total_cost,
        currency: record.currency,
        km_per_litre: kmPerLitre ?? undefined,
        debrief_signed: record.debrief_signed,
        debrief_signed_by: record.debrief_signed_by,
        debrief_signed_at: record.debrief_signed_at,
        debrief_notes: record.debrief_notes,
        requires_debrief: requiresDebrief,
        debrief_trigger_reason: record.debrief_trigger_reason,
      };
    });

    // Filter to only include records that need debrief or have been debriefed
    const debriefRecords = recordsWithDebriefStatus.filter(r => r.requires_debrief || r.debrief_signed);
    generateSelectedTransactionsPDF(debriefRecords, 'ALL FLEETS DEBRIEF SUMMARY');
  };

  const openEditRecord = (record: DieselConsumptionRecord) => {
    if (isReeferFleet(record.fleet_number)) {
      // Reefer fleet - open reefer modal with L/hr fields
      // Map diesel_records data to ReeferDieselRecord format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = record as any;
      // For legacy records (diesel_records), km_reading was actually operating hours
      const opHours = rec.operating_hours ?? record.km_reading ?? null;
      const prevHours = rec.previous_operating_hours ?? record.previous_km_reading ?? null;
      const hoursOp = rec.hours_operated ?? (
        (opHours != null && prevHours != null && opHours > prevHours)
          ? opHours - prevHours : (record.distance_travelled ?? null)
      );
      const lph = rec.litres_per_hour ?? (
        (hoursOp && hoursOp > 0 && record.litres_filled > 0)
          ? record.litres_filled / hoursOp : null
      );
      setSelectedReeferEditRecord({
        id: record.id,
        reefer_unit: record.fleet_number,
        date: record.date,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        cost_per_litre: record.cost_per_litre ?? null,
        total_cost: record.total_cost,
        currency: record.currency || 'ZAR',
        operating_hours: opHours,
        previous_operating_hours: prevHours,
        hours_operated: hoursOp,
        litres_per_hour: lph,
        linked_diesel_record_id: null,
        driver_name: record.driver_name || '',
        notes: record.notes || '',
      });
      setIsReeferEntryOpen(true);
    } else {
      setSelectedRecord(record);
      setIsManualEntryOpen(true);
    }
  };

  const openTripLinkage = (record: DieselConsumptionRecord) => {
    setSelectedRecord(record);
    setIsTripLinkageOpen(true);
  };

  const openProbeVerification = (record: DieselConsumptionRecord) => {
    setSelectedRecord(record);
    setIsProbeVerificationOpen(true);
  };

  const openDebrief = (record: DieselConsumptionRecord) => {
    setSelectedRecord(record);
    setIsDebriefOpen(true);
  };

  const openEditNorm = (norm: DieselNorms) => {
    setSelectedNorm(norm);
    setIsNormsModalOpen(true);
  };

  const openViewModal = (record: DieselConsumptionRecord) => {
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  const openReeferLinkage = (record: DieselConsumptionRecord) => {
    setSelectedRecord(record);
    setIsReeferLinkageOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {/* Import Data button hidden
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Import Data
            </Button>
            */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={exportAllTransactionsToExcel}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="debrief">Debrief</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="norms">Norms</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            {/* Action Buttons */}
            <div className="flex gap-2 mb-6">
              <Button
                className="gap-2"
                onClick={() => {
                  setSelectedRecord(null);
                  setIsManualEntryOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Truck Record
              </Button>
              <Button
                className="gap-2 bg-cyan-600 hover:bg-cyan-700"
                onClick={() => {
                  setSelectedReeferEditRecord(null);
                  setIsReeferEntryOpen(true);
                }}
              >
                <Snowflake className="h-4 w-4" />
                Add Reefer Entry
              </Button>
              {/* Import CSV button hidden
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsImportModalOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              */}
            </div>

            {/* Pending Cost Alert Banner */}
            {pendingCostRecords.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-700 dark:text-amber-300">
                      {pendingCostRecords.length} diesel record{pendingCostRecords.length !== 1 ? 's' : ''} pending cost
                    </h3>
                    <p className="text-sm text-amber-600 dark:text-amber-400/80 mt-1">
                      These records were submitted by drivers at stations without a configured price per litre. Click &quot;Edit Record&quot; on each transaction to add the cost.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {pendingCostRecords.slice(0, 5).map(r => (
                        <Badge
                          key={r.id}
                          variant="outline"
                          className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-900/30"
                          onClick={() => openEditRecord(r)}
                        >
                          {r.fleet_number} — {formatDate(r.date)} — {formatNumber(r.litres_filled)} L
                        </Badge>
                      ))}
                      {pendingCostRecords.length > 5 && (
                        <Badge variant="outline" className="border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
                          +{pendingCostRecords.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TRUCKS section */}
            <h2 className="text-2xl font-bold mt-2 mb-4">TRUCKS</h2>
            {sortedFleets.length > 0 ? (
              <div className="space-y-6">
                {sortedFleets.map((fleet) => {
                  const fleetTotals = getFleetTotals(truckRecordsGroupedByFleetAndWeek, fleet);
                  const isFleetExpanded = expandedFleets.has(fleet);
                  const fleetWeeks = Object.keys(truckRecordsGroupedByFleetAndWeek[fleet])
                    .map(w => parseInt(w))
                    .sort((a, b) => b - a); // Most recent weeks first

                  return (
                    <Card key={fleet} className="overflow-hidden">
                      {/* Fleet Header */}
                      <Collapsible open={isFleetExpanded} onOpenChange={() => toggleFleetExpanded(fleet)}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isFleetExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div>
                                  <CardTitle className="text-xl">{fleet}</CardTitle>
                                  <CardDescription>
                                    {fleetTotals.count} transactions across {fleetWeeks.length} week(s)
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-right">
                                  <p className="text-muted-foreground">Total Litres</p>
                                  <p className="font-semibold">{formatNumber(fleetTotals.totalLitres)} L</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-muted-foreground">Total Cost</p>
                                  <p className="font-semibold">
                                    {fleetTotals.totalCostZAR > 0 && formatCurrency(fleetTotals.totalCostZAR, 'ZAR')}
                                    {fleetTotals.totalCostZAR > 0 && fleetTotals.totalCostUSD > 0 && ' / '}
                                    {fleetTotals.totalCostUSD > 0 && formatCurrency(fleetTotals.totalCostUSD, 'USD')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-muted-foreground">Avg km/L</p>
                                  <p className="font-semibold">{formatNumber(fleetTotals.avgKmL, 2)}</p>
                                </div>
                                {fleetTotals.pendingDebrief > 0 && (
                                  <Badge variant="destructive" className="ml-2">
                                    {fleetTotals.pendingDebrief} Debrief
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            {/* Week sections within fleet */}
                            <div className="space-y-3">
                              {fleetWeeks.map((week) => {
                                const weekKey = `${fleet}-${week}`;
                                const isWeekExpanded = expandedWeeks.has(weekKey);
                                const weekRecords = truckRecordsGroupedByFleetAndWeek[fleet][week];
                                const weekTotals = getWeekTotals(weekRecords);

                                return (
                                  <Collapsible key={weekKey} open={isWeekExpanded} onOpenChange={() => toggleWeekExpanded(weekKey)}>
                                    <div className="border rounded-lg">
                                      <CollapsibleTrigger asChild>
                                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            {isWeekExpanded ? (
                                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className="font-medium">
                                              Week {week}{week === currentWeek ? ' (Current)' : ''}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                              ({getWeekDateRange(week)})
                                            </span>
                                            <Badge variant="secondary" className="ml-2">
                                              {weekRecords.length} transaction{weekRecords.length !== 1 ? 's' : ''}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-4 text-sm">
                                            <span>{formatNumber(weekTotals.totalLitres)} L</span>
                                            <span>
                                              {weekTotals.totalCostZAR > 0 && formatCurrency(weekTotals.totalCostZAR, 'ZAR')}
                                              {weekTotals.totalCostZAR > 0 && weekTotals.totalCostUSD > 0 && ' / '}
                                              {weekTotals.totalCostUSD > 0 && formatCurrency(weekTotals.totalCostUSD, 'USD')}
                                            </span>
                                            <span className="font-medium">{formatNumber(weekTotals.avgKmL, 2)} km/L</span>
                                            {weekTotals.pendingDebrief > 0 && (
                                              <Badge variant="destructive" className="text-xs">
                                                {weekTotals.pendingDebrief} Debrief
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>

                                      <CollapsibleContent>
                                        <div className="border-t bg-background">
                                          {/* Professional Transaction table */}
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                              <thead className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                                                <tr>
                                                  <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                                                  <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Driver</th>
                                                  <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Station</th>
                                                  <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Litres</th>
                                                  <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Cost</th>
                                                  <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">KM Reading</th>
                                                  <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">km/L</th>
                                                  <th className="text-center px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                                                  <th className="text-center px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {weekRecords.map((record, idx) => {
                                                  const kmPerLitre = calculateKmPerLitre(record);
                                                  const norm = getNormForFleet(record.fleet_number);
                                                  const outsideNorm = kmPerLitre && norm ? isOutsideNorm(kmPerLitre, norm) : false;
                                                  const hasLinkedReefer = allReeferRecords.some(r => r.linked_diesel_record_id === record.id);
                                                  const hasPendingCost = !record.cost_per_litre || record.cost_per_litre === 0;

                                                  return (
                                                    <tr
                                                      key={record.id}
                                                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
                                                    >
                                                      <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="font-medium">{formatDate(record.date)}</span>
                                                      </td>
                                                      <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                          <User className="h-4 w-4 text-muted-foreground" />
                                                          <span>{record.driver_name || <span className="text-muted-foreground italic">No driver</span>}</span>
                                                        </div>
                                                      </td>
                                                      <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                          <Fuel className="h-4 w-4 text-muted-foreground" />
                                                          <span>{record.fuel_station || <span className="text-muted-foreground italic">Unknown</span>}</span>
                                                        </div>
                                                      </td>
                                                      <td className="px-4 py-3 text-right font-mono">
                                                        <span className="font-semibold">{formatNumber(record.litres_filled)}</span>
                                                        <span className="text-muted-foreground ml-1">L</span>
                                                      </td>
                                                      <td className="px-4 py-3 text-right font-mono">
                                                        {hasPendingCost ? (
                                                          <span
                                                            className="text-amber-600 dark:text-amber-400 font-semibold cursor-pointer hover:underline"
                                                            onClick={() => openEditRecord(record)}
                                                            title="Click to add cost"
                                                          >
                                                            Pending
                                                          </span>
                                                        ) : (
                                                          <span className="font-semibold">
                                                            {formatCurrency(record.total_cost, (record.currency || 'ZAR') as 'ZAR' | 'USD')}
                                                          </span>
                                                        )}
                                                      </td>
                                                      <td className="px-4 py-3 text-right font-mono">
                                                        <div>
                                                          <span className="font-semibold">{formatNumber(record.km_reading)}</span>
                                                          {record.previous_km_reading && (
                                                            <span className="text-xs text-muted-foreground block">
                                                              +{formatNumber(record.km_reading - record.previous_km_reading)} km
                                                            </span>
                                                          )}
                                                        </div>
                                                      </td>
                                                      <td className={`px-4 py-3 text-right font-mono ${outsideNorm ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        {kmPerLitre ? (
                                                          <span>{formatNumber(kmPerLitre, 2)}</span>
                                                        ) : (
                                                          <span className="text-muted-foreground">—</span>
                                                        )}
                                                      </td>
                                                      <td className="px-4 py-3">
                                                        <div className="flex flex-wrap items-center justify-center gap-1">
                                                          {hasPendingCost && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                                              <DollarSign className="h-3 w-3 mr-1" />
                                                              Pending Cost
                                                            </Badge>
                                                          )}
                                                          {outsideNorm && !record.debrief_signed && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300">
                                                              <AlertCircle className="h-3 w-3 mr-1" />
                                                              Debrief
                                                            </Badge>
                                                          )}
                                                          {record.debrief_signed && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300">
                                                              <CheckCircle className="h-3 w-3 mr-1" />
                                                              Debriefed
                                                            </Badge>
                                                          )}
                                                          {record.probe_verified && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-sky-50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300">
                                                              <CheckCircle className="h-3 w-3 mr-1" />
                                                              Probe OK
                                                            </Badge>
                                                          )}
                                                          {!record.probe_verified && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300">
                                                              Probe Pending
                                                            </Badge>
                                                          )}
                                                          {hasLinkedReefer && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-teal-50 dark:bg-teal-950/20 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300">
                                                              <Snowflake className="h-3 w-3 mr-1" />
                                                              Reefer
                                                            </Badge>
                                                          )}
                                                          {record.trip_id && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap bg-violet-50 dark:bg-violet-950/20 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                                                              <Link className="h-3 w-3 mr-1" />
                                                              Trip Linked
                                                            </Badge>
                                                          )}
                                                          {record.linked_trailers && record.linked_trailers.length > 0 && (
                                                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                                                              <Truck className="h-3 w-3 mr-1" />
                                                              +{record.linked_trailers.length} Trailer
                                                            </Badge>
                                                          )}
                                                        </div>
                                                      </td>
                                                      <td className="px-4 py-3 text-center">
                                                        <DropdownMenu>
                                                          <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="sm" className="h-8 px-2">
                                                              <Settings className="h-4 w-4 mr-1" />
                                                              <ChevronDown className="h-3 w-3" />
                                                            </Button>
                                                          </DropdownMenuTrigger>
                                                          <DropdownMenuContent align="end" className="w-48">
                                                            {hasPendingCost && (
                                                              <DropdownMenuItem onClick={() => openEditRecord(record)} className="text-amber-600">
                                                                <DollarSign className="h-4 w-4 mr-2" />
                                                                Add Cost
                                                              </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => openViewModal(record)}>
                                                              <Eye className="h-4 w-4 mr-2" />
                                                              View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openEditRecord(record)}>
                                                              <Edit className="h-4 w-4 mr-2" />
                                                              Edit Record
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openTripLinkage(record)}>
                                                              <Link className="h-4 w-4 mr-2" />
                                                              {record.trip_id ? 'Change Trip' : 'Link to Trip'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openReeferLinkage(record)}>
                                                              <Snowflake className="h-4 w-4 mr-2" />
                                                              {hasLinkedReefer ? 'Manage Reefer' : 'Link Reefer'}
                                                            </DropdownMenuItem>
                                                            {!record.probe_verified && (
                                                              <DropdownMenuItem onClick={() => openProbeVerification(record)}>
                                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                                Verify Probe
                                                              </DropdownMenuItem>
                                                            )}
                                                            {(outsideNorm || record.requires_debrief) && !record.debrief_signed && (
                                                              <DropdownMenuItem onClick={() => openDebrief(record)} className="text-destructive">
                                                                <FileText className="h-4 w-4 mr-2" />
                                                                Debrief Required
                                                              </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                              onClick={() => handleDeleteRecord(record.id)}
                                                              className="text-destructive"
                                                            >
                                                              <Trash2 className="h-4 w-4 mr-2" />
                                                              Delete Record
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
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Diesel Records</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by adding diesel records manually or import from a CSV file.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {sortedReeferFleets.length > 0 && (
              <>
                <h2 className="text-2xl font-bold mt-6 mb-4">REEFERS</h2>
                <div className="space-y-6">
                  {sortedReeferFleets.map((fleet) => {
                    const fleetTotals = getFleetTotals(reeferRecordsGroupedByFleetAndWeek, fleet);
                    const isFleetExpanded = expandedFleets.has(`reefer-${fleet}`);
                    const fleetWeeks = Object.keys(reeferRecordsGroupedByFleetAndWeek[fleet])
                      .map(w => parseInt(w))
                      .sort((a, b) => b - a);

                    return (
                      <Card key={`reefer-${fleet}`} className="overflow-hidden">
                        <Collapsible open={isFleetExpanded} onOpenChange={() => toggleFleetExpanded(`reefer-${fleet}`)}>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {isFleetExpanded ? (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                  )}
                                  <div>
                                    <CardTitle className="text-xl">{fleet}</CardTitle>
                                    <CardDescription>
                                      {fleetTotals.count} transactions across {fleetWeeks.length} week(s)
                                    </CardDescription>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                  <div className="text-right">
                                    <p className="text-muted-foreground">Total Litres</p>
                                    <p className="font-semibold">{formatNumber(fleetTotals.totalLitres)} L</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-muted-foreground">Total Cost</p>
                                    <p className="font-semibold">
                                      {fleetTotals.totalCostZAR > 0 && formatCurrency(fleetTotals.totalCostZAR, 'ZAR')}
                                      {fleetTotals.totalCostZAR > 0 && fleetTotals.totalCostUSD > 0 && ' / '}
                                      {fleetTotals.totalCostUSD > 0 && formatCurrency(fleetTotals.totalCostUSD, 'USD')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <div className="space-y-3">
                                {fleetWeeks.map((week) => {
                                  const weekKey = `reefer-${fleet}-${week}`;
                                  const isWeekExpanded = expandedWeeks.has(weekKey);
                                  const weekRecords = reeferRecordsGroupedByFleetAndWeek[fleet][week];
                                  const weekTotals = getWeekTotals(weekRecords, true);

                                  return (
                                    <Collapsible key={weekKey} open={isWeekExpanded} onOpenChange={() => toggleWeekExpanded(weekKey)}>
                                      <div className="border rounded-lg">
                                        <CollapsibleTrigger asChild>
                                          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-2">
                                              {isWeekExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                              )}
                                              <span className="font-medium">
                                                Week {week}{week === currentWeek ? ' (Current)' : ''}
                                              </span>
                                              <span className="text-sm text-muted-foreground">
                                                ({getWeekDateRange(week)})
                                              </span>
                                              <Badge variant="secondary" className="ml-2">
                                                {weekRecords.length} transaction{weekRecords.length !== 1 ? 's' : ''}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                              <span>{formatNumber(weekTotals.totalLitres)} L</span>
                                              <span>
                                                {weekTotals.totalCostZAR > 0 && formatCurrency(weekTotals.totalCostZAR, 'ZAR')}
                                                {weekTotals.totalCostZAR > 0 && weekTotals.totalCostUSD > 0 && ' / '}
                                                {weekTotals.totalCostUSD > 0 && formatCurrency(weekTotals.totalCostUSD, 'USD')}
                                              </span>
                                            </div>
                                          </div>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                          <div className="border-t bg-background">
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-sm">
                                                <thead className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                                                  <tr>
                                                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Driver</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Station</th>
                                                    <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Litres</th>
                                                    <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Cost</th>
                                                    <th className="text-right px-4 py-3 font-semibold text-cyan-600 dark:text-cyan-400">L/hr</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Linked Vehicle</th>
                                                    <th className="text-center px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                  {weekRecords.map((record, idx) => {
                                                    // Look up L/hr: prefer per-record value, fall back to fleet average
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const recordLph = (record as any).litres_per_hour as number | null;
                                                    const fleetLhr = reeferLhrMap.get(record.fleet_number);
                                                    const reeferPendingCost = !record.cost_per_litre || record.cost_per_litre === 0;
                                                    return (
                                                      <tr
                                                        key={record.id}
                                                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
                                                      >
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                          <span className="font-medium">{formatDate(record.date)}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                          <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <span>{record.driver_name || <span className="text-muted-foreground italic">No driver</span>}</span>
                                                          </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                          <div className="flex items-center gap-2">
                                                            <Fuel className="h-4 w-4 text-muted-foreground" />
                                                            <span>{record.fuel_station || <span className="text-muted-foreground italic">Unknown</span>}</span>
                                                          </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono">
                                                          <span className="font-semibold">{formatNumber(record.litres_filled)}</span>
                                                          <span className="text-muted-foreground ml-1">L</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono">
                                                          {reeferPendingCost ? (
                                                            <span
                                                              className="text-amber-600 dark:text-amber-400 font-semibold cursor-pointer hover:underline"
                                                              onClick={() => openEditRecord(record)}
                                                              title="Click to add cost"
                                                            >
                                                              Pending
                                                            </span>
                                                          ) : (
                                                            <span className="font-semibold">
                                                              {formatCurrency(record.total_cost, (record.currency || 'ZAR') as 'ZAR' | 'USD')}
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono">
                                                          {(recordLph ?? fleetLhr?.avgLitresPerHour) ? (
                                                            <span className="font-semibold text-cyan-600">{(recordLph ?? fleetLhr?.avgLitresPerHour ?? 0).toFixed(2)}</span>
                                                          ) : (
                                                            <span className="text-muted-foreground italic text-xs">-</span>
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                          {(() => {
                                                            const reeferRec = allReeferRecords.find(r => r.id === record.id);
                                                            if (reeferRec?.linked_horse) {
                                                              return (
                                                                <div className="flex items-center gap-1.5">
                                                                  <Truck className="h-3.5 w-3.5 text-emerald-600" />
                                                                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{reeferRec.linked_horse}</span>
                                                                </div>
                                                              );
                                                            }
                                                            return <span className="text-xs text-muted-foreground italic">Not linked</span>;
                                                          })()}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                          <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                              <Button variant="outline" size="sm" className="h-8 px-2">
                                                                <Settings className="h-4 w-4 mr-1" />
                                                                <ChevronDown className="h-3 w-3" />
                                                              </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                              {reeferPendingCost && (
                                                                <DropdownMenuItem onClick={() => openEditRecord(record)} className="text-amber-600">
                                                                  <DollarSign className="h-4 w-4 mr-2" />
                                                                  Add Cost
                                                                </DropdownMenuItem>
                                                              )}
                                                              <DropdownMenuItem onClick={() => openViewModal(record)}>
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View Details
                                                              </DropdownMenuItem>
                                                              <DropdownMenuItem onClick={() => openEditRecord(record)}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit Record
                                                              </DropdownMenuItem>
                                                              <DropdownMenuItem onClick={() => openReeferVehicleLink(record)}>
                                                                <Truck className="h-4 w-4 mr-2" />
                                                                {allReeferRecords.find(r => r.id === record.id)?.linked_diesel_record_id ? 'Change Vehicle' : 'Link to Vehicle'}
                                                              </DropdownMenuItem>
                                                              <DropdownMenuItem
                                                                onClick={() => handleDeleteReeferRecord(record.id)}
                                                                className="text-destructive"
                                                              >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete Record
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
                                        </CollapsibleContent>
                                      </div>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

          </TabsContent>

          <TabsContent value="debrief">
            <div className="space-y-6">
              {/* Fleet Debrief Summary Export Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Fleet Debrief Summary</CardTitle>
                      <CardDescription>
                        Export PDF summary of debrief status per fleet or across all fleets
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <select
                          title="Filter by fleet number"
                          value={debriefFleetFilter}
                          onChange={(e) => setDebriefFleetFilter(e.target.value)}
                          className="px-3 py-1.5 border rounded-md bg-background text-sm min-w-[150px]"
                        >
                          <option value="">Select Fleet...</option>
                          {uniqueFleetNumbers.map((fleet) => (
                            <option key={fleet} value={fleet}>{fleet}</option>
                          ))}
                        </select>
                      </div>
                      {debriefFleetFilter && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportFleetDebriefSummary(debriefFleetFilter, false)}
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            Full Summary PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportFleetDebriefSummary(debriefFleetFilter, true)}
                            className="gap-2"
                          >
                            <AlertCircle className="h-4 w-4" />
                            Pending Only PDF
                          </Button>
                        </>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleExportAllDebriefsPDF}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        All Fleets PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Pending Debriefs */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Pending Debriefs</CardTitle>
                      <CardDescription>
                        Grouped by fleet — records with fuel efficiency outside acceptable norms
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {recordsRequiringDebrief.length > 0 && (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export Pending
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => exportDebriefTransactions('pending')}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Excel (.xlsx)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportDebriefTransactionsPDF('pending')}>
                                <FileText className="h-4 w-4 mr-2" />
                                PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export All
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => exportDebriefTransactions('all')}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Excel (.xlsx)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportDebriefTransactionsPDF('all')}>
                                <FileText className="h-4 w-4 mr-2" />
                                PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              // Get unique fleets with pending records
                              const fleets = [...new Set(recordsRequiringDebrief.map(r => r.fleet_number))];
                              if (fleets.length === 1) {
                                setSelectedFleetForBatch(fleets[0]);
                                setIsBatchDebriefOpen(true);
                              } else {
                                // Open with all fleets
                                setSelectedFleetForBatch('');
                                setIsBatchDebriefOpen(true);
                              }
                            }}
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Batch Debrief All
                          </Button>
                        </>
                      )}
                      {/* Show Export All button when there are no pending but there are completed */}
                      {recordsRequiringDebrief.length === 0 && truckRecords.filter(r => r.debrief_signed).length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Download className="h-4 w-4" />
                              Export All
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => exportDebriefTransactions('all')}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportDebriefTransactionsPDF('all')}>
                              <FileText className="h-4 w-4 mr-2" />
                              PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {recordsRequiringDebrief.length > 0 ? (
                    <div className="space-y-2">
                      {(() => {
                        const fleetMap: Record<string, typeof recordsRequiringDebrief> = {};
                        for (const r of recordsRequiringDebrief) {
                          const fleet = r.fleet_number || 'Unknown';
                          if (!fleetMap[fleet]) fleetMap[fleet] = [];
                          fleetMap[fleet].push(r);
                        }
                        return Object.entries(fleetMap)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([fleet, records]) => {
                            const isOpen = expandedPendingFleets.has(fleet);
                            const sentCount = records.filter(r => whatsappSharedSet.has(r.id)).length;
                            const allSent = sentCount === records.length;
                            const someSent = sentCount > 0 && !allSent;
                            return (
                              <div key={fleet} className="border rounded-lg overflow-hidden">
                                {/* Fleet header row */}
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                                  onClick={() =>
                                    setExpandedPendingFleets(prev => {
                                      const next = new Set(prev);
                                      if (next.has(fleet)) {
                                        next.delete(fleet);
                                      } else {
                                        next.add(fleet);
                                      }
                                      return next;
                                    })
                                  }
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-semibold text-sm">{fleet}</span>
                                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                      {records.length} pending
                                    </Badge>
                                    {allSent && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                        <CheckCircle className="h-3 w-3" />
                                        All WA Sent
                                      </span>
                                    )}
                                    {someSent && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                                        {sentCount}/{records.length} WA Sent
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFleetForBatch(fleet);
                                        setIsBatchDebriefOpen(true);
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Batch
                                    </Button>
                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                                  </div>
                                </button>

                                {/* Expanded rows */}
                                {isOpen && (
                                  <div className="border-t divide-y">
                                    {records.map(record => {
                                      const kmPerLitre = calculateKmPerLitre(record);
                                      const norm = getNormForFleet(record.fleet_number);
                                      const waSent = whatsappSharedSet.has(record.id);
                                      return (
                                        <div key={record.id} className="px-3 py-2 flex items-center gap-2 bg-muted/10 hover:bg-muted/25 transition-colors">
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 flex-1 text-xs">
                                            <div>
                                              <span className="text-muted-foreground">Date </span>
                                              <span className="font-medium">{formatDate(record.date)}</span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Driver </span>
                                              <span className="font-medium">{record.driver_name || 'N/A'}</span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Actual </span>
                                              <span className="font-medium text-destructive">
                                                {kmPerLitre ? `${formatNumber(kmPerLitre, 2)} km/L` : 'N/A'}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Norm </span>
                                              <span className="font-medium">
                                                {norm ? `${formatNumber(norm.expected_km_per_litre, 2)} km/L` : '—'}
                                              </span>
                                            </div>
                                          </div>
                                          {/* WhatsApp status badge */}
                                          {waSent ? (
                                            <span
                                              title="Debriefed via WhatsApp"
                                              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full"
                                            >
                                              <CheckCircle className="h-3 w-3" />
                                              WA Sent
                                            </span>
                                          ) : (
                                            <span
                                              title="WhatsApp debrief not yet sent"
                                              className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                                            >
                                              <MessageCircle className="h-3 w-3" />
                                              WA Pending
                                            </span>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="shrink-0 text-xs h-7 px-2"
                                            onClick={() => openDebrief(record)}
                                          >
                                            <FileText className="h-3.5 w-3.5 mr-1" />
                                            Debrief
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Pending Debriefs</h3>
                      <p className="text-muted-foreground">
                        All records are within acceptable fuel efficiency norms
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
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
                                    <span>{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</span>
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
                                              {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                              {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                        <td className="p-3 text-right">{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</td>
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
                                    {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                    {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                <div>{formatCurrency(fleetReports.reduce((s, r) => s + r.totalCostZAR, 0), 'ZAR')}</div>
                                {fleetReports.reduce((s, r) => s + r.totalCostUSD, 0) > 0 && (
                                  <div className="text-xs text-muted-foreground">{formatCurrency(fleetReports.reduce((s, r) => s + r.totalCostUSD, 0), 'USD')}</div>
                                )}
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
                                    <span>{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</span>
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
                                            {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                            {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                        <td className="p-3 text-right">{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</td>
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
                                  {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                  {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                <div>{formatCurrency(driverReports.reduce((s, r) => s + r.totalCostZAR, 0), 'ZAR')}</div>
                                {driverReports.reduce((s, r) => s + r.totalCostUSD, 0) > 0 && (
                                  <div className="text-xs text-muted-foreground">{formatCurrency(driverReports.reduce((s, r) => s + r.totalCostUSD, 0), 'USD')}</div>
                                )}
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
                                    <span>{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</span>
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
                                            {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                            {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                        <td className="p-3 text-right">{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</td>
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
                                  {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                  {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                <div>{formatCurrency(stationReports.reduce((s, r) => s + r.totalCostZAR, 0), 'ZAR')}</div>
                                {stationReports.reduce((s, r) => s + r.totalCostUSD, 0) > 0 && (
                                  <div className="text-xs text-muted-foreground">{formatCurrency(stationReports.reduce((s, r) => s + r.totalCostUSD, 0), 'USD')}</div>
                                )}
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
                                      <span>{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</span>
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
                                              {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                              {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                          <td className="p-3 text-right">{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</td>
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
                                    {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                    {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                  <div>{formatCurrency(reeferFleetReports.reduce((s, r) => s + r.totalCostZAR, 0), 'ZAR')}</div>
                                  {reeferFleetReports.reduce((s, r) => s + r.totalCostUSD, 0) > 0 && (
                                    <div className="text-xs text-muted-foreground">{formatCurrency(reeferFleetReports.reduce((s, r) => s + r.totalCostUSD, 0), 'USD')}</div>
                                  )}
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
                                      <span>{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</span>
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
                                              {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                              {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                          <td className="p-3 text-right">{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</td>
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
                                    {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                    {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                  <div>{formatCurrency(reeferDriverReports.reduce((s, r) => s + r.totalCostZAR, 0), 'ZAR')}</div>
                                  {reeferDriverReports.reduce((s, r) => s + r.totalCostUSD, 0) > 0 && (
                                    <div className="text-xs text-muted-foreground">{formatCurrency(reeferDriverReports.reduce((s, r) => s + r.totalCostUSD, 0), 'USD')}</div>
                                  )}
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
                                      <span>{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</span>
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
                                              {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                              {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                          <td className="p-3 text-right">{formatCurrency(week.totals.totalCostZAR, 'ZAR')}</td>
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
                                    {report.totalCostZAR > 0 && <div>{formatCurrency(report.totalCostZAR, 'ZAR')}</div>}
                                    {report.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(report.totalCostUSD, 'USD')}</div>}
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
                                  <div>{formatCurrency(reeferStationReports.reduce((s, r) => s + r.totalCostZAR, 0), 'ZAR')}</div>
                                  {reeferStationReports.reduce((s, r) => s + r.totalCostUSD, 0) > 0 && (
                                    <div className="text-xs text-muted-foreground">{formatCurrency(reeferStationReports.reduce((s, r) => s + r.totalCostUSD, 0), 'USD')}</div>
                                  )}
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
                                        {weekReport.grandTotal.totalCostZAR > 0 && ` | ${formatCurrency(weekReport.grandTotal.totalCostZAR, 'ZAR')}`}
                                        {weekReport.grandTotal.totalCostUSD > 0 && ` | ${formatCurrency(weekReport.grandTotal.totalCostUSD, 'USD')}`}
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
                                                  {(fleetData.totalCostZAR > 0 || fleetData.totalCostUSD > 0) ? (
                                                    <div>
                                                      {fleetData.totalCostZAR > 0 && <div>{formatCurrency(fleetData.totalCostZAR, 'ZAR')}</div>}
                                                      {fleetData.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(fleetData.totalCostUSD, 'USD')}</div>}
                                                    </div>
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
                                                {section.sectionTotal.totalCostZAR > 0 && <div>{formatCurrency(section.sectionTotal.totalCostZAR, 'ZAR')}</div>}
                                                {section.sectionTotal.totalCostUSD > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(section.sectionTotal.totalCostUSD, 'USD')}</div>}
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
          </TabsContent>

          <TabsContent value="norms">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Fuel Efficiency Norms</CardTitle>
                  <CardDescription>
                    Configure expected fuel consumption standards
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setSelectedNorm(null);
                    setIsNormsModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Norm
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dieselNorms.length > 0 ? (
                    dieselNorms.map((norm) => (
                      <div key={norm.id} className="border rounded-lg p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Fleet</p>
                            <p className="font-medium">{norm.fleet_number}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Expected</p>
                            <p className="font-medium">{formatNumber(norm.expected_km_per_litre, 2)} km/L</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Min</p>
                            <p className="font-medium">{formatNumber(norm.min_acceptable, 2)} km/L</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Max</p>
                            <p className="font-medium">{formatNumber(norm.max_acceptable, 2)} km/L</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditNorm(norm)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteNorm(norm.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Fuel Norms Configured</h3>
                      <p className="text-muted-foreground mb-4">
                        Set fuel efficiency standards for your fleet
                      </p>
                      <Button
                        onClick={() => {
                          setSelectedNorm(null);
                          setIsNormsModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Norm
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import Diesel Data</CardTitle>
                <CardDescription>
                  Bulk import diesel records from CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Import CSV File</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload a CSV file with your diesel consumption data
                  </p>
                  <Button onClick={() => setIsImportModalOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Select File
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <ManualDieselEntryModal
        isOpen={isManualEntryOpen}
        onClose={() => {
          setIsManualEntryOpen(false);
          setSelectedRecord(null);
        }}
        onSave={handleManualSave}
        editRecord={selectedRecord as unknown as any}
      />

      <ReeferDieselEntryModal
        isOpen={isReeferEntryOpen}
        onClose={() => {
          setIsReeferEntryOpen(false);
          setSelectedReeferEditRecord(null);
        }}
        onSave={handleReeferSave}
        editRecord={selectedReeferEditRecord}
      />

      {/* DieselImportModal hidden
      <DieselImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />
      */}

      <TripLinkageModal
        isOpen={isTripLinkageOpen}
        onClose={() => {
          setIsTripLinkageOpen(false);
          setSelectedRecord(null);
        }}
        dieselRecord={selectedRecord as unknown as any}
        trips={trips}
        onLinkToTrip={handleLinkToTrip}
        onUnlinkFromTrip={handleUnlinkFromTrip}
        previousRefillDate={
          selectedRecord
            ? dieselRecords
              .filter(r => r.fleet_number === selectedRecord.fleet_number && r.date < selectedRecord.date && r.id !== selectedRecord.id)
              .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null
            : null
        }
        vehicleId={
          selectedRecord
            ? vehicles.find(v => v.fleet_number === selectedRecord.fleet_number)?.id ?? null
            : null
        }
      />

      <ReeferVehicleLinkModal
        isOpen={isReeferVehicleLinkOpen}
        onClose={() => {
          setIsReeferVehicleLinkOpen(false);
          setSelectedReeferForVehicle(null);
        }}
        reeferRecord={selectedReeferForVehicle}
        dieselRecords={dieselRecords}
        onLink={handleLinkReeferToVehicle}
        onUnlink={handleUnlinkReeferFromVehicle}
      />

      <ProbeVerificationModal
        isOpen={isProbeVerificationOpen}
        onClose={() => {
          setIsProbeVerificationOpen(false);
          setSelectedRecord(null);
        }}
        dieselRecord={selectedRecord as unknown as any}
        onVerify={handleProbeVerification}
      />

      <DieselDebriefModal
        isOpen={isDebriefOpen}
        onClose={() => {
          setIsDebriefOpen(false);
          setSelectedRecord(null);
        }}
        dieselRecord={selectedRecord as unknown as any}
        onDebrief={handleDebrief}
        onWhatsappShared={handleWhatsappShared}
      />

      {/* Batch Debrief Modal */}
      <BatchDebriefModal
        isOpen={isBatchDebriefOpen}
        onClose={() => {
          setIsBatchDebriefOpen(false);
          setSelectedFleetForBatch('');
        }}
        dieselRecords={selectedFleetForBatch
          ? dieselRecords.filter(r => r.fleet_number === selectedFleetForBatch && !r.debrief_signed)
          : dieselRecords.filter(r => !r.debrief_signed)
        }
        fleetNumber={selectedFleetForBatch || 'All Fleets'}
        onBatchDebrief={handleBatchDebrief}
        onWhatsappShared={handleBatchWhatsappShare}
      />

      <DieselNormsModal
        isOpen={isNormsModalOpen}
        onClose={() => {
          setIsNormsModalOpen(false);
          setSelectedNorm(null);
        }}
        onSave={handleNormSave}
        editNorm={selectedNorm as unknown as any}
      />

      <DieselTransactionViewModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        linkedReeferRecords={linkedReeferRecords}
        onLinkTrip={() => {
          setIsViewModalOpen(false);
          setIsTripLinkageOpen(true);
        }}
        onLinkReefer={() => {
          setIsViewModalOpen(false);
          setIsReeferLinkageOpen(true);
        }}
        onDebrief={() => {
          setIsViewModalOpen(false);
          setIsDebriefOpen(true);
        }}
        onVerifyProbe={() => {
          setIsViewModalOpen(false);
          setIsProbeVerificationOpen(true);
        }}
      />

      <ReeferLinkageModal
        isOpen={isReeferLinkageOpen}
        onClose={() => {
          setIsReeferLinkageOpen(false);
          setSelectedRecord(null);
        }}
        dieselRecord={selectedRecord}
        linkedReeferRecords={linkedReeferRecords}
        onLinkComplete={() => {
          // Refetch reefer records will happen automatically via query invalidation
        }}
      />
      {/* eslint-enable @typescript-eslint/no-explicit-any */}

      {/* ── Export Reports Dialog ──────────────────────────────────────── */}
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
    </Layout>
  );
};

export default DieselManagement;