import { CustomTooltip } from "@/components/reports/ChartTooltips";
import type {
  DayOfWeekData,
  DelayBarRow,
  LocationVariance,
  TimeVarianceAnalysis,
  TimeVarianceData,
} from "@/components/reports/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { Load } from "@/hooks/useTrips";
import { exportPunctualityToExcel } from "@/lib/exportPunctualityToExcel";
import { exportPunctualityToPdf } from "@/lib/exportReportsToPdf";
import {
  ChartBarIcon,
  ClockIcon,
  MapIcon,
  PresentationChartLineIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Constants
const CHART_HEIGHTS = {
  pie: 320,
  bar: 320,
  barLarge: 350,
  trend: 320,
} as const;

const CHART_MARGINS = {
  default: { top: 10, right: 30, left: 0, bottom: 10 },
  vertical: { top: 10, right: 20, left: 20, bottom: 10 },
  route: { top: 10, right: 30, left: 20, bottom: 10 },
} as const;

const COLORS = {
  grid: "#e5e7eb",
  tick: "#6b7280",
  tickDark: "#374151",
  success: "#22c55e",
  successLight: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  warningDark: "#f97316",
  info: "#3b82f6",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  violetLight: "#a855f7",
} as const;

// Color-to-Tailwind class mapping
const FILL_TO_TEXT_CLASS: Record<string, string> = {
  "#22c55e": "text-emerald-600",
  "#10b981": "text-emerald-500",
  "#3b82f6": "text-blue-600",
  "#8b5cf6": "text-violet-600",
  "#f59e0b": "text-amber-600",
  "#f97316": "text-orange-600",
  "#ef4444": "text-red-600",
  "#06b6d4": "text-cyan-600",
  "#0ea5e9": "text-sky-500",
} as const;

const getFillTextClass = (hex?: string): string => {
  if (!hex) return "";
  return FILL_TO_TEXT_CLASS[hex.toLowerCase()] || "";
};

// Summary card configuration
interface SummaryCardConfig {
  key: string;
  title: string;
  gradient: string;
  border: string;
  titleColor: string;
  valueColor: string;
  value: string | number;
  subtitle: string;
}

// Reusable components
function SummaryCard({ config }: { config: SummaryCardConfig }) {
  return (
    <Card
      className={`bg-gradient-to-br ${config.gradient} ${config.border} shadow-sm`}
    >
      <CardContent className="pt-6 pb-5">
        <div className="space-y-2">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${config.titleColor}`}
          >
            {config.title}
          </p>
          <p className={`text-4xl font-bold ${config.valueColor}`}>
            {config.value}
          </p>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="h-[320px] flex items-center justify-center">
      <p className="text-muted-foreground text-center">
        {message}
        {hint && (
          <>
            <br />
            <span className="text-sm">{hint}</span>
          </>
        )}
      </p>
    </div>
  );
}

function PerformanceLegend({
  noDataCount,
}: {
  noDataCount: number;
}) {
  const legendItems = [
    { color: "bg-emerald-500", label: "On Time", description: "Within 15 min of planned" },
    { color: "bg-blue-500", label: "Early", description: "More than 5 min before" },
    { color: "bg-amber-500", label: "Slightly Late", description: "15-30 min after planned" },
    { color: "bg-red-500", label: "Late", description: "Over 30 min after planned" },
  ];

  return (
    <Card className="bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/30">
      <CardContent className="pt-6 pb-5">
        <div className="flex flex-wrap items-center justify-center gap-6">
          {legendItems.map(({ color, label, description }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${color}`} />
              <span className="text-sm">
                <span className="font-medium">{label}:</span> {description}
              </span>
            </div>
          ))}
        </div>
        {noDataCount > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            {noDataCount} delivered loads have incomplete time data
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface TimeAnalysisTabProps {
  timeVarianceAnalysis: TimeVarianceAnalysis;
  dayOfWeekDistribution: DayOfWeekData[];
  originDelayChartData: DelayBarRow[];
  destinationDelayChartData: DelayBarRow[];
  periodPunctualityData: Array<{
    week: string;
    loads: number;
    originDelayCount: number;
    destDelayCount: number;
  }>;
  trendLabel?: "Weekly" | "Monthly";
  filteredLoads: Load[];
  timeRange: "3months" | "6months" | "12months";
}

export function TimeAnalysisTab({
  timeVarianceAnalysis,
  dayOfWeekDistribution,
  originDelayChartData,
  destinationDelayChartData,
  periodPunctualityData,
  trendLabel = "Weekly",
  filteredLoads,
  timeRange,
}: TimeAnalysisTabProps) {
  const trendKey = trendLabel.toLowerCase();

  const summaryCards = useMemo<SummaryCardConfig[]>(
    () => [
      {
        key: "onTime",
        title: "On-Time Rate",
        gradient: "from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
        border: "border-emerald-200/50 dark:border-emerald-800/30",
        titleColor: "text-emerald-600/70 dark:text-emerald-400/70",
        valueColor: "text-emerald-700 dark:text-emerald-300",
        value: `${timeVarianceAnalysis.onTimeRate}%`,
        subtitle: `${timeVarianceAnalysis.onTimeCount + timeVarianceAnalysis.earlyCount} of ${timeVarianceAnalysis.totalAnalyzed} loads`,
      },
      {
        key: "departure",
        title: "Avg Departure Variance",
        gradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
        border: "border-blue-200/50 dark:border-blue-800/30",
        titleColor: "text-blue-600/70 dark:text-blue-400/70",
        valueColor: "text-blue-700 dark:text-blue-300",
        value: `${timeVarianceAnalysis.avgOriginVariance > 0 ? "+" : ""}${timeVarianceAnalysis.avgOriginVariance}`,
        subtitle: "minutes from planned",
      },
      {
        key: "arrival",
        title: "Avg Arrival Variance",
        gradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
        border: "border-violet-200/50 dark:border-violet-800/30",
        titleColor: "text-violet-600/70 dark:text-violet-400/70",
        valueColor: "text-violet-700 dark:text-violet-300",
        value: `${timeVarianceAnalysis.avgDestVariance > 0 ? "+" : ""}${timeVarianceAnalysis.avgDestVariance}`,
        subtitle: "minutes from planned",
      },
      {
        key: "late",
        title: "Late Deliveries",
        gradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
        border: "border-amber-200/50 dark:border-amber-800/30",
        titleColor: "text-amber-600/70 dark:text-amber-400/70",
        valueColor: "text-amber-700 dark:text-amber-300",
        value: timeVarianceAnalysis.lateCount,
        subtitle: "loads over 15 mins late",
      },
    ],
    [timeVarianceAnalysis],
  );

  const hasRoutePerformance =
    timeVarianceAnalysis.routePerformance.length > 0;

  return (
    <TabsContent value="time" className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((config) => (
          <SummaryCard key={config.key} config={config} />
        ))}
      </div>

      {/* Period Punctuality Trend */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <PresentationChartLineIcon className="h-5 w-5 text-indigo-500" />
            {trendLabel} Punctuality Trend
          </CardTitle>
          <CardDescription>
            Delays and load volume over time ({trendKey})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`h-[${CHART_HEIGHTS.trend}px]`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={periodPunctualityData}
                margin={CHART_MARGINS.default}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={COLORS.grid}
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: COLORS.tick, fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: COLORS.tick, fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="loads"
                  name="Loads"
                  fill={COLORS.indigo}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="originDelayCount"
                  name="Origin Delays"
                  fill={COLORS.warning}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="destDelayCount"
                  name="Destination Delays"
                  fill={COLORS.danger}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Performance Distribution */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-emerald-500" />
              Delivery Performance
            </CardTitle>
            <CardDescription>
              Planned vs actual arrival time distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeVarianceAnalysis.distribution.length > 0 ? (
              <div className={`h-[${CHART_HEIGHTS.pie}px]`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={timeVarianceAnalysis.distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="count"
                      stroke="none"
                    >
                      {timeVarianceAnalysis.distribution.map(
                        (entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ),
                      )}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const data = payload[0].payload as TimeVarianceData;
                          return (
                            <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-4 py-3 shadow-xl">
                              <p
                                className={`font-semibold ${getFillTextClass(data.fill)}`}
                              >
                                {data.category}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {data.count} loads ({data.percentage}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ paddingTop: "20px" }}
                      formatter={(value) => {
                        const item =
                          timeVarianceAnalysis.distribution.find(
                            (d) => d.category === value,
                          );
                        return `${value} (${item?.percentage ?? 0}%)`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                message="No delivery time data available."
                hint="Complete deliveries with actual times to see analysis."
              />
            )}
          </CardContent>
        </Card>

        {/* Day of Week Distribution */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-cyan-500" />
              Load Scheduling by Day
            </CardTitle>
            <CardDescription>
              Volume distribution across weekdays
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`h-[${CHART_HEIGHTS.bar}px]`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dayOfWeekDistribution}
                  margin={CHART_MARGINS.default}
                >
                  <defs>
                    <linearGradient
                      id="dayGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={COLORS.violet} />
                      <stop offset="100%" stopColor={COLORS.violetLight} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={COLORS.grid}
                    opacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.tick, fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.tick, fontSize: 12 }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  />
                  <Bar
                    dataKey="loads"
                    name="Load Count"
                    fill="url(#dayGradient)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Route Performance */}
      {hasRoutePerformance && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-indigo-500" />
              Destination Performance
            </CardTitle>
            <CardDescription>
              Average time variance by destination (positive = late,
              negative = early)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`h-[${CHART_HEIGHTS.barLarge}px]`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timeVarianceAnalysis.routePerformance}
                  layout="vertical"
                  margin={CHART_MARGINS.route}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={COLORS.grid}
                    opacity={0.4}
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.tick, fontSize: 12 }}
                    tickFormatter={(value) =>
                      `${value > 0 ? "+" : ""}${value} min`
                    }
                    domain={["dataMin - 10", "dataMax + 10"]}
                  />
                  <YAxis
                    dataKey="location"
                    type="category"
                    width={120}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.tickDark, fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const data = payload[0].payload as LocationVariance;
                        return (
                          <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-4 py-3 shadow-xl">
                            <p className="font-semibold text-foreground mb-2">
                              {data.location}
                            </p>
                            <div className="space-y-1 text-sm">
                              <p>
                                Avg Variance:{" "}
                                <span
                                  className={
                                    data.avgVariance > 0
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }
                                >
                                  {data.avgVariance > 0 ? "+" : ""}
                                  {data.avgVariance} min
                                </span>
                              </p>
                              <p className="text-green-600">
                                On Time: {data.onTimeCount}
                              </p>
                              <p className="text-blue-600">
                                Early: {data.earlyCount}
                              </p>
                              <p className="text-red-600">
                                Late: {data.lateCount}
                              </p>
                              <p className="text-muted-foreground">
                                Total: {data.totalLoads} loads
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  />
                  <Bar
                    dataKey="avgVariance"
                    name="Avg Variance (min)"
                    radius={[0, 6, 6, 0]}
                    barSize={24}
                  >
                    {timeVarianceAnalysis.routePerformance.map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.avgVariance >= 0
                              ? COLORS.danger
                              : COLORS.success
                          }
                        />
                      ),
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Buttons & Delay Charts */}
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportPunctualityToExcel(filteredLoads, timeRange)}
        >
          Export Excel (Punctuality)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportPunctualityToPdf(filteredLoads, timeRange)}
        >
          Export PDF (Punctuality)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Origin Delays */}
        <DelayChartCard
          title="Origin Delays (by name)"
          description="Late arrivals and departures (over 15 min)"
          icon={<TruckIcon className="h-5 w-5 text-amber-500" />}
          data={originDelayChartData}
          bars={[
            { dataKey: "arrLate", name: "Late Arrivals", fill: COLORS.warning },
            { dataKey: "depLate", name: "Late Departures", fill: COLORS.danger },
          ]}
        />

        {/* Destination Delays */}
        <DelayChartCard
          title="Destination Delays (by name)"
          description="Late arrivals and departures (over 15 min)"
          icon={<MapIcon className="h-5 w-5 text-blue-500" />}
          data={destinationDelayChartData}
          bars={[
            { dataKey: "arrLate", name: "Late Arrivals", fill: COLORS.info },
            { dataKey: "depLate", name: "Late Departures", fill: COLORS.violet },
          ]}
        />
      </div>

      {/* Performance Legend */}
      <PerformanceLegend noDataCount={timeVarianceAnalysis.noDataCount} />
    </TabsContent>
  );
}

// Delay chart configuration
interface DelayBarConfig {
  dataKey: string;
  name: string;
  fill: string;
}

function DelayChartCard({
  title,
  description,
  icon,
  data,
  bars,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  data: DelayBarRow[];
  bars: DelayBarConfig[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`h-[${CHART_HEIGHTS.barLarge}px]`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={CHART_MARGINS.vertical}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.grid}
                opacity={0.4}
                horizontal
                vertical={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: COLORS.tick, fontSize: 12 }}
              />
              <YAxis
                dataKey="location"
                type="category"
                width={150}
                axisLine={false}
                tickLine={false}
                tick={{ fill: COLORS.tickDark, fontSize: 11 }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Legend />
              {bars.map((bar) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.name}
                  stackId="a"
                  fill={bar.fill}
                  barSize={20}
                  radius={[0, 6, 6, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}