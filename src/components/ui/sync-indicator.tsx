import { cn } from '@/lib/utils';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface SyncIndicatorProps {
  status?: 'connected' | 'reconnecting' | 'disconnected';
  className?: string;
}

const SyncIndicator = ({
  status = 'connected',
  className,
}: SyncIndicatorProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          className: 'text-success',
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          text: 'Reconnecting...',
          className: 'text-warning animate-spin',
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          text: 'Offline',
          className: 'text-destructive',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Icon className={cn('w-4 h-4', config.className)} />
      <span className={cn('text-sm', config.className)}>{config.text}</span>
    </div>
  );
};

export default SyncIndicator;
