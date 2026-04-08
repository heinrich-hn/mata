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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeleteDriverBehaviorEvent, useDriverBehaviorEvents } from "@/hooks/useDriverBehaviorEvents";
import { useRealtimeDriverBehaviorEvents } from "@/hooks/useRealtimeDriverBehaviorEvents";
import type { Database } from "@/integrations/supabase/types";
import { generateDriverCoachingPDF } from "@/lib/driverBehaviorExport";
import { formatDate } from "@/lib/formatters";
import { BarChart3, CheckCircle, Eye, FileText, List, Loader2, MessageSquare, Trash2, Video } from "lucide-react";
import { useMemo, useState } from "react";
import DriverBehaviorDetailsDialog from "./DriverBehaviorDetailsDialog";
import DriverCoachingModal from "./DriverCoachingModal";
import DriverPerformanceSummary from "./DriverPerformanceSummary";

type DriverBehaviorEvent = Database["public"]["Tables"]["driver_behavior_events"]["Row"];

const DriverBehaviorTable = () => {
  const { data: events, isLoading } = useDriverBehaviorEvents();
  const deleteEvent = useDeleteDriverBehaviorEvent();
  useRealtimeDriverBehaviorEvents();

  const [selectedEvent, setSelectedEvent] = useState<DriverBehaviorEvent | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [coachingModalOpen, setCoachingModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<DriverBehaviorEvent | null>(null);

  // Split events into pending and debriefed
  const { pendingEvents, debriefedEvents } = useMemo(() => {
    if (!events) return { pendingEvents: [], debriefedEvents: [] };
    return {
      pendingEvents: events.filter((e) => !e.debriefed_at),
      debriefedEvents: events.filter((e) => !!e.debriefed_at),
    };
  }, [events]);

  const handleViewDetails = (event: DriverBehaviorEvent) => {
    setSelectedEvent(event);
    setDetailsDialogOpen(true);
  };

  const handleStartDebrief = (event: DriverBehaviorEvent) => {
    setSelectedEvent(event);
    setCoachingModalOpen(true);
  };

  const handleExportPDF = (event: DriverBehaviorEvent) => {
    generateDriverCoachingPDF(event);
  };

  const handleDeleteClick = (event: DriverBehaviorEvent) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (eventToDelete) {
      await deleteEvent.mutateAsync(eventToDelete.id);
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  const handleCoachingComplete = () => {
    setCoachingModalOpen(false);
    setSelectedEvent(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No driver behavior events found.
      </div>
    );
  }

  const getSeverityVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "destructive";
      case "pending":
        return "default";
      case "resolved":
        return "secondary";
      case "closed":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <>
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events" className="gap-2">
            <List className="h-4 w-4" />
            Pending Events
            {pendingEvents.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingEvents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="debriefed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Debriefed Drivers
            {debriefedEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1">{debriefedEvents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          {pendingEvents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground border rounded-md">
              No pending events. All driver behavior events have been debriefed.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fleet Number</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Event Video</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDate(event.event_date)}</TableCell>
                      <TableCell>{event.event_time || "N/A"}</TableCell>
                      <TableCell className="font-medium">{event.driver_name}</TableCell>
                      <TableCell>{event.fleet_number || "N/A"}</TableCell>
                      <TableCell>{event.event_type}</TableCell>
                      <TableCell>
                        {event.location && /^https?:\/\//i.test(event.location) ? (
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                            onClick={() => window.open(event.location!, '_blank', 'noopener,noreferrer')}
                          >
                            <Video className="w-3.5 h-3.5" />
                            Event Video
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No video</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityVariant(event.severity || "medium")}>
                          {event.severity || "medium"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(event.status || "open")}>
                          {event.status || "open"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{event.points || 0}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(event)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleStartDebrief(event)}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Debrief
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(event)}
                            title="Delete Event"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="debriefed">
          {debriefedEvents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground border rounded-md">
              No debriefed events yet. Complete debriefs will appear here.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fleet Number</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Event Video</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Debriefed On</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debriefedEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDate(event.event_date)}</TableCell>
                      <TableCell>{event.event_time || "N/A"}</TableCell>
                      <TableCell className="font-medium">{event.driver_name}</TableCell>
                      <TableCell>{event.fleet_number || "N/A"}</TableCell>
                      <TableCell>{event.event_type}</TableCell>
                      <TableCell>
                        {event.location && /^https?:\/\//i.test(event.location) ? (
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                            onClick={() => window.open(event.location!, '_blank', 'noopener,noreferrer')}
                          >
                            <Video className="w-3.5 h-3.5" />
                            Event Video
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No video</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityVariant(event.severity || "medium")}>
                          {event.severity || "medium"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          {formatDate(event.debriefed_at!)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{event.points || 0}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(event)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExportPDF(event)}
                            title="Export PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(event)}
                            title="Delete Event"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary">
          <DriverPerformanceSummary />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver Behavior Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event for{" "}
              <strong>{eventToDelete?.driver_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedEvent && (
        <>
          <DriverBehaviorDetailsDialog
            event={selectedEvent}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            onStartDebrief={() => {
              setDetailsDialogOpen(false);
              handleStartDebrief(selectedEvent);
            }}
            onExportPDF={() => handleExportPDF(selectedEvent)}
          />

          <DriverCoachingModal
            event={selectedEvent}
            open={coachingModalOpen}
            onOpenChange={setCoachingModalOpen}
            onComplete={handleCoachingComplete}
          />
        </>
      )}
    </>
  );
};

export default DriverBehaviorTable;