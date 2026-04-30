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
import { useClients } from "@/hooks/useClients";
import type { Load } from "@/hooks/useTrips";
import { exportLoadToPdf } from "@/lib/exportTripsToPdf";
import { format, parseISO } from "date-fns";
import { FileDown, Loader2, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface ExportLoadConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    load: Load | null;
    /** All loads, passed through to the PDF exporter for backload/parent lookup. */
    allLoads: Load[];
}

const CURRENCIES = ["USD", "ZAR", "BWP", "ZMW"] as const;
type Currency = (typeof CURRENCIES)[number];

/**
 * Always-CC'd internal recipients on every Load Confirmation email.
 */
const ALWAYS_CC_EMAILS = [
    "Vimbai@matanuska.co.zw",
    "accounts@matanuska.co.za",
    "tanaka@matanuska.co.zw",
] as const;

/**
 * Build the email subject + body that pre-populates the Outlook draft.
 * Kept short so it fits comfortably in a `mailto:` URL on every browser.
 */
function buildEmailContent(load: Load, filename: string): { subject: string; body: string } {
    const safeDate = (iso?: string) => {
        if (!iso) return "—";
        try {
            return format(parseISO(iso), "dd MMM yyyy");
        } catch {
            return iso;
        }
    };

    const subject = `Load Confirmation — ${load.load_id}`;
    const bodyLines = [
        "Hi,",
        "",
        `Please find attached the Load Confirmation for ${load.load_id}.`,
        "",
        `Route: ${load.origin} → ${load.destination}`,
        `Loading: ${safeDate(load.loading_date)}`,
        `Offloading: ${safeDate(load.offloading_date)}`,
        "",
        `Attachment: ${filename}`,
        "",
        "Kind regards,",
    ];
    return { subject, body: bodyLines.join("\n") };
}

/**
 * Quick-Action dialog that prompts for an optional Rate before exporting the
 * trip as a "Load Confirmation" PDF.
 *
 * The rate is for display on the PDF only — it is never persisted to the load
 * row, so this dialog does not call any mutation.
 *
 * Two actions are offered:
 *  - "Download PDF" — saves the PDF locally.
 *  - "Email via Outlook" — saves the PDF locally AND opens the user's default
 *    mail app (Outlook on Windows / Mac when configured) with the client's
 *    email pre-filled, plus subject + body referencing the document. On
 *    devices that support the Web Share API with files (modern mobile + some
 *    desktops) the file is offered to the share sheet so apps like Outlook
 *    can attach it directly.
 *
 * Note: web pages cannot programmatically attach a file to a desktop email
 * client — that is a fundamental browser/OS security restriction. The user
 * must drag the just-downloaded PDF into the draft (or use the Web Share
 * sheet on supported platforms). The dialog explains this clearly so it is
 * never misleading.
 */
