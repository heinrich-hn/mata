import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Download, Printer, QrCode, Search } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import PositionQRScanner, { type ScanResult, type TyreData, type VehicleData, type PositionData } from "./PositionQRScanner";

type VehicleBasic = Pick<Database["public"]["Tables"]["vehicles"]["Row"], "id" | "registration_number" | "fleet_number">;

interface TyreQRCodeSystemProps {
  tyreTin?: string;
  tyreId?: string;
  vehicleId?: string;
  position?: string;
  onScan?: (tin: string) => void;
}

const TyreQRCodeSystem = ({ tyreTin, tyreId, vehicleId, position, onScan }: TyreQRCodeSystemProps) => {
  const { toast } = useToast();
  const [searchTin, setSearchTin] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [showPositionQR, setShowPositionQR] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleId || "");
  const [vehicles, setVehicles] = useState<VehicleBasic[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [batchPositions, setBatchPositions] = useState<string[]>([]);

  // Tyre QR Code
  const tyreQrValue = tyreTin || tyreId || "NO-TIN";
  const tyreQrUrl = `${window.location.origin}/tyres/${tyreQrValue}`;

  // Position QR Code (URL format for deep linking)
  const getPositionQrValue = (pos?: string) => {
    const currentPosition = pos || position;
    if (!selectedVehicle || !currentPosition) return "";
    const vehicle = vehicles.find(v => v.id === selectedVehicle);
    if (!vehicle) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/inspections/mobile?vehicle=${vehicle.fleet_number}-${vehicle.registration_number}&position=${currentPosition}`;
  };

  // Fetch vehicles for position QR generation
  useEffect(() => {
    const fetchVehicles = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('id, registration_number, fleet_number')
        .order('registration_number');
      if (data) setVehicles(data);
    };
    fetchVehicles();
  }, []);

  const handleDownloadQR = (qrId: string, filename: string, label: string) => {
    const svg = document.getElementById(qrId);
    if (!svg) {
      toast({
        title: "Download Failed",
        description: "QR code element not found. Please try again.",
        variant: "destructive"
      });
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = filename;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast({
        title: "QR Code Downloaded",
        description: `QR code for ${label} has been downloaded`,
      });
    };

    img.onerror = () => {
      console.error('Failed to load QR code image');
      toast({
        title: "Download Failed",
        description: "Failed to process QR code image. Please try again.",
        variant: "destructive"
      });
    };

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  const handleScanResult = (result: ScanResult) => {
    if (result.type === 'tyre' && 'tin' in result.data && onScan) {
      onScan((result.data as TyreData).tin);
    } else if (result.type === 'position' && 'position' in result.data) {
      const posData = result.data as PositionData;
      toast({
        title: "Position Scanned",
        description: `${posData.fleetNumber} ${posData.registration} - ${posData.position}`,
      });
    } else if (result.type === 'vehicle' && 'fleetNumber' in result.data) {
      const vehData = result.data as VehicleData;
      toast({
        title: "Vehicle Scanned",
        description: `${vehData.fleetNumber} ${vehData.registration}`,
      });
    }
    setShowScanner(false);
  };

  const handleSearch = () => {
    if (searchTin && onScan) {
      onScan(searchTin);
      toast({
        title: "TIN Lookup",
        description: `Searching for tyre: ${searchTin}`,
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Dual QR Code System
          </CardTitle>
          <CardDescription>
            Generate QR codes for tyres and fleet positions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tyre" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tyre">Tyre QR Codes</TabsTrigger>
              <TabsTrigger value="position">Position QR Codes</TabsTrigger>
            </TabsList>

            <TabsContent value="tyre" className="space-y-4">
              {/* Tyre QR Code Generation */}
              {(tyreTin || tyreId) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">QR Code for {tyreTin || tyreId}</h3>
                      <p className="text-sm text-muted-foreground">
                        Scan to quickly access tyre information
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)}>
                      {showQR ? "Hide" : "Show"} QR Code
                    </Button>
                  </div>

                  {showQR && (
                    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg border">
                      <div id={`qr-code-tyre-${tyreQrValue}`}>
                        <QRCode value={tyreQrUrl} size={200} />
                      </div>
                      <p className="text-sm text-center text-muted-foreground">
                        TIN: {tyreTin || "N/A"}
                      </p>
                      <Button
                        onClick={() => handleDownloadQR(`qr-code-tyre-${tyreQrValue}`, `tyre-qr-${tyreQrValue}.png`, tyreQrValue)}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download QR Code
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TIN Lookup */}
              <div className="space-y-2">
                <Label htmlFor="tin-search">Quick TIN Lookup</Label>
                <div className="flex gap-2">
                  <Input
                    id="tin-search"
                    value={searchTin}
                    onChange={(e) => setSearchTin(e.target.value)}
                    placeholder="Enter Tyre Identification Number (TIN)"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} size="icon">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="position" className="space-y-4">
              {/* Position QR Code Generation */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vehicle">Select Vehicle</Label>
                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                      <SelectTrigger id="vehicle">
                        <SelectValue placeholder="Choose vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.fleet_number} - {v.registration_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="position-input">Position</Label>
                    <Input
                      id="position-input"
                      value={position || ""}
                      placeholder="e.g., V3"
                      disabled
                    />
                  </div>
                </div>

                {selectedVehicle && position && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium">Position QR Code</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPositionQR(!showPositionQR)}
                      >
                        {showPositionQR ? "Hide" : "Show"} QR
                      </Button>
                    </div>

                    {showPositionQR && (
                      <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg border">
                        <div id={`qr-code-position-${getPositionQrValue()}`}>
                          <QRCode value={getPositionQrValue()} size={200} />
                        </div>
                        <div className="text-sm text-center space-y-1">
                          <p className="font-medium">{getPositionQrValue()}</p>
                          <p className="text-muted-foreground">Scan to access position info</p>
                        </div>
                        <Button
                          onClick={() => handleDownloadQR(
                            `qr-code-position-${getPositionQrValue()}`,
                            `position-qr-${getPositionQrValue()}.png`,
                            getPositionQrValue()
                          )}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download QR Code
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Printer className="w-4 h-4 mr-2" />
                      Batch Generate for Vehicle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Batch Position QR Generation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Generate QR codes for all positions on a vehicle for printing labels
                      </p>
                      <Button className="w-full" onClick={() => {
                        // Generate 10 example positions
                        const positions = Array.from({length: 10}, (_, i) => `pos${i+1}`);
                        setBatchPositions(positions);
                      }}>
                        Generate for All Positions
                      </Button>

                      {batchPositions.length > 0 && (
                        <div className="grid grid-cols-3 gap-4">
                          {batchPositions.map((pos) => (
                            <div key={pos} className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border">
                              <div id={`qr-code-batch-${pos}`}>
                                <QRCode value={getPositionQrValue(pos)} size={128} />
                              </div>
                              <p className="text-sm font-medium">Position: {pos}</p>
                              <Button
                                onClick={() => handleDownloadQR(
                                  `qr-code-batch-${pos}`,
                                  `position-qr-${pos}.png`,
                                  `Position ${pos}`
                                )}
                                variant="ghost"
                                size="sm"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* QR Scanner */}
      {showScanner ? (
        <PositionQRScanner
          onScanSuccess={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>QR Code Scanner</CardTitle>
            <CardDescription>
              Use your device camera to scan tyre or position QR codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowScanner(true)} variant="outline" className="w-full">
              <QrCode className="w-4 h-4 mr-2" />
              Open Camera Scanner
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TyreQRCodeSystem;