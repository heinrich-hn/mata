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
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[0.8125rem] text-foreground leading-tight tracking-tight">
                MATA Monitor
              </p>
              <p className="text-[0.6875rem] text-muted-foreground font-medium tracking-wide uppercase">Fleet Command</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label }) => {
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2 rounded text-[0.8125rem] transition-colors duration-150 font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <span className="flex-1">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User + Status */}
        <div className="border-t border-border p-4 space-y-3">
          <RealtimeStatusBadge />
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {(user?.email ?? "U").charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-medium truncate text-foreground">
                {user?.email?.split("@")[0] ?? "User"}
              </p>
              <p className="text-[0.625rem] text-muted-foreground truncate">
                {user?.email?.split("@")[1] ?? ""}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="btn-icon p-1.5 rounded text-muted-foreground hover:text-danger hover:bg-danger-soft transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
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