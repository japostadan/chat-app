function createBroadcaster() {
  const clients = new Set();

  return {
    register(res) {
      clients.add(res);
    },

    unregister(res) {
      clients.delete(res);
    },

    emit(messages, presence = []) {
      const data = `data: ${JSON.stringify({ messages, presence })}\n\n`;
      clients.forEach(res => {
        try {
          res.write(data);
        } catch (_) {
          clients.delete(res);
        }
      });
    },
  };
}

module.exports = { createBroadcaster };
