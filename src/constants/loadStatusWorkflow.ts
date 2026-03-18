// src/constants/loadStatusWorkflow.ts

import { 
  MapPin, 
  Play, 
  CheckCircle2, 
  Truck, 
  Package,
  CircleDot,
  Clock
} from 'lucide-react';

// Define the complete status workflow (matching database enum values)
export const LOAD_STATUS_WORKFLOW = [
  'pending',
  'assigned',
  'arrived_at_loading',
  'loading',
  'loading_completed',
  'in_transit',
  'arrived_at_delivery',
  'offloading',
  'offloading_completed',
  'delivered',
  'completed'
] as const;

export type LoadStatus = typeof LOAD_STATUS_WORKFLOW[number];

// Display labels for each status (user-friendly)
export const STATUS_LABELS: Record<LoadStatus, string> = {
  'pending': 'Pending',
  'assigned': 'Assigned',
  'arrived_at_loading': 'Arrived at Loading Point',
  'loading': 'Start Loading',
  'loading_completed': 'Loading Completed',
  'in_transit': 'In Transit',
  'arrived_at_delivery': 'Arrived at Offloading Point',
  'offloading': 'Offloading',
  'offloading_completed': 'Offloading Completed',
  'delivered': 'Delivered',
  'completed': 'Completed'
};

export interface StatusStep {
  status: LoadStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  requiresConfirmation?: boolean;
}

export const STATUS_STEPS: Record<LoadStatus, StatusStep> = {
  'pending': {
    status: 'pending',
    label: 'Pending',
    icon: Clock,
    color: 'bg-gray-500',
    description: 'Load created, awaiting assignment'
  },
  'assigned': {
    status: 'assigned',
    label: 'Assigned',
    icon: CircleDot,
    color: 'bg-blue-500',
    description: 'Vehicle and driver assigned'
  },
  'arrived_at_loading': {
    status: 'arrived_at_loading',
    label: 'Arrived at Loading Point',
    icon: MapPin,
    color: 'bg-purple-500',
    description: 'Vehicle arrived at pickup location'
  },
  'loading': {
    status: 'loading',
    label: 'Start Loading',
    icon: Play,
    color: 'bg-indigo-500',
    description: 'Loading process has begun',
    requiresConfirmation: true
  },
  'loading_completed': {
    status: 'loading_completed',
    label: 'Loading Completed',
    icon: CheckCircle2,
    color: 'bg-teal-500',
    description: 'All cargo loaded successfully',
    requiresConfirmation: true
  },
  'in_transit': {
    status: 'in_transit',
    label: 'In Transit',
    icon: Truck,
    color: 'bg-green-500',
    description: 'En route to destination'
  },
  'arrived_at_delivery': {
    status: 'arrived_at_delivery',
    label: 'Arrived at Offloading Point',
    icon: MapPin,
    color: 'bg-amber-500',
    description: 'Vehicle arrived at delivery location'
  },
  'offloading': {
    status: 'offloading',
    label: 'Offloading',
    icon: Package,
    color: 'bg-orange-500',
    description: 'Unloading cargo',
    requiresConfirmation: true
  },
  'offloading_completed': {
    status: 'offloading_completed',
    label: 'Offloading Completed',
    icon: CheckCircle2,
    color: 'bg-emerald-500',
    description: 'All cargo unloaded',
    requiresConfirmation: true
  },
  'delivered': {
    status: 'delivered',
    label: 'Delivered',
    icon: CheckCircle2,
    color: 'bg-green-600',
    description: 'Delivery confirmed'
  },
  'completed': {
    status: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    color: 'bg-green-700',
    description: 'Load fully completed'
  }
};