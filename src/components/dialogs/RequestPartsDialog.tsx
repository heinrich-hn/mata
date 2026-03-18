import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, History } from "lucide-react";
import AddVendorDialog from "./AddVendorDialog"; // Correct path - same directory
import ExternalPartForm from "./parts/ExternalPartForm"; // Correct 

interface RequestPartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId?: string;
  onSuccess?: () => void;
}

interface RecentPart {
  id: string;
  part_name: string;
  part_number: string | null;
  vendor_id: string;
  vendor_name: string;
  requested_at: string;
}

const RequestPartsDialog = ({ open, onOpenChange, jobCardId, onSuccess }: RequestPartsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showRecentParts, setShowRecentParts] = useState(false);
  const [formData, setFormData] = useState({
    partName: "",
    partNumber: "",
    quantity: "",
    notes: "",
  });

  // Fetch vendors for selection
  const { data: vendors = [], isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, vendor_name, vendor_id")
        .order("vendor_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent parts requested
  const { data: recentParts = [] } = useQuery({
    queryKey: ["recent-parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_requests")
        .select(`
          id,
          part_name,
          part_number,
          vendor_id,
          vendors!inner(vendor_name),
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Transform the data to a flat structure
      return (data || []).map(item => ({
        id: item.id,
        part_name: item.part_name,
        part_number: item.part_number,
        vendor_id: item.vendor_id,
        vendor_name: item.vendors?.vendor_name || "Unknown Vendor",
        requested_at: item.created_at
      })) as RecentPart[];
    },
    enabled: showRecentParts, // Only fetch when dropdown is open
  });

  // UUID validation regex
  const isValidUUID = (uuid: string): boolean => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  };

  // Handle quantity input with proper number handling
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;

    // Allow empty string or valid positive numbers
    if (value === "" || /^\d+$/.test(value)) {
      setFormData({ ...formData, quantity: value });
    }
  };

  // Handle part selection from recent parts
  const handleSelectRecentPart = (part: RecentPart): void => {
    setFormData({
      ...formData,
      partName: part.part_name,
      partNumber: part.part_number || "",
    });
    setSelectedVendorId(part.vendor_id);
    setShowRecentParts(false);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Validate required fields
    if (!formData.partName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a part name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.quantity) {
      toast({
        title: "Error",
        description: "Please enter a quantity",
        variant: "destructive",
      });
      return;
    }

    // Validate vendor selection
    if (!selectedVendorId) {
      toast({
        title: "Error",
        description: "Please select a vendor for the parts request",
        variant: "destructive",
      });
      return;
    }

    // Validate UUID format
    if (!isValidUUID(selectedVendorId)) {
      toast({
        title: "Error",
        description: "Invalid vendor selected. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const quantity = parseInt(formData.quantity, 10);

      // Validate quantity is a positive number
      if (isNaN(quantity) || quantity <= 0) {
        toast({
          title: "Error",
          description: "Please enter a valid quantity (must be greater than 0)",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const insertData = {
        part_name: formData.partName.trim(),
        part_number: formData.partNumber?.trim() || null,
        quantity: quantity,
        job_card_id: jobCardId || null,
        notes: formData.notes?.trim() || null,
        status: "pending",
        vendor_id: selectedVendorId,
        inventory_id: null, // Explicitly set to null since we're using vendor_id
        is_service: false,
      };

      const { error } = await supabase
        .from("parts_requests")
        .insert(insertData);

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Parts request submitted successfully!",
      });

      // Trigger Google Sheets sync
      requestGoogleSheetsSync('workshop');

      // Close dialog and reset form
      onOpenChange(false);
      setFormData({
        partName: "",
        partNumber: "",
        quantity: "",
        notes: "",
      });
      setSelectedVendorId("");
      setShowRecentParts(false);

      if (onSuccess) onSuccess();

    } catch (error) {
      console.error("Parts request error:", error);

      // More specific error message
      let errorMessage = "Failed to submit parts request";
      if (error instanceof Error) {
        if (error.message.includes("inventory_id") || error.message.includes("vendor_id")) {
          errorMessage = "Database constraint: Both inventory_id and vendor_id cannot be null. Please ensure vendor is properly selected.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVendorAdded = (): void => {
    // Refetch vendors to include the new one
    refetchVendors();
    // Note: The vendor dialog doesn't return the new vendor ID in onAdd
    // We'll let the user select it manually from the dropdown
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Parts</DialogTitle>
            <DialogDescription>
              Submit a request for workshop parts
            </DialogDescription>
          </DialogHeader>

          {/* Recent Parts Toggle */}
          <div className="mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRecentParts(!showRecentParts)}
              className="text-blue-600 hover:text-blue-700 p-0 h-auto"
            >
              <History className="h-4 w-4 mr-1" />
              {showRecentParts ? "Hide" : "Show"} recent parts
            </Button>
          </div>

          {/* Recent Parts Dropdown */}
          {showRecentParts && (
            <div className="mb-4 p-3 border rounded-md bg-gray-50 max-h-48 overflow-y-auto">
              <h4 className="text-sm font-medium mb-2 flex items-center">
                <History className="h-4 w-4 mr-1" />
                Recently Requested Parts
              </h4>
              {recentParts.length === 0 ? (
                <p className="text-sm text-gray-500">No recent parts found</p>
              ) : (
                <div className="space-y-2">
                  {recentParts.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => handleSelectRecentPart(part)}
                      className="w-full text-left p-2 text-sm hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <div className="font-medium">{part.part_name}</div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>{part.part_number || "No part #"}</span>
                        <span className="text-blue-600">{part.vendor_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* External Part Form Component */}
            <ExternalPartForm
              partName={formData.partName}
              partNumber={formData.partNumber}
              onPartNameChange={(value) => setFormData({ ...formData, partName: value })}
              onPartNumberChange={(value) => setFormData({ ...formData, partNumber: value })}
            />

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="e.g., 2"
                value={formData.quantity}
                onChange={handleQuantityChange}
                onKeyDown={(e) => {
                  // Prevent typing 'e', 'E', '+', '-', etc.
                  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                  }
                }}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vendor">Vendor *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddVendor(true)}
                  className="text-blue-600 hover:text-blue-700 h-7 px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </Button>
              </div>
              <Select
                value={selectedVendorId}
                onValueChange={setSelectedVendorId}
                disabled={loading || vendorsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={vendorsLoading ? "Loading vendors..." : "Select a vendor"} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.length === 0 && !vendorsLoading && (
                    <SelectItem value="no-vendors" disabled>
                      No vendors available
                    </SelectItem>
                  )}
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name} {vendor.vendor_id ? `(${vendor.vendor_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional information..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Dialog - Using your existing component */}
      <AddVendorDialog
        open={showAddVendor}
        onOpenChange={setShowAddVendor}
        onAdd={handleVendorAdded}
        editVendor={null}
      />
    </>
  );
};

export default RequestPartsDialog;