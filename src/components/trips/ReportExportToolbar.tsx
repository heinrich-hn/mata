import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarRange, Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";

export interface ReportExportToolbarProps {
    /** Default From date (YYYY-MM-DD). Updates when the global filter changes. */
    defaultFrom: string;
    /** Default To date (YYYY-MM-DD). */
    defaultTo: string;
    /** Called when "Export PDF" is clicked. */
    onExportPdf: (from: string, to: string) => void | Promise<void>;
    /** Called when "Export Excel" is clicked. */
    onExportExcel: (from: string, to: string) => void | Promise<void>;
    /** Optional label shown above the controls. */
    label?: string;
    /** Disable both buttons (e.g. while loading or when there is no data). */
    disabled?: boolean;
}

/**
 * Compact per-report toolbar with date-range inputs and PDF/Excel buttons.
 * Tracks its own local From/To, seeded from the parent's defaults so each
 * tab can pick its own export window without affecting the on-screen view.
 */
export function ReportExportToolbar({
    defaultFrom,
    defaultTo,
    onExportPdf,
    onExportExcel,
    label = "Export this report",
    disabled = false,
}: ReportExportToolbarProps) {
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [xlsxBusy, setXlsxBusy] = useState(false);

    // Re-sync when the parent's date range changes (e.g. global period selector)
    useEffect(() => {
        setFrom(defaultFrom);
    }, [defaultFrom]);
    useEffect(() => {
        setTo(defaultTo);
    }, [defaultTo]);

    const handlePdf = async () => {
        setPdfBusy(true);
        try {
            await onExportPdf(from, to);
        } finally {
            setPdfBusy(false);
        }
    };

    const handleExcel = async () => {
        setXlsxBusy(true);
        try {
            await onExportExcel(from, to);
        } finally {
            setXlsxBusy(false);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-slate-900 via-slate-700 to-slate-500 dark:from-slate-100 dark:via-slate-300 dark:to-slate-500" />
            <div className="flex flex-col gap-3 px-5 py-3.5 pl-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-3 sm:pr-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <CalendarRange className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                {label}
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                Date Range
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <Label htmlFor="report-from" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-1">
                            From
                        </Label>
                        <Input
                            id="report-from"
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-9 w-[150px] border-slate-200 bg-slate-50/60 font-medium text-slate-800 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                        />
                    </div>
                    <div className="flex flex-col">
                        <Label htmlFor="report-to" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-1">
                            To
                        </Label>
                        <Input
                            id="report-to"
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-9 w-[150px] border-slate-200 bg-slate-50/60 font-medium text-slate-800 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExcel}
                        disabled={disabled || xlsxBusy || !from || !to}
                        className="h-9 gap-2 border-emerald-200 bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        {xlsxBusy ? "Exporting…" : "Excel"}
                    </Button>
                    <Button
                        size="sm"
                        onClick={handlePdf}
                        disabled={disabled || pdfBusy || !from || !to}
                        className="h-9 gap-2 bg-slate-900 font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                        <Download className="h-4 w-4" />
                        {pdfBusy ? "Exporting…" : "PDF"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ReportExportToolbar;
