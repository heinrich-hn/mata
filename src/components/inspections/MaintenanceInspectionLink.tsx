import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Calendar, CheckCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// Proper types from Supabase
type MaintenanceSchedule = Database["public"]["Tables"]["maintenance_schedules"]["Row"];
type MaintenanceScheduleHistoryInsert = Database["public"]["Tables"]["maintenance_schedule_history"]["Insert"];

interface MaintenanceInspectionLinkProps {
  inspectionId: string;
  vehicleId: string;
}

export function MaintenanceInspectionLink({
  inspectionId,
  vehicleId,
}: MaintenanceInspectionLinkProps) {
  const [relatedSchedules, setRelatedSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Memoize fetch function to fix useEffect dependency warning
  const fetchRelatedSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .eq("is_active", true)
        .order("next_due_date", { ascending: true });

      if (error) throw error;
      setRelatedSchedules(data ?? []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load maintenance schedules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [vehicleId, toast]);

  // Now safe: fetchRelatedSchedules is stable
  useEffect(() => {
    if (inspectionId && vehicleId) {
      fetchRelatedSchedules();
    }
  }, [inspectionId, vehicleId, fetchRelatedSchedules]);

  const linkInspectionToSchedule = async (scheduleId: string) => {
    try {
      const historyEntry: MaintenanceScheduleHistoryInsert = {
        schedule_id: scheduleId,
        completed_date: new Date().toISOString(),
        status: "completed",
        notes: `Linked to inspection: ${inspectionId}`,
      };

      const { error } = await supabase
        .from("maintenance_schedule_history")
        .insert(historyEntry);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Inspection linked to maintenance schedule",
      });

      // Refresh list
      fetchRelatedSchedules();
    } catch (error) {
      console.error("Error linking inspection:", error);
      toast({
        title: "Error",
        description: "Failed to link inspection",
        variant: "destructive",
      });
    }
  };

  // Early returns
  if (loading) return null;
  if (relatedSchedules.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Related Maintenance Schedules
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {relatedSchedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{schedule.service_type}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {schedule.service_type}
                  </Badge>
                  {schedule.next_due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due: {new Date(schedule.next_due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => linkInspectionToSchedule(schedule.id)}
                className="ml-3"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Link
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}