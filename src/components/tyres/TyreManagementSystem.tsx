import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TyreInspection from "./TyreInspection";
import TyreInventory from "./TyreInventory";
import FleetTyreReports from "./FleetTyreReports";
import MobileTyreInspections from "./MobileTyreInspections";

const TyreManagementSystem = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="vehicle-store" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="vehicle-store" className="px-5 py-2.5 text-base">
            Vehicle Store
          </TabsTrigger>
          <TabsTrigger value="mobile-inspections" className="px-5 py-2.5 text-base">
            Mobile Inspections
          </TabsTrigger>
          <TabsTrigger value="inventory" className="px-5 py-2.5 text-base">
            Inventory
          </TabsTrigger>
          <TabsTrigger value="analytics" className="px-5 py-2.5 text-base">
            Analytics & Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vehicle-store">
          <TyreInspection />
        </TabsContent>

        <TabsContent value="mobile-inspections">
          <MobileTyreInspections />
        </TabsContent>

        <TabsContent value="inventory">
          <TyreInventory />
        </TabsContent>

        <TabsContent value="analytics">
          <FleetTyreReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TyreManagementSystem;