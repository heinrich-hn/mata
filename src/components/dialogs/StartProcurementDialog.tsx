import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  useCreateInventoryAndLink,
  useStartProcurement,
} from "@/hooks/useProcurement";
import {
  AlertTriangle,
  Clock,
  FileText,
  Loader2,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import InventorySearchDialog from "./InventorySearchDialog";

// ── Types ─────────────────────────────────────────────────────────────────

interface StartProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: PartsRequest[];
}

type UrgencyLevel = 'urgent' | '1-week' | '2-weeks' | null;

// ── Main dialog ───────────────────────────────────────────────────────────

export default function StartProcurementDialog({
  open,
  onOpenChange,
  requests,
}: StartProcurementDialogProps) {
  const { toast } = useToast();
  const startProcurement = useStartProcurement();
  const createInventoryAndLink = useCreateInventoryAndLink();

  const [irNumber, setIrNumber] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>(null);
  const [inventoryChoice, setInventoryChoice] = useState<"existing" | "new">("existing");
  const [showInventorySearch, setShowInventorySearch] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedInventoryName, setSelectedInventoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New inventory item fields (single request only)
  const [newItemName, setNewItemName] = useState("");
  const [newItemPartNumber, setNewItemPartNumber] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemMinQty, setNewItemMinQty] = useState("1");
  const [newItemLocation, setNewItemLocation] = useState("");

  const isSingle = requests.length === 1;
  const firstRequest = requests[0] ?? null;

  // Reset / initialise state when the dialog opens or requests change
  useEffect(() => {
    if (!open) {
      setIrNumber("");
      setUrgencyLevel(null);
      setInventoryChoice("existing");
      setSelectedInventoryId(null);
      setSelectedInventoryName("");
      setNewItemName("");
      setNewItemPartNumber("");
      setNewItemCategory("");
      setNewItemMinQty("1");
      setNewItemLocation("");
      return;
    }

    if (isSingle && firstRequest) {
      if (firstRequest.inventory_id) {
        setSelectedInventoryId(firstRequest.inventory_id);
        setSelectedInventoryName(firstRequest.inventory?.name ?? firstRequest.part_name);
        setInventoryChoice("existing");
      } else {
        setNewItemName(firstRequest.part_name);
        setNewItemPartNumber(firstRequest.part_number ?? "");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!requests.length) return;
    if (!irNumber.trim()) {
      toast({ variant: "destructive", title: "Required", description: "IR number is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Single request — optionally create/link inventory first
      let inventoryId = selectedInventoryId;
      if (isSingle && firstRequest && inventoryChoice === "new" && newItemName.trim()) {
        const result = await createInventoryAndLink.mutateAsync({
          requestId: firstRequest.id,
          name: newItemName,
          part_number: newItemPartNumber || undefined,
          category: newItemCategory || undefined,
          min_quantity: parseInt(newItemMinQty) || 1,
          location: newItemLocation || undefined,
          unit_price: firstRequest.unit_price || undefined,
        });
        inventoryId = result.inventoryItem.id;
      }

      for (const req of requests) {
        const reqInventoryId = isSingle ? inventoryId : req.inventory_id;

        await startProcurement.mutateAsync({
          id: req.id,
          ir_number: irNumber,
          urgency_level: urgencyLevel,
          inventory_id: reqInventoryId ?? undefined,
          is_from_inventory: !!reqInventoryId,
          vendor_id: req.vendor_id || null,
          unit_price: req.unit_price || null,
        });
      }

      toast({
        title: "Procurement Started",
        description:
          requests.length === 1
            ? "IR created — moved to Cash Manager"
            : `IR ${irNumber} created for ${requests.length} items — moved to Cash Manager`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Start procurement error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requests.length) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Start Procurement
              {requests.length > 1 && (
                <Badge variant="secondary">{requests.length} items</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {requests.length === 1
                ? "Assign an IR number and set urgency to move this item to the Cash Manager tab. Vendor and pricing details will be added during approval."
                : `One shared IR number and urgency for ${requests.length} items. Vendor and pricing details will be added during Cash Manager approval.`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-6 py-1">

              {/* ── Shared IR Number ─────────────────────── */}
              <div className="space-y-2">
                <Label htmlFor="ir_number">
                  IR Number <span className="text-destructive">*</span>
                  {requests.length > 1 && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      shared across all items
                    </span>
                  )}
                </Label>
                <Input
                  id="ir_number"
                  placeholder="e.g., IR-2026-001234"
                  value={irNumber}
                  onChange={(e) => setIrNumber(e.target.value)}
                />
              </div>

              {/* ── Urgency Level ────────────────────────── */}
              <div className="space-y-2">
                <Label>
                  Urgency Level
                  {requests.length > 1 && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      shared across all items
                    </span>
                  )}
                </Label>
                <Select
                  value={urgencyLevel || "__none__"}
                  onValueChange={(v) => setUrgencyLevel(v === "__none__" ? null : v as UrgencyLevel)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency level (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">No urgency set</span>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span>Urgent</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="1-week">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span>1 Week</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="2-weeks">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span>2 Weeks</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Single item ──────────────────────────── */}
              {isSingle && firstRequest && (
                <>
                  {/* Summary */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="font-medium">{firstRequest.part_name}</div>
                    {firstRequest.part_number && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {firstRequest.part_number}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Qty: <strong>{firstRequest.quantity}</strong></span>
                      {firstRequest.job_card?.job_number && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {firstRequest.job_card.job_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inventory link */}
                  {!firstRequest.inventory_id ? (
                    <div className="space-y-3">
                      <Label>Inventory Item</Label>
                      <RadioGroup
                        value={inventoryChoice}
                        onValueChange={(v) => setInventoryChoice(v as "existing" | "new")}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="inv-existing" />
                          <Label htmlFor="inv-existing" className="font-normal">
                            Link to existing inventory item
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="inv-new" />
                          <Label htmlFor="inv-new" className="font-normal">
                            Create new inventory item
                          </Label>
                        </div>
                      </RadioGroup>

                      {inventoryChoice === "existing" && (
                        selectedInventoryId ? (
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-950/20">
                            <Package className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">{selectedInventoryName}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedInventoryId(null); setSelectedInventoryName(""); }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowInventorySearch(true)}
                          >
                            <Search className="h-4 w-4 mr-2" />
                            Browse Inventory
                          </Button>
                        )
                      )}

                      {inventoryChoice === "new" && (
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                          <p className="text-sm font-medium flex items-center gap-1">
                            <Plus className="h-3 w-3" />
                            New Inventory Item
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Item Name *</Label>
                              <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Part name" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Part Number</Label>
                              <Input value={newItemPartNumber} onChange={(e) => setNewItemPartNumber(e.target.value)} placeholder="Part #" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Category</Label>
                              <Input value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} placeholder="e.g., Brakes" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Min Quantity</Label>
                              <Input type="number" min="1" value={newItemMinQty} onChange={(e) => setNewItemMinQty(e.target.value)} />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">Location</Label>
                              <Input value={newItemLocation} onChange={(e) => setNewItemLocation(e.target.value)} placeholder="e.g., Shelf A3" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert>
                      <Package className="h-4 w-4" />
                      <AlertDescription>
                        Linked to inventory:{" "}
                        <strong>{firstRequest.inventory?.name ?? firstRequest.part_name}</strong>
                        {firstRequest.inventory?.quantity !== undefined && (
                          <span className="ml-2 text-muted-foreground">
                            (Current stock: {firstRequest.inventory.quantity})
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* ── Multi-item ───────────────────────────── */}
              {!isSingle && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label>Items</Label>
                    <Badge variant="outline" className="text-xs">{requests.length} items</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Different vendors can be assigned to different items under the same IR number.
                  </p>

                  {requests.map((req, idx) => (
                    <div
                      key={req.id}
                      className="border rounded-lg p-3 bg-muted/10"
                    >
                      {/* Item header */}
                      <div className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 mt-0.5 shrink-0"
                        >
                          {idx + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{req.part_name}</div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>Qty: <strong>{req.quantity}</strong></span>
                            {req.part_number && (
                              <span className="font-mono">{req.part_number}</span>
                            )}
                            {req.job_card?.job_number && (
                              <span className="flex items-center gap-0.5">
                                <FileText className="h-3 w-3" />
                                {req.job_card.job_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !irNumber.trim()}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {requests.length === 1
                ? "Create IR & Start Procurement"
                : `Create IR for ${requests.length} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventorySearchDialog
        open={showInventorySearch}
        onOpenChange={setShowInventorySearch}
        onSelect={(item) => {
          setSelectedInventoryId(item.id);
          setSelectedInventoryName(item.name ?? "");
          setShowInventorySearch(false);
        }}
      />
    </>
  );
}
