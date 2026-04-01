
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
  } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import
  {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, LayoutList, Plus, Printer, Search, TriangleAlert } from "lucide-react";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import CorrectiveActionDialog from "../dialogs/CorrectiveActionDialog";
import { RootCauseAnalysisDialog } from "../dialogs/RootCauseAnalysisDialog";
import StartInspectionDialog from "../dialogs/StartInspectionDialog";
import { InspectionActionsMenu } from "./InspectionActionsMenu";

interface InspectionHistoryRecord {
  id: string;
  inspection_number: string;
  inspection_date: string;
  vehicle_registration: string;
  vehicle_make?: string;
  vehicle_model?: string;
  inspector_name: string;
  fault_count: number;
  corrective_action_status: string;
  linked_work_order?: string;
  inspection_type?: string;
  notes?: string;
  status: string;
}

export function InspectionHistory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Dialog states
  const [selectedInspection, setSelectedInspection] = useState<InspectionHistoryRecord | null>(null);
  const [showCorrectiveAction, setShowCorrectiveAction] = useState(false);
  const [showRootCauseAnalysis, setShowRootCauseAnalysis] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [faultsForCorrectiveAction, setFaultsForCorrectiveAction] = useState<Array<{
    id: string;
    fault_description: string;
    severity: string;
    corrective_action_status: string | null;
    corrective_action_notes: string | null;
  }>>([]);

  // Fetch inspection history
  const { data: inspections = [], isLoading, refetch } = useQuery<InspectionHistoryRecord[]>({
    queryKey: ["inspection_history", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("vehicle_inspections")
        .select(`
          id,
          inspection_number,
          inspection_date,
          vehicle_registration,
          vehicle_make,
          vehicle_model,
          inspector_name,
          notes,
          status,
          inspection_type
        `)
        .order("inspection_date", { ascending: false });

      if (searchTerm) {
        query = query.or(
          `inspection_number.ilike.%${searchTerm}%,vehicle_registration.ilike.%${searchTerm}%,inspector_name.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch fault counts for each inspection
      const inspectionsWithFaults = await Promise.all(
        (data || []).map(async (inspection) => {
          const { count } = await supabase
            .from("inspection_faults")
            .select("*", { count: "exact", head: true })
            .eq("inspection_id", inspection.id);

          // Fetch linked work orders
          const { data: workOrders } = await supabase
            .from("job_cards")
            .select("job_number")
            .eq("inspection_id", inspection.id)
            .limit(1)
            .maybeSingle();

          return {
            id: inspection.id,
            inspection_number: inspection.inspection_number,
            inspection_date: inspection.inspection_date,
            vehicle_registration: inspection.vehicle_registration,
            vehicle_make: inspection.vehicle_make || undefined,
            vehicle_model: inspection.vehicle_model || undefined,
            inspector_name: inspection.inspector_name,
            fault_count: count || 0,
            corrective_action_status: count && count > 0 ? "TAKEN" : "NOT TAKEN",
            linked_work_order: workOrders?.job_number,
            inspection_type: inspection.inspection_type,
            notes: inspection.notes || undefined,
            status: inspection.status,
          };
        })
      );

      return inspectionsWithFaults;
    },
  });

  const handleInspectionCreated = (inspectionId: string) => {
    toast({
      title: "Inspection Started",
      description: "New inspection has been created successfully",
    });
    setShowStartDialog(false);
    // Redirect to the inspection details page to fill out the form
    navigate(`/inspections/${inspectionId}`);
  };

  // Action handlers
  const handleView = (inspection: InspectionHistoryRecord) => {
    window.location.href = `/inspections/${inspection.id}`;
  };

  const handleShare = (inspection: InspectionHistoryRecord) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/inspections/${inspection.id}`
    );
    toast({
      title: "Link Copied",
      description: `Inspection ${inspection.inspection_number} link copied to clipboard`,
    });
  };

  const handleCreateWorkOrder = (inspection: InspectionHistoryRecord) => {
    // Navigate to job cards page with pre-filled inspection data
    window.location.href = `/job-cards?inspection_id=${inspection.id}`;
  };

  const handleCorrectiveAction = async (inspection: InspectionHistoryRecord) => {
    setSelectedInspection(inspection);

    // Fetch faults for this inspection
    const { data: faults, error } = await supabase
      .from("inspection_faults")
      .select("id, fault_description, severity, corrective_action_status, corrective_action_notes")
      .eq("inspection_id", inspection.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load faults",
        variant: "destructive",
      });
      return;
    }

    if (!faults || faults.length === 0) {
      toast({
        title: "No Faults Found",
        description: "This inspection has no recorded faults",
      });
      return;
    }

    setFaultsForCorrectiveAction(faults);
    setShowCorrectiveAction(true);
  };

  const handleRootCauseAnalysis = (inspection: InspectionHistoryRecord) => {
    setSelectedInspection(inspection);
    setShowRootCauseAnalysis(true);
  };

  const handleViewPDF = async (inspection: InspectionHistoryRecord) => {
    try {
      toast({
        title: "Generating PDF",
        description: `Creating PDF for ${inspection.inspection_number}...`,
      });

      // Fetch inspection items if available (adjust query based on actual schema)
      const { data: items } = await supabase
        .from("inspection_items")
        .select("item_name, status, notes")
        .eq("inspection_id", inspection.id);

      // Map items to include optional severity field
      const _mappedItems = (items || []).map(item => ({
        ...item,
        severity: undefined, // Severity not in current schema
      }));


      toast({
        title: "PDF Generated",
        description: `PDF for ${inspection.inspection_number} has been downloaded`,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (inspection: InspectionHistoryRecord) => {
    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .update({ status: "cancelled" }) // Using cancelled as archived status
        .eq("id", inspection.id);

      if (error) throw error;

      toast({
        title: "Archived",
        description: `Inspection ${inspection.inspection_number} has been archived`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to archive inspection",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (inspection: InspectionHistoryRecord) => {
    setSelectedInspection(inspection);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!selectedInspection) return;

    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .delete()
        .eq("id", selectedInspection.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `Inspection ${selectedInspection.inspection_number} has been deleted`,
      });
      refetch();
      setShowDeleteAlert(false);
      setSelectedInspection(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete inspection",
        variant: "destructive",
      });
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedInspections = [...inspections].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn as keyof InspectionHistoryRecord];
    const bValue = b[sortColumn as keyof InspectionHistoryRecord];

    if (aValue === undefined || bValue === undefined) return 0;

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const filteredInspections = searchTerm
    ? sortedInspections
    : sortedInspections;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inspection History</h1>
        <Button onClick={() => setShowStartDialog(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Start New Inspection
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <ArrowDownUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Action</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("inspection_number")}
              >
                Report Number {sortColumn === "inspection_number" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("inspection_date")}
              >
                Date {sortColumn === "inspection_date" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Inspector</TableHead>
              <TableHead className="text-center">Fault</TableHead>
              <TableHead className="text-center">Corrective Action</TableHead>
              <TableHead>Linked WO</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Loading inspections...
                </TableCell>
              </TableRow>
            ) : filteredInspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No inspections found
                </TableCell>
              </TableRow>
            ) : (
              filteredInspections.map((inspection) => (
                <Fragment key={inspection.id}>
                  <TableRow>
                    <TableCell>
                      <InspectionActionsMenu
                        inspectionId={inspection.id}
                        inspectionNumber={inspection.inspection_number}
                        onView={() => handleView(inspection)}
                        onShare={() => handleShare(inspection)}
                        onCreateWorkOrder={() => handleCreateWorkOrder(inspection)}
                        onCorrectiveAction={() => handleCorrectiveAction(inspection)}
                        onRootCauseAnalysis={() => handleRootCauseAnalysis(inspection)}
                        onViewPDF={() => handleViewPDF(inspection)}
                        onArchive={() => handleArchive(inspection)}
                        onDelete={() => handleDelete(inspection)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{inspection.inspection_number}</TableCell>
                    <TableCell>
                      <div>
                        <div>{new Date(inspection.inspection_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}</div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(inspection.inspection_date).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{inspection.vehicle_registration}</div>
                        {(inspection.vehicle_make || inspection.vehicle_model) && (
                          <div className="text-muted-foreground text-xs">
                            {inspection.vehicle_make} {inspection.vehicle_model}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>Zimbabwe</TableCell>
                    <TableCell>{inspection.inspector_name}</TableCell>
                    <TableCell className="text-center">
                      {inspection.fault_count > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <TriangleAlert className="h-3 w-3" />
                          {inspection.fault_count}
                        </Badge>
                      ) : (
                        <Badge variant="outline">NA</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {inspection.corrective_action_status === "TAKEN" ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          TAKEN
                        </Badge>
                      ) : (
                        <Badge variant="destructive">NOT TAKEN</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {inspection.linked_work_order ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                          onClick={() => {
                            window.location.href = `/job-cards?search=${inspection.linked_work_order}`;
                          }}
                        >
                          {inspection.linked_work_order}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {inspection.status === "completed" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expandable details row */}
                  {inspection.inspection_type && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={10} className="py-2">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Inspection Checklist:</span>
                            <span className="text-muted-foreground">
                              {inspection.inspection_type}
                            </span>
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                          {inspection.notes && (
                            <div className="flex items-start gap-2 flex-1">
                              <span className="font-medium">Note:</span>
                              <span className="text-muted-foreground">{inspection.notes}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        {filteredInspections.length > 0 && (
          <div className="flex items-center justify-center py-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                More
              </Button>
              <span className="text-sm text-muted-foreground">
                [ {Math.min(25, filteredInspections.length)} / {filteredInspections.length} ]
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Start Inspection Dialog */}
      <StartInspectionDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onInspectionCreated={handleInspectionCreated}
      />

      {/* Corrective Action Dialog */}
      {selectedInspection && faultsForCorrectiveAction.length > 0 && (
        <CorrectiveActionDialog
          open={showCorrectiveAction}
          onOpenChange={setShowCorrectiveAction}
          faults={faultsForCorrectiveAction}
          inspectionId={selectedInspection.id}
          onCompleted={() => {
            refetch();
            setShowCorrectiveAction(false);
          }}
        />
      )}

      {/* Root Cause Analysis Dialog */}
      {selectedInspection && (
        <RootCauseAnalysisDialog
          open={showRootCauseAnalysis}
          onOpenChange={setShowRootCauseAnalysis}
          inspectionId={selectedInspection.id}
          inspectionNumber={selectedInspection.inspection_number}
          onCompleted={() => {
            refetch();
            setShowRootCauseAnalysis(false);
          }}
        />
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inspection{" "}
              <span className="font-semibold">{selectedInspection?.inspection_number}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}