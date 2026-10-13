import { describe, expect, it } from "vitest";
import {
  buildCaseSummary,
  buildPrintHtml,
  escapeHtml,
  fileName,
  plainText,
  toMarkdown,
  toText,
} from "../src/lib/chat/transcript";
import { parseChatState } from "../src/lib/chat/storage";
import type { ChatSession, Citation } from "../src/lib/chat/types";

const NOW = new Date("2026-10-14T10:00:00Z");
const STAMP = "2026-10-14T10:00:00.000Z";

const cite: Citation = {
  id: "c1",
  title: "Asha Rao v. Vikram Rao (Sample)",
  court: "Sample High Court",
  bench: ["Hon'ble Justice A. Example"],
  date: "2020-11-04",
  summary: "Sample summary.",
  holding: "Sample holding.",
  sample: true,
};

const session: ChatSession = {
  id: "s1",
  title: "Interim maintenance",
  createdAt: STAMP,
  updatedAt: STAMP,
  messages: [
    {
      id: "m1",
      role: "user",
      content: "What is interim maintenance?",
      citations: [],
      status: "done",
      createdAt: STAMP,
    },
    {
      id: "m2",
      role: "assistant",
      content: "**Interim maintenance**\n\nIt is temporary support. [[cite:c1]]",
      citations: [cite],
      status: "done",
      createdAt: STAMP,
    },
  ],
};

describe("plainText", () => {
  it("replaces citation markers with the case title", () => {
    const text = plainText(session.messages[1]);
    expect(text).toContain("[Asha Rao v. Vikram Rao (Sample)]");
    expect(text).not.toContain("[[cite:");
  });

  it("uses a generic label when the citation is unknown", () => {
    const text = plainText({
      ...session.messages[1],
      content: "See this. [[cite:zz]]",
      citations: [],
    });
    expect(text).toBe("See this. [Source]");
  });
});

describe("exports", () => {
  it("builds a markdown transcript", () => {
    const md = toMarkdown(session, NOW);
    expect(md).toContain("# Interim maintenance");
    expect(md).toContain("Exported 2026-10-14");
    expect(md).toContain("## You");
    expect(md).toContain("## Assistant");
    expect(md).toContain("## Authorities referred to");
    expect(md).toContain("(sample data)");
  });

  it("builds a plain text transcript without markdown symbols", () => {
    const text = toText(session, NOW);
    expect(text.split("\n")[0]).toBe("Interim maintenance");
    expect(text).toContain("YOU");
    expect(text).toContain("ASSISTANT");
    expect(text).not.toContain("**");
  });

  it("creates a safe file name", () => {
    expect(fileName(session, "md", NOW)).toBe(
      "alimony-plus-interim-maintenance-2026-10-14.md",
    );
    expect(fileName({ ...session, title: "???" }, "txt", NOW)).toBe(
      "alimony-plus-chat-2026-10-14.txt",
    );
  });

  it("escapes html characters", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;",
    );
  });

  it("never lets message text become html in the print view", () => {
    const html = buildPrintHtml(
      {
        ...session,
        title: "<script>alert(1)</script>",
        messages: [
          {
            ...session.messages[0],
            content: "<img src=x onerror=alert(1)>",
          },
        ],
      },
      NOW,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildCaseSummary", () => {
  it("lists questions, topics and authorities", () => {
    const summary = buildCaseSummary(session);
    expect(summary).toContain("**Case summary**");
    expect(summary).toContain("1. What is interim maintenance?");
    expect(summary).toContain("- Interim maintenance");
    expect(summary).toContain("[[cite:c1]]");
  });

  it("handles an empty conversation", () => {
    const summary = buildCaseSummary({ ...session, messages: [] });
    expect(summary).toContain("- No questions yet.");
    expect(summary).toContain("- No authorities were cited.");
  });
});

describe("parseChatState", () => {
  it("returns empty state for missing or broken data", () => {
    const empty = { sessions: [], bookmarks: [], activeId: null };
    expect(parseChatState(null)).toEqual(empty);
    expect(parseChatState("{not json")).toEqual(empty);
    expect(parseChatState("42")).toEqual(empty);
  });

  it("restores saved sessions and bookmarks", () => {
    const raw = JSON.stringify({
      sessions: [session],
      bookmarks: [
        { id: "b1", sessionId: "s1", messageId: "m2", createdAt: STAMP },
      ],
      activeId: "s1",
    });
    const state = parseChatState(raw);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].messages).toHaveLength(2);
    expect(state.bookmarks).toHaveLength(1);
    expect(state.activeId).toBe("s1");
  });

  it("settles messages that were still streaming", () => {
    const streaming = {
      ...session,
      messages: [{ ...session.messages[1], status: "streaming" }],
    };
    const state = parseChatState(JSON.stringify({ sessions: [streaming] }));
    expect(state.sessions[0].messages[0].status).toBe("done");
  });

  it("drops malformed sessions, orphan bookmarks and unknown active id", () => {
    const raw = JSON.stringify({
      sessions: [{ foo: 1 }, session],
      bookmarks: [
        { id: "b1", sessionId: "s1", messageId: "m2", createdAt: STAMP },
        { id: "b2", sessionId: "gone", messageId: "m9", createdAt: STAMP },
      ],
      activeId: "missing",
    });
    const state = parseChatState(raw);
    expect(state.sessions).toHaveLength(1);
    expect(state.bookmarks).toHaveLength(1);
    expect(state.activeId).toBeNull();
  });
});