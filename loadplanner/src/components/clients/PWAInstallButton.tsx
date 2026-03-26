import { useClientPWA } from '@/hooks/useClientPWA';
import { Download, CheckCircle } from 'lucide-react';

/** Modern install button shown in the client dashboard header */
export function PWAInstallButton() {
  const { canInstall, isInstalled, installApp } = useClientPWA();

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
        <CheckCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">App Installed</span>
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <button
      onClick={installApp}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 border border-primary/30 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
      title="Install this app on your device"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
