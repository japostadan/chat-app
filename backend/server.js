const express = require('express');
const cors = require('cors');
const path = require('path');
const { createStore } = require('./store');

const app = express();
const store = createStore();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/messages', (req, res) => {
  res.json(store.getAll());
});

app.post('/messages', (req, res) => {
  const { text, author, replyTo, scheduledFor } = req.body;
  if (!text || !author) {
    return res.status(400).json({ error: 'text and author are required' });
  }
  const scheduledForMs = scheduledFor ? new Date(scheduledFor).getTime() : null;
  const pending = scheduledForMs !== null && scheduledForMs > Date.now();
  const msg = store.add({ text, author, replyTo, scheduledFor: scheduledForMs, pending });
  res.status(201).json(msg);
});

app.post('/messages/:id/like', (req, res) => {
  const msg = store.incrementLikes(req.params.id);
  if (!msg) return res.status(404).json({ error: 'message not found' });
  res.json(msg);
});

app.post('/messages/:id/dislike', (req, res) => {
  const msg = store.incrementDislikes(req.params.id);
  if (!msg) return res.status(404).json({ error: 'message not found' });
  res.json(msg);
});

if (require.main === module) {
  setInterval(() => store.publishPending(), 3000);
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
}

module.exports = app;
