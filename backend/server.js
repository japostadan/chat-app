const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createRoomRegistry } = require('./roomRegistry');
const { createScheduler } = require('./scheduler');

const MAX_TEXT = 2000;
const MAX_AUTHOR = 64;
const MAX_SCHEDULED_MS = 30 * 24 * 60 * 60 * 1000;

function resolveRoom(registry, code) {
  return code ? registry.get(code) : registry.getGlobal();
}

function createApp(roomRegistry, { rateLimitMax = 60, roomsRateLimitMax = 10 } = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      const allowed = process.env.ALLOWED_ORIGIN;
      if (!allowed || origin === allowed) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  }));
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.path.split('/').some(segment => segment.startsWith('.'))) {
      return res.status(403).end();
    }
    next();
  });
  app.use(express.static(path.join(__dirname, '..', 'frontend'), { dotfiles: 'deny' }));

  const SSE_CAP = 10;
  const sseConnections = new Map();

  const roomsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: roomsRateLimitMax,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Too many requests, please try again later.' },
  });

  app.post('/rooms', roomsLimiter, (req, res) => {
    const code = roomRegistry.create();
    res.status(201).json({ code });
  });

  app.get('/events', (req, res) => {
    const roomCode = req.query.room;
    const room = resolveRoom(roomRegistry, roomCode);
    if (!room) return res.status(404).json({ error: 'room not found' });

    const ip = req.ip;
    const count = sseConnections.get(ip) || 0;
    if (count >= SSE_CAP) {
      return res.status(503).end();
    }
    sseConnections.set(ip, count + 1);

    const { author, voterId } = req.query;
    const hasIdentity = author && voterId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    room.broadcaster.register(res);
    if (hasIdentity) room.presence.add(voterId, author);
    room.broadcaster.emit(room.store.getAll(), room.presence.getAll());
    req.on('close', () => {
      room.broadcaster.unregister(res);
      if (hasIdentity) {
        room.presence.remove(voterId);
        room.broadcaster.emit(room.store.getAll(), room.presence.getAll());
      }
      const current = sseConnections.get(ip) || 1;
      if (current <= 1) {
        sseConnections.delete(ip);
      } else {
        sseConnections.set(ip, current - 1);
      }
    });
  });

  app.get('/messages', (req, res) => {
    const room = resolveRoom(roomRegistry, req.query.room);
    if (!room) return res.status(404).json({ error: 'room not found' });
    res.json(room.store.getAll());
  });

  const messagesLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMax,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Too many requests, please try again later.' },
  });

  app.post('/messages', messagesLimiter, (req, res) => {
    const { text, author, replyTo, scheduledFor } = req.body;
    const room = resolveRoom(roomRegistry, req.query.room);
    if (!room) return res.status(404).json({ error: 'room not found' });

    if (!text || !author) {
      return res.status(400).json({ error: 'text and author are required' });
    }
    if (text.length > MAX_TEXT) {
      return res.status(400).json({ error: `text must be at most ${MAX_TEXT} characters` });
    }
    if (author.length > MAX_AUTHOR) {
      return res.status(400).json({ error: `author must be at most ${MAX_AUTHOR} characters` });
    }
    if (scheduledFor !== undefined && (typeof scheduledFor !== 'number' || !Number.isFinite(scheduledFor))) {
      return res.status(400).json({ error: 'scheduledFor must be a finite integer timestamp' });
    }
    const scheduledForMs = scheduledFor ? scheduledFor : null;
    if (scheduledForMs !== null && scheduledForMs - Date.now() > MAX_SCHEDULED_MS) {
      return res.status(400).json({ error: 'scheduledFor must be within 30 days' });
    }
    const pending = scheduledForMs !== null && scheduledForMs > Date.now();
    const msg = room.store.add({ text, author, replyTo, scheduledFor: scheduledForMs, pending });
    room.broadcaster.emit(room.store.getAll(), room.presence.getAll());
    res.status(201).json(msg);
  });

  app.post('/messages/:id/react', (req, res) => {
    const room = resolveRoom(roomRegistry, req.query.room);
    if (!room) return res.status(404).json({ error: 'room not found' });
    const { voterId, reaction } = req.body;
    if (!voterId || !reaction) {
      return res.status(400).json({ error: 'voterId and reaction are required' });
    }
    if (reaction !== 'like' && reaction !== 'dislike') {
      return res.status(400).json({ error: 'reaction must be like or dislike' });
    }
    const msg = room.store.react(req.params.id, voterId, reaction);
    if (!msg) return res.status(404).json({ error: 'message not found' });
    room.broadcaster.emit(room.store.getAll(), room.presence.getAll());
    res.json(msg);
  });

  return { app };
}

if (require.main === module) {
  const registry = createRoomRegistry();
  const { app } = createApp(registry);
  createScheduler(registry).start();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
}

module.exports = { createApp };
