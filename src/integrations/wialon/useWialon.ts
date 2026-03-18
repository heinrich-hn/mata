// src/integrations/wialon/useWialon.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase/client';
import { getWialonAdvancedService } from './wialonAdvanced';

export interface VehicleLocation {
  vehicleId: string;
  vehicleName: string;
  unitId?: string;
  name?: string;
  registration?: string;
  wialonUnitId?: number; // Wialon's internal unit ID (large integer, e.g., 600695231)
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: Date;
  heading: number;
  altitude: number;
  satelliteCount: number;
  isMoving: boolean;
  // Enhanced properties
  fuel?: number;
  temperature?: number;
  odometer?: number;
  engineHours?: number;
  status?: 'online' | 'offline' | 'moving' | 'stopped';
}

export interface WialonEvent {
  id: string;
  type: string;
  vehicleId: number;
  vehicleName: string;
  timestamp: Date | number;
  data?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  // Wialon API event structure
  i?: number; // item (unit) ID
  t?: string; // event type
  d?: Record<string, unknown>; // event data
}

export interface UseWialonResult {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  units: WialonUnit[];
  vehicleLocations: VehicleLocation[];
  events: WialonEvent[];
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshUnits: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  getUnitById: (unitId: number) => WialonUnit | undefined;
  searchUnits: (query: string) => WialonUnit[];
  filterUnits: (filters: UnitFilters) => WialonUnit[];
  callAPI: (service: string, params?: Record<string, unknown>) => Promise<{ error?: number; error_description?: string; [key: string]: unknown }>;
  // Enhanced methods
  getUnitHistory: (unitId: number, from: Date, to: Date) => Promise<any[]>;
  sendCommand: (unitId: number, command: string, params?: any) => Promise<boolean>;
}

interface WialonUnit {
  id: number;
  nm: string;
  pos: {
    y: number;
    x: number;
    s: number;
    c: number;
    z: number;
    sc: number;
    t: number;
  } | null;
  // Enhanced properties
  cls?: number;
  lmsg?: any;
  sens?: any;
  prms?: any;
  flds?: any;
}

interface UnitFilters {
  status?: 'online' | 'offline' | 'moving' | 'stopped';
  group?: string;
  minSpeed?: number;
  maxSpeed?: number;
  lastUpdate?: {
    from: Date;
    to: Date;
  };
}

// Proxy session data
interface ProxySessionData {
  eid: string;
  au: string;
  base_url: string;
  host: string;
  gis_sid?: string;
  tm?: number;
}

// Enhanced retry mechanism
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        throw lastError;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
};

