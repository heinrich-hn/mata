import { Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import WorkshopMobileLayout from "@/components/mobile/WorkshopMobileLayout";
import Auth from "@/pages/Auth";
import MobileInspections from "@/pages/MobileInspections";
import TyreInspections from "@/pages/TyreInspections";
import InspectionDetails from "@/pages/InspectionDetails";
import InspectionTypeSelector from "@/components/inspections/InspectionTypeSelector";
import TyreManagement from "@/pages/TyreManagement";

const App = () => {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/auth" element={<Auth />} />

        {/* Sub-pages: full-screen with their own back navigation */}
        <Route path="/inspections/mobile" element={<ProtectedRoute><MobileInspections /></ProtectedRoute>} />
        <Route path="/inspections/type-selector" element={<ProtectedRoute><InspectionTypeSelector /></ProtectedRoute>} />
        <Route path="/inspections/tyre" element={<ProtectedRoute><TyreInspections /></ProtectedRoute>} />
        <Route path="/inspections/:id" element={<ProtectedRoute><InspectionDetails /></ProtectedRoute>} />
        <Route path="/tyre-management" element={<ProtectedRoute><TyreManagement /></ProtectedRoute>} />

        {/* Default: Workshop shell with tabs */}
        <Route path="/*" element={<ProtectedRoute><WorkshopMobileLayout /></ProtectedRoute>} />
      </Routes>
    </TooltipProvider>
  );
};

export default App;
