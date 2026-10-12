import { describe, expect, it } from "vitest";
import { encodeEvent, parseSse } from "../src/lib/chat/sse";

describe("sse helpers", () => {
  it("round-trips events", () => {
    const wire =
      encodeEvent({ type: "token", text: "Hello " }) +
      encodeEvent({ type: "done" });
    const { events, rest } = parseSse(wire);
    expect(events).toEqual([
      { type: "token", text: "Hello " },
      { type: "done" },
    ]);
    expect(rest).toBe("");
  });

  it("keeps an unfinished event in rest", () => {
    const full = encodeEvent({ type: "token", text: "abc" });
    const { events, rest } = parseSse(full.slice(0, -1));
    expect(events).toEqual([]);
    const next = parseSse(rest + full.slice(-1));
    expect(next.events).toEqual([{ type: "token", text: "abc" }]);
  });

  it("ignores malformed and unknown events", () => {
    const { events } = parseSse(
      'data: {not json}\n\ndata: {"type":"nope"}\n\n',
    );
    expect(events).toEqual([]);
  });
});