import { AdditionalCostsForm } from "@/components/costs/AdditionalCostsForm";
import { CostForm } from "@/components/costs/CostForm";
import { CostList } from "@/components/costs/CostList";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CostEntry } from "@/types/operations";
import { Plus } from "lucide-react";
import { useState } from 'react';

const CostManagement = () => {
  const [showCostForm, setShowCostForm] = useState(false);
  const [selectedCost, setSelectedCost] = useState<CostEntry | null>(null);

  return (
    <Layout>
      <div className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Cost Overview</TabsTrigger>
            <TabsTrigger value="additional">Additional Costs</TabsTrigger>
            <TabsTrigger value="generator">Cost Generator</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cost Overview</CardTitle>
                    <CardDescription>View all operational costs</CardDescription>
                  </div>
                  <Button onClick={() => setShowCostForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Cost
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showCostForm ? (
                  <CostForm
                    tripId="sample-trip-id"
                    cost={selectedCost}
                    onSubmit={(success) => {
                      if (success) {
                        setShowCostForm(false);
                        setSelectedCost(null);
                      }
                    }}
                    onCancel={() => {
                      setShowCostForm(false);
                      setSelectedCost(null);
                    }}
                  />
                ) : (
                  <CostList
                    costs={[]}
                    onEdit={(cost) => {
                      // Convert CostWithAttachments to CostEntry
                      const costEntry: CostEntry = {
                        ...cost,
                        is_system_generated: cost.is_system_generated ?? false,
                        attachments: cost.attachments?.map(att => ({
                          ...att,
                          uploaded_at: new Date().toISOString(),
                        })),
                      };
                      setSelectedCost(costEntry);
                      setShowCostForm(true);
                    }}
                    onDelete={(_id) => {
                      // Cost deletion logic
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="additional">
            <Card>
              <CardHeader>
                <CardTitle>Additional Costs</CardTitle>
                <CardDescription>Add and manage additional operational costs</CardDescription>
              </CardHeader>
              <CardContent>
                <AdditionalCostsForm
                  tripId="sample-trip-id"
                  onCostsUpdate={() => {
                    // Costs updated
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generator">
            <Card>
              <CardHeader>
                <CardTitle>System Cost Generator</CardTitle>
                <CardDescription>Generate system-wide cost reports</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Cost generator will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CostManagement;