import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, User } from 'lucide-react';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  driver_number: string;
  status: string;
}

interface DriverSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onDriverCreated?: (driverName: string) => void;
  showDriverNumber?: boolean;
}

export const DriverSelect = ({
  value,
  onValueChange,
  placeholder = 'Select driver...',
  disabled = false,
  showDriverNumber = true,
}: DriverSelectProps) => {
  // Fetch active drivers from drivers table
  const { data: drivers = [], isLoading, error } = useQuery<Driver[]>({
    queryKey: ['drivers', 'active'],
    queryFn: async (): Promise<Driver[]> => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, driver_number, status')
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get full name from driver
  const getFullName = (driver: Driver): string => {
    return `${driver.first_name} ${driver.last_name}`.trim();
  };

  // Get display name with optional driver number
  const getDisplayName = (driver: Driver): string => {
    const fullName = getFullName(driver);
    return showDriverNumber && driver.driver_number
      ? `${fullName} (${driver.driver_number})`
      : fullName;
  };

  // Find the current driver to show in display
  const currentDriver = drivers.find(d => getFullName(d) === value);

  if (isLoading) {
    return (
      <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading drivers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center h-10 px-3 rounded-md border border-destructive bg-destructive/10">
        <span className="text-sm text-destructive">Error loading drivers</span>
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
          {currentDriver ? (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {getDisplayName(currentDriver)}
            </span>
          ) : value ? (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {value}
            </span>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {drivers.length === 0 ? (
          <SelectItem value="__no_drivers__" disabled>
            <span className="text-sm text-muted-foreground">No drivers found. Add drivers in Driver Management.</span>
          </SelectItem>
        ) : (
          drivers.map((driver) => {
            const fullName = getFullName(driver);
            return (
              <SelectItem key={driver.id} value={fullName}>
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {getDisplayName(driver)}
                </span>
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
};

export default DriverSelect;