import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DriverSelect } from "@/components/ui/driver-select";
import { InspectorSelect } from "@/components/ui/inspector-select";
import { VehicleSelect } from "@/components/ui/vehicle-select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { useState } from "react";

interface AddIncidentDialogProps {
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

const AddIncidentDialog = ({ open, onOpenChange }: AddIncidentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    vehicleId: "",
    incidentDate: new Date().toISOString().split("T")[0],
    incidentTime: new Date().toTimeString().slice(0, 5),
    location: "",
    incidentType: "other",
    weatherCondition: "unknown",
    description: "",
    reportedBy: "",
    driverName: "",
    driverId: "",
    severityRating: "3",
  });

  const generateIncidentNumber = async () => {
    const currentYear = new Date().getFullYear();
    const prefix = `INC-${currentYear}-`;

    // Get the highest existing incident number for this year
    const { data } = await supabase
      .from("incidents")
      .select("incident_number")
      .like("incident_number", `${prefix}%`)
      .order("incident_number", { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      // Extract the sequence number from the last incident number
      const lastNumber = data[0].incident_number;
      const seqPart = lastNumber.replace(prefix, "");
      const lastSeq = parseInt(seqPart, 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).slice(0, 6 - images.length);
      setImages([...images, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const uploadImages = async (incidentId: string): Promise<Array<{ url: string; name: string; uploaded_at: string }>> => {
    const uploadedImages: Array<{ url: string; name: string; uploaded_at: string }> = [];

    for (const file of images) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${incidentId}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("incident-images")
        .upload(fileName, file);

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("incident-images")
          .getPublicUrl(fileName);

        uploadedImages.push({
          url: urlData.publicUrl,
          name: file.name,
          uploaded_at: new Date().toISOString(),
        });
      }
    }

    return uploadedImages;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location || !formData.reportedBy) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const incidentNumber = await generateIncidentNumber();

      // Insert incident first
      const { data: incident, error } = await supabase
        .from("incidents")
        .insert({
          incident_number: incidentNumber,
          incident_date: formData.incidentDate,
          incident_time: formData.incidentTime,
          vehicle_id: formData.vehicleId || null,
          location: formData.location,
          incident_type: formData.incidentType as "collision" | "theft" | "vandalism" | "fire" | "mechanical_failure" | "tire_blowout" | "cargo_damage" | "driver_injury" | "third_party_injury" | "weather_related" | "road_hazard" | "other",
          weather_condition: formData.weatherCondition as "clear" | "cloudy" | "rain" | "heavy_rain" | "fog" | "snow" | "hail" | "windy" | "storm" | "unknown",
          description: formData.description || null,
          reported_by: formData.reportedBy,
          driver_name: formData.driverName || null,
          driver_id: formData.driverId || null,
          severity_rating: parseInt(formData.severityRating),
          status: "open" as const,
          images: [], // JSONB array, not a string
        })
        .select()
        .single();

      if (error) throw error;

      // Upload images if any
      if (images.length > 0 && incident) {
        console.log("Uploading", images.length, "images for incident", incident.id);
        const uploadedImages = await uploadImages(incident.id);
        console.log("Uploaded images:", uploadedImages);

        if (uploadedImages.length > 0) {
          const { error: updateError } = await supabase
            .from("incidents")
            .update({ images: uploadedImages })
            .eq("id", incident.id);

          if (updateError) {
            console.error("Failed to update incident with images:", updateError);
            toast({
              title: "Warning",
              description: "Incident created but images may not have been saved.",
              variant: "destructive",
            });
          } else {
            console.log("Successfully updated incident with images");
          }
        }
      }

      toast({
        title: "Incident Reported",
        description: `Incident ${incidentNumber} has been logged successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["incidents"] });

      // Reset form
      setFormData({
        vehicleId: "",
        incidentDate: new Date().toISOString().split("T")[0],
        incidentTime: new Date().toTimeString().slice(0, 5),
        location: "",
        incidentType: "other",
        weatherCondition: "unknown",
        description: "",
        reportedBy: "",
        driverName: "",
        driverId: "",
        severityRating: "3",
      });
      setImages([]);

      onOpenChange(false);
    } catch (err) {
      console.error("Error creating incident:", err);
      toast({
        title: "Error",
        description: "Failed to report incident. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report New Incident</DialogTitle>
          <DialogDescription>
            Log a vehicle incident for tracking and insurance purposes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="incidentDate">Date *</Label>
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
              <Label htmlFor="incidentTime">Time *</Label>
              <Input
                id="incidentTime"
                type="time"
                value={formData.incidentTime}
                onChange={(e) =>
                  setFormData({ ...formData, incidentTime: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vehicle</Label>
            <VehicleSelect
              value={formData.vehicleId || undefined}
              onValueChange={(value) =>
                setFormData({ ...formData, vehicleId: value })
              }
              placeholder="Select vehicle (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              placeholder="Enter incident location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="incidentType">Incident Type *</Label>
              <Select
                value={formData.incidentType}
                onValueChange={(value) =>
                  setFormData({ ...formData, incidentType: value })
                }
              >
                <SelectTrigger id="incidentType">
                  <SelectValue placeholder="Select type" />
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
                <SelectTrigger id="weatherCondition">
                  <SelectValue placeholder="Select weather" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reported By *</Label>
              <InspectorSelect
                value={formData.reportedBy || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, reportedBy: value })
                }
                placeholder="Select reporter"
              />
            </div>
            <div className="space-y-2">
              <Label>Driver Name</Label>
              <DriverSelect
                value={formData.driverName || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, driverName: value })
                }
                onDriverIdChange={(driverId) =>
                  setFormData((prev) => ({ ...prev, driverId: driverId || "" }))
                }
                placeholder="Select driver"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="severityRating">Severity (1-5)</Label>
            <Select
              value={formData.severityRating}
              onValueChange={(value) =>
                setFormData({ ...formData, severityRating: value })
              }
            >
              <SelectTrigger id="severityRating">
                <SelectValue placeholder="Select severity" />
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
              placeholder="Describe the incident..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Photos (max 6)</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((file, index) => (
                <div
                  key={index}
                  className="relative w-20 h-20 border rounded-md overflow-hidden"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-0 right-0 bg-destructive text-white p-1 rounded-bl"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {images.length < 6 && (
                <label className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:border-primary">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    multiple
                  />
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Reporting..." : "Report Incident"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddIncidentDialog;