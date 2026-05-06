import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportBackloadToExcel,
  exportBackloadToPdf,
  type BackloadExportData,
  type BackloadExportView,
} from "@/lib/exportBackload";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { CustomTooltip, PieTooltip } from "@/components/reports/ChartTooltips";
import type {
  BackloadCargoTypeData,
  BackloadDestinationData,
  BackloadDistribution,
  BackloadMovement,
  BackloadRouteAnalysisItem,
  BackloadSummaryStats,
  BackloadWeeklyTrend,
} from "@/components/reports/types";
import {
  CubeIcon,
  CubeTransparentIcon,
  DocumentChartBarIcon,
  MapIcon,
  PresentationChartLineIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
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

interface BackloadAnalyticsTabProps {
  backloadSummaryStats: BackloadSummaryStats;
  backloadMovements: BackloadMovement[];
  backloadPackagingDistribution: BackloadDistribution[];
  backloadStatusDistribution: BackloadDistribution[];
  backloadDestinationDistribution: BackloadDestinationData[];
  backloadWeeklyTrend: BackloadWeeklyTrend[];
  trendLabel?: "Weekly" | "Monthly";
  backloadRouteAnalysis: BackloadRouteAnalysisItem[];
  backloadCargoTypeDistribution: BackloadCargoTypeData[];
}

// Constants
const CHART_HEIGHTS = {
  pie: 320,
  bar: 350,
  barLarge: 400,
  barSmall: 300,
  area: 350,
} as const;

const CHART_MARGINS = {
  default: { top: 10, right: 30, left: 0, bottom: 10 },
  vertical: { top: 10, right: 30, left: 20, bottom: 10 },
} as const;

const COLORS = {
  grid: "#e5e7eb",
  tick: "#6b7280",
  tickDark: "#374151",
  purple: "#8b5cf6",
  purpleLight: "#a855f7",
  cyan: "#06b6d4",
  cyanDark: "#0891b2",
  amber: "#f59e0b",
  amberDark: "#d97706",
  indigo: "#6366f1",
} as const;

// Packaging type configuration
interface PackagingTypeConfig {
  key: string;
  label: string;
  color: string;
  gradientId: string;
  areaGradientId: string;
}

const PACKAGING_TYPES: PackagingTypeConfig[] = [
  {
    key: "bins",
    label: "Bins",
    color: COLORS.purple,
    gradientId: "binsGradient",
    areaGradientId: "binsAreaGradient",
  },
  {
    key: "crates",
    label: "Crates",
    color: COLORS.cyan,
    gradientId: "cratesGradient",
    areaGradientId: "cratesAreaGradient",
  },
  {
    key: "pallets",
    label: "Pallets",
    color: COLORS.amber,
    gradientId: "palletsGradient",
    areaGradientId: "palletsAreaGradient",
  },
] as const;

// Summary card configuration
interface SummaryCardConfig {
  key: string;
  title: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  iconColor: string;
  titleColor: string;
  valueColor: string;
  value: string | number;
  subtitle: string;
}

interface PackagingBreakdownCardConfig {
  key: string;
  label: string;
  value: string;
  gradient: string;
  border: string;
  textColor: string;
}

// Reusable components
function SummaryCard({ config }: { config: SummaryCardConfig }) {
  return (
    <Card
      className={`bg-gradient-to-br ${config.gradient} ${config.border} shadow-sm`}
    >
      <CardContent className="pt-6 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {config.icon}
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${config.titleColor}`}
            >
              {config.title}
            </p>
          </div>
          <p className={`text-4xl font-bold ${config.valueColor}`}>
            {config.value}
          </p>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PackagingBreakdownCard({
  config,
}: {
  config: PackagingBreakdownCardConfig;
}) {
  return (
    <Card
      className={`bg-gradient-to-br ${config.gradient} ${config.border}`}
    >
      <CardContent className="pt-5 pb-4 text-center">
        <p className={`text-3xl font-bold ${config.textColor}`}>
          {config.value}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{config.label}</p>
      </CardContent>
    </Card>
  );
}

function PieDistributionChart({
  data,
}: {
  data: BackloadDistribution[];
}) {
  return (
    <div style={{ height: CHART_HEIGHTS.pie }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: "20px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function PackagingGradientDefs() {
  return (
    <defs>
      {PACKAGING_TYPES.map(({ gradientId, color }) => (
        <linearGradient
          key={gradientId}
          id={gradientId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
        </linearGradient>
      ))}
      {PACKAGING_TYPES.map(({ areaGradientId, color }) => (
        <linearGradient
          key={areaGradientId}
          id={areaGradientId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      ))}
    </defs>
  );
}

function PackagingLegend() {
  const legendItems = [
    { color: "bg-purple-500", label: "Bins", description: "Standard packaging bins" },
    { color: "bg-cyan-500", label: "Crates", description: "Reusable crates" },
    { color: "bg-amber-500", label: "Pallets", description: "Shipping pallets" },
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
        <p className="text-center text-sm text-muted-foreground mt-4">
          Backload operations return empty packaging from delivery
          destinations to farm locations
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/30">
      <CardContent className="pt-12 pb-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <CubeIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              No Backload Data Available
            </h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              There are no backload packaging movements recorded in the
              selected time range. Backload data is captured when loads
              include return packaging information.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BackloadAnalyticsTab({
  backloadSummaryStats,
  backloadMovements,
  backloadPackagingDistribution,
  backloadStatusDistribution,
  backloadDestinationDistribution,
  backloadWeeklyTrend,
  trendLabel = "Weekly",
  backloadRouteAnalysis,
  backloadCargoTypeDistribution,
}: BackloadAnalyticsTabProps) {
  const trendKey = trendLabel.toLowerCase();
  const hasMovements = backloadMovements.length > 0;
  const hasRouteAnalysis = backloadRouteAnalysis.length > 0;
  const hasCargoTypes = backloadCargoTypeDistribution.length > 0;

  const exportData: BackloadExportData = {
    summary: backloadSummaryStats,
    movements: backloadMovements,
    packagingDistribution: backloadPackagingDistribution,
    statusDistribution: backloadStatusDistribution,
    destinationDistribution: backloadDestinationDistribution,
    routeAnalysis: backloadRouteAnalysis,
    cargoTypeDistribution: backloadCargoTypeDistribution,
  };

  const handleExportPdf = (view: BackloadExportView) => exportBackloadToPdf(exportData, view);
  const handleExportExcel = (view: BackloadExportView) => exportBackloadToExcel(exportData, view);

  const ExportControls = () => (
    <div className="flex justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export PDF
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Backload Report</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExportPdf("total")}>Total Summary</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportPdf("week")}>By Week</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportPdf("month")}>By Month</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Excel
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Backload Workbook</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExportExcel("total")}>Total Summary</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportExcel("week")}>By Week</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportExcel("month")}>By Month</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const summaryCards = useMemo<SummaryCardConfig[]>(
    () => [
      {
        key: "movements",
        title: "Total Movements",
        icon: <TruckIcon className="h-4 w-4 text-violet-500" />,
        gradient:
          "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
        border: "border-violet-200/50 dark:border-violet-800/30",
        iconColor: "text-violet-500",
        titleColor: "text-violet-600/70 dark:text-violet-400/70",
        valueColor: "text-violet-700 dark:text-violet-300",
        value: backloadSummaryStats.totalMovements,
        subtitle: "backload operations",
      },
      {
        key: "packaging",
        title: "Total Packaging",
        icon: <CubeIcon className="h-4 w-4 text-cyan-500" />,
        gradient:
          "from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30",
        border: "border-cyan-200/50 dark:border-cyan-800/30",
        iconColor: "text-cyan-500",
        titleColor: "text-cyan-600/70 dark:text-cyan-400/70",
        valueColor: "text-cyan-700 dark:text-cyan-300",
        value: backloadSummaryStats.totalPackaging.toLocaleString(),
        subtitle: "bins, crates & pallets",
      },
      {
        key: "delivery",
        title: "Delivery Rate",
        icon: <PresentationChartLineIcon className="h-4 w-4 text-emerald-500" />,
        gradient:
          "from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
        border: "border-emerald-200/50 dark:border-emerald-800/30",
        iconColor: "text-emerald-500",
        titleColor: "text-emerald-600/70 dark:text-emerald-400/70",
        valueColor: "text-emerald-700 dark:text-emerald-300",
        value: `${backloadSummaryStats.deliveryRate}%`,
        subtitle: `${backloadSummaryStats.deliveredCount} delivered`,
      },
      {
        key: "destinations",
        title: "Destinations",
        icon: <MapIcon className="h-4 w-4 text-amber-500" />,
        gradient:
          "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
        border: "border-amber-200/50 dark:border-amber-800/30",
        iconColor: "text-amber-500",
        titleColor: "text-amber-600/70 dark:text-amber-400/70",
        valueColor: "text-amber-700 dark:text-amber-300",
        value: backloadSummaryStats.uniqueDestinations,
        subtitle: "unique farms/locations",
      },
    ],
    [backloadSummaryStats],
  );

  const packagingBreakdown = useMemo<PackagingBreakdownCardConfig[]>(
    () => [
      {
        key: "bins",
        label: "Bins",
        value: backloadSummaryStats.totalBins.toLocaleString(),
        gradient:
          "from-purple-100/50 to-violet-100/50 dark:from-purple-900/20 dark:to-violet-900/20",
        border: "border-purple-200/50 dark:border-purple-800/30",
        textColor: "text-purple-600 dark:text-purple-400",
      },
      {
        key: "crates",
        label: "Crates",
        value: backloadSummaryStats.totalCrates.toLocaleString(),
        gradient:
          "from-cyan-100/50 to-blue-100/50 dark:from-cyan-900/20 dark:to-blue-900/20",
        border: "border-cyan-200/50 dark:border-cyan-800/30",
        textColor: "text-cyan-600 dark:text-cyan-400",
      },
      {
        key: "pallets",
        label: "Pallets",
        value: backloadSummaryStats.totalPallets.toLocaleString(),
        gradient:
          "from-amber-100/50 to-yellow-100/50 dark:from-amber-900/20 dark:to-yellow-900/20",
        border: "border-amber-200/50 dark:border-amber-800/30",
        textColor: "text-amber-600 dark:text-amber-400",
      },
    ],
    [backloadSummaryStats],
  );

  if (!hasMovements) {
    return (
      <TabsContent value="backload" className="space-y-6">
        <ExportControls />
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryCards.map((config) => (
            <SummaryCard key={config.key} config={config} />
          ))}
        </div>

        {/* Packaging Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          {packagingBreakdown.map((config) => (
            <PackagingBreakdownCard key={config.key} config={config} />
          ))}
        </div>

        <EmptyState />
      </TabsContent>
    );
  }

  return (
    <TabsContent value="backload" className="space-y-6">
      <ExportControls />
      {/* Backload Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((config) => (
          <SummaryCard key={config.key} config={config} />
        ))}
      </div>

      {/* Packaging Breakdown Cards */}
      <div className="grid grid-cols-3 gap-4">
        {packagingBreakdown.map((config) => (
          <PackagingBreakdownCard key={config.key} config={config} />
        ))}
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Packaging Type Distribution */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CubeIcon className="h-5 w-5 text-purple-500" />
              Packaging Type Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of backload packaging by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PieDistributionChart data={backloadPackagingDistribution} />
          </CardContent>
        </Card>

        {/* Backload Status Distribution */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DocumentChartBarIcon className="h-5 w-5 text-blue-500" />
              Movement Status
            </CardTitle>
            <CardDescription>
              Current status of backload movements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PieDistributionChart data={backloadStatusDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Backload by Destination */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CubeTransparentIcon className="h-5 w-5 text-orange-500" />
            Packaging by Destination
          </CardTitle>
          <CardDescription>
            Backload packaging distribution across destination farms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: CHART_HEIGHTS.bar }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={backloadDestinationDistribution}
                margin={CHART_MARGINS.default}
              >
                <PackagingGradientDefs />
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={COLORS.grid}
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="destination"
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
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                {PACKAGING_TYPES.map(({ key, label, gradientId }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={label}
                    fill={`url(#${gradientId})`}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Backload Period Trend */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <PresentationChartLineIcon className="h-5 w-5 text-emerald-500" />
            {trendLabel} Packaging Movement Trends
          </CardTitle>
          <CardDescription>
            Backload packaging quantities over time ({trendKey})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: CHART_HEIGHTS.area }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={backloadWeeklyTrend}
                margin={CHART_MARGINS.default}
              >
                <PackagingGradientDefs />
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
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                {PACKAGING_TYPES.map(({ key, label, color, areaGradientId }) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={color}
                    fill={`url(#${areaGradientId})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Backload Route Analysis */}
      {hasRouteAnalysis && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-indigo-500" />
              Backload Route Analysis
            </CardTitle>
            <CardDescription>
              Top routes for backload packaging movements (delivery
              destination → backload farm)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: CHART_HEIGHTS.barLarge }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={backloadRouteAnalysis}
                  layout="vertical"
                  margin={CHART_MARGINS.vertical}
                >
                  <defs>
                    <linearGradient
                      id="routeBackloadGradient"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor={COLORS.indigo} />
                      <stop offset="100%" stopColor={COLORS.purple} />
                    </linearGradient>
                  </defs>
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
                  />
                  <YAxis
                    dataKey="route"
                    type="category"
                    width={200}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.tickDark, fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-4 py-3 shadow-xl">
                            <p className="font-semibold text-foreground mb-2">
                              {data.route}
                            </p>
                            <div className="space-y-1 text-sm">
                              <p>
                                Movements:{" "}
                                <span className="font-medium">
                                  {data.count}
                                </span>
                              </p>
                              <p className="text-purple-600">
                                Bins: {data.bins}
                              </p>
                              <p className="text-cyan-600">
                                Crates: {data.crates}
                              </p>
                              <p className="text-amber-600">
                                Pallets: {data.pallets}
                              </p>
                              <p className="text-muted-foreground">
                                Total: {data.totalPackaging} items
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
                    dataKey="count"
                    name="Movements"
                    fill="url(#routeBackloadGradient)"
                    radius={[0, 6, 6, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backload Cargo Type Distribution */}
      {hasCargoTypes && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-teal-500" />
              Backload Cargo Types
            </CardTitle>
            <CardDescription>
              Distribution of backload movements by cargo type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: CHART_HEIGHTS.barSmall }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={backloadCargoTypeDistribution}
                  margin={CHART_MARGINS.default}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={COLORS.grid}
                    opacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="cargoType"
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
                    dataKey="count"
                    name="Count"
                    radius={[6, 6, 0, 0]}
                    barSize={60}
                  >
                    {backloadCargoTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <PackagingLegend />
    </TabsContent>
  );
}