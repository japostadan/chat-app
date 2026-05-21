const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createStore } = require('./store');
const { createBroadcaster } = require('./broadcaster');
const { createScheduler } = require('./scheduler');

const MAX_TEXT = 2000;
const MAX_AUTHOR = 64;
const MAX_SCHEDULED_MS = 30 * 24 * 60 * 60 * 1000;

function createApp(store, { rateLimitMax = 60 } = {}) {
  const app = express();
  const broadcaster = createBroadcaster();

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
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  const SSE_CAP = 10;
  const sseConnections = new Map();

  app.get('/events', (req, res) => {
    const ip = req.ip;
    const count = sseConnections.get(ip) || 0;
    if (count >= SSE_CAP) {
      return res.status(503).end();
    }
    sseConnections.set(ip, count + 1);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    broadcaster.register(res);
    broadcaster.emit(store.getAll());
    req.on('close', () => {
      broadcaster.unregister(res);
      const current = sseConnections.get(ip) || 1;
      if (current <= 1) {
        sseConnections.delete(ip);
      } else {
        sseConnections.set(ip, current - 1);
      }
    });
  });

  app.get('/messages', (req, res) => {
    res.json(store.getAll());
  });

  const messagesLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMax,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Too many requests, please try again later.' },
  });

  app.post('/messages', messagesLimiter, (req, res) => {
    const { text, author, replyTo, scheduledFor } = req.body;
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
    const msg = store.add({ text, author, replyTo, scheduledFor: scheduledForMs, pending });
    broadcaster.emit(store.getAll());
    res.status(201).json(msg);
  });

  app.post('/messages/:id/like', (req, res) => {
    const msg = store.incrementLikes(req.params.id);
    if (!msg) return res.status(404).json({ error: 'message not found' });
    broadcaster.emit(store.getAll());
    res.json(msg);
  });

  app.post('/messages/:id/dislike', (req, res) => {
    const msg = store.incrementDislikes(req.params.id);
    if (!msg) return res.status(404).json({ error: 'message not found' });
    broadcaster.emit(store.getAll());
    res.json(msg);
  });

  return { app, broadcaster };
}

if (require.main === module) {
  const store = createStore();
  const { app, broadcaster } = createApp(store);
  createScheduler(store, broadcaster).start();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
}

module.exports = { createApp };
