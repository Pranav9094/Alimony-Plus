"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { parseSse } from "@/lib/chat/sse";
import type { Citation, MessageStatus } from "@/lib/chat/types";
import "./chat.css";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  status: MessageStatus;
};

export function ChatView() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const assistantId = crypto.randomUUID();
    setMessages((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        citations: [],
        status: "done",
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        citations: [],
        status: "streaming",
      },
    ]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((list) =>
        list.map((m) => (m.id === assistantId ? fn(m) : m)),
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const ev of parsed.events) {
          if (ev.type === "token")
            patch((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === "citation")
            patch((m) => ({
              ...m,
              citations: [...m.citations, ev.citation],
            }));
          else if (ev.type === "error") throw new Error(ev.message);
        }
      }
      patch((m) => ({ ...m, status: "done" }));
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      patch((m) => ({ ...m, status: aborted ? "done" : "error" }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <section className="chat-shell" aria-label="AI legal assistant">
      <div className="chat-log" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="muted">
            Ask a question about maintenance or alimony in India.
          </p>
        )}
        {messages.map((m) => (
          <article key={m.id} className={`chat-msg chat-msg-${m.role}`}>
            <span className="overline">
              {m.role === "user" ? "YOU" : "ASSISTANT"}
            </span>
            <div className="chat-text">{m.content}</div>
            {m.status === "streaming" && (
              <span className="muted small">Typing…</span>
            )}
            {m.status === "error" && (
              <span className="text-amber small">
                Something went wrong. Please try again.
              </span>
            )}
          </article>
        ))}
      </div>
      <p className="chat-disclaimer small muted">
        AI-generated information, not legal advice.
      </p>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={4000}
          placeholder="Ask about maintenance, Sec 125, documents…"
          aria-label="Your question"
        />
        {busy ? (
          <button
            type="button"
            className="button"
            onClick={() => abortRef.current?.abort()}
          >
            <Square size={15} />
            Stop
          </button>
        ) : (
          <button type="submit" className="button" disabled={!input.trim()}>
            <Send size={15} />
            Send
          </button>
        )}
      </form>
    </section>
  );
}