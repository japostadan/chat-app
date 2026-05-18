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

    incrementLikes(id) {
      const msg = messages.find(m => m.id === id);
      if (!msg) return undefined;
      msg.likes += 1;
      return msg;
    },

    incrementDislikes(id) {
      const msg = messages.find(m => m.id === id);
      if (!msg) return undefined;
      msg.dislikes += 1;
      return msg;
    },

    add({ text, author, pending = false, replyTo = null }) {
      const msg = {
        id: randomUUID(),
        text,
        author,
        likes: 0,
        dislikes: 0,
        replyTo,
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
