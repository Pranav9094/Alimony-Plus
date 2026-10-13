"use client";
import { useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  FileText,
  RefreshCw,
} from "lucide-react";
import { plainText } from "@/lib/chat/transcript";
import type { ChatMessage } from "@/lib/chat/types";

export function MessageActions({
  message,
  bookmarked,
  isLast,
  disabled,
  onBookmark,
  onSummary,
  onRegenerate,
}: {
  message: ChatMessage;
  bookmarked: boolean;
  isLast: boolean;
  disabled: boolean;
  onBookmark: () => void;
  onSummary: () => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (message.role !== "assistant" || message.status === "streaming")
    return null;
  if (!message.content) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText(message));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked by the browser
    }
  }

  return (
    <div className="chat-actions" role="group" aria-label="Message actions">
      <button type="button" className="chat-action" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        type="button"
        className="chat-action"
        onClick={onBookmark}
        aria-pressed={bookmarked}
      >
        {bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        {bookmarked ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        className="chat-action"
        onClick={onSummary}
        disabled={disabled}
      >
        <FileText size={14} />
        Case summary
      </button>
      {isLast && (
        <button
          type="button"
          className="chat-action"
          onClick={onRegenerate}
          disabled={disabled}
        >
          <RefreshCw size={14} />
          Regenerate
        </button>
      )}
    </div>
  );
}