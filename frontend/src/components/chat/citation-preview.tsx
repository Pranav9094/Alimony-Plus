"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { Citation } from "@/lib/chat/types";

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

export function CitationPreview({
  citation,
  onClose,
}: {
  citation: Citation | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (citation && !dialog.open) dialog.showModal();
    if (!citation && dialog.open) dialog.close();
    setCopied(false);
  }, [citation]);

  async function copyCitation() {
    if (!citation) return;
    const text = `${citation.title}, ${citation.court}, ${formatDate(citation.date)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked by the browser
    }
  }

  return (
    <dialog
      ref={ref}
      className="cite-dialog"
      aria-labelledby="cite-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {citation && (
        <div className="cite-dialog-body">
          <div className="cite-dialog-head">
            <div>
              <p className="overline">JUDGMENT PREVIEW</p>
              <h2 id="cite-title">{citation.title}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close preview"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {citation.sample && (
            <p className="cite-sample">
              Sample data for demonstration. Not a real judgment.
            </p>
          )}

          <dl className="cite-meta">
            <div>
              <dt>Court</dt>
              <dd>{citation.court}</dd>
            </div>
            <div>
              <dt>Bench</dt>
              <dd>{citation.bench.join(", ")}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(citation.date)}</dd>
            </div>
          </dl>

          <h3>Summary</h3>
          <p>{citation.summary}</p>
          <h3>Key holding</h3>
          <p>{citation.holding}</p>

          <div className="cite-actions">
            <button type="button" className="button" onClick={copyCitation}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy citation"}
            </button>
            <button type="button" className="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}