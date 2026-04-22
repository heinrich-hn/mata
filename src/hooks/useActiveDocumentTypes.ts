import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Entity = 'drivers' | 'vehicles';

const queryKey = (entity: Entity, id: string | undefined) =>
    ['active-document-types', entity, id] as const;

export const useActiveDocumentTypes = (entity: Entity, id: string | undefined) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: activeTypes = [], isLoading } = useQuery<string[]>({
        queryKey: queryKey(entity, id),
        queryFn: async () => {
            if (!id) return [];
            const { data, error } = await supabase
                .from(entity)
                .select('active_document_types')
                .eq('id', id)
                .single();
            if (error) throw error;
            return ((data as { active_document_types: string[] | null })?.active_document_types) || [];
        },
        enabled: !!id,
        staleTime: 60 * 1000,
    });

    const setActive = useMutation({
        mutationFn: async ({ docType, active }: { docType: string; active: boolean }) => {
            if (!id) throw new Error('Missing id');
            const next = active
                ? Array.from(new Set([...(activeTypes || []), docType]))
                : (activeTypes || []).filter((t) => t !== docType);
            const { error } = await supabase
                .from(entity)
                // Cast: Supabase generated types accept string[] for this column.
                .update({ active_document_types: next } as never)
                .eq('id', id);
            if (error) throw error;
            return next;
        },
        onSuccess: (next) => {
            queryClient.setQueryData(queryKey(entity, id), next);
            // Invalidate alert queries so banners refresh.
            queryClient.invalidateQueries({ queryKey: ['driver-doc-alerts'] });
            queryClient.invalidateQueries({ queryKey: ['vehicle-doc-alerts'] });
        },
        onError: (err) => {
            toast({
                title: 'Failed to update tracked documents',
                description: err instanceof Error ? err.message : String(err),
                variant: 'destructive',
            });
        },
    });

    const isActive = (docType: string) => (activeTypes || []).includes(docType);

    return {
        activeTypes,
        isActive,
        isLoading,
        toggleActive: (docType: string, active: boolean) =>
            setActive.mutate({ docType, active }),
        isUpdating: setActive.isPending,
    };
};
