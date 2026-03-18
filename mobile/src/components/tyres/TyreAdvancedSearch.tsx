import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { FilterCriteria, PressureHealthStatus, TyreHealthStatus } from "@/types/tyre";
import { Filter, Search, Star, X } from "lucide-react";
import { useState } from "react";

interface TyreAdvancedSearchProps {
  onSearch: (criteria: FilterCriteria) => void;
  onClear: () => void;
}

const TyreAdvancedSearch = ({ onSearch, onClear }: TyreAdvancedSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState<TyreHealthStatus[]>([]);
  const [pressureFilter, setPressureFilter] = useState<PressureHealthStatus[]>([]);
  const [brandFilter, setBrandFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = () => {
    const criteria: FilterCriteria = {
      searchTerm,
      healthStatus: healthFilter.length > 0 ? healthFilter : undefined,
      pressureStatus: pressureFilter.length > 0 ? pressureFilter : undefined,
      include: [],
    };

    if (brandFilter && brandFilter !== "all") {
      criteria.include?.push({ field: "brand", values: [brandFilter] });
    }

    if (typeFilter && typeFilter !== "all") {
      criteria.include?.push({ field: "type", values: [typeFilter] });
    }

    onSearch(criteria);
  };

  const handleClear = () => {
    setSearchTerm("");
    setHealthFilter([]);
    setPressureFilter([]);
    setBrandFilter("all");
    setTypeFilter("all");
    onClear();
  };

  const toggleHealthFilter = (status: TyreHealthStatus) => {
    setHealthFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const togglePressureFilter = (status: PressureHealthStatus) => {
    setPressureFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const hasActiveFilters = searchTerm || healthFilter.length > 0 || pressureFilter.length > 0 || (brandFilter && brandFilter !== "all") || (typeFilter && typeFilter !== "all");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Advanced Tyre Search
            </CardTitle>
            <CardDescription>
              Search by TIN, specifications, health status, or location
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showAdvanced ? "Hide" : "Show"} Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search by TIN, serial number, brand, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          {hasActiveFilters && (
            <Button variant="outline" onClick={handleClear}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            {/* Health Status Filters */}
            <div className="space-y-2">
              <Label>Tread Depth Health</Label>
              <div className="flex flex-wrap gap-2">
                {(['excellent', 'good', 'warning', 'critical'] as TyreHealthStatus[]).map((status) => (
                  <Badge
                    key={status}
                    variant={healthFilter.includes(status) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleHealthFilter(status)}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Pressure Status Filters */}
            <div className="space-y-2">
              <Label>Pressure Health</Label>
              <div className="flex flex-wrap gap-2">
                {(['normal', 'low', 'high', 'critical'] as PressureHealthStatus[]).map((status) => (
                  <Badge
                    key={status}
                    variant={pressureFilter.includes(status) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePressureFilter(status)}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Specification Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand-filter">Brand</Label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger id="brand-filter">
                    <SelectValue placeholder="All brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    <SelectItem value="Michelin">Michelin</SelectItem>
                    <SelectItem value="Bridgestone">Bridgestone</SelectItem>
                    <SelectItem value="Goodyear">Goodyear</SelectItem>
                    <SelectItem value="Continental">Continental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type-filter">Tyre Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger id="type-filter">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="steer">Steer</SelectItem>
                    <SelectItem value="drive">Drive</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHealthFilter(['critical']);
              handleSearch();
            }}
          >
            Critical Only
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHealthFilter(['warning', 'critical']);
              handleSearch();
            }}
          >
            Needs Attention
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPressureFilter(['low', 'critical']);
              handleSearch();
            }}
          >
            Low Pressure
          </Button>
        </div>

        {/* Saved Searches Placeholder */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm text-muted-foreground">Saved Searches</Label>
            <Button variant="ghost" size="sm">
              <Star className="w-4 h-4 mr-1" />
              Save Current
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No saved searches yet. Save frequently used searches for quick access.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TyreAdvancedSearch;