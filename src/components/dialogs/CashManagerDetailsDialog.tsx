import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type PartsRequest,
  type QuoteAttachment,
  useUpdateProcurementRequest,
} from "@/hooks/useProcurement";
import { supabase } from "@/integrations/supabase/client";
import { Building2, FileText, Loader2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Vendor {
  id: string;
  vendor_name: string;
  contact_person: string | null;
  phone: string | null;
}

interface CashManagerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PartsRequest | null;
  vendors: Vendor[];
}

export default function CashManagerDetailsDialog({
  open,
  onOpenChange,
  request,
  vendors,
}: CashManagerDetailsDialogProps) {
  const { toast } = useToast();
  const updateRequest = useUpdateProcurementRequest();

  const [vendorId, setVendorId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (open && request) {
      setVendorId(request.vendor_id ?? "");
      setUnitPrice(request.unit_price ? String(request.unit_price) : "");
      setQuoteFile(null);
    }
  }, [open, request]);

  const validateFile = (file: File): boolean => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "Max 5 MB" });
      return false;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid File Type", description: "PDF, JPG or PNG only" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!request) return;
    if (!vendorId && !unitPrice) {
      toast({ variant: "destructive", title: "Required", description: "Please provide at least a vendor or unit price" });
      return;
    }

    setIsUploading(true);
    try {
      let quotes: QuoteAttachment[] | undefined;

      // Upload quote file if provided
      if (quoteFile) {
        const ext = quoteFile.name.split(".").pop();
        const path = `procurement-quotes/${request.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, quoteFile);
        if (uploadError) {
          toast({ variant: "destructive", title: "Upload Failed", description: uploadError.message });
          setIsUploading(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
        const vendorName = vendors.find((v) => v.id === vendorId)?.vendor_name ?? "";

        const newAttachment: QuoteAttachment = {
          file_url: publicUrl,
          file_name: quoteFile.name,
          vendor_name: vendorName,
          price: unitPrice ? parseFloat(unitPrice) : null,
          uploaded_at: new Date().toISOString(),
        };

        // Append to existing quotes
        const existingQuotes = (request as unknown as { quotes?: QuoteAttachment[] }).quotes ?? [];
        quotes = [...existingQuotes, newAttachment];
      }

      await updateRequest.mutateAsync({
        id: request.id,
        ...(vendorId ? { vendor_id: vendorId } : {}),
        ...(unitPrice ? { unit_price: parseFloat(unitPrice) } : {}),
        ...(quotes ? { quotes } : {}),
      });

      onOpenChange(false);
    } catch {
      // Error handled by mutation hook
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Vendor & Price Details</DialogTitle>
          <DialogDescription>
            {request?.part_name ? `Set procurement details for "${request.part_name}"` : "Set procurement details"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vendor select */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Vendor
            </Label>
            <Select value={vendorId || "__none__"} onValueChange={(v) => setVendorId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No vendor</span>
                </SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.vendor_name}
                    {v.contact_person && (
                      <span className="text-xs text-muted-foreground ml-2">· {v.contact_person}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit price */}
          <div className="space-y-1.5">
            <Label className="text-sm">Unit Price</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
            {unitPrice && request && (
              <p className="text-xs text-muted-foreground">
                Total: R {(parseFloat(unitPrice) * request.quantity).toFixed(2)} ({request.quantity} × R {parseFloat(unitPrice).toFixed(2)})
              </p>
            )}
          </div>

          {/* Quote file upload (optional) */}
          <div className="space-y-1.5">
            <Label className="text-sm">Quote / Invoice (optional)</Label>
            {quoteFile ? (
              <div className="flex items-center gap-2 text-sm p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                <FileText className="h-4 w-4 text-green-600 shrink-0" />
                <span className="truncate flex-1">{quoteFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setQuoteFile(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                <Upload className="h-4 w-4 shrink-0" />
                <span>Click to upload (PDF, JPG, PNG — max 5 MB)</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && validateFile(file)) setQuoteFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || (!vendorId && !unitPrice)}>
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
