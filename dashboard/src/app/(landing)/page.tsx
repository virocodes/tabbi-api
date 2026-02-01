"use client";

import { FloatingCatChars } from "@/components/FloatingCatChars";
import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-logo">
            <span className="landing-logo-cat">&gt;⩊&lt;</span>
            <span className="landing-logo-text">tabbi</span>
          </Link>
          <div className="landing-nav-links">
            <Link href="/docs/sdk" className="landing-nav-link">
              Docs
            </Link>
            <Link href="/dashboard" className="landing-nav-link">
              Dashboard
            </Link>
            <a
              href="https://github.com/virocodes/tabbi-api"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-nav-link"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <FloatingCatChars catPosition={{ x: 0.28, y: 0.28 }} catScale={0.55} />
        </div>
        <div className="landing-hero-content">
          <div className="landing-hero-grid">
            {/* Left Column - Messaging */}
            <div className="landing-hero-left">
              <h1 className="landing-headline">
                The API for AI
                <br />
                Coding Agents
              </h1>
              <p className="landing-subheadline">
                You added ChatGPT to your app in an afternoon.
                <br />
                Now do the same with coding agents.
              </p>
              <div className="landing-cta-group">
                <Link href="/auth" className="landing-cta-primary">
                  Get Started
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 12L10 8L6 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <Link href="/docs/sdk" className="landing-cta-secondary">
                  View Docs
                </Link>
              </div>
            </div>

            {/* Right Column - Code */}
            <div className="landing-hero-right">
              <div className="landing-code-window">
                <div className="landing-code-header">
                  <div className="landing-code-dots">
                    <span className="landing-code-dot landing-code-dot-red" />
                    <span className="landing-code-dot landing-code-dot-yellow" />
                    <span className="landing-code-dot landing-code-dot-green" />
                  </div>
                  <span className="landing-code-title">terminal</span>
                </div>
                <div className="landing-code-install">
                  <span className="landing-code-prompt">$</span>
                  <span className="landing-code-cmd">npm install</span>
                  <span className="landing-code-pkg">tabbi-sdk</span>
                </div>
                <div className="landing-code-body">
                  <CodeBlock language="typescript">
                    {`import { Tabbi } from "tabbi-sdk";

const tabbi = new Tabbi({ apiKey: "tb_live_..." });

// Create a sandboxed coding environment
const session = await tabbi.createSession();

// Send a task to the AI agent
await session.sendMessage(
  "Build me a REST API with Express"
);

// Get the files it created
const files = await session.listFiles("/");`}
                  </CodeBlock>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Section */}
      <section className="landing-comparison">
        <div className="landing-comparison-inner">
          <div className="landing-comparison-header">
            <h2 className="landing-section-title">Ship faster, not harder</h2>
            <p className="landing-section-subtitle">
              Focus on your product, not infrastructure
            </p>
          </div>
          <div className="landing-comparison-cards">
            {/* Without Tabbi */}
            <div className="landing-comparison-card landing-comparison-before">
              <div className="landing-comparison-card-header">
                <span className="landing-comparison-label landing-comparison-label-before">
                  Without Tabbi
                </span>
              </div>
              <ul className="landing-comparison-list">
                <li className="landing-comparison-item">
                  <CrossIcon />
                  <span>Provision and manage VMs</span>
                </li>
                <li className="landing-comparison-item">
                  <CrossIcon />
                  <span>Build sandbox orchestration</span>
                </li>
                <li className="landing-comparison-item">
                  <CrossIcon />
                  <span>Handle terminal I/O streaming</span>
                </li>
                <li className="landing-comparison-item">
                  <CrossIcon />
                  <span>Implement file system access</span>
                </li>
                <li className="landing-comparison-item">
                  <CrossIcon />
                  <span>Manage security & isolation</span>
                </li>
              </ul>
            </div>

            {/* Arrow */}
            <div className="landing-comparison-arrow">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* With Tabbi */}
            <div className="landing-comparison-card landing-comparison-after">
              <div className="landing-comparison-card-header">
                <span className="landing-comparison-label landing-comparison-label-after">
                  With Tabbi
                </span>
              </div>
              <ul className="landing-comparison-list">
                <li className="landing-comparison-item">
                  <CheckIcon />
                  <span>One API call to start</span>
                </li>
                <li className="landing-comparison-item">
                  <CheckIcon />
                  <span>Zero infrastructure to manage</span>
                </li>
                <li className="landing-comparison-item">
                  <CheckIcon />
                  <span>Ship your product today</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-steps">
        <div className="landing-steps-inner">
          <div className="landing-steps-header">
            <h2 className="landing-section-title">How it works</h2>
            <p className="landing-section-subtitle">
              Three steps to AI-powered coding in your app
            </p>
          </div>
          <div className="landing-steps-grid">
            <div className="landing-step">
              <div className="landing-step-number">1</div>
              <h3 className="landing-step-title">Create a session</h3>
              <p className="landing-step-description">
                Spin up an isolated sandbox environment with a single API call.
                Each session includes a full development environment.
              </p>
            </div>
            <div className="landing-step">
              <div className="landing-step-number">2</div>
              <h3 className="landing-step-title">Send prompts</h3>
              <p className="landing-step-description">
                Stream messages to the AI agent. It writes code, runs commands,
                and iterates until the task is complete.
              </p>
            </div>
            <div className="landing-step">
              <div className="landing-step-number">3</div>
              <h3 className="landing-step-title">Get results</h3>
              <p className="landing-step-description">
                Access generated files, diffs, and execution output. Download
                the code or integrate it directly into your workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-cat">&gt;⩊&lt;</span>
            <span className="landing-logo-text">tabbi</span>
          </div>
          <div className="landing-footer-links">
            <Link href="/docs/sdk" className="landing-footer-link">
              Docs
            </Link>
            <a
              href="https://github.com/virocodes/tabbi-api"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
            >
              GitHub
            </a>
            <Link href="/dashboard" className="landing-footer-link">
              Dashboard
            </Link>
          </div>
          <div className="landing-footer-copyright">© 2025 Tabbi</div>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="landing-icon-check"
    >
      <path
        d="M16.6667 5L7.50001 14.1667L3.33334 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="landing-icon-cross"
    >
      <path
        d="M15 5L5 15M5 5L15 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
