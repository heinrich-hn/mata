import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { AlertTriangle, Bell, Calendar, CheckCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

type AlertRow = Database["public"]["Tables"]["maintenance_alerts"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["maintenance_schedules"]["Row"];

interface MaintenanceAlert extends AlertRow {
  maintenance_schedules: Pick<ScheduleRow, "service_type" | "vehicle_id"> | null;
}

export function MaintenanceNotifications() {
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchAlerts();

    const channel = supabase
      .channel('maintenance_alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('maintenance_alerts')
      .select(`
        *,
        maintenance_schedules (
          service_type,
          vehicle_id
        )
      `)
      .in('delivery_status', ['sent', 'delivered'])
      .is('acknowledged_at', null)
      .order('alert_time', { ascending: false })
      .limit(20);

    if (!error && data) {
      setAlerts(data);
      setUnreadCount(data.length);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('maintenance_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        delivery_status: 'acknowledged',
      })
      .eq('id', alertId);

    if (!error) {
      fetchAlerts();
    }
  };

  const acknowledgeAll = async () => {
    const alertIds = alerts.map(a => a.id);

    const { error } = await supabase
      .from('maintenance_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        delivery_status: 'acknowledged',
      })
      .in('id', alertIds);

    if (!error) {
      fetchAlerts();
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'overdue':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'upcoming':
        return <Calendar className="h-5 w-5 text-warning" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-success" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getAlertColor = (alertType: string) => {
    switch (alertType) {
      case 'overdue':
        return 'border-destructive/50 bg-destructive/5';
      case 'upcoming':
        return 'border-warning/50 bg-warning/5';
      case 'completed':
        return 'border-success/50 bg-success/5';
      default:
        return 'border-border';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Maintenance Alerts
            </span>
            {alerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={acknowledgeAll}
                className="text-xs"
              >
                Clear All
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground/80 mt-1">
                No pending maintenance alerts
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${getAlertColor(alert.alert_type)} relative`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="flex items-start gap-3 pr-8">
                    {getAlertIcon(alert.alert_type)}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {alert.alert_type}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-sm">
                        {alert.maintenance_schedules?.service_type || 'Scheduled Maintenance'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Vehicle ID: {alert.maintenance_schedules?.vehicle_id || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Due: {format(new Date(alert.due_date), 'MMM dd, yyyy')}
                        </span>
                        {alert.hours_until_due && alert.hours_until_due > 0 && (
                          <span className="text-warning">
                            • {Math.round(alert.hours_until_due)}h remaining
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
