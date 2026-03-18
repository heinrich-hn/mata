import { useAuth } from "@/contexts/AuthContext";
import { useAlertFilters } from "@/hooks/useAlertFilters";
import { useAlertCounts } from "@/hooks/useAlerts";
import { useAlertStream } from "@/hooks/useAlertStream";
import { useDieselCounts } from "@/hooks/useDieselCounts";
import { useDocumentCounts } from "@/hooks/useDocumentCounts";
import { useFaultCounts } from "@/hooks/useFaultCounts";
import { useTripAlertCounts } from "@/hooks/useTripAlertCounts";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  FileText,
  Fuel,
  LogOut,
  Settings,
  Shield,
  Truck,
  Wrench,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import RealtimeStatusBadge from "./RealtimeStatusBadge";

const NAV_ITEMS = [
  { to: "/alerts", icon: Bell, label: "Alert Feed", badge: "alerts" as const },
  { to: "/trip-alerts", icon: Truck, label: "Trip Alerts", badge: "trip" as const },
  { to: "/faults", icon: Wrench, label: "Faults", badge: "faults" as const },
  { to: "/documents", icon: FileText, label: "Documents", badge: "documents" as const },
  { to: "/diesel-alerts", icon: Fuel, label: "Diesel", badge: "diesel" as const },
  { to: "/analytics", icon: BarChart3, label: "Analytics", badge: null },
  { to: "/config", icon: Settings, label: "Alert Rules", badge: null },
] as const;

type BadgeType = 'alerts' | 'trip' | 'faults' | 'documents' | 'diesel' | null;

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { filters } = useAlertFilters();

  // Start the global realtime stream
  useAlertStream();

  const { data: counts } = useAlertCounts(filters);
  const { data: faultCounts } = useFaultCounts();
  const { data: tripAlertCounts } = useTripAlertCounts();
  const { data: documentCounts } = useDocumentCounts();
  const { data: dieselCounts } = useDieselCounts();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Helper function to get badge count and color
  const getBadgeConfig = (badgeType: BadgeType) => {
    switch (badgeType) {
      case "alerts":
        if (!counts) return null;
        if (counts.critical > 0) {
          return {
            count: counts.critical,
            className: "bg-destructive text-destructive-foreground"
          };
        }
        if (counts.high > 0) {
          return {
            count: counts.high,
            className: "bg-severity-high text-white"
          };
        }
        if (counts.medium > 0) {
          return {
            count: counts.medium,
            className: "bg-severity-medium text-white"
          };
        }
        return null;

      case "trip":
        if (!tripAlertCounts?.active) return null;
        // Color based on severity
        if (tripAlertCounts.critical > 0) {
          return {
            count: tripAlertCounts.active,
            className: "bg-destructive text-destructive-foreground"
          };
        }
        if (tripAlertCounts.high > 0) {
          return {
            count: tripAlertCounts.active,
            className: "bg-severity-high text-white"
          };
        }
        return {
          count: tripAlertCounts.active,
          className: "bg-severity-medium text-white"
        };

      case "faults":
        if (!faultCounts?.active) return null;
        // Color based on severity
        if (faultCounts.critical > 0) {
          return {
            count: faultCounts.active,
            className: "bg-destructive text-destructive-foreground"
          };
        }
        if (faultCounts.high > 0) {
          return {
            count: faultCounts.active,
            className: "bg-severity-high text-white"
          };
        }
        return {
          count: faultCounts.active,
          className: "bg-severity-medium text-white"
        };

      case "documents":
        if (!documentCounts?.active) return null;
        // Show red for expired, orange for expiring soon
        if (documentCounts.expired > 0) {
          return {
            count: documentCounts.active,
            className: "bg-destructive text-destructive-foreground"
          };
        }
        if (documentCounts.expiringSoon > 0) {
          return {
            count: documentCounts.active,
            className: "bg-severity-high text-white"
          };
        }
        return {
          count: documentCounts.active,
          className: "bg-severity-medium text-white"
        };

      case "diesel":
        if (!dieselCounts?.active) return null;
        // Color based on severity
        if (dieselCounts.critical > 0) {
          return {
            count: dieselCounts.active,
            className: "bg-destructive text-destructive-foreground"
          };
        }
        if (dieselCounts.high > 0) {
          return {
            count: dieselCounts.active,
            className: "bg-severity-high text-white"
          };
        }
        return {
          count: dieselCounts.active,
          className: "bg-emerald-500 text-white"
        };

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border bg-card flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 shadow-subtle">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight tracking-tight">MAT Monitor</p>
            <p className="text-xs text-muted-foreground">Fleet Command Center</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => {
            const badgeConfig = badge ? getBadgeConfig(badge) : null;

            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                <Icon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-colors",
                  "group-hover:text-foreground"
                )} />
                <span className="flex-1">{label}</span>
                {badgeConfig && (
                  <span className={cn(
                    "ml-auto text-xs font-semibold rounded-md min-w-[20px] h-5 flex items-center justify-center px-1.5",
                    badgeConfig.className
                  )}>
                    {badgeConfig.count > 99 ? "99+" : badgeConfig.count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User + Status */}
        <div className="border-t border-border p-3 space-y-3">
          <RealtimeStatusBadge />
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
              <span className="text-xs font-semibold text-foreground uppercase">
                {(user?.email ?? "U").charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate text-foreground">
                {user?.email?.split("@")[0] ?? "User"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user?.email?.split("@")[1] ?? ""}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}