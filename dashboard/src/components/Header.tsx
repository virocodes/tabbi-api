"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function Header({ email }: { email: string }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center glow-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-4 h-4 text-accent"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-mono text-lg font-semibold tracking-tight">
            agent<span className="text-accent">.</span>api
          </span>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-text-muted">signed in as</span>
            <span className="text-text-secondary font-mono">{email}</span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="btn-ghost text-text-muted hover:text-text-primary"
          >
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                Signing out...
              </span>
            ) : (
              "Sign out"
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
