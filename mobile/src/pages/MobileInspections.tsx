import { BreakdownsPanel } from "@/components/inspections/BreakdownsPanel";
import MobileInspectionStart from "@/components/inspections/MobileInspectionStart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MobileInspections = () => {
  return (
    <Tabs defaultValue="inspection" className="w-full">
      <TabsList className="w-full grid grid-cols-2">
        <TabsTrigger value="inspection">New Inspection</TabsTrigger>
        <TabsTrigger value="breakdowns">Breakdowns</TabsTrigger>
      </TabsList>
      <TabsContent value="inspection">
        <MobileInspectionStart />
      </TabsContent>
      <TabsContent value="breakdowns">
        <BreakdownsPanel />
      </TabsContent>
    </Tabs>
  );
};

export default MobileInspections;
