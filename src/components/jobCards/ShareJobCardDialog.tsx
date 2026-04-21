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
import { buildJobCardPDF, type JobCardExportData } from "@/lib/jobCardExport";
import { downloadEmlWithAttachment } from "@/lib/emlExport";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ShareJobCardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exportData: JobCardExportData | null;
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

export function ShareJobCardDialog({
    open,
    onOpenChange,
    exportData,
}: ShareJobCardDialogProps) {
    const { toast } = useToast();
    const [pdf, setPdf] = useState<PdfPayload | null>(null);
    const [building, setBuilding] = useState(false);

    const [recipientId, setRecipientId] = useState<string>(CUSTOM_RECIPIENT);
    const [emailTo, setEmailTo] = useState("");
    const [phoneTo, setPhoneTo] = useState("");
    const [customMessage, setCustomMessage] = useState("");

    // Reuse the inspector_profiles list as the contact directory.
    const { data: contacts = [], isLoading: loadingContacts } = useQuery<InspectorProfile[]>({
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

    // Auto-fill email + phone whenever a contact is picked
    useEffect(() => {
        if (recipientId === CUSTOM_RECIPIENT) return;
        const match = contacts.find(c => c.id === recipientId);
        if (match) {
            setEmailTo(match.email || "");
            setPhoneTo(match.phone || "");
        }
    }, [recipientId, contacts]);

    // Build the PDF once the dialog opens with data
    useEffect(() => {
        if (!open || !exportData) return;
        let cancelled = false;
        let createdUrl: string | null = null;

        const run = async () => {
            setBuilding(true);
            try {
                const { doc, fileName } = buildJobCardPDF(exportData);
                const blob = doc.output("blob") as Blob;
                const url = URL.createObjectURL(blob);
                createdUrl = url;
                const file = new File([blob], fileName, { type: "application/pdf" });
                const base64 = await blobToBase64(blob);
                if (!cancelled) {
                    setPdf({ blob, fileName, url, file, base64 });
                }
            } catch (err) {
                console.error("Failed to build job card PDF", err);
                toast({
                    title: "Error",
                    description: "Could not generate job card PDF.",
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
    }, [open, exportData, toast]);

    // Reset on close
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

    const selectedContact = useMemo(
        () => contacts.find(c => c.id === recipientId) || null,
        [contacts, recipientId],
    );

    const totals = useMemo(() => {
        if (!exportData) return { totalCost: 0, partsCount: 0, laborHours: 0 };
        const partsCost = exportData.parts.reduce((sum, p) => sum + (p.total_price || 0), 0);
        const laborCost = exportData.laborEntries.reduce((sum, l) => sum + (l.total_cost || 0), 0);
        const laborHours = exportData.laborEntries.reduce((sum, l) => sum + (l.hours_worked || 0), 0);
        return {
            totalCost: partsCost + laborCost,
            partsCount: exportData.parts.length,
            laborHours,
        };
    }, [exportData]);

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
        if (!pdf || !exportData) return;
        const to = emailTo.trim();
        if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
            toast({
                title: "Invalid email",
                description: "Please enter a valid email address.",
                variant: "destructive",
            });
            return;
        }

        const vehicle = exportData.vehicle?.registration_number
            ? `${exportData.vehicle.registration_number}${exportData.vehicle.make ? ` (${exportData.vehicle.make}${exportData.vehicle.model ? ` ${exportData.vehicle.model}` : ""})` : ""}`
            : "—";

        const subject = `Job Card ${exportData.jobCard.job_number} — ${exportData.vehicle?.registration_number || "Vehicle"}`;
        const greeting = selectedContact?.name ? `Hi ${selectedContact.name.split(" ")[0]},` : "Hi,";
        const bodyLines = [
            greeting,
            "",
            `Please find attached job card ${exportData.jobCard.job_number}.`,
            "",
            `Job:       ${exportData.jobCard.job_number}`,
            `Title:     ${exportData.jobCard.title || "—"}`,
            `Vehicle:   ${vehicle}`,
            `Assignee:  ${exportData.jobCard.assignee || "Unassigned"}`,
            `Status:    ${(exportData.jobCard.status || "pending").toUpperCase()}`,
            `Priority:  ${(exportData.jobCard.priority || "medium").toUpperCase()}`,
            `Total:     R ${totals.totalCost.toFixed(2)}`,
            `Parts:     ${totals.partsCount}`,
            `Labour:    ${totals.laborHours.toFixed(2)} hrs`,
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
            fileName: `JobCard-${exportData.jobCard.job_number}`,
        });

        toast({
            title: "Email draft downloaded",
            description: `Open the .eml file to launch Outlook with the PDF already attached (To: ${to}).`,
        });
    };

    const handleWhatsApp = () => {
        if (!pdf || !exportData) return;
        handleDownload();

        const vehicle = exportData.vehicle?.registration_number
            ? `${exportData.vehicle.registration_number}${exportData.vehicle.make ? ` (${exportData.vehicle.make}${exportData.vehicle.model ? ` ${exportData.vehicle.model}` : ""})` : ""}`
            : "—";

        const totalCostFmt = totals.totalCost > 0
            ? `R ${totals.totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—";

        const lines = [
            `*MATA Fleet — Job Card*`,
            ``,
            `Job:       ${exportData.jobCard.job_number}`,
            `Title:     ${exportData.jobCard.title || "—"}`,
            `Vehicle:   ${vehicle}`,
            `Assignee:  ${exportData.jobCard.assignee || "Unassigned"}`,
            `Status:    ${(exportData.jobCard.status || "pending").toUpperCase()}`,
            `Priority:  ${(exportData.jobCard.priority || "medium").toUpperCase()}`,
            `Total:     ${totalCostFmt}`,
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
        if (!pdf || !exportData) return;
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
                title: `Job Card ${exportData.jobCard.job_number}`,
                text: `Job card ${exportData.jobCard.job_number} for ${exportData.vehicle?.registration_number || ""}`.trim(),
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

    const isLoading = building || !exportData;
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
                        Send Job Card {exportData?.jobCard.job_number || ""}
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
                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Recipient</Label>
                            <Select value={recipientId} onValueChange={setRecipientId} disabled={loadingContacts}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingContacts ? "Loading contacts…" : "Select a contact"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CUSTOM_RECIPIENT}>Custom recipient…</SelectItem>
                                    {contacts.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            <div className="flex flex-col">
                                                <span>{c.name}</span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {c.email || "no email"} · {c.phone || "no phone"}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedContact && (
                                <p className="text-[11px] text-muted-foreground">
                                    Email and phone pre-filled from {selectedContact.name}'s profile.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="jc-share-message" className="text-xs font-medium">
                                Optional message
                            </Label>
                            <Textarea
                                id="jc-share-message"
                                placeholder="Add a short note to include in the email and WhatsApp message…"
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                rows={2}
                                className="resize-none"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label htmlFor="jc-share-email" className="text-xs font-medium">
                                Email recipient
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="jc-share-email"
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

                        <div className="space-y-2">
                            <Label htmlFor="jc-share-phone" className="text-xs font-medium">
                                WhatsApp number
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="jc-share-phone"
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

export default ShareJobCardDialog;
