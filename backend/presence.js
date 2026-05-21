function createPresenceTracker() {
  const players = new Map();

  return {
    add(voterId, author) {
      players.set(voterId, author);
    },

    remove(voterId) {
      players.delete(voterId);
    },

    getAll() {
      return Array.from(players.entries()).map(([voterId, author]) => ({ voterId, author }));
    },
  };
}

module.exports = { createPresenceTracker };
