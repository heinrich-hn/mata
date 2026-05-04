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
import { Textarea } from "@/components/ui/textarea";
import { useClients } from "@/hooks/useClients";
import type { Load } from "@/hooks/useTrips";
import { downloadEmlWithAttachment } from "@/lib/emlExport";
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
 * Default internal recipients pre-filled in the CC field on every Load
 * Confirmation email. The user can edit them before sending.
 */
const DEFAULT_CC_EMAILS = [
    "Vimbai@matanuska.co.zw",
    "accounts@matanuska.co.za",
    "tanaka@matanuska.co.zw",
] as const;

const EMAIL_RE = /^[^\s,;]+@[^\s,;]+\.[^\s,;]+$/;

function splitAddresses(input: string): string[] {
    return input
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function isValidEmailList(input: string, { allowEmpty = true } = {}): boolean {
    const addresses = splitAddresses(input);
    if (addresses.length === 0) return allowEmpty;
    return addresses.every((addr) => EMAIL_RE.test(addr));
}

function safeFormatDate(iso?: string): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "dd MMM yyyy");
    } catch {
        return iso;
    }
}

function defaultEmailBody(load: Load): string {
    return [
        "Hi,",
        "",
        `Please find attached the Load Confirmation for ${load.load_id}.`,
        "",
        `Route:      ${load.origin} → ${load.destination}`,
        `Loading:    ${safeFormatDate(load.loading_date)}`,
        `Offloading: ${safeFormatDate(load.offloading_date)}`,
        "",
        "Kind regards,",
        "MATA Fleet",
    ].join("\n");
}

async function blobToBase64(blob: Blob): Promise<string> {
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

/**
 * Quick-Action dialog that prompts for an optional Rate before exporting the
 * trip as a "Load Confirmation" PDF.
 *
 * The rate is for display on the PDF only — never persisted to the load row.
 *
 * Two actions are offered:
 *  - "Download PDF" — saves the PDF locally.
 *  - "Email via Outlook" — generates the PDF, embeds it inside an `.eml`
 *    draft (with editable To/CC/subject/body) and downloads that file.
 *    Opening the downloaded `.eml` launches Outlook with the PDF already
 *    attached. This is the only reliable cross-platform way to attach a
 *    file to an email from a web app — `mailto:` URLs cannot carry
 *    attachments and modern Outlook builds also drop the body for anything
 *    larger than a tiny URL. Both the To and CC fields are editable so users
 *    can override the auto-filled client email or the default internal CC list.
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

    // Editable email recipients & content
    const [toEmail, setToEmail] = useState("");
    const [ccEmails, setCcEmails] = useState(DEFAULT_CC_EMAILS.join(", "));
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    const { data: clients = [] } = useClients();
    const client = useMemo(
        () => (load?.client_id ? clients.find((c) => c.id === load.client_id) ?? null : null),
        [clients, load?.client_id],
    );
    const clientEmail = client?.contact_email?.trim() || "";

    // Reset every time the dialog reopens with a (possibly different) load
    useEffect(() => {
        if (!open || !load) return;
        setRate("");
        setCurrency("USD");
        setExporting(false);
        setEmailing(false);
        setToEmail(clientEmail);
        setCcEmails(DEFAULT_CC_EMAILS.join(", "));
        setEmailSubject(`Load Confirmation — ${load.load_id}`);
        setEmailBody(defaultEmailBody(load));
    }, [open, load, clientEmail]);

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

    const toIsValid = isValidEmailList(toEmail, { allowEmpty: false });
    const ccIsValid = isValidEmailList(ccEmails, { allowEmpty: true });
    const canEmail = !!load && toIsValid && ccIsValid;

    const handleEmail = async () => {
        if (!load) return;
        if (!toIsValid) {
            toast.error("Enter a valid To email address");
            return;
        }
        if (!ccIsValid) {
            toast.error("CC list contains an invalid address");
            return;
        }

        setEmailing(true);
        try {
            // Generate the PDF without auto-saving so we can embed it in the .eml draft
            const { blob, filename } = await exportLoadToPdf(load, allLoads, {
                rate: buildRate(),
                download: false,
            });

            const pdfBase64 = await blobToBase64(blob);

            // Normalise address lists so the .eml has clean comma-separated values
            const toFinal = splitAddresses(toEmail).join(", ");
            const ccFinal = splitAddresses(ccEmails).join(", ");
            const subjectFinal =
                emailSubject.trim() || `Load Confirmation — ${load.load_id}`;
            const bodyFinal =
                emailBody.trim().length > 0 ? emailBody : defaultEmailBody(load);

            downloadEmlWithAttachment({
                to: toFinal,
                cc: ccFinal || undefined,
                subject: subjectFinal,
                body: bodyFinal,
                pdfBase64,
                pdfFileName: filename,
                fileName: `LoadConfirmation-${load.load_id}`,
            });

            toast.success(
                "Email draft downloaded — open the .eml file to launch Outlook with the PDF already attached.",
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
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-primary" />
                        Export Load Confirmation
                    </DialogTitle>
                    <DialogDescription>
                        Add an optional rate and adjust the email recipients before
                        sending. The rate is only printed on the PDF — it is not saved
                        to the load.
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

                    {/* Editable recipient block */}
                    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">Email draft</span>
                            {client && (
                                <span className="ml-1 truncate">
                                    · client:{" "}
                                    <span className="font-medium">{client.name}</span>
                                </span>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-to" className="text-xs">
                                To
                            </Label>
                            <Input
                                id="load-confirmation-to"
                                type="email"
                                placeholder="recipient@example.com"
                                value={toEmail}
                                onChange={(e) => setToEmail(e.target.value)}
                                disabled={busy}
                                aria-invalid={!toIsValid}
                            />
                            {!toIsValid && toEmail.trim().length > 0 && (
                                <p className="text-[11px] text-destructive">
                                    Enter a valid email address.
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-cc" className="text-xs">
                                CC{" "}
                                <span className="text-muted-foreground">
                                    (comma-separated)
                                </span>
                            </Label>
                            <Input
                                id="load-confirmation-cc"
                                type="text"
                                placeholder="finance@example.com, ops@example.com"
                                value={ccEmails}
                                onChange={(e) => setCcEmails(e.target.value)}
                                disabled={busy}
                                aria-invalid={!ccIsValid}
                            />
                            {!ccIsValid && (
                                <p className="text-[11px] text-destructive">
                                    One or more CC addresses are invalid.
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-subject" className="text-xs">
                                Subject
                            </Label>
                            <Input
                                id="load-confirmation-subject"
                                type="text"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                disabled={busy}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-body" className="text-xs">
                                Body
                            </Label>
                            <Textarea
                                id="load-confirmation-body"
                                rows={6}
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                disabled={busy}
                                className="font-mono text-xs"
                            />
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                            The PDF is embedded in a downloadable <code>.eml</code>{" "}
                            draft — opening it launches Outlook with the file already
                            attached.
                        </p>
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
                                ? "Generate an .eml draft with the PDF attached and open it in Outlook"
                                : "Fix the email recipients to enable sending"
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
