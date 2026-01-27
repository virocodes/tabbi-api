"use client";

import { useState } from "react";
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
    <div className="key-list">
      {/* Active keys */}
      {activeKeys.map((key, index) => (
        <div
          key={key.id}
          className="key-item"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="key-item-content">
            <div className="key-item-main">
              {/* Key name and badge */}
              <div className="key-item-header">
                <h3 className="key-item-name">{key.name}</h3>
                <span className={key.environment === "live" ? "badge badge-live" : "badge badge-test"}>
                  {key.environment}
                </span>
              </div>

              {/* Key prefix */}
              <div className="key-item-prefix">
                <code>
                  {key.key_prefix}
                  <span className="key-item-masked">••••••••••••••••</span>
                </code>
              </div>

              {/* Metadata */}
              <div className="key-item-meta">
                <span className="key-item-meta-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Created {formatDate(key.created_at)}
                </span>
                <span className="key-item-meta-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Last used {formatDate(key.last_used_at)}
                </span>
              </div>
            </div>

            {/* Revoke button */}
            <div className="key-item-actions">
              {confirmId === key.id ? (
                <div className="key-item-confirm">
                  <button onClick={() => setConfirmId(null)} className="btn btn-ghost btn-sm">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    disabled={revokingId === key.id}
                    className="btn btn-danger btn-sm"
                  >
                    {revokingId === key.id ? (
                      <span className="btn-loading">
                        <span className="spinner" />
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
                  className="btn btn-ghost btn-sm key-item-revoke"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {activeKeys.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <p className="empty-state-title">No API keys yet</p>
          <p className="empty-state-subtitle">Create your first key to get started</p>
        </div>
      )}

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <details className="revoked-keys">
          <summary className="revoked-keys-summary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {revokedKeys.length} revoked key{revokedKeys.length > 1 ? "s" : ""}
          </summary>
          <div className="revoked-keys-list">
            {revokedKeys.map((key) => (
              <div key={key.id} className="revoked-key-item">
                <div className="revoked-key-info">
                  <span className="revoked-key-name">{key.name}</span>
                  <span className="badge badge-revoked">Revoked</span>
                </div>
                <span className="revoked-key-date">{formatDate(key.revoked_at)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
