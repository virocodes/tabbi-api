"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase, getApiKeys, getUsageStats, type ApiKey } from "@/lib/supabase";
import { Header } from "@/components/Header";
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

  const handleKeyCreated = (key: string, keyData: ApiKey) => {
    setKeys((prev) => [keyData, ...prev]);
  };

  const handleKeyRevoked = (keyId: string) => {
    setKeys((prev) =>
      prev.map((k) =>
        k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k
      )
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary font-mono">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header email={email} />

      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #333 1px, transparent 1px),
            linear-gradient(to bottom, #333 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <main className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Dashboard
          </h1>
          <p className="text-text-secondary">
            Manage your API keys and monitor usage
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* API Keys section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-text-primary">API Keys</h2>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="btn-primary"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Key
                </button>
              </div>
              <ApiKeyList keys={keys} onRevoke={handleKeyRevoked} />
            </motion.section>

            {/* Usage stats */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-lg font-medium text-text-primary mb-4">Usage</h2>
              <UsageStats {...stats} />
            </motion.section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <QuickStart />

            {/* Help card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <h3 className="text-sm font-medium text-text-primary mb-3">
                Need help?
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-text-secondary hover:text-accent transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-text-secondary hover:text-accent transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="text-text-secondary hover:text-accent transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                  </a>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Create key modal */}
      <CreateKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleKeyCreated}
      />

      {/* Terminal decoration */}
      <div className="fixed bottom-6 left-6 hidden lg:flex items-center gap-2 text-text-muted font-mono text-xs">
        <span className="text-accent">~</span>
        <span>tabbi</span>
        <span className="text-accent">$</span>
        <span className="w-1.5 h-3 bg-accent animate-blink" />
      </div>
    </div>
  );
}
