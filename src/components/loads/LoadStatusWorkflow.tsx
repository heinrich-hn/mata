/**
 * Load Status Workflow Component
 * Provides the status update workflow for loads, including status indicators and actions
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
// Import isPending directly from the hook result type for clarity
import { LOAD_STATUS_WORKFLOW, STATUS_STEPS, type LoadStatus } from '@/constants/loadStatusWorkflow';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';

interface LoadStatusWorkflowProps {
  loadId: string;
  currentStatus: LoadStatus;
  loadNumber?: string;
}

export const LoadStatusWorkflow: React.FC<LoadStatusWorkflowProps> = ({
  loadId,
  currentStatus,
  loadNumber
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentIndex = LOAD_STATUS_WORKFLOW.indexOf(currentStatus);
  const nextStatus = LOAD_STATUS_WORKFLOW[currentIndex + 1];

  // Mutation to update load status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: LoadStatus) => {
      const updatedData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Set timestamps for specific statuses
      setStatusTimestamps(updatedData, newStatus);

      const { data, error } = await supabase
        .from('loads')
        .update(updatedData)
        .eq('id', loadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => handleSuccess(nextStatus),
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  });

  // FIX 1: Replace isLoading with isPending
  const updateStatusPending = updateStatusMutation.isPending;

  const handleStatusUpdate = (newStatus: LoadStatus) => {
    const step = STATUS_STEPS[newStatus];
    if (step.requiresConfirmation && !confirm(`Confirm: ${step.description}?`)) {
      return;
    }
    updateStatusMutation.mutate(newStatus);
  };

  const setStatusTimestamps = (data: Record<string, unknown>, newStatus: LoadStatus) => {
    const timestamp = new Date().toISOString();
    const timestampKeys: Record<LoadStatus, string | undefined> = {
      'arrived_at_loading': 'arrived_at_pickup',
      'loading': 'loading_started_at',
      'loading_completed': 'loading_completed_at',
      'in_transit': 'departure_time',
      'arrived_at_delivery': 'arrived_at_delivery',
      'offloading': 'offloading_started_at',
      'offloading_completed': 'offloading_completed_at',
      'delivered': 'delivered_at',
      'completed': 'completed_at',
      // Ensure all statuses are covered
      'pending': undefined,
      'assigned': undefined,
    };

    const key = timestampKeys[newStatus];
    if (key) {
      data[key] = timestamp;
    }
  };

  const handleSuccess = (newStatus: LoadStatus) => {
    queryClient.invalidateQueries({ queryKey: ['loads'] });
    queryClient.invalidateQueries({ queryKey: ['load', loadId] });

    const step = STATUS_STEPS[newStatus];
    toast({
      title: '✅ Status Updated',
      description: `${loadNumber || 'Load'} → ${step.label}`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Load Status</span>
          <Badge className={STATUS_STEPS[currentStatus].color}>
            {STATUS_STEPS[currentStatus].label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <StatusTimeline
          currentIndex={currentIndex}
          currentStatus={currentStatus}
          nextStatus={nextStatus}
          handleStatusUpdate={handleStatusUpdate}
          // FIX 1: Use updateStatusPending (derived from isPending)
          updateStatusPending={updateStatusPending}
        />

        <CurrentStatus
          currentStatus={currentStatus}
          nextStatus={nextStatus}
        />

        {nextStatus && (
          <QuickActionButton
            nextStatus={nextStatus}
            // FIX 1: Use updateStatusPending (derived from isPending)
            updateStatusPending={updateStatusPending}
            handleStatusUpdate={handleStatusUpdate}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Status Timeline Component
const StatusTimeline: React.FC<{
  currentIndex: number;
  currentStatus: LoadStatus;
  nextStatus?: LoadStatus;
  handleStatusUpdate: (status: LoadStatus) => void;
  updateStatusPending: boolean;
}> = ({ currentIndex, currentStatus: _currentStatus, nextStatus: _nextStatus, handleStatusUpdate, updateStatusPending }) => {
  return (
    <div className="relative">
      <div className="space-y-3">
        {LOAD_STATUS_WORKFLOW.map((status, index) => {
          const step = STATUS_STEPS[status];
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isNext = index === currentIndex + 1;

          return (
            <div key={status} className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isCurrent ? step.color + ' text-white' :
                  'bg-gray-200 text-gray-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1">
                <p className={`font-medium ${isCurrent ? 'text-primary' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>

              {isNext && (
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate(status)}
                  disabled={updateStatusPending}
                  className={step.color}
                >
                  {updateStatusPending ? 'Updating...' : 'Update'}
                </Button>
              )}

              {isCompleted && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Current Status Component
const CurrentStatus: React.FC<{ currentStatus: LoadStatus; nextStatus?: LoadStatus; }> = ({ currentStatus, nextStatus }) => {
  const step = STATUS_STEPS[currentStatus];

  return (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${step.color} text-white`}>
          <step.icon className="h-4 w-4" />
        </div>
        <div>
          <h4 className="font-semibold text-blue-900">Current: {step.label}</h4>
          <p className="text-sm text-blue-700">{step.description}</p>
          {nextStatus && (
            <p className="text-xs text-blue-600 mt-2">Next: {STATUS_STEPS[nextStatus].label}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Quick Action Button Component
const QuickActionButton: React.FC<{
  nextStatus: LoadStatus;
  updateStatusPending: boolean;
  handleStatusUpdate: (status: LoadStatus) => void;
}> = ({ nextStatus, updateStatusPending, handleStatusUpdate }) => {
  // FIX 2: Correctly extract the icon component from the map
  const NextIcon = STATUS_STEPS[nextStatus].icon;

  return (
    <Button
      className="w-full"
      size="lg"
      onClick={() => handleStatusUpdate(nextStatus)}
      disabled={updateStatusPending}
    >
      {updateStatusPending ? (
        'Updating...'
      ) : (
        <>
          Advance to: {STATUS_STEPS[nextStatus].label}
          {/* FIX 2: Use the extracted component */}
          <NextIcon className="h-4 w-4 ml-2" />
        </>
      )}
    </Button>
  );
};

export default LoadStatusWorkflow;
