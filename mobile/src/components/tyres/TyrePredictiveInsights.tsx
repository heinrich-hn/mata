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

// Extended type with current_position added from join
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

const calculatePrediction = (input: PredictionInput) => {
  const wearRate = (input.initialTreadDepth - input.currentTreadDepth) / (input.kmTravelled || 1);
  const minTreadDepth = 3; // mm
  const remainingTread = input.currentTreadDepth - minTreadDepth;
  const predictedRemainingKm = remainingTread / (wearRate || 0.001);

  const avgDailyKm = input.kmTravelled / (input.daysInService || 1);
  const estimatedDaysUntilReplacement = predictedRemainingKm / (avgDailyKm || 1);
  const estimatedReplacementDate = new Date();
  estimatedReplacementDate.setDate(estimatedReplacementDate.getDate() + estimatedDaysUntilReplacement);

  const costPerKm = input.purchaseCost / (input.kmTravelled || 1);
  const projectedTotalCost = input.purchaseCost + (costPerKm * predictedRemainingKm * 0.1); // 10% maintenance

  return {
    predictedRemainingKm: Math.max(0, Math.round(predictedRemainingKm)),
    estimatedDaysUntilReplacement: Math.max(0, Math.round(estimatedDaysUntilReplacement)),
    estimatedReplacementDate,
    wearRate: wearRate * 1000, // per 1000km
    costPerKm,
    projectedTotalCost,
    lifeUsedPercentage: ((input.kmTravelled / (input.kmTravelled + predictedRemainingKm)) * 100),
  };
};

