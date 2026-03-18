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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Schedule
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Active schedules</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Due Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats?.dueToday || 0}</div>
              <p className="text-xs text-muted-foreground">Tasks due today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats?.overdue || 0}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats?.completedThisMonth || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="inline-flex w-auto min-w-full lg:grid lg:w-full lg:grid-cols-7">
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

          <TabsContent value="list" className="space-y-4">
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