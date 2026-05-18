# Chat App

A multi-user chat application built as a learning project.

## Learning Goals

- Understand how a REST API backend communicates with a frontend
- Understand why HTTP's request/response model limits live updates
- Explore solutions to live updates: polling → SSE → WebSockets
- Build features incrementally, starting from what we know

---

## Architecture

```
browser (vanilla JS)
       |
       | HTTP requests (fetch)
       v
Node/Express server
       |
       | in-memory array
       v
messages[]
```

**No database.** Data lives in memory and resets on server restart. This keeps the focus on HTTP and live updates, not persistence.

---

## The Live Update Problem

HTTP is a single-request/single-response protocol. Once the server responds, it cannot push new data to the client.

We solve this in three stages (building each one):

1. **Polling** — client asks the server for new messages on a fixed interval (`setInterval`). Simple, works, but wasteful.
2. **Server-Sent Events (SSE)** — server keeps a connection open and pushes updates when they happen. More efficient.
3. **WebSockets** — full bidirectional connection. Needed only if SSE proves limiting.

We start with polling so the problem is concrete before the solution is elegant.

---

## Data Model

A single `messages` array on the server. Each message:

```js
{
  id:           "uuid-string",      // unique identifier
  text:         "hello world",      // plain text content
  author:       "alice",            // who sent it
  likes:        0,                  // like count
  dislikes:     0,                  // dislike count
  replyTo:      null,               // id of the message being replied to, or null
  scheduledFor: null,               // Unix timestamp to publish at, or null
  pending:      false,              // true while waiting for scheduledFor time
  createdAt:    1234567890          // Unix timestamp when created
}
```

**Pending messages** are stored in the same array but excluded from `GET /messages` until their `scheduledFor` time passes. A `setInterval` on the server checks every few seconds and flips `pending` to `false` when the time comes.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/messages` | Returns all non-pending messages |
| `POST` | `/messages` | Creates a new message (or schedules one) |
| `POST` | `/messages/:id/like` | Increments like count on a message |
| `POST` | `/messages/:id/dislike` | Increments dislike count on a message |

Like and dislike are separate action endpoints (not PATCH) because the client triggers an action, not sets a value. This prevents clients from setting counts to arbitrary numbers.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | Node.js + Express | Familiar, minimal, maps directly to our endpoints |
| Frontend | Vanilla HTML/CSS/JS | No framework hiding the HTTP concepts we're learning |
| Storage | In-memory array | Keeps focus on the problem, not persistence |
| Package manager | pnpm | Used throughout; run `pnpm install` inside `backend/` |

---

## Modules

| Module | Responsibility |
|--------|---------------|
| **Messages store** | In-memory array with `getAll()`, `add()`, `findById()`, `incrementLikes()`, `incrementDislikes()`, `publishPending()` |
| **Scheduler** | `setInterval` that calls `store.publishPending()` — promotes pending messages when their time arrives |
| **Router** | Express routes wired to the store — thin layer, no logic |
| **Frontend client** | HTML + JS that renders messages, submits new ones, and polls for updates |

---

## Getting Started

```bash
cd backend
pnpm install
node server.js        # starts on http://localhost:3000 (serves frontend too)
pnpm test             # run unit + integration tests
```

Then open http://localhost:3000 in your browser.

---

## Build Order

Build backend first. Test each endpoint with `curl` before touching the frontend. This way if something breaks later, you know whether the bug is in the server or the browser.

1. ✅ `GET /messages` — returns empty array
2. ✅ `POST /messages` — adds a message to the array
3. `POST /messages/:id/like` and `/dislike`
4. Scheduling — `setInterval` on server, `pending` flag on message
5. Frontend — HTML page that calls the API
6. Polling — `setInterval` on the client to fetch new messages
7. (Later) Replace polling with SSE

---

## Project Structure

```
chat-app/
├── backend/
│   ├── tests/
│   │   ├── server.test.js  # Integration tests (supertest)
│   │   └── store.test.js   # Unit tests for the store
│   ├── server.js           # Express app — thin route layer
│   ├── store.js            # In-memory messages store
│   └── package.json
├── frontend/
│   └── index.html
└── README.md
```
