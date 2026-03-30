// src/components/driver/DriverBehaviorGrid.tsx
'use client';

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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBulkDeleteDriverBehaviorEvents, useDeleteDriverBehaviorEvent, useDriverBehaviorEvents } from "@/hooks/useDriverBehaviorEvents";
import { useDriverCoaching } from "@/hooks/useDriverCoaching";
import { useRealtimeDriverBehaviorEvents } from "@/hooks/useRealtimeDriverBehaviorEvents";
import type { Database } from "@/integrations/supabase/types";
import { generateDriverCoachingPDF, generateDriverBehaviorExcel, generateDriverBehaviorPDF } from "@/lib/driverBehaviorExport";
import { format } from "date-fns";
import { AlertTriangle, ArrowUpDown, BarChart3, Calendar, Car, CheckCircle, Clock, Download, Edit2, Eye, FileSpreadsheet, FileText, List, MapPin, MessageSquare, Search, Share2, Trash2, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import DriverBehaviorDetailsDialog from "./DriverBehaviorDetailsDialog";
import DriverBehaviorEditModal from "./DriverBehaviorEditModal";
import DriverCoachingModal from "./DriverCoachingModal";
import DriverPerformanceSummary from "./DriverPerformanceSummary";

type Event = Database["public"]["Tables"]["driver_behavior_events"]["Row"];
type SortOption = "date-desc" | "date-asc" | "severity" | "driver";

function formatWhatsAppMessage(event: Event): string {
  const date = format(new Date(event.event_date), "dd MMM yyyy");
  const lines = [
    `⚠️ *Driver Behavior Event*`,
    ``,
    `*Driver:* ${event.driver_name}`,
    `*Event:* ${event.event_type}`,
    `*Date:* ${date}${event.event_time ? ` at ${event.event_time}` : ''}`,
    `*Severity:* ${(event.severity ?? 'N/A').toUpperCase()}`,
    `*Fleet:* ${event.fleet_number ?? 'N/A'}`,
  ];
  if (event.location && event.location !== 'View on Map') {
    lines.push(`*Location:* ${event.location}`);
  }
  if (event.description) {
    lines.push(``, `*Details:* ${event.description}`);
  }
  if (event.debriefed_at) {
    lines.push(``, `✅ *Debriefed:* ${format(new Date(event.debriefed_at), "dd MMM yyyy")}`);
    if (event.debrief_notes) lines.push(`*Notes:* ${event.debrief_notes}`);
    if (event.coaching_action_plan) lines.push(`*Action Plan:* ${event.coaching_action_plan}`);
  }
  return lines.join('\n');
}

export default function DriverBehaviorGrid() {
  const { data: events = [], isLoading } = useDriverBehaviorEvents();
  const deleteEvent = useDeleteDriverBehaviorEvent();
  const bulkDeleteEvents = useBulkDeleteDriverBehaviorEvents();
  const { saveCoachingSession } = useDriverCoaching();
  const { toast } = useToast();
  useRealtimeDriverBehaviorEvents();

  const [selected, setSelected] = useState<Event | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [debounced] = useDebounce(search, 300);
  const [sort, setSort] = useState<SortOption>("date-desc");

  // Bulk selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = (eventList: Event[]) => {
    setSelectedIds(new Set(eventList.map(e => e.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size > 0) {
      await bulkDeleteEvents.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteDialogOpen(false);
    }
  };

  // Split events into pending and debriefed
  const { pendingEvents, debriefedEvents } = useMemo(() => {
    if (!events) return { pendingEvents: [], debriefedEvents: [] };
    return {
      pendingEvents: events.filter((e) => !e.debriefed_at),
      debriefedEvents: events.filter((e) => !!e.debriefed_at),
    };
  }, [events]);

  const openDetails = (e: Event) => { setSelected(e); setDetailsOpen(true); };
  const openCoaching = (e: Event) => { setSelected(e); setCoachingOpen(true); };
  const openEdit = (e: Event) => { setSelected(e); setEditOpen(true); };
  const openDelete = (e: Event) => { setEventToDelete(e); setDeleteDialogOpen(true); };
  const closeAll = () => { setDetailsOpen(false); setCoachingOpen(false); setEditOpen(false); setSelected(null); };
  const startDebrief = () => { setDetailsOpen(false); openCoaching(selected!); };
  const exportPDF = () => selected && generateDriverCoachingPDF(selected);
  const exportEventPDF = (e: Event) => generateDriverCoachingPDF(e);

  const handleShareWhatsApp = async (event: Event) => {
    const message = formatWhatsAppMessage(event);
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    // Mark as debriefed if not already
    if (!event.debriefed_at) {
      try {
        await saveCoachingSession(event.id, {
          debriefed_at: new Date().toISOString(),
          debrief_date: format(new Date(), "yyyy-MM-dd"),
          debrief_conducted_by: "WhatsApp Export",
          debrief_notes: "Event shared via WhatsApp",
          status: "resolved",
        });
        toast({
          title: "Event Debriefed",
          description: `${event.driver_name} — ${event.event_type} marked as debriefed via WhatsApp.`,
        });
      } catch {
        toast({
          title: "Debrief Failed",
          description: "WhatsApp opened but failed to mark event as debriefed.",
          variant: "destructive",
        });
      }
    }
  };
  const handleConfirmDelete = async () => {
    if (eventToDelete) {
      await deleteEvent.mutateAsync(eventToDelete.id);
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  // FILTER & SORT helper
  const filterAndSort = useCallback((list: Event[]) => {
    let filtered = list;

    if (debounced) {
      const q = debounced.toLowerCase();
      filtered = filtered.filter(
        e =>
          e.driver_name?.toLowerCase().includes(q) ||
          e.event_type?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      );
    }

    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return +new Date(b.event_date) - +new Date(a.event_date);
        case "date-asc":
          return +new Date(a.event_date) - +new Date(b.event_date);
        case "severity":
          return (severityOrder[a.severity ?? "low"] ?? 3) - (severityOrder[b.severity ?? "low"] ?? 3);
        case "driver":
          return (a.driver_name ?? "").localeCompare(b.driver_name ?? "");
        default:
          return 0;
      }
    });

    return sorted;
  }, [debounced, sort]);

  const filteredPending = useMemo(() => filterAndSort(pendingEvents), [filterAndSort, pendingEvents]);
  const filteredDebriefed = useMemo(() => filterAndSort(debriefedEvents), [filterAndSort, debriefedEvents]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-blue-50 rounded-full p-8 mb-6">
          <Car className="w-16 h-16 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-3">No Events Yet</h3>
        <p className="text-lg text-muted-foreground max-w-md">
          Driver behavior events will appear here in real-time.
        </p>
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live monitoring active</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
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

        <TabsContent value="pending">
          {/* Bulk Selection Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedIds.size === filteredPending.length && filteredPending.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectAll(filteredPending);
                    } else {
                      clearSelection();
                    }
                  }}
                />
                <span className="text-sm font-medium text-blue-900">
                  {selectedIds.size} event{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkDeleteEvents.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {filteredPending.length > 0 && selectedIds.size === 0 && (
                <Checkbox
                  checked={false}
                  onCheckedChange={() => selectAll(filteredPending)}
                  title="Select all"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-foreground">Pending Events</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredPending.length} of {pendingEvents.length} event{pendingEvents.length !== 1 ? 's' : ''}
                  {debounced && ` • Searching "${debounced}"`}
                </p>
              </div>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search driver, type, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 w-full sm:w-64"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => generateDriverBehaviorExcel(pendingEvents, 'pending')}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generateDriverBehaviorPDF(pendingEvents, 'pending')}>
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-40 h-10">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="driver">Driver Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            {filteredPending.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-md">
                <CheckCircle className="mx-auto h-12 w-12 mb-4 text-green-500" />
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p>No pending events. All driver behavior events have been debriefed.</p>
              </div>
            ) : (
              filteredPending.map((event) => (
                <div
                  key={event.id}
                  className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${selectedIds.has(event.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(event.id)}
                        onCheckedChange={() => toggleSelection(event.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-gray-100 rounded-full p-2">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-foreground">{event.driver_name}</h3>
                            <p className="text-sm text-muted-foreground">Fleet #{event.fleet_number}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <Badge variant="outline">{event.event_type}</Badge>
                          <Badge variant={event.status === 'resolved' ? 'default' : 'destructive'}>
                            {event.status}
                          </Badge>
                          <Badge variant="secondary">{event.severity}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>

                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(event.event_date), "MMM dd, yyyy")}
                          </div>
                          {event.event_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {event.event_time}
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(event)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(event)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openCoaching(event)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Debrief
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareWhatsApp(event)}
                        title="Share via WhatsApp"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(event)}
                        title="Delete Event"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="debriefed">
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Debriefed Drivers</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredDebriefed.length} of {debriefedEvents.length} event{debriefedEvents.length !== 1 ? 's' : ''}
                {debounced && ` • Searching "${debounced}"`}
              </p>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search driver, type, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 w-full sm:w-64"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => generateDriverBehaviorExcel(debriefedEvents, 'debriefed')}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generateDriverBehaviorPDF(debriefedEvents, 'debriefed')}>
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-40 h-10">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="driver">Driver Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Debriefed List */}
          <div className="space-y-4">
            {filteredDebriefed.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-md">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                <h3 className="text-lg font-semibold">No Debriefed Events</h3>
                <p>Complete debriefs will appear here.</p>
              </div>
            ) : (
              filteredDebriefed.map((event) => (
                <div
                  key={event.id}
                  className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 rounded-full p-2">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground">{event.driver_name}</h3>
                          <p className="text-sm text-muted-foreground">Fleet #{event.fleet_number}</p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Debriefed {format(new Date(event.debriefed_at!), "MMM dd")}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <Badge variant="outline">{event.event_type}</Badge>
                        <Badge variant="secondary">{event.severity}</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>

                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(event.event_date), "MMM dd, yyyy")}
                        </div>
                        {event.event_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.event_time}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(event)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => exportEventPDF(event)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Export
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareWhatsApp(event)}
                        title="Share via WhatsApp"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(event)}
                        title="Delete Event"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <DriverPerformanceSummary />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {selected && (
        <>
          <DriverBehaviorDetailsDialog
            event={selected}
            open={detailsOpen}
            onOpenChange={(open) => {
              setDetailsOpen(open);
              if (!open) setSelected(null);
            }}
            onStartDebrief={startDebrief}
            onExportPDF={exportPDF}
          />

          <DriverBehaviorEditModal
            event={selected}
            open={editOpen}
            onOpenChange={(open) => {
              setEditOpen(open);
              if (!open) setSelected(null);
            }}
            onSaved={closeAll}
          />

          <DriverCoachingModal
            event={selected}
            open={coachingOpen}
            onOpenChange={(open) => {
              setCoachingOpen(open);
              if (!open) closeAll();
            }}
            onComplete={closeAll}
          />
        </>
      )}

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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Events</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedIds.size} event{selectedIds.size !== 1 ? 's' : ''}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteEvents.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteEvents.isPending ? 'Deleting...' : `Delete ${selectedIds.size} Event${selectedIds.size !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
