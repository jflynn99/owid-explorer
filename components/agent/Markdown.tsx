"use client";

// Shared markdown renderer for chat answers (components/chat/ChatTranscript).
// Both system prompts tell the model to cite as [title](url) markdown links, so
// assistant text must render as markdown — but from an LLM, safely.
//
// Safety model: rehype-sanitize with a tight allowlist derived from the default
// schema (which already blocks javascript:/data: hrefs). No raw HTML, no images,
// no headings — just prose, links, emphasis, lists and code. External links are
// forced to target="_blank" rel="noopener noreferrer" via component overrides
// (the schema can't inject rel safely).

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const schema = {
  ...defaultSchema,
  tagNames: ["p", "a", "strong", "em", "ul", "ol", "li", "code", "br"],
  attributes: {
    a: ["href", "title"],
  },
  // Keep the default protocol allowlist (blocks javascript:, data:, etc.).
  protocols: defaultSchema.protocols,
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-gray-800 dark:text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => (
            <code className="rounded-sm bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-slate-800">
              {children}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
