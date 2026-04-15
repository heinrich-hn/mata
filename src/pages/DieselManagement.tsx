import DieselDebriefModal, { type DebriefData } from '@/components/diesel/DieselDebriefModal';
import DieselDebriefTab from '@/components/diesel/DieselDebriefTab';
import DieselNormsModal from '@/components/diesel/DieselNormsModal';
import DieselNormsTab from '@/components/diesel/DieselNormsTab';
import DieselReportsTab from '@/components/diesel/DieselReportsTab';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOperations } from '@/contexts/OperationsContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useReeferConsumptionSummary, useReeferDieselRecords, type ReeferDieselRecordRow } from '@/hooks/useReeferDiesel';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import type { DieselConsumptionRecord, DieselNorms } from '@/types/operations';
import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, DollarSign, Edit, Eye, FileSpreadsheet, FileText, Fuel, Link, Plus, Settings, Snowflake, Trash2, Truck, User } from 'lucide-react';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import BatchDebriefModal, { type BatchDebriefData } from '@/components/diesel/BatchDebriefModal';

const isReeferFleet = (fleet?: string | null) => !!fleet && fleet.toUpperCase().trim().endsWith('F');

const getWeekNumberForDateString = (dateStr: string): number => {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
};


const DieselManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fleetFilter, _setFleetFilter] = useState<string>('');
  const [weekFilter, _setWeekFilter] = useState<string>('');
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
  // Modal states
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
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
  const _totalCost = truckRecords
    .reduce((sum, record) => sum + (record.total_cost || 0), 0);

  const totalDistance = truckRecords.reduce((sum, record) => sum + (record.distance_travelled || 0), 0);
  const _averageKmPerLitre = totalDistance && totalLitres
    ? totalDistance / totalLitres
    : 0;

  // Reefer summary statistics
  const _reeferTotalRecords = reeferRecords.length;
  const _reeferTotalLitres = reeferRecords.reduce((sum, record) => sum + (record.litres_filled || 0), 0);
  const _reeferTotalCost = reeferRecords
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
    const totalCost = fleetRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
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
    return { totalLitres, totalCost, totalDistance, avgKmL, count: fleetRecords.length, pendingDebrief };
  };

  // Calculate week totals for a fleet
  const getWeekTotals = (records: DieselConsumptionRecord[], isReefer = false) => {
    const totalLitres = records.reduce((sum, r) => sum + (r.litres_filled || 0), 0);
    const totalCost = records.reduce((sum, r) => sum + (r.total_cost || 0), 0);
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
    return { totalLitres, totalCost, totalDistance, avgKmL, count: records.length, pendingDebrief };
  };

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
        record.currency || 'USD',
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
      const currency = selectedRecords[0]?.currency || 'USD';

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
  const handleManualSave = async (record: DieselConsumptionRecord | Omit<DieselConsumptionRecord, 'id' | 'created_at' | 'updated_at'>) => {
    if (isReeferFleet(record.fleet_number)) {
      // Reefer fleet selected in truck form - redirect to reefer save
      const reeferRecord: ReeferDieselRecord = {
        id: 'id' in record ? record.id : undefined as unknown as string,
        reefer_unit: record.fleet_number,
        date: record.date,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        cost_per_litre: record.cost_per_litre ?? null,
        total_cost: record.total_cost,
        currency: record.currency || 'USD',
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
    if ('id' in record && record.id) {
      await updateDieselRecord(record as DieselConsumptionRecord);
    } else {
      await addDieselRecord(record as Omit<DieselConsumptionRecord, 'id' | 'created_at' | 'updated_at'>);
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

  const handleLinkToTrip = async (record: DieselConsumptionRecord, tripId: string) => {
    await linkDieselToTrip(record, tripId);
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

  const handleProbeVerification = async (verificationData: Parameters<ComponentProps<typeof ProbeVerificationModal>['onVerify']>[0]) => {
    await updateDieselRecord(verificationData as unknown as DieselConsumptionRecord);
  };

  const handleDebrief = async (debriefData: DebriefData) => {
    await updateDieselRecord(debriefData as unknown as DieselConsumptionRecord);
  };

  const handleNormSave = async (norm: DieselNorms) => {
    if (norm.id) {
      await updateDieselNorm(norm);
    } else {
      await addDieselNorm(norm);
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



  const openEditRecord = (record: DieselConsumptionRecord) => {
    if (isReeferFleet(record.fleet_number)) {
      // Reefer fleet - open reefer modal with L/hr fields
      // Map diesel_records data to ReeferDieselRecord format
      // For legacy records (diesel_records), km_reading was actually operating hours
      const opHours = record.operating_hours ?? record.km_reading ?? null;
      const prevHours = record.previous_operating_hours ?? record.previous_km_reading ?? null;
      const hoursOp = record.hours_operated ?? (
        (opHours != null && prevHours != null && opHours > prevHours)
          ? opHours - prevHours : (record.distance_travelled ?? null)
      );
      const lph = record.litres_per_hour ?? (
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
        currency: record.currency || 'USD',
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="debrief">Debrief</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="norms">Norms</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
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
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportAllTransactionsToExcel}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export All to Excel
              </Button>
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
                                    {fleetTotals.totalCost > 0 && formatCurrency(fleetTotals.totalCost)}
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
                                              {weekTotals.totalCost > 0 && formatCurrency(weekTotals.totalCost)}
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
                                                            {formatCurrency(record.total_cost)}
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
                                      {fleetTotals.totalCost > 0 && formatCurrency(fleetTotals.totalCost)}
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
                                                {weekTotals.totalCost > 0 && formatCurrency(weekTotals.totalCost)}
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

                                                    const recordLph = record.litres_per_hour;
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
                                                              {formatCurrency(record.total_cost)}
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
            <DieselDebriefTab
              truckRecords={truckRecords}
              dieselRecords={dieselRecords}
              dieselNorms={dieselNorms}
              uniqueFleetNumbers={uniqueFleetNumbers}
              recordsRequiringDebrief={recordsRequiringDebrief}
              whatsappSharedSet={whatsappSharedSet}
              calculateKmPerLitre={calculateKmPerLitre}
              getNormForFleet={getNormForFleet}
              onOpenDebrief={openDebrief}
              onOpenBatchDebrief={(fleet) => {
                setSelectedFleetForBatch(fleet);
                setIsBatchDebriefOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="reports">
            <DieselReportsTab
              dieselRecords={dieselRecords}
              dieselNorms={dieselNorms}
              truckRecords={truckRecords}
              reeferRecords={reeferRecords}
              reeferFleetNumbers={reeferFleetNumbers}
              reeferLhrMap={reeferLhrMap}
            />
          </TabsContent>

          <TabsContent value="norms">
            <DieselNormsTab
              dieselNorms={dieselNorms}
              onAddNorm={() => {
                setSelectedNorm(null);
                setIsNormsModalOpen(true);
              }}
              onEditNorm={openEditNorm}
              onDeleteNorm={handleDeleteNorm}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <ManualDieselEntryModal
        isOpen={isManualEntryOpen}
        onClose={() => {
          setIsManualEntryOpen(false);
          setSelectedRecord(null);
        }}
        onSave={handleManualSave}
        editRecord={selectedRecord as unknown as ComponentProps<typeof ManualDieselEntryModal>['editRecord']}
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

      <TripLinkageModal
        isOpen={isTripLinkageOpen}
        onClose={() => {
          setIsTripLinkageOpen(false);
          setSelectedRecord(null);
        }}
        dieselRecord={selectedRecord as unknown as ComponentProps<typeof TripLinkageModal>['dieselRecord']}
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
        dieselRecord={selectedRecord as unknown as ComponentProps<typeof ProbeVerificationModal>['dieselRecord']}
        onVerify={handleProbeVerification}
      />

      <DieselDebriefModal
        isOpen={isDebriefOpen}
        onClose={() => {
          setIsDebriefOpen(false);
          setSelectedRecord(null);
        }}
        dieselRecord={selectedRecord as unknown as ComponentProps<typeof DieselDebriefModal>['dieselRecord']}
        onDebrief={handleDebrief}
        onWhatsappShared={handleWhatsappShared}
        allDieselRecords={dieselRecords}
        dieselNorms={dieselNorms}
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
        editNorm={selectedNorm as unknown as ComponentProps<typeof DieselNormsModal>['editNorm']}
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

    </Layout>
  );
};

export default DieselManagement;