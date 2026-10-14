"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Download, History, Send, Square } from "lucide-react";
import {
  downloadText,
  fileName,
  printTranscript,
  toMarkdown,
  toText,
} from "@/lib/chat/transcript";
import type { Bookmark, Citation } from "@/lib/chat/types";
import "./chat.css";
import { ChatMarkdown } from "./chat-markdown";
import { CitationPreview } from "./citation-preview";
import { HistoryPanel } from "./history-panel";
import { MessageActions } from "./message-actions";
import { Suggestions } from "./suggestions";
import { useChat } from "./use-chat";

export function ChatView() {
  const chat = useChat();
  const { active } = chat;
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<Citation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [notice, setNotice] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);
  const focusRef = useRef<string | null>(null);

  const messages = active?.messages ?? [];
  const lastId = messages[messages.length - 1]?.id;
  const showSuggestions = chat.hydrated && messages.length === 0;
  const canExport = messages.length > 0;

  // Smart auto-scroll: follow new text only while the reader is at the bottom.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    if (focusRef.current) {
      const target = document.getElementById(`msg-${focusRef.current}`);
      if (target) {
        target.scrollIntoView({ block: "center" });
        stickRef.current = false;
        focusRef.current = null;
        return;
      }
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [active]);

  // Mobile keyboard: size the chat to the visible area, not the full screen.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty("--chat-vh", `${vv.height}px`);
    apply();
    vv.addEventListener("resize", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      root.style.removeProperty("--chat-vh");
    };
  }, []);

  // Let the message box grow with the text, up to a limit.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Close the export menu on outside click or Escape.
  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (
        e instanceof MouseEvent &&
        e.target instanceof Element &&
        e.target.closest(".chat-export")
      )
        return;
      setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [exportOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function onScroll() {
    const el = logRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    setShowJump(!near);
  }

  function jumpToLatest() {
    const el = logRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  function submit() {
    const value = input.trim();
    if (!value || chat.busy) return;
    stickRef.current = true;
    setInput("");
    void chat.send(value);
  }

  function pickPrompt(prompt: string) {
    stickRef.current = true;
    void chat.send(prompt);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function exportAs(kind: "md" | "txt" | "pdf") {
    setExportOpen(false);
    if (!active) return;
    if (kind === "md")
      downloadText(
        fileName(active, "md"),
        toMarkdown(active),
        "text/markdown",
      );
    else if (kind === "txt")
      downloadText(fileName(active, "txt"), toText(active));
    else if (!printTranscript(active))
      setNotice(
        "Your browser blocked the print window. Allow pop-ups and try again.",
      );
  }

  function openBookmark(bookmark: Bookmark) {
    setHistoryOpen(false);
    if (bookmark.sessionId === chat.activeId) {
      document
        .getElementById(`msg-${bookmark.messageId}`)
        ?.scrollIntoView({ block: "center" });
      stickRef.current = false;
      return;
    }
    focusRef.current = bookmark.messageId;
    chat.selectSession(bookmark.sessionId);
  }

  return (
    <section className="chat-shell" aria-label="AI legal assistant">
      <div className={`chat-layout ${historyOpen ? "history-open" : ""}`}>
        <HistoryPanel
          sessions={chat.sessions}
          activeId={chat.activeId}
          bookmarks={chat.bookmarks}
          onSelect={(id) => {
            stickRef.current = true;
            chat.selectSession(id);
            setHistoryOpen(false);
          }}
          onNew={() => {
            stickRef.current = true;
            chat.newChat();
            setHistoryOpen(false);
          }}
          onRename={chat.renameSession}
          onDelete={chat.deleteSession}
          onOpenBookmark={openBookmark}
          onRemoveBookmark={(b) =>
            chat.toggleBookmark(b.sessionId, b.messageId)
          }
          onClose={() => setHistoryOpen(false)}
        />

        <div className="chat-main">
          <header className="chat-head">
            <button
              type="button"
              className="button chat-history-toggle"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <History size={15} />
              History
            </button>
            <h1 className="chat-title">{active?.title ?? "New chat"}</h1>
            <div className="chat-export">
              <button
                type="button"
                className="button"
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                disabled={!canExport}
                onClick={() => setExportOpen((open) => !open)}
              >
                <Download size={15} />
                Export
              </button>
              {exportOpen && (
                <div className="chat-export-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => exportAs("md")}
                  >
                    Markdown (.md)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => exportAs("txt")}
                  >
                    Plain text (.txt)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => exportAs("pdf")}
                  >
                    PDF (print view)
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="chat-log-wrap">
            <div
              className="chat-log"
              ref={logRef}
              onScroll={onScroll}
              role="log"
              aria-live="polite"
              aria-busy={chat.busy}
            >
              {showSuggestions && (
                <Suggestions onPick={pickPrompt} disabled={chat.busy} />
              )}
              {messages.map((m) => (
                <article
                  key={m.id}
                  id={`msg-${m.id}`}
                  className={`chat-msg chat-msg-${m.role}`}
                >
                  <span className="overline">
                    {m.role === "user" ? "YOU" : "ASSISTANT"}
                  </span>
                  {m.role === "assistant" ? (
                    <ChatMarkdown
                      content={m.content}
                      citations={m.citations}
                      onCite={setPreview}
                    />
                  ) : (
                    <div className="chat-text">{m.content}</div>
                  )}
                  {m.status === "streaming" && (
                    <span
                      className="chat-typing"
                      role="status"
                      aria-label="Assistant is typing"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {m.status === "error" && (
                    <p className="chat-error" role="alert">
                      Something went wrong. Please try again.
                      {m.id === lastId && (
                        <button
                          type="button"
                          className="chat-action"
                          onClick={chat.regenerate}
                        >
                          Retry
                        </button>
                      )}
                    </p>
                  )}
                  <MessageActions
                    message={m}
                    bookmarked={chat.bookmarkedIds.has(m.id)}
                    isLast={
                      m.id === lastId &&
                      !m.content.startsWith("**Case summary**")
                    }
                    disabled={chat.busy}
                    onBookmark={() =>
                      active && chat.toggleBookmark(active.id, m.id)
                    }
                    onSummary={chat.addSummary}
                    onRegenerate={chat.regenerate}
                  />
                </article>
              ))}
            </div>
            {showJump && (
              <button
                type="button"
                className="button chat-jump"
                onClick={jumpToLatest}
              >
                <ChevronDown size={15} />
                Jump to latest
              </button>
            )}
          </div>

          {notice && (
            <p className="chat-notice small" role="status">
              {notice}
            </p>
          )}
          <p className="chat-disclaimer small muted">
            AI-generated information, not legal advice.
          </p>
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() =>
                setTimeout(
                  () => taRef.current?.scrollIntoView({ block: "nearest" }),
                  300,
                )
              }
              rows={1}
              maxLength={4000}
              placeholder="Ask your question…"              aria-label="Your question"
            />
            {chat.busy ? (
              <button type="button" className="button" onClick={chat.stop}>
                <Square size={15} />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                className="button"
                disabled={!input.trim()}
              >
                <Send size={15} />
                Send
              </button>
            )}
          </form>
        </div>
      </div>

      <CitationPreview citation={preview} onClose={() => setPreview(null)} />
    </section>
  );
}