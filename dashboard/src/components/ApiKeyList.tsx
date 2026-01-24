"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiKey } from "@/lib/supabase";
import { revokeApiKey } from "@/lib/supabase";

interface ApiKeyListProps {
  keys: ApiKey[];
  onRevoke: (keyId: string) => void;
}

export function ApiKeyList({ keys, onRevoke }: ApiKeyListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      await revokeApiKey(keyId);
      onRevoke(keyId);
    } finally {
      setRevokingId(null);
      setConfirmId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-4">
      {/* Active keys */}
      <AnimatePresence mode="popLayout">
        {activeKeys.map((key, index) => (
          <motion.div
            key={key.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: index * 0.05 }}
            className="group card hover:border-border-strong transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Key name and badge */}
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium text-text-primary truncate">
                    {key.name}
                  </h3>
                  <span
                    className={
                      key.environment === "live" ? "badge-live" : "badge-test"
                    }
                  >
                    {key.environment}
                  </span>
                </div>

                {/* Key prefix */}
                <div className="flex items-center gap-2 mb-3">
                  <code className="font-mono text-sm text-text-secondary bg-bg-tertiary px-2 py-1 rounded">
                    {key.key_prefix}
                    <span className="text-text-muted">••••••••••••••••</span>
                  </code>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Created {formatDate(key.created_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Last used {formatDate(key.last_used_at)}
                  </span>
                </div>
              </div>

              {/* Revoke button */}
              <div className="flex-shrink-0">
                {confirmId === key.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="btn-ghost text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRevoke(key.id)}
                      disabled={revokingId === key.id}
                      className="btn-danger text-xs"
                    >
                      {revokingId === key.id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-status-revoked border-t-transparent rounded-full animate-spin" />
                          Revoking...
                        </span>
                      ) : (
                        "Confirm"
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(key.id)}
                    className="btn-ghost text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Empty state */}
      {activeKeys.length === 0 && (
        <div className="card text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bg-tertiary flex items-center justify-center">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <p className="text-text-secondary mb-1">No API keys yet</p>
          <p className="text-text-muted text-sm">Create your first key to get started</p>
        </div>
      )}

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-text-muted hover:text-text-secondary transition-colors flex items-center gap-2 py-2">
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {revokedKeys.length} revoked key{revokedKeys.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-3 space-y-2">
            {revokedKeys.map((key) => (
              <div
                key={key.id}
                className="card opacity-50 border-border-subtle"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted line-through">{key.name}</span>
                    <span className="badge-revoked">Revoked</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {formatDate(key.revoked_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
