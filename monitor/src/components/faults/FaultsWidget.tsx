import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Wrench, Clock } from 'lucide-react'; // Removed CheckCircle
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

export function FaultsWidget() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['fault-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_faults')
        .select('status, severity')
        .in('status', ['identified', 'acknowledged']);

      if (error) throw error;

      const critical = data.filter(f => f.severity === 'critical').length;
      const high = data.filter(f => f.severity === 'high').length;
      const identified = data.filter(f => f.status === 'identified').length;
      const acknowledged = data.filter(f => f.status === 'acknowledged').length;

      return {
        total: data.length,
        critical,
        high,
        identified,
        acknowledged,
      };
    },
    refetchInterval: 30000,
  });

  if (!stats?.total) {
    return null;
  }

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/faults')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Active Faults
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{stats.total}</span>
            <Badge variant="destructive" className="text-xs">
              {stats.critical} critical
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span>{stats.identified} identified</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3 text-amber-600" />
              <span>{stats.acknowledged} acknowledged</span>
            </div>
          </div>

          {stats.high > 0 && (
            <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 p-2 rounded-lg">
              {stats.high} high severity fault{stats.high > 1 ? 's' : ''} need attention
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}