"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently (don't nag more than once per day)
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS (Safari doesn't support beforeinstallprompt)
    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInStandaloneMode =
      "standalone" in window.navigator &&
      (window.navigator as unknown as { standalone: boolean }).standalone;

    if (isIosDevice && !isInStandaloneMode) {
      setIsIos(true);
      setShowBanner(true);
      return;
    }

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (isInstalled || !showBanner) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] p-4 safe-area-top animate-fade-up">
      <div className="mx-auto max-w-md rounded-2xl bg-primary p-4 shadow-lg border border-primary/20">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
            <Download className="w-6 h-6 text-primary-foreground" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary-foreground">
              Install Matanuska App
            </p>
            {isIos ? (
              <p className="text-xs text-primary-foreground/80 mt-1">
                Tap{" "}
                <span className="inline-flex items-center px-1">
                  <svg
                    className="w-4 h-4 inline"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16,6 12,2 8,6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </span>{" "}
                Share then <strong>&quot;Add to Home Screen&quot;</strong>
              </p>
            ) : (
              <p className="text-xs text-primary-foreground/80 mt-1">
                Add to your home screen for the best experience
              </p>
            )}

            {/* Install button (Android/Chrome only) */}
            {!isIos && (
              <button
                onClick={handleInstall}
                className="mt-2.5 w-full py-2.5 px-4 rounded-xl bg-primary-foreground text-primary text-sm font-bold active:scale-[0.97] transition-transform shadow-sm"
                aria-label="Install app to home screen"
              >
                Install App
              </button>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center active:bg-primary-foreground/25 transition-colors"
            aria-label="Dismiss install prompt"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}