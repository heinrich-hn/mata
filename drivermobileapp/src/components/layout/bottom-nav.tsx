import { cn } from "@/lib/utils";
import { Droplets, LayoutGrid, Route, User, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: LayoutGrid,
  },
  {
    href: "/diesel",
    label: "Diesel",
    icon: Droplets,
  },
  {
    href: "/trip",
    label: "Trips",
    icon: Route,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
  },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 safe-area-bottom">
      <div className="relative mx-auto max-w-md">
        {/* Main nav container — light, clean card */}
        <div className="relative flex items-center justify-around h-[72px] px-3 rounded-[22px] bg-card border border-border shadow-lg">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                aria-label={item.label}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 no-select",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                {/* Icon container */}
                <div className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10 shadow-sm"
                )}>
                  <Icon
                    className="w-5 h-5"
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                </div>

                {/* Label */}
                <span className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.2em]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}