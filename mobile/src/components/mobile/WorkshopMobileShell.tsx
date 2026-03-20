import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useGeofenceNotifications } from "@/hooks/useGeofenceNotifications";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  LogOut,
  Menu,
  Search,
  Settings,
  Wrench,
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export type WorkshopTab = "job-cards" | "inspections" | "maintenance" | "tyres" | "follow-ups";

interface WorkshopMobileShellProps {
  children: ReactNode;
  activeTab: WorkshopTab;
  onTabChange: (tab: WorkshopTab) => void;
  badgeCounts?: {
    jobCards?: number;
    inspections?: number;
    maintenance?: number;
    tyres?: number;
    followUps?: number;
  };
}

interface TabConfig {
  id: WorkshopTab;
  label: string;
  icon: typeof ClipboardList;
  activeIcon?: typeof ClipboardList;
  color: string;
}

const tabs: TabConfig[] = [
  {
    id: "job-cards",
    label: "Job Cards",
    icon: ClipboardList,
    activeIcon: ClipboardList,
    color: "text-blue-500"
  },
  {
    id: "inspections",
    label: "Inspections",
    icon: Search,
    activeIcon: ClipboardCheck,
    color: "text-amber-500"
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Calendar,
    activeIcon: Wrench,
    color: "text-emerald-500"
  },
  {
    id: "tyres",
    label: "Tyres",
    icon: CircleDot,
    activeIcon: CircleDot,
    color: "text-purple-500"
  },
  {
    id: "follow-ups",
    label: "Follow-ups",
    icon: ExternalLink,
    activeIcon: ExternalLink,
    color: "text-rose-500"
  },
];

const WorkshopMobileShell = ({
  children,
  activeTab,
  onTabChange,
  badgeCounts = {},
}: WorkshopMobileShellProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [moreOpen, setMoreOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useGeofenceNotifications();

  // Fetch user info for profile
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.email?.split('@')[0] || 'User');
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      navigate("/auth");
      toast({
        title: "Logged out successfully",
        description: "See you next time!",
      });
    } catch {
      // Error variable not needed - using empty catch
      toast({
        title: "Error logging out",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabPress = (tab: TabConfig) => {
    onTabChange(tab.id);
  };

  const getBadge = (tabId: WorkshopTab) => {
    const count =
      tabId === "job-cards" ? badgeCounts.jobCards :
        tabId === "inspections" ? badgeCounts.inspections :
          tabId === "maintenance" ? badgeCounts.maintenance :
            tabId === "tyres" ? badgeCounts.tyres :
              badgeCounts.followUps;

    if (!count || count === 0) return null;

    return (
      <div className="absolute -top-1.5 -right-1.5">
        <Badge
          variant="destructive"
          className="h-5 min-w-[20px] px-1 text-[10px] font-bold flex items-center justify-center"
        >
          {count > 99 ? "99+" : count}
        </Badge>
      </div>
    );
  };

  const getBadgeColor = (tabId: WorkshopTab) => {
    if (tabId === "inspections" && badgeCounts.inspections) return "text-rose-500";
    if (tabId === "maintenance" && badgeCounts.maintenance) return "text-amber-500";
    if (tabId === "tyres" && badgeCounts.tyres) return "text-purple-500";
    if (tabId === "follow-ups" && badgeCounts.followUps) return "text-rose-500";
    return "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* Mobile Header with safe-area */}
      <header className="fixed top-0 left-0 right-0 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 z-50 safe-area-top">
        <div className="h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-sm">MW</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                Mobile Workshop
              </h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live updates every 30s
              </p>
            </div>
          </div>

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl hover:bg-muted transition-colors"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="p-6 pb-2">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>

              {/* User Info */}
              <div className="px-6 py-4 border-y border-border/50 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
                    {userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{userName || 'Workshop User'}</p>
                    <p className="text-xs text-muted-foreground">Workshop Portal</p>
                  </div>
                </div>
              </div>

              <nav className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                  Quick Stats
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4 px-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Active Jobs</p>
                    <p className="text-xl font-bold">{badgeCounts.jobCards || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Open Faults</p>
                    <p className="text-xl font-bold">{badgeCounts.inspections || 0}</p>
                  </div>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                  Settings
                </p>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 h-11"
                  onClick={() => {
                    setMoreOpen(false);
                    // Navigate to settings if needed
                  }}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 h-11 text-rose-600 hover:text-rose-600 hover:bg-rose-50"
                  onClick={handleLogout}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Logout
                </Button>
              </nav>

              <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="text-[10px] text-muted-foreground">
                  Version 2.0.0 • Workshop Mobile
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-16 pb-20 safe-area-bottom">
        <div className="relative">
          {children}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-t border-border/40 z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-20 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const ActiveIcon = tab.activeIcon || tab.icon;
            const isActive = activeTab === tab.id;
            const hasBadge = getBadge(tab.id);
            const badgeColor = getBadgeColor(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 relative transition-all duration-200",
                  isActive
                    ? "text-primary scale-105"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-primary shadow-lg shadow-primary/25" />
                )}

                <div className="relative">
                  {isActive ? (
                    <ActiveIcon className={cn("h-6 w-6 stroke-[2]", badgeColor)} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {hasBadge}
                </div>

                <span className={cn(
                  "text-[10px] leading-tight font-medium",
                  isActive && "font-semibold",
                  hasBadge && badgeColor
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Alert for critical items */}
      {(badgeCounts.inspections && badgeCounts.inspections > 5) && (
        <div className="fixed bottom-24 left-4 right-4 z-40 animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">
              {badgeCounts.inspections} open faults require attention
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-100"
              onClick={() => onTabChange("inspections")}
            >
              View
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkshopMobileShell;