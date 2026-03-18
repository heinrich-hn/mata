// src/components/loads/LoadRealtimeIndicator.tsx

import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Visual indicator showing real-time connection status
 */
export const LoadRealtimeIndicator = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Monitor connection status
    const channel = supabase.channel('connection-monitor');

    channel
      .on('system', {}, (payload) => {
        if (payload.status === 'SUBSCRIBED') {
          setIsConnected(true);
          setLastUpdate(new Date());
        } else if (payload.status === 'CHANNEL_ERROR' || payload.status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isConnected) {
    return (
      <Badge variant="destructive" className="gap-1">
        <WifiOff className="h-3 w-3" />
        Disconnected
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-1 bg-green-600">
      <Wifi className="h-3 w-3 animate-pulse" />
      Live
      {lastUpdate && (
        <span className="text-xs opacity-75">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </Badge>
  );
};
