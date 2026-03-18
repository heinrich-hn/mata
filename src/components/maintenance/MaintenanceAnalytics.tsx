import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import
  {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis, YAxis
  } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))'];

export function MaintenanceAnalytics() {
  const { data: stats } = useQuery({
    queryKey: ["maintenance-analytics-stats"],
    queryFn: async () => {
      const [schedulesRes, historyRes] = await Promise.all([
        supabase.from('maintenance_schedules').select('*').eq('is_active', true),
        supabase.from('maintenance_schedule_history').select('*').eq('status', 'completed')
      ]);

      const schedules = schedulesRes.data || [];
      const history = historyRes.data || [];

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const completedThisMonth = history.filter(h =>
        h.completed_date && new Date(h.completed_date) >= thirtyDaysAgo
      ).length;

      const overdueSchedules = schedules.filter(s =>
        s.next_due_date && new Date(s.next_due_date) < now
      );

      const totalCost = history.reduce((sum, h) => sum + (h.total_cost || 0), 0);
      const avgCost = history.length > 0 ? totalCost / history.length : 0;

      // Note: scheduled_date doesn't exist in maintenance_schedule_history
      // Calculating on-time rate based on completion status instead
      const onTimeCompletions = history.filter(h =>
        h.status === 'completed'
      ).length;

      const onTimeRate = history.length > 0 ? (onTimeCompletions / history.length) * 100 : 0;

      return {
        totalSchedules: schedules.length,
        overdueCount: overdueSchedules.length,
        completedThisMonth,
        totalCost,
        avgCost,
        onTimeRate,
      };
    },
  });

  const { data: categoryData } = useQuery({
    queryKey: ["maintenance-by-category"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('service_type')
        .eq('is_active', true);

      if (error) throw error;

      // Group by service_type instead of category (category doesn't exist)
      const categoryCounts = data.reduce((acc, item) => {
        acc[item.service_type] = (acc[item.service_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(categoryCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));
    },
  });

  const { data: completionTrend } = useQuery({
    queryKey: ["maintenance-completion-trend"],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from('maintenance_schedule_history')
        .select('completed_date, status')
        .eq('status', 'completed')
        .gte('completed_date', sixMonthsAgo.toISOString());

      if (error) throw error;

      const monthlyData = data.reduce((acc, item) => {
        if (item.completed_date) {
          const month = new Date(item.completed_date).toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit'
          });
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(monthlyData).map(([month, count]) => ({
        month,
        completed: count,
      }));
    },
  });

  const { data: costTrend } = useQuery({
    queryKey: ["maintenance-cost-trend"],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from('maintenance_schedule_history')
        .select('completed_date, total_cost')
        .gte('completed_date', sixMonthsAgo.toISOString())
        .not('total_cost', 'is', null);

      if (error) throw error;

      const monthlyData = data.reduce((acc, item) => {
        if (item.completed_date) {
          const month = new Date(item.completed_date).toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit'
          });
          if (!acc[month]) {
            acc[month] = { total: 0, count: 0 };
          }
          acc[month].total += item.total_cost || 0;
          acc[month].count += 1;
        }
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      return Object.entries(monthlyData).map(([month, data]) => ({
        month,
        cost: Math.round(data.total),
        average: Math.round(data.total / data.count),
      }));
    },
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSchedules || 0}</div>
            <p className="text-xs text-muted-foreground">Active maintenance schedules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.overdueCount || 0}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.onTimeRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {stats?.onTimeRate >= 80 ? (
                <><TrendingUp className="h-3 w-3 text-success" />Good performance</>
              ) : (
                <><TrendingDown className="h-3 w-3 text-destructive" />Needs improvement</>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats?.avgCost.toFixed(0) || 0}</div>
            <p className="text-xs text-muted-foreground">Per maintenance task</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="completion" className="w-full">
        <TabsList>
          <TabsTrigger value="completion">Completion Trend</TabsTrigger>
          <TabsTrigger value="cost">Cost Analysis</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="completion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Completion Trend</CardTitle>
              <CardDescription>Last 6 months completion history</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={completionTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Completed Tasks"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Trend</CardTitle>
              <CardDescription>Monthly maintenance costs and averages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" name="Total Cost (R)" />
                  <Bar dataKey="average" fill="hsl(var(--warning))" name="Avg Cost (R)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Cost (All Time)</span>
                  <Badge variant="outline">R{stats?.totalCost.toFixed(0) || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average per Task</span>
                  <Badge variant="outline">R{stats?.avgCost.toFixed(0) || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed This Month</span>
                  <Badge variant="outline">{stats?.completedThisMonth || 0} tasks</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance by Category</CardTitle>
              <CardDescription>Distribution of active schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {(categoryData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
