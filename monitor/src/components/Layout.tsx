import { useAuth } from "@/contexts/AuthContext";
import { useAlertFilters } from "@/hooks/useAlertFilters";
import { useAlertCounts } from "@/hooks/useAlerts";
import { useAlertStream } from "@/hooks/useAlertStream";
import { useDieselCounts } from "@/hooks/useDieselCounts";
import { useDocumentCounts } from "@/hooks/useDocumentCounts";
import { useFaultCounts } from "@/hooks/useFaultCounts";
import { useTripAlertCounts } from "@/hooks/useTripAlertCounts";
import { cn } from "@/lib/utils";
import { LogOut, Shield } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import RealtimeStatusBadge from "./RealtimeStatusBadge";

const NAV_ITEMS = [
  { to: "/alerts", label: "Alert Feed", badge: "alerts" as const },
  { to: "/trip-alerts", label: "Trip Alerts", badge: "trip" as const },
  { to: "/faults", label: "Faults", badge: "faults" as const },
  { to: "/documents", label: "Documents", badge: "documents" as const },
  { to: "/diesel-alerts", label: "Diesel", badge: "diesel" as const },
  { to: "/incidents", label: "Incidents", badge: null },
  { to: "/driver-behavior", label: "Driver Behavior", badge: null },
  { to: "/geofence", label: "Geofence", badge: null },
  { to: "/analytics", label: "Analytics", badge: null },
  { to: "/config", label: "Alert Rules", badge: null },
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

  // Helper function to get badge count only - no colors
  const getBadgeCount = (badgeType: BadgeType): number | null => {
    switch (badgeType) {
      case "alerts":
        if (!counts) return null;
        // Use total alerts count
        const totalAlerts = counts.total || 0;
        return totalAlerts > 0 ? totalAlerts : null;

      case "trip":
        if (!tripAlertCounts?.active) return null;
        return tripAlertCounts.active > 0 ? tripAlertCounts.active : null;

      case "faults":
        if (!faultCounts?.active) return null;
        return faultCounts.active > 0 ? faultCounts.active : null;

      case "documents":
        if (!documentCounts?.active) return null;
        return documentCounts.active > 0 ? documentCounts.active : null;

      case "diesel":
        if (!dieselCounts?.active) return null;
        return dieselCounts.active > 0 ? dieselCounts.active : null;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight tracking-tight">
                MAT Monitor
              </p>
              <p className="text-xs text-muted-foreground">Fleet Command Center</p>
            </div>
          </div>
        </div>

        {/* Navigation - No Icons */}
        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, badge }) => {
            const badgeCount = badge ? getBadgeCount(badge) : null;

            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-all duration-150",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                <span className="flex-1">{label}</span>
                {badgeCount && (
                  <span className="ml-auto text-xs font-medium rounded-md min-w-[20px] h-5 flex items-center justify-center px-1.5 bg-muted text-muted-foreground">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User + Status */}
        <div className="border-t border-border p-4 space-y-3">
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