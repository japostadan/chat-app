const { randomUUID } = require('crypto');

function serialize({ likedBy, dislikedBy, ...rest }) {
  return { ...rest, likes: likedBy.size, dislikes: dislikedBy.size };
}

function createStore() {
  const messages = [];

  return {
    getAll() {
      return messages.filter(m => !m.pending).map(serialize);
    },

    findById(id) {
      return messages.find(m => m.id === id);
    },

    react(id, voterId, reaction) {
      const msg = messages.find(m => m.id === id);
      if (!msg) return undefined;
      const opposite = reaction === 'like' ? 'dislikedBy' : 'likedBy';
      const own = reaction === 'like' ? 'likedBy' : 'dislikedBy';
      msg[opposite].delete(voterId);
      msg[own].add(voterId);
      return serialize(msg);
    },

    add({ text, author, pending = false, replyTo = null, scheduledFor = null }) {
      const msg = {
        id: randomUUID(),
        text,
        author,
        likedBy: new Set(),
        dislikedBy: new Set(),
        replyTo,
        scheduledFor,
        pending,
        createdAt: Date.now(),
      };
      messages.push(msg);
      return serialize(msg);
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
