import Layout from "@/components/Layout";
import { getFleetSubcategory, FLEET_SUBCATEGORY_META, type FleetSubcategory } from "@/utils/fleetCategories";
import AddJobCardDialog from "@/components/dialogs/AddJobCardDialog";
import JobCardDetailsDialog from "@/components/dialogs/JobCardDetailsDialog";
import JobCardWeeklyCostReport from "@/components/maintenance/JobCardWeeklyCostReport";
import JobCardNotesPopover from "@/components/jobCards/JobCardNotesPopover";
import JobCardFollowUpsPopover from "@/components/jobCards/JobCardFollowUpsPopover";
import JobCardFollowUpsTab from "@/components/jobCards/JobCardFollowUpsTab";
import TyreJobCardsTab from "@/components/jobCards/TyreJobCardsTab";
import WorkerDashboardDialog from "@/components/jobCards/WorkerDashboardDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronDown,
  Download,
  Eye,
  FileText,
  ListPlus,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Archive as ArchiveIcon,
  ArchiveRestore,
  Trash2,
  Truck,
  User,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Local type definitions
type Database = {
  public: {
    Tables: {
      job_cards: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string | null;
          job_number: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          assignee: string | null;
          due_date: string | null;
          vehicle_id: string | null;
          inspection_id: string | null;
          archived_at: string | null;
        };
      };
      vehicle_inspections: {
        Row: {
          id: string;
          inspection_number: string;
          inspection_type: string;
          inspection_date: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          fleet_number: string | null;
          registration_number: string;
        };
      };
      parts_requests: {
        Row: {
          job_card_id: string | null;
          part_name: string | null;
          ir_number: string | null;
          created_at: string;
          ordered_at: string | null;
        };
      };
      job_card_notes: {
        Row: {
          job_card_id: string;
          note: string;
          created_by: string;
        };
      };
      action_items: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          priority: string;
          due_date: string | null;
          assigned_to: string | null;
          status: string;
          category: string;
          related_entity_type: string;
          related_entity_id: string;
          created_by: string;
        };
      };
    };
  };
};

type BaseJobCard = Database["public"]["Tables"]["job_cards"]["Row"];
type VehicleInspectionRow = Pick<
  Database["public"]["Tables"]["vehicle_inspections"]["Row"],
  "id" | "inspection_number" | "inspection_type" | "inspection_date"
>;
type PartRequestLinkRow = Pick<
  Database["public"]["Tables"]["parts_requests"]["Row"],
  "job_card_id" | "part_name" | "ir_number" | "created_at" | "ordered_at"
>;

type JobCardPartsSummary = {
  count: number;
  latestIrNumber: string | null;
  latestPartName: string | null;
};

type JobCard = BaseJobCard & {
  vehicle?: {
    id: string;
    fleet_number: string | null;
    registration_number: string;
  } | null;
  inspection?: VehicleInspectionRow | null;
  partsSummary?: JobCardPartsSummary;
  notesCount?: number;
  followUpCount?: number;
};

type FleetCategory = {
  name: string;
  color: string;
  order: number;
};

