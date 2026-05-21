const { createStore } = require('../store');

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

  it('incrementLikes returns the message with likes incremented', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    const updated = store.incrementLikes(msg.id);
    expect(updated.likes).toBe(1);
  });

  it('incrementLikes returns undefined for unknown id', () => {
    expect(store.incrementLikes('no-such-id')).toBeUndefined();
  });

  it('incrementDislikes returns the message with dislikes incremented', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    const updated = store.incrementDislikes(msg.id);
    expect(updated.dislikes).toBe(1);
  });

  it('incrementDislikes returns undefined for unknown id', () => {
    expect(store.incrementDislikes('no-such-id')).toBeUndefined();
  });

  it('add stores replyTo when provided', () => {
    const parent = store.add({ text: 'parent', author: 'alice' });
    const reply = store.add({ text: 'reply', author: 'bob', replyTo: parent.id });
    expect(reply.replyTo).toBe(parent.id);
  });

  it('publishPending flips messages whose scheduledFor has passed', () => {
    const past = Date.now() - 5000;
    const msg = store.add({ text: 'hello', author: 'alice', scheduledFor: past, pending: true });
    expect(msg.pending).toBe(true);
    store.publishPending();
    expect(store.findById(msg.id).pending).toBe(false);
  });

  it('publishPending leaves future messages pending', () => {
    const future = Date.now() + 60000;
    const msg = store.add({ text: 'hello', author: 'alice', scheduledFor: future, pending: true });
    store.publishPending();
    expect(store.findById(msg.id).pending).toBe(true);
  });

  it('add sets scheduledFor on the message', () => {
    const ts = Date.now() + 10000;
    const msg = store.add({ text: 'hello', author: 'alice', scheduledFor: ts });
    expect(msg.scheduledFor).toBe(ts);
  });

  it('add sets replyTo to null when not provided', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    expect(msg.replyTo).toBeNull();
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
