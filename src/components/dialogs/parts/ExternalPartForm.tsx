import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { memo } from "react";

interface ExternalPartFormProps {
  partName: string;
  partNumber: string;
  onPartNameChange: (value: string) => void;
  onPartNumberChange: (value: string) => void;
}

function ExternalPartFormInner({
  partName,
  partNumber,
  onPartNameChange,
  onPartNumberChange,
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
    </>
  );
}

const ExternalPartForm = memo(ExternalPartFormInner);
export default ExternalPartForm;