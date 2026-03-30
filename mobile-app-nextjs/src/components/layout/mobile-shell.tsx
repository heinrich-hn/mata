import { useAuth } from "@/contexts/auth-context";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BottomNav } from "./bottom-nav";

interface MobileShellProps {
  children: React.ReactNode;
  className?: string;
  showNav?: boolean;
}

export function MobileShell({
  children,
  className,
  showNav = true,
}: MobileShellProps) {
  const { isLoading, error, user } = useAuth();
  const navigate = useNavigate();

  // Auto sign-out after 5 minutes of inactivity
  useInactivityTimeout();

  // Redirect to login if not authenticated after loading completes
  useEffect(() => {
    if (!isLoading && !user && !error) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, user, error, navigate]);

  // Show error state if auth failed to initialize
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-foreground font-semibold">Configuration Error</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary animate-pulse" />
          <p className="text-muted-foreground text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <main
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-y-none touch-scroll safe-area-top scrollbar-hide px-4 sm:px-5",
          showNav && "pb-32",
          className
        )}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}