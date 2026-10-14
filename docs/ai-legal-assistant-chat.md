# AI Legal Assistant Chat

Frontend module for Alimony+: a streaming legal-guidance chat with case-law citations.
Open it at `/assistant` (sidebar: **AI Legal Assistant**).
Live demo: https://alimony-plus-lime.vercel.app/assistant

## What it does

| Area               | Features                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming chat     | Token-by-token replies, Stop, Regenerate, retry on error, typing indicator                                                                           |
| Rich answers       | Markdown with tables, lists and code blocks (each code block has a Copy button)                                                                      |
| Citations          | Inline case chips. Clicking one opens a judgment preview with court, bench, date, summary and key holding (modal on desktop, bottom sheet on mobile) |
| Prompt suggestions | 12 starter questions in 3 categories on the empty screen                                                                                             |
| Quick actions      | Copy answer, Save (bookmark), Case summary                                                                                                           |
| History            | Multiple chats, rename, delete, restored after reload, Saved tab for bookmarks                                                                       |
| Export             | Markdown, plain text, and PDF through the browser print view                                                                                         |
| Polish             | Smart auto-scroll with Jump to latest, auto-growing input, mobile keyboard handling, reduced-motion support                                          |

Every screen shows: "AI-generated information, not legal advice."

## Run it

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:3000/assistant`.

```powershell
npm run typecheck
npm test
```

## How it is built

```
frontend/src
  app/api/chat/route.ts          Mock streaming API (Server-Sent Events)
  lib/chat/
    types.ts                     Citation, ChatMessage, ChatSession, Bookmark
    sse.ts                       Encode and parse stream events
    client.ts                    streamChat(): fetch + async generator
    mock-data.ts                 Sample citations and canned answers
    prompts.ts                   Suggestion matrix
    storage.ts                   Safe load/save of chats (localStorage)
    transcript.ts                Export, plain text, case summary
  components/chat/
    chat-view.tsx                Page layout, scroll, export menu
    use-chat.ts                  State: sessions, send, stop, regenerate, bookmarks
    chat-markdown.tsx            Sanitized markdown + citation chips + code copy
    citation-preview.tsx         Judgment preview (native dialog)
    message-actions.tsx          Copy / Save / Case summary / Regenerate
    suggestions.tsx              Prompt cards
    history-panel.tsx            Chats and Saved tabs
    chat.css                     All chat styles
```

The only edits to existing files are small: the route whitelist in `app/[section]/page.tsx`
and the menu entry, page title and render line in `components/workspace-app.tsx`.

## Streaming contract

`POST /api/chat` with JSON `{ "message": "..." }` returns `text/event-stream`.
Each event is `event: <type>` followed by `data: <json>` and a blank line.

| Event      | Data                                   | Meaning                                  |
| ---------- | -------------------------------------- | ---------------------------------------- |
| `token`    | `{"type":"token","text":"..."}`        | Next piece of the answer                 |
| `citation` | `{"type":"citation","citation":{...}}` | Details for a case mentioned in the text |
| `done`     | `{"type":"done"}`                      | Answer finished                          |
| `error`    | `{"type":"error","message":"..."}`     | Stream failed                            |

Citation object:

```json
{
  "id": "c1",
  "title": "Case title",
  "court": "Court name",
  "bench": ["Hon'ble Justice ..."],
  "date": "2020-11-04",
  "summary": "Short summary",
  "holding": "Key holding",
  "sample": false
}
```

Inside the answer text, a case is marked with `[[cite:<id>]]`. The UI turns the marker into
a chip and links it to the matching `citation` event. If the citation has not arrived yet the
chip stays disabled until it does.

## Connecting a real backend

1. Replace `src/app/api/chat/route.ts` with a proxy to the AI service, or change the URL in
   `src/lib/chat/client.ts`.
2. Keep the event format above. Nothing in the UI needs to change.
3. Send real citations with `"sample": false`. The "Sample data" notice in the preview card
   only appears when `sample` is `true`.

## Current limitations

- The API is a mock. Answers are canned and the three citations are **sample records with
  fictional parties**, not real judgments.
- **Case summary** is built on the device from the current conversation. It does not call an AI service.
- Chats are saved in the browser (`localStorage`, key `alimonyplus.chat.v1`, up to 50 chats).
  They stay on that device and are lost if the browser data is cleared.
- PDF export uses the browser print dialog (choose "Save as PDF").

## Safety and accessibility

- Answers are rendered with `react-markdown` and `rehype-sanitize`. Raw HTML is not rendered.
- The print view escapes all text before writing it into the page.
- Chips, buttons, tabs and the preview dialog are keyboard accessible, with visible focus.
- The message list is a live region and is marked busy while streaming.
- Animations are turned off for users who prefer reduced motion.

## Tests

`tests/chat-sse.test.ts` covers the stream parser. `tests/chat-transcript.test.ts` covers
exports, HTML escaping, the case summary and loading saved chats safely.
