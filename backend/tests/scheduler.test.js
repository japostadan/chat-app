const { createScheduler } = require('../scheduler');

describe('scheduler', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  function makeStore(promoted = []) {
    return { publishPending: jest.fn(() => promoted), getAll: jest.fn(() => []) };
  }

  function makeBroadcaster() {
    return { emit: jest.fn() };
  }

  it('calls broadcaster.emit after one interval when messages are promoted', () => {
    const store = makeStore([{ id: '1' }]);
    const broadcaster = makeBroadcaster();
    const scheduler = createScheduler(store, broadcaster, 100);
    scheduler.start();
    jest.advanceTimersByTime(100);
    expect(broadcaster.emit).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('does not call broadcaster.emit when no messages are promoted', () => {
    const store = makeStore([]);
    const broadcaster = makeBroadcaster();
    const scheduler = createScheduler(store, broadcaster, 100);
    scheduler.start();
    jest.advanceTimersByTime(100);
    expect(broadcaster.emit).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('calls publishPending on each tick', () => {
    const store = makeStore([]);
    const broadcaster = makeBroadcaster();
    const scheduler = createScheduler(store, broadcaster, 100);
    scheduler.start();
    jest.advanceTimersByTime(300);
    expect(store.publishPending).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('stop prevents further ticks', () => {
    const store = makeStore([{ id: '1' }]);
    const broadcaster = makeBroadcaster();
    const scheduler = createScheduler(store, broadcaster, 100);
    scheduler.start();
    scheduler.stop();
    jest.advanceTimersByTime(300);
    expect(store.publishPending).not.toHaveBeenCalled();
  });

  it('uses 3000ms interval by default', () => {
    const store = makeStore([{ id: '1' }]);
    const broadcaster = makeBroadcaster();
    const scheduler = createScheduler(store, broadcaster);
    scheduler.start();
    jest.advanceTimersByTime(2999);
    expect(broadcaster.emit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(broadcaster.emit).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });
});
