import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type {
  DailyPunctualityRow,
  WeeklyPunctualityRow,
  DelayBarRow,
} from "./types";
import { cn } from "@/lib/utils";
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

interface PunctualityTabProps {
  dailyPunctuality: DailyPunctualityRow[];
  weeklyPunctuality: WeeklyPunctualityRow[];
  _originDelayChartData: DelayBarRow[];
  _destinationDelayChartData: DelayBarRow[];
  delaySummary: {
    topOrigins: [string, number][];
    topDests: [string, number][];
  };
}

// Constants
const VARIANCE_THRESHOLDS = {
  early: -5,
  onTime: 15,
  slightlyLate: 30,
} as const;

const TABLE_COLUMN_CONFIG = [
  { key: "originArrivalAvg", label: "Origin Arrival" },
  { key: "originDepartureAvg", label: "Origin Departure" },
  { key: "destArrivalAvg", label: "Dest Arrival" },
  { key: "destDepartureAvg", label: "Dest Departure" },
] as const;

const LEGEND_ITEMS = [
  { color: "bg-emerald-500", label: "On time: ≤15 min variance" },
  { color: "bg-amber-500", label: "Slightly late: 16-30 min" },
  { color: "bg-red-500", label: "Late: >30 min" },
  { color: "bg-blue-500", label: "Early: ≤-5 min" },
] as const;

// Type definitions
type PunctualityRow = DailyPunctualityRow | WeeklyPunctualityRow;
type VarianceKey =
  | "originArrivalAvg"
  | "originDepartureAvg"
  | "destArrivalAvg"
  | "destDepartureAvg";

interface DelaySummaryCardProps {
  title: string;
  icon: React.ReactNode;
  badgeColor: string;
  locations: [string, number][];
}

// Utility functions
function getVarianceCategory(variance: number | null | undefined): {
  variant: "outline" | "default" | "destructive" | "secondary";
  className: string;
  label: string;
} {
  if (variance === null || variance === undefined) {
    return {
      variant: "outline",
      className: "text-muted-foreground",
      label: "No data",
    };
  }

  if (variance <= VARIANCE_THRESHOLDS.early) {
    return {
      variant: "default",
      className: "bg-blue-500 hover:bg-blue-600 text-white border-0",
      label: "Early",
    };
  }

  if (variance <= VARIANCE_THRESHOLDS.onTime) {
    return {
      variant: "default",
      className: "bg-emerald-500 hover:bg-emerald-600 text-white border-0",
      label: "On time",
    };
  }

  if (variance <= VARIANCE_THRESHOLDS.slightlyLate) {
    return {
      variant: "default",
      className: "bg-amber-500 hover:bg-amber-600 text-white border-0",
      label: "Slightly late",
    };
  }

  return {
    variant: "default",
    className: "bg-red-500 hover:bg-red-600 text-white border-0",
    label: "Late",
  };
}

function formatVariance(variance: number | null | undefined): string {
  if (variance === null || variance === undefined) return "—";
  const prefix = variance > 0 ? "+" : "";
  return `${prefix}${variance} min`;
}

function getVarianceColor(
  variance: number | null | undefined,
): string {
  if (variance === null || variance === undefined) return "";
  return variance > VARIANCE_THRESHOLDS.onTime
    ? "text-red-500 font-medium"
    : "";
}

function getDelayBadgeStyles(count: number, color: string): {
  variant: "destructive" | "secondary";
  className: string;
} {
  return {
    variant: count > 0 ? "destructive" : "secondary",
    className: count > 0 ? `bg-${color}-500 hover:bg-${color}-600` : "",
  };
}

// Reusable components
function VarianceCell({
  variance,
  showBadge = true,
}: {
  variance: number | null | undefined;
  showBadge?: boolean;
}) {
  const category = getVarianceCategory(variance);

  return (
    <TableCell>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-sm", getVarianceColor(variance))}>
          {formatVariance(variance)}
        </span>
        {showBadge && (
          <Badge variant={category.variant} className={category.className}>
            {category.label}
          </Badge>
        )}
      </div>
    </TableCell>
  );
}

