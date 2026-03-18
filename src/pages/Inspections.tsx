import FaultTracking from "@/components/FaultTracking";
import { InspectionHistory } from "@/components/inspections/InspectionHistory";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Inspections = () => {
  return (
    <Layout>
      <Tabs defaultValue="inspections" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inspections" className="px-5 py-2.5 text-base">
            Inspections
          </TabsTrigger>
          <TabsTrigger value="faults" className="px-5 py-2.5 text-base">
            Fault Tracking
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inspections">
          <InspectionHistory />
        </TabsContent>
        <TabsContent value="faults">
          <FaultTracking />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Inspections;