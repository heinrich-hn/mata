import { BreakdownsList } from "@/components/inspections/BreakdownsList";
import FaultTracking from "@/components/inspections/FaultTracking";
import IncidentManagement from "@/components/incidents/IncidentManagement";
import { InspectionHistory } from "@/components/inspections/InspectionHistory";
import { OutOfCommissionList } from "@/components/inspections/OutOfCommissionList";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";

const Inspections = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "inspections";

  return (
    <Layout>
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:max-w-3xl sm:grid-cols-5">
            <TabsTrigger value="inspections" className="px-5 py-2.5 text-base whitespace-nowrap">
              Inspections
            </TabsTrigger>
            <TabsTrigger value="faults" className="px-5 py-2.5 text-base whitespace-nowrap">
              Faults
            </TabsTrigger>
            <TabsTrigger value="out-of-commission" className="px-5 py-2.5 text-base whitespace-nowrap">
              Out of Commission
            </TabsTrigger>
            <TabsTrigger value="breakdowns" className="px-5 py-2.5 text-base whitespace-nowrap">
              Breakdowns
            </TabsTrigger>
            <TabsTrigger value="incidents" className="px-5 py-2.5 text-base whitespace-nowrap">
              Incidents
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="inspections">
          <InspectionHistory />
        </TabsContent>
        <TabsContent value="faults">
          <FaultTracking />
        </TabsContent>
        <TabsContent value="out-of-commission">
          <OutOfCommissionList />
        </TabsContent>
        <TabsContent value="breakdowns">
          <BreakdownsList />
        </TabsContent>
        <TabsContent value="incidents">
          <IncidentManagement />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Inspections;