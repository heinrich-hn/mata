import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, DollarSign, Clock, Fuel, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { TripAlertMetadata } from '@/types/tripAlerts';
import { navigateToTrip } from '@/lib/crossAppNavigation';

export function TripAlertsDashboard() {
  const navigate = useNavigate();

  const { data: alerts, refetch } = useQuery({
    queryKey: ['trip-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .in('category', ['duplicate_pod', 'load_exception', 'fuel_anomaly'])
        .eq('status', 'active') // Only fetch active alerts
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds - alerts will disappear when status changes to resolved
  });

  const getAlertIcon = (category: string) => {
    switch (category) {
      case 'duplicate_pod':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'load_exception':
        return <DollarSign className="h-4 w-4 text-amber-600" />;
      case 'trip_delay':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'fuel_anomaly':
        return <Fuel className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (!alerts?.length) {
    return null; // Don't show anything if no active alerts
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Active Trip Alerts</CardTitle>
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
              onClick={() => metadata?.trip_id ? navigateToTrip(metadata.trip_id) : navigate(`/alerts/${alert.id}`)}
            >
              <div className="mt-0.5">{getAlertIcon(alert.category)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium truncate">{alert.title}</p>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  Trip {metadata.trip_number}: {alert.message}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}