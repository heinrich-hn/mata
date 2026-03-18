// src/components/VehicleOverviewReport.tsx
// This component uses legacy database tables that don't exist in the current schema
// Tables referenced: workorders, fuel_logs, daily_reports, incidents, vehicles_history

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function VehicleOverviewReport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Vehicle Overview Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
          <div className="text-center space-y-2">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This component requires database schema updates
            </p>
            <p className="text-xs text-muted-foreground">
              Legacy tables: workorders, fuel_logs, daily_reports, incidents, vehicles_history
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}