"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import {
  Bookmark as BookmarkIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { plainText } from "@/lib/chat/transcript";
import type { Bookmark, ChatSession } from "@/lib/chat/types";

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function snippet(text: string): string {
  const clean = text
    .replace(/```\w*/g, "")
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
}

export function HistoryPanel({
  sessions,
  activeId,
  bookmarks,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onOpenBookmark,
  onRemoveBookmark,
  onClose,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  bookmarks: Bookmark[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onRemoveBookmark: (bookmark: Bookmark) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<"chats" | "saved">("chats");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipCommit = useRef(false);

  const saved = bookmarks
    .map((bookmark) => {
      const session = sessions.find((s) => s.id === bookmark.sessionId);
      const message = session?.messages.find(
        (m) => m.id === bookmark.messageId,
      );
      return session && message ? { bookmark, session, message } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  function startEdit(session: ChatSession) {
    skipCommit.current = false;
    setEditingId(session.id);
    setDraft(session.title);
  }

  function commitEdit() {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    if (editingId) onRename(editingId, draft);
    setEditingId(null);
  }

  function onEditKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      skipCommit.current = true;
      setEditingId(null);
    }
  }

  function confirmDelete(session: ChatSession) {
    if (window.confirm(`Delete "${session.title}"? This cannot be undone.`))
      onDelete(session.id);
  }

  return (
    <aside className="chat-history" aria-label="Chat history">
      <div className="chat-history-head">
        <button type="button" className="button chat-new" onClick={onNew}>
          <Plus size={15} />
          New chat
        </button>
        {onClose && (
          <button
            type="button"
            className="icon-button chat-history-close"
            aria-label="Close history"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="chat-history-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "chats"}
          className={tab === "chats" ? "active" : ""}
          onClick={() => setTab("chats")}
        >
          Chats
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "saved"}
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
        >
          Saved{saved.length ? ` (${saved.length})` : ""}
        </button>
      </div>

      {tab === "chats" ? (
        sessions.length ? (
          <ul className="chat-history-list">
            {sessions.map((s) => (
              <li
                key={s.id}
                className={`chat-history-item ${s.id === activeId ? "active" : ""}`}
              >
                {editingId === s.id ? (
                  <input
                    className="chat-history-edit"
                    value={draft}
                    maxLength={80}
                    autoFocus
                    aria-label="Chat name"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onEditKey}
                    onBlur={commitEdit}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="chat-history-open"
                      aria-current={s.id === activeId ? "true" : undefined}
                      onClick={() => onSelect(s.id)}
                    >
                      <span className="chat-history-title">{s.title}</span>
                      <span className="chat-history-date">
                        {shortDate(s.updatedAt)}
                      </span>
                    </button>
                    <div className="chat-history-tools">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Rename ${s.title}`}
                        onClick={() => startEdit(s)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Delete ${s.title}`}
                        onClick={() => confirmDelete(s)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="chat-history-empty muted small">
            No chats yet. Your conversations are saved on this device.
          </p>
        )
      ) : saved.length ? (
        <ul className="chat-history-list">
          {saved.map(({ bookmark, session, message }) => (
            <li key={bookmark.id} className="chat-history-item">
              <button
                type="button"
                className="chat-history-open"
                onClick={() => onOpenBookmark(bookmark)}
              >
                <span className="chat-history-title">{session.title}</span>
                <span className="chat-history-snippet">
                  {snippet(plainText(message))}
                </span>
              </button>
              <div className="chat-history-tools">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove from saved"
                  onClick={() => onRemoveBookmark(bookmark)}
                >
                  <BookmarkIcon size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="chat-history-empty muted small">
          Nothing saved yet. Use Save under an answer to keep it here.
        </p>
      )}
    </aside>
  );
}