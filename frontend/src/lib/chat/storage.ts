import type { Bookmark, ChatMessage, ChatSession } from "./types";

export type ChatState = {
  sessions: ChatSession[];
  bookmarks: Bookmark[];
  activeId: string | null;
};

export const STORAGE_KEY = "alimonyplus.chat.v1";
const MAX_SESSIONS = 50;

function emptyState(): ChatState {
  return { sessions: [], bookmarks: [], activeId: null };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toMessage(value: unknown): ChatMessage | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== "string" ||
    (value.role !== "user" && value.role !== "assistant") ||
    typeof value.content !== "string"
  )
    return null;
  const citations = Array.isArray(value.citations)
    ? value.citations.filter(
        (c): c is ChatMessage["citations"][number] =>
          isObject(c) && typeof c.id === "string" && typeof c.title === "string",
      )
    : [];
  return {
    id: value.id,
    role: value.role,
    content: value.content,
    citations,
    // a reload in the middle of a stream leaves partial text: treat as finished
    status: value.status === "error" ? "error" : "done",
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
  };
}

function toSession(value: unknown): ChatSession | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.title !== "string")
    return null;
  const now = new Date().toISOString();
  return {
    id: value.id,
    title: value.title,
    messages: (Array.isArray(value.messages) ? value.messages : [])
      .map(toMessage)
      .filter((m): m is ChatMessage => m !== null),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function toBookmark(value: unknown): Bookmark | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.messageId !== "string"
  )
    return null;
  return {
    id: value.id,
    sessionId: value.sessionId,
    messageId: value.messageId,
    note: typeof value.note === "string" ? value.note : undefined,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
  };
}

/** Safely turn stored text into chat state. Bad or old data never throws. */
export function parseChatState(raw: string | null): ChatState {
  if (!raw) return emptyState();
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObject(data)) return emptyState();
    const sessions = (Array.isArray(data.sessions) ? data.sessions : [])
      .map(toSession)
      .filter((s): s is ChatSession => s !== null)
      .slice(0, MAX_SESSIONS);
    const ids = new Set(sessions.map((s) => s.id));
    const bookmarks = (Array.isArray(data.bookmarks) ? data.bookmarks : [])
      .map(toBookmark)
      .filter((b): b is Bookmark => b !== null && ids.has(b.sessionId));
    const activeId =
      typeof data.activeId === "string" && ids.has(data.activeId)
        ? data.activeId
        : null;
    return { sessions, bookmarks, activeId };
  } catch {
    return emptyState();
  }
}

export function loadChatState(): ChatState {
  if (typeof window === "undefined") return emptyState();
  try {
    return parseChatState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
}

export function saveChatState(state: ChatState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        sessions: state.sessions.slice(0, MAX_SESSIONS),
      }),
    );
  } catch {
    // storage full or blocked (private mode): the chat still works, just not saved
  }
}