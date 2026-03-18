// src/integrations/wialon/service.ts
import { supabase } from '@/integrations/supabase/client';
import type {
  VehicleLocation,
  WialonConfig,
  WialonSDK,
  WialonSession,
  WialonUnit,
} from './types';

type WialonMessageEvent = WialonMessage | WialonMessage[] | null | undefined;

interface WialonMessage {
  uid: string;
  pos?: {
    y: number;
    x: number;
    z?: number;
    s?: number;
    c?: number;
    sc?: number;
    t?: number;
  };
  t?: number;
}

export class WialonService {
  private session: WialonSession | null = null;
  private sdk: WialonSDK | null = null;
  private config: WialonConfig;
  private isInitialized = false;
  private scriptLoaded = false;
  private sessionId: string | null = null; // Store session ID from login
  private tokenRefreshTimeout: NodeJS.Timeout | null = null;
  private updateListeners: Set<(locations: VehicleLocation[]) => void> = new Set();
  private retryCount = 0; // Track retry attempts to prevent infinite loops
  private maxRetries = 2; // Maximum retry attempts for expired sessions

  constructor(config: WialonConfig) {
    this.config = config;
  }

  /**
   * Fetch Wialon authentication token from Supabase Edge Function
   * Prioritizes direct token from environment variables over edge function
   */
  private async fetchToken(): Promise<string> {
    // First, check if token is already in config (from env vars)
    if (this.config.token) {
      console.log('✅ Using Wialon token from environment variables');
      return this.config.token;
    }

    // Fallback: Try to fetch from edge function if no direct token
    try {
      console.log('🔄 No direct token found, trying edge function...');
      const { data, error } = await supabase.functions.invoke('get-wialon-token');
      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }
      if (!data?.token) throw new Error('No token returned from edge function');
      console.log('✅ Fetched token from edge function');
      return data.token;
    } catch (err) {
      console.error('❌ Edge function failed:', err);
      throw new Error(
        'No Wialon token available. Please either:\n' +
        '1. Set VITE_WIALON_TOKEN in your .env file, or\n' +
        '2. Deploy and configure the get-wialon-token edge function'
      );
    }
  }

  /**
   * Refresh authentication token and reinitialize session
   */
  async refreshToken(): Promise<void> {
    try {
      console.log('🔄 Refreshing Wialon token...');
      const token = await this.fetchToken();
      if (this.session) await this.logout();
      this.config.token = token;
      await this.initialize();
      console.log('✅ Token refreshed and session reinitialized');
    } catch (err) {
      console.error('❌ Token refresh failed:', err);
      throw err;
    }
  }

  /**
   * Schedule automatic token refresh before expiration
   */
  private scheduleRefresh(expiryInMs: number = 24 * 60 * 60 * 1000): void {
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }

    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(expiryInMs - 5 * 60 * 1000, 60000); // At least 1 minute

    this.tokenRefreshTimeout = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (err) {
        console.error('❌ Scheduled token refresh failed:', err);
        // Retry after 5 minutes on failure
        this.scheduleRefresh(5 * 60 * 1000);
      }
    }, refreshTime);

    const minutesUntilRefresh = (refreshTime / 1000 / 60).toFixed(0);
    console.log(`⏰ Token refresh scheduled in ${minutesUntilRefresh} minutes`);
  }

  /**
   * Load Wialon SDK script dynamically
   */
  async loadSDK(): Promise<void> {
    if (this.scriptLoaded && this.sdk) {
      console.log('✅ Wialon SDK already loaded');
      return;
    }

    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(
        `script[src*="wialon.js"]`
      ) as HTMLScriptElement;

      if (existingScript) {
        this.scriptLoaded = true;
        this.sdk = window.wialon || null;
        if (this.sdk) {
          console.log('✅ Wialon SDK already loaded (existing script)');
          resolve();
        } else {
          reject(new Error('Wialon SDK script exists but SDK not available'));
        }
        return;
      }

      const script = document.createElement('script');
      script.src = `${this.config.host}/wsdk/script/wialon.js`;
      script.async = true;

      script.onload = () => {
        this.scriptLoaded = true;
        this.sdk = window.wialon || null;
        if (!this.sdk) {
          reject(new Error('Wialon SDK not available after script load'));
        } else {
          console.log('✅ Wialon SDK loaded successfully');
          resolve();
        }
      };

      script.onerror = () => {
        reject(new Error('Failed to load Wialon SDK script'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Wialon session with token authentication
   * Uses HTTP API for initial authentication, then SDK for operations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.session) {
      console.log('ℹ️ Wialon already initialized');
      return;
    }

    try {
      // Fetch token if not provided
      if (!this.config.token) {
        console.log('🔄 No token provided, fetching from edge function...');
        this.config.token = await this.fetchToken();
      }

      console.log('🔄 Authenticating with Wialon via Supabase proxy...');
      console.log('🔍 Token length:', this.config.token.length);

      // Step 1: Authenticate via Supabase Edge Function (bypasses CORS)
      const response = await supabase.functions.invoke('wialon-proxy', {
        body: {
          service: 'token/login',
          params: {
            token: this.config.token,
          },
        },
      });

      if (response.error) {
        throw new Error(`Proxy authentication failed: ${response.error.message}`);
      }

      const authResult = response.data;

      if (authResult.error) {
        throw new Error(`Wialon authentication error: ${authResult.error}`);
      }

      if (!authResult.eid) {
        throw new Error('No session ID returned from authentication');
      }

      console.log('✅ Wialon authentication successful via proxy');
      console.log('📍 Session ID (eid):', authResult.eid);
      console.log('👤 User:', authResult.au);
      console.log('🌐 Base URL:', authResult.base_url || this.config.host);

      // Store session ID for subsequent API calls
      this.sessionId = authResult.eid;

      // DISABLED: SDK loading causes forEach error
      // Using HTTP API directly instead
      /*
      // Step 2: Load SDK if not loaded
      if (!this.sdk) {
        console.log('🔄 Loading Wialon SDK...');
        await this.loadSDK();
      }

      if (!this.sdk) {
        throw new Error('Wialon SDK not loaded');
      }

      // Step 3: Initialize SDK session with the authenticated session
      console.log('🔄 Initializing SDK with authenticated session...');
      this.session = this.sdk!.core.Session.getInstance();
      this.session!.initSession(authResult.base_url || this.config.host);

      // Set the session ID from HTTP authentication
      // The HTTP API already authenticated us, so we just need to tell the SDK
      // Note: We skip duplicate() to avoid the forEach error
      this.isInitialized = true;

      console.log('✅ Wialon SDK session initialized successfully');
      console.log('📍 Using session from HTTP auth');
      */

      // Mark as initialized - using HTTP API only
      this.isInitialized = true;
      console.log('✅ Wialon initialized (HTTP API mode - SDK disabled)');

      // Schedule automatic token refresh
      this.scheduleRefresh();

      return Promise.resolve();
    } catch (err) {
      console.error('❌ Failed to initialize Wialon:', err);
      this.isInitialized = false;
      throw err;
    }
  }  /**
   * Logout and cleanup session
   */
  async logout(): Promise<void> {
    if (!this.session) {
      console.log('ℹ️ No active session to logout');
      return;
    }

    // Clear refresh timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
    }

    return new Promise((resolve) => {
      this.session!.logout(() => {
        this.isInitialized = false;
        this.session = null;
        this.updateListeners.clear();
        console.log('🔒 Wialon session closed');
        resolve();
      });
    });
  }

  /**
   * Fetch all GPS units/vehicles via HTTP API
   */
  async getUnits(): Promise<WialonUnit[]> {
    if (!this.isInitialized) {
      throw new Error('Wialon not initialized. Call initialize() first.');
    }

    if (!this.sessionId) {
      throw new Error('No session ID available. Authentication may have failed.');
    }

    try {
      console.log('🔄 Fetching units via Supabase proxy...');
      console.log('🔑 Using session ID:', this.sessionId);
      console.log('📦 Request body:', JSON.stringify({
        service: 'core/search_items',
        sid: this.sessionId,
        params: { spec: { itemsType: 'avl_unit' }, force: 1, flags: 1281 }
      }, null, 2));

      // Use core/search_items to get all units with their positions
      const response = await supabase.functions.invoke('wialon-proxy', {
        body: {
          service: 'core/search_items',
          sid: this.sessionId, // Session ID at top level
          params: {
            spec: {
              itemsType: 'avl_unit',
              propName: 'sys_name',
              propValueMask: '*',
              sortType: 'sys_name',
            },
            force: 1,
            flags: 1 | 256 | 1024, // base + lastMessage + position
            from: 0,
            to: 0,
          },
        },
      });

      if (response.error) {
        throw new Error(`Failed to fetch units: ${response.error.message}`);
      }

      const result = response.data;

      // Handle session expiration (error code 1)
      if (result.error === 1) {
        if (this.retryCount >= this.maxRetries) {
          this.retryCount = 0; // Reset for next attempt
          throw new Error('Session expired and max retry attempts reached. Please reconnect manually.');
        }

        console.warn(`⚠️ Session expired (error code 1), refreshing token... (Attempt ${this.retryCount + 1}/${this.maxRetries})`);
        this.retryCount++;

        await this.refreshToken();
        // Retry the request with new session
        const result = await this.getUnits();
        this.retryCount = 0; // Reset on success
        return result;
      }

      // Reset retry count on successful request
      this.retryCount = 0;

      if (result.error) {
        throw new Error(`Wialon API error: ${result.error}`);
      }

      const items = result.items || [];
      console.log(`📍 Fetched ${items.length} Wialon unit(s)`);

      // Log summary of units
      items.forEach((unit: WialonUnit) => {
        const hasPos = !!(unit.pos || unit.lmsg?.pos);
        console.log(`  - ${unit.nm} (ID: ${unit.id}) ${hasPos ? '✅ Has position' : '⚠️ No position'}`);
      });

      return items;
    } catch (err) {
      console.error('❌ Error in getUnits:', err);
      // Reset retry count on error
      this.retryCount = 0;
      throw err;
    }
  }

  /**
   * Get a specific unit by ID
   */
  getUnit(unitId: number): WialonUnit | null {
    if (!this.session) {
      console.warn('⚠️ Cannot get unit: session not initialized');
      return null;
    }
    return this.session.getItem(unitId);
  }

  /**
   * Map Wialon units to standardized VehicleLocation format
   */
  mapUnitsToVehicleLocations(units: WialonUnit[]): VehicleLocation[] {
    if (!Array.isArray(units)) {
      console.warn('⚠️ mapUnitsToVehicleLocations received non-array:', units);
      return [];
    }

    const locations = units
      .filter(unit => {
        if (!unit) return false;
        const hasPosition = !!(unit.pos || unit.lmsg?.pos);
        if (!hasPosition) {
          console.log(`⚠️ Unit ${unit.nm} (${unit.id}) has no position data`);
        }
        return hasPosition;
      })
      .map(unit => {
        const pos = unit.pos || unit.lmsg?.pos;
        if (!pos) return null;

        const location: VehicleLocation = {
          vehicleId: unit.uid.toString(),
          vehicleName: unit.nm,
          wialonUnitId: unit.id,
          latitude: pos.y,
          longitude: pos.x,
          altitude: pos.z || 0,
          speed: pos.s || 0,
          heading: pos.c || 0,
          timestamp: new Date((pos.t || Date.now() / 1000) * 1000),
          satelliteCount: pos.sc || 0,
          isMoving: (pos.s || 0) > 0,
        };

        return location;
      })
      .filter((loc): loc is VehicleLocation => loc !== null);

    console.log(`🗺️ Mapped ${locations.length} vehicle location(s)`);
    return locations;
  }

  /**
   * Subscribe to real-time position updates
   * Note: Real-time updates require SDK which is currently disabled due to compatibility issues
   * Consider implementing polling as an alternative
   */
  subscribeToUpdates(callback: (locations: VehicleLocation[]) => void): () => void {
    if (!this.session || !this.sdk) {
      console.log('ℹ️ Real-time updates not available (SDK disabled). Consider using manual refresh.');
      return () => {};
    }

    // Add to listeners set
    this.updateListeners.add(callback);

    const handler = async (event: WialonMessageEvent) => {
      try {
        // Parse incoming messages
        let messages: WialonMessage[];

        if (Array.isArray(event)) {
          messages = event;
        } else if (event && typeof event === 'object') {
          messages = [event];
        } else {
          // Empty or invalid event
          return;
        }

        if (!messages || messages.length === 0) {
          return;
        }

        console.log(`📨 Received ${messages.length} position update(s)`);

        const locations: VehicleLocation[] = [];

        for (const msg of messages) {
          try {
            if (!msg || !msg.pos) continue;

            const unit = this.getUnit(parseInt(msg.uid));

            const location: VehicleLocation = {
              vehicleId: msg.uid,
              vehicleName: unit?.nm || 'Unknown',
              wialonUnitId: parseInt(msg.uid),
              latitude: msg.pos.y,
              longitude: msg.pos.x,
              altitude: msg.pos.z || 0,
              speed: msg.pos.s || 0,
              heading: msg.pos.c || 0,
              timestamp: new Date((msg.pos.t || msg.t || Date.now() / 1000) * 1000),
              satelliteCount: msg.pos.sc || 0,
              isMoving: (msg.pos.s || 0) > 0,
            };

            locations.push(location);

            console.log(`📍 ${location.vehicleName}: ${location.speed.toFixed(1)} km/h at (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`);

            // Update vehicle location in database (enabled after wialon_id migration)
            try {
              await supabase
                .from('vehicles')
                .update({
                  latitude: location.latitude,
                  longitude: location.longitude,
                  updated_at: location.timestamp.toISOString(),
                })
                .eq('wialon_id', location.wialonUnitId);
            } catch (dbErr) {
              console.warn('⚠️ Could not update vehicle location in DB:', dbErr);
            }
          } catch (msgErr) {
            console.error('⚠️ Error processing message:', msgErr, msg);
          }
        }

        if (locations.length > 0) {
          console.log(`✅ Processed ${locations.length} location update(s)`);

          // Notify all listeners
          this.updateListeners.forEach(listener => {
            try {
              listener(locations);
            } catch (err) {
              console.error('❌ Error in update listener:', err);
            }
          });
        }
      } catch (err) {
        console.error('❌ Error in messageUpdated handler:', err);
      }
    };

    // Register event listener
    this.session.addListener('messageUpdated', handler);
    console.log('🔔 Subscribed to Wialon position updates');

    // Return unsubscribe function
    return () => {
      if (this.session) {
        this.session.removeListener('messageUpdated', handler);
        this.updateListeners.delete(callback);
        console.log('🔕 Unsubscribed from Wialon updates');
      }
    };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && !!this.session;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.session?.getId() || null;
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return this.session?.getCurrUser() || null;
  }

  /**
   * Force cleanup (useful for testing)
   */
  async destroy(): Promise<void> {
    console.log('🧹 Destroying Wialon service...');
    await this.logout();
    this.updateListeners.clear();
    this.sdk = null;
    this.scriptLoaded = false;
  }
}

// Singleton instance
let wialonServiceInstance: WialonService | null = null;

/**
 * Get or create Wialon service singleton
 */
export const getWialonService = (): WialonService => {
  if (!wialonServiceInstance) {
    const config: WialonConfig = {
      host: import.meta.env.VITE_WIALON_HOST || 'https://hst-api.wialon.com',
      token: import.meta.env.VITE_WIALON_TOKEN || '',
      appName: import.meta.env.VITE_WIALON_APP_NAME || 'CarCraftCo',
    };

    console.log('🏗️ Creating new Wialon service instance');
    wialonServiceInstance = new WialonService(config);
  }

  return wialonServiceInstance;
};

/**
 * Reset singleton (useful for testing)
 */
export const resetWialonService = async (): Promise<void> => {
  if (wialonServiceInstance) {
    await wialonServiceInstance.destroy();
    wialonServiceInstance = null;
    console.log('♻️ Wialon service reset');
  }
};

export default WialonService;