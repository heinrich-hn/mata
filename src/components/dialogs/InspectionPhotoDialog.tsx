import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, X } from "lucide-react";

interface InspectionPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  itemId: string;
  itemName: string;
  onPhotoUploaded: () => void;
}

const InspectionPhotoDialog = ({
  open,
  onOpenChange,
  inspectionId,
  itemId,
  itemName,
  onPhotoUploaded,
}: InspectionPhotoDialogProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a photo");
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${inspectionId}/${itemId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('inspection-photos')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('inspection_photos')
        .insert({
          inspection_id: inspectionId,
          inspection_item_id: itemId,
          photo_url: publicUrl,
          photo_type: 'inspection',
          caption: caption || `Photo for ${itemName}`,
          file_size: selectedFile.size,
        });

      if (dbError) throw dbError;

      toast.success("Photo uploaded successfully");
      onPhotoUploaded();
      onOpenChange(false);
      
      // Reset form
      setSelectedFile(null);
      setPreview(null);
      setCaption("");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Photo</DialogTitle>
          <DialogDescription>
            Upload a photo for {itemName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a description..."
            />
          </div>

          {!preview ? (
            <div className="border-2 border-dashed border-input rounded-lg p-8">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="flex flex-col items-center justify-center cursor-pointer space-y-3"
              >
                <Camera className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-primary">Click to select photo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or WEBP (Max 5MB)
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-64 object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedFile?.name} ({(selectedFile!.size / 1024).toFixed(1)} KB)
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionPhotoDialog;