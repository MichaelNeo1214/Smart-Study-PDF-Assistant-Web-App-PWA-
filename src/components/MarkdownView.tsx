import { useMemo } from "react";
import { renderSafeMarkdown } from "../services/parser";

interface MarkdownViewProps {
  markdown: string;
  className?: string;
}

/**
 * Renders model output through marked + DOMPurify. Every AI string in the app
 * goes through this component; raw HTML is never injected unsanitised.
 */
export function MarkdownView({ markdown, className = "" }: MarkdownViewProps) {
  const html = useMemo(() => renderSafeMarkdown(markdown), [markdown]);

  return (
    <div
      className={`markdown-body ${className}`.trim()}
      aria-label="Rendered Markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
