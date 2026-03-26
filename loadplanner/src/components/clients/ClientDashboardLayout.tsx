import { Skeleton } from '@/components/ui/skeleton';
import { useClient } from '@/hooks/useClientLoads';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import { ClientPWARegistration } from './ClientPWARegistration';
import { PWAInstallButton } from './PWAInstallButton';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface ClientDashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: 'Overview', path: '', icon: null },
  { title: 'Live Map', path: 'live-map', icon: null },
  { title: 'Loads', path: 'loads', icon: null },
  { title: 'Deliveries', path: 'deliveries', icon: null },
  { title: 'Past Deliveries', path: 'past-deliveries', icon: null },
];

export function ClientDashboardLayout({ children }: ClientDashboardLayoutProps) {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const { data: client, isLoading } = useClient(clientId);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl overflow-hidden bg-white border border-border shadow-sm flex-shrink-0">
                <img 
                  src="/loadplan-logo.png" 
                  alt="LoadPlan" 
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain" 
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
                  <p className="text-xs text-muted-foreground font-medium">Client Dashboard</p>
                </div>
              )}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              {isPortal && <PWAInstallButton />}
              {client && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-none pb-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={`${basePath}/${clientId}${item.path ? `/${item.path}` : ''}`}
                end={item.path === ''}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0',
                    'hover:bg-muted/80 hover:text-foreground',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                      : 'text-muted-foreground'
                  )
                }
              >
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card/90 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-3">
                  {isPortal && <PWAInstallButton />}
                </div>
                
                {client && (
                  <div className="flex flex-col items-end text-sm text-muted-foreground">
                    {client.contact_person && (
                      <span className="flex items-center gap-1.5">
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
              
              <nav className="flex flex-col gap-1.5 py-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={`${basePath}/${clientId}${item.path ? `/${item.path}` : ''}`}
                    end={item.path === ''}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50'
                      )
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>{item.title}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-5 sm:py-7">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card/70 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 text-center text-xs sm:text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-1.5">
            Powered by 
            <span className="font-semibold text-foreground">LoadPlan</span> 
            Fleet Management
          </p>
        </div>
      </footer>

      {/* PWA install banner — portal only */}
      {isPortal && <PWAInstallPrompt />}
    </div>
  );
}
