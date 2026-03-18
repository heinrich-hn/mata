import
  {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { UserSelect } from "@/components/ui/user-select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface LaborEntry {
  id: string;
  technician_name: string;
  description: string | null;
  hours_worked: number;
  hourly_rate: number;
  total_cost: number;
  work_date: string;
}

interface JobCardLaborTableProps {
  jobCardId: string;
  laborEntries: LaborEntry[];
  onRefresh: () => void;
}

const JobCardLaborTable = ({ jobCardId, laborEntries, onRefresh }: JobCardLaborTableProps) => {
  const [showAddLabor, setShowAddLabor] = useState(false);
  const [deleteLaborId, setDeleteLaborId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editLabor, setEditLabor] = useState<LaborEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    technician_name: "",
    description: "",
    hours_worked: "",
    hourly_rate: "",
    work_date: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();

  const handleDeleteLabor = async () => {
    if (!deleteLaborId || isDeleting) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("labor_entries")
        .delete()
        .eq("id", deleteLaborId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete labor entry",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Labor entry deleted successfully",
        });
        onRefresh();
      }
    } finally {
      setIsDeleting(false);
      setDeleteLaborId(null);
    }
  };

  const handleEditLabor = async () => {
    if (!editLabor || isEditing) return;

    setIsEditing(true);
    try {
      const { error } = await supabase
        .from("labor_entries")
        .update({
          technician_name: editLabor.technician_name,
          description: editLabor.description,
          hours_worked: editLabor.hours_worked,
          hourly_rate: editLabor.hourly_rate,
          work_date: editLabor.work_date,
        })
        .eq("id", editLabor.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update labor entry",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Labor entry updated successfully",
        });
        onRefresh();
        setEditLabor(null);
      }
    } finally {
      setIsEditing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("labor_entries").insert({
      job_card_id: jobCardId,
      technician_name: formData.technician_name,
      description: formData.description || null,
      hours_worked: parseFloat(formData.hours_worked),
      hourly_rate: parseFloat(formData.hourly_rate),
      work_date: formData.work_date
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add labor entry",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Labor entry added successfully",
    });

    setShowAddLabor(false);
    setFormData({
      technician_name: "",
      description: "",
      hours_worked: "",
      hourly_rate: "",
      work_date: new Date().toISOString().split('T')[0]
    });
    onRefresh();
  };

  const totalCost = laborEntries.reduce((sum, entry) => sum + entry.total_cost, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Labor</CardTitle>
        <Button onClick={() => setShowAddLabor(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Labor
        </Button>
      </CardHeader>
      <CardContent>
        {laborEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No labor entries yet. Click "Add Labor" to track work.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {laborEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{entry.technician_name}</p>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditLabor({ ...entry })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteLaborId(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Date</span>
                      {new Date(entry.work_date).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Hours</span>
                      {entry.hours_worked}h @ ${entry.hourly_rate}/h
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Total</span>
                      <span className="font-semibold text-primary">${entry.total_cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end border-t pt-2 text-sm font-semibold">
                <span className="text-muted-foreground mr-2">Total Labor:</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[650px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.technician_name}</TableCell>
                    <TableCell className="text-sm">{entry.description || "-"}</TableCell>
                    <TableCell>{new Date(entry.work_date).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.hours_worked}h</TableCell>
                    <TableCell>${entry.hourly_rate}/h</TableCell>
                    <TableCell className="text-right font-medium">${entry.total_cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setEditLabor({ ...entry })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteLaborId(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-semibold">
                    Total Labor Cost:
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${totalCost.toFixed(2)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
          </>
        )}

        <Dialog open={showAddLabor} onOpenChange={setShowAddLabor}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Labor Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="technician_name">Technician Name *</Label>
                <UserSelect
                  value={formData.technician_name}
                  onValueChange={(value) => setFormData({ ...formData, technician_name: value })}
                  placeholder="Select technician"
                  filterByRole="Technician"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hours_worked">Hours Worked *</Label>
                  <Input
                    id="hours_worked"
                    type="number"
                    step="0.5"
                    value={formData.hours_worked}
                    onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="hourly_rate">Hourly Rate *</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="work_date">Work Date *</Label>
                <DatePicker
                  id="work_date"
                  value={formData.work_date}
                  onChange={(date) => setFormData({ ...formData, work_date: date ? date.toISOString().split('T')[0] : '' })}
                  placeholder="Select work date"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddLabor(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Labor</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Labor Dialog */}
        <Dialog open={!!editLabor} onOpenChange={(open) => !open && setEditLabor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Labor Entry</DialogTitle>
            </DialogHeader>
            {editLabor && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-technician">Technician Name *</Label>
                  <UserSelect
                    value={editLabor.technician_name}
                    onValueChange={(value) => setEditLabor({ ...editLabor, technician_name: value })}
                    placeholder="Select technician"
                    filterByRole="Technician"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editLabor.description || ""}
                    onChange={(e) => setEditLabor({ ...editLabor, description: e.target.value || null })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-hours">Hours Worked *</Label>
                    <Input
                      id="edit-hours"
                      type="number"
                      step="0.5"
                      value={editLabor.hours_worked}
                      onChange={(e) => setEditLabor({ ...editLabor, hours_worked: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-rate">Hourly Rate *</Label>
                    <Input
                      id="edit-rate"
                      type="number"
                      step="0.01"
                      value={editLabor.hourly_rate}
                      onChange={(e) => setEditLabor({ ...editLabor, hourly_rate: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-date">Work Date *</Label>
                  <DatePicker
                    id="edit-date"
                    value={editLabor.work_date}
                    onChange={(date) => setEditLabor({ ...editLabor, work_date: date ? date.toISOString().split('T')[0] : '' })}
                    placeholder="Select work date"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditLabor(null)}>Cancel</Button>
                  <Button onClick={handleEditLabor} disabled={isEditing}>
                    {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Labor Dialog */}
        <AlertDialog open={!!deleteLaborId} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteLaborId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Labor Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this labor entry? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteLabor();
                }}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default JobCardLaborTable;