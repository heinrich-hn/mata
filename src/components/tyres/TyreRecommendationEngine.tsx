import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleetNumbers } from "@/hooks/useFleetNumbers";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { 
  Award, 
  CheckCircle2, 
  DollarSign, 
  Star, 
  TrendingUp, 
  AlertTriangle,
  Info,
  BarChart3,
  HelpCircle,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";

// ============================================================================
// Types & Interfaces
// ============================================================================

type Tyre = Database["public"]["Tables"]["tyres"]["Row"];

interface TyreWithPosition extends Tyre {
  current_fleet_position: string | null;
}

// Extended type for additional properties that might exist in the database
interface TyreWithOptionalFields extends TyreWithPosition {
  retread_count?: number | null;
}

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
  roiScore: number;
  maintenanceCost: number;
  projectedSavings: number;
}

interface TyreGroup {
  brand: string;
  model: string;
  size: string;
  tyres: TyreWithOptionalFields[];
  totalKm: number;
  totalCost: number;
  failures: number;
  maintenanceEvents: number;
}

// ============================================================================
// Constants
// ============================================================================

const LIFESPAN_BENCHMARK = 100000; // km
const COST_PER_KM_BENCHMARK = 0.05; // $ per km
const MAINTENANCE_COST_FACTOR = 0.1; // 10% of purchase cost for maintenance

const SUITABILITY_WEIGHTS = {
  lifespan: 0.35,    // 35% weight
  costEfficiency: 0.30, // 30% weight
  reliability: 0.25,    // 25% weight
  roi: 0.10            // 10% weight
};

const SCORE_THRESHOLDS = {
  excellent: 8,
  good: 6,
  fair: 4,
  poor: 0
};

// ============================================================================
// Utility Functions
// ============================================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

const getSuitabilityBadge = (score: number) => {
  if (score >= SCORE_THRESHOLDS.excellent) {
    return <Badge className="bg-green-600 hover:bg-green-700">Excellent</Badge>;
  }
  if (score >= SCORE_THRESHOLDS.good) {
    return <Badge variant="default" className="bg-blue-600">Good</Badge>;
  }
  if (score >= SCORE_THRESHOLDS.fair) {
    return <Badge variant="secondary">Fair</Badge>;
  }
  return <Badge variant="destructive">Poor</Badge>;
};

const getScoreColor = (score: number): string => {
  if (score >= SCORE_THRESHOLDS.excellent) return "text-green-600";
  if (score >= SCORE_THRESHOLDS.good) return "text-blue-600";
  if (score >= SCORE_THRESHOLDS.fair) return "text-amber-600";
  return "text-red-600";
};

const getPositionType = (position: string): 'steer' | 'drive' | 'trailer' | 'spare' | 'unknown' => {
  if (!position) return "unknown";
  if (position.startsWith('V1') || position.startsWith('V2')) return "steer";
  if (position.startsWith('V') && parseInt(position.substring(1)) <= 10) return "drive";
  if (position.startsWith('T')) return "trailer";
  return "spare";
};

// Position-specific detailed recommendations
const positionRecommendations = {
  steer: {
    title: "Steer Position Requirements",
    description: "Steer positions are critical for vehicle control and safety.",
    requirements: [
      "Excellent steering response and cornering stability",
      "Superior wear resistance for even tread wear",
      "Strong sidewall construction for load bearing",
      "High safety ratings for wet and dry conditions"
    ],
    recommendations: [
      "Prioritize tyres with reinforced sidewalls",
      "Consider premium brands for steer positions",
      "Rotate more frequently (every 10,000km)"
    ]
  },
  drive: {
    title: "Drive Position Requirements",
    description: "Drive positions transmit power to the road and require maximum traction.",
    requirements: [
      "Strong traction for power transmission",
      "Durable compound for high torque applications",
      "Excellent heat dissipation",
      "Deep tread pattern for wet grip"
    ],
    recommendations: [
      "Choose tyres with deep tread depth (18mm+)",
      "Consider drive-specific patterns for better traction",
      "Monitor for irregular wear patterns"
    ]
  },
  trailer: {
    title: "Trailer Position Requirements",
    description: "Trailer positions focus on fuel efficiency and even wear.",
    requirements: [
      "Low rolling resistance for fuel economy",
      "Even wear characteristics",
      "Good load carrying capacity",
      "Cost-effective operation"
    ],
    recommendations: [
      "Select tyres with fuel-efficient compounds",
      "Regular pressure checks critical for wear",
      "Consider retreading for trailer positions"
    ]
  },
  spare: {
    title: "Spare Position Requirements",
    description: "Spare tyres must match primary tyre specifications for emergency use.",
    requirements: [
      "Match specifications of primary tyres",
      "Proper age and condition management",
      "Regular pressure maintenance"
    ],
    recommendations: [
      "Include in rotation schedule",
      "Check pressure monthly",
      "Replace if older than 6 years"
    ]
  },
  unknown: {
    title: "Position Selection Required",
    description: "Select a position to see specific recommendations for your fleet.",
    requirements: [],
    recommendations: []
  }
};

