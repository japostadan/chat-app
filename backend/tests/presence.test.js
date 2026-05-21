const { createPresenceTracker } = require('../presence');

describe('presence tracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = createPresenceTracker();
  });

  it('getAll returns empty array on fresh tracker', () => {
    expect(tracker.getAll()).toEqual([]);
  });

  it('add registers a player who then appears in getAll', () => {
    tracker.add('voter-1', 'alice');
    expect(tracker.getAll()).toEqual([{ voterId: 'voter-1', author: 'alice' }]);
  });

  it('remove unregisters a player who then disappears from getAll', () => {
    tracker.add('voter-1', 'alice');
    tracker.remove('voter-1');
    expect(tracker.getAll()).toEqual([]);
  });

  it('adding the same voterId twice updates author without duplicating the entry', () => {
    tracker.add('voter-1', 'alice');
    tracker.add('voter-1', 'alice-renamed');
    const all = tracker.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({ voterId: 'voter-1', author: 'alice-renamed' });
  });
});
