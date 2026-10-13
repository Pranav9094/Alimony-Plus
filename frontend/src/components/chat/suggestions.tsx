"use client";
import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { PROMPT_MATRIX } from "@/lib/chat/prompts";

export function Suggestions({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  const [categoryId, setCategoryId] = useState(PROMPT_MATRIX[0].id);
  const category =
    PROMPT_MATRIX.find((c) => c.id === categoryId) ?? PROMPT_MATRIX[0];

  return (
    <div className="chat-suggest">
      <div className="chat-suggest-intro">
        <h2>How can I help today?</h2>
        <p className="muted">
          Pick a question to start, or type your own below.
        </p>
      </div>
      <div
        className="chat-suggest-tabs"
        role="tablist"
        aria-label="Question categories"
      >
        {PROMPT_MATRIX.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            id={`suggest-tab-${c.id}`}
            aria-selected={c.id === category.id}
            aria-controls="suggest-panel"
            className={`chat-suggest-tab ${c.id === category.id ? "active" : ""}`}
            onClick={() => setCategoryId(c.id)}
          >
            {c.title}
          </button>
        ))}
      </div>
      <div
        className="chat-suggest-grid"
        role="tabpanel"
        id="suggest-panel"
        aria-labelledby={`suggest-tab-${category.id}`}
      >
        {category.prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="chat-suggest-card"
            disabled={disabled}
            onClick={() => onPick(prompt)}
          >
            <MessageSquareText size={16} aria-hidden="true" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}