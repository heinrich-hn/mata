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
import type { Load } from "@/hooks/useTrips";
import { exportLoadToPdf } from "@/lib/exportTripsToPdf";
import { FileDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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
 * Quick-Action dialog that prompts for an optional Rate before exporting the
 * trip as a "Load Confirmation" PDF.
 *
 * The rate is for display on the PDF only — it is never persisted to the load
 * row, so this dialog does not call any mutation.
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

    // Reset every time the dialog reopens with a (possibly different) load
    useEffect(() => {
        if (open) {
            setRate("");
            setCurrency("USD");
            setExporting(false);
        }
    }, [open, load?.id]);

    const handleExport = async () => {
        if (!load) return;

        // Sanitize the rate: strip whitespace, allow only digits/decimal point.
        const trimmed = rate.trim();
        let rateForPdf: { amount: number; currency: string } | undefined;
        if (trimmed) {
            const parsed = Number.parseFloat(trimmed);
            if (Number.isFinite(parsed) && parsed > 0) {
                rateForPdf = { amount: parsed, currency };
            }
        }

        setExporting(true);
        try {
            await exportLoadToPdf(load, allLoads, { rate: rateForPdf });
            onOpenChange(false);
        } catch (err) {
            console.error("[ExportLoadConfirmation] export failed", err);
        } finally {
            setExporting(false);
        }
    };

    if (!load) return null;

    return (
        <Dialog open={open} onOpenChange={(o) => !exporting && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
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
                                disabled={exporting}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="load-confirmation-currency">Currency</Label>
                            <Select
                                value={currency}
                                onValueChange={(v) => setCurrency(v as Currency)}
                                disabled={exporting}
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
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={exporting}
                    >
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleExport} disabled={exporting}>
                        {exporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Exporting…
                            </>
                        ) : (
                            <>
                                <FileDown className="h-4 w-4 mr-2" />
                                Export PDF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