function DelayCountCell({
  count,
  color,
}: {
  count: number;
  color: "amber" | "red";
}) {
  const { variant, className } = getDelayBadgeStyles(count, color);

  return (
    <TableCell>
      <Badge variant={variant} className={className}>
        {count}
      </Badge>
    </TableCell>
  );
}

function PunctualityTable({
  title,
  icon,
  data,
  idKey,
  renderDateColumn,
  maxRows,
}: {
  title: string;
  icon: React.ReactNode;
  data: PunctualityRow[];
  idKey: "date" | "week";
  renderDateColumn: (row: PunctualityRow) => React.ReactNode;
  maxRows?: number;
}) {
  const displayData = maxRows ? data.slice(0, maxRows) : data;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="rounded-md border max-h-96 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead className="font-semibold">
                  {idKey === "date" ? "Date" : "Week"}
                </TableHead>
                <TableHead className="font-semibold">Loads</TableHead>
                {TABLE_COLUMN_CONFIG.map(({ key, label }) => (
                  <TableHead key={key} className="font-semibold">
                    {label}
                  </TableHead>
                ))}
                <TableHead className="font-semibold">Origin Delays</TableHead>
                <TableHead className="font-semibold">Dest Delays</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row) => (
                <TableRow
                  key={(row as unknown as Record<string, unknown>)[idKey] as string}
                  className="hover:bg-muted/30"
                >
                  <TableCell className="font-medium">
                    {renderDateColumn(row)}
                  </TableCell>
                  <TableCell>{row.loads}</TableCell>
                  {TABLE_COLUMN_CONFIG.map(({ key }) => (
                    <VarianceCell
                      key={key}
                      variance={
                        row[key as VarianceKey] as number | null | undefined
                      }
                    />
                  ))}
                  <DelayCountCell
                    count={row.originDelayCount}
                    color="amber"
                  />
                  <DelayCountCell
                    count={row.destDelayCount}
                    color="red"
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DelaySummaryCard({
  title,
  icon,
  badgeColor,
  locations,
}: DelaySummaryCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {locations.length > 0 ? (
            locations.map(([location, minutes]) => (
              <div
                key={location}
                className="flex justify-between items-center group"
              >
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {location}
                </span>
                <Badge
                  variant="destructive"
                  className={`bg-${badgeColor}-500 hover:bg-${badgeColor}-600`}
                >
                  {Math.round(minutes)} min
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No delay data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryFooter() {
  return (
    <Card className="bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/30">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          {LEGEND_ITEMS.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PunctualityTab({
  dailyPunctuality,
  weeklyPunctuality,
  _originDelayChartData,
  _destinationDelayChartData,
  delaySummary,
}: PunctualityTabProps) {
  const hasData = dailyPunctuality.length > 0 || weeklyPunctuality.length > 0;

  return (
    <div className="space-y-6">
      {/* Daily Punctuality Table */}
      <PunctualityTable
        title="Daily Punctuality Analysis"
        icon={<CalendarDaysIcon className="h-5 w-5 text-indigo-500" />}
        data={dailyPunctuality}
        idKey="date"
        renderDateColumn={(row) => (row as DailyPunctualityRow).date}
        maxRows={30}
      />

      {/* Weekly Punctuality Table */}
      <PunctualityTable
        title="Weekly Punctuality Summary"
        icon={<ChartBarIcon className="h-5 w-5 text-emerald-500" />}
        data={weeklyPunctuality}
        idKey="week"
        renderDateColumn={(row) => (row as WeeklyPunctualityRow).week}
      />

      {/* Delay Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DelaySummaryCard
          title="Top Origin Delay Locations"
          icon={<TruckIcon className="h-4 w-4 text-amber-500" />}
          badgeColor="amber"
          locations={delaySummary.topOrigins}
        />
        <DelaySummaryCard
          title="Top Destination Delay Locations"
          icon={<MapPinIcon className="h-4 w-4 text-red-500" />}
          badgeColor="red"
          locations={delaySummary.topDests}
        />
      </div>

      {/* Summary Footer */}
      {hasData && <SummaryFooter />}
    </div>
  );
}