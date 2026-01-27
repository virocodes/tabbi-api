"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="auth-page">
      <div className="auth-content">
        <div className="auth-card">
          <h1 className="auth-title">Welcome to tabbi</h1>
          <p className="auth-subtitle">Sign in to manage your API keys</p>

          <div className="auth-form">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#2563eb",
                      brandAccent: "#1d4ed8",
                      brandButtonText: "#ffffff",
                      defaultButtonBackground: "#f8f9fa",
                      defaultButtonBackgroundHover: "#f1f3f5",
                      defaultButtonBorder: "#e2e8f0",
                      defaultButtonText: "#0f172a",
                      inputBackground: "#f8f9fa",
                      inputBorder: "#e2e8f0",
                      inputBorderHover: "#cbd5e1",
                      inputBorderFocus: "#2563eb",
                      inputText: "#0f172a",
                      inputPlaceholder: "#94a3b8",
                      messageText: "#64748b",
                      messageTextDanger: "#ef4444",
                      anchorTextColor: "#2563eb",
                      anchorTextHoverColor: "#1d4ed8",
                    },
                    fonts: {
                      bodyFontFamily: "var(--font-sans), system-ui, sans-serif",
                      buttonFontFamily: "var(--font-sans), system-ui, sans-serif",
                      inputFontFamily: "var(--font-sans), system-ui, sans-serif",
                      labelFontFamily: "var(--font-sans), system-ui, sans-serif",
                    },
                    fontSizes: {
                      baseBodySize: "14px",
                      baseInputSize: "14px",
                      baseLabelSize: "13px",
                      baseButtonSize: "14px",
                    },
                    space: {
                      inputPadding: "12px 14px",
                      buttonPadding: "12px 16px",
                    },
                    borderWidths: {
                      buttonBorderWidth: "1px",
                      inputBorderWidth: "1px",
                    },
                    radii: {
                      borderRadiusButton: "6px",
                      buttonBorderRadius: "6px",
                      inputBorderRadius: "6px",
                    },
                  },
                },
              }}
              providers={["github", "google"]}
              redirectTo={typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined}
            />
          </div>

          <p className="auth-footer">
            AI coding agents in sandboxed environments
          </p>
        </div>
      </div>
    </div>
  );
}
