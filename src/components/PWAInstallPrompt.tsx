import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, Monitor, Plus, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PWAInstallPromptProps {
  /** Delay before showing the prompt automatically (ms). Set to 0 to disable auto-show. */
  autoShowDelay?: number;
  /** Key used in localStorage to track dismissals */
  storageKey?: string;
}

export function PWAInstallPrompt({
  autoShowDelay = 30000, // Show after 30 seconds by default
  storageKey = 'pwa-install-dismissed'
}: PWAInstallPromptProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const { isInstallable, isInstalled, isIOS, isAndroid, isWindows, isMobile, promptInstall } = usePWAInstall();

  useEffect(() => {
    // Don't show if already installed
    if (isInstalled) return;

    // Check if user has dismissed the prompt recently (within 7 days)
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    // Auto-show after delay
    if (autoShowDelay > 0 && (isInstallable || isIOS)) {
      const timer = setTimeout(() => {
        setShowDialog(true);
      }, autoShowDelay);

      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, isIOS, autoShowDelay, storageKey]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    const installed = await promptInstall();
    if (installed) {
      setShowDialog(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(storageKey, new Date().toISOString());
    setShowDialog(false);
    setShowIOSInstructions(false);
  };

  // Don't render anything if installed
  if (isInstalled) return null;

  // Determine icon and platform text
  const PlatformIcon = isMobile ? Smartphone : Monitor;
  const platformText = isAndroid ? 'Android' : isWindows ? 'Windows' : isIOS ? 'iOS' : 'your device';

  return (
    <>
      {/* Floating Install Button (shown when installable) */}
      {(isInstallable || isIOS) && !showDialog && (
        <Button
          onClick={() => setShowDialog(true)}
          className="fixed bottom-4 right-4 z-50 shadow-lg gap-2"
          size="lg"
        >
          <Download className="h-5 w-5" />
          Install App
        </Button>
      )}

      {/* Install Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlatformIcon className="h-5 w-5 text-primary" />
              Install Matanuska Transport
            </DialogTitle>
            <DialogDescription>
              Get quick access to the app on {platformText}
            </DialogDescription>
          </DialogHeader>

          {showIOSInstructions ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To install on iOS, follow these steps:
              </p>
              <ol className="list-none space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    1
                  </span>
                  <span className="flex items-center gap-2">
                    Tap the Share button <Share className="h-4 w-4 inline" /> in Safari
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    2
                  </span>
                  <span>Scroll down and tap "Add to Home Screen"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    3
                  </span>
                  <span className="flex items-center gap-2">
                    Tap <Plus className="h-4 w-4 inline" /> Add
                  </span>
                </li>
              </ol>
              <Button onClick={handleDismiss} className="w-full mt-4">
                Got it
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Download className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Works Offline</p>
                    <p className="text-xs text-muted-foreground">
                      Access your data even without internet
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Quick Launch</p>
                    <p className="text-xs text-muted-foreground">
                      Open directly from your home screen
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Monitor className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Full Screen Experience</p>
                    <p className="text-xs text-muted-foreground">
                      No browser UI, feels like a native app
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDismiss} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Not now
                </Button>
                <Button onClick={handleInstall} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Install
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PWAInstallPrompt;