import DriverBehaviorGrid from "@/components/driver/DriverBehaviorGrid";
import DriverDisciplinarySection from "@/components/driver/DriverDisciplinarySection";
import DriverManagementSection from "@/components/driver/DriverManagementSection";
import DriverPlanningSection from "@/components/driver/DriverPlanningSection";
import DriverRecruitmentSection from "@/components/driver/DriverRecruitmentSection";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CalendarDays, ShieldAlert, UserPlus, Users } from "lucide-react";

export default function DriverManagement() {
  return (
    <Layout>
      <div className="space-y-6">
        <Tabs defaultValue="registry" className="space-y-6">
          <TabsList className="flex overflow-x-auto w-full lg:grid lg:grid-cols-5">
            <TabsTrigger value="registry" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Driver Registry
            </TabsTrigger>
            <TabsTrigger value="recruitment" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              HR Recruitment
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Behavior Events
            </TabsTrigger>
            <TabsTrigger value="disciplinary" className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Disciplinary
            </TabsTrigger>
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Driver Planning
            </TabsTrigger>
          </TabsList>

          {/* Driver Registry */}
          <TabsContent value="registry">
            <DriverManagementSection />
          </TabsContent>

          {/* HR Driver Recruitment */}
          <TabsContent value="recruitment">
            <DriverRecruitmentSection />
          </TabsContent>
          {/* Behavior Events */}
          <TabsContent value="behavior">
            <DriverBehaviorGrid />
          </TabsContent>

          {/* Disciplinary */}
          <TabsContent value="disciplinary">
            <DriverDisciplinarySection />
          </TabsContent>

          {/* Driver Planning */}
          <TabsContent value="planning">
            <DriverPlanningSection />
          </TabsContent>


        </Tabs>
      </div>
    </Layout>
  );
}