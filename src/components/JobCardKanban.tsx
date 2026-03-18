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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Kanban, List, Plus, Trash2, User } from "lucide-react";
import { useState } from "react";
import AddJobCardDialog from "./dialogs/AddJobCardDialog";
import JobCardDetailsDialog from "./dialogs/JobCardDetailsDialog";
import JobCardFilters from "./JobCardFilters";

type JobStatus = "pending" | "in_progress" | "on_hold" | "completed";
type JobCard = Database["public"]["Tables"]["job_cards"]["Row"];
type ViewMode = "kanban" | "list";

const JobCardKanban = () => {
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobCard | null>(null);
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    priority: "all",
    assignee: "all",
  });

  const { data: jobCards = [], refetch } = useQuery({
    queryKey: ["job_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredJobCards = jobCards.filter((card) => {
    if (filters.search && !card.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.status !== "all" && card.status !== filters.status) {
      return false;
    }
    if (filters.priority !== "all" && card.priority !== filters.priority) {
      return false;
    }
    if (filters.assignee !== "all" && card.assignee !== filters.assignee) {
      return false;
    }
    return true;
  });

  const assignees = [...new Set(jobCards.map(card => card.assignee).filter(Boolean))] as string[];

  const handleJobClick = (job: JobCard) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, job: JobCard) => {
    e.stopPropagation();
    setJobToDelete(job);
    setDeleteDialogOpen(true);
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

  const getJobCardsByStatus = (status: JobStatus) => {
    return filteredJobCards.filter(card => card.status === status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const columns: { status: JobStatus; title: string; color: string }[] = [
    { status: "pending", title: "Pending", color: "bg-muted" },
    { status: "in_progress", title: "In Progress", color: "bg-blue-500/10" },
    { status: "on_hold", title: "On Hold", color: "bg-yellow-500/10" },
    { status: "completed", title: "Completed", color: "bg-green-500/10" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "on_hold":
        return <Badge className="bg-yellow-500">On Hold</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Job Cards</h1>
          <p className="text-muted-foreground mt-1">Manage and track job progress</p>
        </div>
        <div className="flex items-center gap-4">
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)}>
            <ToggleGroupItem value="kanban" aria-label="Kanban view">
              <Kanban className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Job Card
          </Button>
        </div>
      </div>

      <JobCardFilters onFilterChange={setFilters} assignees={assignees} />

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-8">
          {columns.map((column) => {
            const statusCards = getJobCardsByStatus(column.status);

            return (
              <div key={column.status} className="space-y-4">
                <div className={`${column.color} rounded-lg p-3`}>
                  <h3 className="font-semibold">{column.title}</h3>
                  <p className="text-sm text-muted-foreground">{statusCards.length} jobs</p>
                </div>

                <div className="space-y-3">
                  {statusCards.map((card) => (
                    <Card
                      key={card.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow min-h-[140px]"
                      onClick={() => handleJobClick(card)}
                    >
                      <CardHeader className="pb-2 px-4 pt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground mb-1">#{card.job_number}</div>
                            <CardTitle className="text-base font-semibold line-clamp-2">{card.title}</CardTitle>
                          </div>
                          <Badge variant={getPriorityColor(card.priority) as "destructive" | "default" | "secondary"}>
                            {card.priority}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {card.assignee && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>{card.assignee}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          {card.due_date ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{new Date(card.due_date).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <div />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteClick(e, card)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobCards.map((card) => (
                <TableRow
                  key={card.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleJobClick(card)}
                >
                  <TableCell className="font-mono text-sm">#{card.job_number}</TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">{card.title}</TableCell>
                  <TableCell>{getStatusBadge(card.status)}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(card.priority) as "destructive" | "default" | "secondary"}>
                      {card.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {card.assignee ? (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{card.assignee}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {card.due_date ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{new Date(card.due_date).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {card.created_at ? new Date(card.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, card)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredJobCards.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No job cards found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

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
  );
};

export default JobCardKanban;