import {
AlertDialog,
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
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import AddTaskForm from "./AddTaskForm";
import TaskCompletionDialog from "../dialogs/TaskCompletionDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
}

interface JobCardTasksTableProps {
  jobCardId: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onRefresh: () => void;
}

const JobCardTasksTable = ({ jobCardId, tasks, onTaskUpdate, onRefresh }: JobCardTasksTableProps) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  const { toast } = useToast();

  const handleDeleteTask = async () => {
    if (!deleteTaskId || isDeleting) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", deleteTaskId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete task",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
        onRefresh();
      }
    } finally {
      setIsDeleting(false);
      setDeleteTaskId(null);
    }
  };

  const handleEditTask = async () => {
    if (!editTask || isEditing) return;

    setIsEditing(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editTask.title,
          description: editTask.description,
          priority: editTask.priority,
          status: editTask.status,
          due_date: editTask.due_date,
          estimated_hours: editTask.estimated_hours,
          actual_hours: editTask.actual_hours,
        })
        .eq("id", editTask.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update task",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Task updated successfully",
        });
        onRefresh();
        setEditTask(null);
      }
    } finally {
      setIsEditing(false);
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const handleStatusToggle = (task: Task) => {
    if (task.status === "completed") {
      // If unchecking (reverting to pending), update directly
      onTaskUpdate(task.id, { status: "pending" });
    } else {
      // If completing, show dialog to capture comment
      setTaskToComplete(task);
    }
  };

  const handleTaskCompletion = async (comment: string) => {
    if (!taskToComplete) return;

    setIsCompletingTask(true);
    try {
      // Update task with completion comment appended to description
      const updatedDescription = taskToComplete.description
        ? `${taskToComplete.description}\n\n--- Completion Note (${new Date().toLocaleString()}) ---\n${comment}`
        : `--- Completion Note (${new Date().toLocaleString()}) ---\n${comment}`;

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          description: updatedDescription,
        })
        .eq("id", taskToComplete.id);

      if (error) throw error;

      toast({
        title: "Task Completed",
        description: "Task has been marked as complete with your comment",
      });

      onRefresh();
      setTaskToComplete(null);
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive",
      });
    } finally {
      setIsCompletingTask(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks</CardTitle>
        <Button onClick={() => setShowAddTask(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tasks yet. Click "Add Task" to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => handleStatusToggle(task)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground">{task.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{task.assignee || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityVariant(task.priority)}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.actual_hours || task.estimated_hours
                      ? `${task.actual_hours || 0}/${task.estimated_hours || 0}h`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setEditTask({ ...task })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTaskId(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <AddTaskForm
          open={showAddTask}
          onOpenChange={setShowAddTask}
          jobCardId={jobCardId}
          onSuccess={onRefresh}
        />

        {/* Edit Task Dialog */}
        <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {editTask && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Task Title *</Label>
                  <Input
                    id="edit-title"
                    value={editTask.title}
                    onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editTask.description || ""}
                    onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={editTask.priority}
                      onValueChange={(value) => setEditTask({ ...editTask, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editTask.status}
                      onValueChange={(value) => setEditTask({ ...editTask, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-due-date">Due Date</Label>
                    <DatePicker
                      id="edit-due-date"
                      value={editTask.due_date || undefined}
                      onChange={(date) => setEditTask({ ...editTask, due_date: date ? date.toISOString().split('T')[0] : null })}
                      placeholder="Select due date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-assignee">Assignee</Label>
                    <Input
                      id="edit-assignee"
                      value={editTask.assignee || ""}
                      onChange={(e) => setEditTask({ ...editTask, assignee: e.target.value || null })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-estimated-hours">Estimated Hours</Label>
                    <Input
                      id="edit-estimated-hours"
                      type="number"
                      step="0.5"
                      value={editTask.estimated_hours || ""}
                      onChange={(e) => setEditTask({ ...editTask, estimated_hours: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-actual-hours">Actual Hours</Label>
                    <Input
                      id="edit-actual-hours"
                      type="number"
                      step="0.5"
                      value={editTask.actual_hours || ""}
                      onChange={(e) => setEditTask({ ...editTask, actual_hours: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditTask(null)}>Cancel</Button>
                  <Button onClick={handleEditTask} disabled={isEditing}>
                    {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Task Dialog */}
        <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTaskId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this task? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteTask();
                }}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Task Completion Dialog */}
        <TaskCompletionDialog
          open={!!taskToComplete}
          onOpenChange={(open) => !open && setTaskToComplete(null)}
          taskTitle={taskToComplete?.title || ""}
          onConfirm={handleTaskCompletion}
          onCancel={() => setTaskToComplete(null)}
          isSubmitting={isCompletingTask}
        />
      </CardContent>
    </Card>
  );
};

export default JobCardTasksTable;