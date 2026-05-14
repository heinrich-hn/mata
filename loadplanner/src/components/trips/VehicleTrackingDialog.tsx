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
import { createShareableTrackingLink, type ShareMessageStyle } from '@/lib/shareTracking';
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
import { AlertCircle, Clock, Copy, ExternalLink, Link2, Loader2, MapPin, MessageCircle, Navigation, Share2, Truck, Calendar, Package, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { toast } from 'sonner';

// Constants
const AUTO_REFRESH_INTERVAL_MS = 30000;
const DEFAULT_MAP_ZOOM_LEVEL = 14;
const DEFAULT_CENTER: [number, number] = [-19.0, 31.0]; // Zimbabwe
const DEFAULT_WHATSAPP_EXPIRY_HOURS = 24;
const MAX_NOTE_LENGTH = 500;

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Helper: Vehicle speed threshold for movement detection
const MOVEMENT_SPEED_THRESHOLD_KPH = 5;

// Vehicle icon configuration
const VEHICLE_ICON_CONFIG = {
  moving: {
    size: [40, 40] as [number, number],
    anchor: [20, 20] as [number, number],
    popupAnchor: [0, -20] as [number, number],
    color: '#16a34a',
  },
  stationary: {
    size: [24, 24] as [number, number],
    anchor: [12, 12] as [number, number],
    popupAnchor: [0, -12] as [number, number],
    color: '#dc2626',
  },
};

/**
 * Helper function to format dates safely
 */
function formatDateSafely(date: string | Date | undefined | null): string {
  if (!date) return 'TBD';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Creates a custom vehicle marker icon for the map
 * Moving vehicles show as a green directional arrow
 * Stationary vehicles show as a solid red dot
 */
function createVehicleIcon(asset: TelematicsAsset): L.DivIcon {
  const isMoving = (asset.speedKmH ?? 0) >= MOVEMENT_SPEED_THRESHOLD_KPH;
  const rotation = asset.heading || 0;

  if (isMoving) {
    const html = `
      <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <div style="
          width:36px;height:36px;display:flex;align-items:center;justify-content:center;
          transform:rotate(${rotation}deg);transform-origin:center;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">
          <svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2 L21 21 L12 17 L3 21 Z" fill="${VEHICLE_ICON_CONFIG.moving.color}" stroke="white" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'vehicle-marker moving',
      iconSize: VEHICLE_ICON_CONFIG.moving.size,
      iconAnchor: VEHICLE_ICON_CONFIG.moving.anchor,
      popupAnchor: VEHICLE_ICON_CONFIG.moving.popupAnchor,
    });
  }

  const html = `
    <div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <div style="
        width:18px;height:18px;border-radius:50%;background:${VEHICLE_ICON_CONFIG.stationary.color};
        border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      "></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'vehicle-marker stationary',
    iconSize: VEHICLE_ICON_CONFIG.stationary.size,
    iconAnchor: VEHICLE_ICON_CONFIG.stationary.anchor,
    popupAnchor: VEHICLE_ICON_CONFIG.stationary.popupAnchor,
  });
}

/**
 * Component to center the map on the vehicle's current position
 */
function CenterOnVehicle({ asset }: { asset: TelematicsAsset | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map?.getContainer() || !asset?.lastLatitude || !asset?.lastLongitude) return;

    try {
      map.setView([asset.lastLatitude, asset.lastLongitude], DEFAULT_MAP_ZOOM_LEVEL);
    } catch (error) {
      console.warn('[CenterOnVehicle] Failed to center map:', error);
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

/**
 * Formats a detailed load summary for inclusion in share messages
 */
function formatLoadDetails(load: Load, includeHeader: boolean = true): string {
  const lines: string[] = [];
  
  if (includeHeader) {
    lines.push('📋 LOAD DETAILS');
    lines.push('─'.repeat(30));
  }
  
  lines.push(`🔢 Load ID: ${load.load_id}`);
  lines.push(`📦 Cargo: ${load.cargo_type || 'Not specified'}`);
  lines.push(`🔄 Status: ${load.status?.toUpperCase() || 'Active'}`);
  lines.push('');
  lines.push(`📍 Route:`);
  lines.push(`   From: ${getLocationDisplayName(load.origin)}`);
  lines.push(`   To: ${getLocationDisplayName(load.destination)}`);
  lines.push('');
  
  if (load.loading_date) {
    lines.push(`📅 Loading Date: ${formatDateSafely(load.loading_date)}`);
  }
  if (load.offloading_date) {
    lines.push(`🏁 Offloading Date: ${formatDateSafely(load.offloading_date)}`);
  }
  if (load.time_window) {
    lines.push(`⏰ Time Window: ${load.time_window}`);
  }
  
  if (load.driver?.name) {
    lines.push(`👨‍✈️ Driver: ${load.driver.name}`);
  }
  
  if (load.fleet_vehicle?.vehicle_id) {
    lines.push(`🚛 Vehicle: ${load.fleet_vehicle.vehicle_id}`);
  }
  
  return lines.join('\n');
}

/**
 * Formats the complete shareable message with load details and tracking info
 */
function formatCompleteShareMessage(
  load: Load,
  asset: TelematicsAsset,
  shareUrl?: string,
  customNote?: string,
  includeLoadDetails: boolean = true
): string {
  const sections: string[] = [];
  
  // Header with load identification
  sections.push('🚛 VEHICLE TRACKING REPORT');
  sections.push('='.repeat(40));
  sections.push('');
  
  // Load name/identification prominently displayed
  sections.push(`📋 LOAD: ${load.load_id}`);
  if (load.cargo_type) {
    sections.push(`📦 CARGO: ${load.cargo_type}`);
  }
  sections.push('');
  
  // Load details section
  if (includeLoadDetails) {
    sections.push(formatLoadDetails(load, false));
    sections.push('');
  }
  
  // Current vehicle status
  const isMoving = (asset.speedKmH ?? 0) >= MOVEMENT_SPEED_THRESHOLD_KPH;
  sections.push('📍 CURRENT STATUS');
  sections.push('─'.repeat(30));
  sections.push(`🚛 Vehicle: ${asset.name || asset.code || `Vehicle ${asset.id}`}`);
  sections.push(`⚡ Status: ${isMoving ? 'IN TRANSIT (Moving)' : 'STATIONARY (Parked)'}`);
  if (isMoving) {
    sections.push(`💨 Speed: ${asset.speedKmH} km/h`);
    sections.push(`🧭 Direction: ${getHeadingDirection(asset.heading || 0)} (${asset.heading}°)`);
  }
  sections.push(`🕐 Last Update: ${formatLastConnected(asset.lastConnectedUtc)}`);
  sections.push('');
  
  // Location information
  if (asset.lastLatitude && asset.lastLongitude) {
    sections.push('📍 CURRENT LOCATION');
    sections.push('─'.repeat(30));
    sections.push(`🌐 Coordinates: ${asset.lastLatitude.toFixed(6)}, ${asset.lastLongitude.toFixed(6)}`);
    sections.push('');
  }
  
  // Live tracking link (if provided)
  if (shareUrl) {
    sections.push('🔗 LIVE TRACKING LINK');
    sections.push('─'.repeat(30));
    sections.push(shareUrl);
    sections.push('');
    sections.push('⏰ This link will expire automatically for security');
    sections.push('');
  }
  
  // Google Maps link
  if (asset.lastLatitude && asset.lastLongitude) {
    const googleMapsUrl = `https://www.google.com/maps?q=${asset.lastLatitude},${asset.lastLongitude}`;
    sections.push('🗺️ OPEN IN GOOGLE MAPS');
    sections.push('─'.repeat(30));
    sections.push(googleMapsUrl);
    sections.push('');
  }
  
  // Custom note if provided
  if (customNote) {
    sections.push('📝 ADDITIONAL NOTES');
    sections.push('─'.repeat(30));
    sections.push(customNote);
    sections.push('');
  }
  
  // Footer
  sections.push('─'.repeat(40));
  sections.push('Generated by Fleet Management System');
  sections.push(`Report Time: ${new Date().toLocaleString()}`);
  
  return sections.join('\n');
}

/**
 * Vehicle Tracking Dialog - Real-time vehicle location tracking with sharing capabilities
 * 
 * Displays live vehicle position on an interactive map with:
 * - Real-time position updates every 30 seconds
 * - Vehicle movement status (moving/stationary) with speed and heading
 * - Multiple sharing options (WhatsApp, copy message, live tracking links)
 * - Comprehensive load details included in all shares
 * - Google Maps integration for directions and navigation
 */
export function VehicleTrackingDialog({
  open,
  onOpenChange,
  load,
  telematicsAssetId,
}: VehicleTrackingDialogProps) {
  // State management
  const [asset, setAsset] = useState<TelematicsAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [creatingLiveLink, setCreatingLiveLink] = useState(false);
  const [includeLoadDetailsInShare, setIncludeLoadDetailsInShare] = useState(true);

  /**
   * Fetches the latest vehicle position from Telematics Guru API
   */
  const fetchVehiclePosition = useCallback(async () => {
    if (!telematicsAssetId) {
      setError('No telematics device is associated with this vehicle');
      return;
    }

    if (!isAuthenticated()) {
      setError('Please connect to Telematics Guru in the Live Tracking page first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assetData = await getAssetDetails(parseInt(telematicsAssetId));
      setAsset(assetData);
      setLastUpdate(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch vehicle position';
      setError(message);
      console.error('[VehicleTrackingDialog] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [telematicsAssetId]);

  // Fetch position when dialog opens
  useEffect(() => {
    if (open && telematicsAssetId) {
      fetchVehiclePosition();
    }
  }, [open, telematicsAssetId, fetchVehiclePosition]);

  // Set up auto-refresh interval when dialog is open
  useEffect(() => {
    if (!open || !telematicsAssetId) return;

    const interval = setInterval(fetchVehiclePosition, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, telematicsAssetId, fetchVehiclePosition]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAsset(null);
      setError(null);
      setLastUpdate(null);
      setShareNote('');
      setIncludeLoadDetailsInShare(true);
    }
  }, [open]);

  // Google Maps URL generators
  const getGoogleMapsUrl = useCallback((): string | null => {
    if (!asset?.lastLatitude || !asset?.lastLongitude) return null;
    return `https://www.google.com/maps?q=${asset.lastLatitude},${asset.lastLongitude}`;
  }, [asset]);

  const getDirectionsUrl = useCallback((): string | null => {
    if (!asset?.lastLatitude || !asset?.lastLongitude) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${asset.lastLatitude},${asset.lastLongitude}`;
  }, [asset]);

  // Action handlers
  const copyCoordinates = useCallback(async () => {
    if (!asset?.lastLatitude || !asset?.lastLongitude) return;
    
    const coords = `${asset.lastLatitude.toFixed(6)}, ${asset.lastLongitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(coords);
      toast.success('GPS coordinates copied to clipboard');
    } catch {
      toast.error('Unable to copy coordinates');
    }
  }, [asset]);

  const copyShareableLink = useCallback(async () => {
    const url = getGoogleMapsUrl();
    if (!url || !load) return;
    
    // Create a more informative message with load details
    const message = `🚛 Load: ${load.load_id}
📍 Route: ${getLocationDisplayName(load.origin)} → ${getLocationDisplayName(load.destination)}
📦 Cargo: ${load.cargo_type || 'Not specified'}
📅 Loading: ${formatDateSafely(load.loading_date)}
🏁 Offloading: ${formatDateSafely(load.offloading_date)}
${load.driver?.name ? `👨‍✈️ Driver: ${load.driver.name}\n` : ''}
📍 Live Location:
${url}

${shareNote ? `📝 Note: ${shareNote}\n` : ''}`;
    
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Location link with load details copied to clipboard');
    } catch {
      toast.error('Unable to copy link');
    }
  }, [getGoogleMapsUrl, load, shareNote]);

  const openInGoogleMaps = useCallback(() => {
    const url = getGoogleMapsUrl();
    if (url) window.open(url, '_blank');
  }, [getGoogleMapsUrl]);

  const getDirections = useCallback(() => {
    const url = getDirectionsUrl();
    if (url) window.open(url, '_blank');
  }, [getDirectionsUrl]);

  /**
   * Creates a time-limited live tracking link and copies it to clipboard with load details
   */
  const createLiveTrackingLink = useCallback(async (expiryHours: number) => {
    if (!load?.id || !telematicsAssetId) {
      toast.error('Unable to create live link: Missing load or vehicle information');
      return;
    }

    setCreatingLiveLink(true);
    try {
      const result = await createShareableTrackingLink({
        loadId: load.id,
        telematicsAssetId,
        expiryHours,
      });

      // Create comprehensive message with all load details
      const note = shareNote.trim();
      const loadInfo = formatLoadDetails(load, true);
      const trackingInfo = `🔗 LIVE TRACKING LINK (valid for ${expiryHours} hours)
${result.shareUrl}

📍 Current Location: ${asset?.lastLatitude?.toFixed(6) || 'Unknown'}, ${asset?.lastLongitude?.toFixed(6) || 'Unknown'}
🚛 Vehicle Status: ${asset && (asset.speedKmH ?? 0) >= MOVEMENT_SPEED_THRESHOLD_KPH ? 'Moving' : 'Stationary'}${asset?.speedKmH ? ` at ${asset.speedKmH} km/h` : ''}`;
      
      const clipboardText = [
        '🚛 VEHICLE TRACKING INFORMATION',
        '='.repeat(50),
        '',
        loadInfo,
        '',
        trackingInfo,
        note ? `\n📝 NOTE:\n${note}` : '',
        '',
        '─'.repeat(50),
        `Generated: ${new Date().toLocaleString()}`,
        'Track in real-time using the link above'
      ].filter(Boolean).join('\n');
      
      await navigator.clipboard.writeText(clipboardText);
      toast.success(
        `Live tracking link with complete load details created! Valid for ${expiryHours} hours.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create live tracking link';
      toast.error(message);
      console.error('[VehicleTrackingDialog] Live link creation error:', err);
    } finally {
      setCreatingLiveLink(false);
    }
  }, [load, telematicsAssetId, shareNote, asset]);

  /**
   * Shares vehicle tracking information via WhatsApp with complete load details
   */
  const shareViaWhatsApp = useCallback(async (
    withLiveLink: boolean = false,
    _style: ShareMessageStyle = 'professional' // Prefixed with _ to indicate intentional non-use
  ) => {
    if (!asset?.lastLatitude || !asset?.lastLongitude || !load) {
      toast.error('Unable to share: Missing vehicle or load information');
      return;
    }

    let shareUrl: string | undefined;

    if (withLiveLink && telematicsAssetId) {
      try {
        const result = await createShareableTrackingLink({
          loadId: load.id,
          telematicsAssetId,
          expiryHours: DEFAULT_WHATSAPP_EXPIRY_HOURS,
        });
        shareUrl = result.shareUrl;
      } catch (err) {
        console.error('[VehicleTrackingDialog] WhatsApp live link error:', err);
        toast.error('Unable to create live tracking link. Sharing static location only.');
      }
    }

    // Use enhanced message format with full load details
    const message = formatCompleteShareMessage(
      load,
      asset,
      shareUrl,
      shareNote,
      includeLoadDetailsInShare
    );

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    toast.success('Opening WhatsApp with complete tracking details...');
  }, [asset, load, telematicsAssetId, shareNote, includeLoadDetailsInShare]);

  /**
   * Copies detailed tracking message to clipboard with complete load information
   */
  const copyDetailedMessage = useCallback(async (
    withLiveLink: boolean = false,
    _style: ShareMessageStyle = 'professional' // Prefixed with _ to indicate intentional non-use
  ) => {
    if (!asset?.lastLatitude || !asset?.lastLongitude || !load) {
      toast.error('Unable to copy: Missing vehicle or load information');
      return;
    }

    let shareUrl: string | undefined;

    if (withLiveLink && telematicsAssetId) {
      try {
        const result = await createShareableTrackingLink({
          loadId: load.id,
          telematicsAssetId,
          expiryHours: DEFAULT_WHATSAPP_EXPIRY_HOURS,
        });
        shareUrl = result.shareUrl;
      } catch (err) {
        console.error('[VehicleTrackingDialog] Copy message live link error:', err);
      }
    }

    // Use enhanced message format
    const message = formatCompleteShareMessage(
      load,
      asset,
      shareUrl,
      shareNote,
      includeLoadDetailsInShare
    );

    try {
      // Preserve formatting for clipboard - don't strip markdown
      await navigator.clipboard.writeText(message);
      toast.success('Complete tracking details with load information copied to clipboard');
    } catch {
      toast.error('Unable to copy message');
    }
  }, [asset, load, telematicsAssetId, shareNote, includeLoadDetailsInShare]);

  // Determine vehicle movement status for UI display
  const isVehicleMoving = asset ? (asset.speedKmH ?? 0) >= MOVEMENT_SPEED_THRESHOLD_KPH : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Navigation className="w-5 h-5 text-primary" />
            Vehicle Tracking
            {load && <span className="text-muted-foreground text-sm font-normal ml-2">Load: {load.load_id}</span>}
          </DialogTitle>
          <DialogDescription>
            {load?.fleet_vehicle?.vehicle_id || 'Unassigned Vehicle'} • 
            {load ? `${getLocationDisplayName(load.origin)} → ${getLocationDisplayName(load.destination)}` : 'No active load assigned'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-6 pt-4 flex flex-col gap-4 overflow-y-auto">
          {/* Load Summary Card - Prominently displayed */}
          {load && (
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">Load Details</h3>
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {load.load_id}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Origin:</span>
                    <span>{getLocationDisplayName(load.origin)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <span className="font-medium">Destination:</span>
                    <span>{getLocationDisplayName(load.destination)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Cargo:</span>
                    <span>{load.cargo_type || 'Not specified'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">Loading:</span>
                    <span>{formatDateSafely(load.loading_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">Offloading:</span>
                    <span>{formatDateSafely(load.offloading_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-600" />
                    <span className="font-medium">Driver:</span>
                    <span>{load.driver?.name || 'Unassigned'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5 border">
            <div className="flex items-center gap-4 flex-wrap">
              {asset && (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: isVehicleMoving ? '#16a34a' : '#dc2626' }}
                    />
                    <span className="text-sm font-semibold">
                      {isVehicleMoving ? 'In Transit' : 'Stationary'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isVehicleMoving && (
                      <>
                        {asset.speedKmH} km/h • {getHeadingDirection(asset.heading || 0)}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}

              {/* Share Dropdown */}
              {asset && asset.lastLatitude && asset.lastLongitude && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={creatingLiveLink} className="gap-1">
                      {creatingLiveLink ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                      Share & Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {/* Live Tracking Links */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Link2 className="w-4 h-4 mr-2" />
                        Create Live Tracking Link
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => createLiveTrackingLink(4)}>
                          <Clock className="w-4 h-4 mr-2" />
                          4 hours (Short trip)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => createLiveTrackingLink(12)}>
                          <Clock className="w-4 h-4 mr-2" />
                          12 hours (Half day)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => createLiveTrackingLink(24)}>
                          <Clock className="w-4 h-4 mr-2" />
                          24 hours (Full day)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => createLiveTrackingLink(48)}>
                          <Clock className="w-4 h-4 mr-2" />
                          48 hours (Two days)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => createLiveTrackingLink(72)}>
                          <Clock className="w-4 h-4 mr-2" />
                          72 hours (Three days)
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* WhatsApp Sharing */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Share via WhatsApp
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
                          Recommended for clients
                        </div>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(true, 'professional')}>
                          <Truck className="w-4 h-4 mr-2 text-green-600" />
                          Complete Report (Load + Tracking)
                        </DropdownMenuItem>
                        
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1">
                          Additional formats
                        </div>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(true, 'detailed')}>
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Detailed Technical
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(true, 'compact')}>
                          <MapPin className="w-4 h-4 mr-2" />
                          Compact Summary
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareViaWhatsApp(false, 'minimal')}>
                          <Navigation className="w-4 h-4 mr-2" />
                          Quick Location Only
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* Copy Options */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64">
                        <DropdownMenuItem onClick={() => copyDetailedMessage(true, 'professional')}>
                          <Truck className="w-4 h-4 mr-2" />
                          Complete Report (Load + Tracking)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyDetailedMessage(true, 'detailed')}>
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Detailed Technical
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyDetailedMessage(true, 'compact')}>
                          <MapPin className="w-4 h-4 mr-2" />
                          Compact Summary
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={copyShareableLink}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Location Link + Load Summary
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyCoordinates}>
                          <Navigation className="w-4 h-4 mr-2" />
                          GPS Coordinates Only
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* Toggle Load Details Option */}
                    <div className="px-2 py-1.5">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeLoadDetailsInShare}
                          onChange={(e) => setIncludeLoadDetailsInShare(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span>Include complete load details in shares</span>
                      </label>
                    </div>

                    <DropdownMenuSeparator />

                    {/* External Actions */}
                    <DropdownMenuItem onClick={openInGoogleMaps}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Google Maps
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={getDirections}>
                      <Navigation className="w-4 h-4 mr-2" />
                      Get Directions to Vehicle
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={fetchVehiclePosition}
                disabled={loading}
                className="gap-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Refresh Position'
                )}
              </Button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">{error}</div>
            </div>
          )}

          {/* Optional Note Input */}
          <div className="space-y-2">
            <Label htmlFor="share-note" className="text-xs text-muted-foreground">
              Add a note (included in all shared messages & links)
            </Label>
            <Textarea
              id="share-note"
              value={shareNote}
              onChange={(e) => setShareNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              placeholder="e.g., Please confirm receipt upon arrival. Contact dispatch at +123456789 for any delays."
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              className="resize-none text-sm"
            />
            {shareNote.length > 0 && (
              <div className="text-[10px] text-muted-foreground text-right">
                {shareNote.length}/{MAX_NOTE_LENGTH} characters
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="flex-1 min-h-[400px] rounded-lg overflow-hidden border bg-muted/10">
            {!telematicsAssetId ? (
              <div className="h-full flex flex-col items-center justify-center bg-muted/30 p-8">
                <Truck className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground text-center font-medium">
                  No Telematics Device Assigned
                </p>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Please update the vehicle in Fleet Management to enable live tracking.
                </p>
              </div>
            ) : loading && !asset ? (
              <div className="h-full flex flex-col items-center justify-center bg-muted/30">
                <Loader2 className="w-10 h-10 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Loading vehicle position...</p>
              </div>
            ) : (
              <MapContainer
                center={
                  asset?.lastLatitude && asset?.lastLongitude
                    ? [asset.lastLatitude, asset.lastLongitude]
                    : DEFAULT_CENTER
                }
                zoom={DEFAULT_MAP_ZOOM_LEVEL}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
                className="z-0"
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                />
                {asset && asset.lastLatitude && asset.lastLongitude && (
                  <Marker
                    position={[asset.lastLatitude, asset.lastLongitude]}
                    icon={createVehicleIcon(asset)}
                  >
                    <Popup>
                      <div className="min-w-[280px]">
                        <div className="font-bold text-base mb-2 pb-1 border-b">
                          {asset.name || asset.code || `Vehicle ${asset.id}`}
                        </div>
                        {load && (
                          <div className="mb-2 pb-2 border-b">
                            <div className="font-semibold text-sm mb-1">Load: {load.load_id}</div>
                            <div className="text-xs space-y-0.5">
                              <div>{getLocationDisplayName(load.origin)} → {getLocationDisplayName(load.destination)}</div>
                              <div className="text-muted-foreground">{load.cargo_type}</div>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Status:</span>
                            <span className={isVehicleMoving ? 'text-green-600 font-medium' : 'text-red-600'}>
                              {isVehicleMoving ? 'In Transit' : 'Stationary'}
                            </span>
                          </div>
                          {isVehicleMoving && (
                            <>
                              <div className="flex justify-between">
                                <span className="font-medium text-muted-foreground">Speed:</span>
                                <span>{asset.speedKmH} km/h</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-muted-foreground">Direction:</span>
                                <span>{getHeadingDirection(asset.heading || 0)} ({asset.heading}°)</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t mt-1">
                            <span>Last update:</span>
                            <span>{formatLastConnected(asset.lastConnectedUtc)}</span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}
                <CenterOnVehicle asset={asset} />
              </MapContainer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}