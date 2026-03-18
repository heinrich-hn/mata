import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SourceType } from "@/hooks/useAddPartForm";
import { DollarSign, Package, Wrench } from "lucide-react";
import { memo } from "react";

interface SourceTypeSelectorProps {
  sourceType: SourceType;
  onSelect: (type: SourceType) => void;
}

const SOURCE_OPTIONS: {
  type: SourceType;
  icon: typeof Package;
  label: string;
}[] = [
  { type: "inventory", icon: Package, label: "Inventory" },
  { type: "external", icon: DollarSign, label: "External Part" },
  { type: "service", icon: Wrench, label: "Service/Repair" },
];

function SourceTypeSelectorInner({
  sourceType,
  onSelect,
}: SourceTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <Label>Source Type</Label>
      <div className="grid grid-cols-3 gap-2">
        {SOURCE_OPTIONS.map(({ type, icon: Icon, label }) => (
          <Button
            key={type}
            type="button"
            variant={sourceType === type ? "default" : "outline"}
            className="flex flex-col items-center gap-2 h-20"
            onClick={() => onSelect(type)}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

const SourceTypeSelector = memo(SourceTypeSelectorInner);
export default SourceTypeSelector;