import {
  CITE_MARKER,
  type ChatMessage,
  type ChatSession,
  type Citation,
} from "./types";

/** Message text with [[cite:id]] markers replaced by [Case title]. */
export function plainText(message: ChatMessage): string {
  return message.content.replace(CITE_MARKER, (_match, id: string) => {
    const found = message.citations.find((c) => c.id === id);
    return `[${found ? found.title : "Source"}]`;
  });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```\w*\n?/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(
      /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$\n?/gm,
      "",
    )
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_match, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .join("  -  "),
    )
    .replace(/\n{3,}/g, "\n\n");
}
export function uniqueCitations(session: ChatSession): Citation[] {
  const map = new Map<string, Citation>();
  for (const message of session.messages)
    for (const citation of message.citations)
      if (!map.has(citation.id)) map.set(citation.id, citation);
  return [...map.values()];
}

function day(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function toMarkdown(session: ChatSession, now = new Date()): string {
  const lines = [
    `# ${session.title}`,
    "",
    `_Exported ${day(now)}. AI-generated information, not legal advice._`,
    "",
  ];
  for (const m of session.messages)
    lines.push(
      `## ${m.role === "user" ? "You" : "Assistant"}`,
      "",
      plainText(m),
      "",
    );
  const cites = uniqueCitations(session);
  if (cites.length) {
    lines.push("## Authorities referred to", "");
    for (const c of cites)
      lines.push(
        `- ${c.title}, ${c.court}, ${c.date}${c.sample ? " (sample data)" : ""}`,
      );
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function toText(session: ChatSession, now = new Date()): string {
  const lines = [
    session.title,
    `Exported ${day(now)}. AI-generated information, not legal advice.`,
    "",
  ];
  for (const m of session.messages)
    lines.push(
      m.role === "user" ? "YOU" : "ASSISTANT",
      stripMarkdown(plainText(m)).trim(),
      "",
    );
  return lines.join("\n").trimEnd() + "\n";
}

function firstLine(message: ChatMessage): string {
  const line = stripMarkdown(plainText(message))
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "";
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

/** Local summary built only from this conversation (no AI call). */
export function buildCaseSummary(session: ChatSession): string {
  const questions = session.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const topics = session.messages
    .filter(
      (m) =>
        m.role === "assistant" &&
        m.status === "done" &&
        !m.content.startsWith("**Case summary**"),
    )
    .map(firstLine)
    .filter(Boolean);
  const cites = uniqueCitations(session);

  const out = [
    "**Case summary**",
    "",
    "_Built from this conversation only. Not legal advice._",
    "",
    "**Questions asked**",
    "",
  ];
  if (questions.length) questions.forEach((q, i) => out.push(`${i + 1}. ${q}`));
  else out.push("- No questions yet.");
  out.push("", "**Topics covered**", "");
  if (topics.length) topics.forEach((t) => out.push(`- ${t}`));
  else out.push("- None yet.");
  out.push("", "**Authorities referred to**", "");
  if (cites.length) cites.forEach((c) => out.push(`- [[cite:${c.id}]]`));
  else out.push("- No authorities were cited.");
  out.push(
    "",
    "Please check every authority and fact with a qualified lawyer before relying on it.",
  );
  return out.join("\n");
}

export function fileName(
  session: ChatSession,
  ext: string,
  now = new Date(),
): string {
  const slug =
    session.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "chat";
  return `alimony-plus-${slug}-${day(now)}.${ext}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPrintHtml(session: ChatSession, now = new Date()): string {
  const blocks = session.messages
    .map(
      (m) =>
        `<section class="msg ${m.role}"><h2>${
          m.role === "user" ? "You" : "Assistant"
        }</h2><div class="text">${escapeHtml(
          stripMarkdown(plainText(m)).trim(),
        )}</div></section>`,
    )
    .join("");
  const cites = uniqueCitations(session);
  const authorities = cites.length
    ? `<section class="msg"><h2>Authorities referred to</h2><ul>${cites
        .map(
          (c) =>
            `<li>${escapeHtml(c.title)}, ${escapeHtml(c.court)}, ${escapeHtml(
              c.date,
            )}${c.sample ? " (sample data)" : ""}</li>`,
        )
        .join("")}</ul></section>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    session.title,
  )}</title><style>
body{font-family:Georgia,serif;color:#1f2f29;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.55}
h1{font-size:24px;margin:0 0 4px}
.note{color:#5b6b62;font-size:13px;margin:0 0 20px}
.msg{border:1px solid #d7ddd3;border-radius:10px;padding:10px 14px;margin:0 0 12px;break-inside:avoid}
.msg.user{background:#edf3ee}
h2{font:600 12px Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;margin:0 0 6px;color:#254f42}
.text{white-space:pre-wrap;overflow-wrap:anywhere}
</style></head><body><h1>${escapeHtml(
    session.title,
  )}</h1><p class="note">Exported ${day(
    now,
  )}. AI-generated information, not legal advice.</p>${blocks}${authorities}</body></html>`;
}

/** Browser only: save text as a file. */
export function downloadText(name: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Browser only: open a print view (choose "Save as PDF"). False if blocked. */
export function printTranscript(session: ChatSession): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(buildPrintHtml(session));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
}