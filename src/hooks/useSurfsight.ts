import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";

interface SurfsightFile {
    cameraId: number;
    fileId: string;
    fileType: "video" | "snapshot";
    mediaAvailable: boolean;
    blurredMediaAvailable: boolean;
}

interface SurfsightEvent {
    id: number;
    eventType: string;
    lat: number;
    lon: number;
    speed: number;
    status: string;
    severity: number;
    time: string;
    files: SurfsightFile[];
    metadata: unknown;
    driver: boolean;
}

interface MediaLinkResponse {
    data: { url: string };
    requestId: string;
}

async function callSurfsightProxy<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke("surfsight-proxy", {
        body,
    });
    if (error) throw new Error(error.message || "Surfsight proxy error");
    if (data?.error) throw new Error(data.error);
    return data as T;
}

/**
 * Parse a Surfsight web URL to extract event parameters.
 * Example: https://app.de.surfsight.net/#/home/events/list/71897?type=show_event_video&orgId=14478&msg_type=distracted_driving&time=1775635249&file_id=1775635249&file_id_rear=1775635249&lat=-19.7877052&lon=29.18731971
 */
export function parseSurfsightUrl(url: string): {
    fileId: string;
    fileIdRear: string | null;
    orgId: string | null;
    msgType: string | null;
    type: string | null;
} | null {
    try {
        // The hash portion contains query params after #/...?
        const hashIdx = url.indexOf("#");
        if (hashIdx === -1) return null;
        const hashPart = url.substring(hashIdx + 1);
        const qIdx = hashPart.indexOf("?");
        if (qIdx === -1) return null;
        const params = new URLSearchParams(hashPart.substring(qIdx + 1));
        const fileId = params.get("file_id");
        if (!fileId) return null;
        return {
            fileId,
            fileIdRear: params.get("file_id_rear"),
            orgId: params.get("orgId"),
            msgType: params.get("msg_type"),
            type: params.get("type"),
        };
    } catch {
        return null;
    }
}

/**
 * Check if a URL is a Surfsight event link
 */
export function isSurfsightUrl(url: string): boolean {
    return /surfsight\.net/i.test(url);
}

/**
 * Fetch a direct download URL for event media (snapshot or video).
 */
export function useEventMediaLink() {
    return useMutation({
        mutationFn: async ({
            imei,
            fileId,
            cameraId,
            fileType,
        }: {
            imei: string;
            fileId: string;
            cameraId: number;
            fileType: "video" | "snapshot";
        }) => {
            const result = await callSurfsightProxy<MediaLinkResponse>({
                action: "event-media-link",
                imei,
                fileId,
                cameraId: String(cameraId),
                fileType,
            });
            return result.data.url;
        },
    });
}

/**
 * Fetch events for a device in a time range from the Surfsight API.
 */
export function useSurfsightEvents(imei: string | null, start: string, end: string) {
    return useQuery({
        queryKey: ["surfsight-events", imei, start, end],
        enabled: !!imei && !!start && !!end,
        queryFn: async () => {
            const result = await callSurfsightProxy<{ data: SurfsightEvent[] }>({
                action: "events",
                imei,
                start,
                end,
            });
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch all Surfsight devices.
 */
export function useSurfsightDevices() {
    return useQuery({
        queryKey: ["surfsight-devices"],
        queryFn: async () => {
            const result = await callSurfsightProxy<{
                data: Array<{
                    imei: string;
                    name: string;
                    status: string;
                    cameras: Array<{ cameraId: number; name: string }>;
                }>;
            }>({ action: "devices" });
            return result.data;
        },
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Given a Surfsight web link stored in `location`, resolve the IMEI
 * by matching the fleet_number against devices.
 * Returns { imei, fileId, fileType } needed for media download.
 */
export function resolveEventMedia(
    location: string,
    fleetNumber: string | null,
    devices: Array<{ imei: string; name: string }> | undefined
): { imei: string; fileId: string } | null {
    if (!location || !devices) return null;

    const parsed = parseSurfsightUrl(location);
    if (!parsed) return null;

    // Match fleet number to device name (e.g. "31H" matches fleet "31H")
    const cleanFleet = (fleetNumber || "").replace(/^#/, "").trim();
    const device = devices.find(
        (d) =>
            d.name === cleanFleet ||
            d.name === fleetNumber ||
            (cleanFleet && d.name.includes(cleanFleet))
    );

    if (!device) return null;

    return { imei: device.imei, fileId: parsed.fileId };
}
