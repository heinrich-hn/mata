import Layout from "@/components/Layout";
import InspectorManagement from "@/components/admin/InspectorManagement";

const InspectorProfiles = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <InspectorManagement />
      </div>
    </Layout>
  );
};

export default InspectorProfiles;