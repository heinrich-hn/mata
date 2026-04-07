import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Fetches the driver record from the `drivers` table using the Supabase Auth
 * UUID (`auth_user_id`) with a fallback to email matching.
 *
 * Returns the driver's **database primary key** (`id`), which must be used
 * for all queries against `driver_vehicle_assignments.driver_id`.
 *
 * NOTE: `user.id` (Auth UUID) !== `driver.id` (DB PK). Never use `user.id`
 * to query `driver_vehicle_assignments`.
 */
export function useDriverRecord() {
    const { user } = useAuth();
    const supabase = useMemo(() => createClient(), []);

    return useQuery<{ id: string } | null>({
        queryKey: ["driver-record", user?.id, user?.email],
        queryFn: async () => {
            if (!user) return null;
            // Primary: match by auth_user_id (set by Dashboard when onboarding)
            if (user.id) {
                const { data } = await supabase
                    .from("drivers")
                    .select("id")
                    .eq("auth_user_id", user.id)
                    .eq("status", "active")
                    .limit(1)
                    .maybeSingle();
                if (data) return data;
            }
            // Fallback: match by email
            if (user.email) {
                const { data } = await supabase
                    .from("drivers")
                    .select("id")
                    .eq("email", user.email)
                    .eq("status", "active")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data) return data;
            }
            return null;
        },
        enabled: !!user,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