const JobCards = () => {
  const { userName } = useAuth();
  const navigate = useNavigate();
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewInitialEditMode, setViewInitialEditMode] = useState(false);
  const [workerDashboardJob, setWorkerDashboardJob] = useState<JobCard | null>(null);
  const [workerDashboardOpen, setWorkerDashboardOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [jobToArchive, setJobToArchive] = useState<JobCard | null>(null);
  const [closedArchivedFleets, setClosedArchivedFleets] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobCard | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [externalTaskDialogOpen, setExternalTaskDialogOpen] = useState(false);
  const [actionTargetJob, setActionTargetJob] = useState<JobCard | null>(null);
  const [commentText, setCommentText] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDescription, setFollowUpDescription] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState("medium");
  const [followUpAssignee, setFollowUpAssignee] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const { toast } = useToast();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [closedActiveFleets, setClosedActiveFleets] = useState<Set<string>>(new Set());
  const [closedCompletedFleets, setClosedCompletedFleets] = useState<Set<string>>(new Set());
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("job-cards");

  // Category definitions derived from shared utility
  const categories: Record<FleetSubcategory, FleetCategory> = Object.fromEntries(
    Object.entries(FLEET_SUBCATEGORY_META).map(([key, meta]) => [
      key,
      { name: meta.label, color: meta.color, order: meta.order },
    ])
  ) as Record<FleetSubcategory, FleetCategory>;

  // Helper function to categorize fleet numbers using suffix-based utility
  const getFleetCategory = (fleetNumber: string | null): FleetSubcategory => {
    if (!fleetNumber || fleetNumber === "__no_fleet__") return "UNASSIGNED";
    return getFleetSubcategory(fleetNumber);
  };

  // Extract numeric part from fleet number for sorting
  const getFleetNumber = (fleetNumber: string | null): number => {
    if (!fleetNumber) return 999999;
    const match = fleetNumber.match(/\d+/);
    return match ? parseInt(match[0]) : 999999;
  };

  // Group and sort cards by category and fleet
  const groupCardsByCategory = (cards: JobCard[]): Map<string, Map<string, JobCard[]>> => {
    const grouped = new Map<string, Map<string, JobCard[]>>();

    // Initialize categories
    Object.keys(categories).forEach(category => {
      grouped.set(category, new Map<string, JobCard[]>());
    });

    // First, sort all cards by their numeric fleet value
    const sortedCards = [...cards].sort((a, b) => {
      const aNum = getFleetNumber(a.vehicle?.fleet_number || null);
      const bNum = getFleetNumber(b.vehicle?.fleet_number || null);
      return aNum - bNum;
    });

    // Group cards by category and fleet
    sortedCards.forEach(card => {
      const fleetNumber = card.vehicle?.fleet_number;
      const category = getFleetCategory(fleetNumber || null);
      const fleetKey = fleetNumber || "__no_fleet__";

      const categoryMap = grouped.get(category);
      if (categoryMap) {
        if (!categoryMap.has(fleetKey)) {
          categoryMap.set(fleetKey, []);
        }
        categoryMap.get(fleetKey)!.push(card);
      }
    });

    // Sort fleets within each category numerically
    grouped.forEach((categoryMap, category) => {
      const sortedEntries = Array.from(categoryMap.entries()).sort(([aKey], [bKey]) => {
        const aNum = getFleetNumber(aKey === "__no_fleet__" ? null : aKey);
        const bNum = getFleetNumber(bKey === "__no_fleet__" ? null : bKey);
        return aNum - bNum;
      });

      const sortedMap = new Map<string, JobCard[]>(sortedEntries);
      grouped.set(category, sortedMap);
    });

    return grouped;
  };

  // Fetch inspector profiles for assignee dropdown
  const { data: inspectorProfiles = [] } = useQuery({
    queryKey: ["inspector_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspector_profiles")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch job cards with vehicle data
  const { data: jobCards = [], refetch, isLoading, error: queryError } = useQuery({
    queryKey: ["job_cards_with_vehicles"],
    queryFn: async () => {
      const { data: baseJobCards, error: baseCardsError } = await supabase
        .from("job_cards")
        .select("*")
        .order("created_at", { ascending: false });

      if (baseCardsError) {
        throw baseCardsError;
      }

      const cards = baseJobCards || [];

      if (cards.length === 0) {
        return [] as JobCard[];
      }

      const vehicleIds = [...new Set(cards.map(card => card.vehicle_id).filter((id): id is string => Boolean(id)))];
      const inspectionIds = [...new Set(cards.map(card => card.inspection_id).filter((id): id is string => Boolean(id)))];
      const jobCardIds = cards.map(card => card.id);

      let vehiclesData: Pick<Database["public"]["Tables"]["vehicles"]["Row"], "id" | "fleet_number" | "registration_number">[] = [];
      let inspectionsData: VehicleInspectionRow[] = [];
      let partsLinkData: PartRequestLinkRow[] = [];
      let notesData: { job_card_id: string }[] = [];

      if (vehicleIds.length > 0) {
        const { data, error } = await supabase
          .from("vehicles")
          .select("id, fleet_number, registration_number")
          .in("id", vehicleIds);

        if (error) {
          throw error;
        }

        vehiclesData = data || [];
      }

      if (inspectionIds.length > 0) {
        const { data, error } = await supabase
          .from("vehicle_inspections")
          .select("id, inspection_number, inspection_type, inspection_date")
          .in("id", inspectionIds);

        if (error) {
          throw error;
        }

        inspectionsData = (data || []) as VehicleInspectionRow[];
      }

      if (jobCardIds.length > 0) {
        const { data, error } = await supabase
          .from("parts_requests")
          .select("job_card_id, part_name, ir_number, created_at, ordered_at")
          .in("job_card_id", jobCardIds);

        if (error) {
          throw error;
        }

        partsLinkData = (data || []) as PartRequestLinkRow[];
      }

      if (jobCardIds.length > 0) {
        const { data, error } = await supabase
          .from("job_card_notes")
          .select("job_card_id")
          .in("job_card_id", jobCardIds);

        if (error) {
          throw error;
        }

        notesData = (data || []) as { job_card_id: string }[];
      }

      const notesCountMap = new Map<string, number>();
      for (const note of notesData) {
        notesCountMap.set(note.job_card_id, (notesCountMap.get(note.job_card_id) || 0) + 1);
      }

      let followUpData: { related_entity_id: string | null }[] = [];
      if (jobCardIds.length > 0) {
        const { data, error } = await supabase
          .from("action_items")
          .select("related_entity_id")
          .eq("related_entity_type", "job_card")
          .eq("category", "external_follow_up")
          .in("related_entity_id", jobCardIds);

        if (error) {
          throw error;
        }

        followUpData = (data || []) as { related_entity_id: string | null }[];
      }

      const followUpCountMap = new Map<string, number>();
      for (const fu of followUpData) {
        if (fu.related_entity_id) {
          followUpCountMap.set(fu.related_entity_id, (followUpCountMap.get(fu.related_entity_id) || 0) + 1);
        }
      }

      const vehicleMap = new Map(
        (vehiclesData || []).map(v => [v.id, v])
      );

      const inspectionMap = new Map(
        inspectionsData.map(inspection => [inspection.id, inspection])
      );

      const partsSummaryRaw = new Map<string, JobCardPartsSummary & { latestTimestamp: number }>();

      for (const part of partsLinkData) {
        if (!part.job_card_id) {
          continue;
        }

        const existingSummary = partsSummaryRaw.get(part.job_card_id) || {
          count: 0,
          latestIrNumber: null,
          latestPartName: null,
          latestTimestamp: 0,
        };

        existingSummary.count += 1;

        const candidateDate = part.ordered_at || part.created_at;
        const candidateTimestamp = candidateDate ? new Date(candidateDate).getTime() : 0;

        if (candidateTimestamp >= existingSummary.latestTimestamp) {
          existingSummary.latestTimestamp = candidateTimestamp;
          existingSummary.latestPartName = part.part_name || null;
          existingSummary.latestIrNumber = part.ir_number || null;
        } else {
          if (!existingSummary.latestPartName && part.part_name) {
            existingSummary.latestPartName = part.part_name;
          }
          if (!existingSummary.latestIrNumber && part.ir_number) {
            existingSummary.latestIrNumber = part.ir_number;
          }
        }

        partsSummaryRaw.set(part.job_card_id, existingSummary);
      }

      const partsSummaryMap = new Map<string, JobCardPartsSummary>(
        [...partsSummaryRaw.entries()].map(([jobCardId, summary]) => [
          jobCardId,
          {
            count: summary.count,
            latestIrNumber: summary.latestIrNumber,
            latestPartName: summary.latestPartName,
          },
        ])
      );

      // Map job cards with vehicle data
      return cards.map(item => ({
        ...item,
        vehicle: item.vehicle_id ? vehicleMap.get(item.vehicle_id) || null : null,
        inspection: item.inspection_id ? inspectionMap.get(item.inspection_id) || null : null,
        partsSummary: partsSummaryMap.get(item.id) || {
          count: 0,
          latestIrNumber: null,
          latestPartName: null,
        },
        notesCount: notesCountMap.get(item.id) || 0,
        followUpCount: followUpCountMap.get(item.id) || 0,
      })) as JobCard[];
    },
  });

  // Get unique assignees for filter (exclude null, undefined, and empty strings)
  const assignees = [...new Set(
    jobCards
      .map(card => card.assignee)
      .filter((a): a is string => a !== null && a !== undefined && a !== "")
  )].sort();

  // Base filter (search, priority, assignee)
  const baseFilteredCards = jobCards.filter((card) => {
    // Exclude tyre job cards from the main tab (they have their own tab)
    if (card.inspection?.inspection_type === "tyre") return false;
    if (searchTerm && !card.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !card.job_number.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedPriority !== "all" && card.priority !== selectedPriority) {
      return false;
    }
    if (selectedAssignee !== "all" && card.assignee !== selectedAssignee) {
      return false;
    }
    return true;
  });

  // Group by status (case-insensitive to handle any database variations)
  // Archived cards are excluded from active/completed and shown in their own tab.
  const nonArchivedCards = baseFilteredCards.filter(card => !(card as JobCard & { archived_at?: string | null }).archived_at);
  const allActiveCards = nonArchivedCards.filter(card => {
    const status = card.status?.toLowerCase();
    return status === "pending" || status === "in_progress" || status === "in progress";
  });
  const allCompletedCards = nonArchivedCards.filter(card => card.status?.toLowerCase() === "completed");
  const allArchivedCards = baseFilteredCards.filter(card => !!(card as JobCard & { archived_at?: string | null }).archived_at);

  // Collapse all fleet sections by default on initial load
  const hasInitialCollapse = useRef(false);
  useEffect(() => {
    if (hasInitialCollapse.current) return;
    if (allActiveCards.length === 0 && allCompletedCards.length === 0) return;
    hasInitialCollapse.current = true;

    const allFleetKeys = new Set<string>();
    const collectFleets = (cards: JobCard[]) => {
      const grouped = groupCardsByCategory(cards);
      grouped.forEach((fleetMap) => {
        fleetMap.forEach((_, fleetKey) => allFleetKeys.add(fleetKey));
      });
    };
    collectFleets(allActiveCards);
    collectFleets(allCompletedCards);

    setClosedActiveFleets(new Set(allFleetKeys));
    setClosedCompletedFleets(new Set(allFleetKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActiveCards, allCompletedCards]);

  const toggleActiveFleet = (fleet: string) => {
    setClosedActiveFleets(prev => {
      const next = new Set(prev);
      if (next.has(fleet)) next.delete(fleet);
      else next.add(fleet);
      return next;
    });
  };

  const toggleCompletedFleet = (fleet: string) => {
    setClosedCompletedFleets(prev => {
      const next = new Set(prev);
      if (next.has(fleet)) next.delete(fleet);
      else next.add(fleet);
      return next;
    });
  };

  const toggleArchivedFleet = (fleet: string) => {
    setClosedArchivedFleets(prev => {
      const next = new Set(prev);
      if (next.has(fleet)) next.delete(fleet);
      else next.add(fleet);
      return next;
    });
  };

  const exportJobCardsToExcel = useCallback(async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Car Craft Co Fleet Management';
      wb.created = new Date();

      const hFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
      const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' };
      const hAlign: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const bdr: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
        left: { style: 'thin', color: { argb: 'D9D9D9' } },
        right: { style: 'thin', color: { argb: 'D9D9D9' } },
      };
      const zFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F6FC' } };
      const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };

      const styleHeader = (ws: ExcelJS.Worksheet, rowNum: number) => {
        const r = ws.getRow(rowNum);
        r.eachCell(c => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
        r.height = 28;
      };
      const autoWidth = (ws: ExcelJS.Worksheet) => {
        ws.columns.forEach(col => {
          let m = 12;
          col.eachCell?.({ includeEmpty: false }, c => {
            const l = c.value ? String(c.value).length + 2 : 0;
            if (l > m) m = l;
          });
          col.width = Math.min(m, 40);
        });
      };

      const ws = wb.addWorksheet('Job Cards');
      ws.mergeCells('A1:I1');
      const tc = ws.getCell('A1');
      tc.value = 'JOB CARDS REPORT';
      tc.font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      ws.getRow(1).height = 32;

      ws.mergeCells('A2:I2');
      const sc = ws.getCell('A2');
      sc.value = `Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })} \u2022 Car Craft Co Fleet Management`;
      sc.font = { italic: true, size: 9, color: { argb: '666666' }, name: 'Calibri' };

      const headers = ['Job #', 'Title', 'Fleet #', 'Registration', 'Status', 'Priority', 'Assignee', 'Due Date', 'Created'];
      ws.getRow(4).values = headers;
      styleHeader(ws, 4);

      const allCards = [...allActiveCards, ...allCompletedCards];
      allCards.forEach((card, i) => {
        const row = ws.getRow(i + 5);
        row.values = [
          card.job_number,
          card.title,
          card.vehicle?.fleet_number || '',
          card.vehicle?.registration_number || '',
          card.status,
          card.priority,
          card.assignee || '',
          card.due_date ? new Date(card.due_date).toLocaleDateString('en-ZA') : '',
          card.created_at ? new Date(card.created_at).toLocaleDateString('en-ZA') : '',
        ];
        row.eachCell(c => { c.border = bdr; c.font = bodyFont; c.alignment = { vertical: 'middle' }; });
        if (i % 2 === 1) row.eachCell(c => { c.fill = zFill; });

        const statusCell = row.getCell(5);
        const status = card.status?.toLowerCase();
        if (status === 'completed') {
          statusCell.font = { ...bodyFont, color: { argb: '16A34A' }, bold: true };
        } else if (status === 'in_progress' || status === 'in progress') {
          statusCell.font = { ...bodyFont, color: { argb: '2563EB' }, bold: true };
        } else if (status === 'pending') {
          statusCell.font = { ...bodyFont, color: { argb: 'D97706' }, bold: true };
        }

        const prioCell = row.getCell(6);
        if (card.priority === 'critical') {
          prioCell.font = { ...bodyFont, color: { argb: 'DC2626' }, bold: true };
        } else if (card.priority === 'high') {
          prioCell.font = { ...bodyFont, color: { argb: 'EA580C' }, bold: true };
        }
      });

      ws.autoFilter = { from: 'A4', to: `I${allCards.length + 4}` };
      ws.views = [{ state: 'frozen', ySplit: 4 }];
      autoWidth(ws);

      const sWs = wb.addWorksheet('Summary');
      sWs.mergeCells('A1:B1');
      sWs.getCell('A1').value = 'JOB CARDS SUMMARY';
      sWs.getCell('A1').font = { bold: true, size: 16, color: { argb: '1F3864' }, name: 'Calibri' };
      sWs.getRow(1).height = 32;

      sWs.getRow(3).values = ['Metric', 'Count'];
      styleHeader(sWs, 3);

      const summaryRows: [string, number][] = [
        ['Total Job Cards', allCards.length],
        ['Active (Pending + In Progress)', allActiveCards.length],
        ['Completed', allCompletedCards.length],
        ['Critical Priority', allCards.filter(c => c.priority === 'critical').length],
        ['High Priority', allCards.filter(c => c.priority === 'high').length],
        ['Medium Priority', allCards.filter(c => c.priority === 'medium').length],
        ['Low Priority', allCards.filter(c => c.priority === 'low').length],
      ];

      summaryRows.forEach((r, i) => {
        const row = sWs.getRow(4 + i);
        row.values = [r[0], r[1]];
        row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
        row.getCell(2).font = { size: 10, name: 'Calibri' };
        row.eachCell(c => { c.border = bdr; });
        if (i % 2 === 1) row.eachCell(c => { c.fill = zFill; });
      });
      sWs.getColumn(1).width = 30;
      sWs.getColumn(2).width = 15;

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Job_Cards_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Export Successful', description: `${allCards.length} job cards exported to Excel.` });
    } catch (error) {
      console.error('Export failed:', error);
      toast({ title: 'Export Failed', description: 'Unable to export job cards.', variant: 'destructive' });
    }
  }, [allActiveCards, allCompletedCards, toast]);

  const exportJobCardsToPDF = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Job Cards Report', 14, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const allCards = [...allActiveCards, ...allCompletedCards];
      doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })} | Total: ${allCards.length} | Active: ${allActiveCards.length} | Completed: ${allCompletedCards.length}`, 14, 25);

      autoTable(doc, {
        startY: 32,
        head: [['Job #', 'Title', 'Fleet', 'Reg #', 'Status', 'Priority', 'Assignee', 'Due Date']],
        body: allCards.map(card => [
          card.job_number,
          card.title.length > 35 ? card.title.substring(0, 35) + '...' : card.title,
          card.vehicle?.fleet_number || '-',
          card.vehicle?.registration_number || '-',
          card.status,
          card.priority,
          card.assignee || '-',
          card.due_date ? new Date(card.due_date).toLocaleDateString('en-ZA') : '-',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [31, 56, 100], fontSize: 8, font: 'helvetica' },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 55 },
          2: { cellWidth: 18 },
          3: { cellWidth: 28 },
          4: { cellWidth: 22 },
          5: { cellWidth: 18 },
          6: { cellWidth: 30 },
          7: { cellWidth: 22 },
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${pageCount} | Car Craft Co Fleet Management`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      }

      doc.save(`Job_Cards_${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'PDF Generated', description: `${allCards.length} job cards exported as PDF.` });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({ title: 'Export Failed', description: 'Unable to generate PDF.', variant: 'destructive' });
    }
  }, [allActiveCards, allCompletedCards, toast]);

  const handleJobClick = (job: JobCard) => {
    setSelectedJob(job);
    setViewInitialEditMode(false);
    setDialogOpen(true);
  };

  const openViewDialog = (job: JobCard) => {
    setSelectedJob(job);
    setViewInitialEditMode(false);
    setDialogOpen(true);
  };

  const openUpdateDialog = (job: JobCard) => {
    setSelectedJob(job);
    setViewInitialEditMode(true);
    setDialogOpen(true);
  };

  const openWorkerDashboard = (job: JobCard) => {
    setWorkerDashboardJob(job);
    setWorkerDashboardOpen(true);
  };

  const openShareDialog = (job: JobCard) => {
    // Share dialog needs the full export data which is built on the details page.
    // Navigate there with ?share=1 to auto-open it.
    navigate(`/job-card/${job.id}?share=1`);
  };

  const handleArchiveClick = (job: JobCard) => {
    setJobToArchive(job);
    setArchiveDialogOpen(true);
  };

  const handleDeleteClick = (job: JobCard) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const openCommentDialog = (job: JobCard) => {
    setActionTargetJob(job);
    setCommentText("");
    setCommentDialogOpen(true);
  };

  const openExternalFollowUpDialog = (job: JobCard) => {
    setActionTargetJob(job);
    setFollowUpTitle(`Follow-up: #${job.job_number} ${job.title}`);
    setFollowUpDescription("");
    setFollowUpPriority("medium");
    setFollowUpAssignee("");
    setFollowUpDueDate("");
    setExternalTaskDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from("job_cards")
        .delete()
        .eq("id", jobToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Job card #${jobToDelete.job_number} has been deleted`,
      });
      requestGoogleSheetsSync('workshop');
      refetch();
    } catch (error) {
      console.error("Error deleting job card:", error);
      toast({
        title: "Error",
        description: "Failed to delete job card",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!jobToArchive) return;
    const isCurrentlyArchived = !!(jobToArchive as JobCard & { archived_at?: string | null }).archived_at;
    try {
      const { error } = await supabase
        .from("job_cards")
        .update({ archived_at: isCurrentlyArchived ? null : new Date().toISOString() } as never)
        .eq("id", jobToArchive.id);

      if (error) throw error;

      toast({
        title: isCurrentlyArchived ? "Restored" : "Archived",
        description: isCurrentlyArchived
          ? `Job card #${jobToArchive.job_number} has been restored.`
          : `Job card #${jobToArchive.job_number} has been archived.`,
      });
      requestGoogleSheetsSync('workshop');
      refetch();
    } catch (error) {
      console.error("Error archiving job card:", error);
      toast({
        title: "Error",
        description: "Failed to update archive status",
        variant: "destructive",
      });
    } finally {
      setArchiveDialogOpen(false);
      setJobToArchive(null);
    }
  };

  const handleAddComment = async () => {
    if (!actionTargetJob || !commentText.trim()) {
      return;
    }

    try {
      setIsSubmittingComment(true);

      const { error } = await supabase.from("job_card_notes").insert({
        job_card_id: actionTargetJob.id,
        note: commentText.trim(),
        created_by: userName || "Unknown User",
      });

      if (error) throw error;

      toast({
        title: "Comment added",
        description: `Comment saved for job #${actionTargetJob.job_number}`,
      });

      setCommentDialogOpen(false);
      setCommentText("");
      setActionTargetJob(null);
      refetch();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCreateExternalFollowUp = async () => {
    if (!actionTargetJob || !followUpTitle.trim()) {
      return;
    }

    try {
      setIsSubmittingFollowUp(true);

      const { error } = await supabase.from("action_items").insert({
        title: followUpTitle.trim(),
        description: followUpDescription.trim() || null,
        priority: followUpPriority,
        due_date: followUpDueDate || null,
        assigned_to: followUpAssignee.trim() || null,
        status: "pending",
        category: "external_follow_up",
        related_entity_type: "job_card",
        related_entity_id: actionTargetJob.id,
        created_by: userName || "Unknown User",
      });

      if (error) throw error;

      toast({
        title: "Follow-up created",
        description: `External follow-up linked to job #${actionTargetJob.job_number}`,
      });

      setExternalTaskDialogOpen(false);
      setActionTargetJob(null);
      refetch();
    } catch (error) {
      console.error("Error creating external follow-up:", error);
      toast({
        title: "Error",
        description: "Failed to create external follow-up",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge>Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "in_progress":
      case "in progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "on_hold":
      case "on hold":
        return <Badge className="bg-yellow-500">On Hold</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const JobCardTable = ({ cards, emptyMessage }: { cards: JobCard[]; emptyMessage: string }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 px-3 py-2 text-xs w-[90px]">Job #</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Title</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Fleet / Vehicle</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Status</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Priority</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Assignee</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Due</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs">Links</TableHead>
            <TableHead className="h-9 px-3 py-2 text-xs w-[60px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow
              key={card.id}
              className="cursor-pointer border-b transition-colors hover:bg-muted/30"
              onClick={() => handleJobClick(card)}
            >
              <TableCell className="px-3 py-2 font-mono text-xs">#{card.job_number}</TableCell>
              <TableCell className="px-3 py-2 max-w-[260px]">
                <p className="font-medium text-sm leading-tight truncate">{card.title}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Created {new Date(card.created_at).toLocaleDateString()}
                </p>
              </TableCell>
              <TableCell className="px-3 py-2">
                {card.vehicle ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                    {card.vehicle.fleet_number && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                        {card.vehicle.fleet_number}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground truncate">
                      {card.vehicle.registration_number}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2">{getStatusBadge(card.status)}</TableCell>
              <TableCell className="px-3 py-2">{getPriorityBadge(card.priority)}</TableCell>
              <TableCell className="px-3 py-2">
                {card.assignee ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[120px]">{card.assignee}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2">
                {card.due_date ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>{new Date(card.due_date).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                  {card.inspection ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 leading-none bg-blue-50 text-blue-700 border-blue-200">
                      <FileText className="h-2.5 w-2.5 mr-1" />
                      {card.inspection.inspection_number}
                    </Badge>
                  ) : card.inspection_id ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 leading-none bg-blue-50 text-blue-700 border-blue-200">
                      <FileText className="h-2.5 w-2.5 mr-1" />
                      Linked
                    </Badge>
                  ) : null}
                  {card.notesCount && card.notesCount > 0 ? (
                    <JobCardNotesPopover
                      jobCardId={card.id}
                      jobNumber={card.job_number}
                      notesCount={card.notesCount}
                    />
                  ) : null}
                  {card.followUpCount && card.followUpCount > 0 ? (
                    <JobCardFollowUpsPopover
                      jobCardId={card.id}
                      jobNumber={card.job_number}
                      followUpCount={card.followUpCount}
                    />
                  ) : null}
                  {card.partsSummary && card.partsSummary.count > 0 ? (
                    <>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 leading-none">
                        {card.partsSummary.count}P
                      </Badge>
                      {card.partsSummary.latestIrNumber && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 leading-none bg-emerald-50 text-emerald-700 border-emerald-200">
                          IR {card.partsSummary.latestIrNumber}
                        </Badge>
                      )}
                    </>
                  ) : null}
                  {!card.inspection && !card.inspection_id && !card.notesCount && !card.followUpCount && !card.partsSummary?.count && (
                    <span className="text-muted-foreground text-[10px]">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openWorkerDashboard(card)}>
                      <Users className="h-4 w-4 mr-2" />
                      Worker Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openViewDialog(card)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openUpdateDialog(card)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Update
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openShareDialog(card)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openCommentDialog(card)}>
                      <MessageSquarePlus className="h-4 w-4 mr-2" />
                      Add Comment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openExternalFollowUpDialog(card)}>
                      <ListPlus className="h-4 w-4 mr-2" />
                      Add External Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleArchiveClick(card)}>
                      {(card as JobCard & { archived_at?: string | null }).archived_at ? (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore
                        </>
                      ) : (
                        <>
                          <ArchiveIcon className="h-4 w-4 mr-2" />
                          Archive
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeleteClick(card)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Job Card
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {cards.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const FleetAccordionSection = ({
    fleetLabel,
    cards,
    isOpen,
    onToggle,
    statusVariant,
  }: {
    fleetLabel: string;
    cards: JobCard[];
    isOpen: boolean;
    onToggle: () => void;
    statusVariant: "active" | "completed";
  }) => (
    <div className="border border-border/70 rounded-md overflow-hidden bg-background">
      <button
        type="button"
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150 bg-muted/30 hover:bg-muted/60 border-l-2 ${statusVariant === "active" ? "border-l-foreground/70" : "border-l-border"}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-none truncate">{fleetLabel}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {cards.length} {cards.length === 1 ? "job card" : "job cards"}
            </p>
          </div>
          <Badge variant="outline" className="ml-1 text-[10px] font-semibold px-1.5 py-0 h-5 leading-none tabular-nums">
            {cards.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[11px] hidden sm:inline select-none uppercase tracking-wide">{isOpen ? "Hide" : "Show"}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border/60 bg-background">
          <JobCardTable cards={cards} emptyMessage={`No job cards for ${fleetLabel}`} />
        </div>
      )}
    </div>
  );

  const renderCategorySection = (
    category: string,
    fleetMap: Map<string, JobCard[]>,
    isActive: boolean,
    closedFleets: Set<string>,
    toggleFleet: (fleet: string) => void
  ) => {
    if (fleetMap.size === 0) return null;

    const categoryInfo = categories[category];
    const totalCards = Array.from(fleetMap.values()).reduce((sum, cards) => sum + cards.length, 0);

    return (
      <div key={category} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{categoryInfo.name}</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 leading-none tabular-nums font-semibold">
            {totalCards}
          </Badge>
        </div>
        <div className="space-y-3">
          {Array.from(fleetMap.entries()).map(([fleetKey, cards]) => {
            const fleetLabel = fleetKey === "__no_fleet__"
              ? "Unassigned — No Fleet"
              : `Fleet ${fleetKey}`;
            return (
              <FleetAccordionSection
                key={`${category}-${fleetKey}`}
                fleetLabel={fleetLabel}
                cards={cards}
                isOpen={!closedFleets.has(fleetKey)}
                onToggle={() => toggleFleet(fleetKey)}
                statusVariant={isActive ? "active" : "completed"}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-3 sm:p-8 space-y-5 sm:space-y-7">
        {(isLoading || queryError) && (
          <div>
            {isLoading && <p className="text-xs text-muted-foreground">Loading job cards…</p>}
            {queryError && <p className="text-xs text-destructive">Error: {String(queryError)}</p>}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:max-w-5xl sm:grid-cols-6">
              <TabsTrigger value="job-cards" className="px-5 py-2.5 text-base whitespace-nowrap">
                Job Cards
              </TabsTrigger>
              <TabsTrigger value="cost-reports" className="px-5 py-2.5 text-base whitespace-nowrap">
                Cost Reports
              </TabsTrigger>
              <TabsTrigger value="follow-ups" className="px-5 py-2.5 text-base whitespace-nowrap">
                Follow-ups
              </TabsTrigger>
              <TabsTrigger value="tyre-job-cards" className="px-5 py-2.5 text-base whitespace-nowrap">
                Tyre Job Cards
              </TabsTrigger>
              <TabsTrigger value="tyre-costs" className="px-5 py-2.5 text-base whitespace-nowrap">
                Tyre Costs
              </TabsTrigger>
              <TabsTrigger value="archived" className="px-5 py-2.5 text-base whitespace-nowrap">
                Archived
                {allArchivedCards.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{allArchivedCards.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="job-cards" className="space-y-6 mt-6">
            {/* Refined toolbar: KPI chips + filters + actions */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                {/* KPI chips */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    <span className="text-base font-semibold tabular-nums leading-none">{allActiveCards.length}</span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    <span className="text-base font-semibold tabular-nums leading-none">{allCompletedCards.length}</span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completed</span>
                  </div>
                </div>

                <div className="hidden sm:block h-5 w-px bg-border/70" />

                {/* Filters inline */}
                <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-[280px]">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search job cards..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 pl-8 text-xs bg-background"
                  />
                </div>

                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger className="h-9 w-[130px] text-xs bg-background">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>

                {assignees.length > 0 && (
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger className="h-9 w-[140px] text-xs bg-background">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {assignees.map((assignee) => (
                        <SelectItem key={assignee} value={assignee}>
                          {assignee}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Spacer to push actions right */}
                <div className="flex-1" />

                {/* Export + Add buttons */}
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={exportJobCardsToExcel} className="h-9 gap-1.5 text-xs px-3 bg-background">
                    <Download className="w-3.5 h-3.5" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportJobCardsToPDF} className="h-9 gap-1.5 text-xs px-3 bg-background">
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                  </Button>
                  <Button size="sm" className="h-9 gap-1.5 text-xs px-3.5 shadow-sm" onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New Job Card
                  </Button>
                </div>
              </div>
            </div>

            {/* Active Job Cards (Pending + In Progress) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Active</h2>
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                    {allActiveCards.length}
                  </span>
                </div>
                {allActiveCards.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      onClick={() => setClosedActiveFleets(new Set())}
                    >
                      Expand all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      onClick={() => {
                        const allFleets = new Set<string>();
                        const grouped = groupCardsByCategory(allActiveCards);
                        grouped.forEach((fleetMap) => {
                          fleetMap.forEach((_, fleetKey) => {
                            allFleets.add(fleetKey);
                          });
                        });
                        setClosedActiveFleets(allFleets);
                      }}
                    >
                      Collapse all
                    </Button>
                  </div>
                )}
              </div>
              {allActiveCards.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-sm font-medium">No active job cards</p>
                  <p className="text-xs mt-1">No results match the current filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(categories)
                    .sort((a, b) => categories[a].order - categories[b].order)
                    .map(category =>
                      renderCategorySection(
                        category,
                        groupCardsByCategory(allActiveCards).get(category) || new Map(),
                        true,
                        closedActiveFleets,
                        toggleActiveFleet
                      )
                    )}
                </div>
              )}
            </section>

            {/* Completed Job Cards */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Completed</h2>
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                    {allCompletedCards.length}
                  </span>
                </div>
                {allCompletedCards.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      onClick={() => setClosedCompletedFleets(new Set())}
                    >
                      Expand all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      onClick={() => {
                        const allFleets = new Set<string>();
                        const grouped = groupCardsByCategory(allCompletedCards);
                        grouped.forEach((fleetMap) => {
                          fleetMap.forEach((_, fleetKey) => {
                            allFleets.add(fleetKey);
                          });
                        });
                        setClosedCompletedFleets(allFleets);
                      }}
                    >
                      Collapse all
                    </Button>
                  </div>
                )}
              </div>
              {allCompletedCards.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-sm font-medium">No completed job cards</p>
                  <p className="text-xs mt-1">No results match the current filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(categories)
                    .sort((a, b) => categories[a].order - categories[b].order)
                    .map(category =>
                      renderCategorySection(
                        category,
                        groupCardsByCategory(allCompletedCards).get(category) || new Map(),
                        false,
                        closedCompletedFleets,
                        toggleCompletedFleet
                      )
                      )}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="cost-reports" className="mt-4">
            <JobCardWeeklyCostReport filter="exclude-tyre" />
          </TabsContent>

          <TabsContent value="follow-ups" className="mt-4">
            <JobCardFollowUpsTab />
          </TabsContent>

          <TabsContent value="tyre-job-cards" className="mt-4">
            <TyreJobCardsTab
              onJobCardClick={(card, editMode) => {
                setSelectedJob(card as unknown as JobCard);
                setViewInitialEditMode(!!editMode);
                setDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="tyre-costs" className="mt-4">
            <JobCardWeeklyCostReport filter="tyre-only" />
          </TabsContent>

          <TabsContent value="archived" className="space-y-4 mt-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
              <h2 className="text-base font-semibold tracking-tight text-foreground">Archived Job Cards</h2>
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                {allArchivedCards.length}
              </span>
            </div>
            {allArchivedCards.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-sm font-medium">No archived job cards</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(
                  allArchivedCards.reduce((map, card) => {
                    const fleet = card.fleet_number || "Unassigned";
                    if (!map.has(fleet)) map.set(fleet, []);
                    map.get(fleet)!.push(card);
                    return map;
                  }, new Map<string, JobCard[]>())
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([fleet, cards]) => (
                    <FleetAccordionSection
                      key={`archived-${fleet}`}
                      fleet={fleet}
                      cards={cards}
                      isOpen={!closedArchivedFleets.has(fleet)}
                      statusVariant="completed"
                      onToggle={() => toggleArchivedFleet(fleet)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <JobCardDetailsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          jobCard={selectedJob}
          onUpdate={refetch}
          initialEditMode={viewInitialEditMode}
        />

        <WorkerDashboardDialog
          open={workerDashboardOpen}
          onOpenChange={setWorkerDashboardOpen}
          jobCard={workerDashboardJob}
        />

        <AddJobCardDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
        />

        <Dialog
          open={commentDialogOpen}
          onOpenChange={(open) => {
            setCommentDialogOpen(open);
            if (!open) {
              setCommentText("");
              setActionTargetJob(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Comment</DialogTitle>
              <DialogDescription>
                {actionTargetJob
                  ? `Add a comment for job #${actionTargetJob.job_number} (${actionTargetJob.title}).`
                  : "Add a comment to this job card."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="job-card-comment">Comment</Label>
              <Textarea
                id="job-card-comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write context, questions, or update notes..."
                rows={5}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddComment} disabled={isSubmittingComment || !commentText.trim()}>
                {isSubmittingComment ? "Saving..." : "Save Comment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={externalTaskDialogOpen}
          onOpenChange={(open) => {
            setExternalTaskDialogOpen(open);
            if (!open) {
              setActionTargetJob(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create External Follow-up</DialogTitle>
              <DialogDescription>
                {actionTargetJob
                  ? `Create an external task/question linked to job #${actionTargetJob.job_number}.`
                  : "Create an external follow-up linked to this job card."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="follow-up-title">Title</Label>
                <Input
                  id="follow-up-title"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  placeholder="Enter follow-up title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="follow-up-description">Description</Label>
                <Textarea
                  id="follow-up-description"
                  value={followUpDescription}
                  onChange={(e) => setFollowUpDescription(e.target.value)}
                  placeholder="Describe the external question or request"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="follow-up-assignee">Assignee (optional)</Label>
                  <Select value={followUpAssignee} onValueChange={setFollowUpAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {inspectorProfiles.map((inspector) => (
                        <SelectItem key={inspector.id} value={inspector.name}>
                          {inspector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow-up-due-date">Due Date (optional)</Label>
                  <Input
                    id="follow-up-due-date"
                    type="date"
                    value={followUpDueDate}
                    onChange={(e) => setFollowUpDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={followUpPriority} onValueChange={setFollowUpPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExternalTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateExternalFollowUp} disabled={isSubmittingFollowUp || !followUpTitle.trim()}>
                {isSubmittingFollowUp ? "Creating..." : "Create Follow-up"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job Card</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete job card #{jobToDelete?.job_number} - "{jobToDelete?.title}"?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {(jobToArchive as JobCard & { archived_at?: string | null })?.archived_at
                  ? "Restore Job Card"
                  : "Archive Job Card"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(jobToArchive as JobCard & { archived_at?: string | null })?.archived_at
                  ? `Restore job card #${jobToArchive?.job_number} - "${jobToArchive?.title}" back to the active list?`
                  : `Archive job card #${jobToArchive?.job_number} - "${jobToArchive?.title}"? It will be hidden from the active and completed views and can be restored from the Archived tab.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchiveConfirm}>
                {(jobToArchive as JobCard & { archived_at?: string | null })?.archived_at ? "Restore" : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default JobCards;