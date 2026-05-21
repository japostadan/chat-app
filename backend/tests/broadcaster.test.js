const { createBroadcaster } = require('../broadcaster');

describe('broadcaster', () => {
  it('emit writes SSE-formatted data to all registered responses', () => {
    const broadcaster = createBroadcaster();
    const writes = [];
    const fakeRes = { write: (data) => writes.push(data) };
    broadcaster.register(fakeRes);
    broadcaster.emit([{ id: '1', text: 'hello' }]);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^data: /);
    expect(writes[0]).toContain('"hello"');
  });

  it('emit writes to all registered responses', () => {
    const broadcaster = createBroadcaster();
    const writes1 = [];
    const writes2 = [];
    broadcaster.register({ write: (d) => writes1.push(d) });
    broadcaster.register({ write: (d) => writes2.push(d) });
    broadcaster.emit([]);
    expect(writes1).toHaveLength(1);
    expect(writes2).toHaveLength(1);
  });

  it('emit automatically unregisters a response that throws on write', () => {
    const broadcaster = createBroadcaster();
    const goodWrites = [];
    const bad = { write: () => { throw new Error('broken'); } };
    const good = { write: (d) => goodWrites.push(d) };
    broadcaster.register(bad);
    broadcaster.register(good);
    broadcaster.emit([]);
    broadcaster.emit([]);
    expect(goodWrites).toHaveLength(2);
  });

  it('unregister removes the response so it no longer receives emits', () => {
    const broadcaster = createBroadcaster();
    const writes = [];
    const res = { write: (d) => writes.push(d) };
    broadcaster.register(res);
    broadcaster.unregister(res);
    broadcaster.emit([]);
    expect(writes).toHaveLength(0);
  });

  it('emit serialises both messages and presence into a structured payload', () => {
    const broadcaster = createBroadcaster();
    const writes = [];
    broadcaster.register({ write: (d) => writes.push(d) });
    const messages = [{ id: '1', text: 'hi' }];
    const presence = [{ voterId: 'v1', author: 'alice' }];
    broadcaster.emit(messages, presence);
    const payload = JSON.parse(writes[0].replace(/^data: /, '').trim());
    expect(payload.messages).toEqual(messages);
    expect(payload.presence).toEqual(presence);
  });
});
