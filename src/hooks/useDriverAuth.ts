import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export interface DriverWithAuthStatus {
  id: string;
  driver_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  auth_user_id: string | null;
  status: string;
}

interface CreateAuthProfileParams {
  driverId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export const useDriverAuth = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch drivers with auth status
  const {
    data: driversWithAuth = [],
    isLoading,
    refetch,
  } = useQuery<DriverWithAuthStatus[]>({
    queryKey: ['drivers', 'with-auth'],
    queryFn: async (): Promise<DriverWithAuthStatus[]> => {
      // Query basic driver info - auth_user_id may not exist until migration is run
      const { data, error } = await supabase
        .from('drivers')
        .select('id, driver_number, first_name, last_name, email, phone, status')
        .order('first_name');

      if (error) throw error;
      
      // Map to DriverWithAuthStatus, setting auth_user_id to null
      // Once migration is run, a separate query can fetch auth_user_id
      return (data || []).map(d => ({
        ...(d as unknown as DriverWithAuthStatus),
        auth_user_id: null, // Will be populated once migration is run
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch available roles for drivers
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('role_id, role_name')
        .order('role_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Get the Driver role ID
  const getDriverRoleId = (): number => {
    const driverRole = roles.find(r =>
      r.role_name.toLowerCase() === 'driver' ||
      r.role_name.toLowerCase() === 'drivers'
    );
    return driverRole?.role_id || 8; // Default fallback
  };

  // Create auth profile for driver
  const createAuthProfileMutation = useMutation({
    mutationFn: async ({ driverId, email, password, firstName, lastName }: CreateAuthProfileParams) => {
      // Step 1: Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: `${firstName} ${lastName}`,
            role: 'driver',
            driver_id: driverId,
          },
          // Don't auto sign in the new user (we want to stay as admin)
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Failed to create auth user');
      }

      const authUserId = authData.user.id;

      // Step 2: Generate username and shortcode
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, '');
      const shortcode = (firstName[0] + lastName.substring(0, 2)).toUpperCase();

      // Step 3: Create entry in users table
      const { error: usersError } = await supabase
        .from('users')
        .insert({
          name: `${firstName} ${lastName}`,
          username: username,
          shortcode: shortcode,
          notification_email: email,
          role_id: getDriverRoleId(),
          status: 'Active',
        } as never);

      if (usersError) {
        console.error('Users table insert error:', usersError);
        // Don't throw - the auth user is created, we can still link
      }

      // Step 4: Link auth user to driver AND update email + ensure active status
      const { error: linkError } = await supabase
        .from('drivers')
        .update({ 
          auth_user_id: authUserId, 
          email: email,
          status: 'active'  // Ensure driver is active so mobile app can find them
        } as never)
        .eq('id', driverId);

      if (linkError) {
        throw new Error(`Failed to link auth to driver: ${linkError.message}`);
      }

      return { authUserId, email, username };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({
        title: 'Mobile Profile Created',
        description: `Auth profile created for ${data.email}. Driver can now log in to the mobile app.`,
      });
    },
    onError: (error: Error) => {
      console.error('Error creating auth profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create auth profile',
        variant: 'destructive',
      });
    },
  });

  // Reset driver's password
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { email };
    },
    onSuccess: (data) => {
      toast({
        title: 'Password Reset Sent',
        description: `Password reset email sent to ${data.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send password reset',
        variant: 'destructive',
      });
    },
  });

  // Check if email already exists in auth
  const checkEmailExists = async (_email: string): Promise<boolean> => {
    // We can't directly check this without admin API, so we assume it doesn't
    // The sign up will fail if it does
    return false;
  };

  // Unlink mobile profile from driver (clears auth_user_id + deactivates vehicle assignments)
  const unlinkAuthProfileMutation = useMutation({
    mutationFn: async ({ driverId, authUserId }: { driverId: string; authUserId: string }) => {
      // Step 1: Deactivate all active vehicle assignments for this auth user
      const { error: assignmentError } = await supabase
        .from('driver_vehicle_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() } as never)
        .eq('driver_id', authUserId)
        .eq('is_active', true);
      if (assignmentError) {
        console.error('Failed to deactivate assignments:', assignmentError);
        // Non-blocking — continue even if this fails
      }

      // Step 2: Clear auth_user_id from the driver record
      const { error: unlinkError } = await supabase
        .from('drivers')
        .update({ auth_user_id: null } as never)
        .eq('id', driverId);
      if (unlinkError) throw new Error(`Failed to unlink profile: ${unlinkError.message}`);

      return { driverId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-vehicle-assignments'] });
      toast({
        title: 'Mobile Profile Unlinked',
        description: 'The driver\'s mobile profile has been unlinked. You can now create a new one.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unlink Failed',
        description: error.message || 'Failed to unlink mobile profile',
        variant: 'destructive',
      });
    },
  });

  // Generate a random password
  const generatePassword = useCallback((): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }, []);

  return {
    driversWithAuth,
    isLoading,
    roles,
    refetch,
    createAuthProfile: createAuthProfileMutation.mutateAsync,
    unlinkAuthProfile: unlinkAuthProfileMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    isCreatingProfile: createAuthProfileMutation.isPending,
    isUnlinkingProfile: unlinkAuthProfileMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    checkEmailExists,
    generatePassword,
    getDriverRoleId,
  };
};

export default useDriverAuth;