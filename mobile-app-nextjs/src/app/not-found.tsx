"use client";

import { MobileShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <MobileShell showNav={false}>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-screen">
        <div className="flex flex-col items-center">
          {/* Error icon */}
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-border">
            <AlertCircle className="w-10 h-10 text-primary" strokeWidth={1.5} />
          </div>

          {/* Error text */}
          <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
          <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
          <p className="text-muted-foreground text-sm max-w-xs mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          {/* Back home button */}
          <Link href="/">
            <Button size="lg" className="gap-2">
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}