export function ExportLoadConfirmationDialog({
    open,
    onOpenChange,
    load,
    allLoads,
}: ExportLoadConfirmationDialogProps) {
    const [rate, setRate] = useState<string>("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [exporting, setExporting] = useState(false);
    const [emailing, setEmailing] = useState(false);

    const { data: clients = [] } = useClients();
    const client = useMemo(
        () => (load?.client_id ? clients.find((c) => c.id === load.client_id) ?? null : null),
        [clients, load?.client_id],
    );
    const clientEmail = client?.contact_email?.trim() || "";
    const canEmail = !!load && clientEmail.length > 0;

    // Reset every time the dialog reopens with a (possibly different) load
    useEffect(() => {
        if (open) {
            setRate("");
            setCurrency("USD");
            setExporting(false);
            setEmailing(false);
        }
    }, [open, load?.id]);

    /**
     * Parse the optional rate field into the shape consumed by exportLoadToPdf.
     * Returns undefined when blank/invalid so no rate row is rendered.
     */
    const buildRate = (): { amount: number; currency: string } | undefined => {
        const trimmed = rate.trim();
        if (!trimmed) return undefined;
        const parsed = Number.parseFloat(trimmed);
        if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
        return { amount: parsed, currency };
    };

    const handleDownload = async () => {
        if (!load) return;
        setExporting(true);
        try {
            await exportLoadToPdf(load, allLoads, { rate: buildRate() });
            onOpenChange(false);
        } catch (err) {
            console.error("[ExportLoadConfirmation] export failed", err);
            toast.error("Failed to export PDF");
        } finally {
            setExporting(false);
        }
    };

    const handleEmail = async () => {
        if (!load || !canEmail) return;
        setEmailing(true);
        try {
            // Generate the PDF without auto-saving so we can attempt a share-
            // sheet attach first; fall back to download + mailto.
            const { blob, filename } = await exportLoadToPdf(load, allLoads, {
                rate: buildRate(),
                download: false,
            });

            const { subject, body } = buildEmailContent(load, filename);

            // Progressive enhancement: when the platform supports sharing
            // files (Web Share API level 2), offer the file to the OS share
            // sheet. On modern Windows + macOS Outlook this lets the user
            // pick "Mail/Outlook" and have the PDF pre-attached.
            const file = new File([blob], filename, { type: "application/pdf" });
            const sharePayload: ShareData & { files?: File[] } = {
                title: subject,
                text: body,
                files: [file],
            };
            const navAny = navigator as Navigator & {
                canShare?: (data: ShareData & { files?: File[] }) => boolean;
                share?: (data: ShareData & { files?: File[] }) => Promise<void>;
            };
            if (
                typeof navAny.canShare === "function" &&
                typeof navAny.share === "function" &&
                navAny.canShare(sharePayload)
            ) {
                try {
                    await navAny.share(sharePayload);
                    onOpenChange(false);
                    return;
                } catch (shareErr) {
                    // User aborted the share sheet, or the platform refused —
                    // fall back to the mailto flow below.
                    if ((shareErr as Error)?.name === "AbortError") {
                        return;
                    }
                    console.warn("[ExportLoadConfirmation] navigator.share failed; falling back to mailto", shareErr);
                }
            }

            // Fallback: download the PDF locally + open the user's default
            // mail client with to/subject/body pre-filled. The user must
            // attach the just-downloaded file manually — browsers do not
            // permit silent attachments.
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            // Revoke after a tick so the download has time to start.
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            const ccList = ALWAYS_CC_EMAILS.join(",");
            const mailto = `mailto:${encodeURIComponent(clientEmail)}?cc=${encodeURIComponent(ccList)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailto;

            toast.success(
                `${filename} downloaded — attach it to the email draft that just opened.`,
            );
            onOpenChange(false);
        } catch (err) {
            console.error("[ExportLoadConfirmation] email flow failed", err);
            toast.error("Failed to prepare email");
        } finally {
            setEmailing(false);
        }
    };

    if (!load) return null;

    const busy = exporting || emailing;

    return (
        <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-primary" />
                        Export Load Confirmation
                    </DialogTitle>
                    <DialogDescription>
                        Add an optional rate to display on the PDF. This will not change
                        the trip — it is only printed on the exported document.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-[1fr_120px] gap-3 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-rate">Rate (optional)</Label>
                            <Input
                                id="load-confirmation-rate"
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                disabled={busy}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-currency">Currency</Label>
                            <Select
                                value={currency}
                                onValueChange={(v) => setCurrency(v as Currency)}
                                disabled={busy}
                            >
                                <SelectTrigger id="load-confirmation-currency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Leave the rate blank to export without a price line.
                    </p>

                    {/* Email recipient summary */}
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">Email recipient</span>
                        </div>
                        {client ? (
                            clientEmail ? (
                                <div className="text-foreground break-words">
                                    <span className="font-medium">{client.name}</span>
                                    <span className="text-muted-foreground"> — </span>
                                    <span className="break-all">{clientEmail}</span>
                                </div>
                            ) : (
                                <div className="text-amber-600 dark:text-amber-400 break-words">
                                    {client.name} has no contact email — add one on the Clients
                                    page to enable email.
                                </div>
                            )
                        ) : (
                            <div className="text-muted-foreground break-words">
                                No client linked to this load — emailing is disabled.
                            </div>
                        )}
                        <div className="pt-1 text-muted-foreground break-words">
                            <span className="font-medium">CC:</span>{" "}
                            <span className="break-all">{ALWAYS_CC_EMAILS.join(", ")}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                        className="w-full sm:w-auto whitespace-nowrap"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleDownload}
                        disabled={busy}
                        className="w-full sm:w-auto whitespace-nowrap"
                    >
                        {exporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Exporting…
                            </>
                        ) : (
                            <>
                                <FileDown className="h-4 w-4 mr-2" />
                                Download PDF
                            </>
                        )}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleEmail}
                        disabled={busy || !canEmail}
                        className="w-full sm:w-auto whitespace-nowrap"
                        title={
                            canEmail
                                ? "Open Outlook with the PDF and the client email pre-filled"
                                : "No client email available for this load"
                        }
                    >
                        {emailing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Preparing…
                            </>
                        ) : (
                            <>
                                <Mail className="h-4 w-4 mr-2" />
                                Email via Outlook
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
