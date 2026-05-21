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

    add({ text, author, pending = false, replyTo = null, scheduledFor = null }) {
      const msg = {
        id: randomUUID(),
        text,
        author,
        likes: 0,
        dislikes: 0,
        replyTo,
        scheduledFor,
        pending,
        createdAt: Date.now(),
      };
      messages.push(msg);
      return msg;
    },

    publishPending() {
      const now = Date.now();
      const promoted = [];
      messages.forEach(msg => {
        if (msg.pending && msg.scheduledFor !== null && msg.scheduledFor <= now) {
          msg.pending = false;
          promoted.push(msg);
        }
      });
      return promoted;
    },
  };
}

module.exports = { createStore };
