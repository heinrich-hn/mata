import Layout from "@/components/Layout";
import { AddScheduleDialog } from "@/components/maintenance/AddScheduleDialog";
import { MaintenanceAnalytics } from "@/components/maintenance/MaintenanceAnalytics";
import { MaintenanceCalendar } from "@/components/maintenance/MaintenanceCalendar";
import { MaintenanceHistory } from "@/components/maintenance/MaintenanceHistory";
import { NotificationSettings } from "@/components/maintenance/NotificationSettings";
import { OverdueAlerts } from "@/components/maintenance/OverdueAlerts";
import { ScheduleList } from "@/components/maintenance/ScheduleList"; // This should import from ScheduleList.tsx
import { TemplateManager } from "@/components/maintenance/TemplateManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { MaintenanceSchedule } from "@/types/maintenance";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle, Clock, Plus } from "lucide-react";
import { useState } from "react";

export default function MaintenanceScheduling() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: schedules, refetch } = useQuery({
    queryKey: ["maintenance-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("is_active", true)
        .order("next_due_date", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MaintenanceSchedule[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["maintenance-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data: dueToday } = await supabase
        .from("maintenance_schedules")
        .select("id")
        .eq("is_active", true)
        .eq("next_due_date", today);

      const { data: overdue } = await supabase
        .from("maintenance_schedules")
        .select("id")
        .eq("is_active", true)
        .lt("next_due_date", today);

      const { data: completed } = await supabase
        .from("maintenance_schedule_history")
        .select("id")
        .eq("status", "completed")
        .gte("completed_date", new Date(new Date().setDate(1)).toISOString());

      return {
        total: schedules?.length || 0,
        dueToday: dueToday?.length || 0,
        overdue: overdue?.length || 0,
        completedThisMonth: completed?.length || 0,
      };
    },
    enabled: !!schedules,
  });

  return (
    <Layout>
      <div className="space-y-4">
        {/* Tabs at top */}
        <Tabs defaultValue="list" className="w-full">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="inline-flex w-auto min-w-full lg:grid lg:w-full lg:max-w-4xl lg:grid-cols-7">
              <TabsTrigger value="list" className="px-5 py-2.5 text-base whitespace-nowrap">Schedule List</TabsTrigger>
              <TabsTrigger value="calendar" className="px-5 py-2.5 text-base whitespace-nowrap">Calendar View</TabsTrigger>
              <TabsTrigger value="overdue" className="px-5 py-2.5 text-base whitespace-nowrap">
                Overdue
                {stats && stats.overdue > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {stats.overdue}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="px-5 py-2.5 text-base whitespace-nowrap">
                History
              </TabsTrigger>
              <TabsTrigger value="analytics" className="px-5 py-2.5 text-base whitespace-nowrap">
                Analytics
              </TabsTrigger>
              <TabsTrigger value="templates" className="px-5 py-2.5 text-base whitespace-nowrap">
                Templates
              </TabsTrigger>
              <TabsTrigger value="notifications" className="px-5 py-2.5 text-base whitespace-nowrap">
                Alerts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="space-y-4 mt-4">
            {/* Compact toolbar: stats + add button */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{stats?.total || 0}</span>
                <span className="text-muted-foreground text-xs">schedules</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold">{stats?.dueToday || 0}</span>
                <span className="text-muted-foreground text-xs">due today</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="font-semibold text-red-600">{stats?.overdue || 0}</span>
                <span className="text-muted-foreground text-xs">overdue</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="font-semibold text-green-600">{stats?.completedThisMonth || 0}</span>
                <span className="text-muted-foreground text-xs">completed this month</span>
              </div>

              <div className="flex-1" />

              <Button size="sm" className="h-8 gap-1 text-xs px-2.5" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-3 w-3" />
                New Schedule
              </Button>
            </div>

            <ScheduleList schedules={schedules || []} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="calendar">
            <MaintenanceCalendar schedules={schedules || []} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="overdue">
            <OverdueAlerts />
          </TabsContent>

          <TabsContent value="history">
            <MaintenanceHistory />
          </TabsContent>

          <TabsContent value="analytics">
            <MaintenanceAnalytics />
          </TabsContent>

          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>

        <AddScheduleDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSuccess={refetch}
        />
      </div>
    </Layout>
  );
}