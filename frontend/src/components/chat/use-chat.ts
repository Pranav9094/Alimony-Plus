"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { streamChat } from "@/lib/chat/client";
import { loadChatState, saveChatState } from "@/lib/chat/storage";
import { buildCaseSummary, uniqueCitations } from "@/lib/chat/transcript";
import type {
  Bookmark,
  ChatMessage,
  ChatSession,
  MessageStatus,
} from "@/lib/chat/types";

const uid = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();

function makeMessage(
  role: ChatMessage["role"],
  content: string,
  status: MessageStatus,
): ChatMessage {
  return {
    id: uid(),
    role,
    content,
    citations: [],
    status,
    createdAt: stamp(),
  };
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 48 ? `${clean.slice(0, 45)}...` : clean;
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load saved chats once, after the first render (keeps server and browser output equal).
  useEffect(() => {
    const saved = loadChatState();
    setSessions(saved.sessions);
    setBookmarks(saved.bookmarks);
    setActiveId(saved.activeId);
    setHydrated(true);
  }, []);

  // Save shortly after any change, but never before the first load finished.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(
      () => saveChatState({ sessions, bookmarks, activeId }),
      400,
    );
    return () => clearTimeout(timer);
  }, [sessions, bookmarks, activeId, hydrated]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((b) => b.messageId)),
    [bookmarks],
  );

  const patchSession = useCallback(
    (id: string, fn: (s: ChatSession) => ChatSession) =>
      setSessions((list) => list.map((s) => (s.id === id ? fn(s) : s))),
    [],
  );

  const runStream = useCallback(
    async (sessionId: string, assistantId: string, text: string) => {
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        patchSession(sessionId, (s) => ({
          ...s,
          messages: s.messages.map((m) => (m.id === assistantId ? fn(m) : m)),
        }));
      try {
        for await (const ev of streamChat(text, controller.signal)) {
          if (ev.type === "token")
            patch((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === "citation")
            patch((m) => ({
              ...m,
              citations: [...m.citations, ev.citation],
            }));
          else if (ev.type === "error") throw new Error(ev.message);
        }
        patch((m) => ({ ...m, status: "done" }));
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        patch((m) => ({ ...m, status: aborted ? "done" : "error" }));
      } finally {
        patchSession(sessionId, (s) => ({ ...s, updatedAt: stamp() }));
        setBusy(false);
        abortRef.current = null;
      }
    },
    [patchSession],
  );

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!text || busy) return false;
      const userMsg = makeMessage("user", text, "done");
      const assistantMsg = makeMessage("assistant", "", "streaming");
      const existing =
        activeId && sessions.some((s) => s.id === activeId) ? activeId : null;
      const sessionId = existing ?? uid();
      if (existing) {
        patchSession(sessionId, (s) => ({
          ...s,
          messages: [...s.messages, userMsg, assistantMsg],
          updatedAt: stamp(),
        }));
      } else {
        const created: ChatSession = {
          id: sessionId,
          title: titleFrom(text),
          messages: [userMsg, assistantMsg],
          createdAt: stamp(),
          updatedAt: stamp(),
        };
        setSessions((list) => [created, ...list]);
        setActiveId(sessionId);
      }
      await runStream(sessionId, assistantMsg.id, text);
      return true;
    },
    [busy, activeId, sessions, patchSession, runStream],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const regenerate = useCallback(async () => {
    if (busy || !active) return;
    const last = active.messages[active.messages.length - 1];
    const lastUser = [...active.messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!last || last.role !== "assistant" || !lastUser) return;
    const fresh = makeMessage("assistant", "", "streaming");
    patchSession(active.id, (s) => ({
      ...s,
      messages: [...s.messages.slice(0, -1), fresh],
      updatedAt: stamp(),
    }));
    await runStream(active.id, fresh.id, lastUser.content);
  }, [busy, active, patchSession, runStream]);

  const addSummary = useCallback(() => {
    if (busy || !active) return;
    if (!active.messages.some((m) => m.role === "user")) return;
    const message: ChatMessage = {
      ...makeMessage("assistant", buildCaseSummary(active), "done"),
      citations: uniqueCitations(active),
    };
    patchSession(active.id, (s) => ({
      ...s,
      messages: [...s.messages, message],
      updatedAt: stamp(),
    }));
  }, [busy, active, patchSession]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
  }, []);

  const selectSession = useCallback((id: string) => setActiveId(id), []);

  const renameSession = useCallback(
    (id: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      patchSession(id, (s) => ({ ...s, title: clean.slice(0, 80) }));
    },
    [patchSession],
  );

  const deleteSession = useCallback(
    (id: string) => {
      if (id === activeId) abortRef.current?.abort();
      setSessions((list) => list.filter((s) => s.id !== id));
      setBookmarks((list) => list.filter((b) => b.sessionId !== id));
      setActiveId((current) => (current === id ? null : current));
    },
    [activeId],
  );

  const toggleBookmark = useCallback(
    (sessionId: string, messageId: string) =>
      setBookmarks((list) =>
        list.some((b) => b.sessionId === sessionId && b.messageId === messageId)
          ? list.filter(
              (b) => !(b.sessionId === sessionId && b.messageId === messageId),
            )
          : [
              { id: uid(), sessionId, messageId, createdAt: stamp() },
              ...list,
            ],
      ),
    [],
  );

  return {
    sessions: sortedSessions,
    active,
    activeId,
    bookmarks,
    bookmarkedIds,
    busy,
    hydrated,
    send,
    stop,
    regenerate,
    addSummary,
    newChat,
    selectSession,
    renameSession,
    deleteSession,
    toggleBookmark,
  };
}