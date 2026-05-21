# Chat App — Domain Context

## Glossary

**Message**
A unit of text sent by an Author in the shared room. Has a unique ID, timestamp, like/dislike counts, and optional reply linkage. Always plain text.

**Author**
A self-reported display name stored in the browser's localStorage. No authentication — the server trusts whatever the client sends. Always displayed on every message group header, including messages sent by the current user.

**Pending Message**
A Message whose `scheduledFor` timestamp has not yet passed. Stored server-side but excluded from all API responses until promoted by the scheduler.

**Scheduled Message**
A Message created with a future `scheduledFor` timestamp. Starts as a Pending Message; becomes a visible Message when the scheduler promotes it.

**Reaction**
A like or dislike cast by a Voter on a Message. Mutually exclusive per Voter — a Voter can hold at most one Reaction per Message at a time. Casting the same Reaction twice is idempotent (no change); casting the opposite Reaction swaps. Reactions cannot be removed once cast. Counts are derived server-side from voter sets, which are never exposed to clients. Client reaction state (which Reaction the current Voter has cast) is stored in localStorage.

**Voter**
A stable anonymous identity used for Reaction deduplication. Represented as a UUID generated once per browser and stored in localStorage. Independent of the Author name — changing your name does not reset your Reactions. The server trusts the client-supplied Voter ID (same trust model as Author).

**Reply**
A Message that references another Message by ID via `replyTo`. The referenced message is rendered as a quote inside the reply bubble.

**Room**
An isolated message space identified by a short alphanumeric join code. Rooms are ephemeral — they exist in-memory and reset on server restart. A Room is created explicitly via a "Create room" action that generates a unique code; anyone who enters that code joins the same Room. The global room (no code) always exists as the default. A user can leave a Room and return to the global room via a "Leave room" action.

**Join Code**
A short auto-generated alphanumeric string that uniquely identifies a Room. Shared out-of-band (e.g. copy-paste). Entering a Join Code in the UI switches the user's active Room.

**Presence**
The set of Players currently connected to a Room via SSE. The server tracks one entry per active SSE connection (keyed by Voter ID + Author name) and broadcasts the current Presence list alongside messages whenever it changes. A Player appears in Presence when their SSE connection opens and disappears when it closes. Presence is per-Room and ephemeral — it resets on server restart along with all other state.

**SSE Stream**
The `/events` endpoint. Keeps a long-lived HTTP connection open and pushes the full message list and current Presence to all connected clients whenever either changes.

**View Clear**
A client-side action that hides all messages received before the moment it was triggered. Stored as a `clearedBefore` timestamp in `localStorage`. The server store is unaffected; other users see no change. New messages after the clear appear normally.

## Deployment Model

- **Frontend** — static build (Vite) deployed to Vercel
- **Backend** — Node/Express process deployed to Coolify (self-hosted PaaS)
- **Storage** — in-memory; data is ephemeral and resets on restart
- **CORS** — locked to the Vercel origin via `ALLOWED_ORIGIN` env var; falls back to `*` when unset (local dev)
