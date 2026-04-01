import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DailyPunctualityRow, WeeklyPunctualityRow, DelayBarRow } from "./types";
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

export function PunctualityTab({
  dailyPunctuality,
  weeklyPunctuality,
  _originDelayChartData,
  _destinationDelayChartData,
  delaySummary,
}: PunctualityTabProps) {
  const getVarianceBadge = (variance: number | null | undefined) => {
    if (variance === null || variance === undefined) {
      return <Badge variant="outline" className="text-muted-foreground">No data</Badge>;
    }
    if (variance <= -5) {
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0">Early</Badge>;
    }
    if (variance <= 15) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">On time</Badge>;
    }
    if (variance <= 30) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">Slightly late</Badge>;
    }
    return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">Late</Badge>;
  };

  const formatVariance = (variance: number | null | undefined): string => {
    if (variance === null || variance === undefined) return '—';
    const prefix = variance > 0 ? '+' : '';
    return `${prefix}${variance} min`;
  };

  return (
    <div className="space-y-6">
      {/* Daily Punctuality Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-indigo-500" />
            Daily Punctuality Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-md border max-h-96 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Loads</TableHead>
                  <TableHead className="font-semibold">Origin Arrival</TableHead>
                  <TableHead className="font-semibold">Origin Departure</TableHead>
                  <TableHead className="font-semibold">Dest Arrival</TableHead>
                  <TableHead className="font-semibold">Dest Departure</TableHead>
                  <TableHead className="font-semibold">Origin Delays</TableHead>
                  <TableHead className="font-semibold">Dest Delays</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyPunctuality.slice(0, 30).map((row) => (
                  <TableRow key={row.date} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell>{row.loads}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm",
                          row.originArrivalAvg != null && row.originArrivalAvg > 15 && "text-red-500 font-medium"
                        )}>
                          {formatVariance(row.originArrivalAvg)}
                        </span>
                        {getVarianceBadge(row.originArrivalAvg)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm",
                          row.originDepartureAvg != null && row.originDepartureAvg > 15 && "text-red-500 font-medium"
                        )}>
                          {formatVariance(row.originDepartureAvg)}
                        </span>
                        {getVarianceBadge(row.originDepartureAvg)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm",
                          row.destArrivalAvg != null && row.destArrivalAvg > 15 && "text-red-500 font-medium"
                        )}>
                          {formatVariance(row.destArrivalAvg)}
                        </span>
                        {getVarianceBadge(row.destArrivalAvg)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm",
                          row.destDepartureAvg != null && row.destDepartureAvg > 15 && "text-red-500 font-medium"
                        )}>
                          {formatVariance(row.destDepartureAvg)}
                        </span>
                        {getVarianceBadge(row.destDepartureAvg)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.originDelayCount > 0 ? "destructive" : "secondary"}
                        className={row.originDelayCount > 0 ? "bg-amber-500 hover:bg-amber-600" : ""}
                      >
                        {row.originDelayCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.destDelayCount > 0 ? "destructive" : "secondary"}
                        className={row.destDelayCount > 0 ? "bg-red-500 hover:bg-red-600" : ""}
                      >
                        {row.destDelayCount}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Punctuality Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-emerald-500" />
            Weekly Punctuality Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-md border max-h-96 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="font-semibold">Week</TableHead>
                  <TableHead className="font-semibold">Loads</TableHead>
                  <TableHead className="font-semibold">Avg Origin Arrival</TableHead>
                  <TableHead className="font-semibold">Avg Origin Departure</TableHead>
                  <TableHead className="font-semibold">Avg Dest Arrival</TableHead>
                  <TableHead className="font-semibold">Avg Dest Departure</TableHead>
                  <TableHead className="font-semibold">Origin Delays</TableHead>
                  <TableHead className="font-semibold">Dest Delays</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyPunctuality.map((row) => (
                  <TableRow key={row.week} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{row.week}</TableCell>
                    <TableCell>{row.loads}</TableCell>
                    <TableCell className={cn(
                      "font-mono",
                      row.originArrivalAvg != null && row.originArrivalAvg > 15 ? "text-red-500 font-bold" : "text-muted-foreground"
                    )}>
                      {formatVariance(row.originArrivalAvg)}
                    </TableCell>
                    <TableCell className={cn(
                      "font-mono",
                      row.originDepartureAvg != null && row.originDepartureAvg > 15 ? "text-red-500 font-bold" : "text-muted-foreground"
                    )}>
                      {formatVariance(row.originDepartureAvg)}
                    </TableCell>
                    <TableCell className={cn(
                      "font-mono",
                      row.destArrivalAvg != null && row.destArrivalAvg > 15 ? "text-red-500 font-bold" : "text-muted-foreground"
                    )}>
                      {formatVariance(row.destArrivalAvg)}
                    </TableCell>
                    <TableCell className={cn(
                      "font-mono",
                      row.destDepartureAvg != null && row.destDepartureAvg > 15 ? "text-red-500 font-bold" : "text-muted-foreground"
                    )}>
                      {formatVariance(row.destDepartureAvg)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.originDelayCount > 0 ? "destructive" : "secondary"}
                        className={row.originDelayCount > 0 ? "bg-amber-500 hover:bg-amber-600" : ""}
                      >
                        {row.originDelayCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.destDelayCount > 0 ? "destructive" : "secondary"}
                        className={row.destDelayCount > 0 ? "bg-red-500 hover:bg-red-600" : ""}
                      >
                        {row.destDelayCount}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delay Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-amber-500" />
              Top Origin Delay Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {delaySummary.topOrigins.length > 0 ? (
                delaySummary.topOrigins.map(([location, minutes]) => (
                  <div key={location} className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {location}
                    </span>
                    <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600">
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

        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-red-500" />
              Top Destination Delay Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {delaySummary.topDests.length > 0 ? (
                delaySummary.topDests.map(([location, minutes]) => (
                  <div key={location} className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {location}
                    </span>
                    <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
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
      </div>

      {/* Summary Footer */}
      {(dailyPunctuality.length > 0 || weeklyPunctuality.length > 0) && (
        <Card className="bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span>On time: ≤15 min variance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>Slightly late: 16-30 min</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Late: {'>'}30 min</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Early: ≤-5 min</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}