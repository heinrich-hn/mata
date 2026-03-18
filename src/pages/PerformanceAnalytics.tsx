import Layout from "@/components/Layout";
import CustomerRetentionDashboard from "@/components/analytics/CustomerRetentionDashboard";
import YearToDateKPIs from "@/components/reports/YearToDateKPIs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Trip } from "@/types/operations";
import { useQuery } from "@tanstack/react-query";

const PerformanceAnalytics = () => {
  // Fetch all trips for YTD calculations
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("departure_date", { ascending: false });

      if (error) throw error;
      return data as unknown as Trip[];
    },
  });
  return (
    <Layout>
      <div className="space-y-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="retention">Customer Retention</TabsTrigger>
            <TabsTrigger value="ytd">Year-to-Date KPIs</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Card>
              <CardHeader>
                <CardTitle>Performance Dashboard</CardTitle>
                <CardDescription>Real-time performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Performance dashboard will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention">
            {isLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Retention Dashboard</CardTitle>
                  <CardDescription>Loading trip data...</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Please wait while we load customer retention data.</p>
                </CardContent>
              </Card>
            ) : (
              <CustomerRetentionDashboard trips={trips} />
            )}
          </TabsContent>

          <TabsContent value="ytd">
            {isLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Year-to-Date KPIs</CardTitle>
                  <CardDescription>Loading trip data...</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Please wait while we load your performance data.</p>
                </CardContent>
              </Card>
            ) : (
              <YearToDateKPIs trips={trips} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PerformanceAnalytics;