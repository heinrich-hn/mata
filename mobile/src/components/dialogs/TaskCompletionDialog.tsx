import { Button } from "@/components/ui/button";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function TaskCompletionDialog({
  open,
  onOpenChange,
  taskTitle,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: TaskCompletionDialogProps) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!comment.trim()) {
      setError("Please provide a completion comment");
      return;
    }
    if (comment.trim().length < 5) {
      setError("Please provide a more detailed comment (at least 5 characters)");
      return;
    }
    setError("");
    onConfirm(comment.trim());
  };

  const handleClose = () => {
    setComment("");
    setError("");
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Complete Task
          </DialogTitle>
          <DialogDescription>
            Add a comment about the work performed for this task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium">Task: {taskTitle}</p>
          </div>

          {/* Comment Input */}
          <div className="space-y-2">
            <Label htmlFor="completion-comment" className="text-sm font-medium">
              Completion Comment <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="completion-comment"
              placeholder="Describe the work performed, any findings, or notes for future reference..."
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (error) setError("");
              }}
              rows={4}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}