import Layout from "@/components/Layout";
import InspectorManagement from "@/components/admin/InspectorManagement";
import { VendorsContent } from "@/pages/Vendors";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";

const InspectorProfiles = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "inspectors";

  return (
    <Layout>
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inspectors" className="px-5 py-2.5 text-base">
            Inspectors
          </TabsTrigger>
          <TabsTrigger value="vendors" className="px-5 py-2.5 text-base">
            Vendors
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inspectors">
          <InspectorManagement />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorsContent />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default InspectorProfiles;