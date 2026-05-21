const { createRoomRegistry } = require('../roomRegistry');

describe('room registry', () => {
  let registry;

  beforeEach(() => {
    registry = createRoomRegistry();
  });

  it('getGlobal returns the same store and broadcaster on every call', () => {
    const first = registry.getGlobal();
    const second = registry.getGlobal();
    expect(first.store).toBe(second.store);
    expect(first.broadcaster).toBe(second.broadcaster);
  });

  it('create returns a 6-character alphanumeric join code', () => {
    const code = registry.create();
    expect(code).toMatch(/^[A-Za-z0-9]{6}$/);
  });

  it('two successive create calls return different codes', () => {
    const a = registry.create();
    const b = registry.create();
    expect(a).not.toBe(b);
  });

  it('get returns the room associated with a created code', () => {
    const code = registry.create();
    const room = registry.get(code);
    expect(room).toBeDefined();
    expect(room.store).toBeDefined();
    expect(room.broadcaster).toBeDefined();
  });

  it('get returns undefined for an unknown code', () => {
    expect(registry.get('XXXXXX')).toBeUndefined();
  });

  it('messages added to one room do not appear in another room', () => {
    const codeA = registry.create();
    const codeB = registry.create();
    registry.get(codeA).store.add({ text: 'hello', author: 'alice' });
    expect(registry.get(codeB).store.getAll()).toHaveLength(0);
  });

  it('global room is isolated from named rooms', () => {
    const code = registry.create();
    registry.getGlobal().store.add({ text: 'global msg', author: 'alice' });
    expect(registry.get(code).store.getAll()).toHaveLength(0);
  });
});
