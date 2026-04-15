import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { BottomNav } from "./bottom-nav";
import { useEffect, useRef } from "react";

const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Debug logger with proper typing
const debugLog = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.log(`📱 [MOBILE_SHELL][INFO] ${message}`, data || '');
  },
  error: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.error(`❌ [MOBILE_SHELL][ERROR] ${message}`, data || '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.warn(`⚠️ [MOBILE_SHELL][WARN] ${message}`, data || '');
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.debug(`🐛 [MOBILE_SHELL][DEBUG] ${message}`, data || '');
  }
};

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
  const { isLoading, error, user, session } = useAuth();
  const mountedRef = useRef(true);
  const renderCountRef = useRef(0);
  
  // Track render count for debugging
  renderCountRef.current++;
  
  // Debug logging on mount and unmount
  useEffect(() => {
    debugLog.info('MobileShell mounted', {
      showNav,
      hasChildren: !!children,
      renderCount: renderCountRef.current
    });
    
    return () => {
      debugLog.info('MobileShell unmounting');
      mountedRef.current = false;
    };
  }, [showNav, children]);
  
  // Log auth state changes
  useEffect(() => {
    if (!DEBUG_MODE) return;
    
    debugLog.debug('Auth state in MobileShell', {
      isLoading,
      hasError: !!error,
      errorMessage: error || undefined,
      hasUser: !!user,
      userEmail: user?.email,
      hasSession: !!session,
      sessionExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
    });
  }, [isLoading, error, user, session]);
  
  // Log when error state changes
  useEffect(() => {
    if (error) {
      debugLog.error('Auth error detected in MobileShell', { error });
    }
  }, [error]);
  
  // Log when loading state changes
  useEffect(() => {
    if (DEBUG_MODE) {
      debugLog.debug('Loading state changed', { isLoading, isAuthenticated: !!user });
    }
  }, [isLoading, user]);

  // Show error state if auth failed to initialize
  if (error) {
    debugLog.warn('Rendering error state', { error });
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
              onClick={() => {
                debugLog.info('Retry button clicked - reloading page');
                window.location.reload();
              }}
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
    debugLog.debug('Rendering loading state');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary animate-pulse" />
          <p className="text-muted-foreground text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  debugLog.debug('Rendering main content', { 
    showNav, 
    hasUser: !!user,
    className: className || 'none'
  });

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