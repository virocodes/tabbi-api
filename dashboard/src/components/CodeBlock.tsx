"use client";

import { Highlight, themes } from "prism-react-renderer";

interface CodeBlockProps {
  children: string;
  language?: string;
}

export function CodeBlock({ children, language = "typescript" }: CodeBlockProps) {
  const code = children.trim();

  return (
    <Highlight theme={themes.nightOwl} code={code} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          style={{
            ...style,
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            overflow: "auto",
            fontSize: "var(--font-size-sm)",
            lineHeight: 1.6,
            margin: "0 0 var(--space-4) 0",
          }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
