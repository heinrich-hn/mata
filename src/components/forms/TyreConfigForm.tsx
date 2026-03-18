import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TyreConfig } from "@/types/tyre";
import { Loader2 } from "lucide-react";

interface TyreConfigFormProps {
  onSuccess?: (config: TyreConfig) => void;
  onCancel?: () => void;
  initialData?: Partial<TyreConfig>;
}

const TyreConfigForm = ({ onSuccess, onCancel, initialData }: TyreConfigFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    config_name: initialData?.config_name || "",
    brand: initialData?.brand || "",
    model: initialData?.model || "",
    width: initialData?.width?.toString() || "",
    aspect_ratio: initialData?.aspect_ratio?.toString() || "",
    rim_diameter: initialData?.rim_diameter?.toString() || "",
    metric_type: initialData?.metric_type || "metric",
    construction: initialData?.construction || "R",
    load_index: initialData?.load_index?.toString() || "",
    speed_rating: initialData?.speed_rating || "",
    factory_tread_depth: initialData?.factory_tread_depth?.toString() || "",
    minimum_tread_depth: initialData?.minimum_tread_depth?.toString() || "",
    life_expectancy: initialData?.life_expectancy?.toString() || "",
    recommended_pressure: initialData?.recommended_pressure?.toString() || "",
    max_pressure: initialData?.max_pressure?.toString() || "",
    notes: initialData?.notes || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const configData = {
        config_name: formData.config_name,
        brand: formData.brand,
        model: formData.model,
        width: parseFloat(formData.width),
        aspect_ratio: parseFloat(formData.aspect_ratio),
        rim_diameter: parseFloat(formData.rim_diameter),
        metric_type: formData.metric_type,
        construction: formData.construction,
        load_index: formData.load_index ? parseInt(formData.load_index) : null,
        speed_rating: formData.speed_rating || null,
        factory_tread_depth: parseFloat(formData.factory_tread_depth),
        minimum_tread_depth: parseFloat(formData.minimum_tread_depth),
        life_expectancy: formData.life_expectancy ? parseInt(formData.life_expectancy) : null,
        recommended_pressure: formData.recommended_pressure ? parseFloat(formData.recommended_pressure) : null,
        max_pressure: formData.max_pressure ? parseFloat(formData.max_pressure) : null,
        notes: formData.notes || null,
      };

      const { data, error } = initialData?.id
        ? await supabase
            .from("tyre_configs")
            .update(configData)
            .eq("id", initialData.id)
            .select()
            .single()
        : await supabase
            .from("tyre_configs")
            .insert(configData)
            .select()
            .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Tyre configuration ${initialData?.id ? 'updated' : 'created'} successfully`,
      });

      onSuccess?.(data as TyreConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{initialData?.id ? 'Edit' : 'Create'} Tyre Configuration</CardTitle>
          <CardDescription>
            Define technical specifications for a tyre model to reuse across inventory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="config_name">Configuration Name *</Label>
              <Input
                id="config_name"
                value={formData.config_name}
                onChange={(e) => handleChange("config_name", e.target.value)}
                placeholder="e.g., Michelin XZE 295/80R22.5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                placeholder="e.g., Michelin"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                placeholder="e.g., XZE"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="width">Width (mm) *</Label>
              <Input
                id="width"
                type="number"
                step="0.1"
                value={formData.width}
                onChange={(e) => handleChange("width", e.target.value)}
                placeholder="e.g., 295"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspect_ratio">Aspect Ratio *</Label>
              <Input
                id="aspect_ratio"
                type="number"
                step="0.1"
                value={formData.aspect_ratio}
                onChange={(e) => handleChange("aspect_ratio", e.target.value)}
                placeholder="e.g., 80"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rim_diameter">Rim Diameter (inches) *</Label>
              <Input
                id="rim_diameter"
                type="number"
                step="0.1"
                value={formData.rim_diameter}
                onChange={(e) => handleChange("rim_diameter", e.target.value)}
                placeholder="e.g., 22.5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="construction">Construction Type *</Label>
              <Select value={formData.construction} onValueChange={(value) => handleChange("construction", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">R (Radial)</SelectItem>
                  <SelectItem value="D">D (Diagonal)</SelectItem>
                  <SelectItem value="B">B (Bias Belt)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric_type">Metric Type *</Label>
              <Select value={formData.metric_type} onValueChange={(value) => handleChange("metric_type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric</SelectItem>
                  <SelectItem value="imperial">Imperial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="load_index">Load Index</Label>
              <Input
                id="load_index"
                type="number"
                value={formData.load_index}
                onChange={(e) => handleChange("load_index", e.target.value)}
                placeholder="e.g., 154"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="speed_rating">Speed Rating</Label>
              <Input
                id="speed_rating"
                value={formData.speed_rating}
                onChange={(e) => handleChange("speed_rating", e.target.value)}
                placeholder="e.g., L"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="factory_tread_depth">Factory Tread Depth (mm) *</Label>
              <Input
                id="factory_tread_depth"
                type="number"
                step="0.1"
                value={formData.factory_tread_depth}
                onChange={(e) => handleChange("factory_tread_depth", e.target.value)}
                placeholder="e.g., 16.0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_tread_depth">Minimum Tread Depth (mm) *</Label>
              <Input
                id="minimum_tread_depth"
                type="number"
                step="0.1"
                value={formData.minimum_tread_depth}
                onChange={(e) => handleChange("minimum_tread_depth", e.target.value)}
                placeholder="e.g., 3.0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="life_expectancy">Life Expectancy (km)</Label>
              <Input
                id="life_expectancy"
                type="number"
                value={formData.life_expectancy}
                onChange={(e) => handleChange("life_expectancy", e.target.value)}
                placeholder="e.g., 150000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommended_pressure">Recommended Pressure (PSI)</Label>
              <Input
                id="recommended_pressure"
                type="number"
                step="0.1"
                value={formData.recommended_pressure}
                onChange={(e) => handleChange("recommended_pressure", e.target.value)}
                placeholder="e.g., 110"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_pressure">Max Pressure (PSI)</Label>
              <Input
                id="max_pressure"
                type="number"
                step="0.1"
                value={formData.max_pressure}
                onChange={(e) => handleChange("max_pressure", e.target.value)}
                placeholder="e.g., 120"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about this configuration..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData?.id ? 'Update' : 'Create'} Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default TyreConfigForm;