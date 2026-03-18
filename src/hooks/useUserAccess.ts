import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AccessArea {
  access_areas: {
    access_area_name: string;
  };
}

interface UserAccessData {
  name: string;
  role_id: string;
  roles: {
    role_name: string;
  } | null;
  user_access_areas: AccessArea[];
}

export const useUserAccess = (userName?: string) => {
  return useQuery({
    queryKey: ["user-access", userName],
    queryFn: async () => {
      if (!userName) return { accessAreas: [], role: null };

      const { data: user, error: userError } = await supabase
        .from("users")
        .select(`
          name,
          role_id,
          roles (role_name),
          user_access_areas (
            access_areas (access_area_name)
          )
        `)
        .eq("name", userName)
        .eq("status", "Active")
        .single();

      if (userError) throw userError;

      const typedUser = user as unknown as UserAccessData;

      const accessAreas = typedUser.user_access_areas
        .map((ua) => ua.access_areas.access_area_name)
        .filter(Boolean);

      return {
        accessAreas,
        role: typedUser.roles?.role_name || null,
      };
    },
    enabled: !!userName,
  });
};

export const hasAccess = (userAccessAreas: string[], requiredArea: string): boolean => {
  if (!userAccessAreas.length) return false;
  
  // Check for superuser access
  if (userAccessAreas.includes("All modules (Superuser)")) return true;
  
  // Check for full access
  if (userAccessAreas.includes("Full (All modules except PO Approval)")) return true;
  
  // Check for specific access
  return userAccessAreas.includes(requiredArea);
};