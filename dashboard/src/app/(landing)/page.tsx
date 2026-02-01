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
                  View Documentation
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

      {/* Features Section */}
      <section className="landing-features">
        <div className="landing-features-inner">
          <div className="landing-features-header">
            <h2 className="landing-section-title">
              Everything you need to ship
            </h2>
            <p className="landing-section-subtitle">
              Production-ready infrastructure that scales with your application
            </p>
          </div>
          <div className="landing-features-grid">
            <div className="landing-feature">
              <div className="landing-feature-icon">
                <div className="landing-feature-icon-bg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="14"
                      y="5"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="3"
                      y="16"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="14"
                      y="16"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="landing-feature-title">Isolated Sandboxes</h3>
              <p className="landing-feature-description">
                Every session runs in its own secure, containerized environment
                with full filesystem access and terminal capabilities.
              </p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">
                <div className="landing-feature-icon-bg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 12h3m6 0h3m6 0h3M6 6v12M12 6v12M18 6v12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="6"
                      cy="12"
                      r="2"
                      fill="currentColor"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2"
                      fill="currentColor"
                    />
                    <circle
                      cx="18"
                      cy="12"
                      r="2"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="landing-feature-title">Real-time Streaming</h3>
              <p className="landing-feature-description">
                Server-sent events deliver AI responses, code changes, and
                command output as they happen—no polling required.
              </p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">
                <div className="landing-feature-icon-bg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="landing-feature-title">AI-Powered Coding</h3>
              <p className="landing-feature-description">
                Advanced AI with reasoning, code generation, and multi-step
                task execution built directly into the platform.
              </p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">
                <div className="landing-feature-icon-bg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 3v2m0 14v2M5.636 5.636l1.414 1.414m9.9 9.9l1.414 1.414M3 12h2m14 0h2M5.636 18.364l1.414-1.414m9.9-9.9l1.414-1.414"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="landing-feature-title">Git Integration</h3>
              <p className="landing-feature-description">
                Native git support in every sandbox. Clone repos, commit
                changes, and manage version control programmatically.
              </p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">
                <div className="landing-feature-icon-bg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 2v7h7M9 13h6M9 17h6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="landing-feature-title">Complete File Access</h3>
              <p className="landing-feature-description">
                Read, write, and download any file generated by the AI. Full
                control over the sandbox filesystem via REST API.
              </p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-icon">
                <div className="landing-feature-icon-bg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="2"
                      y="6"
                      width="20"
                      height="12"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 10l2 2-2 2M12 14h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="landing-feature-title">Developer-First SDK</h3>
              <p className="landing-feature-description">
                TypeScript SDK with full type safety, intelligent retries, and
                comprehensive error handling out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Section */}
      <section className="landing-comparison">
        <div className="landing-comparison-inner">
          <div className="landing-comparison-header">
            <h2 className="landing-section-title">
              Stop building infrastructure. Start shipping features.
            </h2>
            <p className="landing-section-subtitle">
              We handle the complex infrastructure so you can focus on what
              matters—your product.
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

      {/* CTA Section */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <div className="landing-cta-content">
            <h2 className="landing-cta-title">Ready to integrate AI agents?</h2>
            <p className="landing-cta-subtitle">
              Get started in minutes with our comprehensive SDK and
              documentation. No credit card required.
            </p>
            <div className="landing-cta-buttons">
              <Link href="/auth" className="landing-cta-primary">
                Start Building
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
              <a
                href="https://github.com/virocodes/tabbi-api"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-cta-secondary"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-top">
            <div className="landing-footer-brand-section">
              <div className="landing-footer-brand">
                <span className="landing-logo-cat">&gt;⩊&lt;</span>
                <span className="landing-logo-text">tabbi</span>
              </div>
              <p className="landing-footer-tagline">
                Production-ready infrastructure for AI coding agents.
              </p>
            </div>
            <div className="landing-footer-sections">
              <div className="landing-footer-section">
                <h4 className="landing-footer-section-title">Product</h4>
                <Link href="/docs/sdk" className="landing-footer-link">
                  Documentation
                </Link>
                <Link href="/dashboard" className="landing-footer-link">
                  Dashboard
                </Link>
                <Link href="/docs/sdk" className="landing-footer-link">
                  API Reference
                </Link>
              </div>
              <div className="landing-footer-section">
                <h4 className="landing-footer-section-title">Resources</h4>
                <a
                  href="https://github.com/virocodes/tabbi-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-footer-link"
                >
                  GitHub
                </a>
                <Link href="/docs" className="landing-footer-link">
                  Guides
                </Link>
                <Link href="/docs/sdk" className="landing-footer-link">
                  SDK
                </Link>
              </div>
              <div className="landing-footer-section">
                <h4 className="landing-footer-section-title">Company</h4>
                <a
                  href="https://github.com/virocodes/tabbi-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-footer-link"
                >
                  About
                </a>
                <a
                  href="https://github.com/virocodes/tabbi-api/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-footer-link"
                >
                  Support
                </a>
              </div>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <div className="landing-footer-copyright">
              © 2025 Tabbi. All rights reserved.
            </div>
            <div className="landing-footer-legal">
              <span className="landing-footer-link">Privacy Policy</span>
              <span className="landing-footer-link">Terms of Service</span>
            </div>
          </div>
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
