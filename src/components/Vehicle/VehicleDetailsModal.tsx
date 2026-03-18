import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ensureAlert } from "@/lib/alertUtils";
import { AlertTriangle, CalendarDays, CheckCircle, Clock, Fuel, Gauge, Pencil, Plus } from "lucide-react";
import React, { useEffect, useState } from 'react';
import FleetTyreLayoutDiagram from "../tyres/FleetTyreLayoutDiagram";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  status: string;
  mileage: number;
  fuel_type: string;
  last_service_date: string;
  next_service_due: string;
  insurance_expiry: string;
  mot_expiry: string;
  created_at: string;
  updated_at: string;
  fleetNumber?: string | null;
}

interface VehicleDetailsModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VehicleDetailsModal: React.FC<VehicleDetailsModalProps> = ({
  vehicle,
  isOpen,
  onClose,
}) => {
  // Do not early-return before hook declarations; guard later before JSX return

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isDateSoon = (dateString: string, daysThreshold: number = 30) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= daysThreshold && diffDays >= 0;
  };

  const isDateOverdue = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Tracked documents for this vehicle (uses work_documents table)
  // ────────────────────────────────────────────────────────────────────────────
  type DocMetadata = { expiry_date?: string };
  type TrackedDoc = {
    id: string;
    document_type: string | null;
    document_number: string;
    title: string;
    file_name: string;
    file_url: string;
    metadata: DocMetadata | null; // expects metadata.expiry_date (ISO)
    uploaded_at: string | null;
    updated_at: string | null;
  };

  const { toast } = useToast();
  const [docs, setDocs] = useState<TrackedDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [hasOverdue, setHasOverdue] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingExpiry, setEditingExpiry] = useState<Record<string, Date | undefined>>({});

  const [newDoc, setNewDoc] = useState<{
    type: string;
    number: string;
    expiry: Date | undefined;
    file: File | null;
    customType: string;
  }>({ type: "license_disk", number: "", expiry: undefined, file: null, customType: "" });

  const COMMON_DOC_TYPES = [
    { value: "license_disk", label: "License Disk" },
    { value: "roadworthy", label: "Roadworthy" },
    { value: "insurance", label: "Insurance" },
    { value: "mot", label: "MOT" },
    { value: "cof", label: "COF" },
    { value: "permit", label: "Permit" },
  ];

  const fetchDocs = async () => {
    if (!vehicle?.id) return;
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("work_documents")
      .select("id, document_type, document_number, title, file_name, file_url, metadata, uploaded_at, updated_at")
      .eq("vehicle_id", vehicle.id)
      .order("uploaded_at", { ascending: false });
    if (!error && data) {
      setDocs(data as unknown as TrackedDoc[]);
      setHasOverdue(data.some((d) => (d.metadata as DocMetadata)?.expiry_date && isDateOverdue((d.metadata as DocMetadata).expiry_date)));
    }
    setLoadingDocs(false);
  };

  useEffect(() => {
    if (isOpen) fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vehicle?.id]);

  // Raise alerts for overdue/soon documents
  useEffect(() => {
    if (!vehicle || docs.length === 0) return;
    const sourceLabel = vehicle.fleetNumber || vehicle.registration;
    const today = new Date();
    docs.forEach((d) => {
      const expiry = d?.metadata?.expiry_date as string | undefined;
      if (!expiry) return;
      const exp = new Date(expiry);
      const soon = exp > today && (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 30;
      const overdue = exp < today;
      if (overdue || soon) {
        ensureAlert({
          sourceType: "vehicle",
          sourceId: vehicle.id,
          sourceLabel,
          category: "document_expiry",
          severity: overdue ? "high" : "medium",
          title: `${(d.document_type || "document").toString().toUpperCase()} ${overdue ? "expired" : "expiring soon"}`,
          message: `${d.title || d.document_number} ${overdue ? "expired on" : "expires on"} ${formatDate(expiry)}`,
          metadata: { vehicle_id: vehicle.id, document_type: d.document_type, document_number: d.document_number, expiry_date: expiry },
        }).catch(() => void 0);
      }
    });
  }, [docs, vehicle]);

  if (!vehicle) return null;

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;
    if (!newDoc.type || !newDoc.number || !newDoc.expiry || !newDoc.file || (newDoc.type === "custom" && !newDoc.customType)) {
      toast({ title: "Missing fields", description: "Type, number, expiry and file are required", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      // Upload file to 'documents' bucket
      const ext = newDoc.file.name.split(".").pop() || "dat";
      const path = `vehicle-documents/${vehicle.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, newDoc.file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      const publicUrl = urlData?.publicUrl as string;

      const { data: inserted, error } = await supabase
        .from("work_documents")
        .insert({
          document_type: "other",
          document_category: newDoc.type === "custom" ? newDoc.customType : newDoc.type,
          document_number: newDoc.number,
          title: `${(newDoc.type === "custom" ? newDoc.customType : newDoc.type).toUpperCase()} ${newDoc.number}`,
          file_name: newDoc.file.name,
          file_format: ext,
          file_url: publicUrl,
          uploaded_by: "system",
          metadata: { expiry_date: newDoc.expiry.toISOString().split('T')[0] },
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) {
        const { error: bindErr } = await supabase
          .from("work_documents")
          .update({ vehicle_id: vehicle.id })
          .eq("id", inserted.id);
        if (bindErr) throw bindErr;
      }
      setNewDoc({ type: "license_disk", number: "", expiry: undefined, file: null, customType: "" });
      await fetchDocs();
      toast({ title: "Document tracked", description: "Tracking has been added for this vehicle" });
    } catch {
      toast({ title: "Failed to add document", description: "Please try again", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateExpiry = async (docId: string, nextExpiry: Date | undefined) => {
    try {
      const target = docs.find((d) => d.id === docId);
      const meta = { ...(target?.metadata || {}), expiry_date: nextExpiry ? nextExpiry.toISOString().split('T')[0] : undefined };
      const { error } = await supabase.from("work_documents").update({ metadata: meta }).eq("id", docId);
      if (error) throw error;
      await fetchDocs();
      toast({ title: "Expiry updated" });
      setEditingId(null);
    } catch {
      toast({ title: "Failed to update expiry", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold">{vehicle.registration}</span>
            <Badge className={getStatusColor(vehicle.status)}>
              {vehicle.status}
            </Badge>
            {hasOverdue && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </TooltipTrigger>
                <TooltipContent>Expired document</TooltipContent>
              </Tooltip>
            )}
          </DialogTitle>
          <DialogDescription>
            {vehicle.make} {vehicle.model} ({vehicle.year})
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="tyres" disabled={!vehicle.fleetNumber}>Tyres</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vehicle Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Make:</span>
                      <p className="font-medium">{vehicle.make}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Model:</span>
                      <p className="font-medium">{vehicle.model}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Year:</span>
                      <p className="font-medium">{vehicle.year}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">VIN:</span>
                      <p className="font-medium font-mono text-xs">{vehicle.vin}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Fuel Type:</span>
                      <p className="font-medium flex items-center gap-1">
                        <Fuel className="h-4 w-4" />
                        {vehicle.fuel_type}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Mileage:</span>
                      <p className="font-medium">{vehicle.mileage?.toLocaleString()} miles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Information */}
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Created:</span>
                    <span>{formatDate(vehicle.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Last Updated:</span>
                    <span>{formatDate(vehicle.updated_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Vehicle ID:</span>
                    <span className="font-mono text-xs">{vehicle.id}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="maintenance">
            {/* Service & Maintenance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Service & Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-500">Last Service:</span>
                    <span className="font-medium">
                      {vehicle.last_service_date ? formatDate(vehicle.last_service_date) : 'N/A'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-500">Next Service Due:</span>
                    <div className="flex items-center gap-2">
                      {vehicle.next_service_due && isDateOverdue(vehicle.next_service_due) && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      {vehicle.next_service_due && isDateSoon(vehicle.next_service_due) && !isDateOverdue(vehicle.next_service_due) && (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className={`font-medium ${vehicle.next_service_due && isDateOverdue(vehicle.next_service_due)
                        ? 'text-red-600'
                        : vehicle.next_service_due && isDateSoon(vehicle.next_service_due)
                          ? 'text-yellow-600'
                          : ''
                        }`}>
                        {vehicle.next_service_due ? formatDate(vehicle.next_service_due) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="compliance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Legal & Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Legal & Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-500">MOT Expiry:</span>
                      <div className="flex items-center gap-2">
                        {vehicle.mot_expiry && isDateOverdue(vehicle.mot_expiry) && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        {vehicle.mot_expiry && isDateSoon(vehicle.mot_expiry) && !isDateOverdue(vehicle.mot_expiry) && (
                          <Clock className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className={`font-medium ${vehicle.mot_expiry && isDateOverdue(vehicle.mot_expiry)
                          ? 'text-red-600'
                          : vehicle.mot_expiry && isDateSoon(vehicle.mot_expiry)
                            ? 'text-yellow-600'
                            : ''
                          }`}>
                          {vehicle.mot_expiry ? formatDate(vehicle.mot_expiry) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-500">Insurance Expiry:</span>
                      <div className="flex items-center gap-2">
                        {vehicle.insurance_expiry && isDateOverdue(vehicle.insurance_expiry) && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        {vehicle.insurance_expiry && isDateSoon(vehicle.insurance_expiry) && !isDateOverdue(vehicle.insurance_expiry) && (
                          <Clock className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className={`font-medium ${vehicle.insurance_expiry && isDateOverdue(vehicle.insurance_expiry)
                          ? 'text-red-600'
                          : vehicle.insurance_expiry && isDateSoon(vehicle.insurance_expiry)
                            ? 'text-yellow-600'
                            : ''
                          }`}>
                          {vehicle.insurance_expiry ? formatDate(vehicle.insurance_expiry) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tracked Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Tracked Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new tracked document */}
                  <form onSubmit={handleAddDoc} className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newDoc.type} onValueChange={(v) => setNewDoc((s) => ({ ...s, type: v }))}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {COMMON_DOC_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newDoc.type === "custom" && (
                      <div className="flex-1 space-y-2">
                        <Label>Custom Type</Label>
                        <Input value={newDoc.customType} onChange={(e) => setNewDoc((s) => ({ ...s, customType: e.target.value }))} placeholder="Enter custom type" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Number</Label>
                      <Input value={newDoc.number} onChange={(e) => setNewDoc((s) => ({ ...s, number: e.target.value }))} placeholder="e.g. LIC-12345" />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry</Label>
                      <DatePicker value={newDoc.expiry} onChange={(date) => setNewDoc((s) => ({ ...s, expiry: date }))} />
                    </div>
                    <div className="flex gap-2">
                      <Label htmlFor="doc-file" className="sr-only">Upload</Label>
                      <Input id="doc-file" type="file" accept="*/*" onChange={(e) => setNewDoc((s) => ({ ...s, file: e.target.files?.[0] || null }))} />
                      <Button type="submit" disabled={adding} className="whitespace-nowrap"><Plus className="h-4 w-4 mr-1" /> Track</Button>
                    </div>
                  </form>

                  {/* Existing tracked documents */}
                  {loadingDocs ? (
                    <p className="text-sm text-muted-foreground">Loading documents…</p>
                  ) : docs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tracked documents yet. Add one above.</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((d) => {
                        const expiry = d?.metadata?.expiry_date;
                        const status = expiry ? (isDateOverdue(expiry) ? "overdue" : (isDateSoon(expiry) ? "soon" : "ok")) : "unset";
                        return (
                          <div key={d.id} className="flex items-center justify-between border rounded-md p-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{d.title || `${d.document_type?.toUpperCase()} ${d.document_number}`}</div>
                              <div className="text-xs text-muted-foreground truncate">{d.file_name}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              {editingId === d.id ? (
                                <div className="flex items-center gap-2">
                                  <DatePicker value={editingExpiry[d.id]} onChange={(date) => setEditingExpiry((prev) => ({ ...prev, [d.id]: date }))} />
                                  <Button size="sm" type="button" onClick={() => handleUpdateExpiry(d.id, editingExpiry[d.id])}>Save</Button>
                                </div>
                              ) : (
                                <>
                                  <Badge className={status === "overdue" ? "bg-red-100 text-red-700" : status === "soon" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}>
                                    {expiry ? (status === "ok" ? `Valid until ${formatDate(expiry)}` : status === "soon" ? `Expiring ${formatDate(expiry)}` : `Expired ${formatDate(expiry)}`) : "No expiry set"}
                                  </Badge>
                                  <Button variant="ghost" size="icon" title="Edit expiry" onClick={() => {
                                    const initialDate = expiry ? new Date(expiry) : undefined;
                                    setEditingExpiry((prev) => ({ ...prev, [d.id]: initialDate }));
                                    setEditingId(d.id);
                                  }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs underline">Open</a>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="tyres">
            <FleetTyreLayoutDiagram
              vehicleId={vehicle.id}
              registrationNumber={vehicle.registration}
              fleetNumber={vehicle.fleetNumber}
            />
          </TabsContent>
          <TabsContent value="alerts">
            {(
              (vehicle.next_service_due && (isDateOverdue(vehicle.next_service_due) || isDateSoon(vehicle.next_service_due))) ||
              (vehicle.mot_expiry && (isDateOverdue(vehicle.mot_expiry) || isDateSoon(vehicle.mot_expiry))) ||
              (vehicle.insurance_expiry && (isDateOverdue(vehicle.insurance_expiry) || isDateSoon(vehicle.insurance_expiry)))
            ) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      Alerts & Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {vehicle.next_service_due && isDateOverdue(vehicle.next_service_due) && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          Service is overdue since {formatDate(vehicle.next_service_due)}
                        </div>
                      )}
                      {vehicle.next_service_due && isDateSoon(vehicle.next_service_due) && !isDateOverdue(vehicle.next_service_due) && (
                        <div className="flex items-center gap-2 text-yellow-600 text-sm">
                          <Clock className="h-4 w-4" />
                          Service due soon on {formatDate(vehicle.next_service_due)}
                        </div>
                      )}
                      {vehicle.mot_expiry && isDateOverdue(vehicle.mot_expiry) && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          MOT expired on {formatDate(vehicle.mot_expiry)}
                        </div>
                      )}
                      {vehicle.mot_expiry && isDateSoon(vehicle.mot_expiry) && !isDateOverdue(vehicle.mot_expiry) && (
                        <div className="flex items-center gap-2 text-yellow-600 text-sm">
                          <Clock className="h-4 w-4" />
                          MOT expires soon on {formatDate(vehicle.mot_expiry)}
                        </div>
                      )}
                      {vehicle.insurance_expiry && isDateOverdue(vehicle.insurance_expiry) && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          Insurance expired on {formatDate(vehicle.insurance_expiry)}
                        </div>
                      )}
                      {vehicle.insurance_expiry && isDateSoon(vehicle.insurance_expiry) && !isDateOverdue(vehicle.insurance_expiry) && (
                        <div className="flex items-center gap-2 text-yellow-600 text-sm">
                          <Clock className="h-4 w-4" />
                          Insurance expires soon on {formatDate(vehicle.insurance_expiry)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
