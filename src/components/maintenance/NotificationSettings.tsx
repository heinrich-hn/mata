import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Check } from "lucide-react";
import { requestNotificationPermission } from "@/utils/notifications";
import { toast } from "sonner";

export function NotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      toast.info("Notifications disabled", {
        description: "You can re-enable them at any time"
      });
    } else {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      setPermission(Notification.permission);
      
      if (granted) {
        toast.success("Notifications enabled", {
          description: "You'll receive alerts for upcoming maintenance",
          icon: <Check className="h-4 w-4" />,
        });
      } else {
        toast.error("Notifications blocked", {
          description: "Please enable notifications in your browser settings"
        });
      }
    }
  };

  if (!('Notification' in window)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {notificationsEnabled ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about upcoming maintenance and overdue tasks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Enable Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive alerts for maintenance schedules
            </p>
          </div>
          <Switch
            id="notifications"
            checked={notificationsEnabled}
            onCheckedChange={handleToggleNotifications}
          />
        </div>

        {permission === 'denied' && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Notifications are blocked. Please enable them in your browser settings.
          </div>
        )}

        {notificationsEnabled && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">You'll be notified about:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Maintenance due in 7 days</li>
              <li>• Maintenance due in 3 days</li>
              <li>• Maintenance due today</li>
              <li>• Overdue maintenance</li>
            </ul>
          </div>
        )}

        {notificationsEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              new Notification("Test Notification", {
                body: "Maintenance notifications are working!",
                icon: "/icon-192.png",
              });
            }}
          >
            Send Test Notification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
