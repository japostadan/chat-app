const { createScheduler } = require('../scheduler');

describe('scheduler', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  function makeRoom(promoted = []) {
    return {
      store: { publishPending: jest.fn(() => promoted), getAll: jest.fn(() => []) },
      broadcaster: { emit: jest.fn() },
      presence: { getAll: jest.fn(() => []) },
    };
  }

  function makeRegistry(rooms) {
    return { getAll: jest.fn(() => rooms) };
  }

  it('calls broadcaster.emit for a room when messages are promoted', () => {
    const room = makeRoom([{ id: '1' }]);
    const scheduler = createScheduler(makeRegistry([room]), 100);
    scheduler.start();
    jest.advanceTimersByTime(100);
    expect(room.broadcaster.emit).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('does not call broadcaster.emit when no messages are promoted', () => {
    const room = makeRoom([]);
    const scheduler = createScheduler(makeRegistry([room]), 100);
    scheduler.start();
    jest.advanceTimersByTime(100);
    expect(room.broadcaster.emit).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('calls publishPending on each tick for every room', () => {
    const roomA = makeRoom([]);
    const roomB = makeRoom([]);
    const scheduler = createScheduler(makeRegistry([roomA, roomB]), 100);
    scheduler.start();
    jest.advanceTimersByTime(300);
    expect(roomA.store.publishPending).toHaveBeenCalledTimes(3);
    expect(roomB.store.publishPending).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('only emits for rooms that have promoted messages', () => {
    const roomA = makeRoom([{ id: '1' }]);
    const roomB = makeRoom([]);
    const scheduler = createScheduler(makeRegistry([roomA, roomB]), 100);
    scheduler.start();
    jest.advanceTimersByTime(100);
    expect(roomA.broadcaster.emit).toHaveBeenCalledTimes(1);
    expect(roomB.broadcaster.emit).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('stop prevents further ticks', () => {
    const room = makeRoom([{ id: '1' }]);
    const scheduler = createScheduler(makeRegistry([room]), 100);
    scheduler.start();
    scheduler.stop();
    jest.advanceTimersByTime(300);
    expect(room.store.publishPending).not.toHaveBeenCalled();
  });

  it('uses 3000ms interval by default', () => {
    const room = makeRoom([{ id: '1' }]);
    const scheduler = createScheduler(makeRegistry([room]));
    scheduler.start();
    jest.advanceTimersByTime(2999);
    expect(room.broadcaster.emit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(room.broadcaster.emit).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });
});
