import { Skeleton } from '@/components/ui/skeleton';
import { useClient } from '@/hooks/useClientLoads';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import { ClientPWARegistration } from './ClientPWARegistration';
import { PWAInstallButton } from './PWAInstallButton';
import { PWAInstallPrompt } from './PWAInstallPrompt';

interface ClientDashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: 'Overview', path: '' },
  { title: 'Live Map', path: 'live-map' },
  { title: 'Deliveries', path: 'deliveries' },
  { title: 'Past Deliveries', path: 'past-deliveries' },
  { title: 'Documents', path: 'documents' },
];

export function ClientDashboardLayout({ children }: ClientDashboardLayoutProps) {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const { data: client, isLoading } = useClient(clientId);

  // Determine base path - use /portal for public access, /customers for admin access
  const basePath = location.pathname.startsWith('/portal') ? '/portal' : '/customers';

  // Only register PWA on the public portal route
  const isPortal = location.pathname.startsWith('/portal');

  return (
    <div className="client-dashboard-scope min-h-screen bg-gradient-to-br from-background to-muted/20 flex flex-col">
      {/* PWA registration — portal only */}
      {isPortal && <ClientPWARegistration />}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl overflow-hidden bg-white border border-border shadow-sm flex-shrink-0">
                <img
                  src="/loadplan-logo.png"
                  alt="LoadPlan"
                  className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
                />
              </div>

              {isLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <div className="min-w-0 space-y-0.5">
                  <h1 className="font-bold text-base sm:text-lg leading-tight truncate">
                    {client?.name || 'Client Portal'}
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium hidden sm:block">Client Dashboard</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {isPortal && <PWAInstallButton />}
              {client && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  {client.contact_person && (
                    <span className="hidden lg:inline-flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {client.contact_person}
                    </span>
                  )}
                  {client.contact_email && (
                    <a
                      href={`mailto:${client.contact_email}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {client.contact_email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Always-visible horizontal scrollable tab navigation */}
        <nav className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none -mb-px">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={`${basePath}/${clientId}${item.path ? `/${item.path}` : ''}`}
                end={item.path === ''}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors border-b-2',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )
                }
              >
                {item.title}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-5 sm:py-7">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card/70 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3 text-center text-xs text-muted-foreground">
          <p>
            Powered by <span className="font-semibold text-foreground">LoadPlan</span>
          </p>
        </div>
      </footer>

      {/* PWA install banner — portal only */}
      {isPortal && <PWAInstallPrompt />}
    </div>
  );
}
