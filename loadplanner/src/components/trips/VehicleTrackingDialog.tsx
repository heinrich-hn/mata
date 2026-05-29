import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Load } from '@/hooks/useTrips';
import { createShareableTrackingLink, formatShareMessage, type ShareMessageStyle } from '@/lib/shareTracking';
import {
  formatLastConnected,
  getAssetDetails,
  getHeadingDirection,
  isAuthenticated,
  type TelematicsAsset,
} from '@/lib/telematicsGuru';
import { getLocationDisplayName } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Radio,
  Share2,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { toast } from 'sonner';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Utility to safely strip markdown/WhatsApp formatting wrappers without removing intended characters
const stripFormatting = (text: string) => {
  if (!text) return '';
  return text
    // Remove headers (e.g., "### Title" -> "Title")
    .replace(/^#+\s+/gm, '')
    // Remove asterisk wrappers (catches both **markdown** and *WhatsApp* bold)
    .replace(/\*+([^*]+)\*+/g, '$1')
    // Remove underscore wrappers (catches _italics_)
    .replace(/_+([^_]+)_+/g, '$1')
    // Remove tilde wrappers (catches ~strikethrough~)
    .replace(/~+([^~]+)~+/g, '$1');
};

// Create vehicle marker icon with professional styling and animations
function createVehicleIcon(asset: TelematicsAsset): L.DivIcon {
  const isMoving = (asset.speedKmH ?? 0) >= 5;
  const rotation = asset.heading || 0;

  if (isMoving) {
    const html = `
      <div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative;">
        <div style="
          position:absolute;width:32px;height:32px;background:rgba(22,163,74,0.3);
          border-radius:50%;animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        "></div>
        <div style="
          width:36px;height:36px;display:flex;align-items:center;justify-content:center;
          transform:rotate(${rotation}deg);transform-origin:center;
          filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));z-index:10;
        ">
          <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L21 21L12 17L3 21Z" fill="#16a34a" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </div>
        <style>
          @keyframes pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
        </style>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'vehicle-marker-moving',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24],
    });
  }

  // Stationary: solid red dot with subtle white border
  const html = `
    <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <div style="
        width:18px;height:18px;border-radius:50%;background:#ef4444;
        border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.4);
      "></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'vehicle-marker-stationary',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Map Centering Utility Component
function CenterOnVehicle({ asset }: { asset: TelematicsAsset | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.getContainer()) return;
    if (asset?.lastLatitude && asset?.lastLongitude) {
      try {
        map.setView([asset.lastLatitude, asset.lastLongitude], 14, {
          animate: true,
          duration: 0.5,
        });
      } catch (error) {
        console.warn('CenterOnVehicle error:', error);
      }
    }
  }, [asset, map]);

  return null;
}

interface VehicleTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: Load | null;
  telematicsAssetId?: string | null;
}

