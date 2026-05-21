function createScheduler(registry, intervalMs = 3000) {
  let timer = null;

  return {
    start() {
      timer = setInterval(() => {
        for (const { store, broadcaster, presence } of registry.getAll()) {
          const promoted = store.publishPending();
          if (promoted.length > 0) broadcaster.emit(store.getAll(), presence.getAll());
        }
      }, intervalMs);
    },

    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { createScheduler };
