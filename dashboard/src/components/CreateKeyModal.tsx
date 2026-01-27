"use client";

import { useState, useEffect } from "react";
import { createApiKey, type ApiKey } from "@/lib/supabase";

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (key: string, keyData: ApiKey) => void;
}

export function CreateKeyModal({ isOpen, onClose, onCreated }: CreateKeyModalProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const { key, keyData } = await createApiKey(name.trim(), environment);
      setCreatedKey(key);
      onCreated(key, keyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName("");
    setEnvironment("live");
    setCreatedKey(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`modal-backdrop ${isOpen ? "modal-backdrop-visible" : ""}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`modal ${isOpen ? "modal-visible" : ""}`}>
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header">
            <h2 className="modal-title">
              {createdKey ? "Key Created" : "Create API Key"}
            </h2>
            <button onClick={handleClose} className="modal-close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {createdKey ? (
            /* Success state */
            <div className="modal-body">
              <div className="success-banner">
                <div className="success-banner-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="success-banner-text">
                  <p className="success-banner-title">Copy your API key now</p>
                  <p className="success-banner-subtitle">You won&apos;t be able to see it again. Store it securely.</p>
                </div>
              </div>

              {/* Key display */}
              <div className="key-display-wrapper">
                <div className="key-display">
                  <code>{createdKey}</code>
                </div>
                <button onClick={handleCopy} className="key-copy-btn">
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>

              <button onClick={handleClose} className="btn btn-primary btn-full">
                Done
              </button>
            </div>
          ) : (
            /* Create form */
            <div className="modal-body">
              {/* Name input */}
              <div className="form-group">
                <label htmlFor="key-name" className="form-label">Name</label>
                <input
                  id="key-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production, Development"
                  className="form-input"
                  autoFocus
                />
              </div>

              {/* Environment toggle */}
              <div className="form-group">
                <label className="form-label">Environment</label>
                <div className="env-toggle">
                  <button
                    type="button"
                    onClick={() => setEnvironment("live")}
                    className={`env-toggle-btn ${environment === "live" ? "env-toggle-btn-live active" : ""}`}
                  >
                    <span className={`env-toggle-dot ${environment === "live" ? "env-toggle-dot-live" : ""}`} />
                    Live
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironment("test")}
                    className={`env-toggle-btn ${environment === "test" ? "env-toggle-btn-test active" : ""}`}
                  >
                    <span className={`env-toggle-dot ${environment === "test" ? "env-toggle-dot-test" : ""}`} />
                    Test
                  </button>
                </div>
                <p className="form-hint">
                  {environment === "live"
                    ? "Use for production applications"
                    : "Use for development and testing"}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="error-banner">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="modal-actions">
                <button onClick={handleClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || isCreating}
                  className="btn btn-primary"
                >
                  {isCreating ? (
                    <span className="btn-loading">
                      <span className="spinner" />
                      Creating...
                    </span>
                  ) : (
                    "Create Key"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
