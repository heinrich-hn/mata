import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface User {
  user_id: number;
  name: string;
  username: string;
  shortcode: string;
  role_id: number;
  status: string;
}

interface UserSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  filterByRole?: string;
  disabled?: boolean;
}

export const UserSelect = ({
  value,
  onValueChange,
  placeholder = "Select user",
  filterByRole,
  disabled = false
}: UserSelectProps) => {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", filterByRole],
    queryFn: async () => {
      let query = supabase
        .from("users")
        .select(`
          user_id,
          name,
          username,
          shortcode,
          role_id,
          status,
          roles (role_name)
        `)
        .eq("status", "Active")
        .order("name");

      if (filterByRole) {
        const { data: role } = await supabase
          .from("roles")
          .select("role_id")
          .eq("role_name", filterByRole)
          .single();

        if (role) {
          query = query.eq("role_id", role.role_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as User[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-10 border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.user_id} value={user.name}>
            {user.shortcode} - {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};