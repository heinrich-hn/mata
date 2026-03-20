import TyreInspection from "@/components/tyres/TyreInspection";
import MobileTyreInspectionForm from "@/components/inspections/MobileTyreInspectionForm";
import Layout from "@/components/Layout";
import { useIsMobile } from "@/hooks/use-mobile";

const TyreInspections = () => {
  const isMobile = useIsMobile();

  // Use mobile-optimized form on mobile devices
  if (isMobile) {
    return <MobileTyreInspectionForm />;
  }

  return (
    <Layout>
      <TyreInspection />
    </Layout>
  );
};

export default TyreInspections;