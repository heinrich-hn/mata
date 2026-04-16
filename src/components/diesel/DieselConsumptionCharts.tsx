import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber, formatCurrency } from '@/lib/formatters';
import { headerFill, headerFont, headerAlign, thinBorder, altRowFill, bodyFont, bodyAlign } from '@/utils/excelStyles';
import type { DieselConsumptionRecord, DieselNorms } from '@/types/operations';
import { BarChart3, Download, Snowflake, Truck, TrendingUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ── Types ──

interface MonthlyFleetData {
    month: string;
    monthLabel: string;
    totalLitres: number;
    totalKm: number;
    totalHours: number;
    kmPerLitre: number | null;
    litresPerHour: number | null;
    totalCost: number;
    fillCount: number;
}

interface UnitMonthlyPoint {
    month: string;
    monthLabel: string;
    totalLitres: number;
    totalKm: number;
    totalHours: number;
    kmPerLitre: number | null;
    litresPerHour: number | null;
    totalCost: number;
    fillCount: number;
}

interface UnitWeeklyPoint {
    weekKey: string;
    weekLabel: string;
    totalLitres: number;
    totalKm: number;
    totalHours: number;
    kmPerLitre: number | null;
    litresPerHour: number | null;
    totalCost: number;
    fillCount: number;
}

// ── Helpers ──

const _monthKey = (dateStr: string) => dateStr.slice(0, 7);

const _monthLabel = (mk: string) => {
    const [y, m] = mk.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
};

const _wkStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d;
};

