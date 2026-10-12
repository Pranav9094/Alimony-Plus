export type Citation = {
  id: string;
  title: string;
  court: string;
  bench: string[];
  date: string; // YYYY-MM-DD
  summary: string;
  holding: string;
  /** true while data comes from the mock API, never from a verified source */
  sample: boolean;
};

export type MessageStatus = "streaming" | "done" | "error";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  status: MessageStatus;
  createdAt: string; // ISO
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type Bookmark = {
  id: string;
  sessionId: string;
  messageId: string;
  note?: string;
  createdAt: string;
};

/** Inline marker the model/mock API puts in text, e.g. [[cite:c1]] */
export const CITE_MARKER = /\[\[cite:([\w-]+)\]\]/g;