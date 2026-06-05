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
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="page-title text-xl text-foreground">
              MATA Monitor
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground mt-1 font-medium">
              Fleet Command Center
            </p>
          </div>
        </div>

        {/* Auth form */}
        <div className="bg-card border border-border rounded p-6 shadow-card">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(217 33% 17%)",
                    brandAccent: "hsl(217 33% 12%)",
                    inputBackground: "hsl(0 0% 100%)",
                    inputBorder: "hsl(220 13% 91%)",
                    inputText: "hsl(222 47% 11%)",
                    inputPlaceholder: "hsl(215 16% 47%)",
                    messageText: "hsl(222 47% 11%)",
                    anchorTextColor: "hsl(217 33% 17%)",
                  },
                },
              },
              style: {
                container: { background: "transparent" },
                label: { color: "hsl(222 47% 11%)", fontSize: "13px", fontWeight: "500" },
                button: {
                  borderRadius: "4px",
                  fontWeight: "600",
                },
                input: {
                  borderRadius: "4px",
                  fontSize: "14px",
                },
              },
            }}
            providers={[]}
            redirectTo={window.location.origin + "/alerts"}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Use your MATA dashboard credentials to sign in.
        </p>
      </div>
    </div>
  );
}
