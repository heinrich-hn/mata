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
      <aside className="w-64 flex-shrink-0 border-r border-slate-200/80 bg-white flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[0.8125rem] text-slate-900 leading-tight tracking-tight">
                MATA Monitor
              </p>
              <p className="text-[0.6875rem] text-slate-400 font-medium tracking-wide uppercase">Fleet Command</p>
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
                    "flex items-center px-3 py-2 rounded-lg text-[0.8125rem] transition-all duration-150 font-medium",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )
                }
              >
                <span className="flex-1">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User + Status */}
        <div className="border-t border-slate-100 p-4 space-y-3">
          <RealtimeStatusBadge />
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-600 uppercase">
                {(user?.email ?? "U").charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-medium truncate text-slate-700">
                {user?.email?.split("@")[0] ?? "User"}
              </p>
              <p className="text-[0.625rem] text-slate-400 truncate">
                {user?.email?.split("@")[1] ?? ""}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="btn-icon p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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