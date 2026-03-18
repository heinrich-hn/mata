import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertTriangle, History, Loader2 } from "lucide-react";
import { useState } from "react";

interface PreviousOccurrence {
  date: string;
  jobCardNumber?: string;
  partName?: string;
  taskTitle?: string;
  notes?: string;
}

interface RepeatedActionAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  alertType: "part" | "task";
  vehicleInfo?: {
    registrationNumber: string;
    fleetNumber?: string;
  };
  previousOccurrences: PreviousOccurrence[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function RepeatedActionAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  alertType,
  vehicleInfo,
  previousOccurrences,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: RepeatedActionAlertDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Please provide a reason for this repeated action");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Please provide a more detailed explanation (at least 10 characters)");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vehicle Info */}
          {vehicleInfo && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">
                Vehicle: {vehicleInfo.registrationNumber}
                {vehicleInfo.fleetNumber && ` (Fleet #${vehicleInfo.fleetNumber})`}
              </p>
            </div>
          )}

          {/* Previous Occurrences Alert */}
          <Alert variant="destructive" className="border-amber-500 bg-amber-50 text-amber-900">
            <History className="h-4 w-4" />
            <AlertTitle>Previous Occurrences Detected</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2">
                {previousOccurrences.slice(0, 3).map((occurrence, index) => (
                  <div
                    key={index}
                    className="text-sm bg-white/50 p-2 rounded border border-amber-200"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium">
                        {alertType === "part"
                          ? occurrence.partName
                          : occurrence.taskTitle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(occurrence.date).toLocaleDateString()}
                      </span>
                    </div>
                    {occurrence.jobCardNumber && (
                      <p className="text-xs text-muted-foreground">
                        Job Card: {occurrence.jobCardNumber}
                      </p>
                    )}
                    {occurrence.notes && (
                      <p className="text-xs mt-1 italic">
                        Note: {occurrence.notes}
                      </p>
                    )}
                  </div>
                ))}
                {previousOccurrences.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {previousOccurrences.length - 3} more occurrence(s)
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Repeated {alertType === "part" ? "Part Usage" : "Task"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder={
                alertType === "part"
                  ? "e.g., Part failed prematurely due to road conditions, warranty replacement, scheduled maintenance interval..."
                  : "e.g., Issue recurred due to underlying problem, follow-up inspection required, scheduled maintenance..."
              }
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              rows={4}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              This comment will be recorded for audit and tracking purposes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}