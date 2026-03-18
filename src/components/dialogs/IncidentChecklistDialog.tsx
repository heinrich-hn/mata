import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import
  {
    calculateChecklistProgress,
    CHECKLIST_CATEGORIES,
    getChecklistByCategory,
    type ChecklistResponse
  } from "@/constants/incidentChecklist";
import { useToast } from "@/hooks/use-toast";
import
  {
    useIncidentChecklist,
    useSaveIncidentChecklist,
  } from "@/hooks/useIncidentChecklist";
import type { Incident } from "@/hooks/useIncidents";
import
  {
    Check,
    CheckCircle2,
    ClipboardCheck,
    Loader2,
    RotateCcw,
    Save,
    X
  } from "lucide-react";
import { useEffect, useState } from "react";

interface IncidentChecklistDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IncidentChecklistDialog = ({
  incident,
  open,
  onOpenChange,
}: IncidentChecklistDialogProps) => {
  const { toast } = useToast();
  const [responses, setResponses] = useState<ChecklistResponse[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: existingChecklist, isLoading } = useIncidentChecklist(incident?.id);
  const saveChecklist = useSaveIncidentChecklist();

  // Initialize responses from existing checklist
  useEffect(() => {
    if (existingChecklist?.responses) {
      setResponses(existingChecklist.responses);
      const existingNotes: Record<number, string> = {};
      existingChecklist.responses.forEach((r) => {
        if (r.notes) {
          existingNotes[r.item_id] = r.notes;
        }
      });
      setNotes(existingNotes);
    } else {
      // Initialize with empty responses
      setResponses([]);
      setNotes({});
    }
  }, [existingChecklist]);

  if (!incident) return null;

  const getResponse = (itemId: number): boolean | null => {
    const response = responses.find((r) => r.item_id === itemId);
    return response?.response ?? null;
  };

  const setItemResponse = (itemId: number, value: boolean | null) => {
    setResponses((prev) => {
      const existing = prev.findIndex((r) => r.item_id === itemId);
      const newResponse: ChecklistResponse = {
        item_id: itemId,
        response: value,
        notes: notes[itemId],
        completed_at: new Date().toISOString(),
        completed_by: "Current User", // TODO: Get from auth context
      };

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResponse;
        return updated;
      }
      return [...prev, newResponse];
    });
  };

  const handleSave = async () => {
    try {
      // Add notes to responses
      const responsesWithNotes = responses.map((r) => ({
        ...r,
        notes: notes[r.item_id] || undefined,
      }));

      await saveChecklist.mutateAsync({
        incidentId: incident.id,
        responses: responsesWithNotes,
        completedBy: "Current User", // TODO: Get from auth context
      });

      toast({
        title: "Checklist Saved",
        description: "The incident checklist has been saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save checklist:", error);
      toast({
        title: "Error",
        description: "Failed to save checklist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setResponses([]);
    setNotes({});
  };

  const progress = calculateChecklistProgress(responses);
  const groupedItems = getChecklistByCategory();

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      initial_report: "bg-blue-100 text-blue-800 border-blue-200",
      emergency_response: "bg-red-100 text-red-800 border-red-200",
      documentation: "bg-green-100 text-green-800 border-green-200",
      third_party: "bg-orange-100 text-orange-800 border-orange-200",
      police: "bg-purple-100 text-purple-800 border-purple-200",
      follow_up: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[category] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Accident Reporting Checklist</DialogTitle>
          </div>
          <DialogDescription>
            Incident: {incident.incident_number} - Complete all required steps for proper incident handling
          </DialogDescription>
        </DialogHeader>

        {/* Progress Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Completion Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.completed} of {progress.total} items
            </span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Yes: {progress.yes}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>No: {progress.no}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span>Pending: {progress.pending}</span>
            </div>
          </div>
          {progress.percentage === 100 && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Checklist Complete
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 300px)' }}>
            <div className="space-y-6 pb-4">
              {Object.entries(CHECKLIST_CATEGORIES).map(([categoryKey, categoryInfo]) => {
                const items = groupedItems[categoryKey] || [];
                if (items.length === 0) return null;

                const categoryResponses = items.map((item) => getResponse(item.id));
                const categoryCompleted = categoryResponses.filter((r) => r !== null).length;
                const categoryYes = categoryResponses.filter((r) => r === true).length;

                return (
                  <div key={categoryKey} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getCategoryColor(categoryKey)}>
                        {categoryInfo.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {categoryCompleted}/{items.length} complete • {categoryYes} yes
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {items.map((item) => {
                        const response = getResponse(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              response === true
                                ? "bg-green-50 border-green-200"
                                : response === false
                                ? "bg-red-50 border-red-200"
                                : "bg-background border-border"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-muted-foreground font-mono w-6">
                                #{item.id}
                              </span>
                              <div className="flex-1 space-y-2">
                                <p className="text-sm">{item.question}</p>
                                <div className="flex items-center gap-4">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={response === true ? "default" : "outline"}
                                    className={`h-8 ${response === true ? "bg-green-600 hover:bg-green-700" : ""}`}
                                    onClick={() => setItemResponse(item.id, true)}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Yes
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={response === false ? "default" : "outline"}
                                    className={`h-8 ${response === false ? "bg-red-600 hover:bg-red-700" : ""}`}
                                    onClick={() => setItemResponse(item.id, false)}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    No
                                  </Button>
                                  {response !== null && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-muted-foreground"
                                      onClick={() => setItemResponse(item.id, null)}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                {response === false && (
                                  <div className="pt-2">
                                    <Input
                                      placeholder="Add notes explaining why..."
                                      value={notes[item.id] || ""}
                                      onChange={(e) =>
                                        setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                      }
                                      className="text-sm h-8"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={handleReset} disabled={saveChecklist.isPending}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveChecklist.isPending}>
              {saveChecklist.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Checklist
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentChecklistDialog;