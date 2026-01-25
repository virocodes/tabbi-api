"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function QuickStart() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const installCode = `npm install @tabbi/sdk`;

  const usageCode = `import { Tabbi } from "@tabbi/sdk";

const tabbi = new Tabbi({
  apiKey: "tb_live_your_key_here"
});

const session = await tabbi.createSession();
await session.waitForReady();

await session.sendMessage("Build a REST API", {
  onEvent: (e) => console.log(e)
});

await session.delete();`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="card"
    >
      <h3 className="text-sm font-medium text-text-primary mb-4">Quick Start</h3>

      {/* Install command */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted font-mono">Install</span>
          <button
            onClick={() => handleCopy(installCode, "install")}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {copied === "install" ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="bg-bg-tertiary border border-border rounded-md p-3 font-mono text-sm">
          <span className="text-text-muted">$</span>{" "}
          <span className="text-accent">npm</span>{" "}
          <span className="text-text-primary">install @tabbi/sdk</span>
        </div>
      </div>

      {/* Usage example */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted font-mono">Usage</span>
          <button
            onClick={() => handleCopy(usageCode, "usage")}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {copied === "usage" ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="bg-bg-tertiary border border-border rounded-md p-3 font-mono text-xs overflow-x-auto">
          <pre className="text-text-secondary">
            <code>
              <span className="text-purple-400">import</span>{" "}
              <span className="text-text-primary">{"{ Tabbi }"}</span>{" "}
              <span className="text-purple-400">from</span>{" "}
              <span className="text-accent">&quot;@tabbi/sdk&quot;</span>;
              {"\n\n"}
              <span className="text-purple-400">const</span>{" "}
              <span className="text-text-primary">agent</span>{" "}
              <span className="text-text-muted">=</span>{" "}
              <span className="text-purple-400">new</span>{" "}
              <span className="text-yellow-400">Tabbi</span>
              <span className="text-text-muted">({"{"}</span>
              {"\n  "}
              <span className="text-text-primary">apiKey</span>
              <span className="text-text-muted">:</span>{" "}
              <span className="text-accent">&quot;tb_live_...&quot;</span>
              {"\n"}
              <span className="text-text-muted">{"})"}</span>;
              {"\n\n"}
              <span className="text-purple-400">const</span>{" "}
              <span className="text-text-primary">session</span>{" "}
              <span className="text-text-muted">=</span>{" "}
              <span className="text-purple-400">await</span>{" "}
              <span className="text-text-primary">agent</span>
              <span className="text-text-muted">.</span>
              <span className="text-yellow-400">createSession</span>
              <span className="text-text-muted">();</span>
              {"\n"}
              <span className="text-purple-400">await</span>{" "}
              <span className="text-text-primary">session</span>
              <span className="text-text-muted">.</span>
              <span className="text-yellow-400">waitForReady</span>
              <span className="text-text-muted">();</span>
              {"\n\n"}
              <span className="text-purple-400">await</span>{" "}
              <span className="text-text-primary">session</span>
              <span className="text-text-muted">.</span>
              <span className="text-yellow-400">sendMessage</span>
              <span className="text-text-muted">(</span>
              <span className="text-accent">&quot;Build a REST API&quot;</span>
              <span className="text-text-muted">);</span>
            </code>
          </pre>
        </div>
      </div>

      {/* Docs link */}
      <div className="mt-4 pt-4 border-t border-border">
        <a
          href="#"
          className="text-sm text-accent hover:underline inline-flex items-center gap-1.5"
        >
          Read the documentation
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </motion.div>
  );
}
