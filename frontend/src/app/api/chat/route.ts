import { buildAnswer, getCitation } from "@/lib/chat/mock-data";
import { CITE_MARKER } from "@/lib/chat/types";
import { encodeEvent, type StreamEvent } from "@/lib/chat/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const raw = (body as { message?: unknown } | null)?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message || message.length > 4000)
    return Response.json(
      { message: "Message must be 1 to 4000 characters." },
      { status: 400 },
    );

  const text = buildAnswer(message);
  const tokens = text.match(/\S+\s*|\s+/g) ?? [];
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(event)));
      const sent = new Set<string>();
      try {
        for (const token of tokens) {
          if (signal.aborted) return;
          send({ type: "token", text: token });
          for (const match of token.matchAll(CITE_MARKER)) {
            const citation = getCitation(match[1]);
            if (citation && !sent.has(citation.id)) {
              sent.add(citation.id);
              send({ type: "citation", citation });
            }
          }
          await sleep(25, signal);
        }
        send({ type: "done" });
      } catch {
        // client disconnected mid-stream
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}