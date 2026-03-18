import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleetNumbers } from "@/hooks/useFleetNumbers";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, DollarSign, Star, TrendingUp } from "lucide-react";
import { useState } from "react";

type Tyre = Database["public"]["Tables"]["tyres"]["Row"];

// Extended tyre type with position information
type TyreWithPosition = Tyre & {
  current_fleet_position: string | null;
};

interface TyreRecommendation {
  brand: string;
  model: string;
  size: string;
  expectedLifespan: number;
  costPerKm: number;
  suitabilityScore: number;
  avgKmTravelled: number;
  tyreCount: number;
  avgCost: number;
  failureRate: number;
}

interface TyreGroup {
  brand: string;
  model: string;
  size: string;
  tyres: TyreWithPosition[];
  totalKm: number;
  totalCost: number;
  failures: number;
}

const TyreRecommendationEngine = () => {
  const [selectedFleet, setSelectedFleet] = useState<string>("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");

  // Get unique fleet numbers dynamically from database
  const { data: dynamicFleetNumbers = [] } = useFleetNumbers();
  const fleetNumbers = ["all", ...dynamicFleetNumbers];

  // Fetch tyres for analysis - need to join tyre_positions for current position
  const { data: tyres = [] } = useQuery({
    queryKey: ["tyres_recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyres")
        .select("*, tyre_positions!left(position)")
        .not("km_travelled", "is", null);
      if (error) throw error;

      // Transform to add current_fleet_position from join
      return (data || []).map(tyre => ({
        ...tyre,
        current_fleet_position: (tyre.tyre_positions as unknown as { position: string }[])?.[0]?.position || null,
      })) as TyreWithPosition[];
    },
  });

  // Get unique positions based on fleet selection
  const positions = ["all", ...Array.from(new Set(
    tyres
      .filter((t) => selectedFleet === "all" || t.current_fleet_position?.startsWith(selectedFleet))
      .map((t) => {
        const pos = t.current_fleet_position?.split('-')[2];
        return pos;
      })
      .filter(Boolean)
  ))];

  // Analyze tyre performance by brand/model
  const analyzePerformance = () => {
    const tyreGroups = tyres.reduce<Record<string, TyreGroup>>((acc, tyre) => {
      // Filter by fleet and position
      if (selectedFleet !== "all" && !tyre.current_fleet_position?.startsWith(selectedFleet)) {
        return acc;
      }
      if (selectedPosition !== "all") {
        const tyrePos = tyre.current_fleet_position?.split('-')[2];
        if (tyrePos !== selectedPosition) return acc;
      }

      const key = `${tyre.brand}-${tyre.model}-${tyre.size}`;
      if (!acc[key]) {
        acc[key] = {
          brand: tyre.brand,
          model: tyre.model,
          size: tyre.size,
          tyres: [],
          totalKm: 0,
          totalCost: 0,
          failures: 0,
        };
      }

      acc[key].tyres.push(tyre);
      acc[key].totalKm += tyre.km_travelled || 0;
      acc[key].totalCost += tyre.purchase_cost_zar || 0;
      if (tyre.condition === 'poor' || tyre.condition === 'needs_replacement') {
        acc[key].failures++;
      }

      return acc;
    }, {});

    // Calculate recommendations
    const recommendations: TyreRecommendation[] = Object.values(tyreGroups).map((group) => {
      const avgKm = group.totalKm / group.tyres.length;
      const avgCost = group.totalCost / group.tyres.length;
      const costPerKm = avgCost / (avgKm || 1);
      const failureRate = group.failures / group.tyres.length;

      // Suitability score (0-10)
      // Higher KM = better, Lower cost/km = better, Lower failure rate = better
      const kmScore = Math.min((avgKm / 100000) * 4, 4); // Max 4 points for 100k+ km
      const costScore = Math.max(3 - (costPerKm * 1000), 0); // Max 3 points for low cost/km
      const reliabilityScore = (1 - failureRate) * 3; // Max 3 points for no failures

      const suitabilityScore = Math.min(kmScore + costScore + reliabilityScore, 10);

      return {
        brand: group.brand,
        model: group.model,
        size: group.size,
        expectedLifespan: Math.round(avgKm),
        costPerKm: costPerKm,
        suitabilityScore: Math.round(suitabilityScore * 10) / 10,
        avgKmTravelled: Math.round(avgKm),
        tyreCount: group.tyres.length,
        avgCost: Math.round(avgCost),
        failureRate: Math.round(failureRate * 100),
      };
    });

    // Sort by suitability score
    return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  };

  const recommendations = analyzePerformance();

  // Position type detection
  const getPositionType = (position: string) => {
    if (!position) return "unknown";
    if (position.startsWith('V1') || position.startsWith('V2')) return "steer";
    if (position.startsWith('V') && parseInt(position.substring(1)) <= 10) return "drive";
    if (position.startsWith('T')) return "trailer";
    return "spare";
  };

  const currentPositionType = getPositionType(selectedPosition);

  // Position-specific recommendations
  const positionRecommendations = {
    steer: "Steer positions require tyres with excellent steering response, wear resistance, and safety ratings.",
    drive: "Drive positions need tyres with strong traction, durability, and power transmission capabilities.",
    trailer: "Trailer positions benefit from tyres with low rolling resistance for fuel efficiency and even wear characteristics.",
    spare: "Spare positions should match the specifications of your primary tyres for optimal performance.",
    unknown: "Select a position to see specific recommendations.",
  };

  const getSuitabilityBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-success">Excellent</Badge>;
    if (score >= 6) return <Badge variant="default">Good</Badge>;
    if (score >= 4) return <Badge variant="secondary">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tyre Recommendation Engine</CardTitle>
          <CardDescription>Data-driven recommendations for optimal tyre selection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4">
            <Select value={selectedFleet} onValueChange={setSelectedFleet}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select fleet" />
              </SelectTrigger>
              <SelectContent>
                {fleetNumbers.map(fn => (
                  <SelectItem key={fn} value={fn}>
                    {fn === "all" ? "All Fleets" : `Fleet ${fn}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.filter((pos): pos is string => pos !== undefined).map(pos => (
                  <SelectItem key={pos} value={pos}>
                    {pos === "all" ? "All Positions" : `Position ${pos}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position-specific guidance */}
          {selectedPosition !== "all" && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  {currentPositionType.charAt(0).toUpperCase() + currentPositionType.slice(1)} Position Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{positionRecommendations[currentPositionType as keyof typeof positionRecommendations]}</p>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Top Recommendations</h3>

            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No data available for the selected filters. Ensure tyres are tracked with KM data and fleet positions.
                </CardContent>
              </Card>
            ) : (
              recommendations.slice(0, 10).map((rec, index) => (
                <Card key={`${rec.brand}-${rec.model}-${index}`} className={index === 0 ? "border-primary" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {index === 0 && (
                            <Star className="w-5 h-5 text-primary fill-primary" />
                          )}
                          <div>
                            <p className="font-bold text-lg">{rec.brand} {rec.model}</p>
                            <p className="text-sm text-muted-foreground">{rec.size}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Expected Lifespan
                            </p>
                            <p className="font-semibold">{rec.expectedLifespan.toLocaleString()} km</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Cost/KM
                            </p>
                            <p className="font-semibold">${rec.costPerKm.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Reliability
                            </p>
                            <p className="font-semibold">{100 - rec.failureRate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Data Points</p>
                            <p className="font-semibold">{rec.tyreCount} tyres</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Suitability Score</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{rec.suitabilityScore}/10</span>
                              {getSuitabilityBadge(rec.suitabilityScore)}
                            </div>
                          </div>
                          <Progress value={rec.suitabilityScore * 10} className="h-2" />
                        </div>

                        <div className="mt-3 flex gap-2 text-xs">
                          <Badge variant="outline">Avg Cost: ${rec.avgCost}</Badge>
                          <Badge variant="outline">Based on {rec.tyreCount} tyres</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Fleet-specific insights */}
          {selectedFleet !== "all" && recommendations.length > 0 && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Fleet {selectedFleet} Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Top performer:</span>{" "}
                    {recommendations[0].brand} {recommendations[0].model} with {recommendations[0].expectedLifespan.toLocaleString()} km average
                  </p>
                  <p>
                    <span className="font-medium">Most economical:</span>{" "}
                    {recommendations.sort((a, b) => a.costPerKm - b.costPerKm)[0].brand}{" "}
                    {recommendations.sort((a, b) => a.costPerKm - b.costPerKm)[0].model} at R
                    {recommendations.sort((a, b) => a.costPerKm - b.costPerKm)[0].costPerKm.toFixed(4)}/km
                  </p>
                  {selectedPosition !== "all" && (
                    <p>
                      <span className="font-medium">Position optimization:</span> Consider rotation to balance wear across fleet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TyreRecommendationEngine;