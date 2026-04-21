import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildInspectionPDF } from "@/lib/inspectionPdfExport";
import { downloadEmlWithAttachment } from "@/lib/emlExport";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ShareInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionId: string;
    inspectionNumber: string;
}

interface InspectionRecord {
    id: string;
    inspection_number: string;
    inspection_date: string;
    vehicle_registration: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    inspector_name: string;
    inspector_profile_id: string | null;
    inspection_type: string | null;
    notes: string | null;
    status: string;
}

interface InspectorProfile {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface PdfPayload {
    blob: Blob;
    fileName: string;
    url: string;
    file: File;
    base64: string;
}

const CUSTOM_RECIPIENT = "__custom__";

/**
 * Convert a phone number into the digits-only format required by wa.me
 * (E.164 without the leading +). Local numbers starting with 0 default to ZA.
 */
function normalizePhoneForWhatsApp(raw: string | null | undefined): string {
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;
    return digits;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("Read failed"));
        reader.onload = () => {
            const result = reader.result as string;
            const idx = result.indexOf(",");
            resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.readAsDataURL(blob);
    });
}

export function ShareInspectionDialog({
    open,
    onOpenChange,
    inspectionId,
    inspectionNumber,
}: ShareInspectionDialogProps) {
    const { toast } = useToast();
    const [pdf, setPdf] = useState<PdfPayload | null>(null);
    const [building, setBuilding] = useState(false);

    // Recipient selection
    const [recipientId, setRecipientId] = useState<string>(CUSTOM_RECIPIENT);
    const [emailTo, setEmailTo] = useState("");
    const [phoneTo, setPhoneTo] = useState("");
    const [customMessage, setCustomMessage] = useState("");

    // Fetch inspection
    const { data: inspection, isLoading: loadingInspection } = useQuery<InspectionRecord | null>({
        queryKey: ["inspection-share", inspectionId],
        enabled: open && !!inspectionId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vehicle_inspections")
                .select(
                    "id, inspection_number, inspection_date, vehicle_registration, vehicle_make, vehicle_model, inspector_name, inspector_profile_id, inspection_type, notes, status",
                )
                .eq("id", inspectionId)
                .single();
            if (error) throw error;
            return data as InspectionRecord;
        },
    });

    // Fetch inspection items
    const { data: items = [] } = useQuery({
        queryKey: ["inspection-share-items", inspectionId],
        enabled: open && !!inspectionId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("inspection_items")
                .select("item_name, status, notes")
                .eq("inspection_id", inspectionId);
            if (error) throw error;
            return data || [];
        },
    });

    // Fetch faults for accurate count in the PDF
    const { data: faults = [] } = useQuery({
        queryKey: ["inspection-share-faults", inspectionId],
        enabled: open && !!inspectionId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("inspection_faults")
                .select("id")
                .eq("inspection_id", inspectionId);
            if (error) throw error;
            return data || [];
        },
    });

    // Fetch full list of inspector profiles for the recipient selector
    const { data: inspectors = [], isLoading: loadingInspectors } = useQuery<InspectorProfile[]>({
        queryKey: ["inspector-profiles-share"],
        enabled: open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("inspector_profiles")
                .select("id, name, email, phone")
                .order("name");
            if (error) throw error;
            return (data || []).map(i => ({
                id: i.id,
                name: i.name,
                email: i.email,
                phone: i.phone,
            }));
        },
    });

    // Default the selected recipient to the inspection's own inspector when possible
    useEffect(() => {
        if (!open) return;
        if (!inspection?.inspector_profile_id) return;
        if (inspectors.some(i => i.id === inspection.inspector_profile_id)) {
            setRecipientId(inspection.inspector_profile_id);
        }
    }, [open, inspection?.inspector_profile_id, inspectors]);

    // When a recipient is picked from the dropdown, auto-fill email + phone
    useEffect(() => {
        if (recipientId === CUSTOM_RECIPIENT) return;
        const match = inspectors.find(i => i.id === recipientId);
        if (match) {
            setEmailTo(match.email || "");
            setPhoneTo(match.phone || "");
        }
    }, [recipientId, inspectors]);

    // Build the PDF whenever the dialog opens with fresh data
    useEffect(() => {
        if (!open || !inspection) return;
        let cancelled = false;
        let createdUrl: string | null = null;

        const run = async () => {
            setBuilding(true);
            try {
                const { doc, fileName } = buildInspectionPDF(
                    {
                        inspection_number: inspection.inspection_number,
                        inspection_date: inspection.inspection_date,
                        vehicle_registration: inspection.vehicle_registration || "",
                        vehicle_make: inspection.vehicle_make || undefined,
                        vehicle_model: inspection.vehicle_model || undefined,
                        inspector_name: inspection.inspector_name,
                        fault_count: faults.length,
                        corrective_action_status: "",
                        inspection_type: inspection.inspection_type || undefined,
                        notes: inspection.notes || undefined,
                        status: inspection.status,
                    },
                    items.map(item => ({
                        item_name: item.item_name || "-",
                        status: item.status || "not_applicable",
                        notes: item.notes || undefined,
                    })),
                );
                const blob = doc.output("blob") as Blob;
                const url = URL.createObjectURL(blob);
                createdUrl = url;
                const file = new File([blob], fileName, { type: "application/pdf" });
                const base64 = await blobToBase64(blob);
                if (!cancelled) {
                    setPdf({ blob, fileName, url, file, base64 });
                }
            } catch (err) {
                console.error("Failed to build inspection PDF", err);
                toast({
                    title: "Error",
                    description: "Could not generate inspection PDF.",
                    variant: "destructive",
                });
            } finally {
                if (!cancelled) setBuilding(false);
            }
        };

        void run();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [open, inspection, items, faults, toast]);

    // Reset state on close
    useEffect(() => {
        if (!open) {
            if (pdf) URL.revokeObjectURL(pdf.url);
            setPdf(null);
            setEmailTo("");
            setPhoneTo("");
            setRecipientId(CUSTOM_RECIPIENT);
            setCustomMessage("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const selectedInspector = useMemo(
        () => inspectors.find(i => i.id === recipientId) || null,
        [inspectors, recipientId],
    );

    const handleDownload = () => {
        if (!pdf) return;
        const a = document.createElement("a");
        a.href = pdf.url;
        a.download = pdf.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: "PDF downloaded", description: pdf.fileName });
    };

    const handleSendEmail = () => {
        if (!pdf || !inspection) return;
        const to = emailTo.trim();
        if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
            toast({
                title: "Invalid email",
                description: "Please enter a valid email address.",
                variant: "destructive",
            });
            return;
        }

        const vehicle = inspection.vehicle_registration
            ? `${inspection.vehicle_registration}${inspection.vehicle_make ? ` (${inspection.vehicle_make}${inspection.vehicle_model ? ` ${inspection.vehicle_model}` : ""})` : ""}`
            : "—";
        const date = new Date(inspection.inspection_date).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });

        const subject = `Inspection Report ${inspection.inspection_number} — ${inspection.vehicle_registration || "Vehicle"}`;
        const greeting = selectedInspector?.name ? `Hi ${selectedInspector.name.split(" ")[0]},` : "Hi,";
        const bodyLines = [
            greeting,
            "",
            `Please find attached the inspection report for ${inspection.inspection_number}.`,
            "",
            `Vehicle:    ${vehicle}`,
            `Inspector:  ${inspection.inspector_name}`,
            `Date:       ${date}`,
            `Faults:     ${faults.length}`,
            `Status:     ${inspection.status}`,
        ];
        if (customMessage.trim()) {
            bodyLines.push("", customMessage.trim());
        }
        bodyLines.push("", "— MATA Fleet");

        downloadEmlWithAttachment({
            to,
            subject,
            body: bodyLines.join("\n"),
            pdfBase64: pdf.base64,
            pdfFileName: pdf.fileName,
            fileName: `Inspection-${inspection.inspection_number}`,
        });

        toast({
            title: "Email draft downloaded",
            description: `Open the .eml file to launch Outlook with the PDF already attached (To: ${to}).`,
        });
    };

    const handleWhatsApp = () => {
        if (!pdf || !inspection) return;
        handleDownload();

        const vehicle = inspection.vehicle_registration
            ? `${inspection.vehicle_registration}${inspection.vehicle_make ? ` (${inspection.vehicle_make}${inspection.vehicle_model ? ` ${inspection.vehicle_model}` : ""})` : ""}`
            : "—";
        const date = new Date(inspection.inspection_date).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });

        const lines = [
            `*MATA Fleet — Inspection Report*`,
            ``,
            `Report:    ${inspection.inspection_number}`,
            `Vehicle:   ${vehicle}`,
            `Inspector: ${inspection.inspector_name}`,
            `Date:      ${date}`,
            `Faults:    ${faults.length}`,
        ];
        if (customMessage.trim()) {
            lines.push("", customMessage.trim());
        }
        lines.push("", "The PDF report has been downloaded — please attach it before sending.");
        const message = lines.join("\n");

        const phone = normalizePhoneForWhatsApp(phoneTo);
        const href = phone
            ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(href, "_blank", "noopener,noreferrer");
    };

    const handleNativeShare = async () => {
        if (!pdf || !inspection) return;
        const navAny = navigator as Navigator & {
            canShare?: (data: { files?: File[] }) => boolean;
            share?: (data: ShareData & { files?: File[] }) => Promise<void>;
        };
        if (!navAny.canShare?.({ files: [pdf.file] }) || !navAny.share) {
            toast({
                title: "Native sharing not supported",
                description: "Use the Email or WhatsApp options instead.",
            });
            return;
        }
        try {
            await navAny.share({
                title: `Inspection ${inspection.inspection_number}`,
                text: `Inspection report ${inspection.inspection_number} for ${inspection.vehicle_registration || ""}`.trim(),
                files: [pdf.file],
            });
        } catch (err) {
            if ((err as DOMException)?.name !== "AbortError") {
                toast({
                    title: "Share failed",
                    description: err instanceof Error ? err.message : "Could not open share sheet.",
                    variant: "destructive",
                });
            }
        }
    };

    const isLoading = loadingInspection || building;
    const supportsNativeShare =
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        pdf !== null &&
        (navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean }).canShare?.({
            files: [pdf.file],
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5" />
                        Send Inspection {inspectionNumber}
                    </DialogTitle>
                    <DialogDescription>
                        Download an Outlook draft (.eml) with the PDF already attached, or share via WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Preparing PDF...
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Recipient selector */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Recipient</Label>
                            <Select value={recipientId} onValueChange={setRecipientId} disabled={loadingInspectors}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingInspectors ? "Loading inspectors…" : "Select an inspector"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CUSTOM_RECIPIENT}>Custom recipient…</SelectItem>
                                    {inspectors.map(i => (
                                        <SelectItem key={i.id} value={i.id}>
                                            <div className="flex flex-col">
                                                <span>{i.name}</span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {i.email || "no email"} · {i.phone || "no phone"}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedInspector && (
                                <p className="text-[11px] text-muted-foreground">
                                    Email and phone pre-filled from {selectedInspector.name}'s profile.
                                </p>
                            )}
                        </div>

                        {/* Optional message */}
                        <div className="space-y-2">
                            <Label htmlFor="share-message" className="text-xs font-medium">
                                Optional message
                            </Label>
                            <Textarea
                                id="share-message"
                                placeholder="Add a short note to include in the email and WhatsApp message…"
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                rows={2}
                                className="resize-none"
                            />
                        </div>

                        <Separator />

                        {/* Email row */}
                        <div className="space-y-2">
                            <Label htmlFor="share-email" className="text-xs font-medium">
                                Email recipient
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="share-email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={handleSendEmail}
                                    disabled={!pdf || !emailTo.trim()}
                                    className="gap-1.5 min-w-[120px]"
                                >
                                    <Mail className="h-4 w-4" />
                                    Open in Outlook
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Downloads an Outlook-ready draft (.eml) with the PDF already attached.
                                Open the file to launch Outlook — just review and send.
                            </p>
                        </div>

                        <Separator />

                        {/* WhatsApp row */}
                        <div className="space-y-2">
                            <Label htmlFor="share-phone" className="text-xs font-medium">
                                WhatsApp number
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="share-phone"
                                    type="tel"
                                    placeholder="+27 82 123 4567"
                                    value={phoneTo}
                                    onChange={(e) => setPhoneTo(e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={handleWhatsApp}
                                    disabled={!pdf}
                                    className="gap-1.5 min-w-[120px] bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    WhatsApp
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Opens WhatsApp with a formatted message. WhatsApp does not allow
                                attaching files via web links — the PDF is downloaded so you can
                                attach it manually.
                            </p>
                        </div>

                        <Separator />

                        {/* Download + native share */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={handleDownload}
                                disabled={!pdf}
                                className="gap-1.5"
                            >
                                <Download className="h-4 w-4" />
                                Download PDF
                            </Button>
                            {supportsNativeShare && (
                                <Button
                                    variant="outline"
                                    onClick={handleNativeShare}
                                    disabled={!pdf}
                                    className="gap-1.5"
                                >
                                    <Send className="h-4 w-4" />
                                    Device share sheet
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default ShareInspectionDialog;