// ============================================================================
// Main Component
// ============================================================================

const TyreRecommendationEngine = () => {
  const [selectedFleet, setSelectedFleet] = useState<string>("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Get unique fleet numbers dynamically from database
  const { data: dynamicFleetNumbers = [] } = useFleetNumbers();
  const fleetNumbers = ["all", ...dynamicFleetNumbers];

  // Fetch tyres for analysis
  const { data: tyres = [], isLoading, error } = useQuery({
    queryKey: ["tyres_recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyres")
        .select("*, tyre_positions!left(position)")
        .not("km_travelled", "is", null)
        .gt("km_travelled", 1000); // Only tyres with meaningful data

      if (error) throw error;

      return (data || []).map(tyre => ({
        ...tyre,
        current_fleet_position: (tyre.tyre_positions as unknown as { position: string }[])?.[0]?.position || null,
      })) as TyreWithOptionalFields[];
    },
  });

  // Get unique positions based on fleet selection
  const positions = useMemo(() => {
    const uniquePositions = new Set<string>();
    tyres
      .filter((t) => selectedFleet === "all" || t.current_fleet_position?.startsWith(selectedFleet))
      .forEach((t) => {
        const pos = t.current_fleet_position?.split('-')[2];
        if (pos) uniquePositions.add(pos);
      });
    return ["all", ...Array.from(uniquePositions).sort()];
  }, [tyres, selectedFleet]);

  // Analyze tyre performance by brand/model
  const recommendations = useMemo((): TyreRecommendation[] => {
    const tyreGroups = tyres.reduce<Record<string, TyreGroup>>((acc, tyre) => {
      // Filter by fleet and position
      if (selectedFleet !== "all" && !tyre.current_fleet_position?.startsWith(selectedFleet)) {
        return acc;
      }
      if (selectedPosition !== "all") {
        const tyrePos = tyre.current_fleet_position?.split('-')[2];
        if (tyrePos !== selectedPosition) return acc;
      }

      const brand = tyre.brand || 'Unknown';
      const model = tyre.model || 'Unknown';
      const size = tyre.size || 'Unknown';
      const key = `${brand}-${model}-${size}`;
      
      if (!acc[key]) {
        acc[key] = {
          brand,
          model,
          size,
          tyres: [],
          totalKm: 0,
          totalCost: 0,
          failures: 0,
          maintenanceEvents: 0,
        };
      }

      acc[key].tyres.push(tyre);
      acc[key].totalKm += tyre.km_travelled || 0;
      acc[key].totalCost += tyre.purchase_cost_zar || 0;
      
      if (tyre.condition === 'poor' || tyre.condition === 'needs_replacement') {
        acc[key].failures++;
      }
      
      // Safely check for retread_count property (might not exist in schema)
      const retreadCount = 'retread_count' in tyre && tyre.retread_count ? tyre.retread_count : 0;
      if (retreadCount > 0) {
        acc[key].maintenanceEvents += retreadCount;
      }

      return acc;
    }, {});

    // Calculate recommendations with enhanced scoring
    const recs: TyreRecommendation[] = Object.values(tyreGroups).map((group) => {
      const avgKm = group.totalKm / group.tyres.length;
      const avgCost = group.totalCost / group.tyres.length;
      const costPerKm = avgKm > 0 ? avgCost / avgKm : 0;
      const failureRate = group.failures / group.tyres.length;
      const maintenanceCost = avgCost * MAINTENANCE_COST_FACTOR * group.maintenanceEvents;
      
      // Enhanced scoring system
      const lifespanScore = Math.min((avgKm / LIFESPAN_BENCHMARK) * 4, 4);
      const costScore = Math.max(3 - (costPerKm / COST_PER_KM_BENCHMARK) * 3, 0);
      const reliabilityScore = (1 - failureRate) * 3;
      const roiScore = (avgKm / (avgCost || 1)) * 100; // KM per $100 spent
      
      const suitabilityScore = (
        lifespanScore * SUITABILITY_WEIGHTS.lifespan +
        costScore * SUITABILITY_WEIGHTS.costEfficiency +
        reliabilityScore * SUITABILITY_WEIGHTS.reliability +
        Math.min(roiScore / 100, 1) * SUITABILITY_WEIGHTS.roi
      );

      // Calculate projected savings vs. best performer
      const allCosts = Object.values(tyreGroups).map(g => 
        (g.totalCost / (g.totalKm || 1))
      );
      const bestCostPerKm = Math.min(...allCosts);
      const projectedSavings = (costPerKm - bestCostPerKm) * avgKm;

      return {
        brand: group.brand,
        model: group.model,
        size: group.size,
        expectedLifespan: Math.round(avgKm),
        costPerKm: parseFloat(costPerKm.toFixed(4)),
        suitabilityScore: parseFloat(suitabilityScore.toFixed(1)),
        avgKmTravelled: Math.round(avgKm),
        tyreCount: group.tyres.length,
        avgCost: Math.round(avgCost),
        failureRate: Math.round(failureRate * 100),
        roiScore: parseFloat(roiScore.toFixed(1)),
        maintenanceCost: Math.round(maintenanceCost),
        projectedSavings: Math.max(0, Math.round(projectedSavings)),
      };
    });

    return recs.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }, [tyres, selectedFleet, selectedPosition]);

  const currentPositionType = getPositionType(selectedPosition);
  const positionGuide = positionRecommendations[currentPositionType];

  // Calculate fleet insights
  const fleetInsights = useMemo(() => {
    if (selectedFleet === "all" || recommendations.length === 0) return null;
    
    const topPerformer = recommendations[0];
    const mostEconomical = [...recommendations].sort((a, b) => a.costPerKm - b.costPerKm)[0];
    const mostReliable = [...recommendations].sort((a, b) => a.failureRate - b.failureRate)[0];
    const bestROI = [...recommendations].sort((a, b) => b.roiScore - a.roiScore)[0];
    
    const totalSavingsPotential = recommendations.reduce((sum, rec) => 
      sum + (rec.projectedSavings * rec.tyreCount), 0
    );
    
    return {
      topPerformer,
      mostEconomical,
      mostReliable,
      bestROI,
      totalSavingsPotential,
      totalTyres: recommendations.reduce((sum, rec) => sum + rec.tyreCount, 0),
    };
  }, [recommendations, selectedFleet]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Analyzing tyre performance data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load tyre data. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Tyre Recommendation Engine
          </CardTitle>
          <CardDescription>
            AI-powered, data-driven recommendations for optimal tyre selection based on real performance data
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Fleet Selection</label>
              <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                <SelectTrigger>
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
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Position Type</label>
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map(pos => (
                    <SelectItem key={pos} value={pos}>
                      {pos === "all" ? "All Positions" : `Position ${pos}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Position-specific guidance */}
          {selectedPosition !== "all" && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  {positionGuide.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  {positionGuide.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Key Requirements:</p>
                    <ul className="space-y-1">
                      {positionGuide.requirements.map((req, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations:</p>
                    <ul className="space-y-1">
                      {positionGuide.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <Star className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Top Tyre Recommendations
                <Badge variant="outline" className="ml-2">
                  {recommendations.length} options
                </Badge>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowDetails(showDetails ? null : "all")}
              >
                {showDetails ? "Hide Details" : "Show Details"}
              </Button>
            </div>

            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No data available for the selected filters.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ensure tyres are tracked with KM data and fleet positions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              recommendations.slice(0, 10).map((rec, index) => (
                <Card 
                  key={`${rec.brand}-${rec.model}-${index}`} 
                  className={`transition-all hover:shadow-md ${index === 0 ? "border-primary/50 bg-primary/5" : ""}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-4">
                          {index === 0 && (
                            <div className="bg-primary/10 p-2 rounded-full">
                              <Star className="w-5 h-5 text-primary fill-primary" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-bold text-lg">{rec.brand} {rec.model}</p>
                              {getSuitabilityBadge(rec.suitabilityScore)}
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.size}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-muted/30 p-2 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Expected Lifespan
                            </p>
                            <p className="font-semibold">{formatNumber(rec.expectedLifespan)} km</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {Math.round((rec.expectedLifespan / LIFESPAN_BENCHMARK) * 100)}% of benchmark
                            </p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Cost per KM
                            </p>
                            <p className="font-semibold">{formatCurrency(rec.costPerKm)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Avg tyre: {formatCurrency(rec.avgCost)}
                            </p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Reliability
                            </p>
                            <p className="font-semibold">{100 - rec.failureRate}%</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {rec.failureRate}% failure rate
                            </p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Data Points</p>
                            <p className="font-semibold">{rec.tyreCount} tyres</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Avg {formatNumber(rec.avgKmTravelled)} km each
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1">
                              Suitability Score
                              <HelpCircle className="w-3 h-3 text-muted-foreground" />
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${getScoreColor(rec.suitabilityScore)}`}>
                                {rec.suitabilityScore}/10
                              </span>
                              {getSuitabilityBadge(rec.suitabilityScore)}
                            </div>
                          </div>
                          <Progress 
                            value={rec.suitabilityScore * 10} 
                            className="h-2"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Lifespan: {Math.min(Math.round((rec.expectedLifespan / LIFESPAN_BENCHMARK) * 4), 4)}/4</span>
                            <span>Cost: {Math.min(Math.round((COST_PER_KM_BENCHMARK / (rec.costPerKm || 0.01)) * 3), 3)}/3</span>
                            <span>Reliability: {Math.min(Math.round((1 - rec.failureRate/100) * 3), 3)}/3</span>
                          </div>
                        </div>

                        {showDetails === "all" && (
                          <div className="mt-4 p-3 bg-muted/20 rounded-lg border">
                            <p className="text-sm font-medium mb-2">ROI Analysis</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">ROI Score:</span>
                                <span className="ml-2 font-medium">{rec.roiScore} km/$100</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Projected Savings:</span>
                                <span className="ml-2 font-medium text-green-600">
                                  {formatCurrency(rec.projectedSavings)}/tyre
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Est. Maintenance Cost:</span>
                                <span className="ml-2 font-medium">{formatCurrency(rec.maintenanceCost)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex gap-2 text-xs flex-wrap">
                          <Badge variant="outline">Avg Cost: {formatCurrency(rec.avgCost)}</Badge>
                          <Badge variant="outline">Based on {rec.tyreCount} tyre{rec.tyreCount !== 1 ? 's' : ''}</Badge>
                          {rec.projectedSavings > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Save {formatCurrency(rec.projectedSavings)}/tyre
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Fleet-specific insights */}
          {fleetInsights && selectedFleet !== "all" && recommendations.length > 0 && (
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  Fleet {selectedFleet} Performance Insights
                </CardTitle>
                <CardDescription>
                  Data-driven recommendations for optimizing your fleet's tyre strategy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-sm font-medium">Top Performer:</span>
                      <span className="text-sm">
                        {fleetInsights.topPerformer.brand} {fleetInsights.topPerformer.model}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-sm font-medium">Most Economical:</span>
                      <span className="text-sm">
                        {fleetInsights.mostEconomical.brand} {fleetInsights.mostEconomical.model}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-sm font-medium">Most Reliable:</span>
                      <span className="text-sm">
                        {fleetInsights.mostReliable.brand} {fleetInsights.mostReliable.model}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-sm font-medium">Best ROI:</span>
                      <span className="text-sm">
                        {fleetInsights.bestROI.brand} {fleetInsights.bestROI.model}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 bg-white/50 rounded-lg">
                      <p className="text-sm font-medium mb-1">Total Savings Potential</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(fleetInsights.totalSavingsPotential)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        By switching to recommended tyres across {fleetInsights.totalTyres} tyres
                      </p>
                    </div>
                    {selectedPosition !== "all" && (
                      <div className="p-3 bg-blue-50/50 rounded-lg">
                        <p className="text-xs text-blue-800">
                          💡 Recommendation: Consider rotation every 10,000-15,000 km to balance wear across positions
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Quality Note */}
          {tyres.length > 0 && recommendations.length === 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground text-center">
                  💡 Tip: Add more tyre data (brand, model, KM travelled) to enable accurate recommendations.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TyreRecommendationEngine;