import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Wrench, ClipboardCheck, CalendarClock, CircleDot, BellRing, type LucideIcon } from "lucide-react";
import { ReactNode, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ============================================================================
// Types & Constants
// ============================================================================
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
  shortLabel: string;
  icon: LucideIcon;
  color: string;
  activeBg: string;
  alertThreshold?: number;
}

const TABS_CONFIG: TabConfig[] = [
  {
    id: "job-cards",
    label: "Job Cards",
    shortLabel: "Jobs",
    icon: Wrench,
    color: "text-blue-600",
    activeBg: "bg-blue-50 border-blue-200",
    alertThreshold: 10,
  },
  {
    id: "inspections",
    label: "Inspections",
    shortLabel: "Inspect",
    icon: ClipboardCheck,
    color: "text-amber-600",
    activeBg: "bg-amber-50 border-amber-200",
    alertThreshold: 5,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    shortLabel: "Maint.",
    icon: CalendarClock,
    color: "text-emerald-600",
    activeBg: "bg-emerald-50 border-emerald-200",
    alertThreshold: 3,
  },
  {
    id: "tyres",
    label: "Tyres",
    shortLabel: "Tyres",
    icon: CircleDot,
    color: "text-purple-600",
    activeBg: "bg-purple-50 border-purple-200",
    alertThreshold: 2,
  },
  {
    id: "follow-ups",
    label: "Follow-ups",
    shortLabel: "Follow",
    icon: BellRing,
    color: "text-rose-600",
    activeBg: "bg-rose-50 border-rose-200",
    alertThreshold: 3,
  },
] as const;

const APP_VERSION = "2.0.0";
const APP_NAME = "Mobile Workshop";

// ============================================================================
// Sub-components
// ============================================================================
const TabButton = ({
  tab,
  isActive,
  hasBadge,
  badgeCount,
  onClick
}: {
  tab: TabConfig;
  isActive: boolean;
  hasBadge: boolean;
  badgeCount?: number;
  onClick: () => void;
}) => {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200 touch-target rounded-xl mx-0.5",
        isActive
          ? cn("border", tab.activeBg, tab.color, "scale-[1.02]")
          : "text-muted-foreground hover:text-foreground active:scale-95 hover:bg-muted/50"
      )}
      aria-label={tab.label}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && (
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-current opacity-80" />
      )}

      <Icon className="h-5 w-5" />

      <span className={cn(
        "text-[10px] leading-tight font-semibold tracking-tight",
        isActive ? "font-bold" : "font-medium"
      )}>
        {tab.shortLabel}
      </span>

      {hasBadge && badgeCount ? (
        <span className={cn(
          "absolute -top-1 -right-0.5 text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
          isActive
            ? "bg-current/10 text-inherit"
            : "bg-rose-100 text-rose-600"
        )}>
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </button>
  );
};

