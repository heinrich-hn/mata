import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  RefreshCw,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface PendingRecord {
  id: string;
  fleet_number: string;
  driver_name: string;
  date: string;
  days_old: number;
}

export default function DieselAlertsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: records = [], isLoading, refetch, isRefetching } = useQuery<PendingRecord[]>({
    queryKey: ["pending-debriefs"],
    queryFn: async () => {
      // Get all diesel records that are NOT debriefed AND have valid fleet/driver
      const { data, error } = await supabase
        .from("diesel_records")
        .select("id, fleet_number, driver_name, date")
        .eq("debrief_signed", false)
        .not("fleet_number", "is", null)
        .not("fleet_number", "eq", "")
        .not("driver_name", "is", null)
        .not("driver_name", "eq", "")
        .order("date", { ascending: false });

      if (error) throw error;

      // Calculate days old
      const today = new Date();
      return (data || []).map(record => {
        const recordDate = new Date(record.date);
        const daysOld = Math.ceil((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: record.id,
          fleet_number: record.fleet_number,
          driver_name: record.driver_name,
          date: record.date,
          days_old: daysOld,
        };
      });
    },
    refetchInterval: 30000,
  });

  // Calculate stats based only on valid records
  const stats = {
    total: records.length,
    critical: records.filter(r => r.days_old >= 14).length,
    high: records.filter(r => r.days_old >= 7 && r.days_old < 14).length,
    medium: records.filter(r => r.days_old >= 3 && r.days_old < 7).length,
    low: records.filter(r => r.days_old < 3).length,
  };

  // Set up realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('diesel-records-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'diesel_records',
          filter: 'debrief_signed=eq.true',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pending-debriefs"] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const getUrgencyBadge = (daysOld: number) => {
    if (daysOld >= 14) {
      return <Badge variant="destructive">Critical</Badge>;
    } else if (daysOld >= 7) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>;
    } else if (daysOld >= 3) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
    } else {
      return <Badge variant="outline">Low</Badge>;
    }
  };

  const getDaysBadge = (daysOld: number) => {
    if (daysOld >= 14) {
      return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 font-medium">{daysOld} days</Badge>;
    } else if (daysOld >= 7) {
      return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 font-medium">{daysOld} days</Badge>;
    } else if (daysOld >= 3) {
      return <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700 font-medium">{daysOld} days</Badge>;
    } else {
      return <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-medium">{daysOld} days</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading pending debriefs…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Pending Debriefs</h1>
                <p className="text-sm text-muted-foreground">
                  {stats.total} record{stats.total !== 1 ? 's' : ''} awaiting debrief
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 px-6 py-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">Critical (14+ days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
              <p className="text-xs text-muted-foreground">High (7-13 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
              <p className="text-xs text-muted-foreground">Medium (3-6 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.low}</div>
              <p className="text-xs text-muted-foreground">Low (0-2 days)</p>
            </CardContent>
          </Card>
        </div>

        {/* Records Grid */}
        <div className="flex-1 min-h-0 px-6 pb-6">
          {stats.total === 0 ? (
            <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/10">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-medium mb-2">All Caught Up</h3>
                <p className="text-sm text-muted-foreground">
                  No pending debriefs at this time
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.map((record) => (
                <Card
                  key={record.id}
                  className={cn(
                    "hover:shadow-md transition-shadow cursor-pointer",
                    selectedId === record.id && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedId(selectedId === record.id ? null : record.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-lg font-semibold">{record.fleet_number}</span>
                        <p className="text-sm text-muted-foreground">{record.driver_name}</p>
                      </div>
                      {getDaysBadge(record.days_old)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {format(new Date(record.date), "MMMM dd, yyyy")}
                    </p>

                    <div className="flex items-center justify-between">
                      {getUrgencyBadge(record.days_old)}
                      <Link to={`/monitor/diesel-records/${record.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="h-8">
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                    </div>

                    {selectedId === record.id && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        <p className="text-muted-foreground">
                          Record from {format(new Date(record.date), "MMMM dd, yyyy")} needs debriefing.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}