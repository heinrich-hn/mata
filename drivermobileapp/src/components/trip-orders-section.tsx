import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import {
    ChevronDown,
    ChevronRight,
    Download,
    FileText,
    Image as ImageIcon,
    Loader2,
    Package,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface TripOrder {
    id: string;
    trip_id: string;
    order_number: string;
    description: string | null;
    created_at: string;
}

interface TripOrderDocument {
    id: string;
    trip_order_id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
    file_type: string | null;
    uploaded_at: string;
}

interface TripOrdersSectionProps {
    tripId: string;
    enabled?: boolean;
}

const BUCKET = "trip-documents";

const formatBytes = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function TripOrdersSection({ tripId, enabled = true }: TripOrdersSectionProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Cast client to bypass strict typing for tables not yet in generated types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: orders = [], isLoading } = useQuery<TripOrder[]>({
        queryKey: ["trip-orders", tripId],
        queryFn: async () => {
            const { data, error } = await db
                .from("trip_orders")
                .select("id, trip_id, order_number, description, created_at")
                .eq("trip_id", tripId)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return (data || []) as TripOrder[];
        },
        enabled: enabled && !!tripId,
    });

    const orderIds = orders.map((o) => o.id);
    const { data: documents = [] } = useQuery<TripOrderDocument[]>({
        queryKey: ["trip-order-documents", tripId, orderIds.join(",")],
        queryFn: async () => {
            if (orderIds.length === 0) return [];
            const { data, error } = await db
                .from("trip_order_documents")
                .select("id, trip_order_id, file_name, file_path, file_size, file_type, uploaded_at")
                .in("trip_order_id", orderIds)
                .order("uploaded_at", { ascending: false });
            if (error) throw error;
            return (data || []) as TripOrderDocument[];
        },
        enabled: enabled && orderIds.length > 0,
    });

    const docsByOrder = documents.reduce<Record<string, TripOrderDocument[]>>((acc, d) => {
        (acc[d.trip_order_id] ||= []).push(d);
        return acc;
    }, {});

    const toggle = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDownload = async (doc: TripOrderDocument) => {
        setDownloadingId(doc.id);
        try {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(doc.file_path, 60 * 5);
            if (error || !data?.signedUrl) throw error || new Error("No URL returned");

            // Trigger a download by anchoring with download attr; fall back to opening in new tab
            const a = document.createElement("a");
            a.href = data.signedUrl;
            a.download = doc.file_name;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            toast({
                title: "Download failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setDownloadingId(null);
        }
    };

    // Hide section entirely when nothing to show
    if (!isLoading && orders.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-[0.15em] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Orders & Documents
                </p>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ["trip-orders", tripId] });
                        queryClient.invalidateQueries({ queryKey: ["trip-order-documents", tripId] });
                    }}
                >
                    Refresh
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-2">
                    {orders.map((order) => {
                        const docs = docsByOrder[order.id] || [];
                        const isOpen = expanded.has(order.id);
                        return (
                            <div key={order.id} className="card-glass overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggle(order.id)}
                                    className="w-full flex items-center gap-2 p-3 text-left active:bg-muted/40"
                                >
                                    {isOpen ? (
                                        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">
                                            Order {order.order_number}
                                        </p>
                                        {order.description && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {order.description}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                        {docs.length} file{docs.length === 1 ? "" : "s"}
                                    </Badge>
                                </button>

                                {isOpen && (
                                    <div className="border-t px-3 py-2 space-y-1.5">
                                        {docs.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2">
                                                No documents uploaded for this order yet.
                                            </p>
                                        ) : (
                                            docs.map((doc) => {
                                                const isImage = (doc.file_type || "").startsWith("image/");
                                                const Icon = isImage ? ImageIcon : FileText;
                                                return (
                                                    <div
                                                        key={doc.id}
                                                        className="flex items-center gap-2 p-2 rounded-md bg-muted/30"
                                                    >
                                                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{doc.file_name}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {formatBytes(doc.file_size)} •{" "}
                                                                {formatDate(doc.uploaded_at)}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs gap-1 shrink-0"
                                                            disabled={downloadingId === doc.id}
                                                            onClick={() => handleDownload(doc)}
                                                        >
                                                            {downloadingId === doc.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Download className="w-3.5 h-3.5" />
                                                            )}
                                                            Download
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
