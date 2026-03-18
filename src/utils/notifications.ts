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

export async function sendNotification(title: string, options?: NotificationOptions) {
  const hasPermission = await requestNotificationPermission();
  
  if (!hasPermission) {
    console.log('Notification permission not granted');
    return;
  }

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
    });
  } else {
    new Notification(title, {
      icon: '/icon-192.png',
      ...options,
    });
  }
}

export function subscribeToMaintenanceAlerts(scheduleId: string) {
  // This would integrate with Supabase realtime to listen for schedule updates
  // and trigger notifications when maintenance is due
  console.log(`Subscribed to maintenance alerts for schedule: ${scheduleId}`);
}