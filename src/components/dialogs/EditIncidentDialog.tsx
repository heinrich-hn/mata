import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import
  {
    DOCUMENT_TYPES,
    useAddTimelineNote,
    useDeleteIncidentDocument,
    useIncidentDocuments,
    useIncidentTimeline,
    useUploadIncidentDocument,
  } from "@/hooks/useIncidentDocuments";
import type { Incident } from "@/hooks/useIncidents";
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { recoverIncidentImages } from "@/utils/recoverIncidentImages";
import { useQueryClient } from "@tanstack/react-query";
import
  {
    AlertTriangle,
    Calendar,
    Camera,
    CheckCircle,
    Clock,
    Download,
    FileText,
    Image as ImageIcon,
    MessageSquare,
    Plus,
    RefreshCw,
    Send,
    Shield,
    Trash2,
    Upload,
    X
  } from "lucide-react";
import { useEffect, useState } from "react";

interface EditIncidentDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INCIDENT_TYPES = [
  { value: "collision", label: "Collision" },
  { value: "theft", label: "Theft" },
  { value: "vandalism", label: "Vandalism" },
  { value: "fire", label: "Fire" },
  { value: "mechanical_failure", label: "Mechanical Failure" },
  { value: "tire_blowout", label: "Tire Blowout" },
  { value: "cargo_damage", label: "Cargo Damage" },
  { value: "driver_injury", label: "Driver Injury" },
  { value: "third_party_injury", label: "Third Party Injury" },
  { value: "weather_related", label: "Weather Related" },
  { value: "road_hazard", label: "Road Hazard" },
  { value: "other", label: "Other" },
];

const WEATHER_CONDITIONS = [
  { value: "clear", label: "Clear" },
  { value: "cloudy", label: "Cloudy" },
  { value: "rain", label: "Rain" },
  { value: "heavy_rain", label: "Heavy Rain" },
  { value: "fog", label: "Fog" },
  { value: "snow", label: "Snow" },
  { value: "hail", label: "Hail" },
  { value: "windy", label: "Windy" },
  { value: "storm", label: "Storm" },
  { value: "unknown", label: "Unknown" },
];

