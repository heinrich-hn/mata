import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useEventMediaLink } from "@/hooks/useSurfsight";
import { Camera, Download, Image, Loader2, Video } from "lucide-react";
import { useState } from "react";

interface SurfsightMediaViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imei: string;
    fileId: string;
    driverName: string;
    eventType: string;
}

export default function SurfsightMediaViewer({
    open,
    onOpenChange,
    imei,
    fileId,
    driverName,
    eventType,
}: SurfsightMediaViewerProps) {
    const [selectedCamera, setSelectedCamera] = useState<1 | 2>(1);
    const [mediaType, setMediaType] = useState<"snapshot" | "video">("snapshot");
    const mediaLink = useEventMediaLink();

    const handleFetch = (camera: 1 | 2, type: "snapshot" | "video") => {
        setSelectedCamera(camera);
        setMediaType(type);
        mediaLink.mutate({ imei, fileId, cameraId: camera, fileType: type });
    };

    const handleDownload = () => {
        if (mediaLink.data) {
            const a = document.createElement("a");
            a.href = mediaLink.data;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.download = `${driverName}_${eventType}_cam${selectedCamera}_${fileId}.${mediaType === "video" ? "mp4" : "jpg"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        Event Media — {driverName}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{eventType}</p>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Camera & Type Selection */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={selectedCamera === 1 && mediaType === "snapshot" && mediaLink.data ? "default" : "outline"}
                            onClick={() => handleFetch(1, "snapshot")}
                            disabled={mediaLink.isPending}
                        >
                            <Image className="w-4 h-4 mr-1" />
                            Front Snapshot
                        </Button>
                        <Button
                            size="sm"
                            variant={selectedCamera === 2 && mediaType === "snapshot" && mediaLink.data ? "default" : "outline"}
                            onClick={() => handleFetch(2, "snapshot")}
                            disabled={mediaLink.isPending}
                        >
                            <Image className="w-4 h-4 mr-1" />
                            Cabin Snapshot
                        </Button>
                        <Button
                            size="sm"
                            variant={selectedCamera === 1 && mediaType === "video" && mediaLink.data ? "default" : "outline"}
                            onClick={() => handleFetch(1, "video")}
                            disabled={mediaLink.isPending}
                        >
                            <Video className="w-4 h-4 mr-1" />
                            Front Video
                        </Button>
                        <Button
                            size="sm"
                            variant={selectedCamera === 2 && mediaType === "video" && mediaLink.data ? "default" : "outline"}
                            onClick={() => handleFetch(2, "video")}
                            disabled={mediaLink.isPending}
                        >
                            <Video className="w-4 h-4 mr-1" />
                            Cabin Video
                        </Button>
                    </div>

                    {/* Loading */}
                    {mediaLink.isPending && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-3 text-muted-foreground">
                                Fetching {mediaType} from camera {selectedCamera}...
                            </span>
                        </div>
                    )}

                    {/* Error */}
                    {mediaLink.isError && (
                        <div className="text-center py-8 text-destructive">
                            <p className="font-medium">Failed to load media</p>
                            <p className="text-sm mt-1">
                                {mediaLink.error?.message || "The media may not be available for this event."}
                            </p>
                        </div>
                    )}

                    {/* Media Display */}
                    {mediaLink.data && !mediaLink.isPending && (
                        <div className="space-y-3">
                            {mediaType === "snapshot" ? (
                                <div className="rounded-lg overflow-hidden border bg-black">
                                    <img
                                        src={mediaLink.data}
                                        alt={`${driverName} - ${eventType} - Camera ${selectedCamera}`}
                                        className="w-full h-auto max-h-[60vh] object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="rounded-lg overflow-hidden border bg-black">
                                    <video
                                        src={mediaLink.data}
                                        controls
                                        autoPlay
                                        className="w-full max-h-[60vh]"
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">
                                    Camera {selectedCamera === 1 ? "Front (Road)" : "Rear (Cabin)"} •{" "}
                                    {mediaType === "snapshot" ? "Snapshot" : "Video Clip"}
                                </span>
                                <Button size="sm" variant="outline" onClick={handleDownload}>
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Initial state - no media loaded yet */}
                    {!mediaLink.data && !mediaLink.isPending && !mediaLink.isError && (
                        <div className="text-center py-12 text-muted-foreground">
                            <Camera className="mx-auto h-12 w-12 mb-3" />
                            <p>Select a camera and media type above to load the event media.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
