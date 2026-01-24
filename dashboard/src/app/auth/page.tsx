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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #333 1px, transparent 1px),
            linear-gradient(to bottom, #333 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo & Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center glow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-accent"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-mono text-xl font-semibold tracking-tight">
              agent<span className="text-accent">.</span>api
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Welcome back
          </h1>
          <p className="text-text-secondary text-sm">
            Sign in to manage your API keys
          </p>
        </div>

        {/* Auth Form */}
        <div
          className="animate-slide-up animation-delay-200 opacity-0"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="card">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#22c55e",
                      brandAccent: "#16a34a",
                      brandButtonText: "#0a0a0a",
                      defaultButtonBackground: "#1a1a1a",
                      defaultButtonBackgroundHover: "#222222",
                      defaultButtonBorder: "#333333",
                      defaultButtonText: "#fafafa",
                      inputBackground: "#1a1a1a",
                      inputBorder: "#333333",
                      inputBorderHover: "#444444",
                      inputBorderFocus: "#22c55e",
                      inputText: "#fafafa",
                      inputPlaceholder: "#666666",
                      messageText: "#a1a1a1",
                      messageTextDanger: "#ef4444",
                      anchorTextColor: "#22c55e",
                      anchorTextHoverColor: "#16a34a",
                    },
                    fonts: {
                      bodyFontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      buttonFontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      inputFontFamily: "var(--font-geist-mono), monospace",
                      labelFontFamily: "var(--font-geist-sans), system-ui, sans-serif",
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
                className: {
                  container: "auth-container",
                  button: "auth-button",
                  input: "auth-input",
                },
              }}
              providers={["github", "google"]}
              redirectTo={typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="text-center mt-8 animate-fade-in animation-delay-400 opacity-0"
          style={{ animationFillMode: "forwards" }}
        >
          <p className="text-text-muted text-xs font-mono">
            <span className="text-accent">$</span> AI coding agents in sandboxed environments
          </p>
        </div>
      </div>

      {/* Terminal cursor decoration */}
      <div className="fixed bottom-8 left-8 hidden lg:flex items-center gap-2 text-text-muted font-mono text-sm">
        <span className="text-accent">~</span>
        <span>ready</span>
        <span className="w-2 h-4 bg-accent animate-blink" />
      </div>
    </div>
  );
}