const EditIncidentDialog = ({
  incident,
  open,
  onOpenChange,
}: EditIncidentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const { data: documents = [] } = useIncidentDocuments(incident?.id || null);
  const { data: timeline = [] } = useIncidentTimeline(incident?.id || null);
  const uploadDocument = useUploadIncidentDocument();
  const deleteDocument = useDeleteIncidentDocument();
  const addNote = useAddTimelineNote();

  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newNote, setNewNote] = useState("");

  // Document upload state
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("other");
  const [docDescription, setDocDescription] = useState("");

  const [formData, setFormData] = useState({
    vehicleId: "",
    incidentDate: "",
    incidentTime: "",
    location: "",
    incidentType: "other",
    weatherCondition: "unknown",
    description: "",
    driverName: "",
    severityRating: "3",
    notes: "",
  });

  useEffect(() => {
    if (incident) {
      setFormData({
        vehicleId: incident.vehicle_id || "",
        incidentDate: incident.incident_date,
        incidentTime: incident.incident_time,
        location: incident.location,
        incidentType: incident.incident_type,
        weatherCondition: incident.weather_condition || "unknown",
        description: incident.description || "",
        driverName: incident.driver_name || "",
        severityRating: incident.severity_rating?.toString() || "3",
        notes: incident.notes || "",
      });
      setNewImages([]);
      setNewNote("");
      setDocFile(null);
      setDocType("other");
      setDocDescription("");
    }
  }, [incident]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const existingCount = Array.isArray(incident?.images)
        ? incident.images.length
        : 0;
      const maxNew = 6 - existingCount - newImages.length;
      const files = Array.from(e.target.files).slice(0, maxNew);
      setNewImages([...newImages, ...files]);
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleSaveDetails = async () => {
    if (!incident) return;
    setLoading(true);

    try {
      // Upload new images if any
      const updatedImages = Array.isArray(incident.images) ? [...incident.images] : [];
      console.log("EditIncident - Starting save. Existing images:", updatedImages.length);
      console.log("EditIncident - New images to upload:", newImages.length);

      for (const file of newImages) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${incident.id}/${Date.now()}.${fileExt}`;
        console.log("EditIncident - Uploading file:", file.name, "as", fileName);

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("incident-images")
          .upload(fileName, file);

        if (uploadError) {
          console.error("EditIncident - Upload failed:", uploadError);
        } else {
          console.log("EditIncident - Upload success:", uploadData);
          const { data: urlData } = supabase.storage
            .from("incident-images")
            .getPublicUrl(fileName);

          console.log("EditIncident - Public URL:", urlData.publicUrl);
          updatedImages.push({
            url: urlData.publicUrl,
            name: file.name,
            uploaded_at: new Date().toISOString(),
          });
        }
      }

      console.log("EditIncident - Final images array:", updatedImages);

      // Update incident
      const { error, data: updateResult } = await supabase
        .from("incidents")
        .update({
          vehicle_id: formData.vehicleId || null,
          incident_date: formData.incidentDate,
          incident_time: formData.incidentTime,
          location: formData.location,
          incident_type: formData.incidentType as "collision" | "theft" | "vandalism" | "fire" | "mechanical_failure" | "tire_blowout" | "cargo_damage" | "driver_injury" | "third_party_injury" | "weather_related" | "road_hazard" | "other",
          weather_condition: formData.weatherCondition as "clear" | "cloudy" | "rain" | "heavy_rain" | "fog" | "snow" | "hail" | "windy" | "storm" | "unknown",
          description: formData.description || null,
          driver_name: formData.driverName || null,
          severity_rating: parseInt(formData.severityRating),
          notes: formData.notes || null,
          images: updatedImages, // JSONB array, not a string
        })
        .eq("id", incident.id)
        .select();

      console.log("EditIncident - Update result:", updateResult, "Error:", error);

      if (error) throw error;

      // Add timeline entry for update
      if (newImages.length > 0) {
        await supabase.from("incident_timeline").insert({
          incident_id: incident.id,
          event_type: "photo_added",
          event_title: "Photos Added",
          event_description: `${newImages.length} photo(s) were added`,
          performed_by: "Current User",
        });
      }

      await supabase.from("incident_timeline").insert({
        incident_id: incident.id,
        event_type: "updated",
        event_title: "Incident Updated",
        event_description: "Incident details were updated",
        performed_by: "Current User",
      });

      toast({
        title: "Incident Updated",
        description: "Changes have been saved successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", incident.id],
      });

      setNewImages([]);
    } catch (err) {
      console.error("Error updating incident:", err);
      toast({
        title: "Error",
        description: "Failed to update incident. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverImages = async () => {
    if (!incident) return;
    setRecovering(true);

    try {
      const result = await recoverIncidentImages(incident.id);

      if (result.recovered) {
        toast({
          title: "Images Recovered",
          description: `Successfully recovered ${result.found.length - (result.existing?.length || 0)} image(s) from storage.`,
        });
        queryClient.invalidateQueries({ queryKey: ["incidents"] });
        queryClient.invalidateQueries({
          queryKey: ["incident-timeline", incident.id],
        });
      } else if (result.found.length > 0) {
        toast({
          title: "No Orphaned Images",
          description: `Found ${result.found.length} image(s) in storage, all already linked.`,
        });
      } else {
        toast({
          title: "No Images Found",
          description: result.error || "No images found in storage for this incident.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error recovering images:", err);
      toast({
        title: "Recovery Failed",
        description: "Could not recover images. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setRecovering(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!incident || !docFile) return;

    await uploadDocument.mutateAsync({
      incidentId: incident.id,
      file: docFile,
      documentType: docType,
      description: docDescription,
      uploadedBy: "Current User",
    });

    setDocFile(null);
    setDocType("other");
    setDocDescription("");
  };

  const handleAddNote = async () => {
    if (!incident || !newNote.trim()) return;

    await addNote.mutateAsync({
      incidentId: incident.id,
      note: newNote.trim(),
      addedBy: "Current User",
    });

    setNewNote("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Open
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="gap-1 bg-yellow-500">
            <Clock className="h-3 w-3" />
            Processing
          </Badge>
        );
      case "closed":
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Closed
          </Badge>
        );
      case "claimed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-green-500 text-green-600"
          >
            <Shield className="h-3 w-3" />
            Claimed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTimelineIcon = (eventType: string) => {
    switch (eventType) {
      case "created":
        return <Plus className="h-4 w-4" />;
      case "status_change":
        return <AlertTriangle className="h-4 w-4" />;
      case "document_added":
      case "document_removed":
        return <FileText className="h-4 w-4" />;
      case "photo_added":
        return <ImageIcon className="h-4 w-4" />;
      case "note_added":
        return <MessageSquare className="h-4 w-4" />;
      case "updated":
        return <Clock className="h-4 w-4" />;
      case "closed":
        return <CheckCircle className="h-4 w-4" />;
      case "claimed":
        return <Shield className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTimelineColor = (eventType: string) => {
    switch (eventType) {
      case "created":
        return "bg-blue-500";
      case "status_change":
        return "bg-yellow-500";
      case "document_added":
        return "bg-purple-500";
      case "document_removed":
        return "bg-red-400";
      case "photo_added":
        return "bg-green-500";
      case "note_added":
        return "bg-gray-500";
      case "closed":
        return "bg-gray-600";
      case "claimed":
        return "bg-green-600";
      default:
        return "bg-gray-400";
    }
  };

  if (!incident) return null;

  const existingImages = Array.isArray(incident.images) ? incident.images : [];
  const totalImages = existingImages.length + newImages.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {incident.incident_number}
              </DialogTitle>
              <DialogDescription>
                Edit incident details, upload documents, and view timeline
              </DialogDescription>
            </div>
            {getStatusBadge(incident.status)}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="photos">
              Photos ({totalImages})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">
              Timeline ({timeline.length})
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentDate">Date</Label>
                <DatePicker
                  id="incidentDate"
                  value={formData.incidentDate}
                  onChange={(date) =>
                    setFormData({ ...formData, incidentDate: date ? date.toISOString().split('T')[0] : '' })
                  }
                  placeholder="Select incident date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incidentTime">Time</Label>
                <Input
                  id="incidentTime"
                  type="time"
                  value={formData.incidentTime}
                  onChange={(e) =>
                    setFormData({ ...formData, incidentTime: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleId">Vehicle</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) =>
                  setFormData({ ...formData, vehicleId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      <div className="flex items-center gap-2">
                        {vehicle.fleet_number && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {vehicle.fleet_number}
                          </Badge>
                        )}
                        <span className="font-medium">{vehicle.registration_number}</span>
                        <span className="text-muted-foreground text-sm">
                          {vehicle.make} {vehicle.model}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentType">Incident Type</Label>
                <Select
                  value={formData.incidentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, incidentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weatherCondition">Weather</Label>
                <Select
                  value={formData.weatherCondition}
                  onValueChange={(value) =>
                    setFormData({ ...formData, weatherCondition: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEATHER_CONDITIONS.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value}>
                        {condition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverName">Driver Name</Label>
              <Input
                id="driverName"
                value={formData.driverName}
                onChange={(e) =>
                  setFormData({ ...formData, driverName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="severityRating">Severity Rating</Label>
              <Select
                value={formData.severityRating}
                onValueChange={(value) =>
                  setFormData({ ...formData, severityRating: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Minor</SelectItem>
                  <SelectItem value="2">2 - Low</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="5">5 - Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={2}
                placeholder="Add internal notes..."
              />
            </div>

            <Button
              onClick={handleSaveDetails}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Saving..." : "Save Details"}
            </Button>
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Photos ({totalImages}/6)</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRecoverImages}
                    disabled={recovering}
                    title="Scan storage for orphaned images"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${recovering ? "animate-spin" : ""}`} />
                    {recovering ? "Scanning..." : "Recover"}
                  </Button>
                  {totalImages < 6 && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        multiple
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          <Camera className="h-4 w-4 mr-2" />
                          Add Photos
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Existing images */}
                {existingImages.map((image, index) => (
                  <div
                    key={`existing-${index}`}
                    className="relative aspect-square rounded-lg overflow-hidden border"
                  >
                    <img
                      src={image.url}
                      alt={image.name || `Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View full-size image"
                      className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors"
                    />
                  </div>
                ))}

                {/* New images to upload */}
                {newImages.map((file, index) => (
                  <div
                    key={`new-${index}`}
                    className="relative aspect-square rounded-lg overflow-hidden border border-dashed border-primary"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`New ${index + 1}`}
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute top-1 left-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded">
                      New
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute top-1 right-1 bg-destructive text-white p-1 rounded"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                {/* Add photo placeholder */}
                {totalImages < 6 && (
                  <label className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </label>
                )}
              </div>

              {newImages.length > 0 && (
                <Button onClick={handleSaveDetails} disabled={loading}>
                  {loading ? "Uploading..." : `Save ${newImages.length} New Photo(s)`}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 mt-4">
            {/* Upload new document */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="docType">Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docFile">File</Label>
                  <Input
                    id="docFile"
                    type="file"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="docDescription">Description (optional)</Label>
                <Input
                  id="docDescription"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="Brief description of the document..."
                />
              </div>

              <Button
                onClick={handleUploadDocument}
                disabled={!docFile || uploadDocument.isPending}
                size="sm"
              >
                {uploadDocument.isPending ? "Uploading..." : "Upload Document"}
              </Button>
            </div>

            <Separator />

            {/* Existing documents */}
            <div className="space-y-2">
              <h4 className="font-medium">Uploaded Documents</h4>
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No documents uploaded yet
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.document_type.replace(/_/g, " ")} •{" "}
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            deleteDocument.mutate({
                              document: doc,
                              deletedBy: "Current User",
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4 mt-4">
            {/* Add note */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a note to the timeline..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newNote.trim()) {
                    handleAddNote();
                  }
                }}
              />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || addNote.isPending}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {/* Timeline */}
            <div className="relative">
              {timeline.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No timeline events yet
                </p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      {/* Timeline line and dot */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full ${getTimelineColor(
                            event.event_type
                          )} flex items-center justify-center text-white`}
                        >
                          {getTimelineIcon(event.event_type)}
                        </div>
                        {index < timeline.length - 1 && (
                          <div className="w-0.5 h-full min-h-[40px] bg-border" />
                        )}
                      </div>

                      {/* Event content */}
                      <div className="pb-6 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {event.event_title}
                          </p>
                          {event.new_status && (
                            <Badge variant="outline" className="text-xs">
                              {event.new_status}
                            </Badge>
                          )}
                        </div>
                        {event.event_description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.event_description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(event.created_at).toLocaleString()}
                          <span>•</span>
                          {event.performed_by}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EditIncidentDialog;