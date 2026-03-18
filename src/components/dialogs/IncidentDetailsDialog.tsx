
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { IncidentDocument, IncidentTimelineEvent } from "@/hooks/useIncidentDocuments";
import type { Incident } from "@/hooks/useIncidents";
import generateIncidentPDF from "@/utils/generateIncidentPDF";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  Cloud,
  DollarSign,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";

interface IncidentDetailsDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IncidentDetailsDialog = ({
  incident,
  open,
  onOpenChange,
}: IncidentDetailsDialogProps) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  if (!incident) return null;

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      toast({ title: "Generating PDF...", description: "Please wait while the report is being generated." });

      // Fetch documents and timeline for the incident
      const [documentsRes, timelineRes] = await Promise.all([
        supabase
          .from("incident_documents")
          .select("*")
          .eq("incident_id", incident.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("incident_timeline")
          .select("*")
          .eq("incident_id", incident.id)
          .order("created_at", { ascending: true }),
      ]);

      const documents = (documentsRes.data || []) as IncidentDocument[];
      const timeline = (timelineRes.data || []) as IncidentTimelineEvent[];

      await generateIncidentPDF({ incident, documents, timeline });
      toast({ title: "Success", description: `PDF report for ${incident.incident_number} has been downloaded.` });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
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

  const formatIncidentType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatWeatherCondition = (condition: string | null) => {
    if (!condition) return "Unknown";
    return condition
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const images = Array.isArray(incident.images) ? incident.images : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {incident.incident_number}
              </DialogTitle>
              <DialogDescription>Incident Details</DialogDescription>
            </div>
            {getStatusBadge(incident.status)}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="h-4 w-4" />
                Date & Time
              </div>
              <p className="font-medium">
                {incident.incident_date} at {incident.incident_time}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertTriangle className="h-4 w-4" />
                Type
              </div>
              <p className="font-medium">
                {formatIncidentType(incident.incident_type)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Vehicle & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Car className="h-4 w-4" />
                Vehicle
              </div>
              <p className="font-medium">
                {incident.vehicles?.registration_number ||
                  incident.vehicle_number ||
                  "Not specified"}
              </p>
              {incident.vehicles?.fleet_number && (
                <p className="text-sm text-muted-foreground">
                  Fleet: {incident.vehicles.fleet_number}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <p className="font-medium">{incident.location}</p>
            </div>
          </div>

          <Separator />

          {/* Personnel & Weather */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <User className="h-4 w-4" />
                Reported By
              </div>
              <p className="font-medium">{incident.reported_by}</p>
              {incident.driver_name && (
                <p className="text-sm text-muted-foreground">
                  Driver: {incident.driver_name}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Cloud className="h-4 w-4" />
                Weather
              </div>
              <p className="font-medium">
                {formatWeatherCondition(incident.weather_condition)}
              </p>
            </div>
          </div>

          {/* Description */}
          {incident.description && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <FileText className="h-4 w-4" />
                  Description
                </div>
                <p className="text-sm">{incident.description}</p>
              </div>
            </>
          )}

          {/* Severity Rating */}
          {incident.severity_rating && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="text-muted-foreground text-sm">
                  Severity Rating
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-8 h-2 rounded ${
                        level <= incident.severity_rating!
                          ? level <= 2
                            ? "bg-green-500"
                            : level <= 3
                            ? "bg-yellow-500"
                            : "bg-red-500"
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {incident.severity_rating === 1 && "Minor"}
                  {incident.severity_rating === 2 && "Low"}
                  {incident.severity_rating === 3 && "Medium"}
                  {incident.severity_rating === 4 && "High"}
                  {incident.severity_rating === 5 && "Critical"}
                </p>
              </div>
            </>
          )}

          {/* Insurance & Cost Info */}
          {(incident.insurance_number ||
            incident.total_cost ||
            incident.insurance_claim_amount) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" />
                  Financial Details
                </div>
                <div className="grid grid-cols-3 gap-4 bg-muted/50 p-3 rounded-lg">
                  {incident.insurance_number && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Insurance #
                      </p>
                      <p className="font-medium">{incident.insurance_number}</p>
                    </div>
                  )}
                  {incident.total_cost !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Cost
                      </p>
                      <p className="font-medium">
                        ${incident.total_cost.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {incident.insurance_claim_amount !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Claim Amount
                      </p>
                      <p className="font-medium">
                        ${incident.insurance_claim_amount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Resolution Notes */}
          {incident.resolution_notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="text-muted-foreground text-sm">
                  Resolution Notes
                </div>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {incident.resolution_notes}
                </p>
                {incident.closed_at && (
                  <p className="text-xs text-muted-foreground">
                    Closed on{" "}
                    {new Date(incident.closed_at).toLocaleDateString()}{" "}
                    {incident.closed_by && `by ${incident.closed_by}`}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Images */}
          {images.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ImageIcon className="h-4 w-4" />
                  Photos ({images.length})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((image, index) => (
                    <a
                      key={index}
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={image.url}
                        alt={image.name || `Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentDetailsDialog;