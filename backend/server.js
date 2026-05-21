const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { createStore } = require('./store');

const app = express();
const store = createStore();
const clients = new Set();

const MAX_TEXT = 2000;
const MAX_AUTHOR = 64;
const MAX_SCHEDULED_MS = 30 * 24 * 60 * 60 * 1000;

function broadcast() {
  const data = `data: ${JSON.stringify(store.getAll())}\n\n`;
  clients.forEach(res => {
    try { res.write(data); } catch (_) { clients.delete(res); }
  });
}

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
  clients.add(res);
  res.write(`data: ${JSON.stringify(store.getAll())}\n\n`);
  req.on('close', () => clients.delete(res));
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
  broadcast();
  res.status(201).json(msg);
});

app.post('/messages/:id/like', (req, res) => {
  const msg = store.incrementLikes(req.params.id);
  if (!msg) return res.status(404).json({ error: 'message not found' });
  broadcast();
  res.json(msg);
});

app.post('/messages/:id/dislike', (req, res) => {
  const msg = store.incrementDislikes(req.params.id);
  if (!msg) return res.status(404).json({ error: 'message not found' });
  broadcast();
  res.json(msg);
});

if (require.main === module) {
  setInterval(() => { store.publishPending(); broadcast(); }, 3000);
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
}

module.exports = app;
