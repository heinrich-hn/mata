import { Car } from "lucide-react";
import TyreInspection from "./TyreInspection";

const TyreManagementSystem = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Car className="h-5 w-5" />
          Vehicle Tyre Store
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage tyres installed on each vehicle
        </p>
      </div>

      <TyreInspection />
    </div>
  );
};

export default TyreManagementSystem;