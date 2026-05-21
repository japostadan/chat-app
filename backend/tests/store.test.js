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
    expect(store.findById(msg.id)).toMatchObject({ id: msg.id, text: 'hello' });
  });

  it('findById returns undefined for an unknown id', () => {
    expect(store.findById('no-such-id')).toBeUndefined();
  });

  it('react like increments likes count', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    const updated = store.react(msg.id, 'voter-1', 'like');
    expect(updated.likes).toBe(1);
    expect(updated.dislikes).toBe(0);
  });

  it('react like twice by same voter is idempotent', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    store.react(msg.id, 'voter-1', 'like');
    const updated = store.react(msg.id, 'voter-1', 'like');
    expect(updated.likes).toBe(1);
  });

  it('react dislike increments dislikes count', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    const updated = store.react(msg.id, 'voter-1', 'dislike');
    expect(updated.dislikes).toBe(1);
    expect(updated.likes).toBe(0);
  });

  it('react dislike twice by same voter is idempotent', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    store.react(msg.id, 'voter-1', 'dislike');
    const updated = store.react(msg.id, 'voter-1', 'dislike');
    expect(updated.dislikes).toBe(1);
  });

  it('react dislike after like swaps reaction', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    store.react(msg.id, 'voter-1', 'like');
    const updated = store.react(msg.id, 'voter-1', 'dislike');
    expect(updated.likes).toBe(0);
    expect(updated.dislikes).toBe(1);
  });

  it('react like after dislike swaps reaction', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    store.react(msg.id, 'voter-1', 'dislike');
    const updated = store.react(msg.id, 'voter-1', 'like');
    expect(updated.dislikes).toBe(0);
    expect(updated.likes).toBe(1);
  });

  it('react returns undefined for unknown id', () => {
    expect(store.react('no-such-id', 'voter-1', 'like')).toBeUndefined();
  });

  it('multiple voters react independently', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    store.react(msg.id, 'voter-1', 'like');
    store.react(msg.id, 'voter-2', 'like');
    store.react(msg.id, 'voter-3', 'dislike');
    const [serialized] = store.getAll();
    expect(serialized.likes).toBe(2);
    expect(serialized.dislikes).toBe(1);
  });

  it('getAll does not expose voter sets', () => {
    const msg = store.add({ text: 'hello', author: 'alice' });
    store.react(msg.id, 'voter-1', 'like');
    const [serialized] = store.getAll();
    expect(serialized).not.toHaveProperty('likedBy');
    expect(serialized).not.toHaveProperty('dislikedBy');
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

  it('publishPending returns the promoted messages', () => {
    const past = Date.now() - 5000;
    const msg = store.add({ text: 'hello', author: 'alice', scheduledFor: past, pending: true });
    const promoted = store.publishPending();
    expect(promoted).toHaveLength(1);
    expect(promoted[0].id).toBe(msg.id);
  });

  it('publishPending returns an empty array when nothing is promoted', () => {
    const future = Date.now() + 60000;
    store.add({ text: 'hello', author: 'alice', scheduledFor: future, pending: true });
    const promoted = store.publishPending();
    expect(promoted).toEqual([]);
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

  it('react returns undefined for unknown id', () => {
    expect(store.react('no-such-id', 'voter-1', 'like')).toBeUndefined();
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
