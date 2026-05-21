function createBroadcaster() {
  const clients = new Set();

  return {
    register(res) {
      clients.add(res);
    },

    unregister(res) {
      clients.delete(res);
    },

    emit(messages) {
      const data = `data: ${JSON.stringify(messages)}\n\n`;
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
