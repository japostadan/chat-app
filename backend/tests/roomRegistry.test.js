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

  it('getGlobal room has a presence tracker', () => {
    const global = registry.getGlobal();
    expect(global.presence).toBeDefined();
    expect(typeof global.presence.add).toBe('function');
    expect(typeof global.presence.remove).toBe('function');
    expect(typeof global.presence.getAll).toBe('function');
  });

  it('create returns a 6-character uppercase alphanumeric join code', () => {
    const code = registry.create();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
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
    expect(room.presence).toBeDefined();
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

  it('getAll returns only the global room when no named rooms exist', () => {
    const rooms = registry.getAll();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toBe(registry.getGlobal());
  });

  it('getAll returns global room plus all named rooms', () => {
    const codeA = registry.create();
    const codeB = registry.create();
    const rooms = registry.getAll();
    expect(rooms).toHaveLength(3);
    expect(rooms).toContain(registry.getGlobal());
    expect(rooms).toContain(registry.get(codeA));
    expect(rooms).toContain(registry.get(codeB));
  });
});
