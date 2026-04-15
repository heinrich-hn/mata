import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Invalidates the given query keys every time this component mounts.
 * This ensures data is fresh when switching between bottom-nav tabs,
 * even within the 5-minute staleTime window.
 *
 * Pass the same query keys that your page's handleRefresh invalidates.
 */
export function useRefreshOnFocus(queryKeys: string[][]) {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Invalidate on mount — triggers background refetch if data is stale
        // or if it was modified elsewhere.
        queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only on mount — intentionally empty deps
}