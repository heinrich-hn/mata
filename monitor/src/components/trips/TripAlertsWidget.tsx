import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, DollarSign, Clock, Fuel, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { TripAlertMetadata } from '@/types/tripAlerts';

export function TripAlertsWidget() {
  const navigate = useNavigate();

  const { data: alerts, refetch } = useQuery({
    queryKey: ['trip-alerts-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .in('category', ['duplicate_pod', 'load_exception', 'trip_delay', 'fuel_anomaly'])
        .eq('status', 'active')
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3); // Show fewer in widget

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const getAlertIcon = (category: string) => {
    switch (category) {
      case 'duplicate_pod':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'load_exception':
        return <DollarSign className="h-4 w-4 text-amber-500" />;
      case 'trip_delay':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'fuel_anomaly':
        return <Fuel className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!alerts?.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Trip Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-2">No active alerts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Active Alerts ({alerts.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => {
          const metadata = alert.metadata as TripAlertMetadata;

          return (
            <div
              key={alert.id}
              className="flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/trips/${metadata.trip_id}`)}
            >
              <div className="mt-0.5">{getAlertIcon(alert.category)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{alert.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Trip {metadata.trip_number} • {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}