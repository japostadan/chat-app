const http = require('http');
const request = require('supertest');
const { createApp } = require('../server');
const { createRoomRegistry } = require('../roomRegistry');

function makeApp() {
  const registry = createRoomRegistry();
  const { app } = createApp(registry);
  return { app, registry };
}

describe('POST /rooms', () => {
  it('returns 201 and a 6-character alphanumeric code', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/rooms');
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{6}$/);
  });

  it('two calls return different codes', async () => {
    const { app } = makeApp();
    const a = await request(app).post('/rooms');
    const b = await request(app).post('/rooms');
    expect(a.body.code).not.toBe(b.body.code);
  });
});

describe('GET /messages (room-scoped)', () => {
  it('returns 404 for an unknown room code', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/messages?room=XXXXXX');
    expect(res.status).toBe(404);
  });

  it('returns only messages posted to that room', async () => {
    const { app } = makeApp();
    const { body: { code } } = await request(app).post('/rooms');
    await request(app).post('/messages').send({ text: 'room msg', author: 'alice', room: code });
    await request(app).post('/messages').send({ text: 'global msg', author: 'bob' });

    const res = await request(app).get(`/messages?room=${code}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].text).toBe('room msg');
  });

  it('global messages do not appear in a named room', async () => {
    const { app } = makeApp();
    const { body: { code } } = await request(app).post('/rooms');
    await request(app).post('/messages').send({ text: 'global', author: 'alice' });

    const res = await request(app).get(`/messages?room=${code}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('POST /messages (room-scoped)', () => {
  it('returns 404 when room code is unknown', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice', room: 'XXXXXX' });
    expect(res.status).toBe(404);
  });

  it('stores message in the named room, not in the global room', async () => {
    const { app } = makeApp();
    const { body: { code } } = await request(app).post('/rooms');
    await request(app).post('/messages').send({ text: 'room msg', author: 'alice', room: code });

    const globalRes = await request(app).get('/messages');
    expect(globalRes.body).toHaveLength(0);

    const roomRes = await request(app).get(`/messages?room=${code}`);
    expect(roomRes.body).toHaveLength(1);
  });
});

describe('GET /events (room-scoped)', () => {
  it('returns 404 for an unknown room code', (done) => {
    const { app } = makeApp();
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.get(`http://127.0.0.1:${port}/events?room=XXXXXX`, (res) => {
        try {
          expect(res.statusCode).toBe(404);
          res.resume();
          server.close(() => done());
        } catch (err) {
          server.close(() => done(err));
        }
      });
      req.on('error', () => {});
    });
  });
});

describe('POST /messages/:id/like (room-scoped)', () => {
  it('returns 404 for unknown room code', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/messages/some-id/like?room=XXXXXX');
    expect(res.status).toBe(404);
  });
});

describe('POST /messages/:id/dislike (room-scoped)', () => {
  it('returns 404 for unknown room code', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/messages/some-id/dislike?room=XXXXXX');
    expect(res.status).toBe(404);
  });
});