const TyrePredictiveInsights = () => {
  // Fetch tyres with sufficient data for predictions
  const { data: tyres = [] } = useQuery<TyreWithPosition[]>({
    queryKey: ["tyres_predictions"],
    queryFn: async () => {
      // Query tyres with position data from tyre_positions
      const { data, error } = await supabase
        .from("tyres")
        .select(`
          *,
          tyre_positions!left(position)
        `)
        .not("installation_date", "is", null)
        .not("km_travelled", "is", null)
        .gt("km_travelled", 1000); // Only tyres with meaningful data

      if (error) throw error;

      // Transform data to add current_position
      return (data || []).map(tyre => ({
        ...tyre,
        current_position: Array.isArray(tyre.tyre_positions) && tyre.tyre_positions.length > 0
          ? tyre.tyre_positions[0].position
          : null
      })) as TyreWithPosition[];
    },
  });  // Calculate predictions for all tyres
  const predictions = tyres.map((tyre: TyreWithPosition) => {
    const daysInService = tyre.installation_date
      ? Math.floor((new Date().getTime() - new Date(tyre.installation_date).getTime()) / (1000 * 60 * 60 * 24))
      : 1;

    const prediction = calculatePrediction({
      currentTreadDepth: tyre.current_tread_depth || 8,
      initialTreadDepth: tyre.initial_tread_depth || 16,
      kmTravelled: tyre.km_travelled || 0,
      daysInService,
      fleetType: tyre.current_position?.toString().split('-')[0] || 'unknown',
      position: tyre.current_position?.toString() || 'unknown',
      purchaseCost: tyre.purchase_cost_zar || 5000,
    });

    return {
      tyre,
      prediction,
      daysInService,
    };
  });

  // Filter critical predictions (30 days or less)
  const criticalPredictions = predictions.filter(p => p.prediction.estimatedDaysUntilReplacement <= 30 && p.prediction.estimatedDaysUntilReplacement > 0);

  // Filter upcoming (30-90 days)
  const upcomingPredictions = predictions.filter(p => p.prediction.estimatedDaysUntilReplacement > 30 && p.prediction.estimatedDaysUntilReplacement <= 90);

  // Budget projections
  const next30DaysCost = criticalPredictions.reduce((sum, p) => sum + (p.tyre.purchase_cost_zar || 5000), 0);
  const next90DaysCost = [...criticalPredictions, ...upcomingPredictions].reduce((sum, p) => sum + (p.tyre.purchase_cost_zar || 5000), 0);

  // Position-specific patterns
  interface PositionData {
    count: number;
    avgWearRate: number;
    tyres: typeof predictions;
  }

  const positionIssues = predictions.reduce((acc: Record<string, PositionData>, p) => {
    const position = p.tyre.current_position?.toString();
    if (!position) return acc;

    if (!acc[position]) {
      acc[position] = { count: 0, avgWearRate: 0, tyres: [] };
    }
    acc[position].count++;
    acc[position].avgWearRate += p.prediction.wearRate;
    acc[position].tyres.push(p);
    return acc;
  }, {});

  // Identify problematic positions (high wear rate)
  const problematicPositions = Object.entries(positionIssues)
    .map(([position, data]) => ({
      position,
      count: data.count,
      avgWearRate: data.avgWearRate / data.count,
      tyres: data.tyres,
    }))
    .filter(p => p.count >= 2 && p.avgWearRate > 0.01)
    .sort((a, b) => b.avgWearRate - a.avgWearRate);

  const getUrgencyBadge = (days: number) => {
    if (days <= 7) return <Badge variant="destructive">Urgent - {days}d</Badge>;
    if (days <= 30) return <Badge variant="outline" className="border-warning text-warning">Soon - {days}d</Badge>;
    return <Badge variant="secondary">{days}d</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Predictive Maintenance Insights</CardTitle>
          <CardDescription>AI-powered predictions for tyre replacement and maintenance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Critical (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{criticalPredictions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Est. Cost: ${next30DaysCost.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-warning/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-warning" />
                  Upcoming (90 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{upcomingPredictions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Est. Cost: ${next90DaysCost.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Healthy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {predictions.length - criticalPredictions.length - upcomingPredictions.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Good condition</p>
              </CardContent>
            </Card>
          </div>

          {/* Critical Replacements */}
          {criticalPredictions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Immediate Attention Required
              </h3>
              {criticalPredictions.map(({ tyre, prediction }) => (
                <Alert key={tyre.id} variant="destructive">
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {tyre.brand} {tyre.model} - {tyre.current_position || 'N/A'}
                      </p>
                      <p className="text-sm">
                        Current: {tyre.current_tread_depth}mm •
                        Remaining: ~{prediction.predictedRemainingKm.toLocaleString()}km •
                        Cost: ${tyre.purchase_cost_zar?.toFixed(2) || 'N/A'}
                      </p>
                    </div>
                    {getUrgencyBadge(prediction.estimatedDaysUntilReplacement)}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Upcoming Replacements */}
          {upcomingPredictions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-warning" />
                Upcoming Replacements (30-90 days)
              </h3>
              <div className="space-y-2">
                {upcomingPredictions.slice(0, 5).map(({ tyre, prediction }) => (
                  <div key={tyre.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {tyre.brand} {tyre.model} - {tyre.current_position || 'N/A'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Est. {formatDate(prediction.estimatedReplacementDate)}</span>
                        <span>~{prediction.predictedRemainingKm.toLocaleString()}km left</span>
                      </div>
                      <Progress value={prediction.lifeUsedPercentage} className="h-1 mt-2" />
                    </div>
                    {getUrgencyBadge(prediction.estimatedDaysUntilReplacement)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Problematic Positions */}
          {problematicPositions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-warning" />
                Problematic Positions
              </h3>
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Positions with high wear rates detected:</p>
                  <div className="space-y-2">
                    {problematicPositions.slice(0, 3).map((pos) => (
                      <div key={pos.position} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{pos.position}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {pos.count} tyres • Avg wear: {pos.avgWearRate.toFixed(3)}mm/1000km
                          </span>
                          <Badge variant="outline">Check alignment</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Budget Forecast */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Budget Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Next 30 days:</span>
                <span className="font-bold">${next30DaysCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Next 90 days:</span>
                <span className="font-bold">${next90DaysCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-medium">Recommended bulk order savings:</span>
                <span className="font-bold text-success">-${(next90DaysCost * 0.15).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {predictions.length === 0 && (
            <Alert>
              <AlertDescription>
                Not enough data available for predictions. Ensure tyres have installation dates and KM readings recorded.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TyrePredictiveInsights;