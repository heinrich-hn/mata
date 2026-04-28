import { COST_CATEGORIES } from '@/constants/costCategories';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface CostSubcategory {
    id: string;
    category_id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
}

export interface CostCategory {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    subcategories: CostSubcategory[];
}

interface DbCostCategory {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
}

interface DbCostSubcategory {
    id: string;
    category_id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
}

const QUERY_KEY = ['cost-categories'] as const;

const fallbackCategories = (): CostCategory[] => {
    return Object.entries(COST_CATEGORIES).map(([name, subs], cIdx) => ({
        id: `default-cat-${cIdx}`,
        name,
        sort_order: cIdx,
        is_active: true,
        subcategories: (subs as readonly string[]).map((s, sIdx) => ({
            id: `default-sub-${cIdx}-${sIdx}`,
            category_id: `default-cat-${cIdx}`,
            name: s,
            sort_order: sIdx,
            is_active: true,
        })),
    }));
};

const isMissingTable = (err: { code?: string; message?: string } | null) =>
    !!err && (err.code === '42P01' || (err.message?.includes('does not exist') ?? false));

// Fetch all cost categories with their subcategories. Falls back to the
// hard-coded constant when the DB tables don't exist yet.
export const useCostCategories = () => {
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: async (): Promise<CostCategory[]> => {
            const { data: cats, error: catErr } = await supabase
                .from('cost_categories' as never)
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (catErr) {
                if (isMissingTable(catErr)) return fallbackCategories();
                throw catErr;
            }
            if (!cats || cats.length === 0) return fallbackCategories();

            const { data: subs, error: subErr } = await supabase
                .from('cost_subcategories' as never)
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (subErr && !isMissingTable(subErr)) throw subErr;

            const subsByCat = ((subs as DbCostSubcategory[]) || []).reduce(
                (acc, s) => {
                    if (!acc[s.category_id]) acc[s.category_id] = [];
                    acc[s.category_id].push(s);
                    return acc;
                },
                {} as Record<string, DbCostSubcategory[]>,
            );

            return (cats as DbCostCategory[]).map((c) => ({
                id: c.id,
                name: c.name,
                sort_order: c.sort_order,
                is_active: c.is_active,
                subcategories: subsByCat[c.id] || [],
            }));
        },
        staleTime: 5 * 60 * 1000,
    });
};

// Convenience: returns a flat name list of category names (sorted).
export const useCostCategoryNames = (): string[] => {
    const { data = [] } = useCostCategories();
    return useMemo(() => data.map((c) => c.name), [data]);
};

// Convenience: returns subcategory names for a given category name.
export const useCostSubcategoryNames = (categoryName: string | undefined): string[] => {
    const { data = [] } = useCostCategories();
    return useMemo(() => {
        if (!categoryName) return [];
        const cat = data.find((c) => c.name === categoryName);
        return cat ? cat.subcategories.map((s) => s.name) : [];
    }, [data, categoryName]);
};

const isDefaultId = (id: string) => id.startsWith('default-');

// ─── Category mutations ───

export const useAddCostCategory = () => {
    const qc = useQueryClient();
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (input: { name: string; sort_order?: number }) => {
            const { data, error } = await supabase
                .from('cost_categories' as never)
                .insert([{ name: input.name.trim(), sort_order: input.sort_order ?? 999 }] as never)
                .select()
                .single();
            if (error) throw error;
            return data as DbCostCategory;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            toast({ title: 'Category added', description: 'New cost category created.' });
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        },
    });
};

export const useUpdateCostCategory = () => {
    const qc = useQueryClient();
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (input: { id: string; name?: string; sort_order?: number }) => {
            if (isDefaultId(input.id)) {
                throw new Error('Default categories are read-only. Save a custom version first.');
            }
            const payload: Record<string, unknown> = {};
            if (input.name !== undefined) payload.name = input.name.trim();
            if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
            const { error } = await supabase
                .from('cost_categories' as never)
                .update(payload as never)
                .eq('id', input.id);
            if (error) throw error;
            return input;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            toast({ title: 'Category updated' });
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        },
    });
};

export const useDeleteCostCategory = () => {
    const qc = useQueryClient();
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (id: string) => {
            if (isDefaultId(id)) {
                throw new Error('Default categories cannot be deleted.');
            }
            // Soft-delete so existing cost_entries that reference the name keep displaying it.
            const { error } = await supabase
                .from('cost_categories' as never)
                .update({ is_active: false } as never)
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            toast({ title: 'Category deleted' });
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        },
    });
};

// ─── Subcategory mutations ───

export const useAddCostSubcategory = () => {
    const qc = useQueryClient();
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (input: { category_id: string; name: string; sort_order?: number }) => {
            if (isDefaultId(input.category_id)) {
                throw new Error('Add the parent category as a custom entry before adding sub-categories.');
            }
            const { data, error } = await supabase
                .from('cost_subcategories' as never)
                .insert([
                    {
                        category_id: input.category_id,
                        name: input.name.trim(),
                        sort_order: input.sort_order ?? 999,
                    },
                ] as never)
                .select()
                .single();
            if (error) throw error;
            return data as DbCostSubcategory;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            toast({ title: 'Sub-category added' });
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        },
    });
};

export const useUpdateCostSubcategory = () => {
    const qc = useQueryClient();
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (input: { id: string; name?: string; sort_order?: number }) => {
            if (isDefaultId(input.id)) {
                throw new Error('Default sub-categories are read-only.');
            }
            const payload: Record<string, unknown> = {};
            if (input.name !== undefined) payload.name = input.name.trim();
            if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
            const { error } = await supabase
                .from('cost_subcategories' as never)
                .update(payload as never)
                .eq('id', input.id);
            if (error) throw error;
            return input;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            toast({ title: 'Sub-category updated' });
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        },
    });
};

export const useDeleteCostSubcategory = () => {
    const qc = useQueryClient();
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (id: string) => {
            if (isDefaultId(id)) {
                throw new Error('Default sub-categories cannot be deleted.');
            }
            const { error } = await supabase
                .from('cost_subcategories' as never)
                .update({ is_active: false } as never)
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            toast({ title: 'Sub-category deleted' });
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        },
    });
};
