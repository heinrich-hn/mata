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
import { useActiveSuppliers } from "@/hooks/useSuppliers";
import type { Load } from "@/hooks/useTrips";
import { downloadEmlWithAttachment } from "@/lib/emlExport";
import { exportLoadOrderToPdf } from "@/lib/exportLoadOrderToPdf";
import { format, parseISO } from "date-fns";
import { FileDown, Loader2, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface ExportLoadOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    load: Load | null;
}

const CURRENCIES = ["USD", "ZAR", "BWP", "ZMW"] as const;
type Currency = (typeof CURRENCIES)[number];

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

interface ParsedTimeWindow {
    subcontractor?: { supplierId?: string; supplierName?: string };
}

function parseTimeWindow(tw: unknown): ParsedTimeWindow {
    if (!tw) return {};
    if (typeof tw === "string") {
        try {
            return JSON.parse(tw) as ParsedTimeWindow;
        } catch {
            return {};
        }
    }
    return tw as ParsedTimeWindow;
}

function defaultEmailBody(load: Load, supplierName?: string | null): string {
    return [
        `Dear ${supplierName || "Subcontractor"},`,
        "",
        `Please find attached the Load Order for shipment ${load.load_id}.`,
        "",
        `Route: ${load.origin} to ${load.destination}`,
        `Loading Date: ${safeFormatDate(load.loading_date)}`,
        `Offloading Date: ${safeFormatDate(load.offloading_date)}`,
        "",
        "The attached order includes the agreed trip rate, loading and offloading points, and",
        "the standard subcontractor terms (Restraint of Trade and Non-Solicitation of Personnel).",
        "Please confirm acceptance of this order at your earliest convenience.",
        "",
        "Kind regards,",
        "",
        "Heinrich Nel",
        "Heinrich@matanuska.co.za",
        "General Manager, Transport",
        "matanuska.co.zw",
        "+27 66 273 1270",
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
 * Dialog used on the Subcontractor Trips page in place of the standard Load
 * Confirmation export. Captures the trip rate (printed on the PDF) and the
 * subcontractor email recipients, then either downloads the PDF directly or
 * generates an .eml draft with the PDF attached.
 *
 * The PDF body is intentionally minimal: subcontractor details, trip rate,
 * loading & offloading points, plus the legal terms (verbatim).
 */
export function ExportLoadOrderDialog({
    open,
    onOpenChange,
    load,
}: ExportLoadOrderDialogProps) {
    const [rate, setRate] = useState<string>("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [exporting, setExporting] = useState(false);
    const [emailing, setEmailing] = useState(false);

    const [toEmail, setToEmail] = useState("");
    const [ccEmails, setCcEmails] = useState(DEFAULT_CC_EMAILS.join(", "));
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    const { data: suppliers = [] } = useActiveSuppliers();

    const supplier = useMemo(() => {
        if (!load) return null;
        const tw = parseTimeWindow(load.time_window);
        const id = tw.subcontractor?.supplierId;
        if (!id) return null;
        return suppliers.find((s) => s.id === id) ?? null;
    }, [load, suppliers]);

    const supplierEmail = supplier?.contact_email?.trim() || "";
    const supplierName =
        supplier?.name ||
        parseTimeWindow(load?.time_window).subcontractor?.supplierName ||
        "";

    useEffect(() => {
        if (!open || !load) return;
        setRate("");
        setCurrency("USD");
        setExporting(false);
        setEmailing(false);
        setToEmail(supplierEmail);
        setCcEmails(DEFAULT_CC_EMAILS.join(", "));
        setEmailSubject(`Load Order — ${load.load_id}`);
        setEmailBody(defaultEmailBody(load, supplierName));
    }, [open, load, supplierEmail, supplierName]);

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
            await exportLoadOrderToPdf(load, { rate: buildRate() });
            onOpenChange(false);
        } catch (err) {
            console.error("[ExportLoadOrder] export failed", err);
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
            const { blob, filename } = await exportLoadOrderToPdf(load, {
                rate: buildRate(),
                download: false,
            });
            const pdfBase64 = await blobToBase64(blob);

            const toFinal = splitAddresses(toEmail).join(", ");
            const ccFinal = splitAddresses(ccEmails).join(", ");
            const subjectFinal =
                emailSubject.trim() || `Load Order — ${load.load_id}`;
            const bodyFinal =
                emailBody.trim().length > 0 ? emailBody : defaultEmailBody(load, supplierName);

            downloadEmlWithAttachment({
                to: toFinal,
                cc: ccFinal || undefined,
                subject: subjectFinal,
                body: bodyFinal,
                pdfBase64,
                pdfFileName: filename,
                fileName: `LoadOrder-${load.load_id}`,
            });

            toast.success(
                "Email draft downloaded — open the .eml file to launch Outlook with the PDF already attached.",
            );
            onOpenChange(false);
        } catch (err) {
            console.error("[ExportLoadOrder] email flow failed", err);
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
                        Export Load Order
                    </DialogTitle>
                    <DialogDescription>
                        Sends a subcontractor Load Order containing only the supplier
                        details, agreed trip rate, loading and offloading points, and the
                        standard subcontractor terms.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-[1fr_120px] gap-3 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="load-order-rate">Trip Rate</Label>
                            <Input
                                id="load-order-rate"
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
                            <Label htmlFor="load-order-currency">Currency</Label>
                            <Select
                                value={currency}
                                onValueChange={(v) => setCurrency(v as Currency)}
                                disabled={busy}
                            >
                                <SelectTrigger id="load-order-currency">
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
                        Leave the rate blank to print “To be confirmed” on the order.
                    </p>

                    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">Email draft</span>
                            {supplierName && (
                                <span className="ml-1 truncate">
                                    · supplier:{" "}
                                    <span className="font-medium">{supplierName}</span>
                                </span>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-order-to" className="text-xs">
                                To
                            </Label>
                            <Input
                                id="load-order-to"
                                type="email"
                                placeholder="supplier@example.com"
                                value={toEmail}
                                onChange={(e) => setToEmail(e.target.value)}
                                disabled={busy}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-order-cc" className="text-xs">
                                CC
                            </Label>
                            <Input
                                id="load-order-cc"
                                placeholder="comma-separated"
                                value={ccEmails}
                                onChange={(e) => setCcEmails(e.target.value)}
                                disabled={busy}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-order-subject" className="text-xs">
                                Subject
                            </Label>
                            <Input
                                id="load-order-subject"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                disabled={busy}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="load-order-body" className="text-xs">
                                Message
                            </Label>
                            <Textarea
                                id="load-order-body"
                                rows={7}
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                disabled={busy}
                                className="text-sm"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleDownload}
                        disabled={busy}
                    >
                        {exporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating…
                            </>
                        ) : (
                            <>
                                <FileDown className="h-4 w-4 mr-2" />
                                Download PDF
                            </>
                        )}
                    </Button>
                    <Button onClick={handleEmail} disabled={busy || !canEmail}>
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
