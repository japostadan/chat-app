const express = require('express');
const { createStore } = require('./store');

const app = express();
const store = createStore();

app.use(express.json());

app.get('/messages', (req, res) => {
  res.json(store.getAll());
});

app.post('/messages', (req, res) => {
  const { text, author } = req.body;
  const msg = store.add({ text, author });
  res.status(201).json(msg);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

module.exports = app;