const UserProfile = ({ userName, email }: { userName: string | null; email?: string }) => (
  <div className="px-6 py-5 border-y border-border/50 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md shadow-primary/20">
        {userName?.charAt(0).toUpperCase() || 'U'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{userName || 'Workshop User'}</p>
        {email && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-medium uppercase tracking-wider">Workshop Portal</p>
      </div>
    </div>
  </div>
);

const QuickStats = ({ badgeCounts }: { badgeCounts: WorkshopMobileShellProps["badgeCounts"] }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
      Quick Stats
    </p>
    <div className="grid grid-cols-2 gap-2.5 mb-4 px-3">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 border border-blue-100">
        <p className="text-[10px] text-blue-600/80 font-medium uppercase tracking-wider">Active Jobs</p>
        <p className="text-2xl font-bold text-blue-700 mt-0.5">{badgeCounts?.jobCards || 0}</p>
      </div>
      <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-3 border border-amber-100">
        <p className="text-[10px] text-amber-600/80 font-medium uppercase tracking-wider">Open Faults</p>
        <p className="text-2xl font-bold text-amber-700 mt-0.5">{badgeCounts?.inspections || 0}</p>
      </div>
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3 border border-emerald-100">
        <p className="text-[10px] text-emerald-600/80 font-medium uppercase tracking-wider">Overdue Maint.</p>
        <p className="text-2xl font-bold text-emerald-700 mt-0.5">{badgeCounts?.maintenance || 0}</p>
      </div>
      <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl p-3 border border-rose-100">
        <p className="text-[10px] text-rose-600/80 font-medium uppercase tracking-wider">Follow-ups</p>
        <p className="text-2xl font-bold text-rose-700 mt-0.5">{badgeCounts?.followUps || 0}</p>
      </div>
    </div>
  </div>
);

const CriticalAlert = ({
  count,
  tab,
  onView
}: {
  count: number;
  tab: WorkshopTab;
  onView: () => void;
}) => (
  <div className="fixed bottom-24 left-4 right-4 z-40 animate-in slide-in-from-bottom-2 duration-300">
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 shadow-lg shadow-rose-100/50 flex items-center gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs">
        {count}
      </span>
      <p className="text-xs text-rose-700 flex-1 font-medium">
        {tab === "inspections" ? "faults" : "items"} require attention
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-100 rounded-lg"
        onClick={onView}
      >
        View
      </Button>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user info for profile
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.email?.split('@')[0] || 'User');
        setUserEmail(user.email || null);
      }
    };
    getUser();
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      navigate("/auth");
      toast({
        title: "Logged out successfully",
        description: "See you next time!",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error logging out",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

  // Handle settings navigation
  const handleSettings = useCallback(() => {
    setMoreOpen(false);
    navigate("/settings");
  }, [navigate]);

  // Check for critical alerts
  const criticalAlerts = useMemo(() => {
    const alerts: { count: number; tab: WorkshopTab }[] = [];

    if (badgeCounts.inspections && badgeCounts.inspections > 5) {
      alerts.push({ count: badgeCounts.inspections, tab: "inspections" });
    }
    if (badgeCounts.maintenance && badgeCounts.maintenance > 3) {
      alerts.push({ count: badgeCounts.maintenance, tab: "maintenance" });
    }
    if (badgeCounts.followUps && badgeCounts.followUps > 3) {
      alerts.push({ count: badgeCounts.followUps, tab: "follow-ups" });
    }

    return alerts;
  }, [badgeCounts]);

  // Handle critical alert navigation
  const handleCriticalAlert = useCallback((tab: WorkshopTab) => {
    onTabChange(tab);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [onTabChange]);

  // Memoize badge presence for each tab
  const tabBadges = useMemo(() => ({
    "job-cards": badgeCounts.jobCards ? { has: true, count: badgeCounts.jobCards } : { has: false, count: 0 },
    "inspections": badgeCounts.inspections ? { has: true, count: badgeCounts.inspections } : { has: false, count: 0 },
    "maintenance": badgeCounts.maintenance ? { has: true, count: badgeCounts.maintenance } : { has: false, count: 0 },
    "tyres": badgeCounts.tyres ? { has: true, count: badgeCounts.tyres } : { has: false, count: 0 },
    "follow-ups": badgeCounts.followUps ? { has: true, count: badgeCounts.followUps } : { has: false, count: 0 },
  }), [badgeCounts]);

  // Auto-hide bottom tab bar on scroll down, show on scroll up
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollThreshold = 8;

  useEffect(() => {
    const mainEl = document.getElementById("workshop-main-content");
    if (!mainEl) return;

    const handleScroll = () => {
      const currentY = mainEl.scrollTop;
      const delta = currentY - lastScrollY.current;

      if (delta > scrollThreshold) {
        setTabBarVisible(false);
      } else if (delta < -scrollThreshold) {
        setTabBarVisible(true);
      }

      lastScrollY.current = currentY;
    };

    mainEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => mainEl.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 border-b border-border/30 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 z-50 safe-area-top">
        <div className="h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-primary-foreground font-extrabold text-sm tracking-tight">
                {APP_NAME.split(' ').map(word => word[0]).join('')}
              </span>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                {APP_NAME}
              </h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium">Live</span>
              </p>
            </div>
          </div>

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 rounded-xl hover:bg-muted transition-colors touch-target font-semibold text-xs"
                aria-label="Open menu"
              >
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetHeader className="p-6 pb-3">
                <SheetTitle className="text-left text-lg">Menu</SheetTitle>
              </SheetHeader>

              <UserProfile userName={userName} email={userEmail || undefined} />

              <nav className="p-4 space-y-1">
                <QuickStats badgeCounts={badgeCounts} />

                <div className="pt-3 border-t border-border/50 mt-3 space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 h-11 touch-target font-medium"
                    onClick={handleSettings}
                  >
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 h-11 text-rose-600 hover:text-rose-600 hover:bg-rose-50 touch-target font-medium"
                    onClick={handleLogout}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                    ) : null}
                    Logout
                  </Button>
                </div>
              </nav>

              <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="text-[10px] text-muted-foreground/60 font-medium">
                  v{APP_VERSION} · {APP_NAME}
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="workshop-main-content" className="flex-1 min-h-0 pt-16 pb-20 safe-area-bottom overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative">
          {children}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-t border-border/30 z-50 safe-area-bottom transition-transform duration-300 ease-in-out",
        !tabBarVisible && "translate-y-full"
      )}>
        <div className="flex items-center justify-around h-[68px] px-1.5">
          {TABS_CONFIG.map((tab) => {
            const badge = tabBadges[tab.id];

            return (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                hasBadge={badge.has}
                badgeCount={badge.count}
                onClick={() => onTabChange(tab.id)}
              />
            );
          })}
        </div>
      </nav>

      {/* Critical Alerts - only show when viewing the relevant tab */}
      {criticalAlerts.length > 0 && criticalAlerts[0].tab === activeTab && (
        <CriticalAlert
          count={criticalAlerts[0].count}
          tab={criticalAlerts[0].tab}
          onView={() => handleCriticalAlert(criticalAlerts[0].tab)}
        />
      )}
    </div>
  );
};

export default WorkshopMobileShell;