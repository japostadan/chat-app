const http = require('http');
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

describe('POST /messages with scheduledFor', () => {
  it('stores message as pending when scheduledFor is in the future', async () => {
    const future = Date.now() + 60000;
    const res = await request(app)
      .post('/messages')
      .send({ text: 'later', author: 'alice', scheduledFor: future });
    expect(res.status).toBe(201);
    expect(res.body.pending).toBe(true);
    expect(res.body.scheduledFor).toBe(future);
  });

  it('GET /messages excludes a pending scheduled message', async () => {
    const future = Date.now() + 60000;
    await request(app)
      .post('/messages')
      .send({ text: 'invisible', author: 'alice', scheduledFor: future });
    const res = await request(app).get('/messages');
    const texts = res.body.map(m => m.text);
    expect(texts).not.toContain('invisible');
  });

  it('stores message as not pending when no scheduledFor is given', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'immediate', author: 'alice' });
    expect(res.status).toBe(201);
    expect(res.body.pending).toBe(false);
  });
});

describe('GET /events (SSE)', () => {
  function withServer(done, cb) {
    const server = app.listen(0, () => cb(server, server.address().port));
    return server;
  }

  function finish(server, done, err) {
    server.close(() => done(err));
  }

  it('returns text/event-stream content type', (done) => {
    withServer(done, (server, port) => {
      const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
        try {
          expect(res.headers['content-type']).toMatch(/text\/event-stream/);
          res.destroy();
          finish(server, done);
        } catch (err) {
          res.destroy();
          finish(server, done, err);
        }
      });
      req.on('error', () => {});
    });
  });

  it('sends an initial event with current messages on connect', (done) => {
    withServer(done, (server, port) => {
      const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
        res.once('data', (chunk) => {
          try {
            expect(chunk.toString()).toMatch(/^data: \[/);
            res.destroy();
            finish(server, done);
          } catch (err) {
            res.destroy();
            finish(server, done, err);
          }
        });
      });
      req.on('error', () => {});
    });
  });

  it('broadcasts an event to connected clients when a message is posted', (done) => {
    withServer(done, (server, port) => {
      let finished = false;
      const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
        const buf = [];
        res.on('data', (chunk) => {
          if (finished) return;
          buf.push(chunk.toString());
          if (buf.join('').includes('sse-broadcast-marker')) {
            finished = true;
            res.destroy();
            finish(server, done);
          }
        });
        setImmediate(() => {
          request(app)
            .post('/messages')
            .send({ text: 'sse-broadcast-marker', author: 'tester' })
            .end(() => {});
        });
      });
      req.on('error', () => {});
    });
  }, 10000);
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
