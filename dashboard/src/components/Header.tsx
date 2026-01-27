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
    <header className="border-b border-border bg-bg-elevated/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo with cat mascot */}
        <div className="flex items-center gap-2.5">
          <span className="cat-mascot text-lg animate-cat-float">
            {"ฅ^>⩊<^ฅ"}
          </span>
          <span className="text-lg font-semibold text-text-primary tracking-tight">
            tabbi
          </span>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-text-muted">signed in as</span>
            <span className="text-text-secondary font-medium">{email}</span>
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
