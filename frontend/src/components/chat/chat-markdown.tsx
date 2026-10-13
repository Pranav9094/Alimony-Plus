"use client";
import {
  isValidElement,
  memo,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Check, Copy } from "lucide-react";
import { CITE_MARKER, type Citation } from "@/lib/chat/types";

/** Turns [[cite:id]] markers into #cite-id links that are drawn as chips. */
function prepare(content: string, citations: Citation[]) {
  return content
    .replace(/\[\[[^\]]*\]?$/, "") // hide a half-streamed marker
    .replace(CITE_MARKER, (_match, id: string) => {
      const found = citations.find((c) => c.id === id);
      return `[${found ? found.title : "Source"}](#cite-${id})`;
    });
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node))
    return nodeText((node.props as { children?: ReactNode }).children);
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(nodeText(children).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked by the browser
    }
  }

  return (
    <div className="chat-code">
      <button type="button" className="chat-code-copy" onClick={copy}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

function ChatMarkdownBase({
  content,
  citations,
  onCite,
}: {
  content: string;
  citations: Citation[];
  onCite?: (citation: Citation) => void;
}) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a({ href, children }) {
            if (href?.startsWith("#cite-")) {
              const id = href.slice(6);
              const found = citations.find((c) => c.id === id);
              return (
                <button
                  type="button"
                  className="cite-chip"
                  disabled={!found}
                  onClick={() => found && onCite?.(found)}
                >
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          pre({ children }) {
            return <CodeBlock>{children}</CodeBlock>;
          },
          table({ children }) {
            return (
              <div className="chat-table-wrap">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {prepare(content, citations)}
      </ReactMarkdown>
    </div>
  );
}

export const ChatMarkdown = memo(ChatMarkdownBase);