const _wkLabel = (start: Date): string => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('en-ZA', o)} – ${end.toLocaleDateString('en-ZA', o)}`;
};

// ── Tooltip ──

interface TooltipEntry {
    color: string;
    name: string;
    value: number;
}

const ChartTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
}) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
            <p className="font-semibold mb-2 pb-1.5 border-b">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground text-xs">{entry.name}</span>
                    </div>
                    <span className="font-medium text-xs tabular-nums">
                        {entry.name.includes('km/L')
                            ? formatNumber(entry.value, 2) + ' km/L'
                            : entry.name.includes('L/hr')
                                ? formatNumber(entry.value, 2) + ' L/hr'
                                : entry.name.includes('Hours')
                                    ? formatNumber(entry.value, 1) + ' hrs'
                                    : entry.name.includes('Cost')
                                        ? formatCurrency(entry.value)
                                        : `${formatNumber(entry.value)} L`}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ── Props ──

interface DieselConsumptionChartsProps {
    filteredTruckRecords: DieselConsumptionRecord[];
    filteredReeferRecords: DieselConsumptionRecord[];
    dieselNorms: DieselNorms[];
    reeferLhrMap: Map<string, { avgLitresPerHour: number; totalHoursOperated: number }>;
}

type DataMode = 'truck' | 'reefer';

// ── Aggregation helpers ──

function buildMonthlySummary(records: DieselConsumptionRecord[], isReefer: boolean): MonthlyFleetData[] {
    const mm = new Map<string, { litres: number; km: number; hours: number; cost: number; fills: number }>();
    records.forEach(r => {
        const mk = _monthKey(r.date);
        const e = mm.get(mk) ?? { litres: 0, km: 0, hours: 0, cost: 0, fills: 0 };
        e.litres += r.litres_filled || 0;
        e.km += r.distance_travelled || 0;
        e.hours += r.hours_operated || 0;
        e.cost += r.total_cost || 0;
        e.fills += 1;
        mm.set(mk, e);
    });
    return Array.from(mm.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mk, d]) => ({
            month: mk,
            monthLabel: _monthLabel(mk),
            totalLitres: d.litres,
            totalKm: d.km,
            totalHours: d.hours,
            kmPerLitre: !isReefer && d.litres > 0 ? d.km / d.litres : null,
            litresPerHour: isReefer && d.hours > 0 ? d.litres / d.hours : null,
            totalCost: d.cost,
            fillCount: d.fills,
        }));
}

function buildUnitMonthly(records: DieselConsumptionRecord[], isReefer: boolean): Map<string, UnitMonthlyPoint[]> {
    const tm = new Map<string, Map<string, { litres: number; km: number; hours: number; cost: number; fills: number }>>();
    records.forEach(r => {
        const fleet = r.fleet_number;
        const mk = _monthKey(r.date);
        if (!tm.has(fleet)) tm.set(fleet, new Map());
        const months = tm.get(fleet)!;
        const e = months.get(mk) ?? { litres: 0, km: 0, hours: 0, cost: 0, fills: 0 };
        e.litres += r.litres_filled || 0;
        e.km += r.distance_travelled || 0;
        e.hours += r.hours_operated || 0;
        e.cost += r.total_cost || 0;
        e.fills += 1;
        months.set(mk, e);
    });
    const result = new Map<string, UnitMonthlyPoint[]>();
    tm.forEach((months, fleet) => {
        result.set(fleet, Array.from(months.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([mk, d]) => ({
                month: mk,
                monthLabel: _monthLabel(mk),
                totalLitres: d.litres,
                totalKm: d.km,
                totalHours: d.hours,
                kmPerLitre: !isReefer && d.litres > 0 ? d.km / d.litres : null,
                litresPerHour: isReefer && d.hours > 0 ? d.litres / d.hours : null,
                totalCost: d.cost,
                fillCount: d.fills,
            })));
    });
    return result;
}

function buildUnitWeekly(records: DieselConsumptionRecord[], isReefer: boolean): Map<string, UnitWeeklyPoint[]> {
    const tm = new Map<string, Map<string, { ws: Date; litres: number; km: number; hours: number; cost: number; fills: number }>>();
    records.forEach(r => {
        const fleet = r.fleet_number;
        const ws = _wkStart(new Date(r.date));
        const wk = ws.toISOString().split('T')[0];
        if (!tm.has(fleet)) tm.set(fleet, new Map());
        const weeks = tm.get(fleet)!;
        const e = weeks.get(wk) ?? { ws, litres: 0, km: 0, hours: 0, cost: 0, fills: 0 };
        e.litres += r.litres_filled || 0;
        e.km += r.distance_travelled || 0;
        e.hours += r.hours_operated || 0;
        e.cost += r.total_cost || 0;
        e.fills += 1;
        weeks.set(wk, e);
    });
    const result = new Map<string, UnitWeeklyPoint[]>();
    tm.forEach((weeks, fleet) => {
        result.set(fleet, Array.from(weeks.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, d]) => ({
                weekKey: d.ws.toISOString().split('T')[0],
                weekLabel: _wkLabel(d.ws),
                totalLitres: d.litres,
                totalKm: d.km,
                totalHours: d.hours,
                kmPerLitre: !isReefer && d.litres > 0 ? d.km / d.litres : null,
                litresPerHour: isReefer && d.hours > 0 ? d.litres / d.hours : null,
                totalCost: d.cost,
                fillCount: d.fills,
            })));
    });
    return result;
}

// ── Component ──

const DieselConsumptionCharts = ({
    filteredTruckRecords,
    filteredReeferRecords,
    dieselNorms,
    reeferLhrMap,
}: DieselConsumptionChartsProps) => {
    const [mode, setMode] = useState<DataMode>('truck');
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [isExporting, setIsExporting] = useState(false);

    const isReefer = mode === 'reefer';
    const records = isReefer ? filteredReeferRecords : filteredTruckRecords;

    // Reset selected unit when toggling mode
    const handleModeChange = (newMode: string) => {
        setMode(newMode as DataMode);
        setSelectedUnit('');
    };

    // Sorted fleet list
    const allFleets = useMemo(() => {
        const s = new Set<string>();
        records.forEach(r => s.add(r.fleet_number));
        return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [records]);

    // ── Monthly summary ──
    const monthlySummary = useMemo(() => buildMonthlySummary(records, isReefer), [records, isReefer]);

    // ── Per-unit monthly data ──
    const unitMonthlyData = useMemo(() => buildUnitMonthly(records, isReefer), [records, isReefer]);

    // ── Per-unit weekly data ──
    const unitWeeklyData = useMemo(() => buildUnitWeekly(records, isReefer), [records, isReefer]);

    // Norm / L/hr reference for selected unit
    const selectedNormKmL = useMemo(() => {
        if (!selectedUnit || isReefer) return null;
        return dieselNorms.find(n => n.fleet_number === selectedUnit)?.expected_km_per_litre ?? null;
    }, [selectedUnit, dieselNorms, isReefer]);

    const selectedReeferLhr = useMemo(() => {
        if (!selectedUnit || !isReefer) return null;
        return reeferLhrMap.get(selectedUnit)?.avgLitresPerHour ?? null;
    }, [selectedUnit, reeferLhrMap, isReefer]);

    // Efficiency label helpers
    const effLabel = isReefer ? 'L/hr' : 'km/L';
    const effField = isReefer ? 'litresPerHour' : 'kmPerLitre';
    const activityLabel = isReefer ? 'Hours' : 'km';


    // ── Excel Export ──
    const handleExportMonthly = useCallback(async () => {
        setIsExporting(true);
        try {
            const wb = new ExcelJS.Workbook();
            wb.creator = 'MATA Fleet';
            wb.created = new Date();

            const sheetTitle = isReefer ? 'Reefer Monthly Summary' : 'Truck Monthly Summary';
            const ws1 = wb.addWorksheet(sheetTitle);
            const summaryHeaders = ['Month', 'Total Litres', isReefer ? 'Total Hours' : 'Total km', effLabel, 'Total Cost', 'Fills'];
            const headerRow1 = ws1.addRow(summaryHeaders);
            headerRow1.eachCell(cell => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = headerAlign;
                cell.border = thinBorder;
            });
            monthlySummary.forEach((m, i) => {
                const effVal = isReefer ? m.litresPerHour : m.kmPerLitre;
                const actVal = isReefer ? m.totalHours : m.totalKm;
                const row = ws1.addRow([
                    m.monthLabel,
                    Math.round(m.totalLitres * 100) / 100,
                    Math.round(actVal * 100) / 100,
                    effVal ? Math.round(effVal * 100) / 100 : '',
                    Math.round(m.totalCost * 100) / 100,
                    m.fillCount,
                ]);
                row.eachCell(cell => {
                    cell.font = bodyFont;
                    cell.alignment = bodyAlign;
                    cell.border = thinBorder;
                    if (i % 2 === 1) cell.fill = altRowFill;
                });
            });
            const tl = monthlySummary.reduce((s, m) => s + m.totalLitres, 0);
            const ta = monthlySummary.reduce((s, m) => s + (isReefer ? m.totalHours : m.totalKm), 0);
            const tc = monthlySummary.reduce((s, m) => s + m.totalCost, 0);
            const tf = monthlySummary.reduce((s, m) => s + m.fillCount, 0);
            const totalEff = isReefer ? (ta > 0 ? tl / ta : '') : (tl > 0 ? ta / tl : '');
            const totalRow1 = ws1.addRow([
                'TOTAL',
                Math.round(tl * 100) / 100,
                Math.round(ta * 100) / 100,
                typeof totalEff === 'number' ? Math.round(totalEff * 100) / 100 : '',
                Math.round(tc * 100) / 100,
                tf,
            ]);
            totalRow1.eachCell(cell => {
                cell.font = { ...headerFont, size: 10 };
                cell.fill = headerFill;
                cell.alignment = headerAlign;
                cell.border = thinBorder;
            });
            ws1.columns = [
                { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 10 },
            ];

            // One sheet per unit
            allFleets.forEach(fleet => {
                const pts = unitMonthlyData.get(fleet);
                if (!pts?.length) return;
                const ws = wb.addWorksheet(`${fleet} Monthly`);
                const headers = ['Month', 'Litres', isReefer ? 'Hours' : 'km', effLabel, 'Cost', 'Fills'];
                const hRow = ws.addRow(headers);
                hRow.eachCell(cell => {
                    cell.fill = headerFill;
                    cell.font = headerFont;
                    cell.alignment = headerAlign;
                    cell.border = thinBorder;
                });
                pts.forEach((p, i) => {
                    const effVal = isReefer ? p.litresPerHour : p.kmPerLitre;
                    const actVal = isReefer ? p.totalHours : p.totalKm;
                    const row = ws.addRow([
                        p.monthLabel,
                        Math.round(p.totalLitres * 100) / 100,
                        Math.round(actVal * 100) / 100,
                        effVal ? Math.round(effVal * 100) / 100 : '',
                        Math.round(p.totalCost * 100) / 100,
                        p.fillCount,
                    ]);
                    row.eachCell(cell => {
                        cell.font = bodyFont;
                        cell.alignment = bodyAlign;
                        cell.border = thinBorder;
                        if (i % 2 === 1) cell.fill = altRowFill;
                    });
                });
                const ftl = pts.reduce((s, p) => s + p.totalLitres, 0);
                const fta = pts.reduce((s, p) => s + (isReefer ? p.totalHours : p.totalKm), 0);
                const ftc = pts.reduce((s, p) => s + p.totalCost, 0);
                const ftf = pts.reduce((s, p) => s + p.fillCount, 0);
                const ftEff = isReefer ? (fta > 0 ? ftl / fta : '') : (ftl > 0 ? fta / ftl : '');
                const tRow = ws.addRow([
                    'TOTAL',
                    Math.round(ftl * 100) / 100,
                    Math.round(fta * 100) / 100,
                    typeof ftEff === 'number' ? Math.round(ftEff * 100) / 100 : '',
                    Math.round(ftc * 100) / 100,
                    ftf,
                ]);
                tRow.eachCell(cell => {
                    cell.font = { ...headerFont, size: 10 };
                    cell.fill = headerFill;
                    cell.alignment = headerAlign;
                    cell.border = thinBorder;
                });
                if (!isReefer) {
                    const norm = dieselNorms.find(n => n.fleet_number === fleet);
                    if (norm) {
                        ws.addRow([]);
                        const nRow = ws.addRow([
                            `Norm: ${norm.expected_km_per_litre} km/L`,
                            `Min: ${norm.min_acceptable} km/L`,
                        ]);
                        nRow.eachCell(cell => { cell.font = { ...bodyFont, italic: true }; });
                    }
                } else {
                    const lhr = reeferLhrMap.get(fleet);
                    if (lhr) {
                        ws.addRow([]);
                        const nRow = ws.addRow([
                            `Avg L/hr: ${lhr.avgLitresPerHour.toFixed(2)}`,
                            `Total Hours: ${lhr.totalHoursOperated.toFixed(1)}`,
                        ]);
                        nRow.eachCell(cell => { cell.font = { ...bodyFont, italic: true }; });
                    }
                }
                ws.columns = [
                    { width: 16 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 10 },
                ];
            });

            const buf = await wb.xlsx.writeBuffer();
            const prefix = isReefer ? 'reefer' : 'diesel';
            saveAs(new Blob([buf]), `${prefix}-monthly-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error('Export failed:', e);
        } finally {
            setIsExporting(false);
        }
    }, [monthlySummary, allFleets, unitMonthlyData, dieselNorms, reeferLhrMap, isReefer, effLabel]);

    // Computed data for selected unit
    const unitMonthly = useMemo(() => selectedUnit ? (unitMonthlyData.get(selectedUnit) || []) : [], [selectedUnit, unitMonthlyData]);
    const unitWeekly = useMemo(() => selectedUnit ? (unitWeeklyData.get(selectedUnit) || []) : [], [selectedUnit, unitWeeklyData]);

    const unitStats = useMemo(() => {
        if (!unitMonthly.length) return null;
        const tl = unitMonthly.reduce((s, p) => s + p.totalLitres, 0);
        const tk = unitMonthly.reduce((s, p) => s + p.totalKm, 0);
        const th = unitMonthly.reduce((s, p) => s + p.totalHours, 0);
        const tc = unitMonthly.reduce((s, p) => s + p.totalCost, 0);
        const norm = dieselNorms.find(n => n.fleet_number === selectedUnit);
        const lhr = reeferLhrMap.get(selectedUnit);
        const avgKmL = tl > 0 ? tk / tl : 0;
        const avgLhr = th > 0 ? tl / th : 0;
        return { tl, tk, th, tc, avgKmL, avgLhr, norm, lhr };
    }, [unitMonthly, selectedUnit, dieselNorms, reeferLhrMap]);

    // Reference line value for unit charts
    const refLineValue = isReefer ? selectedReeferLhr : selectedNormKmL;

    return (
        <div className="space-y-8">

            {/* ═══════ Mode Toggle ═══════ */}
            <div className="flex justify-center">
                <Tabs value={mode} onValueChange={handleModeChange}>
                    <TabsList className="h-10">
                        <TabsTrigger value="truck" className="gap-2 px-6">
                            <Truck className="h-4 w-4" />
                            Trucks
                        </TabsTrigger>
                        <TabsTrigger value="reefer" className="gap-2 px-6">
                            <Snowflake className="h-4 w-4" />
                            Reefers
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* ═══════════════════════════════════════════════════
           SECTION 1 — Monthly Overview
         ═══════════════════════════════════════════════════ */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <TrendingUp className="h-5 w-5" />
                                Monthly {isReefer ? 'Reefer' : 'Consumption'} Overview
                            </CardTitle>
                            <CardDescription>
                                {isReefer
                                    ? 'Fleet-wide reefer diesel usage and L/hr trends, month on month'
                                    : 'Fleet-wide diesel usage and efficiency trends, month on month'}
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={handleExportMonthly}
                            disabled={isExporting || monthlySummary.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            {isExporting ? 'Exporting…' : 'Export to Excel'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {monthlySummary.length > 0 ? (
                        <div className="space-y-10">

                            {/* Chart: Litres per month */}
                            <div>
                                <h4 className="text-sm font-medium mb-3">Litres Consumed per Month</h4>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={monthlySummary} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                        <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="totalLitres" name="Total Litres" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Chart: Efficiency trend */}
                            <div>
                                <h4 className="text-sm font-medium mb-3">
                                    {isReefer ? 'Average Litres per Hour (L/hr)' : 'Average Fuel Efficiency (km/L)'}
                                </h4>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={monthlySummary} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                        <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey={effField}
                                            name={`Avg ${effLabel}`}
                                            stroke="#2563eb"
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Chart: Cost trend */}
                            <div>
                                <h4 className="text-sm font-medium mb-3">Total Cost per Month</h4>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={monthlySummary} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                        <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="totalCost" name="Total Cost" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Period totals */}
                            <div className={`grid grid-cols-2 ${isReefer ? 'sm:grid-cols-4' : 'sm:grid-cols-4'} gap-4 pt-4 border-t`}>
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">
                                        {formatNumber(monthlySummary.reduce((s, m) => s + m.totalLitres, 0))}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Total Litres</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">
                                        {isReefer
                                            ? formatNumber(monthlySummary.reduce((s, m) => s + m.totalHours, 0), 1)
                                            : formatNumber(monthlySummary.reduce((s, m) => s + m.totalKm, 0))}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isReefer ? 'Total Hours' : 'Total km'}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">
                                        {(() => {
                                            const l = monthlySummary.reduce((s, m) => s + m.totalLitres, 0);
                                            if (isReefer) {
                                                const h = monthlySummary.reduce((s, m) => s + m.totalHours, 0);
                                                return h > 0 ? formatNumber(l / h, 2) : '—';
                                            }
                                            const k = monthlySummary.reduce((s, m) => s + m.totalKm, 0);
                                            return l > 0 ? formatNumber(k / l, 2) : '—';
                                        })()}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Avg {effLabel}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">
                                        {formatCurrency(monthlySummary.reduce((s, m) => s + m.totalCost, 0))}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-muted-foreground">
                                No {isReefer ? 'reefer' : 'diesel'} records for the selected period
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════
           SECTION 2 — Individual Unit Performance
         ═══════════════════════════════════════════════════ */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                {isReefer ? <Snowflake className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
                                Individual {isReefer ? 'Reefer' : 'Truck'} Performance
                            </CardTitle>
                            <CardDescription>
                                Select a {isReefer ? 'reefer' : 'truck'} to view its monthly and weekly consumption
                            </CardDescription>
                        </div>
                        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                            <SelectTrigger className="w-[200px] h-9 text-sm">
                                <SelectValue placeholder={`Choose a ${isReefer ? 'reefer' : 'truck'}…`} />
                            </SelectTrigger>
                            <SelectContent>
                                {allFleets.map(f => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedUnit ? (
                        <div className="text-center py-12">
                            {isReefer ? <Snowflake className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /> : <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />}
                            <p className="text-muted-foreground">Select a {isReefer ? 'reefer' : 'truck'} above to view its performance</p>
                        </div>
                    ) : unitMonthly.length === 0 && unitWeekly.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No data for {selectedUnit} in the selected period</p>
                        </div>
                    ) : (
                        <div className="space-y-10">

                            {/* Unit stats */}
                            {unitStats && (
                                <div className={`grid grid-cols-2 sm:grid-cols-5 gap-4`}>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-xl font-bold tabular-nums">{formatNumber(unitStats.tl)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Total Litres</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-xl font-bold tabular-nums">
                                            {isReefer ? formatNumber(unitStats.th, 1) : formatNumber(unitStats.tk)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {isReefer ? 'Total Hours' : 'Total km'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-xl font-bold tabular-nums">
                                            {formatNumber(isReefer ? unitStats.avgLhr : unitStats.avgKmL, 2)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">Avg {effLabel}</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        <p className="text-xl font-bold tabular-nums">{formatCurrency(unitStats.tc)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
                                    </div>
                                    <div className="rounded-lg border p-3 text-center">
                                        {isReefer ? (
                                            unitStats.lhr ? (
                                                <>
                                                    <p className="text-xl font-bold tabular-nums">
                                                        {formatNumber(unitStats.lhr.avgLitresPerHour, 2)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">Avg L/hr (reference)</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xl font-bold text-muted-foreground">—</p>
                                                    <p className="text-xs text-muted-foreground mt-1">No L/hr Data</p>
                                                </>
                                            )
                                        ) : (
                                            unitStats.norm ? (
                                                <>
                                                    <p className={`text-xl font-bold tabular-nums ${unitStats.avgKmL >= unitStats.norm.min_acceptable ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatNumber(unitStats.norm.expected_km_per_litre, 2)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Norm km/L {unitStats.avgKmL >= unitStats.norm.min_acceptable ? '✓' : '✗'}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xl font-bold text-muted-foreground">—</p>
                                                    <p className="text-xs text-muted-foreground mt-1">No Norm Set</p>
                                                </>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Monthly chart — litres bars + efficiency line */}
                            {unitMonthly.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-3">{selectedUnit} — Month by Month</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={unitMonthly} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                                            <YAxis yAxisId="litres" tick={{ fontSize: 12 }} />
                                            <YAxis yAxisId="eff" orientation="right" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Legend />
                                            <Bar yAxisId="litres" dataKey="totalLitres" name="Litres" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                            <Line
                                                yAxisId="eff"
                                                type="monotone"
                                                dataKey={effField}
                                                name={effLabel}
                                                stroke="#dc2626"
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                connectNulls
                                            />
                                            {refLineValue && (
                                                <ReferenceLine
                                                    yAxisId="eff"
                                                    y={refLineValue}
                                                    stroke="#16a34a"
                                                    strokeDasharray="5 5"
                                                    strokeWidth={2}
                                                    label={{
                                                        value: isReefer ? `Avg L/hr: ${formatNumber(refLineValue, 2)}` : `Norm: ${formatNumber(refLineValue, 2)}`,
                                                        position: 'insideTopRight',
                                                        fill: '#16a34a',
                                                        fontSize: 11,
                                                    }}
                                                />
                                            )}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Weekly chart */}
                            {unitWeekly.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-3">{selectedUnit} — Week by Week</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={unitWeekly} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                            <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                            <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey={effField}
                                                name={effLabel}
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                                activeDot={{ r: 5 }}
                                                connectNulls
                                            />
                                            {refLineValue && (
                                                <ReferenceLine
                                                    y={refLineValue}
                                                    stroke="#16a34a"
                                                    strokeDasharray="5 5"
                                                    strokeWidth={2}
                                                    label={{
                                                        value: isReefer ? `Avg L/hr: ${formatNumber(refLineValue, 2)}` : `Norm: ${formatNumber(refLineValue, 2)}`,
                                                        position: 'insideTopRight',
                                                        fill: '#16a34a',
                                                        fontSize: 11,
                                                    }}
                                                />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Monthly data table */}
                            {unitMonthly.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-3">{selectedUnit} — Monthly Data</h4>
                                    <div className="overflow-x-auto border rounded-lg">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50 text-xs">
                                                    <th className="text-left py-2.5 px-3 font-medium">Month</th>
                                                    <th className="text-right py-2.5 px-3 font-medium">Litres</th>
                                                    <th className="text-right py-2.5 px-3 font-medium">{activityLabel}</th>
                                                    <th className="text-right py-2.5 px-3 font-medium">{effLabel}</th>
                                                    <th className="text-right py-2.5 px-3 font-medium">Cost</th>
                                                    <th className="text-right py-2.5 px-3 font-medium">Fills</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {unitMonthly.map((p) => {
                                                    const effVal = isReefer ? p.litresPerHour : p.kmPerLitre;
                                                    const actVal = isReefer ? p.totalHours : p.totalKm;
                                                    // Colour-code: truck km/L green if above norm min; reefer L/hr green if below avg (lower = better)
                                                    let effClass = '';
                                                    if (effVal != null) {
                                                        if (!isReefer && unitStats?.norm) {
                                                            effClass = effVal >= unitStats.norm.min_acceptable ? 'text-green-600' : 'text-red-600';
                                                        }
                                                    }
                                                    return (
                                                        <tr key={p.month} className="border-t hover:bg-muted/30">
                                                            <td className="py-2 px-3 font-medium">{p.monthLabel}</td>
                                                            <td className="py-2 px-3 text-right tabular-nums">{formatNumber(p.totalLitres)} L</td>
                                                            <td className="py-2 px-3 text-right tabular-nums">
                                                                {isReefer ? formatNumber(actVal, 1) : formatNumber(actVal)}
                                                                {isReefer ? ' hrs' : ''}
                                                            </td>
                                                            <td className="py-2 px-3 text-right tabular-nums font-medium">
                                                                {effVal != null ? (
                                                                    <span className={effClass}>{formatNumber(effVal, 2)}</span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(p.totalCost)}</td>
                                                            <td className="py-2 px-3 text-right tabular-nums">{p.fillCount}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DieselConsumptionCharts;
