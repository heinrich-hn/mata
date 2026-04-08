/**
 * SurfsightEventMedia — inline component that loads and displays
 * front + cabin camera snapshots and video for a driver behavior event.
 * Renders inside coaching modals, details dialogs, etc.
 */
import { Button } from "@/components/ui/button";
import { useEventMediaLink, useSurfsightDevices, resolveEventMedia } from "@/hooks/useSurfsight";
import { Camera, Download, Image, Loader2, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface SurfsightEventMediaProps {
    location: string | null;
    fleetNumber: string | null;
    driverName: string;
    eventType: string;
    /** Compact mode hides labels, used in smaller contexts */
    compact?: boolean;
}

interface MediaUrls {
    frontSnapshot: string | null;
    cabinSnapshot: string | null;
    frontVideo: string | null;
    cabinVideo: string | null;
}

export default function SurfsightEventMedia({
    location,
    fleetNumber,
    driverName,
    eventType,
    compact = false,
}: SurfsightEventMediaProps) {
    const { data: devices } = useSurfsightDevices();
    const mediaLink = useEventMediaLink();
    const [urls, setUrls] = useState<MediaUrls>({
        frontSnapshot: null, cabinSnapshot: null,
        frontVideo: null, cabinVideo: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeVideo, setActiveVideo] = useState<"front" | "cabin" | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoLoading, setVideoLoading] = useState(false);

    const resolved = location && devices
        ? resolveEventMedia(location, fleetNumber, devices)
        : null;

    // Auto-load both camera snapshots on mount
    const loadSnapshots = useCallback(async () => {
        if (!resolved) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [front, cabin] = await Promise.all([
                mediaLink.mutateAsync({ imei: resolved.imei, fileId: resolved.fileId, cameraId: 1, fileType: "snapshot" }).catch(() => null),
                mediaLink.mutateAsync({ imei: resolved.imei, fileId: resolved.fileId, cameraId: 2, fileType: "snapshot" }).catch(() => null),
            ]);

            setUrls(prev => ({
                ...prev,
                frontSnapshot: front,
                cabinSnapshot: cabin,
            }));
        } catch {
            setError("Failed to load dashcam snapshots");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolved?.imei, resolved?.fileId]);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

    // Load video on demand
    const loadVideo = async (camera: "front" | "cabin") => {
        if (!resolved) return;
        setVideoLoading(true);
        setActiveVideo(camera);
        setVideoUrl(null);

        try {
            const url = await mediaLink.mutateAsync({
                imei: resolved.imei,
                fileId: resolved.fileId,
                cameraId: camera === "front" ? 1 : 2,
                fileType: "video",
            });
            setVideoUrl(url);
        } catch {
            setError(`Failed to load ${camera} video`);
            setActiveVideo(null);
        } finally {
            setVideoLoading(false);
        }
    };

    const handleDownload = (url: string, type: string) => {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.download = `${driverName}_${eventType}_${type}.${type.includes("video") ? "mp4" : "jpg"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // No Surfsight media available
    if (!location || !resolved) {
        if (!location || !/surfsight\.net/i.test(location)) return null;
        return (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
                <VideoOff className="w-4 h-4" />
                Could not match fleet to a dashcam device
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Camera className={`w-5 h-5 text-purple-600 ${compact ? "w-4 h-4" : ""}`} />
                <h4 className={`font-semibold text-gray-800 ${compact ? "text-sm" : "text-base"}`}>
                    Dashcam Evidence
                </h4>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                    <span>Loading dashcam snapshots...</span>
                </div>
            )}

            {error && !loading && (
                <div className="text-sm text-destructive py-2">{error}</div>
            )}

            {/* Snapshots Grid */}
            {!loading && (urls.frontSnapshot || urls.cabinSnapshot) && (
                <div className={`grid gap-3 ${urls.frontSnapshot && urls.cabinSnapshot ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                    {urls.frontSnapshot && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                    <Image className="w-3 h-3" /> Front Camera (Road)
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleDownload(urls.frontSnapshot!, "front_snapshot")}
                                >
                                    <Download className="w-3 h-3 mr-1" /> Save
                                </Button>
                            </div>
                            <div className="rounded-lg overflow-hidden border bg-black">
                                <img
                                    src={urls.frontSnapshot}
                                    alt={`${driverName} — Front camera`}
                                    className="w-full h-auto object-contain max-h-[250px]"
                                />
                            </div>
                        </div>
                    )}

                    {urls.cabinSnapshot && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                    <Image className="w-3 h-3" /> Cabin Camera (In-Cab)
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleDownload(urls.cabinSnapshot!, "cabin_snapshot")}
                                >
                                    <Download className="w-3 h-3 mr-1" /> Save
                                </Button>
                            </div>
                            <div className="rounded-lg overflow-hidden border bg-black">
                                <img
                                    src={urls.cabinSnapshot}
                                    alt={`${driverName} — Cabin camera`}
                                    className="w-full h-auto object-contain max-h-[250px]"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Video Buttons */}
            {!loading && resolved && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={activeVideo === "front" ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadVideo("front")}
                        disabled={videoLoading}
                        className="text-sm"
                    >
                        {videoLoading && activeVideo === "front" ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                            <Video className="w-4 h-4 mr-1" />
                        )}
                        Front Video
                    </Button>
                    <Button
                        variant={activeVideo === "cabin" ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadVideo("cabin")}
                        disabled={videoLoading}
                        className="text-sm"
                    >
                        {videoLoading && activeVideo === "cabin" ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                            <Video className="w-4 h-4 mr-1" />
                        )}
                        Cabin Video
                    </Button>
                </div>
            )}

            {/* Video Player */}
            {videoUrl && activeVideo && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                            {activeVideo === "front" ? "Front Camera" : "Cabin Camera"} — Video Clip
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleDownload(videoUrl, `${activeVideo}_video`)}
                        >
                            <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                    </div>
                    <div className="rounded-lg overflow-hidden border bg-black">
                        <video
                            src={videoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[300px]"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>
            )}
        </div>
    );
}
