import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Database } from "@/integrations/supabase/types";
import { memo } from "react";
import VendorSelect from "./VendorSelect";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];

interface ServicePartFormProps {
  partName: string;
  serviceDescription: string;
  selectedVendorId: string;
  irNumber: string;
  vendors: Vendor[];
  isLoadingVendors: boolean;
  onPartNameChange: (value: string) => void;
  onServiceDescriptionChange: (value: string) => void;
  onVendorChange: (value: string) => void;
  onIrNumberChange: (value: string) => void;
}

function ServicePartFormInner({
  partName,
  serviceDescription,
  selectedVendorId,
  irNumber,
  vendors,
  isLoadingVendors,
  onPartNameChange,
  onServiceDescriptionChange,
  onVendorChange,
  onIrNumberChange,
}: ServicePartFormProps) {
  return (
    <>
      <div>
        <Label htmlFor="serviceName">Service Name *</Label>
        <Input
          id="serviceName"
          value={partName}
          onChange={(e) => onPartNameChange(e.target.value)}
          placeholder="e.g., Welding, Engine Repair, Painting"
        />
      </div>

      <div>
        <Label htmlFor="serviceDescription">Service Description *</Label>
        <Textarea
          id="serviceDescription"
          value={serviceDescription}
          onChange={(e) => onServiceDescriptionChange(e.target.value)}
          placeholder="Describe the service/repair work in detail..."
          rows={3}
        />
      </div>

      <VendorSelect
        label="Service Provider *"
        placeholder="Select vendor/service provider"
        vendors={vendors}
        isLoading={isLoadingVendors}
        selectedVendorId={selectedVendorId}
        onValueChange={onVendorChange}
      />

      <div>
        <Label htmlFor="service-ir-number">IR Number *</Label>
        <Input
          id="service-ir-number"
          value={irNumber}
          onChange={(e) => onIrNumberChange(e.target.value)}
          placeholder="Enter IR reference number"
        />
      </div>
    </>
  );
}

const ServicePartForm = memo(ServicePartFormInner);
export default ServicePartForm;