const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { createStore } = require('./store');
const { createBroadcaster } = require('./broadcaster');
const { createScheduler } = require('./scheduler');

const MAX_TEXT = 2000;
const MAX_AUTHOR = 64;
const MAX_SCHEDULED_MS = 30 * 24 * 60 * 60 * 1000;

function createApp(store) {
  const app = express();
  const broadcaster = createBroadcaster();

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
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    broadcaster.register(res);
    broadcaster.emit(store.getAll());
    req.on('close', () => broadcaster.unregister(res));
  });

  app.get('/messages', (req, res) => {
    res.json(store.getAll());
  });

  app.post('/messages', (req, res) => {
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
    const scheduledForMs = scheduledFor ? new Date(scheduledFor).getTime() : null;
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
