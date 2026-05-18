const request = require('supertest');
const app = require('../server');

describe('GET /messages', () => {
  it('returns an empty array on a fresh server', async () => {
    const res = await request(app).get('/messages');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('includes CORS headers', async () => {
    const res = await request(app).get('/messages');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('POST /messages', () => {
  it('creates and returns a message with all required fields', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      text: 'hello',
      author: 'alice',
      likes: 0,
      dislikes: 0,
      replyTo: null,
      scheduledFor: null,
      pending: false,
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('number');
  });

  it('returns 400 when text is missing', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ author: 'alice' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when author is missing', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello' });
    expect(res.status).toBe(400);
  });

  it('stores replyTo when provided', async () => {
    const parent = await request(app)
      .post('/messages')
      .send({ text: 'parent', author: 'alice' });
    const res = await request(app)
      .post('/messages')
      .send({ text: 'reply', author: 'bob', replyTo: parent.body.id });
    expect(res.status).toBe(201);
    expect(res.body.replyTo).toBe(parent.body.id);
  });
});

describe('POST /messages/:id/like', () => {
  it('increments likes and returns the updated message', async () => {
    const created = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice' });
    const res = await request(app).post(`/messages/${created.body.id}/like`);
    expect(res.status).toBe(200);
    expect(res.body.likes).toBe(1);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).post('/messages/no-such-id/like');
    expect(res.status).toBe(404);
  });
});

describe('POST /messages/:id/dislike', () => {
  it('increments dislikes and returns the updated message', async () => {
    const created = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice' });
    const res = await request(app).post(`/messages/${created.body.id}/dislike`);
    expect(res.status).toBe(200);
    expect(res.body.dislikes).toBe(1);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).post('/messages/no-such-id/dislike');
    expect(res.status).toBe(404);
  });
});
