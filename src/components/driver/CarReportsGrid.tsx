// src/components/driver/CarReportsGrid.tsx
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCRAReports } from "@/hooks/useCRAReports";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Eye, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import CRAReportForm from "./CRAReportForm";

type SortOption = "date-desc" | "date-asc" | "priority" | "status";
type ReportTab = "car" | "cra";

export default function CarReportsGrid() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced] = useDebounce(search, 300);
  const [sort, setSort] = useState<SortOption>("date-desc");
  const [activeTab, setActiveTab] = useState<ReportTab>("car");
  const [showCRAForm, setShowCRAForm] = useState(false);
  const [editingCRAId, setEditingCRAId] = useState<string | undefined>();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<typeof cars[number] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | null>>({});

  // Fetch CRA Reports
  const { data: craReports = [], isLoading: isLoadingCRA } = useCRAReports();

  const {
    data: cars = [],
    isLoading,
  } = useQuery({
    queryKey: ['car_reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('car_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('car_reports')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car_reports'] });
    },
  });

  const updateCar = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, string | null> }) => {
      const { error } = await supabase
        .from('car_reports')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car_reports'] });
      toast.success("CAR report updated");
      setIsEditing(false);
      setSelectedCar(null);
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const openDetail = (car: typeof cars[number]) => {
    setSelectedCar(car);
    setIsEditing(false);
    setEditForm({
      description: car.description,
      incident_location: car.incident_location,
      immediate_action_taken: car.immediate_action_taken,
      corrective_actions: car.corrective_actions,
      root_cause_analysis: car.root_cause_analysis,
      preventive_measures: car.preventive_measures,
      responsible_person: car.responsible_person,
      target_completion_date: car.target_completion_date,
      actual_completion_date: car.actual_completion_date,
      status: car.status,
      severity: car.severity,
    });
  };

  const handleSaveEdit = () => {
    if (!selectedCar) return;
    updateCar.mutate({ id: selectedCar.id, updates: editForm });
  };

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('car_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car_reports'] });
      toast.success("CAR report deleted");
      setDeleteTargetId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const filteredSorted = useMemo(() => {
    let list = cars;

    if (debounced) {
      const q = debounced.toLowerCase();
      list = list.filter(
        c =>
          (c.report_number?.toLowerCase().includes(q)) ||
          (c.driver_name?.toLowerCase().includes(q)) ||
          (c.fleet_number?.toLowerCase().includes(q)) ||
          (c.incident_type?.toLowerCase().includes(q))
      );
    }

    // Move const outside switch
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { open: 0, 'in-progress': 1, resolved: 2, closed: 3 };

    list.sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date-asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "priority":
          return (priorityOrder[a.severity ?? 'medium'] ?? 3) - (priorityOrder[b.severity ?? 'medium'] ?? 3);
        case "status":
          return (statusOrder[a.status ?? 'open'] ?? 0) - (statusOrder[b.status ?? 'open'] ?? 0);
        default:
          return 0;
      }
    });

    return list;
  }, [cars, debounced, sort]);

  if (isLoading || isLoadingCRA) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }

  // Filter CRA reports
  const filteredCRA = craReports.filter((cra) => {
    if (!debounced) return true;
    const q = debounced.toLowerCase();
    return (
      cra.cra_number?.toLowerCase().includes(q) ||
      cra.discovered_by?.toLowerCase().includes(q) ||
      cra.issue_category?.toLowerCase().includes(q) ||
      cra.issue_description?.toLowerCase().includes(q)
    );
  });

  const handleOpenCRAForm = (id?: string) => {
    setEditingCRAId(id);
    setShowCRAForm(true);
  };

  const handleCloseCRAForm = () => {
    setEditingCRAId(undefined);
    setShowCRAForm(false);
  };

  const getRiskBadgeVariant = (risk: string | null) => {
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* CRA Form Dialog */}
      <Dialog open={showCRAForm} onOpenChange={setShowCRAForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCRAId ? 'Edit CRA Report' : 'New CRA Report'}
            </DialogTitle>
          </DialogHeader>
          <CRAReportForm
            existingReportId={editingCRAId}
            onClose={handleCloseCRAForm}
          />
        </DialogContent>
      </Dialog>

      {/* CAR Detail / Edit Dialog */}
      <Dialog open={!!selectedCar} onOpenChange={(open) => { if (!open) { setSelectedCar(null); setIsEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedCar?.report_number}</span>
              <div className="flex items-center gap-2">
                {selectedCar?.severity && (
                  <Badge variant={selectedCar.severity === 'critical' || selectedCar.severity === 'high' ? 'destructive' : 'secondary'}>
                    {selectedCar.severity}
                  </Badge>
                )}
                {selectedCar?.status && (
                  <Badge variant={selectedCar.status === 'resolved' || selectedCar.status === 'closed' ? 'default' : 'destructive'}>
                    {selectedCar.status}
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCar && !isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">Driver</Label><p className="font-medium">{selectedCar.driver_name}</p></div>
                <div><Label className="text-muted-foreground">Fleet</Label><p className="font-medium">{selectedCar.fleet_number || '–'}</p></div>
                <div><Label className="text-muted-foreground">Incident Type</Label><p className="font-medium">{selectedCar.incident_type}</p></div>
                <div><Label className="text-muted-foreground">Incident Date</Label><p className="font-medium">{selectedCar.incident_date || 'N/A'}</p></div>
                <div><Label className="text-muted-foreground">Incident Time</Label><p className="font-medium">{selectedCar.incident_time || 'N/A'}</p></div>
                <div><Label className="text-muted-foreground">Location</Label><p className="font-medium">{selectedCar.incident_location || 'N/A'}</p></div>
                <div><Label className="text-muted-foreground">Responsible Person</Label><p className="font-medium">{selectedCar.responsible_person || '–'}</p></div>
                <div><Label className="text-muted-foreground">Target Completion</Label><p className="font-medium">{selectedCar.target_completion_date || '–'}</p></div>
              </div>
              <div><Label className="text-muted-foreground">Description</Label><p className="text-sm mt-1 whitespace-pre-wrap">{selectedCar.description}</p></div>
              {selectedCar.immediate_action_taken && <div><Label className="text-muted-foreground">Immediate Action Taken</Label><p className="text-sm mt-1 whitespace-pre-wrap">{selectedCar.immediate_action_taken}</p></div>}
              {selectedCar.corrective_actions && <div><Label className="text-muted-foreground">Corrective Actions</Label><p className="text-sm mt-1 whitespace-pre-wrap">{selectedCar.corrective_actions}</p></div>}
              {selectedCar.root_cause_analysis && <div><Label className="text-muted-foreground">Root Cause Analysis</Label><p className="text-sm mt-1 whitespace-pre-wrap">{selectedCar.root_cause_analysis}</p></div>}
              {selectedCar.preventive_measures && <div><Label className="text-muted-foreground">Preventive Measures</Label><p className="text-sm mt-1 whitespace-pre-wrap">{selectedCar.preventive_measures}</p></div>}
            </div>
          )}

          {selectedCar && isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editForm.status || ''} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Severity</Label>
                  <Select value={editForm.severity || ''} onValueChange={(v) => setEditForm(prev => ({ ...prev, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Responsible Person</Label>
                  <Input value={editForm.responsible_person || ''} onChange={(e) => setEditForm(prev => ({ ...prev, responsible_person: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={editForm.incident_location || ''} onChange={(e) => setEditForm(prev => ({ ...prev, incident_location: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Completion Date</Label>
                  <Input type="date" value={editForm.target_completion_date || ''} onChange={(e) => setEditForm(prev => ({ ...prev, target_completion_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Actual Completion Date</Label>
                  <Input type="date" value={editForm.actual_completion_date || ''} onChange={(e) => setEditForm(prev => ({ ...prev, actual_completion_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} value={editForm.description || ''} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Immediate Action Taken</Label>
                <Textarea rows={2} value={editForm.immediate_action_taken || ''} onChange={(e) => setEditForm(prev => ({ ...prev, immediate_action_taken: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Corrective Actions</Label>
                <Textarea rows={2} value={editForm.corrective_actions || ''} onChange={(e) => setEditForm(prev => ({ ...prev, corrective_actions: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Root Cause Analysis</Label>
                <Textarea rows={2} value={editForm.root_cause_analysis || ''} onChange={(e) => setEditForm(prev => ({ ...prev, root_cause_analysis: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Preventive Measures</Label>
                <Textarea rows={2} value={editForm.preventive_measures || ''} onChange={(e) => setEditForm(prev => ({ ...prev, preventive_measures: e.target.value }))} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!isEditing ? (
              <>
                {selectedCar?.status !== 'closed' && selectedCar?.status !== 'resolved' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedCar) {
                        updateStatus.mutate({ id: selectedCar.id, status: 'resolved' });
                        setSelectedCar(null);
                      }
                    }}
                    disabled={updateStatus.isPending}
                  >
                    {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Resolve
                  </Button>
                )}
                <Button onClick={() => setIsEditing(true)}>Edit</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={updateCar.isPending}>
                  {updateCar.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CAR Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The report will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTargetId && deleteReport.mutate(deleteTargetId)}
              disabled={deleteReport.isPending}
            >
              {deleteReport.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs for CAR vs CRA */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <TabsList>
            <TabsTrigger value="car" className="px-5 py-2.5 text-base">
              CAR Reports ({cars.length})
            </TabsTrigger>
            <TabsTrigger value="cra" className="px-5 py-2.5 text-base">
              CRA Reports ({craReports.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-3 w-full sm:w-auto">
            <Input
              placeholder={activeTab === 'car' ? "Search CAR, driver..." : "Search CRA..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 h-10"
            />
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-40 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            {activeTab === 'cra' && (
              <Button onClick={() => handleOpenCRAForm()}>
                <Plus className="h-4 w-4 mr-2" />
                New CRA
              </Button>
            )}
          </div>
        </div>

        {/* CAR Reports Tab — Table rows */}
        <TabsContent value="car" className="mt-6">
          {filteredSorted.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <h3 className="text-lg font-semibold">No CARs Found</h3>
                <p className="text-muted-foreground">Try adjusting search or filters.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report #</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Incident Date</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSorted.map((car) => (
                    <TableRow key={car.id}>
                      <TableCell className="font-medium">{car.report_number}</TableCell>
                      <TableCell>{car.driver_name}</TableCell>
                      <TableCell>{car.fleet_number || "–"}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{car.incident_type}</TableCell>
                      <TableCell>
                        <Badge variant={
                          car.severity === 'critical' || car.severity === 'high'
                            ? 'destructive'
                            : car.severity === 'medium'
                            ? 'secondary'
                            : 'outline'
                        }>
                          {car.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={car.status === 'resolved' || car.status === 'closed' ? 'default' : 'destructive'}>
                          {car.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {car.incident_date || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">{car.responsible_person || '–'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => openDetail(car)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          {car.status !== 'closed' && car.status !== 'resolved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => updateStatus.mutate({ id: car.id, status: 'resolved' })}
                              disabled={updateStatus.isPending}
                            >
                              {updateStatus.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resolve'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTargetId(car.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* CRA Reports Tab */}
        <TabsContent value="cra" className="mt-6">
          {filteredCRA.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No CRA Reports Found</h3>
                <p className="text-muted-foreground">
                  {craReports.length === 0
                    ? "Create your first CRA report to get started."
                    : "Try adjusting search or filters."}
                </p>
                {craReports.length === 0 && (
                  <Button className="mt-4" onClick={() => handleOpenCRAForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create CRA Report
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCRA.map((cra) => (
                <Card key={cra.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">{cra.cra_number}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{cra.issue_category}</Badge>
                      <Badge variant={cra.status === 'approved' ? 'default' : 'secondary'}>
                        {cra.status}
                      </Badge>
                      {cra.risk_assessment && (
                        <Badge variant={getRiskBadgeVariant(cra.risk_assessment)}>
                          {cra.risk_assessment} risk
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {cra.issue_description?.substring(0, 100)}...
                    </p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Discovered: {cra.discovery_date || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1">
                        By: {cra.discovered_by}
                      </div>
                      {cra.vehicles && (
                        <div className="flex items-center gap-1">
                          Vehicle: Fleet #{(cra.vehicles as { fleet_number?: string })?.fleet_number}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenCRAForm(cra.id)}
                      >
                        View / Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
