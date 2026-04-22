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
import { AlertTriangle, CalendarDays, CheckCircle, Circle, Clock, ClipboardList, Fuel, Gauge, Pencil, Plus, Wrench, X } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { extractRegistrationNumber } from "@/constants/fleetTyreConfig";
import FleetTyreLayoutDiagram from "../tyres/FleetTyreLayoutDiagram";
import VehicleEquipmentList from "../tools/VehicleEquipmentList";

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
    { value: "insurance", label: "Insurance" },
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

  // ── Inspections state ──
  type InspectionRow = {
    id: string;
    inspection_number: string;
    inspection_date: string;
    inspection_type: string | null;
    inspector_name: string | null;
    status: string;
    has_fault: boolean | null;
    odometer_reading: number | null;
    notes: string | null;
  };
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);

  // ── Job cards / maintenance state ──
  type JobCardRow = {
    id: string;
    job_number: string;
    title: string;
    status: string;
    priority: string;
    assignee: string | null;
    due_date: string | null;
    created_at: string | null;
    description: string | null;
  };
  const [jobCards, setJobCards] = useState<JobCardRow[]>([]);
  const [loadingJobCards, setLoadingJobCards] = useState(false);

  // ── Fitted tyres state ──
  type FittedTyre = {
    id: string;
    serial_number: string | null;
    brand: string;
    model: string;
    size: string;
    position: string | null;
    current_fleet_position: string | null;
    current_tread_depth: number | null;
    condition: string | null;
  };
  const [fittedTyres, setFittedTyres] = useState<FittedTyre[]>([]);
  const [loadingTyres, setLoadingTyres] = useState(false);

  // ── Alerts state ──
  type AlertRow = {
    id: string;
    title: string;
    message: string;
    severity: string;
    category: string;
    status: string;
    triggered_at: string;
  };
  const [vehicleAlerts, setVehicleAlerts] = useState<AlertRow[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const fetchInspections = async () => {
    if (!vehicle?.id) return;
    setLoadingInspections(true);
    const { data, error } = await supabase
      .from("vehicle_inspections")
      .select("id, inspection_number, inspection_date, inspection_type, inspector_name, status, has_fault, odometer_reading, notes")
      .eq("vehicle_id", vehicle.id)
      .order("inspection_date", { ascending: false })
      .limit(20);
    if (!error && data) setInspections(data);
    setLoadingInspections(false);
  };

  const fetchJobCards = async () => {
    if (!vehicle?.id) return;
    setLoadingJobCards(true);
    const { data, error } = await supabase
      .from("job_cards")
      .select("id, job_number, title, status, priority, assignee, due_date, created_at, description")
      .eq("vehicle_id", vehicle.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setJobCards(data);
    setLoadingJobCards(false);
  };

  const fetchFittedTyres = async () => {
    if (!vehicle?.id) return;
    setLoadingTyres(true);
    try {
      // Try via fleet_tyre_positions first (most reliable)
      const fleet = vehicle.fleetNumber;
      if (fleet) {
        const regNo = extractRegistrationNumber(vehicle.registration);
        const { data: positions } = await supabase
          .from("fleet_tyre_positions")
          .select("tyre_code, position")
          .eq("fleet_number", fleet)
          .eq("registration_no", regNo);
        if (positions && positions.length > 0) {
          const tyreCodes = positions
            .map((p) => p.tyre_code)
            .filter((c): c is string => !!c && !c.startsWith("NEW_CODE_"));
          if (tyreCodes.length > 0) {
            const { data: tyreData } = await supabase
              .from("tyres")
              .select("id, serial_number, brand, model, size, position, current_fleet_position, current_tread_depth, condition")
              .in("id", tyreCodes);
            if (tyreData && tyreData.length > 0) {
              setFittedTyres(tyreData);
              setLoadingTyres(false);
              return;
            }
          }
        }
      }
      // Fallback: query tyres by current_fleet_position containing registration
      const { data } = await supabase
        .from("tyres")
        .select("id, serial_number, brand, model, size, position, current_fleet_position, current_tread_depth, condition")
        .ilike("current_fleet_position", `%${vehicle.registration}%`)
        .is("removal_date", null);
      if (data && data.length > 0) {
        setFittedTyres(data);
      }
    } catch (err) {
      console.error("Failed to fetch fitted tyres:", err);
    }
    setLoadingTyres(false);
  };

  const fetchAlerts = async () => {
    if (!vehicle?.id) return;
    setLoadingAlerts(true);
    const { data, error } = await supabase
      .from("alerts")
      .select("id, title, message, severity, category, status, triggered_at")
      .eq("source_type", "vehicle")
      .eq("source_id", vehicle.id)
      .order("triggered_at", { ascending: false })
      .limit(20);
    if (!error && data) setVehicleAlerts(data);
    setLoadingAlerts(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocs();
      fetchInspections();
      fetchJobCards();
      fetchFittedTyres();
      fetchAlerts();
    }
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
    if (!newDoc.type || !newDoc.expiry || (newDoc.type === "custom" && !newDoc.customType)) {
      toast({ title: "Missing fields", description: "Type and expiry are required", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      let publicUrl = "";
      let fileName = "No file";
      let fileFormat = "none";

      if (newDoc.file) {
        const ext = newDoc.file.name.split(".").pop() || "dat";
        const path = `vehicle-documents/${vehicle.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, newDoc.file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        publicUrl = urlData?.publicUrl as string;
        fileName = newDoc.file.name;
        fileFormat = ext;
      }

      const category = newDoc.type === "custom" ? newDoc.customType : newDoc.type;
      const docNumber = newDoc.number || `${category.toUpperCase()}-${Date.now()}`;

      const { error } = await supabase
        .from("work_documents")
        .insert({
          vehicle_id: vehicle.id,
          document_type: "other",
          document_category: category,
          document_number: docNumber,
          title: `${category.toUpperCase()} ${docNumber}`,
          file_name: fileName,
          file_format: fileFormat,
          file_url: publicUrl,
          uploaded_by: "system",
          metadata: newDoc.expiry ? { expiry_date: newDoc.expiry.toISOString().split('T')[0] } : null,
        });
      if (error) throw error;
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
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
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

            {/* Currently Fitted Tyres */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Circle className="h-5 w-5" />
                  Currently Fitted Tyres
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTyres ? (
                  <p className="text-sm text-muted-foreground">Loading tyres…</p>
                ) : fittedTyres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tyres currently fitted to this vehicle.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fittedTyres.map((t) => (
                      <div key={t.id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t.current_fleet_position || t.position || "—"}
                          </span>
                          {t.condition && (
                            <Badge variant={t.condition === "good" ? "default" : t.condition === "worn" ? "secondary" : "destructive"} className="text-xs">
                              {t.condition}
                            </Badge>
                          )}
                        </div>
                        <div className="font-medium text-sm">
                          {t.serial_number || "No serial"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.brand} {t.model} — {t.size}
                        </div>
                        {t.current_tread_depth != null && (
                          <div className="text-xs">
                            Tread: <span className="font-medium">{t.current_tread_depth}mm</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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

            {/* Job Cards */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Job Cards
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingJobCards ? (
                  <p className="text-sm text-muted-foreground">Loading job cards…</p>
                ) : jobCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No job cards found for this vehicle.</p>
                ) : (
                  <div className="space-y-2">
                    {jobCards.map((jc) => (
                      <div key={jc.id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{jc.title}</div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={jc.priority === "high" || jc.priority === "critical" ? "destructive" : jc.priority === "medium" ? "secondary" : "outline"} className="text-xs">
                              {jc.priority}
                            </Badge>
                            <Badge variant={jc.status === "completed" ? "default" : jc.status === "in_progress" ? "secondary" : "outline"} className="text-xs">
                              {jc.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                          <span>#{jc.job_number}</span>
                          {jc.assignee && <span>Assigned: {jc.assignee}</span>}
                          {jc.due_date && <span>Due: {formatDate(jc.due_date)}</span>}
                          {jc.created_at && <span>Created: {formatDate(jc.created_at)}</span>}
                        </div>
                        {jc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{jc.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inspection History */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Inspection History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingInspections ? (
                  <p className="text-sm text-muted-foreground">Loading inspections…</p>
                ) : inspections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inspections recorded for this vehicle.</p>
                ) : (
                  <div className="space-y-2">
                    {inspections.map((insp) => (
                      <div key={insp.id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">
                            #{insp.inspection_number}
                            {insp.inspection_type && (
                              <span className="ml-2 text-muted-foreground font-normal capitalize">
                                ({insp.inspection_type.replace(/_/g, " ")})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {insp.has_fault && (
                              <Badge variant="destructive" className="text-xs">Faults</Badge>
                            )}
                            <Badge variant={insp.status === "completed" ? "default" : insp.status === "in_progress" ? "secondary" : "outline"} className="text-xs">
                              {insp.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                          <span>{formatDate(insp.inspection_date)}</span>
                          {insp.inspector_name && <span>By: {insp.inspector_name}</span>}
                          {insp.odometer_reading != null && <span>Odo: {insp.odometer_reading.toLocaleString()} km</span>}
                        </div>
                        {insp.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{insp.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                  <form onSubmit={handleAddDoc} className="space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
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
                        <div className="space-y-1">
                          <Label className="text-xs">Custom Type</Label>
                          <Input value={newDoc.customType} onChange={(e) => setNewDoc((s) => ({ ...s, customType: e.target.value }))} placeholder="Enter custom type" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Number</Label>
                        <Input value={newDoc.number} onChange={(e) => setNewDoc((s) => ({ ...s, number: e.target.value }))} placeholder="e.g. LIC-12345" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Expiry</Label>
                        <DatePicker value={newDoc.expiry} onChange={(date) => setNewDoc((s) => ({ ...s, expiry: date }))} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[200px]">
                        <Label htmlFor="doc-file" className="text-xs">File <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input id="doc-file" type="file" accept="*/*" onChange={(e) => setNewDoc((s) => ({ ...s, file: e.target.files?.[0] || null }))} />
                      </div>
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
                          <div key={d.id} className="border rounded-md p-2 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{d.title || `${d.document_type?.toUpperCase()} ${d.document_number}`}</div>
                                <div className="text-xs text-muted-foreground truncate">{d.file_name}</div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {editingId !== d.id && (
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
                            {editingId === d.id && (
                              <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                                <div className="flex-1 min-w-[160px]">
                                  <DatePicker value={editingExpiry[d.id]} onChange={(date) => setEditingExpiry((prev) => ({ ...prev, [d.id]: date }))} />
                                </div>
                                <Button size="sm" type="button" onClick={() => handleUpdateExpiry(d.id, editingExpiry[d.id])}>Save</Button>
                                <Button size="sm" variant="ghost" type="button" onClick={() => setEditingId(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
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
            {/* Static alerts from vehicle fields */}
            {(
              (vehicle.next_service_due && (isDateOverdue(vehicle.next_service_due) || isDateSoon(vehicle.next_service_due))) ||
              (vehicle.insurance_expiry && (isDateOverdue(vehicle.insurance_expiry) || isDateSoon(vehicle.insurance_expiry)))
            ) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      Upcoming / Overdue
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

            {/* Alerts from database */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Alert History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAlerts ? (
                  <p className="text-sm text-muted-foreground">Loading alerts…</p>
                ) : vehicleAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No alerts recorded for this vehicle.</p>
                ) : (
                  <div className="space-y-2">
                    {vehicleAlerts.map((a) => (
                      <div key={a.id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.severity === "high" || a.severity === "critical" ? (
                              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            ) : a.severity === "medium" ? (
                              <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">{a.title}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={a.status === "resolved" ? "default" : a.status === "acknowledged" ? "secondary" : "destructive"} className="text-xs">
                              {a.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.message}</p>
                        <div className="text-xs text-muted-foreground flex gap-3">
                          <span>{formatDate(a.triggered_at)}</span>
                          <span className="capitalize">{a.category.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="equipment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Tools &amp; Equipment Assigned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VehicleEquipmentList vehicleId={vehicle.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
