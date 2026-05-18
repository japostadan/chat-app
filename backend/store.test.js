const { createStore } = require('./store');

describe('messages store', () => {
  let store;

  beforeEach(() => {
    store = createStore();
  });

  it('getAll returns empty array on fresh store', () => {
    expect(store.getAll()).toEqual([]);
  });

  it('getAll excludes pending messages', () => {
    store.add({ text: 'visible', author: 'alice' });
    store.add({ text: 'hidden', author: 'bob', pending: true });
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].text).toBe('visible');
  });

  it('getAll includes a newly added message', () => {
    store.add({ text: 'hello', author: 'alice' });
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].text).toBe('hello');
  });

  it('findById returns the message with the given id', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    expect(store.findById(msg.id)).toBe(msg);
  });

  it('findById returns undefined for an unknown id', () => {
    expect(store.findById('no-such-id')).toBeUndefined();
  });

  it('add returns a message with all required fields', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    expect(msg).toMatchObject({
      text: 'hello',
      author: 'alice',
      likes: 0,
      dislikes: 0,
      replyTo: null,
      scheduledFor: null,
      pending: false,
    });
    expect(typeof msg.id).toBe('string');
    expect(typeof msg.createdAt).toBe('number');
  });
});
