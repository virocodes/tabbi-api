"use client";

import { useState } from "react";

export function QuickStart() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const installCode = `npm install tabbi-sdk`;

  const usageCode = `import { Tabbi } from "tabbi-sdk";

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
    <div className="quickstart card">
      <h3 className="quickstart-title">Quick Start</h3>

      {/* Install command */}
      <div className="quickstart-section">
        <div className="quickstart-header">
          <span className="quickstart-label">Install</span>
          <button
            onClick={() => handleCopy(installCode, "install")}
            className="quickstart-copy"
          >
            {copied === "install" ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="code-block">
          <span className="code-prompt">$</span>{" "}
          <span className="code-command">npm</span>{" "}
          <span className="code-text">install tabbi-sdk</span>
        </div>
      </div>

      {/* Usage example */}
      <div className="quickstart-section">
        <div className="quickstart-header">
          <span className="quickstart-label">Usage</span>
          <button
            onClick={() => handleCopy(usageCode, "usage")}
            className="quickstart-copy"
          >
            {copied === "usage" ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="code-block code-block-sm">
          <pre className="code-pre">
            <code>
              <span className="code-keyword">import</span>{" "}
              <span className="code-text">{`{ Tabbi }`}</span>{" "}
              <span className="code-keyword">from</span>{" "}
              <span className="code-string">&quot;tabbi-sdk&quot;</span>;
              {"\n"}
              <span className="code-keyword">const</span>{" "}
              <span className="code-text">agent</span>{" "}
              <span className="code-muted">=</span>{" "}
              <span className="code-keyword">new</span>{" "}
              <span className="code-fn">Tabbi</span>
              <span className="code-muted">({`{`}</span>
              {"\n  "}
              <span className="code-text">apiKey</span>
              <span className="code-muted">:</span>{" "}
              <span className="code-string">&quot;tb_live_...&quot;</span>
              {"\n"}
              <span className="code-muted">{`})`}</span>;
              {"\n"}
              <span className="code-keyword">const</span>{" "}
              <span className="code-text">session</span>{" "}
              <span className="code-muted">=</span>{" "}
              <span className="code-keyword">await</span>{" "}
              <span className="code-text">agent</span>
              <span className="code-muted">.</span>
              <span className="code-fn">createSession</span>
              <span className="code-muted">();</span>
              {"\n"}
              <span className="code-keyword">await</span>{" "}
              <span className="code-text">session</span>
              <span className="code-muted">.</span>
              <span className="code-fn">waitForReady</span>
              <span className="code-muted">();</span>
              {"\n"}
              <span className="code-keyword">await</span>{" "}
              <span className="code-text">session</span>
              <span className="code-muted">.</span>
              <span className="code-fn">sendMessage</span>
              <span className="code-muted">(</span>
              <span className="code-string">&quot;Build a REST API&quot;</span>
              <span className="code-muted">);</span>
            </code>
          </pre>
        </div>
      </div>

      {/* Docs link */}
      <div className="quickstart-footer">
        <a href="#" className="quickstart-link">
          Read the documentation
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
