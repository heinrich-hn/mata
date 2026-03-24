import { useAuth } from "@/contexts/AuthContext";
import { useAlertStream } from "@/hooks/useAlertStream";
import { cn } from "@/lib/utils";
import { LogOut, Shield } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import RealtimeStatusBadge from "./RealtimeStatusBadge";

const NAV_ITEMS = [
  { to: "/alerts", label: "Alert Feed" },
  { to: "/trip-alerts", label: "Trip Alerts" },
  { to: "/faults", label: "Faults" },
  { to: "/documents", label: "Documents" },
  { to: "/diesel-alerts", label: "Diesel" },
  { to: "/incidents", label: "Incidents" },
  { to: "/driver-behavior", label: "Driver Behavior" },
  { to: "/geofence", label: "Geofence" },
  { to: "/analytics", label: "Analytics" },
  { to: "/config", label: "Alert Rules" },
] as const;

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Start the global realtime stream
  useAlertStream();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-200/90 bg-gradient-to-b from-slate-50 to-white flex flex-col">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-slate-200/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
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
          {NAV_ITEMS.map(({ to, label }) => {
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2.5 rounded-md text-sm transition-all duration-150",
                    isActive
                      ? "bg-cyan-50 text-cyan-700 font-medium border border-cyan-100"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )
                }
              >
                <span className="flex-1">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User + Status */}
        <div className="border-t border-slate-200/90 p-4 space-y-3">
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