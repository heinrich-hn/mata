import { cn } from '@/lib/utils';
import type { LoadStatus } from '@/types/Trips';
import { AlertCircle, CheckCircle2, Clock, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { memo } from 'react';

interface StatusBadgeProps {
  status: LoadStatus;
  size?: 'sm' | 'md';
  hasArrivalTime?: boolean;
}

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  dataStatus: string;
}

const statusConfig: Record<string, StatusConfig> = {
  scheduled: {
    label: 'Scheduled',
    icon: Clock,
    dataStatus: 'scheduled',
  },
  'in-transit': {
    label: 'In Transit',
    icon: Truck,
    dataStatus: 'in-transit',
  },
  pending: {
    label: 'Pending',
    icon: AlertCircle,
    dataStatus: 'pending',
  },
  delivered: {
    label: 'Delivered',
    icon: CheckCircle2,
    dataStatus: 'delivered',
  },
  arrived: {
    label: 'Arrived',
    icon: Truck,
    dataStatus: 'arrived',
  },
};

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: '',
} as const;

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
} as const;

function getStatusConfig(status: LoadStatus, hasArrivalTime?: boolean): StatusConfig {
  if (status === 'in-transit' && hasArrivalTime) {
    return statusConfig.arrived;
  }
  return statusConfig[status];
}

export const StatusBadge = memo(function StatusBadge({
  status,
  size = 'md',
  hasArrivalTime
}: StatusBadgeProps) {
  const config = getStatusConfig(status, hasArrivalTime);
  const Icon = config.icon;

  return (
    <span
      className={cn('status-badge', sizeClasses[size])}
      data-status={config.dataStatus}
    >
      <Icon className={cn('shrink-0', iconSizes[size])} />
      {config.label}
    </span>
  );
});
