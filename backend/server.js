const express = require('express');
const cors = require('cors');
const { createStore } = require('./store');

const app = express();
const store = createStore();

app.use(cors());
app.use(express.json());

app.get('/messages', (req, res) => {
  res.json(store.getAll());
});

app.post('/messages', (req, res) => {
  const { text, author } = req.body;
  if (!text || !author) {
    return res.status(400).json({ error: 'text and author are required' });
  }
  const msg = store.add({ text, author });
  res.status(201).json(msg);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
}

module.exports = app;