export function VehicleTrackingDialog({
  open,
  onOpenChange,
  load,
  telematicsAssetId,
}: VehicleTrackingDialogProps) {
  const [asset, setAsset] = useState<TelematicsAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [creatingLiveLink, setCreatingLiveLink] = useState(false);

  const fetchVehiclePosition = useCallback(async () => {
    if (!telematicsAssetId) {
      setError('No telematics ID linked to this vehicle.');
      return;
    }

    if (!isAuthenticated()) {
      setError('Authentication required. Please connect to Telematics Guru via the Live Tracking page.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assetData = await getAssetDetails(parseInt(telematicsAssetId));
      setAsset(assetData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vehicle position');
    } finally {
      setLoading(false);
    }
  }, [telematicsAssetId]);

  useEffect(() => {
    if (open && telematicsAssetId) {
      fetchVehiclePosition();
    }
  }, [open, telematicsAssetId, fetchVehiclePosition]);

  useEffect(() => {
    if (!open || !telematicsAssetId) return;
    const interval = setInterval(fetchVehiclePosition, 30000);
    return () => clearInterval(interval);
  }, [open, telematicsAssetId, fetchVehiclePosition]);

  useEffect(() => {
    if (!open) {
      setAsset(null);
      setError(null);
      setLastUpdate(null);
      setShareNote('');
    }
  }, [open]);

  // Derived state for rendering
  const isMoving = asset ? (asset.speedKmH ?? 0) >= 5 : false;
  const defaultCenter: [number, number] = [-19.0, 31.0];

  // Map Utility Functions
  const getGoogleMapsUrl = useCallback(() => {
    if (!asset?.lastLatitude || !asset?.lastLongitude) return null;
    return `https://www.google.com/maps?q=${asset.lastLatitude},${asset.lastLongitude}`;
  }, [asset]);

  const getDirectionsUrl = useCallback(() => {
    if (!asset?.lastLatitude || !asset?.lastLongitude) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${asset.lastLatitude},${asset.lastLongitude}`;
  }, [asset]);

  const copyCoordinates = useCallback(async () => {
    if (!asset?.lastLatitude || !asset?.lastLongitude) return;
    try {
      await navigator.clipboard.writeText(`${asset.lastLatitude}, ${asset.lastLongitude}`);
      toast.success('Coordinates copied to clipboard');
    } catch {
      toast.error('Failed to copy coordinates');
    }
  }, [asset]);

  const copyShareableLink = useCallback(async () => {
    const url = getGoogleMapsUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Location link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  }, [getGoogleMapsUrl]);

  const openInGoogleMaps = useCallback(() => {
    const url = getGoogleMapsUrl();
    if (url) window.open(url, '_blank');
  }, [getGoogleMapsUrl]);

  // Link Generation Utilities
  const createLiveTrackingLink = useCallback(async (expiryHours: number) => {
    if (!load?.id || !telematicsAssetId) {
      toast.error('Missing load or vehicle data required to create a live link.');
      return;
    }

    setCreatingLiveLink(true);
    try {
      const result = await createShareableTrackingLink({
        loadId: load.id,
        telematicsAssetId,
        expiryHours,
      });

      const originStr = getLocationDisplayName(load.origin);
      const destStr = getLocationDisplayName(load.destination);
      const vehicleName = load.fleet_vehicle?.vehicle_id || asset?.name || 'Unknown Vehicle';
      const loadName = load.load_id || 'Unknown Load';

      // Format status text
      let statusText = load.status ? load.status.charAt(0).toUpperCase() + load.status.slice(1) : 'Unknown';
      if (load.status?.toLowerCase() === 'loading') {
        statusText = `Loading at origin point (${originStr})`;
      } else if (load.status?.toLowerCase() === 'offloading') {
        statusText = `Offloading at destination (${destStr})`;
      }

      // Construct detailed clipboard text
      let clipboardText = `🚚 Load Tracking: ${loadName}\n`;
      clipboardText += `📊 Status: ${statusText}\n`;
      clipboardText += `📍 Route: ${originStr} → ${destStr}\n`;
      clipboardText += `🚛 Vehicle: ${vehicleName}\n`;

      if (load.loading_date) {
        clipboardText += `📅 Loading: ${load.loading_date}\n`;
      }
      if (load.offloading_date) {
        clipboardText += `📅 Offloading: ${load.offloading_date}\n`;
      }

      const note = shareNote.trim();
      if (note) {
        clipboardText += `\n📝 Note: ${note}\n`;
      }

      clipboardText += `\n🔗 Live tracking link (valid ${expiryHours}h):\n${result.shareUrl}`;

      await navigator.clipboard.writeText(clipboardText);
      toast.success(`Live link and load details copied! Valid for ${expiryHours} hours.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create live link');
    } finally {
      setCreatingLiveLink(false);
    }
  }, [load, telematicsAssetId, shareNote, asset]);

  const generateDetailedShareMessage = useCallback(async (
    withLiveLink: boolean = false,
    style: ShareMessageStyle = 'professional'
  ) => {
    if (!asset?.lastLatitude || !asset?.lastLongitude || !load) return null;

    let shareUrl: string | undefined;
    if (withLiveLink && telematicsAssetId) {
      try {
        const result = await createShareableTrackingLink({
          loadId: load.id,
          telematicsAssetId,
          expiryHours: 24,
        });
        shareUrl = result.shareUrl;
      } catch (err) {
        console.error('Failed to create live link for share:', err);
      }
    }

    return formatShareMessage(
      {
        load_id: load.load_id,
        origin: load.origin,
        destination: load.destination,
        loading_date: load.loading_date,
        offloading_date: load.offloading_date,
        cargo_type: load.cargo_type,
        status: load.status,
        time_window: load.time_window,
        driver: load.driver,
        fleet_vehicle: load.fleet_vehicle,
      },
      {
        name: asset.name || asset.code,
        speedKmH: asset.speedKmH,
        inTrip: asset.inTrip,
        latitude: asset.lastLatitude,
        longitude: asset.lastLongitude,
      },
      shareUrl,
      style,
      shareNote
    );
  }, [asset, load, telematicsAssetId, shareNote]);

  const shareViaWhatsApp = useCallback(async (withLiveLink = false, style: ShareMessageStyle = 'professional') => {
    const message = await generateDetailedShareMessage(withLiveLink, style);
    if (message) window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }, [generateDetailedShareMessage]);

  const copyDetailedMessage = useCallback(async (withLiveLink = false, style: ShareMessageStyle = 'professional') => {
    const message = await generateDetailedShareMessage(withLiveLink, style);
    if (message) {
      try {
        // Use the custom utility to safely remove styling wrappers without breaking payload data
        const plainTextMessage = stripFormatting(message);
        await navigator.clipboard.writeText(plainTextMessage);
        toast.success('Full tracking details copied to clipboard');
      } catch {
        toast.error('Failed to copy message');
      }
    }
  }, [generateDetailedShareMessage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Header Section */}
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle className="text-xl">
                Live Tracking: {load?.load_id}
              </DialogTitle>
              <DialogDescription className="text-base font-medium">
                {load?.fleet_vehicle?.vehicle_id || 'Unknown Vehicle'} • {load?.origin} → {load?.destination}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col p-6 bg-background gap-5 overflow-y-auto">
          {/* Controls & Status Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {asset ? (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-background border rounded-lg shadow-sm">
                  <div className="relative flex h-3 w-3 items-center justify-center">
                    {isMoving && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isMoving ? 'bg-green-600' : 'bg-red-500'}`}></span>
                  </div>
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    {isMoving ? 'In Transit' : 'Stationary'}
                  </span>
                  <div className="flex items-center gap-2 pl-3 border-l text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{asset.speedKmH} km/h</span>
                    {isMoving && <span>• {getHeadingDirection(asset.heading || 0)}</span>}
                  </div>
                </div>
              ) : (
                <div className="h-9 w-48 bg-muted rounded-lg animate-pulse" />
              )}

              {lastUpdate && (
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {asset?.lastLatitude && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" disabled={creatingLiveLink} className="font-medium shadow-sm">
                      {creatingLiveLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                      Share Tracking
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><Link2 className="w-4 h-4 mr-2" />Create Live Link</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {[4, 12, 24, 48, 72].map(hours => (
                          <DropdownMenuItem key={hours} onClick={() => createLiveTrackingLink(hours)}>
                            <Clock className="w-4 h-4 mr-2" /> Valid for {hours} hours
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><MessageCircle className="w-4 h-4 mr-2" />Share via WhatsApp</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Professional (Recommended)</div>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(true, 'professional')}><Truck className="w-4 h-4 mr-2" /> 📊 Full branded message</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other Formats</div>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(true, 'detailed')}><AlertCircle className="w-4 h-4 mr-2" /> 📋 Detailed (Internal)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(true, 'compact')}><MapPin className="w-4 h-4 mr-2" /> ⚡ Compact summary</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(false, 'minimal')}><Navigation className="w-4 h-4 mr-2" /> 📍 Quick location only</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><Copy className="w-4 h-4 mr-2" />Copy Details</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        <DropdownMenuItem onClick={() => copyDetailedMessage(true, 'professional')}><Truck className="w-4 h-4 mr-2" /> Professional format</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyDetailedMessage(true, 'detailed')}><AlertCircle className="w-4 h-4 mr-2" /> Detailed format</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyDetailedMessage(true, 'compact')}><MapPin className="w-4 h-4 mr-2" /> Compact format</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={copyShareableLink}><ExternalLink className="w-4 h-4 mr-2" /> Google Maps link</DropdownMenuItem>
                        <DropdownMenuItem onClick={copyCoordinates}><Navigation className="w-4 h-4 mr-2" /> GPS coordinates</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={openInGoogleMaps}><ExternalLink className="w-4 h-4 mr-2" /> Open in Google Maps</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { const url = getDirectionsUrl(); if (url) window.open(url, '_blank'); }}><Navigation className="w-4 h-4 mr-2" /> Get Directions</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="outline" size="sm" onClick={fetchVehiclePosition} disabled={loading} className="shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Error Message UI */}
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg flex items-start gap-3 border border-destructive/20 text-sm font-medium">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Share Note Configuration */}
          <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-muted">
            <Label htmlFor="share-note" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Share Message Configuration
            </Label>
            <Textarea
              id="share-note"
              value={shareNote}
              onChange={(e) => setShareNote(e.target.value)}
              placeholder="Add an optional dispatcher note (Included when copying or sharing to WhatsApp)..."
              rows={2}
              maxLength={500}
              className="resize-none text-sm bg-background/50 border-muted-foreground/20 focus-visible:ring-1"
            />
          </div>

          {/* Map Container */}
          <div className="flex-1 rounded-xl overflow-hidden border shadow-inner relative z-0 min-h-[300px]">
            {!telematicsAssetId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/40 z-10">
                <div className="bg-background p-6 rounded-2xl shadow-sm border text-center max-w-sm">
                  <Truck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-1">No Telematics Setup</h3>
                  <p className="text-muted-foreground text-sm">
                    This vehicle is not currently linked to a tracking ID in the Fleet Management settings.
                  </p>
                </div>
              </div>
            ) : loading && !asset ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20 backdrop-blur-sm z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : null}

            <MapContainer
              center={asset?.lastLatitude && asset?.lastLongitude ? [asset.lastLatitude, asset.lastLongitude] : defaultCenter}
              zoom={14}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              scrollWheelZoom
              zoomControl={false} // Clean up UI, let user scroll or double click
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">Carto</a>'
              />
              {asset?.lastLatitude && asset?.lastLongitude && (
                <Marker position={[asset.lastLatitude, asset.lastLongitude]} icon={createVehicleIcon(asset)}>
                  <Popup className="rounded-lg shadow-xl border-0">
                    <div className="min-w-[220px] p-1">
                      <div className="font-bold text-base mb-3 border-b pb-2 flex items-center gap-2">
                        <Radio className="w-4 h-4 text-primary" />
                        {asset.name || asset.code || `Vehicle ${asset.id}`}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Load:</span> <span className="font-medium">{load?.load_id}</span></div>
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Speed:</span> <span className="font-medium">{asset.speedKmH} km/h</span></div>
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Heading:</span> <span className="font-medium">{getHeadingDirection(asset.heading || 0)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Status:</span>
                          <span className={isMoving ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                            {isMoving ? 'Moving' : 'Stationary'}
                          </span>
                        </div>
                        <div className="pt-2 mt-2 border-t text-xs text-muted-foreground text-center">
                          Last ping: {formatLastConnected(asset.lastConnectedUtc)}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
              <CenterOnVehicle asset={asset} />
            </MapContainer>
          </div>

          {/* Footer Details */}
          {load && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-muted/40 border rounded-lg px-4 py-3 gap-3">
              <div className="flex items-center gap-3 font-medium">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">{getLocationDisplayName(load.origin)}</span>
                </div>
                <Navigation className="w-3.5 h-3.5 text-muted-foreground/50 rotate-90" />
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-destructive" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">{getLocationDisplayName(load.destination)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-md border shadow-sm text-xs font-semibold text-muted-foreground">
                <Truck className="w-3.5 h-3.5" />
                Driver: <span className="text-foreground">{load.driver?.name || 'Unassigned'}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}