# ADR 0001: Real SSE Presence Tracking

**Status:** Accepted

## Context

The game lobby UI redesign requires a player roster panel showing who is currently in a Lobby. Two approaches were considered:

1. **Derived from messages** — show distinct Authors who have posted in the Room. No backend changes needed, but lurkers are invisible and departed users still appear.
2. **Real SSE presence** — server tracks active SSE connections per Room and broadcasts a connected-players list as part of the SSE stream.

## Decision

Real SSE presence (option 2).

## Reasons

- The app already maintains per-Room SSE connection sets for broadcasting; extending them to carry identity (Voter ID + Author name) is a small addition.
- A lobby roster showing players who have left and hiding lurkers is misleading — it would undermine the core game-lobby mental model.
- The SSE stream already pushes on every store change; adding Presence to the payload keeps the client update model uniform.

## Trade-offs

- Requires Author name to be sent on SSE connection open (currently only sent per message). The client must include its Author and Voter ID as query params on the `/events` URL.
- Presence is ephemeral and per-connection. A page refresh clears and re-adds the player. This is acceptable given the app's in-memory, ephemeral storage model.
