// src/components/VehicleMapView.tsx
// This component requires react-leaflet and leaflet packages
// Run: npm install react-leaflet leaflet @types/leaflet

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function VehicleMapView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Vehicle Map View
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
          <div className="text-center space-y-2">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Map view requires Leaflet integration
            </p>
            <p className="text-xs text-muted-foreground">
              Install: npm install react-leaflet leaflet @types/leaflet
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}