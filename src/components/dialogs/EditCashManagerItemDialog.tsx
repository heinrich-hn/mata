import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  type PartsRequest,
  type QuoteAttachment,
  useUpdateProcurementRequest,
  useVendors,
} from "@/hooks/useProcurement";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  ExternalLink,
  FileCheck,
  FileText,
  Hash,
  Loader2,
  Package,
  Paperclip,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface EditCashManagerItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PartsRequest | null;
}

export default function EditCashManagerItemDialog({
  open,
  onOpenChange,
  request,
}: EditCashManagerItemDialogProps) {
  const { toast } = useToast();
  const updateRequest = useUpdateProcurementRequest();
  const { data: vendors = [] } = useVendors();

  const [irNumber, setIrNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [newQuoteFile, setNewQuoteFile] = useState<File | null>(null);
  const [existingQuotes, setExistingQuotes] = useState<QuoteAttachment[]>([]);
  const [removeQuoteIndexes, setRemoveQuoteIndexes] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive vehicle from job_card
  const vehicle = (request?.job_card as { vehicle?: { fleet_number?: string | null; registration_number?: string } } | undefined)?.vehicle;

  useEffect(() => {
    if (!open || !request) return;
    setIrNumber(request.ir_number ?? "");
    setVendorId(request.vendor_id ?? "");
    setUnitPrice(request.unit_price ? String(request.unit_price) : "");
    setExistingQuotes(Array.isArray(request.quotes) ? (request.quotes as QuoteAttachment[]) : []);
    setNewQuoteFile(null);
    setRemoveQuoteIndexes(new Set());
  }, [open, request]);

  const validateFile = (file: File): boolean => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "Max 5 MB" });
      return false;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid Type", description: "PDF, JPG or PNG only" });
      return false;
    }
    return true;
  };

  const toggleRemoveQuote = (idx: number) => {
    setRemoveQuoteIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const uploadNewQuote = async (): Promise<QuoteAttachment | null> => {
    if (!newQuoteFile || !request) return null;
    const ext = newQuoteFile.name.split(".").pop();
    const path = `procurement-quotes/ir-${irNumber || request.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, newQuoteFile);
    if (error) {
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
    const selectedVendor = vendors.find((v) => v.id === vendorId);
    return {
      file_url: publicUrl,
      file_name: newQuoteFile.name,
      vendor_name: selectedVendor?.vendor_name ?? "",
      price: unitPrice ? parseFloat(unitPrice) : null,
      uploaded_at: new Date().toISOString(),
    };
  };

  const handleSave = async () => {
    if (!request) return;
    setIsSubmitting(true);
    try {
      // Build retained quotes (those not marked for removal)
      const retained = existingQuotes.filter((_, i) => !removeQuoteIndexes.has(i));

      // Upload and append new quote if provided
      let finalQuotes: QuoteAttachment[] = retained;
      if (newQuoteFile) {
        const uploaded = await uploadNewQuote();
        if (uploaded) finalQuotes = [...retained, uploaded];
      }

      const unitPriceNum = unitPrice ? parseFloat(unitPrice) : null;

      await updateRequest.mutateAsync({
        id: request.id,
        ir_number: irNumber || null,
        vendor_id: vendorId || null,
        unit_price: unitPriceNum,
        quotes: finalQuotes.length > 0 ? finalQuotes : undefined,
      });

      onOpenChange(false);
    } catch (err) {
      console.error("Edit CM item:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Procurement Item
          </DialogTitle>
          <DialogDescription>
            Update vendor, price, IR number or quote for this item.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-5 py-1">

            {/* ── Item Summary ──────────────────────────── */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="font-semibold text-base">{request.part_name}</div>
              {request.part_number && (
                <div className="text-xs text-muted-foreground font-mono">{request.part_number}</div>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Qty: <strong className="text-foreground">{request.quantity}</strong>
                </span>

                {request.job_card?.job_number && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Job Card:&nbsp;
                    <strong className="text-foreground">{request.job_card.job_number}</strong>
                  </span>
                )}

                {vehicle?.fleet_number && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Fleet:&nbsp;
                    <strong className="text-foreground font-mono">{vehicle.fleet_number}</strong>
                    {vehicle.registration_number && (
                      <span className="text-xs text-muted-foreground">
                        ({vehicle.registration_number})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* ── IR Number ─────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="cm-ir-number" className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                IR Number
              </Label>
              <Input
                id="cm-ir-number"
                placeholder="e.g., IR-2026-001234"
                value={irNumber}
                onChange={(e) => setIrNumber(e.target.value)}
              />
            </div>

            <Separator />

            {/* ── Vendor ────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Vendor
              </Label>
              <Select
                value={vendorId || "__none__"}
                onValueChange={(v) => setVendorId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">No vendor assigned</span>
                  </SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vendor_name}
                      {v.contact_person && (
                        <span className="text-xs text-muted-foreground ml-2">
                          · {v.contact_person}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Unit Price ────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="cm-unit-price">Unit Price</Label>
              <Input
                id="cm-unit-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
              {unitPrice && request.quantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  Total: <strong>${(parseFloat(unitPrice) * request.quantity).toFixed(2)}</strong>
                </p>
              )}
            </div>

            <Separator />

            {/* ── Existing Quotes ───────────────────────── */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                Quotes / Documents
              </Label>

              {existingQuotes.length === 0 && !newQuoteFile && (
                <p className="text-xs text-muted-foreground italic">No quotes uploaded yet.</p>
              )}

              {existingQuotes.map((q, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded border text-xs ${
                    removeQuoteIndexes.has(idx)
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 line-through opacity-50"
                      : "bg-green-50 dark:bg-green-950/20 border-green-200"
                  }`}
                >
                  <FileCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span className="truncate flex-1">{q.file_name}</span>
                  {q.vendor_name && (
                    <Badge variant="outline" className="text-[10px]">{q.vendor_name}</Badge>
                  )}
                  {q.price && (
                    <span className="text-muted-foreground">${q.price.toFixed(2)}</span>
                  )}
                  <a
                    href={q.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                    onClick={() => toggleRemoveQuote(idx)}
                    title={removeQuoteIndexes.has(idx) ? "Undo remove" : "Remove quote"}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {/* New quote upload */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Add a new quote file (PDF, JPG, PNG — max 5 MB):</p>
                {newQuoteFile ? (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded text-xs">
                    <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate flex-1">{newQuoteFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => setNewQuoteFile(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Click to upload</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && validateFile(f)) setNewQuoteFile(f);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
