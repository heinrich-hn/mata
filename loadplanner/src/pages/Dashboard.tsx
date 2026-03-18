import { PackagingChart } from "@/components/dashboard/PackagingChart";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { CreateLoadDialog } from "@/components/trips/CreateTripDialog";
import { Button } from "@/components/ui/button";
import { useLoads } from "@/hooks/useTrips";
import {
  BarChart3,
  Plus,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { data: loads = [] } = useLoads();

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="flex gap-2">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New Load
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate("/reports")}
            >
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekly Chart */}
        <WeeklyChart loads={loads} />

        {/* Packaging Chart - Backload Operations */}
        <PackagingChart loads={loads} />

        {/* Weekly Summary */}
        <WeeklySummary loads={loads} />
      </div>

      <CreateLoadDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}