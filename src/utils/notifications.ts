// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Initialize notifications and register service worker
export async function initNotifications(vapidPublicKey: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return false;
  }

  if (!('PushManager' in window)) {
    console.log('Push notifications not supported');
    return false;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered successfully');

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Get existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription - fix TypeScript error by converting to appropriate type
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource
      });
    }

    // Send subscription to your backend
    const response = await fetch('/api/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        userId: getCurrentUserId()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription');
    }

    console.log('Push notification setup complete');
    return true;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

// Request permission (legacy support)
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Send local notification (works when page is open)
export async function sendLocalNotification(title: string, options?: NotificationOptions) {
  const hasPermission = await requestNotificationPermission();
  
  if (!hasPermission) {
    console.log('Notification permission not granted');
    return;
  }

  // Check if service worker is ready for better notifications
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
    });
  } else {
    // Fallback to basic notification
    new Notification(title, {
      icon: '/icon-192.png',
      ...options,
    });
  }
}

// Define Supabase client types
interface SupabaseClient {
  channel: (name: string) => RealtimeChannel;
}

interface RealtimeChannel {
  on: (event: string, config: PostgresChangesConfig, callback: (payload: RealtimePayload) => void) => RealtimeChannel;
  subscribe: () => RealtimeSubscription;
}

interface PostgresChangesConfig {
  event: string;
  schema: string;
  table: string;
  filter?: string;
}

interface RealtimePayload {
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

interface RealtimeSubscription {
  unsubscribe: () => void;
}

// Define schedule data structure
interface ScheduleData {
  maintenance_due?: boolean;
  next_maintenance_date?: string;
}

// Subscribe to maintenance alerts with Supabase
export function subscribeToMaintenanceAlerts(
  scheduleId: string, 
  supabaseClient: SupabaseClient
): RealtimeSubscription {
  console.log(`Subscribed to maintenance alerts for schedule: ${scheduleId}`);
  
  // Listen for realtime changes
  const channel = supabaseClient
    .channel(`schedule-${scheduleId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'schedules',
        filter: `id=eq.${scheduleId}`
      },
      async (payload: RealtimePayload) => {
        const newData = payload.new as ScheduleData;
        const oldData = payload.old as ScheduleData;
        
        // Check if maintenance status changed
        if (newData.maintenance_due && !oldData.maintenance_due) {
          await sendLocalNotification('Maintenance Alert', {
            body: `Schedule ${scheduleId} maintenance is now due`,
            tag: `maintenance-${scheduleId}`,
            requireInteraction: true
          });
        }
        
        // Check for upcoming maintenance (7 days before)
        if (newData.next_maintenance_date) {
          const daysUntil = Math.ceil(
            (new Date(newData.next_maintenance_date).getTime() - Date.now()) / 
            (1000 * 60 * 60 * 24)
          );
          
          if (daysUntil === 7 && (!oldData.next_maintenance_date || 
              Math.ceil((new Date(oldData.next_maintenance_date).getTime() - Date.now()) / 
              (1000 * 60 * 60 * 24)) !== 7)) {
            await sendLocalNotification('Upcoming Maintenance', {
              body: `Maintenance for schedule ${scheduleId} is due in 7 days`,
              tag: `maintenance-upcoming-${scheduleId}`
            });
          }
        }
      }
    )
    .subscribe();

  return channel;
}

// Unsubscribe from alerts
export function unsubscribeFromAlerts(subscription: RealtimeSubscription | null): void {
  if (subscription) {
    subscription.unsubscribe();
  }
}

// Helper - get current user ID (implement based on your auth)
function getCurrentUserId(): string {
  // Replace with your actual user ID logic
  // Example: return supabase.auth.getUser()?.id || 'anonymous';
  return localStorage.getItem('userId') || 'anonymous';
}