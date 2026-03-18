import { useState, useEffect, useCallback } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, X, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateQRCode, formatQRError } from "@/utils/qrValidation";

interface TyreData {
  tin: string;
  fullCode?: string;
}

interface VehicleData {
  fleetNumber: string;
  registration: string;
  fullCode?: string;
}

interface PositionData {
  fleetNumber: string;
  registration: string;
  position: string;
  fullCode?: string;
}

export interface ScanResult {
  type: 'tyre' | 'position' | 'vehicle';
  data: TyreData | VehicleData | PositionData;
}

export type { TyreData, VehicleData, PositionData };

interface PositionQRScannerProps {
  onScanSuccess?: (result: ScanResult) => void;
  onClose?: () => void;
}

const PositionQRScanner = ({ onScanSuccess, onClose }: PositionQRScannerProps) => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);

  const stopScanning = useCallback(() => {
    if (scanner) {
      scanner.clear().catch(console.error);
      setScanner(null);
    }
    setIsScanning(false);
  }, [scanner]);

  const handleScanError = useCallback((errorMessage: string) => {
    // Ignore common scanning errors (like "No QR code found")
    if (!errorMessage.includes("NotFoundException")) {
      console.warn("QR Scan Error:", errorMessage);
    }
  }, []);

  const handleQRCodeScanned = useCallback((decodedText: string) => {
    // Validate QR code format first
    const validation = validateQRCode(decodedText);

    if (!validation.isValid) {
      toast({
        title: "Invalid QR Code",
        description: formatQRError(validation),
        variant: "destructive",
      });
      return;
    }

    // Parse QR code data
    let result: ScanResult | null = null;

    // Check if it's a URL-based QR code (deep link format)
    if (validation.type === 'vehicle' && decodedText.includes('/inspections/mobile')) {
      try {
        const url = new URL(decodedText);
        const vehicleParam = url.searchParams.get('vehicle');
        const positionParam = url.searchParams.get('position');

        if (vehicleParam) {
          const parts = vehicleParam.split('-');
          const fleetNumber = parts[0];
          const registration = parts.slice(1).join('-');

          if (positionParam) {
            // Position QR with deep link
            result = {
              type: 'position',
              data: {
                fleetNumber,
                registration,
                position: positionParam,
                fullCode: `${vehicleParam}-${positionParam}`,
              },
            };
          } else {
            // Vehicle QR with deep link
            result = {
              type: 'vehicle',
              data: {
                fleetNumber,
                registration,
                fullCode: vehicleParam,
              },
            };
          }
        }
      } catch (e) {
        console.error("Failed to parse URL QR code:", e);
      }
    }
    // Check if it's a vehicle QR code (legacy text format: VEHICLE:FLEET-REG)
    else if (decodedText.startsWith('VEHICLE:')) {
      const vehicleCode = decodedText.replace('VEHICLE:', '');
      const parts = vehicleCode.split('-');
      const fleetNumber = parts[0];
      const registration = parts.slice(1).join('-');
      result = {
        type: 'vehicle',
        data: {
          fleetNumber,
          registration,
          fullCode: vehicleCode,
        },
      };
    }
    // Check if it's a position QR code (legacy text format: FLEET-REG-POSITION)
    else if (decodedText.includes('-') && decodedText.split('-').length === 3) {
      const [fleet, reg, position] = decodedText.split('-');
      result = {
        type: 'position',
        data: {
          fleetNumber: fleet,
          registration: reg,
          position: position,
          fullCode: decodedText,
        },
      };
    }
    // Check if it's a tyre QR code (contains URL or TIN)
    else if (decodedText.includes('/tyres/') || decodedText.length >= 6) {
      const tin = decodedText.includes('/tyres/')
        ? decodedText.split('/tyres/')[1]
        : decodedText;

      result = {
        type: 'tyre',
        data: {
          tin: tin,
          fullCode: decodedText,
        },
      };
    }

    if (result) {
      setLastScan(result);
      toast({
        title: "QR Code Scanned",
        description: `Successfully scanned ${result.type === 'tyre' ? 'tyre' : result.type === 'vehicle' ? 'vehicle' : 'position'} QR code`,
      });

      // Call the callback if provided
      if (onScanSuccess) {
        onScanSuccess(result);
      }

      // Auto-stop scanning after successful scan
      setTimeout(() => {
        stopScanning();
      }, 1000);
    } else {
      toast({
        title: "Invalid QR Code",
        description: "The scanned QR code format is not recognized",
        variant: "destructive",
      });
    }
  }, [toast, onScanSuccess, stopScanning]);

  const initializeScanner = useCallback(() => {
    const qrScanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false
    );

    qrScanner.render(handleQRCodeScanned, handleScanError);
    setScanner(qrScanner);
  }, [handleQRCodeScanned, handleScanError]);

  useEffect(() => {
    if (isScanning && !scanner) {
      initializeScanner();
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [isScanning, scanner, initializeScanner]);

  const startScanning = () => {
    setIsScanning(true);
    setLastScan(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>QR Code Scanner</CardTitle>
            <CardDescription>
              Scan tyre or position QR codes for quick access
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScanning ? (
          <div className="space-y-4">
            <Button onClick={startScanning} className="w-full" size="lg">
              <Camera className="w-5 h-5 mr-2" />
              Start Camera Scanner
            </Button>

            {lastScan && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 mb-2">Last Scan Successful</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={lastScan.type === 'tyre' ? 'default' : lastScan.type === 'vehicle' ? 'secondary' : 'outline'}>
                          {lastScan.type === 'tyre' ? 'Tyre' : lastScan.type === 'vehicle' ? 'Vehicle' : 'Position'}
                        </Badge>
                      </div>
                      {lastScan.type === 'tyre' ? (
                        <p className="text-green-700">TIN: {(lastScan.data as TyreData).tin}</p>
                      ) : lastScan.type === 'vehicle' ? (
                        <div className="text-green-700">
                          <p>Fleet: {(lastScan.data as VehicleData).fleetNumber}</p>
                          <p>Registration: {(lastScan.data as VehicleData).registration}</p>
                        </div>
                      ) : (
                        <div className="text-green-700">
                          <p>Fleet: {(lastScan.data as PositionData).fleetNumber}</p>
                          <p>Vehicle: {(lastScan.data as PositionData).registration}</p>
                          <p>Position: {(lastScan.data as PositionData).position}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">Supported QR Code Formats:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Vehicle QR:</strong> Format: VEHICLE:FLEET-REGISTRATION (e.g., VEHICLE:33H-JFK963FS)</li>
                <li><strong>Tyre QR:</strong> Contains TIN or URL with tyre identifier</li>
                <li><strong>Position QR:</strong> Format: FLEET-REGISTRATION-POSITION (e.g., 33H-JFK963FS-V3)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div id="qr-reader" className="w-full" />
            <Button onClick={stopScanning} variant="destructive" className="w-full">
              <X className="w-4 h-4 mr-2" />
              Stop Scanner
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PositionQRScanner;