import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Mic, StopCircle, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface MobileQuickCompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  onSuccess: () => void;
}

export function MobileQuickComplete({
  open,
  onOpenChange,
  scheduleId,
  onSuccess,
}: MobileQuickCompleteProps) {
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [notes, setNotes] = useState("");
  const [odometerReading, setOdometerReading] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error("Failed to access microphone");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Upload photos if any
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const fileName = `maintenance/${scheduleId}/${Date.now()}_${photo.name}`;
        const { data, error } = await supabase.storage
          .from('maintenance-photos')
          .upload(fileName, photo);

        if (error) throw error;
        photoUrls.push(data.path);
      }

      // Upload audio if any
      let audioUrl: string | null = null;
      if (audioBlob) {
        const fileName = `maintenance/${scheduleId}/${Date.now()}_voice-note.webm`;
        const { data, error } = await supabase.storage
          .from('maintenance-photos')
          .upload(fileName, audioBlob);

        if (error) throw error;
        audioUrl = data.path;
      }

      // Create history record with photos and audio in notes as JSON
      const notesData = {
        text: notes,
        photos: photoUrls,
        audio: audioUrl,
      };

      const { error: historyError } = await supabase
        .from("maintenance_schedule_history")
        .insert({
          schedule_id: scheduleId,
          scheduled_date: new Date().toISOString(),
          completed_date: new Date().toISOString(),
          status: "completed",
          odometer_reading: odometerReading ? parseInt(odometerReading) : null,
          notes: JSON.stringify(notesData),
        });

      if (historyError) throw historyError;

      toast.success("Maintenance completed successfully");
      onOpenChange(false);
      onSuccess();

      // Reset form
      setPhotos([]);
      setAudioBlob(null);
      setNotes("");
      setOdometerReading("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast.error(`Failed to complete maintenance: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Complete</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="odometer">Odometer Reading</Label>
            <Input
              id="odometer"
              type="number"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              placeholder="Current odometer reading"
            />
          </div>

          <div>
            <Label>Photos</Label>
            <div className="flex gap-2 flex-wrap mb-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Photo ${index + 1}`}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {isMobile && (
                <>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={handleCameraCapture}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleCameraCapture}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>

          <div>
            <Label>Voice Note</Label>
            <div className="flex gap-2 items-center">
              {!isRecording ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startRecording}
                  disabled={!!audioBlob}
                  className="flex-1"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {audioBlob ? "Voice Note Recorded" : "Record Voice Note"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={stopRecording}
                  className="flex-1"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Recording
                </Button>
              )}
              {audioBlob && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setAudioBlob(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={4}
            />
          </div>

          <Button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Completing..." : "Complete Maintenance"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
