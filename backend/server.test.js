const request = require('supertest');
const app = require('./server');

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
});
