// hooks/useRealtimeMaintenanceAlerts.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface MaintenanceAlert {
  id: string;
  alert_type: string;
  message: string;
  due_date: string;
  alert_time: string;
  delivery_status: string;
  hours_until_due?: number;
  maintenance_schedules?: {
    title: string;
    vehicle_id: string;
    priority: string;
  };
}

export function useRealtimeMaintenanceAlerts() {
  const [latestAlert, setLatestAlert] = useState<MaintenanceAlert | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('realtime-maintenance-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'maintenance_alerts',
          filter: `delivery_status=eq.pending`,
        },
        (payload) => {
          const newAlert = payload.new as MaintenanceAlert;
          setLatestAlert(newAlert);
          setAlertCount(prev => prev + 1);

          // Show browser notification
          if (Notification.permission === 'granted') {
            const notification = new Notification('🚛 Matanuska Maintenance Alert', {
              body: newAlert.message,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `alert-${newAlert.id}`,
              requireInteraction: true,
            });

            notification.onclick = () => {
              window.focus();
              navigate('/maintenance');
            };
          }

          // Show toast notification
          toast({
            title: getAlertTitle(newAlert.alert_type),
            description: newAlert.message,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, navigate]);

  const getAlertTitle = (type: string) => {
    switch (type) {
      case 'overdue':
        return '⚠️ Overdue Maintenance';
      case 'upcoming':
        return '⏰ Upcoming Maintenance';
      default:
        return '📋 Maintenance Alert';
    }
  };

  return { latestAlert, alertCount };
}