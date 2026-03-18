"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn(email, password);

      if (result && result.error) {
        toast({
          title: "Authentication Failed",
          description: result.error.message || "Invalid credentials",
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
        toast({
          title: "Welcome!",
          description: "Signing you in...",
        });
        router.refresh();
        setTimeout(() => {
          router.push("/");
        }, 500);
      }
    } catch (err) {
      console.error("Login error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Brand Header */}
        <div className="text-center mb-10 animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground">Matanuska Fleet</h1>
          <p className="text-sm text-muted-foreground mt-1">Driver Portal</p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md animate-fade-up stagger-1">
          <Card className="shadow-md">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Welcome Back</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your credentials to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-12 px-4 text-base"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-12 px-4 text-base"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "w-full h-12 text-base font-semibold rounded-xl",
                    "transition-all duration-200"
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Signing In...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 animate-fade-up stagger-2">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <button
              onClick={() => {
                toast({
                  title: "Contact Support",
                  description: "Please contact your administrator for assistance",
                });
              }}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Contact Support
            </button>
          </p>
          <p className="text-xs text-muted-foreground/60 mt-4">
            Secure login powered by enterprise authentication
          </p>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold">Authenticating...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Securing your connection
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
