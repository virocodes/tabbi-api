"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
          >
            <div className="card shadow-2xl shadow-black/50">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">
                  {createdKey ? "Key Created" : "Create API Key"}
                </h2>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-colors"
                >
                  <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {createdKey ? (
                /* Success state */
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-text-primary font-medium mb-1">
                          Copy your API key now
                        </p>
                        <p className="text-xs text-text-muted">
                          You won&apos;t be able to see it again. Store it securely.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Key display */}
                  <div className="relative">
                    <div className="key-display pr-12 overflow-x-auto whitespace-nowrap">
                      <span className="terminal-text">{createdKey}</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded hover:bg-bg-elevated transition-colors"
                    >
                      {copied ? (
                        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <button onClick={handleClose} className="btn-primary w-full">
                    Done
                  </button>
                </div>
              ) : (
                /* Create form */
                <div className="space-y-4">
                  {/* Name input */}
                  <div>
                    <label htmlFor="key-name" className="label">
                      Name
                    </label>
                    <input
                      id="key-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Production, Development"
                      className="input font-mono"
                      autoFocus
                    />
                  </div>

                  {/* Environment toggle */}
                  <div>
                    <label className="label">Environment</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEnvironment("live")}
                        className={`flex-1 px-4 py-2.5 rounded-md border text-sm font-medium transition-all ${
                          environment === "live"
                            ? "bg-status-live/10 border-status-live/30 text-status-live"
                            : "bg-bg-tertiary border-border text-text-secondary hover:border-border-strong"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${environment === "live" ? "bg-status-live" : "bg-text-muted"}`} />
                          Live
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnvironment("test")}
                        className={`flex-1 px-4 py-2.5 rounded-md border text-sm font-medium transition-all ${
                          environment === "test"
                            ? "bg-status-test/10 border-status-test/30 text-status-test"
                            : "bg-bg-tertiary border-border text-text-secondary hover:border-border-strong"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${environment === "test" ? "bg-status-test" : "bg-text-muted"}`} />
                          Test
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      {environment === "live"
                        ? "Use for production applications"
                        : "Use for development and testing"}
                    </p>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-md bg-status-revoked/10 border border-status-revoked/20 text-sm text-status-revoked">
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleClose} className="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!name.trim() || isCreating}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin" />
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
