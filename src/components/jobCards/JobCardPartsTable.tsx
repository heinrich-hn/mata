import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { Circle, DollarSign, FileText, Loader2, Package, Pencil, Plus, ShoppingBag, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import AddPartWithCostDialog from "../dialogs/AddPartWithCostDialog";
import InventoryDetailDialog from "../dialogs/InventoryDetailDialog";

interface PartsRequest {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  // Phase 1 new fields
  inventory_id?: string | null;
  unit_price?: number | null;
  total_price?: number | null;
  requested_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  is_from_inventory?: boolean | null;
  // Phase 2 new fields
  vendor_id?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  is_service?: boolean | null;
  service_description?: string | null;
  // Procurement workflow fields
  ir_number?: string | null;
  sage_requisition_number?: string | null;
  procurement_started?: boolean | null;
  cash_manager_approval_date?: string | null;
  cash_manager_reference?: string | null;
  ordered_at?: string | null;
  received_date?: string | null;
  allocated_to_job_card?: boolean | null;
  // Tyre inventory link
  tyre_id?: string | null;
  vendors?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  inventory?: {
    id: string;
    name: string;
    part_number: string;
    quantity: number;
    unit_price: number | null;
    location?: string | null;
    supplier?: string | null;
  } | null;
}

interface JobCardPartsTableProps {
  jobCardId: string;
  parts: PartsRequest[];
  onRefresh: () => void;
  fleetNumber?: string | null;
  jobNumber?: string | null;
  isTyreJobCard?: boolean;
}

const JobCardPartsTable = ({ jobCardId, parts, onRefresh, fleetNumber, jobNumber, isTyreJobCard = false }: JobCardPartsTableProps) => {
  const [showRequestParts, setShowRequestParts] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [showInventoryDetail, setShowInventoryDetail] = useState(false);
  const [deletePartId, setDeletePartId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editPart, setEditPart] = useState<PartsRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleEditPart = async () => {
    if (!editPart || isEditing) return;

    setIsEditing(true);
    try {
      const { error } = await supabase
        .from("parts_requests")
        .update({
          part_name: editPart.part_name,
          part_number: editPart.part_number,
          quantity: editPart.quantity,
          unit_price: editPart.unit_price,
          total_price: (editPart.unit_price || 0) * editPart.quantity,
          notes: editPart.notes,
          service_description: editPart.service_description,
        })
        .eq("id", editPart.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update part/service",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Part/service updated successfully",
        });
        requestGoogleSheetsSync('workshop');
        onRefresh();
        setEditPart(null);
      }
    } finally {
      setIsEditing(false);
    }
  };

  const handleInventoryClick = (inventoryId: string | null) => {
    if (inventoryId) {
      setSelectedInventoryId(inventoryId);
      setShowInventoryDetail(true);
    }
  };

  const getSourceIcon = (part: PartsRequest) => {
    if (part.is_service) {
      return <Wrench className="h-3 w-3" />;
    } else if (part.tyre_id) {
      return <Circle className="h-3 w-3" />;
    } else if (part.is_from_inventory) {
      return <Package className="h-3 w-3" />;
    } else {
      return <DollarSign className="h-3 w-3" />;
    }
  };

  const getSourceLabel = (part: PartsRequest) => {
    if (part.is_service) return "Service";
    if (part.tyre_id) return "Tyre Inv.";
    if (part.is_from_inventory) return "Inventory";
    return "External";
  };

  const getSourceColor = (part: PartsRequest) => {
    if (part.is_service) return "bg-purple-100 text-purple-700 hover:bg-purple-200";
    if (part.tyre_id) return "bg-cyan-100 text-cyan-700 hover:bg-cyan-200";
    if (part.is_from_inventory) return "bg-green-100 text-green-700 hover:bg-green-200";
    return "bg-orange-100 text-orange-700 hover:bg-orange-200";
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "approved": return "default";
      case "pending": return "secondary";
      case "rejected": return "destructive";
      case "fulfilled": return "default";
      default: return "secondary";
    }
  };

  // Procurement status helper
  const getProcurementInfo = (part: PartsRequest) => {
    const irNum = part.ir_number || part.sage_requisition_number;
    if (!irNum && !part.procurement_started) return null;

    let step = "IR Created";
    let variant: "default" | "secondary" | "outline" | "destructive" = "secondary";
    if (part.allocated_to_job_card) {
      step = "Fulfilled";
      variant = "default";
    } else if (part.received_date) {
      step = "Received";
      variant = "default";
    } else if (part.ordered_at) {
      step = "Ordered";
      variant = "outline";
    } else if (part.cash_manager_approval_date) {
      step = "Approved";
      variant = "outline";
    }

    return { irNum, step, variant };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Parts &amp; Services</CardTitle>
          {(fleetNumber || jobNumber) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {fleetNumber && (
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Fleet: <span className="font-mono font-medium text-foreground">{fleetNumber}</span>
                </span>
              )}
              {jobNumber && (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Job Card: <span className="font-mono font-medium text-foreground">{jobNumber}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <Button onClick={() => setShowRequestParts(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Part/Service
        </Button>
      </CardHeader>
      <CardContent>
        {parts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No parts or services added yet. Click "Add Part/Service" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Name/Description</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Doc</TableHead>
                  <TableHead>IR / Procurement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id}>
                    {/* Source Indicator */}
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getSourceColor(part)} ${part.is_from_inventory ? 'cursor-pointer' : ''
                                }`}
                              onClick={() =>
                                part.is_from_inventory && handleInventoryClick(part.inventory_id || null)
                              }
                            >
                              {getSourceIcon(part)}
                              {getSourceLabel(part)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {part.is_service
                              ? "Service/Repair work"
                              : part.is_from_inventory
                                ? "Click to view inventory details"
                                : "External vendor part"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    {/* Part Name / Service Description */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{part.part_name}</div>
                        {part.is_service && part.service_description && (
                          <div className="text-xs text-muted-foreground italic line-clamp-2">
                            {part.service_description}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Part Number */}
                    <TableCell className="text-sm">{part.part_number || "-"}</TableCell>

                    {/* Vendor */}
                    <TableCell className="text-sm">
                      {part.vendors?.name || "-"}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="text-right">{part.quantity}</TableCell>

                    {/* Price */}
                    <TableCell className="text-right">
                      {part.total_price ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-primary">
                            ${part.total_price.toFixed(2)}
                          </div>
                          {part.unit_price && (
                            <div className="text-xs text-muted-foreground">
                              ${part.unit_price.toFixed(2)} each
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Document */}
                    <TableCell>
                      {part.document_url ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <a
                                href={part.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View document"
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
                              >
                                <FileText className="h-4 w-4 text-blue-700" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              View {part.document_name || "document"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </TableCell>

                    {/* IR / Procurement Status */}
                    <TableCell>
                      {(() => {
                        const info = getProcurementInfo(part);
                        if (info) {
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-mono font-medium">{info.irNum}</span>
                              </div>
                              <Badge variant={info.variant} className="text-[10px] px-1.5 py-0">
                                {info.step}
                              </Badge>
                            </div>
                          );
                        }
                        // Show "Needs Procurement" for out-of-stock items without IR
                        if (part.notes?.includes('[OUT OF STOCK')) {
                          return (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Awaiting IR
                            </Badge>
                          );
                        }
                        return <span className="text-xs text-muted-foreground">—</span>;
                      })()}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge variant={getStatusVariant(part.status)}>
                        {part.status}
                      </Badge>
                    </TableCell>

                    {/* Notes */}
                    <TableCell>
                      {part.notes ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                                {part.notes}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {part.notes}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setEditPart({ ...part })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletePartId(part.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AddPartWithCostDialog
          open={showRequestParts}
          onOpenChange={setShowRequestParts}
          jobCardId={jobCardId}
          onSuccess={onRefresh}
          isTyreJobCard={isTyreJobCard}
        />

        <InventoryDetailDialog
          open={showInventoryDetail}
          onOpenChange={setShowInventoryDetail}
          inventoryId={selectedInventoryId}
        />

        {/* Edit Part/Service Dialog */}
        <Dialog open={!!editPart} onOpenChange={(open) => !open && setEditPart(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {editPart?.is_service ? "Service" : "Part"}</DialogTitle>
            </DialogHeader>
            {editPart && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-part-name">{editPart.is_service ? "Service Name" : "Part Name"} *</Label>
                  <Input
                    id="edit-part-name"
                    value={editPart.part_name}
                    onChange={(e) => setEditPart({ ...editPart, part_name: e.target.value })}
                    required
                  />
                </div>
                {!editPart.is_service && (
                  <div>
                    <Label htmlFor="edit-part-number">Part Number</Label>
                    <Input
                      id="edit-part-number"
                      value={editPart.part_number || ""}
                      onChange={(e) => setEditPart({ ...editPart, part_number: e.target.value || null })}
                    />
                  </div>
                )}
                {editPart.is_service && (
                  <div>
                    <Label htmlFor="edit-service-desc">Service Description</Label>
                    <Textarea
                      id="edit-service-desc"
                      value={editPart.service_description || ""}
                      onChange={(e) => setEditPart({ ...editPart, service_description: e.target.value || null })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-quantity">Quantity *</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      min="1"
                      value={editPart.quantity}
                      onChange={(e) => setEditPart({ ...editPart, quantity: parseInt(e.target.value) || 1 })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-unit-price">Unit Price</Label>
                    <Input
                      id="edit-unit-price"
                      type="number"
                      step="0.01"
                      value={editPart.unit_price || ""}
                      onChange={(e) => setEditPart({ ...editPart, unit_price: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={editPart.notes || ""}
                    onChange={(e) => setEditPart({ ...editPart, notes: e.target.value || null })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditPart(null)}>Cancel</Button>
                  <Button onClick={handleEditPart} disabled={isEditing}>
                    {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Part/Service Dialog */}
        <AlertDialog open={!!deletePartId} onOpenChange={(open) => !open && setDeletePartId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Part/Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this part or service? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async (e) => {
                  e.preventDefault();
                  if (!deletePartId) return;

                  setIsDeleting(true);
                  try {
                    const { error } = await supabase
                      .from("parts_requests")
                      .delete()
                      .eq("id", deletePartId);

                    if (error) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to delete part/service",
                        variant: "destructive",
                      });
                    } else {
                      toast({
                        title: "Success",
                        description: "Part/service deleted successfully",
                      });
                      requestGoogleSheetsSync('workshop');
                      onRefresh();
                    }
                  } catch {
                    toast({
                      title: "Error",
                      description: "An unexpected error occurred while deleting",
                      variant: "destructive",
                    });
                  } finally {
                    setIsDeleting(false);
                    setDeletePartId(null);
                  }
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default JobCardPartsTable;