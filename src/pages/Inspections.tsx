import { BreakdownsList } from "@/components/inspections/BreakdownsList";
import FaultTracking from "@/components/inspections/FaultTracking";
import { InspectionHistory } from "@/components/inspections/InspectionHistory";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Inspections = () => {
  return (
    <Layout>
      <Tabs defaultValue="inspections" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="inspections" className="px-5 py-2.5 text-base">
            Inspections
          </TabsTrigger>
          <TabsTrigger value="faults" className="px-5 py-2.5 text-base">
            Fault Tracking
          </TabsTrigger>
          <TabsTrigger value="breakdowns" className="px-5 py-2.5 text-base">
            Breakdowns
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inspections">
          <InspectionHistory />
        </TabsContent>
        <TabsContent value="faults">
          <FaultTracking />
        </TabsContent>
        <TabsContent value="breakdowns">
          <BreakdownsList />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Inspections;