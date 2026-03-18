import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";
import { memo } from "react";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];

interface VendorSelectProps {
  label: string;
  placeholder?: string;
  vendors: Vendor[];
  isLoading: boolean;
  selectedVendorId: string;
  onValueChange: (value: string) => void;
}

function VendorSelectInner({
  label,
  placeholder = "Select vendor",
  vendors,
  isLoading,
  selectedVendorId,
  onValueChange,
}: VendorSelectProps) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={selectedVendorId} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue
            placeholder={isLoading ? "Loading vendors..." : placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <SelectItem value="loading" disabled>
              Loading vendors...
            </SelectItem>
          ) : vendors.length === 0 ? (
            <SelectItem value="empty" disabled>
              No active vendors found
            </SelectItem>
          ) : (
            vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>
                {vendor.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

const VendorSelect = memo(VendorSelectInner);
export default VendorSelect;