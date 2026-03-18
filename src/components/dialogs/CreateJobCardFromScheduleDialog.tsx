import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { MaintenanceSchedule } from "@/types/maintenance";
import { AlertTriangle, Calendar, Loader2 } from "lucide-react";
import { useState } from "react";

interface CreateJobCardFromScheduleDialogProps {
  schedule: MaintenanceSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateJobCardFromScheduleDialog({
  schedule,
  open,
  onOpenChange,
  onSuccess,
}: CreateJobCardFromScheduleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const { toast } = useToast();

  const handleCreateJobCard = async () => {
    if (!schedule) return;

    setLoading(true);
    try {
      // Create job card
      const { data: jobCard, error: jobCardError } = await supabase
        .from("job_cards")
        .insert({
          job_number: `JOB-${Date.now()}`,
          vehicle_id: schedule.vehicle_id,
          title: `Scheduled: ${schedule.service_type}`,
          description: additionalNotes || `Job card created from scheduled ${schedule.service_type}`,
          priority: "medium",
          status: "pending",
        })
        .select()
        .single();

      if (jobCardError) throw jobCardError;
      if (!jobCard) throw new Error("Failed to create job card");

      // Create maintenance history record
      // Note: maintenance_schedule_history doesn't have job_card_id or scheduled_date fields
      const { error: historyError } = await supabase
        .from('maintenance_schedule_history')
        .insert({
          schedule_id: schedule.id,
          completed_date: new Date().toISOString(),
          status: 'scheduled',
        });

      if (historyError) throw historyError;

      // Templates not supported in current schema
      // If template exists, copy tasks and parts
      /*
      if (schedule.related_template_id) {
        const { data: template, error: templateError } = await supabase
          .from('job_card_templates')
          .select('*')
          .eq('id', schedule.related_template_id)
          .single();

        if (!templateError && template) {
          // Copy default tasks
          if (template.default_tasks && Array.isArray(template.default_tasks)) {
            for (const task of template.default_tasks as Array<{title: string; description?: string; priority?: string}>) {
              if (task && typeof task === 'object' && task.title) {
                await supabase.from('tasks').insert({
                  job_card_id: jobCard.id,
                  title: task.title,
                  description: task.description || '',
                  priority: task.priority || 'medium',
                  status: 'pending',
                });
              }
            }
          }

          // Copy default parts - Note: Using inventory_parts table instead
          if (template.default_parts && Array.isArray(template.default_parts)) {
            for (const part of template.default_parts as Array<{name: string; quantity?: number}>) {
              if (part && typeof part === 'object' && part.name) {
                // Create task for part requirement instead
                await supabase.from('tasks').insert({
                  job_card_id: jobCard.id,
                  title: `Request part: ${part.name}`,
                  description: `Quantity needed: ${part.quantity || 1}`,
                  priority: 'medium',
                  status: 'pending',
                });
              }
            }
          }
        }
      }
      */

      toast({
        title: "Success",
        description: "Job card created from maintenance schedule",
      });
      requestGoogleSheetsSync('workshop');

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating job card:', error);
      toast({
        title: "Error",
        description: "Failed to create job card",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!schedule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Job Card from Schedule
          </DialogTitle>
          <DialogDescription>
            Create a new job card based on the scheduled maintenance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">{schedule.service_type}</h3>
            <div className="flex items-center gap-4 text-sm pt-2">
              <span>
                <strong>Service Type:</strong> {schedule.service_type}
              </span>
              <span>
                <strong>Next Due:</strong> {new Date(schedule.next_due_date).toLocaleDateString()}
              </span>
              <span>
                <strong>Status:</strong> {schedule.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {schedule.next_due_date && new Date(schedule.next_due_date) < new Date() && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong className="text-destructive">Overdue:</strong> This maintenance was due on{' '}
                {new Date(schedule.next_due_date).toLocaleDateString()}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="additional-notes">Additional Notes (Optional)</Label>
            <Textarea
              id="additional-notes"
              placeholder="Add any additional context or requirements for this job card..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateJobCard} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Job Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}