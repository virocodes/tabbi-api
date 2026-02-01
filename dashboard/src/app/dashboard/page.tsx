"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, getApiKeys, getUsageStats, type ApiKey } from "@/lib/supabase";
import { ApiKeyList } from "@/components/ApiKeyList";
import { CreateKeyModal } from "@/components/CreateKeyModal";
import { UsageStats } from "@/components/UsageStats";
import { QuickStart } from "@/components/QuickStart";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMessages: 0,
    last7Days: [] as { date: string; sessions: number; messages: number }[],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [keysData, statsData] = await Promise.all([
        getApiKeys(),
        getUsageStats(),
      ]);
      setKeys(keysData);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth");
        return;
      }
      setEmail(session.user.email || "");
      loadData();
    };
    checkAuth();
  }, [router, loadData]);

  const handleKeyCreated = (_key: string, keyData: ApiKey) => {
    setKeys((prev) => [keyData, ...prev]);
  };

  const handleKeyRevoked = (keyId: string) => {
    setKeys((prev) =>
      prev.map((k) =>
        k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k
      )
    );
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth");
  };

  if (isLoading) {
    return (
      <div className="loading-page">
        <span className="loading-cat">{">⩊<"}</span>
        <span style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-emoticon">{">⩊<"}</span>
            <span>tabbi</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a href="#" className="sidebar-nav-item active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Dashboard
          </a>
          <a href="/docs" className="sidebar-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Documentation
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {email.charAt(0).toUpperCase()}
            </div>
            <span className="user-name">{email}</span>
          </div>
          <button onClick={handleSignOut} disabled={isLoggingOut} className="logout-btn">
            {isLoggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Manage your API keys and monitor usage</p>
        </header>

        <div className="content-area">
          <div className="content-grid">
            {/* Left column - Main content */}
            <div>
              {/* API Keys Card */}
              <div className="card" style={{ marginBottom: "var(--space-6)" }}>
                <div className="card-header">
                  <h2 className="card-title">API Keys</h2>
                  <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create Key
                  </button>
                </div>
                <ApiKeyList keys={keys} onRevoke={handleKeyRevoked} />
              </div>

              {/* Usage Stats */}
              <div>
                <h2 style={{
                  fontSize: "var(--font-size-base)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "var(--space-4)"
                }}>
                  Usage
                </h2>
                <UsageStats {...stats} />
              </div>
            </div>

            {/* Right column - Sidebar content */}
            <div>
              <QuickStart />

              {/* Help Card */}
              <div className="help-card">
                <h3 className="help-card-title">Need help?</h3>
                <ul className="help-card-list">
                  <li className="help-card-item">
                    <a href="/docs" className="help-card-link">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>
                      Documentation
                    </a>
                  </li>
                  <li className="help-card-item">
                    <a href={process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/docs` : "https://api.tabbi.sh/docs"} target="_blank" rel="noopener noreferrer" className="help-card-link">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                        <line x1="6" y1="6" x2="6.01" y2="6" />
                        <line x1="6" y1="18" x2="6.01" y2="18" />
                      </svg>
                      API Reference
                    </a>
                  </li>
                  <li className="help-card-item">
                    <a href="https://github.com/virocodes/tabbi-api" target="_blank" rel="noopener noreferrer" className="help-card-link">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create key modal */}
      <CreateKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleKeyCreated}
      />
    </div>
  );
}
