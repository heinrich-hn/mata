import { CostForm } from '@/components/costs/CostForm';
import
  {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import
  {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import
  {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOperations } from '@/contexts/OperationsContext';
import { useToast } from '@/hooks/use-toast';
import { useWialonVehicles } from '@/hooks/useWialonVehicles';
import { supabase } from '@/integrations/supabase/client';
import { CostEntry, Trip } from '@/types/operations';
import { extractFleetNumber } from '@/utils/fleetUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import
  {
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    DollarSign,
    Download,
    Edit,
    Eye,
    FileText,
    FileWarning,
    Flag,
    RotateCcw,
    Search,
    ShieldCheck,
    Trash2,
    Truck
  } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import FlagResolutionModal from './FlagResolutionModal';
import { useAuth } from '@/contexts/AuthContext';

interface TripExpensesSectionProps {
  trips: Trip[];
  onViewTrip?: (trip: Trip) => void;
}

interface ExpenseWithTrip extends CostEntry {
  trip_number?: string;
  trip_status?: string;
  trip_origin?: string;
  trip_destination?: string;
  fleet_number?: string;
  // Computed fields for attention
  needsAttention?: boolean;
  missingSlip?: boolean;
}

const TripExpensesSection = ({ trips, onViewTrip }: TripExpensesSectionProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { deleteCostEntry } = useOperations();
  const [searchQuery, setSearchQuery] = useState('');
  // Default to showing items needing attention
  const [filterStatus, setFilterStatus] = useState<'all' | 'needs-attention' | 'flagged' | 'missing-slip' | 'resolved' | 'verified'>('needs-attention');
  const [filterTripStatus, setFilterTripStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFleet, setFilterFleet] = useState<string>('all');
  const [editingCost, setEditingCost] = useState<CostEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [costToDelete, setCostToDelete] = useState<CostEntry | null>(null);
  const [selectedFlaggedCost, setSelectedFlaggedCost] = useState<CostEntry | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [tripToVerifyNoCosts, setTripToVerifyNoCosts] = useState<Trip | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedTripsForVerify, setSelectedTripsForVerify] = useState<Set<string>>(new Set());
  const [isBulkVerifying, setIsBulkVerifying] = useState(false);
  const [costToApprove, setCostToApprove] = useState<CostEntry | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Fetch wialon vehicles for fleet mapping
  const { data: wialonVehicles = [] } = useWialonVehicles();

  // Check if any filters are active (needs-attention is the default, so don't count it)
  const hasActiveFilters = searchQuery || filterStatus !== 'needs-attention' || filterTripStatus !== 'all' || filterCategory !== 'all' || filterFleet !== 'all';

  // Clear all filters (reset to default needs-attention view)
  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('needs-attention');
    setFilterTripStatus('all');
    setFilterCategory('all');
    setFilterFleet('all');
  };

  // Toggle trip expansion
  const toggleTripExpansion = (tripId: string) => {
    setExpandedTrips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  // Stable query key — use trip IDs instead of full objects to prevent
  // query key changes on every parent re-render (which overwrites optimistic updates)
  const tripIds = useMemo(() => trips.map(t => t.id).sort().join(','), [trips]);

  // Fetch all cost entries with trip information
  const { data: expenses = [], isLoading, refetch } = useQuery({
    queryKey: ['all-expenses', tripIds],
    queryFn: async () => {
      // Fetch ALL cost_entries using pagination to bypass Supabase's 1000-row default limit
      type CostRow = NonNullable<Awaited<ReturnType<typeof supabase.from<'cost_entries'>['select']>>['data']>[number];
      let allData: CostRow[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data: page, error } = await supabase
          .from('cost_entries')
          .select('*')
          .order('date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allData = [...allData, ...page];
        if (page.length < PAGE_SIZE) break; // Last page
        from += PAGE_SIZE;
      }

      // Create a map of trips by id for quick lookup
      const tripMap = new Map(trips.map((trip) => [trip.id, trip]));

      // Create a map of wialon vehicles for fleet lookup - extract short fleet codes
      const wialonMap = new Map(wialonVehicles.map((v) => [v.id, extractFleetNumber(v.fleet_number || v.name)]));

      // Transform data to include trip information
      return (allData || []).map((expense) => {
        const tripData = expense.trip_id ? tripMap.get(expense.trip_id) : null;
        // Get fleet number from wialon vehicle via trip's vehicle_id
        const fleetNumber = tripData?.vehicle_id ? wialonMap.get(tripData.vehicle_id) : undefined;
        return {
          ...expense,
          attachments: expense.attachments as unknown as CostEntry['attachments'],
          trip_number: tripData?.trip_number,
          trip_status: tripData?.status,
          trip_origin: tripData?.origin,
          trip_destination: tripData?.destination,
          fleet_number: fleetNumber,
        } as ExpenseWithTrip;
      });
    },
    enabled: trips.length > 0,
  });

  // Get unique categories for filter
  const categories = useMemo(() => {
    const uniqueCategories = new Set(expenses.map((e) => e.category));
    return Array.from(uniqueCategories).sort();
  }, [expenses]);

  // Get unique fleet numbers for filter
  const fleetNumbers = useMemo(() => {
    const uniqueFleets = new Set(
      expenses
        .map((e) => e.fleet_number)
        .filter((f): f is string => !!f)
    );
    return Array.from(uniqueFleets).sort((a, b) => {
      // Natural sort for fleet numbers like 4H, 6H, 21H, 22H
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });
  }, [expenses]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          expense.category?.toLowerCase().includes(query) ||
          expense.sub_category?.toLowerCase().includes(query) ||
          expense.reference_number?.toLowerCase().includes(query) ||
          expense.trip_number?.toLowerCase().includes(query) ||
          expense.fleet_number?.toLowerCase().includes(query) ||
          expense.notes?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter - now includes missing slips and unverified costs as needing attention
      if (filterStatus !== 'all') {
        const isResolved = expense.investigation_status === 'resolved';
        const hasUnresolvedFlag = expense.is_flagged && !isResolved;
        const isMissingSlip = !expense.attachments || expense.attachments.length === 0;
        // Once approved/resolved, the cost no longer needs attention
        const needsAttention = isResolved ? false : (hasUnresolvedFlag || isMissingSlip);
        
        if (filterStatus === 'needs-attention' && !needsAttention) {
          return false;
        }
        if (filterStatus === 'flagged' && !hasUnresolvedFlag) {
          return false;
        }
        if (filterStatus === 'missing-slip' && (!isMissingSlip || isResolved)) {
          return false;
        }
        if (filterStatus === 'resolved' && expense.investigation_status !== 'resolved') {
          return false;
        }
        if (filterStatus === 'verified' && expense.investigation_status !== 'resolved') {
          return false;
        }
      }

      // Trip status filter
      if (filterTripStatus !== 'all' && expense.trip_status !== filterTripStatus) {
        return false;
      }

      // Category filter
      if (filterCategory !== 'all' && expense.category !== filterCategory) {
        return false;
      }

      // Fleet filter
      if (filterFleet !== 'all' && expense.fleet_number !== filterFleet) {
        return false;
      }

      return true;
    });
  }, [expenses, searchQuery, filterStatus, filterTripStatus, filterCategory, filterFleet]);

  // Group filtered expenses by trip
  const expensesByTrip = useMemo(() => {
    const grouped: Record<string, {
      tripId: string;
      tripNumber: string;
      fleetNumber?: string;
      origin?: string;
      destination?: string;
      tripStatus?: string;
      expenses: ExpenseWithTrip[];
      totalAmount: number;
      flaggedCount: number;
      unresolvedCount: number;
      missingSlipCount: number;
    }> = {};

    filteredExpenses.forEach((expense) => {
      const tripId = expense.trip_id || 'no-trip';
      const hasUnresolvedFlag = expense.is_flagged && expense.investigation_status !== 'resolved';
      const isMissingSlip = !expense.attachments || expense.attachments.length === 0;
      
      if (!grouped[tripId]) {
        grouped[tripId] = {
          tripId,
          tripNumber: expense.trip_number || 'No Trip',
          fleetNumber: expense.fleet_number,
          origin: expense.trip_origin,
          destination: expense.trip_destination,
          tripStatus: expense.trip_status,
          expenses: [],
          totalAmount: 0,
          flaggedCount: 0,
          unresolvedCount: 0,
          missingSlipCount: 0,
        };
      }
      grouped[tripId].expenses.push(expense);
      grouped[tripId].totalAmount += expense.amount || 0;
      if (expense.is_flagged) {
        grouped[tripId].flaggedCount++;
        if (hasUnresolvedFlag) {
          grouped[tripId].unresolvedCount++;
        }
      }
      if (isMissingSlip) {
        grouped[tripId].missingSlipCount = (grouped[tripId].missingSlipCount || 0) + 1;
      }
    });

    return Object.values(grouped).sort((a, b) => {
      // Sort by total issues (unresolved + missing slips), then by trip number
      const aIssues = (a.unresolvedCount || 0) + (a.missingSlipCount || 0);
      const bIssues = (b.unresolvedCount || 0) + (b.missingSlipCount || 0);
      if (bIssues !== aIssues) {
        return bIssues - aIssues;
      }
      return (a.tripNumber || '').localeCompare(b.tripNumber || '');
    });
  }, [filteredExpenses]);

  // Get trips with no expenses that need attention (both active AND completed)
  // Exclude trips that have been verified as intentionally having no costs
  const tripsWithNoExpenses = useMemo(() => {
    if (filterStatus !== 'needs-attention') return [];
    
    const tripsWithCosts = new Set(expenses.map(e => e.trip_id).filter(Boolean));
    return trips.filter(trip => 
      !tripsWithCosts.has(trip.id) && 
      !trip.verified_no_costs // Exclude verified trips
    );
  }, [trips, expenses, filterStatus]);

  // Handle marking a trip as verified no costs
  const handleVerifyNoCosts = async () => {
    if (!tripToVerifyNoCosts) return;
    
    setIsVerifying(true);
    try {
      const { error } = await supabase
        .from('trips')
        .update({
          verified_no_costs: true,
          verified_no_costs_by: user?.email || 'Unknown',
          verified_no_costs_at: new Date().toISOString(),
        })
        .eq('id', tripToVerifyNoCosts.id);

      if (error) throw error;

      toast({
        title: 'Trip Verified',
        description: `POD #${tripToVerifyNoCosts.trip_number} marked as verified with no costs.`,
      });
      
      // Close dialog first
      setTripToVerifyNoCosts(null);
      
      // Force refetch queries immediately (not just invalidate)
      await queryClient.refetchQueries({ queryKey: ['trips'] });
      await queryClient.refetchQueries({ queryKey: ['all-expenses'] });
      
    } catch (err) {
      console.error('Error verifying trip:', err);
      toast({
        title: 'Error',
        description: 'Failed to verify trip. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle bulk verification of multiple trips
  const handleBulkVerifyNoCosts = async () => {
    if (selectedTripsForVerify.size === 0) return;
    
    setIsBulkVerifying(true);
    const tripIds = Array.from(selectedTripsForVerify);

    try {
      // Update all selected trips in one batch
      const { error } = await supabase
        .from('trips')
        .update({
          verified_no_costs: true,
          verified_no_costs_by: user?.email || 'Unknown',
          verified_no_costs_at: new Date().toISOString(),
        })
        .in('id', tripIds);

      if (error) {
        throw error;
      }
      
      toast({
        title: 'Bulk Verification Complete',
        description: `${tripIds.length} trip(s) marked as verified with no costs.`,
      });

      // Clear selection
      setSelectedTripsForVerify(new Set());
      
      // Force refetch
      await queryClient.refetchQueries({ queryKey: ['trips'] });
      await queryClient.refetchQueries({ queryKey: ['all-expenses'] });
      
    } catch (err) {
      console.error('Error bulk verifying trips:', err);
      toast({
        title: 'Error',
        description: 'Failed to verify trips. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkVerifying(false);
    }
  };

  // Toggle selection of a trip
  const toggleTripSelection = (tripId: string) => {
    setSelectedTripsForVerify(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  // Select/deselect all trips with no expenses
  const toggleSelectAll = () => {
    if (selectedTripsForVerify.size === tripsWithNoExpenses.length) {
      // Deselect all
      setSelectedTripsForVerify(new Set());
    } else {
      // Select all
      setSelectedTripsForVerify(new Set(tripsWithNoExpenses.map(t => t.id)));
    }
  };

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalExpenses = { ZAR: 0, USD: 0 };
    let flaggedCount = 0;
    let unresolvedFlagCount = 0;
    let resolvedCount = 0;
    let missingSlipCount = 0;

    expenses.forEach((expense) => {
      const currency = (expense.currency as 'ZAR' | 'USD') || 'USD';
      totalExpenses[currency] += expense.amount || 0;

      // Only count missing slips for non-resolved costs
      if (expense.investigation_status !== 'resolved' && (!expense.attachments || expense.attachments.length === 0)) {
        missingSlipCount++;
      }

      if (expense.is_flagged) {
        flaggedCount++;
        if (expense.investigation_status === 'resolved') {
          resolvedCount++;
        } else {
          unresolvedFlagCount++;
        }
      }
    });

    return {
      totalExpenses,
      totalCount: expenses.length,
      flaggedCount,
      unresolvedFlagCount,
      resolvedCount,
      missingSlipCount,
      needsAttentionCount: unresolvedFlagCount + missingSlipCount,
    };
  }, [expenses]);

  const fmtCurrency = (amount: number, currency: string = 'USD') => {
    const symbol = currency === 'USD' ? '$' : 'R';
    return `${symbol}${amount.toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Keep original name for JSX usage
  const formatCurrency = fmtCurrency;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  // Export filtered expenses to Excel (professionally styled)
  const exportExpensesToExcel = useCallback(async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Car Craft Co Fleet Management';
      wb.created = new Date();

      // ── Shared style helpers ──
      const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
      const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' };
      const headerAlignment: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const currencyFmt = '#,##0.00';
      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
        left: { style: 'thin', color: { argb: 'D9D9D9' } },
        right: { style: 'thin', color: { argb: 'D9D9D9' } },
      };
      const zebraFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F6FC' } };

      const applyHeaderRow = (ws: ExcelJS.Worksheet, rowNum: number) => {
        const row = ws.getRow(rowNum);
        row.eachCell(cell => {
          cell.fill = headerFill;
          cell.font = headerFont;
          cell.alignment = headerAlignment;
          cell.border = thinBorder;
        });
        row.height = 28;
      };

      const autoWidth = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach(col => {
          let max = 12;
          col.eachCell?.({ includeEmpty: false }, cell => {
            const len = cell.value ? String(cell.value).length + 2 : 0;
            if (len > max) max = len;
          });
          col.width = Math.min(max, 40);
        });
      };

      // ═══════════════════════════════════════
      // 1. SUMMARY SHEET
      // ═══════════════════════════════════════
      const summaryWs = wb.addWorksheet('Summary');

      // Title
      summaryWs.mergeCells('A1:D1');
      const titleCell = summaryWs.getCell('A1');
      titleCell.value = 'EXPENSE REPORT';
      titleCell.font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      titleCell.alignment = { vertical: 'middle' };
      summaryWs.getRow(1).height = 32;

      // Subtitle
      summaryWs.mergeCells('A2:D2');
      const subCell = summaryWs.getCell('A2');
      subCell.value = `Generated: ${format(new Date(), 'dd MMMM yyyy, HH:mm')} • Car Craft Co Fleet Management`;
      subCell.font = { italic: true, size: 9, color: { argb: '666666' }, name: 'Calibri' };
      summaryWs.getRow(2).height = 20;

      // Summary data
      const sRows: [string, string | number][] = [
        ['Total Entries', filteredExpenses.length],
        ['Total Expenses (ZAR)', stats.totalExpenses.ZAR],
        ['Total Expenses (USD)', stats.totalExpenses.USD],
        ['Flagged', stats.flaggedCount],
        ['Unresolved', stats.unresolvedFlagCount],
        ['Missing Slips', stats.missingSlipCount],
      ];

      // Section header
      summaryWs.getRow(4).values = ['Metric', 'Value'];
      applyHeaderRow(summaryWs, 4);

      sRows.forEach((r, i) => {
        const row = summaryWs.getRow(5 + i);
        row.values = [r[0], r[1]];
        row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
        row.getCell(2).font = { size: 10, name: 'Calibri' };
        if (typeof r[1] === 'number' && (r[0].includes('ZAR') || r[0].includes('USD'))) {
          row.getCell(2).numFmt = currencyFmt;
        }
        row.eachCell(cell => { cell.border = thinBorder; });
        if (i % 2 === 1) row.eachCell(cell => { cell.fill = zebraFill; });
      });

      summaryWs.getColumn(1).width = 25;
      summaryWs.getColumn(2).width = 20;

      // ═══════════════════════════════════════
      // 2. EXPENSES DETAIL SHEET
      // ═══════════════════════════════════════
      const detailWs = wb.addWorksheet('Expenses');
      const detailHeaders = ['Date', 'Trip #', 'Fleet', 'Route', 'Category', 'Sub-Category', 'Amount', 'Currency', 'Reference', 'Notes', 'Flagged', 'Status', 'Missing Slip'];
      detailWs.getRow(1).values = detailHeaders;
      applyHeaderRow(detailWs, 1);

      filteredExpenses.forEach((e, i) => {
        const row = detailWs.getRow(i + 2);
        row.values = [
          e.date ? format(parseISO(e.date), 'yyyy-MM-dd') : '',
          e.trip_number || '',
          e.fleet_number || '',
          e.trip_origin && e.trip_destination ? `${e.trip_origin} → ${e.trip_destination}` : '',
          e.category || '',
          e.sub_category || '',
          Number(e.amount || 0),
          e.currency || 'USD',
          e.reference_number || '',
          e.notes || '',
          e.is_flagged ? 'Yes' : 'No',
          e.investigation_status || 'N/A',
          (!e.attachments || e.attachments.length === 0) ? 'Yes' : 'No',
        ];
        row.getCell(7).numFmt = currencyFmt;
        row.eachCell(cell => {
          cell.border = thinBorder;
          cell.font = { size: 9, name: 'Calibri' };
          cell.alignment = { vertical: 'middle' };
        });
        // Zebra striping
        if (i % 2 === 1) {
          row.eachCell(cell => { cell.fill = zebraFill; });
        }
        // Highlight flagged rows
        if (e.is_flagged && e.investigation_status !== 'resolved') {
          row.getCell(11).font = { size: 9, name: 'Calibri', bold: true, color: { argb: 'CC0000' } };
        }
        // Highlight missing slips
        if (!e.attachments || e.attachments.length === 0) {
          row.getCell(13).font = { size: 9, name: 'Calibri', bold: true, color: { argb: 'CC6600' } };
        }
      });

      // Auto-filter
      detailWs.autoFilter = { from: 'A1', to: `M${filteredExpenses.length + 1}` };
      // Freeze header row
      detailWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoWidth(detailWs);

      // ═══════════════════════════════════════
      // 3. BY TRIP SHEET
      // ═══════════════════════════════════════
      const tripWs = wb.addWorksheet('By Trip');
      const tripHeaders = ['Trip #', 'Fleet', 'Route', 'Status', 'Entries', 'Total Amount', 'Flagged', 'Missing Slips'];
      tripWs.getRow(1).values = tripHeaders;
      applyHeaderRow(tripWs, 1);

      expensesByTrip.forEach((g, i) => {
        const row = tripWs.getRow(i + 2);
        row.values = [
          g.tripNumber,
          g.fleetNumber || '',
          g.origin && g.destination ? `${g.origin} → ${g.destination}` : '',
          g.tripStatus || '',
          g.expenses.length,
          g.totalAmount,
          g.flaggedCount,
          g.missingSlipCount,
        ];
        row.getCell(6).numFmt = currencyFmt;
        row.eachCell(cell => {
          cell.border = thinBorder;
          cell.font = { size: 9, name: 'Calibri' };
          cell.alignment = { vertical: 'middle' };
        });
        if (i % 2 === 1) {
          row.eachCell(cell => { cell.fill = zebraFill; });
        }
      });

      // Totals row
      const totalRow = tripWs.getRow(expensesByTrip.length + 2);
      totalRow.values = [
        'TOTAL', '', '', '',
        expensesByTrip.reduce((s, g) => s + g.expenses.length, 0),
        expensesByTrip.reduce((s, g) => s + g.totalAmount, 0),
        expensesByTrip.reduce((s, g) => s + g.flaggedCount, 0),
        expensesByTrip.reduce((s, g) => s + g.missingSlipCount, 0),
      ];
      totalRow.eachCell(cell => {
        cell.font = { bold: true, size: 10, name: 'Calibri' };
        cell.border = { top: { style: 'double', color: { argb: '1F3864' } }, bottom: { style: 'double', color: { argb: '1F3864' } }, left: thinBorder.left!, right: thinBorder.right! };
      });
      totalRow.getCell(6).numFmt = currencyFmt;

      tripWs.autoFilter = { from: 'A1', to: `H${expensesByTrip.length + 1}` };
      tripWs.views = [{ state: 'frozen', ySplit: 1 }];
      autoWidth(tripWs);

      // ── Save ──
      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Export Successful',
        description: `${filteredExpenses.length} expenses exported to Excel.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to export expenses. Please try again.',
        variant: 'destructive',
      });
    }
  }, [filteredExpenses, expensesByTrip, stats, toast]);

  // Export filtered expenses to PDF
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
      doc.text(`Generated: ${new Date().toLocaleDateString()} | ${filteredExpenses.length} entries`, 14, 25);

      // Summary row
      doc.setFontSize(10);
      doc.text(
        `Total: ${fmtCurrency(stats.totalExpenses.ZAR, 'ZAR')}${stats.totalExpenses.USD > 0 ? ` + ${fmtCurrency(stats.totalExpenses.USD, 'USD')}` : ''} | Flagged: ${stats.flaggedCount} | Missing Slips: ${stats.missingSlipCount}`,
        14, 31
      );

      // By Trip summary table
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary by Trip', 14, 40);

      autoTable(doc, {
        startY: 43,
        head: [['Trip #', 'Fleet', 'Route', 'Entries', 'Total', 'Flagged', 'Missing Slips']],
        body: expensesByTrip.map(g => [
          g.tripNumber,
          g.fleetNumber || '-',
          g.origin && g.destination ? `${g.origin} → ${g.destination}` : '-',
          g.expenses.length.toString(),
          fmtCurrency(g.totalAmount, 'USD'),
          g.flaggedCount.toString(),
          g.missingSlipCount.toString(),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      // Detailed expenses on new page
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Expenses', 14, 18);

      autoTable(doc, {
        startY: 23,
        head: [['Date', 'Trip #', 'Fleet', 'Category', 'Sub-Cat', 'Amount', 'Curr', 'Ref', 'Flagged']],
        body: filteredExpenses.map(e => [
          e.date ? format(parseISO(e.date), 'yyyy-MM-dd') : '-',
          e.trip_number || '-',
          e.fleet_number || '-',
          e.category || '-',
          e.sub_category || '-',
          Number(e.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          e.currency || 'USD',
          e.reference_number || '-',
          e.is_flagged ? 'Yes' : 'No',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 22 },
          5: { halign: 'right' },
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

      doc.save(`Expenses_${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: 'PDF Generated',
        description: `${filteredExpenses.length} expenses exported as PDF.`,
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  }, [filteredExpenses, expensesByTrip, stats, toast]);

  const handleEdit = (expense: CostEntry) => {
    setEditingCost(expense);
    setShowEditDialog(true);
  };

  const handleDelete = async () => {
    if (!costToDelete) return;

    try {
      await deleteCostEntry(costToDelete.id);
      toast({
        title: 'Success',
        description: 'Expense deleted successfully',
      });
      setCostToDelete(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['cost-entries'] });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        variant: 'destructive',
      });
    }
  };

  const handleResolveFlag = (cost: CostEntry) => {
    setSelectedFlaggedCost(cost);
    setShowFlagModal(true);
  };

  /**
   * After resolving/approving a flagged cost, check if all flagged costs for that
   * trip are now resolved. If so, resolve the corresponding alert in the alerts table.
   */
  const tryResolveFlaggedCostAlert = async (tripId: string | undefined) => {
    if (!tripId) return;
    try {
      // Check if there are any remaining unresolved flagged costs for this trip
      const { count } = await supabase
        .from('cost_entries')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('is_flagged', true)
        .neq('investigation_status', 'resolved');

      if (count === 0) {
        // All flagged costs are resolved — resolve the alert
        await supabase
          .from('alerts')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_note: 'All flagged costs resolved',
          })
          .eq('source_type', 'trip')
          .eq('source_id', tripId)
          .eq('category', 'fuel_anomaly')
          .eq('status', 'active')
          .filter('metadata->>issue_type', 'eq', 'flagged_costs');
      }
    } catch (err) {
      console.error('Error checking/resolving flagged cost alert:', err);
    }
  };

  const handleApproveCost = async () => {
    if (!costToApprove) return;

    const tripId = costToApprove.trip_id;
    const costId = costToApprove.id;
    const now = new Date().toISOString();
    const approver = user?.email || 'admin';
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('cost_entries')
        .update({
          investigation_status: 'resolved',
          investigation_notes: costToApprove.investigation_notes
            ? `${costToApprove.investigation_notes}\n\n--- APPROVED ---\nApproved by ${approver} on ${new Date().toLocaleDateString('en-ZA')}`
            : `Approved by ${approver} on ${new Date().toLocaleDateString('en-ZA')}`,
          resolved_at: now,
          resolved_by: approver,
        })
        .eq('id', costId);

      if (error) throw error;

      // Resolve the alert if all flagged costs for this trip are now resolved
      tryResolveFlaggedCostAlert(tripId);

      toast({
        title: 'Cost Approved',
        description: `${costToApprove.category}${costToApprove.sub_category ? ' – ' + costToApprove.sub_category : ''} has been approved.`,
      });

      // Optimistically update the cache so the item disappears without a full refetch.
      // This keeps the trip expanded and scroll position intact.
      queryClient.setQueriesData<ExpenseWithTrip[]>(
        { queryKey: ['all-expenses'] },
        (old) => old?.map(e =>
          e.id === costId
            ? { ...e, investigation_status: 'resolved', resolved_at: now, resolved_by: approver }
            : e
        ),
      );

      setCostToApprove(null);
      // Background refresh for consistency — won't flash because data is already cached
      queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cost-entries'] });
    } catch (err) {
      console.error('Error approving cost:', err);
      toast({
        title: 'Error',
        description: 'Failed to approve cost entry.',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const getStatusBadge = (expense: ExpenseWithTrip) => {
    if (expense.is_flagged && expense.investigation_status !== 'resolved') {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Flagged
        </Badge>
      );
    }

    if (expense.investigation_status === 'resolved') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300/50">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      );
    }

    // Unflagged but not yet explicitly approved
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300/50">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Pending Verification
      </Badge>
    );
  };

  const findTripById = (tripId?: string) => {
    if (!tripId) return null;
    return trips.find((t) => t.id === tripId) || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Glass Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-3.5 shadow-sm">
        <div>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {stats.totalCount} entries totaling {formatCurrency(stats.totalExpenses.ZAR, 'ZAR')}
            {stats.totalExpenses.USD > 0 && ` + ${formatCurrency(stats.totalExpenses.USD, 'USD')}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <Button variant="outline" size="sm" onClick={exportExpensesToExcel} className="h-8 gap-1.5 text-xs bg-background/80 border-border/50 rounded-lg hover:bg-accent/80 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportExpensesToPDF} className="h-8 gap-1.5 text-xs bg-background/80 border-border/50 rounded-lg hover:bg-accent/80 transition-colors">
            <FileText className="w-3.5 h-3.5" />
            PDF
          </Button>
          {stats.missingSlipCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700">
              <FileWarning className="h-3.5 w-3.5" />
              <span className="font-medium">{stats.missingSlipCount}</span>
              <span>missing slips</span>
            </div>
          )}
          {stats.unresolvedFlagCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700">
              <Flag className="h-3.5 w-3.5" />
              <span className="font-medium">{stats.unresolvedFlagCount}</span>
              <span>flagged</span>
            </div>
          )}
          {stats.resolvedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="font-medium">{stats.resolvedCount}</span>
              <span>resolved</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-muted/40 backdrop-blur-sm border border-border/40">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm bg-background/80 border-border/50 rounded-lg"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Fleet Filter */}
          <Select value={filterFleet} onValueChange={setFilterFleet}>
            <SelectTrigger className="h-9 w-[120px] text-sm bg-background/80 border-border/50 rounded-lg">
              <Truck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Fleet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fleets</SelectItem>
              {fleetNumbers.map((fleet) => (
                <SelectItem key={fleet} value={fleet}>
                  {fleet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 w-[140px] text-sm bg-background/80 border-border/50 rounded-lg">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Flag Status Filter */}
          <Select value={filterStatus} onValueChange={(value: typeof filterStatus) => setFilterStatus(value)}>
            <SelectTrigger className={`h-9 w-[150px] text-sm rounded-lg ${
              filterStatus === 'needs-attention' 
                ? 'bg-amber-100 border-amber-300 text-amber-800' 
                : 'bg-background/80 border-border/50'
            }`}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="needs-attention">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Needs Attention
                </span>
              </SelectItem>
              <SelectItem value="all">All Expenses</SelectItem>
              <SelectItem value="flagged">Flagged Only</SelectItem>
              <SelectItem value="missing-slip">
                <span className="flex items-center gap-1.5">
                  <FileWarning className="h-3.5 w-3.5 text-rose-600" />
                  Missing Slip
                </span>
              </SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>

          {/* Trip Status Filter */}
          <Select value={filterTripStatus} onValueChange={(value: typeof filterTripStatus) => setFilterTripStatus(value)}>
            <SelectTrigger className="h-9 w-[130px] text-sm bg-background/80 border-border/50 rounded-lg">
              <SelectValue placeholder="Trip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trips</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Pills - Don't show if only default filter is active */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {filterFleet !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              Fleet: {filterFleet}
              <button onClick={() => setFilterFleet('all')} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
          {filterCategory !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              {filterCategory}
              <button onClick={() => setFilterCategory('all')} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
          {filterStatus !== 'needs-attention' && filterStatus !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              {filterStatus === 'flagged' ? 'Flagged Only' :
               filterStatus === 'resolved' ? 'Resolved' :
               filterStatus === 'verified' ? 'Verified' : filterStatus}
              <button onClick={() => setFilterStatus('needs-attention')} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
          {filterStatus === 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              Showing All
              <button onClick={() => setFilterStatus('needs-attention')} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
          {filterTripStatus !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              {filterTripStatus} trips
              <button onClick={() => setFilterTripStatus('all')} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1 text-xs h-6">
              "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
        </div>
      )}

      {/* Trips Without Expenses - Show in Needs Attention view */}
      {filterStatus === 'needs-attention' && tripsWithNoExpenses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <FileWarning className="h-4 w-4" />
              <span>Trips Missing Expenses ({tripsWithNoExpenses.length})</span>
            </div>
            {/* Bulk action bar */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                <Checkbox
                  checked={selectedTripsForVerify.size === tripsWithNoExpenses.length && tripsWithNoExpenses.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span>Select All</span>
              </label>
              {selectedTripsForVerify.size > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={handleBulkVerifyNoCosts}
                  disabled={isBulkVerifying}
                >
                  <CheckCircle className="h-4 w-4" />
                  {isBulkVerifying ? 'Verifying...' : `Verify Selected (${selectedTripsForVerify.size})`}
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            {tripsWithNoExpenses.map((trip) => {
              const isSelected = selectedTripsForVerify.has(trip.id);
              return (
                <Card 
                  key={trip.id} 
                  className={`p-4 transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' 
                      : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100/60'
                  }`}
                  onClick={() => onViewTrip?.(trip)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Selection checkbox */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleTripSelection(trip.id)}
                          className="h-5 w-5"
                        />
                      </div>
                      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                        isSelected ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'
                      }`}>
                        {isSelected ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">POD #{trip.trip_number}</span>
                          <Badge variant="outline" className={`text-xs ${
                            isSelected 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
                              : 'bg-rose-100 text-rose-700 border-rose-300'
                          }`}>
                            {isSelected ? 'Selected for verification' : 'No costs recorded'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : trip.route || 'No route'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTripToVerifyNoCosts(trip);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Verify
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-rose-700 border-rose-300 hover:bg-rose-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewTrip?.(trip);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses Grouped by Trip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {filterStatus === 'needs-attention' ? 'Flagged Expenses by Trip' : 'Expenses by Trip'}
            <span className="text-muted-foreground font-normal ml-1">({expensesByTrip.length} trips, {filteredExpenses.length} expenses)</span>
          </h3>
        </div>

        {expensesByTrip.length === 0 && tripsWithNoExpenses.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card/80 py-12 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {filterStatus === 'needs-attention' 
                ? 'All flags have been resolved! No items need attention.'
                : 'No expenses found matching your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {expensesByTrip.map((tripGroup) => {
              const isExpanded = expandedTrips.has(tripGroup.tripId);
              const hasUnresolved = tripGroup.unresolvedCount > 0;
              const hasMissingSlips = tripGroup.missingSlipCount > 0;
              const needsAttention = hasUnresolved || hasMissingSlips;

              return (
                <Collapsible
                  key={tripGroup.tripId}
                  open={isExpanded}
                  onOpenChange={() => toggleTripExpansion(tripGroup.tripId)}
                >
                  <Card className={`overflow-hidden transition-all ${
                    hasUnresolved ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/10' :
                    hasMissingSlips ? 'border-rose-300 bg-rose-50/30 dark:bg-rose-950/10' : ''
                  }`}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                            hasUnresolved ? 'bg-amber-100 dark:bg-amber-900/30' :
                            hasMissingSlips ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-muted'
                          }`}>
                            {isExpanded ? (
                              <ChevronDown className={`h-5 w-5 ${needsAttention ? (hasUnresolved ? 'text-amber-600' : 'text-rose-600') : 'text-muted-foreground'}`} />
                            ) : (
                              <ChevronRight className={`h-5 w-5 ${needsAttention ? (hasUnresolved ? 'text-amber-600' : 'text-rose-600') : 'text-muted-foreground'}`} />
                            )}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {tripGroup.fleetNumber && (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono font-medium">
                                  {tripGroup.fleetNumber}
                                </span>
                              )}
                              <span className="font-semibold">POD #{tripGroup.tripNumber}</span>
                              {hasUnresolved && (
                                <Badge variant="destructive" className="gap-1 text-xs">
                                  <AlertTriangle className="h-3 w-3" />
                                  {tripGroup.unresolvedCount} flagged
                                </Badge>
                              )}
                              {hasMissingSlips && (
                                <Badge variant="outline" className="gap-1 text-xs bg-rose-100 text-rose-700 border-rose-300">
                                  <FileWarning className="h-3 w-3" />
                                  {tripGroup.missingSlipCount} missing slips
                                </Badge>
                              )}
                              {tripGroup.tripStatus && (
                                <Badge variant="outline" className="text-xs">
                                  {tripGroup.tripStatus}
                                </Badge>
                              )}
                            </div>
                            {tripGroup.origin && tripGroup.destination && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {tripGroup.origin} → {tripGroup.destination}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatCurrency(tripGroup.totalAmount)}
                            </div>
                            <span className="text-xs text-muted-foreground">{tripGroup.expenses.length} expenses</span>
                          </div>
                          {tripGroup.tripId !== 'no-trip' && onViewTrip && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                const trip = findTripById(tripGroup.tripId);
                                if (trip) onViewTrip(trip);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t overflow-x-auto">
                        <Table className="min-w-[550px]">
                          <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/30">
                              <TableHead className="text-xs font-medium">Category</TableHead>
                              <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                              <TableHead className="w-[90px] text-xs font-medium">Date</TableHead>
                              <TableHead className="w-[100px] text-xs font-medium">Status</TableHead>
                              <TableHead className="w-[120px] text-xs font-medium text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tripGroup.expenses.map((expense) => {
                              const isMissingSlip = !expense.attachments || expense.attachments.length === 0;
                              const hasUnresolvedFlag = expense.is_flagged && expense.investigation_status !== 'resolved';
                              
                              return (
                              <TableRow
                                key={expense.id}
                                className={
                                  hasUnresolvedFlag ? 'bg-amber-50/50 dark:bg-amber-950/20' :
                                  isMissingSlip ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                                }
                              >
                                <TableCell className="py-2">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm">{expense.category}</span>
                                      {isMissingSlip && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <FileWarning className="h-3.5 w-3.5 text-rose-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Missing slip/attachment</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                    {expense.sub_category && (
                                      <span className="text-xs text-muted-foreground">{expense.sub_category}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right font-medium tabular-nums text-sm">
                                  {formatCurrency(expense.amount, expense.currency || 'USD')}
                                </TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground">
                                  {formatDate(expense.date)}
                                </TableCell>
                                <TableCell className="py-2">
                                  {isMissingSlip ? (
                                    <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300 gap-1">
                                      <FileWarning className="w-3 h-3" />
                                      No Slip
                                    </Badge>
                                  ) : getStatusBadge(expense)}
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-0.5">
                                    {!expense.is_flagged && expense.investigation_status !== 'resolved' && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => setCostToApprove(expense)}
                                        title="Verify Cost"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    {hasUnresolvedFlag && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-amber-600"
                                        onClick={() => handleResolveFlag(expense)}
                                        title="Resolve Flag"
                                      >
                                        <Flag className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(expense)}
                                      title="Edit"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => setCostToDelete(expense)}
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );})}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {editingCost && (
            <CostForm
              tripId={editingCost.trip_id || ''}
              cost={editingCost as import('@/types/forms').Cost}
              onSubmit={(success) => {
                if (success) {
                  setShowEditDialog(false);
                  setEditingCost(null);
                  refetch();
                  queryClient.invalidateQueries({ queryKey: ['cost-entries'] });
                }
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingCost(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Flag Resolution Modal */}
      <FlagResolutionModal
        cost={selectedFlaggedCost}
        isOpen={showFlagModal}
        onClose={() => {
          setShowFlagModal(false);
          setSelectedFlaggedCost(null);
        }}
        onResolve={() => {
          const costId = selectedFlaggedCost?.id;
          const tripId = selectedFlaggedCost?.trip_id;

          // Optimistically update the cache so the item disappears without a full refetch
          if (costId) {
            queryClient.setQueriesData<ExpenseWithTrip[]>(
              { queryKey: ['all-expenses'] },
              (old) => old?.map(e =>
                e.id === costId
                  ? { ...e, investigation_status: 'resolved', resolved_at: new Date().toISOString() }
                  : e
              ),
            );
          }

          // Background refresh for consistency
          queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
          queryClient.invalidateQueries({ queryKey: ['cost-entries'] });
          setShowFlagModal(false);
          setSelectedFlaggedCost(null);
          // Resolve alert if all flagged costs for this trip are now resolved
          tryResolveFlaggedCostAlert(tripId);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!costToDelete} onOpenChange={() => setCostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
              {costToDelete?.is_flagged && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Warning: This expense is flagged and may require investigation.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Cost Confirmation Dialog */}
      <AlertDialog open={!!costToApprove} onOpenChange={() => setCostToApprove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Approve Cost
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to approve this cost entry?</p>
                {costToApprove && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{costToApprove.category}{costToApprove.sub_category ? ` – ${costToApprove.sub_category}` : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{formatCurrency(costToApprove.amount, costToApprove.currency || 'USD')}</span>
                    </div>
                    {costToApprove.flag_reason && (
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground">Flag Reason</span>
                        <p className="mt-1 text-amber-700 font-medium">{costToApprove.flag_reason}</p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">This will mark the cost as verified and approved.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveCost}
              disabled={isApproving}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isApproving ? 'Approving...' : 'Approve Cost'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verify No Costs Confirmation Dialog */}
      <AlertDialog open={!!tripToVerifyNoCosts} onOpenChange={() => setTripToVerifyNoCosts(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify Trip Has No Costs</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to mark <strong>POD #{tripToVerifyNoCosts?.trip_number}</strong> as verified with no costs.
              <span className="block mt-2">
                This confirms that this trip intentionally has no expenses recorded, and it will be removed from the "Needs Attention" list.
              </span>
              <span className="block mt-2 text-muted-foreground text-sm">
                Route: {tripToVerifyNoCosts?.origin && tripToVerifyNoCosts?.destination 
                  ? `${tripToVerifyNoCosts.origin} → ${tripToVerifyNoCosts.destination}` 
                  : tripToVerifyNoCosts?.route || 'No route'}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleVerifyNoCosts} 
              disabled={isVerifying}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isVerifying ? 'Verifying...' : 'Confirm - No Costs'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TripExpensesSection;