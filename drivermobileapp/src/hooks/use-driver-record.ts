import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Fetches the driver record from the `drivers` table using the Supabase Auth
 * UUID (`auth_user_id`) with a fallback to email matching.
 *
 * Returns the driver's **database primary key** (`id`), used for
 * document lookups (`driver_documents`, etc).
 *
 * NOTE: `driver_vehicle_assignments.driver_id` references `auth.users(id)`,
 * NOT `drivers.id`. Use `user.id` for assignment queries.
 */
export function useDriverRecord() {
    const { user } = useAuth();
    const supabase = useMemo(() => createClient(), []);

    return useQuery<{ id: string } | null>({
        queryKey: ["driver-record", user?.id, user?.email],
        queryFn: async () => {
            if (!user) return null;
            console.log('🔍 useDriverRecord: Looking up driver for', { authId: user.id, email: user.email });
            // Primary: match by auth_user_id (set by Dashboard when onboarding)
            if (user.id) {
                const { data, error } = await supabase
                    .from("drivers")
                    .select("id")
                    .eq("auth_user_id", user.id)
                    .eq("status", "active")
                    .limit(1)
                    .maybeSingle();
                if (error) {
                    console.error('❌ useDriverRecord: auth_user_id lookup error:', error.message);
                    throw error;
                }
                if (data) {
                    console.log('✅ useDriverRecord: Found driver by auth_user_id:', data.id);
                    return data;
                }
                console.log('⚠️ useDriverRecord: No driver found by auth_user_id, trying email...');
            }
            // Fallback: match by email
            if (user.email) {
                const { data, error } = await supabase
                    .from("drivers")
                    .select("id")
                    .eq("email", user.email)
                    .eq("status", "active")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (error) {
                    console.error('❌ useDriverRecord: email lookup error:', error.message);
                    throw error;
                }
                if (data) {
                    console.log('✅ useDriverRecord: Found driver by email:', data.id);
                    return data;
                }
            }
            console.warn('⚠️ useDriverRecord: No driver record found for this user. Admin must create a driver in Dashboard.');
            return null;
        },
        enabled: !!user,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
