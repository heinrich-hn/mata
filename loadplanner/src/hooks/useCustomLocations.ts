import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface CustomLocation {
  id: string;
  name: string;
  address: string | null;  // Added
  city: string | null;     // Added
  province: string | null; // Added
  country: 'Zimbabwe' | 'South Africa' | 'Mozambique' | 'Zambia' | 'Botswana' | null; // Made nullable to match DB
  latitude: number | null;  // Made nullable to match DB
  longitude: number | null; // Made nullable to match DB
  type: 'depot' | 'warehouse' | 'market' | 'border' | 'farm' | 'customer' | null; // Made nullable
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Removed radius and created_by as they don't exist in DB
}

export interface CustomLocationInsert {
  name: string;
  latitude?: number | null;  // Made optional
  longitude?: number | null; // Made optional
  address?: string | null;   // Added
  city?: string | null;      // Added
  province?: string | null;  // Added
  country?: CustomLocation['country'];
  type?: CustomLocation['type'];
  notes?: string | null;
  // Removed radius
}

// Fetch all custom locations
export function useCustomLocations() {
  return useQuery({
    queryKey: ['custom-locations'],
    queryFn: async () => {
      console.log('Fetching custom locations...');
      
      const { data, error } = await supabase
        .from('custom_locations')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // No need to parse latitude/longitude since they're already numbers from numeric type
      return data as CustomLocation[];
    },
  });
}

// Create a new custom location
export function useCreateCustomLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (location: CustomLocationInsert) => {
      // Remove any fields that don't exist in the database
      const { ...dbFields } = location;
      
      const { data, error } = await supabase
        .from('custom_locations')
        .insert({
          name: dbFields.name,
          latitude: dbFields.latitude,
          longitude: dbFields.longitude,
          address: dbFields.address,
          city: dbFields.city,
          province: dbFields.province,
          type: dbFields.type || 'depot',
          country: dbFields.country || 'Zimbabwe',
          notes: dbFields.notes,
          is_active: true, // Set default
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-locations'] });
      toast({ title: 'Location added successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to add location', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Update a custom location
export function useUpdateCustomLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomLocation> & { id: string }) => {
      // Remove any fields that don't exist or shouldn't be updated
      const { created_at: _created_at, updated_at: _updated_at, ...updateFields } = updates;
      
      const { data, error } = await supabase
        .from('custom_locations')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-locations'] });
      toast({ title: 'Location updated successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to update location', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Delete a custom location (soft delete)
export function useDeleteCustomLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_locations')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-locations'] });
      toast({ title: 'Location removed successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to remove location', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Hard delete a custom location
export function useHardDeleteCustomLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_locations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-locations'] });
      toast({ title: 'Location permanently deleted' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to delete location', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}