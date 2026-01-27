"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/docs/sdk", label: "SDK Reference", icon: "package", external: false },
  { href: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/docs` : "https://api.tabbi.sh/docs", label: "API Reference", icon: "server", external: true },
];

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "package":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "server":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      );
    default:
      return null;
  }
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="docs-layout">
      {/* Sidebar */}
      <aside className="docs-sidebar">
        <div className="docs-sidebar-header">
          <Link href="/dashboard" className="docs-logo">
            <span className="logo-emoticon">{">⩊<"}</span>
            <span>tabbi</span>
          </Link>
        </div>

        <nav className="docs-nav">
          <div className="docs-nav-section">
            <h3 className="docs-nav-title">Documentation</h3>
            {navItems.map((item) => (
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="docs-nav-item"
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`docs-nav-item ${pathname === item.href ? "active" : ""}`}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              )
            ))}
          </div>

          <div className="docs-nav-section">
            <h3 className="docs-nav-title">Resources</h3>
            <a
              href="https://github.com/anthropics/tabbi"
              target="_blank"
              rel="noopener noreferrer"
              className="docs-nav-item"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
            <Link href="/dashboard" className="docs-nav-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              Dashboard
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="docs-content">
        {children}
      </main>

      <style jsx global>{`
        .docs-layout {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .docs-sidebar {
          width: 260px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-primary);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .docs-sidebar-header {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--border-primary);
        }

        .docs-logo {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: 600;
          font-size: var(--font-size-lg);
          color: var(--text-primary);
          text-decoration: none;
        }

        .docs-logo:hover {
          color: var(--accent);
        }

        .logo-emoticon {
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
        }

        .docs-nav {
          padding: var(--space-4);
          flex: 1;
        }

        .docs-nav-section {
          margin-bottom: var(--space-6);
        }

        .docs-nav-title {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-2);
          padding: 0 var(--space-3);
        }

        .docs-nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: var(--font-size-sm);
          transition: all 0.15s ease;
        }

        .docs-nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .docs-nav-item.active {
          background: var(--accent-muted);
          color: var(--accent);
        }

        .docs-content {
          flex: 1;
          margin-left: 260px;
          padding: var(--space-8);
          max-width: 900px;
        }

        /* Docs content styling */
        .docs-content h1 {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }

        .docs-content h2 {
          font-size: var(--font-size-xl);
          font-weight: 600;
          color: var(--text-primary);
          margin-top: var(--space-8);
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border-primary);
        }

        .docs-content h3 {
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: var(--text-primary);
          margin-top: var(--space-6);
          margin-bottom: var(--space-3);
        }

        .docs-content h4 {
          font-size: var(--font-size-base);
          font-weight: 600;
          color: var(--text-primary);
          margin-top: var(--space-4);
          margin-bottom: var(--space-2);
        }

        .docs-content p {
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: var(--space-4);
        }

        .docs-content ul, .docs-content ol {
          color: var(--text-secondary);
          padding-left: var(--space-6);
          margin-bottom: var(--space-4);
        }

        .docs-content li {
          margin-bottom: var(--space-2);
          line-height: 1.6;
        }

        .docs-content code {
          font-family: var(--font-mono);
          font-size: 0.9em;
          background: var(--bg-tertiary);
          padding: 0.15em 0.4em;
          border-radius: var(--radius-sm);
          color: var(--accent);
        }

        .docs-content pre {
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          overflow-x: auto;
          margin-bottom: var(--space-4);
        }

        .docs-content pre code {
          background: none;
          padding: 0;
          font-size: var(--font-size-sm);
          color: var(--text-primary);
        }

        .docs-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: var(--space-4);
          font-size: var(--font-size-sm);
        }

        .docs-content th {
          text-align: left;
          padding: var(--space-3);
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          font-weight: 600;
          color: var(--text-primary);
        }

        .docs-content td {
          padding: var(--space-3);
          border: 1px solid var(--border-primary);
          color: var(--text-secondary);
        }

        .docs-content blockquote {
          border-left: 3px solid var(--accent);
          padding-left: var(--space-4);
          margin: var(--space-4) 0;
          color: var(--text-secondary);
          font-style: italic;
        }

        .docs-content a {
          color: var(--accent);
          text-decoration: none;
        }

        .docs-content a:hover {
          text-decoration: underline;
        }

        .docs-content hr {
          border: none;
          border-top: 1px solid var(--border-primary);
          margin: var(--space-8) 0;
        }

        .docs-subtitle {
          font-size: var(--font-size-lg);
          color: var(--text-tertiary);
          margin-bottom: var(--space-6);
        }

        @media (max-width: 768px) {
          .docs-sidebar {
            display: none;
          }
          .docs-content {
            margin-left: 0;
            padding: var(--space-4);
          }
        }
      `}</style>
    </div>
  );
}
