import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Package, TrendingUp, Wrench } from "lucide-react";

interface JobCardCostSummaryProps {
  jobCardId: string;
}

interface CostSummary {
  inventory_parts_cost: number;
  external_parts_cost: number;
  services_cost: number;
  total_parts_cost: number;
  total_items: number;
  inventory_items_count: number;
  external_items_count: number;
  service_items_count: number;
  items_with_documents: number;
}

export default function JobCardCostSummary({ jobCardId }: JobCardCostSummaryProps) {
  const { data: costSummary, isLoading } = useQuery({
    queryKey: ["job-card-cost-summary", jobCardId],
    queryFn: async () => {
      // NOTE: This requires the database migration to be applied first
      // Query all fields to work after migration
      const { data: partsData, error: partsError } = await supabase
        .from("parts_requests")
        .select("*")
        .eq("job_card_id", jobCardId)
        .neq("status", "cancelled");

      if (partsError) {
        console.warn("Error fetching parts for cost summary:", partsError);
        throw partsError;
      }

      const summary = {
        inventory_parts_cost: 0,
        external_parts_cost: 0,
        services_cost: 0,
        total_parts_cost: 0,
        total_items: 0,
        inventory_items_count: 0,
        external_items_count: 0,
        service_items_count: 0,
        items_with_documents: 0,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partsData?.forEach((part: any) => {
        const price = part.total_price || 0;
        summary.total_items++;
        summary.total_parts_cost += price;

        if (part.document_url) {
          summary.items_with_documents++;
        }

        if (part.inventory_id) {
          summary.inventory_parts_cost += price;
          summary.inventory_items_count++;
        } else if (part.is_service) {
          summary.services_cost += price;
          summary.service_items_count++;
        } else if (part.vendor_id) {
          summary.external_parts_cost += price;
          summary.external_items_count++;
        }
      });

      return summary as CostSummary;
    },
  });  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!costSummary) return null;

  const documentCoverage = costSummary.total_items > 0
    ? (costSummary.items_with_documents / costSummary.total_items) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Total Cost Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Parts & Services Cost</p>
              <p className="text-3xl font-bold text-blue-900">
                ${costSummary.total_parts_cost.toFixed(2)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-700" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="secondary">{costSummary.total_items} items</Badge>
            <Badge
              variant={documentCoverage >= 80 ? "default" : "destructive"}
            >
              {documentCoverage.toFixed(0)}% documented
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Inventory Parts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              Inventory Parts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              ${costSummary.inventory_parts_cost.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {costSummary.inventory_items_count} items from stock
            </p>
          </CardContent>
        </Card>

        {/* External Parts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-600" />
              External Parts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-700">
              ${costSummary.external_parts_cost.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {costSummary.external_items_count} vendor parts
            </p>
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-purple-600" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-700">
              ${costSummary.services_cost.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {costSummary.service_items_count} service items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document Status */}
      {costSummary.total_items > 0 && documentCoverage < 100 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-900">
              <strong>{costSummary.total_items - costSummary.items_with_documents}</strong> items
              are missing cost documentation. Please upload invoices or receipts.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}