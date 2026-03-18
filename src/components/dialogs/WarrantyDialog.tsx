import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface WarrantyItem {
  id: string;
  name: string;
  part_number: string;
  has_warranty?: boolean;
  warranty_period_months?: number | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  warranty_provider?: string | null;
  warranty_terms?: string | null;
  warranty_claim_contact?: string | null;
  warranty_notes?: string | null;
}

interface WarrantyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarrantyItem | null;
  onUpdate: () => void;
}

const WarrantyDialog = ({ open, onOpenChange, item, onUpdate }: WarrantyDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Fetch vendors for warranty provider selection
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-warranty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, vendor_name")
        .eq("is_active", true)
        .order("vendor_name");
      if (error) throw error;
      return data || [];
    },
  });

  const [formData, setFormData] = useState({
    has_warranty: false,
    warranty_period_months: "",
    warranty_start_date: null as Date | null,
    warranty_end_date: null as Date | null,
    warranty_provider: "",
    warranty_terms: "",
    warranty_claim_contact: "",
    warranty_notes: "",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        has_warranty: item.has_warranty || false,
        warranty_period_months: item.warranty_period_months?.toString() || "",
        warranty_start_date: item.warranty_start_date ? new Date(item.warranty_start_date) : null,
        warranty_end_date: item.warranty_end_date ? new Date(item.warranty_end_date) : null,
        warranty_provider: item.warranty_provider || "",
        warranty_terms: item.warranty_terms || "",
        warranty_claim_contact: item.warranty_claim_contact || "",
        warranty_notes: item.warranty_notes || "",
      });
    }
  }, [item, open]);

  const handleWarrantyPeriodChange = (months: string) => {
    setFormData((prev) => {
      const newData = { ...prev, warranty_period_months: months };
      if (months && prev.warranty_start_date) {
        newData.warranty_end_date = addMonths(prev.warranty_start_date, parseInt(months));
      }
      return newData;
    });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => {
        const newData = { ...prev, warranty_start_date: date };
        if (prev.warranty_period_months) {
          newData.warranty_end_date = addMonths(date, parseInt(prev.warranty_period_months));
        }
        return newData;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setLoading(true);

    try {
      const updateData = {
        has_warranty: formData.has_warranty,
        warranty_period_months: formData.warranty_period_months
          ? parseInt(formData.warranty_period_months)
          : null,
        warranty_start_date: formData.warranty_start_date
          ? format(formData.warranty_start_date, "yyyy-MM-dd")
          : null,
        warranty_end_date: formData.warranty_end_date
          ? format(formData.warranty_end_date, "yyyy-MM-dd")
          : null,
        warranty_provider: formData.warranty_provider || null,
        warranty_terms: formData.warranty_terms || null,
        warranty_claim_contact: formData.warranty_claim_contact || null,
        warranty_notes: formData.warranty_notes || null,
      };

      const { error } = await supabase
        .from("inventory")
        .update(updateData as Record<string, unknown>)
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Warranty information updated successfully",
      });

      onUpdate();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update warranty information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWarranty = async () => {
    if (!item) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("inventory")
        .update({
          has_warranty: false,
          warranty_period_months: null,
          warranty_start_date: null,
          warranty_end_date: null,
          warranty_provider: null,
          warranty_terms: null,
          warranty_claim_contact: null,
          warranty_notes: null,
        } as Record<string, unknown>)
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Warranty removed from item",
      });

      onUpdate();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove warranty",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Warranty</DialogTitle>
          <DialogDescription>
            Configure warranty details for <span className="font-semibold">{item.name}</span> ({item.part_number})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="has_warranty">Has Warranty</Label>
                <p className="text-sm text-muted-foreground">
                  Enable warranty tracking for this item
                </p>
              </div>
              <Switch
                id="has_warranty"
                checked={formData.has_warranty}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, has_warranty: checked })
                }
              />
            </div>

            {formData.has_warranty && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="warranty_period">Warranty Period (Months)</Label>
                    <Input
                      id="warranty_period"
                      type="number"
                      min="1"
                      value={formData.warranty_period_months}
                      onChange={(e) => handleWarrantyPeriodChange(e.target.value)}
                      placeholder="e.g., 12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.warranty_start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.warranty_start_date
                            ? format(formData.warranty_start_date, "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.warranty_start_date || undefined}
                          onSelect={handleStartDateChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.warranty_end_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.warranty_end_date
                          ? format(formData.warranty_end_date, "PPP")
                          : "Auto-calculated or pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.warranty_end_date || undefined}
                        onSelect={(date) =>
                          date && setFormData({ ...formData, warranty_end_date: date })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warranty_provider">Warranty Provider</Label>
                  <Select
                    value={formData.warranty_provider}
                    onValueChange={(value) =>
                      setFormData({ ...formData, warranty_provider: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No provider</SelectItem>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.vendor_name}>
                          {vendor.vendor_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warranty_claim_contact">Claim Contact</Label>
                  <Input
                    id="warranty_claim_contact"
                    value={formData.warranty_claim_contact}
                    onChange={(e) =>
                      setFormData({ ...formData, warranty_claim_contact: e.target.value })
                    }
                    placeholder="Phone number or email for claims"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warranty_terms">Warranty Terms</Label>
                  <Textarea
                    id="warranty_terms"
                    value={formData.warranty_terms}
                    onChange={(e) =>
                      setFormData({ ...formData, warranty_terms: e.target.value })
                    }
                    placeholder="Brief description of warranty coverage"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warranty_notes">Additional Notes</Label>
                  <Textarea
                    id="warranty_notes"
                    value={formData.warranty_notes}
                    onChange={(e) =>
                      setFormData({ ...formData, warranty_notes: e.target.value })
                    }
                    placeholder="Any additional notes or conditions"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            {item.has_warranty && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveWarranty}
                disabled={loading}
              >
                Remove Warranty
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Warranty"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WarrantyDialog;