// components/maintenance/MaintenanceNotifications.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { AlertTriangle, Bell, Calendar, CheckCircle, Clock, Snowflake, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

type AlertRow = Database["public"]["Tables"]["maintenance_alerts"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["maintenance_schedules"]["Row"];

interface MaintenanceAlert extends AlertRow {
  maintenance_schedules: Pick<ScheduleRow, "title" | "vehicle_id" | "priority" | "maintenance_type"> | null;
}

export function MaintenanceNotifications() {
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();

    // Real-time subscription for new alerts
    const channel = supabase
      .channel('maintenance_alerts_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'maintenance_alerts',
          filter: `delivery_status=eq.pending`,
        },
        (payload) => {
          console.log('New maintenance alert:', payload);
          fetchAlerts();

          // Show browser notification
          if (Notification.permission === 'granted') {
            const alert = payload.new as MaintenanceAlert;
            new Notification('⚠️ Maintenance Alert', {
              body: alert.message,
              icon: '/icon-192.png',
              tag: 'maintenance-alert',
            });
          }

          // Show toast notification
          toast({
            title: "New Maintenance Alert",
            description: payload.new.message,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('maintenance_alerts')
      .select(`
        *,
        maintenance_schedules (
          title,
          vehicle_id,
          priority,
          maintenance_type
        )
      `)
      .in('delivery_status', ['sent', 'delivered', 'pending'])
      .is('acknowledged_at', null)
      .order('alert_time', { ascending: false })
      .limit(50);

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
      toast({
        title: "Alert Acknowledged",
        description: "Maintenance alert has been acknowledged",
      });
    }
  };

  const acknowledgeAll = async () => {
    const alertIds = alerts.map(a => a.id);
    if (alertIds.length === 0) return;

    const { error } = await supabase
      .from('maintenance_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        delivery_status: 'acknowledged',
      })
      .in('id', alertIds);

    if (!error) {
      fetchAlerts();
      toast({
        title: "All Alerts Cleared",
        description: `${alertIds.length} alerts have been acknowledged`,
      });
    }
  };

  const getAlertIcon = (alertType: string, priority?: string) => {
    if (alertType === 'overdue') {
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    }
    if (priority === 'high' || priority === 'critical') {
      return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    }
    if (alertType === 'upcoming') {
      return <Calendar className="h-5 w-5 text-warning" />;
    }
    return <Bell className="h-5 w-5" />;
  };

  const getAlertColor = (alertType: string, priority?: string) => {
    if (alertType === 'overdue') {
      return 'border-destructive/50 bg-destructive/5';
    }
    if (priority === 'high' || priority === 'critical') {
      return 'border-orange-500/50 bg-orange-500/5';
    }
    if (alertType === 'upcoming') {
      return 'border-warning/50 bg-warning/5';
    }
    return 'border-border';
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;

    const colors = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };

    return (
      <Badge className={`${colors[priority as keyof typeof colors] || 'bg-gray-500'} text-white text-xs`}>
        {priority}
      </Badge>
    );
  };

  const getMaintenanceIcon = (type?: string) => {
    if (type === 'reefer') {
      return <Snowflake className="h-3 w-3" />;
    }
    return <Truck className="h-3 w-3" />;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
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
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
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
                  className={`p-4 rounded-lg border ${getAlertColor(alert.alert_type, alert.maintenance_schedules?.priority)} relative transition-all hover:shadow-md`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive/10"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="flex items-start gap-3 pr-8">
                    <div className="flex-shrink-0">
                      {getAlertIcon(alert.alert_type, alert.maintenance_schedules?.priority)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">
                          {alert.alert_type}
                        </Badge>
                        {getPriorityBadge(alert.maintenance_schedules?.priority)}
                        {alert.maintenance_schedules?.maintenance_type && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            {getMaintenanceIcon(alert.maintenance_schedules.maintenance_type)}
                            {alert.maintenance_schedules.maintenance_type}
                          </Badge>
                        )}
                      </div>

                      <h4 className="font-semibold text-sm">
                        {alert.maintenance_schedules?.title || 'Scheduled Maintenance'}
                      </h4>

                      <p className="text-sm text-muted-foreground">
                        {alert.message}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Vehicle ID: {alert.maintenance_schedules?.vehicle_id || 'N/A'}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Due: {format(new Date(alert.due_date), 'MMM dd, yyyy')}
                        </span>
                        {alert.hours_until_due !== null && alert.hours_until_due > 0 && (
                          <span className="flex items-center gap-1 text-warning">
                            <Clock className="h-3 w-3" />
                            {Math.round(alert.hours_until_due)}h remaining
                          </span>
                        )}
                        {alert.hours_until_due !== null && alert.hours_until_due <= 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Alert sent: {format(new Date(alert.alert_time), 'MMM dd, HH:mm')}
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