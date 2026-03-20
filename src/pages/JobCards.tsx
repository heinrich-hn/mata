import Layout from "@/components/Layout";
import { getFleetSubcategory, FLEET_SUBCATEGORY_META, type FleetSubcategory } from "@/utils/fleetCategories";
import AddJobCardDialog from "@/components/dialogs/AddJobCardDialog";
import JobCardDetailsDialog from "@/components/dialogs/JobCardDetailsDialog";
import JobCardWeeklyCostReport from "@/components/maintenance/JobCardWeeklyCostReport";
import JobCardNotesPopover from "@/components/jobCards/JobCardNotesPopover";
import JobCardFollowUpsPopover from "@/components/jobCards/JobCardFollowUpsPopover";
import { useAuth } from "@/contexts/AuthContext";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  ListPlus,
  MessageSquarePlus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Truck,
  User
} from "lucide-react";
import { useCallback, useState } from "react";
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
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const allActiveCards = baseFilteredCards.filter(card => {
    const status = card.status?.toLowerCase();
    return status === "pending" || status === "in_progress" || status === "in progress";
  });
  const allCompletedCards = baseFilteredCards.filter(card => card.status?.toLowerCase() === "completed");

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
    setDialogOpen(true);
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
          <TableRow>
            <TableHead className="w-[100px]">Job #</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Fleet / Vehicle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Linked References</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow
              key={card.id}
              className="cursor-pointer border-b transition-colors hover:bg-muted/30"
              onClick={() => handleJobClick(card)}
            >
              <TableCell className="font-mono text-sm">#{card.job_number}</TableCell>
              <TableCell className="max-w-[280px]">
                <div className="space-y-1">
                  <p className="font-medium leading-tight truncate">{card.title}</p>
                  <p className="text-xs text-muted-foreground">Created {new Date(card.created_at).toLocaleDateString()}</p>
                </div>
              </TableCell>
              <TableCell>
                {card.vehicle ? (
                  <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex flex-col">
                      {card.vehicle.fleet_number && (
                        <Badge variant="outline" className="text-xs w-fit">
                          {card.vehicle.fleet_number}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {card.vehicle.registration_number}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(card.status)}</TableCell>
              <TableCell>{getPriorityBadge(card.priority)}</TableCell>
              <TableCell>
                {card.assignee ? (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{card.assignee}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {card.due_date ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{new Date(card.due_date).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1 max-w-[220px]">
                  {card.inspection ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <FileText className="h-3 w-3 mr-1" />
                      {card.inspection.inspection_number}
                    </Badge>
                  ) : card.inspection_id ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <FileText className="h-3 w-3 mr-1" />
                      Inspection Linked
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">No inspection</span>
                  )}

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
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">
                          {card.partsSummary.count} Part{card.partsSummary.count > 1 ? "s" : ""}
                        </Badge>
                        {card.partsSummary.latestIrNumber && (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            IR {card.partsSummary.latestIrNumber}
                          </Badge>
                        )}
                      </div>
                      {card.partsSummary.latestPartName && (
                        <p className="text-xs text-muted-foreground truncate">
                          Latest part: {card.partsSummary.latestPartName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No parts linked</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
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
                    <DropdownMenuItem onClick={() => openCommentDialog(card)}>
                      <MessageSquarePlus className="h-4 w-4 mr-2" />
                      Add Comment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openExternalFollowUpDialog(card)}>
                      <ListPlus className="h-4 w-4 mr-2" />
                      Add External Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
    <div className="border border-border rounded-xl overflow-hidden transition-shadow duration-200 shadow-sm hover:shadow-md">
      <button
        type="button"
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-150 ${statusVariant === "active"
          ? "bg-gradient-to-r from-orange-50/80 to-amber-50/60 hover:from-orange-100/80 hover:to-amber-100/60 dark:from-orange-950/20 dark:to-amber-950/20 dark:hover:from-orange-950/30 dark:hover:to-amber-950/30"
          : "bg-gradient-to-r from-emerald-50/80 to-green-50/60 hover:from-emerald-100/80 hover:to-green-100/60 dark:from-emerald-950/20 dark:to-green-950/20 dark:hover:from-emerald-950/30 dark:hover:to-green-950/30"
          }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${statusVariant === "active"
            ? "bg-orange-100 dark:bg-orange-900/50"
            : "bg-emerald-100 dark:bg-emerald-900/50"
            }`}>
            <Truck className={`h-4 w-4 ${statusVariant === "active" ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
              }`} />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground leading-none">{fleetLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cards.length} {cards.length === 1 ? "job card" : "job cards"}
            </p>
          </div>
          <Badge
            className={`ml-1 text-xs font-semibold border ${statusVariant === "active"
              ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800"
              : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800"
              }`}
          >
            {cards.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs hidden sm:inline select-none">{isOpen ? "Collapse" : "Expand"}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
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
          <h3 className="text-lg font-semibold">{categoryInfo.name}</h3>
          <Badge className={categoryInfo.color}>
            {totalCards} {totalCards === 1 ? 'card' : 'cards'}
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
      <div className="p-2 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {isLoading && <p className="text-sm text-blue-500">Loading job cards...</p>}
            {queryError && <p className="text-sm text-red-500">Error: {String(queryError)}</p>}
          </div>
          {activeTab === "job-cards" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportJobCardsToExcel} className="h-9 gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportJobCardsToPDF} className="h-9 gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" />
                PDF
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Job Card
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="job-cards" className="px-5 py-2.5 text-base">
              Job Cards
            </TabsTrigger>
            <TabsTrigger value="cost-reports" className="px-5 py-2.5 text-base">
              Cost Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="job-cards" className="space-y-6 mt-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{allActiveCards.length}</div>
                  <p className="text-xs text-muted-foreground">Pending + In Progress</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{allCompletedCards.length}</div>
                  <p className="text-xs text-muted-foreground">Finished jobs</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 sm:min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search job cards..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger className="w-full sm:w-[140px]">
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
                      <SelectTrigger className="w-full sm:w-[160px]">
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
                </div>
              </CardContent>
            </Card>

            {/* Active Job Cards (Pending + In Progress) */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ClipboardList className="h-5 w-5 text-orange-500" />
                    <CardTitle>Active Job Cards</CardTitle>
                    <Badge className="bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800 font-semibold text-xs">
                      {allActiveCards.length}
                    </Badge>
                  </div>
                  {allActiveCards.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
                        onClick={() => setClosedActiveFleets(new Set())}
                      >
                        Expand All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
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
                        Collapse All
                      </Button>
                    </div>
                  )}
                </div>
                <CardDescription>
                  Jobs that are pending or currently in progress — categorized by fleet type
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {allActiveCards.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No active job cards</p>
                    <p className="text-xs mt-1">No results match the current filter criteria</p>
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
              </CardContent>
            </Card>

            {/* Completed Job Cards */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <CardTitle>Completed Job Cards</CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 font-semibold text-xs">
                      {allCompletedCards.length}
                    </Badge>
                  </div>
                  {allCompletedCards.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
                        onClick={() => setClosedCompletedFleets(new Set())}
                      >
                        Expand All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
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
                        Collapse All
                      </Button>
                    </div>
                  )}
                </div>
                <CardDescription>
                  Finished maintenance jobs — categorized by fleet type
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {allCompletedCards.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No completed job cards</p>
                    <p className="text-xs mt-1">No results match the current filter criteria</p>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost-reports" className="mt-6">
            <JobCardWeeklyCostReport />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <JobCardDetailsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          jobCard={selectedJob}
          onUpdate={refetch}
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
                  <Input
                    id="follow-up-assignee"
                    value={followUpAssignee}
                    onChange={(e) => setFollowUpAssignee(e.target.value)}
                    placeholder="e.g. Procurement Team"
                  />
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
      </div>
    </Layout>
  );
};

export default JobCards;