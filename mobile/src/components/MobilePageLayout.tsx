import { ReactNode } from "react";

interface MobilePageLayoutProps {
  children: ReactNode;
}

/**
 * Simple mobile page wrapper (replaces the main app's Layout component).
 * Provides basic padding and scrollable container for standalone pages.
 */
const MobilePageLayout = ({ children }: MobilePageLayoutProps) => {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4">
        {children}
      </div>
    </div>
  );
};

export default MobilePageLayout;
