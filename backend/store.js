const { randomUUID } = require('crypto');

function createStore() {
  const messages = [];

  return {
    getAll() {
      return messages.filter(m => !m.pending);
    },

    findById(id) {
      return messages.find(m => m.id === id);
    },

    add({ text, author, pending = false }) {
      const msg = {
        id: randomUUID(),
        text,
        author,
        likes: 0,
        dislikes: 0,
        replyTo: null,
        scheduledFor: null,
        pending,
        createdAt: Date.now(),
      };
      messages.push(msg);
      return msg;
    },
  };
}

module.exports = { createStore };
