import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, CheckCircle, DollarSign, TrendingDown } from "lucide-react";

type Tyre = Database["public"]["Tables"]["tyres"]["Row"];

type TyreWithPosition = Tyre & {
  current_position: string | null;
};

interface PredictionInput {
  currentTreadDepth: number;
  initialTreadDepth: number;
  kmTravelled: number;
  daysInService: number;
  fleetType: string;
  position: string;
  purchaseCost: number;
}

interface PredictionResult {
  predictedRemainingKm: number;
  estimatedDaysUntilReplacement: number;
  estimatedReplacementDate: Date;
  wearRate: number;
  costPerKm: number;
  projectedTotalCost: number;
  lifeUsedPercentage: number;
}

interface PositionData {
  count: number;
  avgWearRate: number;
  tyres: Array<{ tyre: TyreWithPosition; prediction: PredictionResult; daysInService: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MIN_TREAD_DEPTH_MM = 3;

const formatCurrency = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const calculatePrediction = (input: PredictionInput): PredictionResult => {
  const wearRate =
    (input.initialTreadDepth - input.currentTreadDepth) / (input.kmTravelled || 1);
  const remainingTread = input.currentTreadDepth - MIN_TREAD_DEPTH_MM;
  const predictedRemainingKm = remainingTread / (wearRate || 0.001);

  const avgDailyKm = input.kmTravelled / (input.daysInService || 1);
  const estimatedDaysUntilReplacement = predictedRemainingKm / (avgDailyKm || 1);

  const estimatedReplacementDate = new Date();
  estimatedReplacementDate.setDate(
    estimatedReplacementDate.getDate() + estimatedDaysUntilReplacement
  );

  const costPerKm = input.purchaseCost / (input.kmTravelled || 1);
  const projectedTotalCost =
    input.purchaseCost + costPerKm * predictedRemainingKm * 0.1;

  return {
    predictedRemainingKm: Math.max(0, Math.round(predictedRemainingKm)),
    estimatedDaysUntilReplacement: Math.max(0, Math.round(estimatedDaysUntilReplacement)),
    estimatedReplacementDate,
    wearRate: wearRate * 1000,
    costPerKm,
    projectedTotalCost,
    lifeUsedPercentage:
      (input.kmTravelled / (input.kmTravelled + predictedRemainingKm)) * 100,
  };
};

const getUrgencyVariant = (days: number): "destructive" | "outline" | "secondary" => {
  if (days <= 7) return "destructive";
  if (days <= 30) return "outline";
  return "secondary";
};

const getUrgencyLabel = (days: number) => {
  if (days <= 7) return `Urgent — ${days}d`;
  if (days <= 30) return `Soon — ${days}d`;
  return `${days}d`;
};

const getLifeUsedColor = (pct: number) => {
  if (pct >= 85) return "bg-destructive";
  if (pct >= 65) return "bg-warning";
  return "bg-primary";
};

// ─── Component ───────────────────────────────────────────────────────────────

const TyrePredictiveInsights = () => {
  const { data: tyres = [] } = useQuery<TyreWithPosition[]>({
    queryKey: ["tyres_predictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyres")
        .select(`*, tyre_positions!left(position)`)
        .not("installation_date", "is", null)
        .not("km_travelled", "is", null)
        .gt("km_travelled", 1000);

      if (error) throw error;

      return (data ?? []).map((tyre) => ({
        ...tyre,
        current_position:
          Array.isArray(tyre.tyre_positions) && tyre.tyre_positions.length > 0
            ? tyre.tyre_positions[0].position
            : null,
      })) as TyreWithPosition[];
    },
  });

  const predictions = tyres.map((tyre) => {
    const daysInService = tyre.installation_date
      ? Math.floor(
          (Date.now() - new Date(tyre.installation_date).getTime()) / 86_400_000
        )
      : 1;

    const prediction = calculatePrediction({
      currentTreadDepth: tyre.current_tread_depth ?? 8,
      initialTreadDepth: tyre.initial_tread_depth ?? 16,
      kmTravelled: tyre.km_travelled ?? 0,
      daysInService,
      fleetType: tyre.current_position?.split("-")[0] ?? "unknown",
      position: tyre.current_position ?? "unknown",
      purchaseCost: tyre.purchase_cost_zar ?? 5000,
    });

    return { tyre, prediction, daysInService };
  });

  const criticalPredictions = predictions.filter(
    (p) =>
      p.prediction.estimatedDaysUntilReplacement > 0 &&
      p.prediction.estimatedDaysUntilReplacement <= 30
  );
  const upcomingPredictions = predictions.filter(
    (p) =>
      p.prediction.estimatedDaysUntilReplacement > 30 &&
      p.prediction.estimatedDaysUntilReplacement <= 90
  );
  const healthyCount =
    predictions.length - criticalPredictions.length - upcomingPredictions.length;

  const next30DaysCost = criticalPredictions.reduce(
    (sum, p) => sum + (p.tyre.purchase_cost_zar ?? 5000),
    0
  );
  const next90DaysCost = [...criticalPredictions, ...upcomingPredictions].reduce(
    (sum, p) => sum + (p.tyre.purchase_cost_zar ?? 5000),
    0
  );

  const positionMap = predictions.reduce<Record<string, PositionData>>((acc, p) => {
    const pos = p.tyre.current_position;
    if (!pos) return acc;
    if (!acc[pos]) acc[pos] = { count: 0, avgWearRate: 0, tyres: [] };
    acc[pos].count += 1;
    acc[pos].avgWearRate += p.prediction.wearRate;
    acc[pos].tyres.push(p);
    return acc;
  }, {});

  const problematicPositions = Object.entries(positionMap)
    .map(([position, data]) => ({
      position,
      count: data.count,
      avgWearRate: data.avgWearRate / data.count,
    }))
    .filter((p) => p.count >= 2 && p.avgWearRate > 0.01)
    .sort((a, b) => b.avgWearRate - a.avgWearRate);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Predictive Maintenance Insights</CardTitle>
          <CardDescription>
            Tyre replacement forecasts based on wear-rate modelling
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-destructive/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Critical — next 30 days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{criticalPredictions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Est. cost: {formatCurrency(next30DaysCost)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-warning/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-warning" />
                  Upcoming — 30–90 days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{upcomingPredictions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Est. cost: {formatCurrency(next90DaysCost)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Healthy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{healthyCount}</p>
                <p className="text-xs text-muted-foreground mt-1">No action required</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Critical Replacements ── */}
          {criticalPredictions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Immediate Attention Required
              </h3>
              {criticalPredictions.map(({ tyre, prediction }) => (
                <Alert key={tyre.id} variant="destructive">
                  <AlertDescription className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="font-semibold">
                        {tyre.brand} {tyre.model}
                        {tyre.current_position && (
                          <span className="ml-2 font-mono text-xs opacity-75">
                            [{tyre.current_position}]
                          </span>
                        )}
                      </p>
                      <p className="text-sm">
                        Tread: {tyre.current_tread_depth ?? "—"}mm &nbsp;·&nbsp;
                        ~{prediction.predictedRemainingKm.toLocaleString()} km remaining &nbsp;·&nbsp;
                        {formatCurrency(tyre.purchase_cost_zar ?? 0)}
                      </p>
                    </div>
                    <Badge variant={getUrgencyVariant(prediction.estimatedDaysUntilReplacement)}>
                      {getUrgencyLabel(prediction.estimatedDaysUntilReplacement)}
                    </Badge>
                  </AlertDescription>
                </Alert>
              ))}
            </section>
          )}

          {/* ── Upcoming Replacements ── */}
          {upcomingPredictions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-warning" />
                Upcoming Replacements
              </h3>
              <div className="divide-y rounded-lg border overflow-hidden">
                {upcomingPredictions.slice(0, 6).map(({ tyre, prediction }) => (
                  <div
                    key={tyre.id}
                    className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="font-medium text-sm truncate">
                        {tyre.brand} {tyre.model}
                        {tyre.current_position && (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            [{tyre.current_position}]
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>Due {formatDate(prediction.estimatedReplacementDate)}</span>
                        <span>~{prediction.predictedRemainingKm.toLocaleString()} km left</span>
                        <span>{tyre.current_tread_depth ?? "—"}mm tread</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress
                          value={prediction.lifeUsedPercentage}
                          className={`h-1.5 flex-1 ${getLifeUsedColor(prediction.lifeUsedPercentage)}`}
                        />
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {Math.round(prediction.lifeUsedPercentage)}%
                        </span>
                      </div>
                    </div>
                    <Badge variant={getUrgencyVariant(prediction.estimatedDaysUntilReplacement)}>
                      {getUrgencyLabel(prediction.estimatedDaysUntilReplacement)}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Problematic Positions ── */}
          {problematicPositions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-warning" />
                High-Wear Positions
              </h3>
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-medium mb-3">
                    The following positions show accelerated wear — inspect alignment and rotation patterns.
                  </p>
                  <div className="divide-y">
                    {problematicPositions.slice(0, 3).map((pos) => (
                      <div
                        key={pos.position}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="font-mono font-medium">{pos.position}</span>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{pos.count} tyre{pos.count !== 1 ? "s" : ""}</span>
                          <span>{pos.avgWearRate.toFixed(3)} mm / 1 000 km</span>
                          <Badge variant="outline" className="text-xs">
                            Check alignment
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </section>
          )}

          {/* ── Budget Forecast ── */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Budget Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next 30 days</span>
                  <span className="font-semibold">{formatCurrency(next30DaysCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next 90 days</span>
                  <span className="font-semibold">{formatCurrency(next90DaysCost)}</span>
                </div>
                <div className="flex justify-between pt-3 mt-1 border-t">
                  <span className="text-muted-foreground">
                    Bulk order saving (est. 15%)
                  </span>
                  <span className="font-semibold text-success">
                    − {formatCurrency(next90DaysCost * 0.15)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Projected net cost</span>
                  <span className="font-bold">
                    {formatCurrency(next90DaysCost * 0.85)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Empty State ── */}
          {predictions.length === 0 && (
            <Alert>
              <AlertDescription>
                No prediction data available. Make sure tyres have an installation date and at
                least 1 000 km recorded before predictions can be generated.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TyrePredictiveInsights;