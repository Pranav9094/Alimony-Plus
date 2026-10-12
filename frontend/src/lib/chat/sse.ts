import type { Citation } from "./types";

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "citation"; citation: Citation }
  | { type: "done" }
  | { type: "error"; message: string };

const TYPES = new Set(["token", "citation", "done", "error"]);

export function encodeEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Parse a growing buffer. Returns complete events and the unfinished rest. */
export function parseSse(buffer: string): {
  events: StreamEvent[];
  rest: string;
} {
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as StreamEvent;
      if (parsed && TYPES.has(parsed.type)) events.push(parsed);
    } catch {
      // ignore malformed event
    }
  }
  return { events, rest };
}