export function useWialon(): UseWialonResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<WialonUnit[]>([]);
  const [vehicleLocations, setVehicleLocations] = useState<VehicleLocation[]>([]);
  const [events, setEvents] = useState<WialonEvent[]>([]);
  const [proxySession, setProxySession] = useState<ProxySessionData | null>(null);
  const [wialonVehicleMapping, setWialonVehicleMapping] = useState<Map<number, { id: string; name: string }>>(new Map());
  const wialonServiceRef = useRef(getWialonAdvancedService());

  // Enhanced API call with retry mechanism
  const callWialonAPI = useCallback(async (service: string, params: any = {}, sessionData?: ProxySessionData) => {
    const activeSession = sessionData || proxySession;

    if (!activeSession) {
      throw new Error('No active proxy session');
    }

    return withRetry(async () => {
      console.log(`🔗 Calling Wialon API: ${service} with session ${activeSession.eid}`);

      const response = await supabase.functions.invoke('wialon-proxy', {
        body: {
          service,
          params,
          sid: activeSession.eid,
        },
      });

      if (response.error) {
        throw new Error(`Supabase function error: ${response.error.message}`);
      }

      const data = response.data;

      if (data.error) {
        // Handle different error codes
        switch (data.error) {
          case 1:
            console.warn('Wialon session expired (error 1), clearing session state');
            setProxySession(null);
            setIsConnected(false);
            throw new Error('Session expired. Please reconnect.');
          case 2:
            throw new Error('Invalid service name or parameters');
          case 4:
            throw new Error('Item not found or access denied');
          case 7:
            throw new Error('Invalid parameters');
          default:
            throw new Error(`Wialon API error ${data.error}: ${data.reason || 'Unknown error'}`);
        }
      }

      return data;
    }, 3, 1000);
  }, [proxySession]);

  // Initialize and check connection status
  useEffect(() => {
    const service = wialonServiceRef.current;
    if (service.isReady() && proxySession) {
      setIsConnected(true);
    }
  }, [proxySession]);

  // Fetch mapping between Wialon unit IDs and database vehicle IDs
  const fetchWialonVehicleMapping = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('wialon_vehicles')
        .select('id, wialon_unit_id, name');

      if (error) throw error;

      const mapping = new Map<number, { id: string; name: string }>();
      data?.forEach(vehicle => {
        mapping.set(vehicle.wialon_unit_id, { id: vehicle.id, name: vehicle.name });
      });

      console.log(`Loaded ${mapping.size} Wialon vehicle mappings`);
      setWialonVehicleMapping(mapping);
      return mapping;
    } catch (error) {
      console.error('Error fetching Wialon vehicle mapping:', error);
      return new Map();
    }
  }, []);

  const refreshUnits = useCallback(async (forceRefresh = false, sessionData?: ProxySessionData) => {
    const activeSession = sessionData || proxySession;

    if (!forceRefresh && !activeSession) {
      console.debug('Cannot refresh units: no active proxy session');
      return;
    }

    if (!activeSession) {
      console.debug('No active Wialon session for refresh. Skipping refresh.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching units from Wialon API via proxy...');

      // Fetch vehicle mapping first
      let mapping = wialonVehicleMapping;
      if (mapping.size === 0) {
        mapping = await fetchWialonVehicleMapping();
      }

      // Enhanced unit search with more flags
      const unitsResponse = await callWialonAPI('core/search_items', {
        spec: {
          itemsType: "avl_unit",
          propName: "sys_name",
          propValueMask: "*",
          sortType: "sys_name"
        },
        force: 1,
        flags: 0x1 | 0x100 | 0x200 | 0x400 | 0x800 | 0x1000 | 0x2000, // Enhanced flags
        from: 0,
        to: 0
      }, activeSession);

      console.log('Wialon API response via proxy:', unitsResponse);

      if (!unitsResponse.items || unitsResponse.items.length === 0) {
        console.warn('No units returned from Wialon API');
        setUnits([]);
        setVehicleLocations([]);
        return;
      }

      // Enhanced unit processing
      const fetchedUnits: WialonUnit[] = unitsResponse.items.map((item: any) => {
        let position = item.pos;

        // Fallback to last message position
        if (!position && item.lmsg && item.lmsg.pos) {
          console.log(`Unit ${item.nm} has no pos, using lmsg position`);
          position = item.lmsg.pos;
        }

        return {
          id: item.id,
          nm: item.nm,
          pos: position || null,
          cls: item.cls,
          lmsg: item.lmsg,
          sens: item.sens,
          prms: item.prms,
          flds: item.flds,
        };
      });

      console.log('Processed units:', fetchedUnits);
      setUnits(fetchedUnits);

      // Enhanced vehicle location processing
      const locations: VehicleLocation[] = fetchedUnits
        .filter(unit => unit.pos !== null)
        .map(unit => {
          const pos = unit.pos!;
          const isMoving = (pos.s || 0) > 5; // Consider moving if speed > 5 km/h

          // Determine status
          let status: 'online' | 'offline' | 'moving' | 'stopped' = 'offline';
          const lastUpdate = new Date(pos.t * 1000);
          const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60);

          if (minutesSinceUpdate < 10) {
            status = isMoving ? 'moving' : 'stopped';
          } else if (minutesSinceUpdate < 60) {
            status = 'online';
          }

          // Extract sensor data if available
          const sensors = unit.sens || {};
          const fuel = sensors.fuel_level?.v;
          const temperature = sensors.temperature?.v;
          const odometer = sensors.odometer?.v;
          const engineHours = sensors.engine_hours?.v;

          // Get database vehicle ID from mapping
          const vehicleMapping = mapping.get(unit.id);
          const vehicleId = vehicleMapping?.id || `wialon-${unit.id}`; // Fallback to wialon- format

          return {
            vehicleId,
            vehicleName: vehicleMapping?.name || unit.nm,
            unitId: unit.id.toString(),
            wialonUnitId: unit.id, // Wialon's internal unit ID (e.g., 600695231)
            latitude: pos.y,
            longitude: pos.x,
            speed: pos.s || 0,
            timestamp: lastUpdate,
            heading: pos.c || 0,
            altitude: pos.z || 0,
            satelliteCount: pos.sc || 0,
            isMoving,
            status,
            fuel,
            temperature,
            odometer,
            engineHours,
          };
        });

      console.log('Enhanced vehicle locations:', locations);
      setVehicleLocations(locations);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh units';

      if (errorMessage.includes('Session expired')) {
        setError('Session expired. Please reconnect to Wialon.');
        setIsConnected(false);
      } else {
        setError(errorMessage);
        console.error('Failed to refresh Wialon units:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [callWialonAPI, proxySession, fetchWialonVehicleMapping, wialonVehicleMapping]);

  // Enhanced events fetching implementation
  const refreshEvents = useCallback(async () => {
    if (!proxySession) {
      console.debug('Cannot refresh events: no active proxy session');
      return;
    }

    try {
      console.log('Fetching events from Wialon API via proxy...');

      // Get events for the last 24 hours
      const to = Math.floor(Date.now() / 1000);
      const from = to - (24 * 60 * 60); // 24 hours ago

      const eventsResponse = await callWialonAPI('messages/load_interval', {
        itemId: 0, // All units (0 means query all)
        timeFrom: from,
        timeTo: to,
        flags: 0x0000FF00, // Event messages flag
        flagsMask: 0xFFFFFFFF,
        loadCount: 100 // Max events to load
      });

      console.log('📊 Events API response:', eventsResponse);

      if (eventsResponse && eventsResponse.messages) {
        const processedEvents: WialonEvent[] = eventsResponse.messages
          .filter((msg: any) => msg.et && msg.et > 0) // Filter event messages
          .map((msg: any, index: number) => {
            // Determine event severity based on type
            let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
            let description = 'Unknown event';

            // Map common event types
            switch (msg.et) {
              case 1:
                description = 'Ignition on';
                severity = 'medium';
                break;
              case 2:
                description = 'Ignition off';
                severity = 'medium';
                break;
              case 3:
                description = 'Speed limit exceeded';
                severity = 'high';
                break;
              case 4:
                description = 'Geofence violation';
                severity = 'high';
                break;
              case 5:
                description = 'Panic button pressed';
                severity = 'critical';
                break;
              case 6:
                description = 'Low fuel level';
                severity = 'medium';
                break;
              default:
                description = `Event type ${msg.et}`;
            }

            // Find unit name
            const unit = units.find(u => u.id === msg.i);
            const vehicleName = unit?.nm || `Unit ${msg.i}`;

            return {
              id: `${msg.i}-${msg.t}-${index}`,
              type: `event_${msg.et}`,
              vehicleId: msg.i,
              vehicleName,
              timestamp: new Date(msg.t * 1000),
              severity,
              description,
              location: msg.pos ? {
                lat: msg.pos.y,
                lng: msg.pos.x,
              } : undefined,
              data: {
                eventType: msg.et,
                parameters: msg.p,
                position: msg.pos,
              },
              i: msg.i,
              t: msg.et.toString(),
              d: msg.p,
            };
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        console.log(`Fetched ${processedEvents.length} events`);
        setEvents(processedEvents);
      } else {
        console.log('No events returned from API');
        setEvents([]);
      }
    } catch (err) {
      console.error('Failed to refresh events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    }
  }, [proxySession, callWialonAPI, units]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Connecting to Wialon via proxy...');

      // Check if already connected
      if (proxySession) {
        console.log('Already connected to Wialon via proxy');
        setIsConnected(true);
        await refreshUnits(true);
        return;
      }

      // Get credentials from environment
      const token = import.meta.env.VITE_WIALON_TOKEN;
      const host = import.meta.env.VITE_WIALON_HOST || 'https://hst-api.wialon.eu';

      if (!token) {
        throw new Error('VITE_WIALON_TOKEN not configured in environment variables');
      }

      console.log('Authenticating via Supabase proxy...');

      const response = await supabase.functions.invoke('wialon-proxy', {
        body: {
          service: 'token/login',
          params: {
            token: token,
          },
        },
      });

      if (response.error) {
        throw new Error(`Proxy authentication failed: ${response.error.message}`);
      }

      const authResult = response.data;

      if (authResult.error) {
        throw new Error(`Wialon error ${authResult.error}: ${authResult.reason || 'Unknown error'}`);
      }

      if (!authResult.eid) {
        throw new Error('No session ID returned from authentication');
      }

      // Store session data
      const sessionData: ProxySessionData = {
        eid: authResult.eid,
        au: authResult.au,
        base_url: authResult.base_url || host,
        host: authResult.host,
        gis_sid: authResult.gis_sid,
        tm: authResult.tm
      };

      console.log('✅ Authentication successful:', {
        sessionId: sessionData.eid,
        user: sessionData.au,
        baseUrl: sessionData.base_url
      });

      setProxySession(sessionData);
      setIsConnected(true);

      // Load initial data
      try {
        await refreshUnits(true, sessionData);
        console.log('✅ Initial units loaded successfully');
      } catch (refreshError) {
        console.warn('⚠️ Failed to load initial units:', refreshError);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Wialon';
      setError(errorMessage);
      console.error('Wialon connection error:', err);
      setIsConnected(false);
      setProxySession(null);
    } finally {
      setIsLoading(false);
    }
  }, [proxySession, refreshUnits]);

  const disconnect = useCallback(async () => {
    console.log('Disconnecting from Wialon...');
    const service = wialonServiceRef.current;
    service.stopAllTracking();

    if (proxySession) {
      try {
        console.log('Logging out via proxy...');
        await callWialonAPI('core/logout');
        console.log('✅ Logged out successfully');
      } catch (err) {
        console.error('Error during proxy logout:', err);
      }
    }

    // Clear all state
    setProxySession(null);
    setIsConnected(false);
    setUnits([]);
    setVehicleLocations([]);
    setEvents([]);
    setError(null);
  }, [proxySession, callWialonAPI]);

  const getUnitById = useCallback((unitId: number): WialonUnit | undefined => {
    return units.find(unit => unit.id === unitId);
  }, [units]);

  // Enhanced search functionality
  const searchUnits = useCallback((query: string): WialonUnit[] => {
    if (!query.trim()) return units;

    const lowerQuery = query.toLowerCase();
    return units.filter(unit =>
      unit.nm.toLowerCase().includes(lowerQuery) ||
      unit.id.toString().includes(query)
    );
  }, [units]);

  // Enhanced filtering functionality
  const filterUnits = useCallback((filters: UnitFilters): WialonUnit[] => {
    return units.filter(unit => {
      // Status filter
      if (filters.status) {
        const location = vehicleLocations.find(loc => loc.vehicleId === `wialon-${unit.id}`);
        if (!location || location.status !== filters.status) {
          return false;
        }
      }

      // Speed filter
      if (filters.minSpeed !== undefined || filters.maxSpeed !== undefined) {
        const speed = unit.pos?.s || 0;
        if (filters.minSpeed !== undefined && speed < filters.minSpeed) return false;
        if (filters.maxSpeed !== undefined && speed > filters.maxSpeed) return false;
      }

      // Last update filter
      if (filters.lastUpdate && unit.pos) {
        const lastUpdate = new Date(unit.pos.t * 1000);
        if (lastUpdate < filters.lastUpdate.from || lastUpdate > filters.lastUpdate.to) {
          return false;
        }
      }

      return true;
    });
  }, [units, vehicleLocations]);

  // Get unit history
  const getUnitHistory = useCallback(async (unitId: number, from: Date, to: Date): Promise<any[]> => {
    if (!proxySession) {
      throw new Error('No active session');
    }

    try {
      const response = await callWialonAPI('messages/load_interval', {
        itemId: unitId,
        timeFrom: Math.floor(from.getTime() / 1000),
        timeTo: Math.floor(to.getTime() / 1000),
        flags: 0x0000FF00,
        flagsMask: 0xFFFFFFFF,
        loadCount: 0xFFFFFFFF
      });

      return response.messages || [];
    } catch (error) {
      console.error('Failed to get unit history:', error);
      throw error;
    }
  }, [proxySession, callWialonAPI]);

  // Send command to unit
  const sendCommand = useCallback(async (unitId: number, command: string, params?: any): Promise<boolean> => {
    if (!proxySession) {
      throw new Error('No active session');
    }

    try {
      const response = await callWialonAPI('unit/exec_cmd', {
        itemId: unitId,
        commandName: command,
        linkType: '',
        param: params || {}
      });

      return response.error === 0;
    } catch (error) {
      console.error('Failed to send command:', error);
      return false;
    }
  }, [proxySession, callWialonAPI]);

  // Cleanup on unmount
  useEffect(() => {
    const service = wialonServiceRef.current;
    return () => {
      service.stopAllTracking();
    };
  }, []);

  // Load vehicle mapping on mount
  useEffect(() => {
    fetchWialonVehicleMapping();
  }, [fetchWialonVehicleMapping]);

  return {
    isConnected,
    isLoading,
    error,
    units,
    vehicleLocations,
    events,
    connect,
    disconnect,
    refreshUnits: () => refreshUnits(false),
    refreshEvents,
    getUnitById,
    searchUnits,
    filterUnits,
    callAPI: callWialonAPI,
    getUnitHistory,
    sendCommand,
  };
}