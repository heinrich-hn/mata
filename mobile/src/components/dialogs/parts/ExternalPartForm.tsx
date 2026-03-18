import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database } from "@/integrations/supabase/types";
import { memo } from "react";
import VendorSelect from "./VendorSelect";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];

interface ExternalPartFormProps {
  partName: string;
  partNumber: string;
  selectedVendorId: string;
  irNumber: string;
  vendors: Vendor[];
  isLoadingVendors: boolean;
  onPartNameChange: (value: string) => void;
  onPartNumberChange: (value: string) => void;
  onVendorChange: (value: string) => void;
  onIrNumberChange: (value: string) => void;
}

function ExternalPartFormInner({
  partName,
  partNumber,
  selectedVendorId,
  irNumber,
  vendors,
  isLoadingVendors,
  onPartNameChange,
  onPartNumberChange,
  onVendorChange,
  onIrNumberChange,
}: ExternalPartFormProps) {
  return (
    <>
      <div>
        <Label htmlFor="partName">Part Name *</Label>
        <Input
          id="partName"
          value={partName}
          onChange={(e) => onPartNameChange(e.target.value)}
          placeholder="Enter part name"
        />
      </div>

      <div>
        <Label htmlFor="partNumber">Part Number</Label>
        <Input
          id="partNumber"
          value={partNumber}
          onChange={(e) => onPartNumberChange(e.target.value)}
          placeholder="Enter part number (optional)"
        />
      </div>

      <VendorSelect
        label="Vendor *"
        placeholder="Select vendor"
        vendors={vendors}
        isLoading={isLoadingVendors}
        selectedVendorId={selectedVendorId}
        onValueChange={onVendorChange}
      />

      <div>
        <Label htmlFor="external-ir-number">IR Number *</Label>
        <Input
          id="external-ir-number"
          value={irNumber}
          onChange={(e) => onIrNumberChange(e.target.value)}
          placeholder="Enter IR reference number"
        />
      </div>
    </>
  );
}

const ExternalPartForm = memo(ExternalPartFormInner);
export default ExternalPartForm;