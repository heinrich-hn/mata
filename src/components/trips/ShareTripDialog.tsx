import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
    buildTripPdfPayload,
    buildTripWhatsAppMessage,
    fetchTripExportData,
    normalizePhoneForWhatsApp,
    type TripPdfPayload,
} from "@/lib/tripPdfExport";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, Loader2, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ShareTripDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tripId: string | null;
    tripNumber: string;
}

interface InspectorContact {
    id: string;
    name: string;
    phone: string | null;
}

const CUSTOM_RECIPIENT = "__custom__";

export function ShareTripDialog({
    open,
    onOpenChange,
    tripId,
    tripNumber,
}: ShareTripDialogProps) {
    const { toast } = useToast();

    const [pdf, setPdf] = useState<TripPdfPayload | null>(null);
    const [building, setBuilding] = useState(false);
    const [buildError, setBuildError] = useState<string | null>(null);

    const [recipientId, setRecipientId] = useState<string>(CUSTOM_RECIPIENT);
    const [phoneTo, setPhoneTo] = useState("");
    const [whatsappStatus, setWhatsappStatus] = useState<"idle" | "success" | "error">("idle");

    // Reuse the inspector_profiles list as the contact directory
    const { data: contacts = [], isLoading: loadingContacts } = useQuery<InspectorContact[]>({
        queryKey: ["inspector-profiles-share"],
        enabled: open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("inspector_profiles")
                .select("id, name, phone")
                .order("name");
            if (error) throw error;
            return (data || []).map(i => ({ id: i.id, name: i.name, phone: i.phone }));
        },
    });

    // Auto-fill phone whenever a contact is picked
    useEffect(() => {
        if (recipientId === CUSTOM_RECIPIENT) return;
        const match = contacts.find(c => c.id === recipientId);
        if (match) {
            setPhoneTo(match.phone || "");
        }
    }, [recipientId, contacts]);

    // Build PDF whenever dialog opens with a tripId
    useEffect(() => {
        if (!open || !tripId) return;
        let cancelled = false;
        let createdUrl: string | null = null;

        const build = async () => {
            setBuilding(true);
            setBuildError(null);
            setPdf(null);

            try {
                const data = await fetchTripExportData(tripId);
                if (!data) throw new Error("Trip not found");
                if (cancelled) return;

                const payload = await buildTripPdfPayload(data);
                if (cancelled) {
                    URL.revokeObjectURL(payload.url);
                    return;
                }
                createdUrl = payload.url;
                setPdf(payload);
            } catch (err) {
                if (!cancelled) {
                    setBuildError(err instanceof Error ? err.message : "Failed to build PDF");
                }
            } finally {
                if (!cancelled) setBuilding(false);
            }
        };

        build();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [open, tripId]);

    // Reset state on close
    const handleOpenChange = (v: boolean) => {
        if (!v) {
            setRecipientId(CUSTOM_RECIPIENT);
            setPhoneTo("");
            setWhatsappStatus("idle");
            setPdf(null);
            setBuildError(null);
        }
        onOpenChange(v);
    };

    const handleDownload = () => {
        if (!pdf) return;
        const a = document.createElement("a");
        a.href = pdf.url;
        a.download = pdf.fileName;
        a.click();
    };

    const handleWhatsApp = async () => {
        if (!pdf || !tripId) return;

        // Download PDF first
        handleDownload();

        // Fetch data again only for the message text (already cached by the PDF build above)
        // We'll build the message from the PDF payload's trip data
        try {
            const data = await fetchTripExportData(tripId);
            if (!data) throw new Error("Could not load trip data");

            const message = buildTripWhatsAppMessage(data);
            const phone = normalizePhoneForWhatsApp(phoneTo);
            const href = phone
                ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;

            window.open(href, "_blank", "noopener,noreferrer");
            setWhatsappStatus("success");
        } catch {
            setWhatsappStatus("error");
            toast({
                title: "WhatsApp share failed",
                description: "Could not prepare the message. Please try again.",
                variant: "destructive",
            });
        }
    };

    const isLoading = building || (!pdf && !buildError);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5" />
                        Share Trip Report
                    </DialogTitle>
                    <DialogDescription>
                        Download or share the full trip PDF for POD #{tripNumber}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* PDF preview status */}
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                        {isLoading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">Building PDF…</p>
                                    <p className="text-xs text-muted-foreground">Fetching trip details and expenses</p>
                                </div>
                            </>
                        ) : buildError ? (
                            <>
                                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-destructive">PDF build failed</p>
                                    <p className="text-xs text-muted-foreground">{buildError}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">PDF ready</p>
                                    <p className="text-xs text-muted-foreground truncate">{pdf?.fileName}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 shrink-0">
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </Button>
                            </>
                        )}
                    </div>

                    <Separator />

                    {/* WhatsApp share section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            <p className="text-sm font-semibold">Share via WhatsApp</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            The PDF will be downloaded to your device. WhatsApp will open with a pre-filled summary — attach the PDF before sending.
                        </p>

                        <div className="space-y-2">
                            <Label htmlFor="recipient-select" className="text-xs">Recipient</Label>
                            <Select
                                value={recipientId}
                                onValueChange={(v) => {
                                    setRecipientId(v);
                                    if (v === CUSTOM_RECIPIENT) setPhoneTo("");
                                }}
                                disabled={loadingContacts}
                            >
                                <SelectTrigger id="recipient-select">
                                    <SelectValue placeholder="Select a contact" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CUSTOM_RECIPIENT}>Enter manually</SelectItem>
                                    {contacts.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            <span className="flex flex-col">
                                                <span>{c.name}</span>
                                                {c.phone && (
                                                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone-input" className="text-xs">Phone Number</Label>
                            <div className="flex gap-2">
                                <input
                                    id="phone-input"
                                    type="tel"
                                    value={phoneTo}
                                    onChange={(e) => setPhoneTo(e.target.value)}
                                    placeholder="+27 82 123 4567 (optional)"
                                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                <Button
                                    onClick={handleWhatsApp}
                                    disabled={isLoading || !!buildError}
                                    className="gap-2 bg-green-600 hover:bg-green-700 text-white shrink-0"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    Send
                                </Button>
                            </div>
                        </div>

                        {whatsappStatus === "success" && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                WhatsApp opened. The PDF has been downloaded — attach it to the message.
                            </p>
                        )}
                        {whatsappStatus === "error" && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Sharing failed. Please try again.
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ShareTripDialog;
