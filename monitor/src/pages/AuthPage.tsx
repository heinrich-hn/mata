import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Shield } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate("/alerts", { replace: true });
  }, [session, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Professional Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-card">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              MAT Monitor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fleet Command Center
            </p>
          </div>
        </div>

        {/* Auth form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-card">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(222 47% 35%)",
                    brandAccent: "hsl(222 47% 25%)",
                    inputBackground: "hsl(0 0% 100%)",
                    inputBorder: "hsl(220 13% 88%)",
                    inputText: "hsl(222 47% 11%)",
                    inputPlaceholder: "hsl(220 9% 60%)",
                    messageText: "hsl(222 47% 11%)",
                    anchorTextColor: "hsl(222 47% 35%)",
                  },
                },
              },
              style: {
                container: { background: "transparent" },
                label: { color: "hsl(222 47% 11%)", fontSize: "13px", fontWeight: "500" },
                button: {
                  borderRadius: "6px",
                  fontWeight: "600",
                },
                input: {
                  borderRadius: "6px",
                  fontSize: "14px",
                },
              },
            }}
            providers={[]}
            redirectTo={window.location.origin + "/alerts"}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Use your MAT dashboard credentials to sign in.
        </p>
      </div>
    </div>
  );
}
