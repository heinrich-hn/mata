// src/components/Layout.tsx

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useGeofenceNotifications } from "@/hooks/useGeofenceNotifications";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Calendar, ChevronDown,
  ClipboardCheck, ClipboardList,
  FileText,
  Fuel,
  Gauge, LayoutDashboard, LogOut, MapPin, Menu,
  Search,
  ShieldAlert, ShoppingCart,
  Store,
  Truck, Users
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Real-time geofence notifications
  useGeofenceNotifications();

  const workshopPaths = [
    "/", "/job-cards", "/inspections", "/tyre-management",
    "/incidents", "/vendors", "/vehicles",
    "/procurement", "/maintenance-scheduling", "/inspector-profiles"
  ];
  const operationsPaths = [
    "/admin", "/cost-management", "/performance",
    "/trip-management", "/driver-management",
    "/diesel-management", "/fuel-bunkers", "/invoicing", "/action-log",
    "/unified-map", "/analytics", "/reports"
  ];

  const isWorkshopRoute = workshopPaths.includes(location.pathname);
  const isOperationsRoute = operationsPaths.includes(location.pathname);

  const [isWorkshopOpen, setIsWorkshopOpen] = useState(isWorkshopRoute);
  const [isOperationsOpen, setIsOperationsOpen] = useState(isOperationsRoute);

  useEffect(() => {
    setIsWorkshopOpen(isWorkshopRoute);
    setIsOperationsOpen(isOperationsRoute);
  }, [location.pathname, isWorkshopRoute, isOperationsRoute]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({
      title: "Logged out successfully",
    });
  };



  const workshopItems = [
    { path: "/", label: "Workshop Dashboard", icon: LayoutDashboard },
    { path: "/job-cards", label: "Job Cards", icon: ClipboardList },
    { path: "/inspections", label: "Inspections & Faults", icon: Search },
    { path: "/tyre-management", label: "Tyre Management", icon: Gauge },
    { path: "/vehicles", label: "Fleet Management", icon: Truck },
    { path: "/procurement", label: "Procurement & Inventory", icon: ShoppingCart },
    { path: "/maintenance-scheduling", label: "Maintenance Scheduling", icon: Calendar },
    { path: "/inspector-profiles", label: "Profile Management", icon: Users },
  ];

  const operationsItems = [
    // { path: "/analytics", label: "Delivery Analytics", icon: BarChart3 }, // Temporarily disabled
    // { path: "/performance", label: "Performance Analytics", icon: TrendingUp }, // Temporarily disabled - YTD moved to Trip Management
    { path: "/trip-management", label: "Trip Management", icon: Truck },
    // { path: "/load-management", label: "Load Management", icon: Package }, // Temporarily disabled
    { path: "/driver-management", label: "Driver Management", icon: Users },
    { path: "/diesel-management", label: "Diesel Management", icon: Fuel },
    { path: "/fuel-bunkers", label: "Fuel Bunkers", icon: Fuel },
    // { path: "/invoicing", label: "Invoicing", icon: FileText }, // Temporarily disabled - moved to Trip Management
    { path: "/action-log", label: "Action Log", icon: ClipboardCheck },
    { path: "/unified-map", label: "Fleet Map & Reports", icon: MapPin },
    { path: "/reports", label: "Reports", icon: FileText },
  ];

  const NavLinks = () => (
    <>
      <Collapsible open={isWorkshopOpen} onOpenChange={setIsWorkshopOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-secondary/50 transition-colors group">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">Workshop</span>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isWorkshopOpen && "transform rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 mt-0.5">
          {workshopItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-sm",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-accent-foreground")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </CollapsibleContent>
      </Collapsible>

      <div className="my-2 mx-3 border-t border-border/30" />

      <Collapsible open={isOperationsOpen} onOpenChange={setIsOperationsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-secondary/50 transition-colors group">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">Operations</span>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isOperationsOpen && "transform rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 mt-0.5">
          {operationsItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-sm",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-accent-foreground")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex md:flex-col border-r border-border/50 bg-gradient-to-b from-card to-card/95 shadow-sm">
        <div className="flex h-14 items-center gap-2.5 border-b border-border/50 px-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-md">
            <span className="text-accent-foreground font-bold text-sm">MT</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">Matanuska Transport</h2>
            <p className="text-[10px] text-muted-foreground">Fleet Management</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto scrollbar-thin">
          <NavLinks />
        </nav>
        <div className="px-2 py-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 h-9 text-muted-foreground hover:text-foreground hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Logout</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-card z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold">MT</span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Matanuska Transport</h2>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <nav className="space-y-1 mt-6">
              <NavLinks />
            </nav>
            <div className="mt-6 pt-6 border-t border-border">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="md:pl-60 pt-16 md:pt-0">
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;