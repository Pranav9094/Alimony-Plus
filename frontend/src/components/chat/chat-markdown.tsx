"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { CITE_MARKER, type Citation } from "@/lib/chat/types";

/** Turns [[cite:id]] markers into #cite-id links the renderer styles as chips. */
function prepare(content: string, citations: Citation[]) {
  return content
    .replace(/\[\[[^\]]*\]?$/, "") // hide a half-streamed marker
    .replace(CITE_MARKER, (_match, id: string) => {
      const found = citations.find((c) => c.id === id);
      return `[${found ? found.title : "Source"}](#cite-${id})`;
    });
}

export function ChatMarkdown({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a({ href, children }) {
            if (href?.startsWith("#cite-"))
              return (
                <span className="cite-chip" data-cite={href.slice(6)}>
                  {children}
                </span>
              );
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
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