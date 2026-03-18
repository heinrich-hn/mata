import { useToast } from "@/hooks/use-toast";
import { QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";

type MutationContext<TData> = { previousData: TData | undefined };

type OptimisticMutationOptions<TData, TError, TVariables> = {
  /**
   * Query key to invalidate and update optimistically
   */
  queryKey: QueryKey;

  /**
   * The mutation function
   */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * Function to update the cache optimistically before the mutation
   */
  optimisticUpdate?: (currentData: TData | undefined, variables: TVariables) => TData;

  /**
   * Success message to show in toast
   */
  successMessage?: string;

  /**
   * Error message to show in toast
   */
  errorMessage?: string;

  /**
   * Whether to show toast notifications (default: true)
   */
  showToast?: boolean;

  /**
   * Additional query keys to invalidate on success
   */
  invalidateKeys?: QueryKey[];

  /**
   * Callback fired when mutation succeeds
   */
  onSuccess?: (data: TData, variables: TVariables, context: MutationContext<TData> | undefined) => void;

  /**
   * Callback fired when mutation fails
   */
  onError?: (error: TError, variables: TVariables, context: MutationContext<TData> | undefined) => void;

  /**
   * Callback fired when mutation completes (success or error)
   */
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: MutationContext<TData> | undefined) => void;
};

/**
 * Custom hook for optimistic mutations with automatic cache updates
 *
 * @example
 * const updateTrip = useOptimisticMutation({
 *   queryKey: ['trips'],
 *   mutationFn: (data) => supabase.from('trips').update(data).eq('id', data.id),
 *   optimisticUpdate: (trips, updatedTrip) =>
 *     trips?.map(t => t.id === updatedTrip.id ? { ...t, ...updatedTrip } : t),
 *   successMessage: 'Trip updated successfully',
 * });
 */
export function useOptimisticMutation<
  TData = unknown,
  TError = Error,
  TVariables = void
>({
  queryKey,
  mutationFn,
  optimisticUpdate,
  successMessage,
  errorMessage = 'An error occurred',
  showToast = true,
  invalidateKeys = [],
  onSuccess: userOnSuccess,
  onError: userOnError,
  onSettled: userOnSettled,
}: OptimisticMutationOptions<TData, TError, TVariables>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<TData, TError, TVariables, { previousData: TData | undefined }>({
    mutationFn,

    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update the cache
      if (optimisticUpdate && previousData !== undefined) {
        queryClient.setQueryData<TData>(queryKey, (old) =>
          optimisticUpdate(old, variables)
        );
      }

      // Return context with the snapshotted value
      return { previousData };
    },

    onError: (error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }

      if (showToast) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : errorMessage,
          variant: 'destructive',
        });
      }

      // Call the user's onError if provided
      if (userOnError) {
        userOnError(error, variables, context);
      }
    },

    onSettled: (data, error, variables, context) => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey });

      // Invalidate additional keys
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Call the user's onSettled if provided
      if (userOnSettled) {
        userOnSettled(data, error, variables, context);
      }
    },

    onSuccess: (data, variables, context) => {
      if (showToast && successMessage) {
        toast({
          title: 'Success',
          description: successMessage,
        });
      }

      // Call the user's onSuccess if provided
      if (userOnSuccess) {
        userOnSuccess(data, variables, context);
      }
    },
  });
}