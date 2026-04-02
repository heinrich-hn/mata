import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, UserCheck } from 'lucide-react';

interface InspectorProfile {
    id: string;
    name: string;
    email: string | null;
}

interface InspectorSelectProps {
    value?: string;
    onValueChange: (name: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export const InspectorSelect = ({
    value,
    onValueChange,
    placeholder = 'Select person...',
    disabled = false,
}: InspectorSelectProps) => {
    const { data: inspectors = [], isLoading, error } = useQuery<InspectorProfile[]>({
        queryKey: ['inspector_profiles'],
        queryFn: async (): Promise<InspectorProfile[]> => {
            const { data, error } = await supabase
                .from('inspector_profiles')
                .select('id, name, email')
                .order('name');

            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const currentInspector = inspectors.find(i => i.name === value);

    if (isLoading) {
        return (
            <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading profiles...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center h-10 px-3 rounded-md border border-destructive bg-destructive/10">
                <span className="text-sm text-destructive">Error loading profiles</span>
            </div>
        );
    }

    return (
        <Select
            value={value ?? ''}
            onValueChange={onValueChange}
            disabled={disabled}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder}>
                    {currentInspector ? (
                        <span className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            {currentInspector.name}
                        </span>
                    ) : value ? (
                        <span className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            {value}
                        </span>
                    ) : (
                        placeholder
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {inspectors.length === 0 ? (
                    <SelectItem value="__no_profiles__" disabled>
                        <span className="text-sm text-muted-foreground">No profiles found. Add profiles in Inspector Management.</span>
                    </SelectItem>
                ) : (
                    inspectors.map((inspector) => (
                        <SelectItem key={inspector.id} value={inspector.name}>
                            <span className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                {inspector.name}
                                {inspector.email && (
                                    <span className="text-muted-foreground text-xs">({inspector.email})</span>
                                )}
                            </span>
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
};

export default InspectorSelect;
