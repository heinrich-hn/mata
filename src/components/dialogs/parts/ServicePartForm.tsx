import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { memo } from "react";

interface ServicePartFormProps {
  partName: string;
  serviceDescription: string;
  onPartNameChange: (value: string) => void;
  onServiceDescriptionChange: (value: string) => void;
}

function ServicePartFormInner({
  partName,
  serviceDescription,
  onPartNameChange,
  onServiceDescriptionChange,
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
        <Label htmlFor="serviceDescription">Service Description</Label>
        <Textarea
          id="serviceDescription"
          value={serviceDescription}
          onChange={(e) => onServiceDescriptionChange(e.target.value)}
          placeholder="Describe the service/repair work in detail..."
          rows={3}
        />
      </div>
    </>
  );
}

const ServicePartForm = memo(ServicePartFormInner);
export default ServicePartForm;