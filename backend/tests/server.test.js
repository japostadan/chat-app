const http = require('http');
const request = require('supertest');
const { createApp } = require('../server');
const { createRoomRegistry } = require('../roomRegistry');

describe('GET /messages', () => {
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

  it('returns an empty array on a fresh server', async () => {
    const res = await request(app).get('/messages');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('allows any origin when ALLOWED_ORIGIN is not set', async () => {
    delete process.env.ALLOWED_ORIGIN;
    const res = await request(app)
      .get('/messages')
      .set('Origin', 'https://any-origin.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://any-origin.example.com');
  });
});

describe('POST /messages', () => {
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

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
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

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
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

  function withServer(done, cb) {
    const server = app.listen(0, () => cb(server, server.address().port));
    return server;
  }

  function finish(server, done, err) {
    server.close(() => done(err));
  }

  it('returns 503 when the per-IP SSE connection cap is exceeded', (done) => {
    const CAP = 10;
    withServer(done, (server, port) => {
      const connections = [];
      let opened = 0;

      function tryNext() {
        const req = http.get(`http://127.0.0.1:${port}/events`);
        req.on('error', () => {});
        req.on('response', (res) => {
          opened++;
          if (res.statusCode === 200) {
            connections.push(req);
            res.resume();
            if (opened <= CAP) tryNext();
          } else {
            try {
              expect(opened).toBe(CAP + 1);
              expect(res.statusCode).toBe(503);
            } catch (err) {
              return finish(server, done, err);
            }
            connections.forEach(r => r.destroy());
            finish(server, done);
          }
        });
      }

      tryNext();
    });
  }, 10000);

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

  it('sends an initial event with {messages, presence} payload on connect', (done) => {
    withServer(done, (server, port) => {
      const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
        res.once('data', (chunk) => {
          try {
            const raw = chunk.toString().replace(/^data: /, '').trim();
            const payload = JSON.parse(raw);
            expect(Array.isArray(payload.messages)).toBe(true);
            expect(Array.isArray(payload.presence)).toBe(true);
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

  it('connecting with author and voterId adds player to presence in broadcast', (done) => {
    withServer(done, (server, port) => {
      const url = `http://127.0.0.1:${port}/events?author=alice&voterId=v1`;
      const req = http.get(url, (res) => {
        res.once('data', (chunk) => {
          try {
            const raw = chunk.toString().replace(/^data: /, '').trim();
            const payload = JSON.parse(raw);
            expect(payload.presence).toContainEqual({ voterId: 'v1', author: 'alice' });
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

  it('disconnecting a player removes them from presence in the following broadcast', (done) => {
    withServer(done, (server, port) => {
      const observerWrites = [];
      const observerReq = http.get(`http://127.0.0.1:${port}/events`, (observerRes) => {
        observerRes.on('data', (chunk) => {
          observerWrites.push(chunk.toString());
        });
        // Connect the player
        const playerUrl = `http://127.0.0.1:${port}/events?author=bob&voterId=v2`;
        const playerReq = http.get(playerUrl, (playerRes) => {
          playerRes.resume();
          // Destroy player connection after first event
          playerRes.once('data', () => {
            playerReq.destroy();
            // Give the server time to process the close and re-emit
            setTimeout(() => {
              try {
                // Find a broadcast after the player disconnected
                const allData = observerWrites.join('');
                const frames = allData.split('\n\n').filter(Boolean);
                const lastPayload = JSON.parse(frames[frames.length - 1].replace(/^data: /, ''));
                expect(lastPayload.presence.find(p => p.voterId === 'v2')).toBeUndefined();
                observerRes.destroy();
                finish(server, done);
              } catch (err) {
                observerRes.destroy();
                finish(server, done, err);
              }
            }, 100);
          });
        });
        playerReq.on('error', () => {});
      });
      observerReq.on('error', () => {});
    });
  }, 10000);

  it('connecting without author or voterId still receives the SSE stream (graceful degradation)', (done) => {
    withServer(done, (server, port) => {
      const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
        res.once('data', (chunk) => {
          try {
            const raw = chunk.toString().replace(/^data: /, '').trim();
            const payload = JSON.parse(raw);
            expect(Array.isArray(payload.messages)).toBe(true);
            expect(payload.presence).toEqual([]);
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

describe('POST /messages/:id/react', () => {
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

  it('like increments likes and returns the updated message', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    const res = await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1', reaction: 'like' });
    expect(res.status).toBe(200);
    expect(res.body.likes).toBe(1);
    expect(res.body.dislikes).toBe(0);
  });

  it('like twice by same voter is idempotent', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1', reaction: 'like' });
    const res = await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1', reaction: 'like' });
    expect(res.status).toBe(200);
    expect(res.body.likes).toBe(1);
  });

  it('dislike after like swaps reaction', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1', reaction: 'like' });
    const res = await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1', reaction: 'dislike' });
    expect(res.status).toBe(200);
    expect(res.body.likes).toBe(0);
    expect(res.body.dislikes).toBe(1);
  });

  it('returns 400 when voterId is missing', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    const res = await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ reaction: 'like' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reaction is missing', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    const res = await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reaction is invalid', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    const res = await request(app)
      .post(`/messages/${created.body.id}/react`)
      .send({ voterId: 'voter-1', reaction: 'love' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown message id', async () => {
    const res = await request(app)
      .post('/messages/no-such-id/react')
      .send({ voterId: 'voter-1', reaction: 'like' });
    expect(res.status).toBe(404);
  });

  it('old /like endpoint returns 404', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    const res = await request(app).post(`/messages/${created.body.id}/like`);
    expect(res.status).toBe(404);
  });

  it('old /dislike endpoint returns 404', async () => {
    const created = await request(app)
      .post('/messages').send({ text: 'hello', author: 'alice' });
    const res = await request(app).post(`/messages/${created.body.id}/dislike`);
    expect(res.status).toBe(404);
  });
});

describe('POST /messages input validation', () => {
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

  it('returns 400 with error when text exceeds 2000 chars', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'a'.repeat(2001), author: 'alice' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text/i);
  });

  it('returns 201 when text is exactly 2000 chars', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'a'.repeat(2000), author: 'alice' });
    expect(res.status).toBe(201);
  });

  it('returns 400 with error when author exceeds 64 chars', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'a'.repeat(65) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/author/i);
  });

  it('returns 201 when author is exactly 64 chars', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'a'.repeat(64) });
    expect(res.status).toBe(201);
  });

  it('returns 400 when scheduledFor is more than 30 days in the future', async () => {
    const tooFar = Date.now() + 31 * 24 * 60 * 60 * 1000;
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice', scheduledFor: tooFar });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scheduledFor/i);
  });

  it('returns 201 when scheduledFor is within 30 days', async () => {
    const within30 = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice', scheduledFor: within30 });
    expect(res.status).toBe(201);
  });

  it('returns 400 when scheduledFor is a boolean', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice', scheduledFor: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scheduledFor/i);
  });

  it('returns 400 when scheduledFor is a string', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice', scheduledFor: 'next tuesday' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scheduledFor/i);
  });

  it('returns 400 when scheduledFor is Infinity', async () => {
    const res = await request(app)
      .post('/messages')
      .send({ text: 'hello', author: 'alice', scheduledFor: Infinity });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scheduledFor/i);
  });
});

describe('POST /rooms rate limiting', () => {
  let savedEnv;
  beforeEach(() => { savedEnv = process.env.NODE_ENV; delete process.env.NODE_ENV; });
  afterEach(() => { process.env.NODE_ENV = savedEnv; });

  it('returns 429 after the room creation limit is exceeded', async () => {
    const { app } = createApp(createRoomRegistry(), { roomsRateLimitMax: 1 });
    await request(app).post('/rooms');
    const res = await request(app).post('/rooms');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many requests/i);
  });

  it('does not rate-limit room creation when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';
    const { app } = createApp(createRoomRegistry(), { roomsRateLimitMax: 1 });
    await request(app).post('/rooms');
    const res = await request(app).post('/rooms');
    expect(res.status).toBe(201);
  });
});

describe('POST /messages rate limiting', () => {
  let savedEnv;
  beforeEach(() => { savedEnv = process.env.NODE_ENV; delete process.env.NODE_ENV; });
  afterEach(() => { process.env.NODE_ENV = savedEnv; });

  it('returns 429 with { error } after the limit is exceeded', async () => {
    const { app } = createApp(createRoomRegistry(), { rateLimitMax: 1 });
    await request(app).post('/messages').send({ text: 'first', author: 'alice' });
    const res = await request(app).post('/messages').send({ text: 'second', author: 'alice' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many requests/i);
  });

  it('does not rate-limit when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';
    const { app } = createApp(createRoomRegistry(), { rateLimitMax: 1 });
    await request(app).post('/messages').send({ text: 'first', author: 'alice' });
    const res = await request(app).post('/messages').send({ text: 'second', author: 'alice' });
    expect(res.status).toBe(201);
  });
});

describe('static file server', () => {
  let app;
  beforeEach(() => { ({ app } = createApp(createRoomRegistry())); });

  it('returns 403 for dotfile requests', async () => {
    const res = await request(app).get('/.env');
    expect(res.status).toBe(403);
  });
});

describe('CORS with ALLOWED_ORIGIN env var', () => {
  let app;
  let savedOrigin;

  beforeEach(() => {
    ({ app } = createApp(createRoomRegistry()));
    savedOrigin = process.env.ALLOWED_ORIGIN;
  });

  afterEach(() => {
    if (savedOrigin === undefined) {
      delete process.env.ALLOWED_ORIGIN;
    } else {
      process.env.ALLOWED_ORIGIN = savedOrigin;
    }
  });

  it('echoes matching origin when ALLOWED_ORIGIN is set', async () => {
    process.env.ALLOWED_ORIGIN = 'https://myapp.vercel.app';
    const res = await request(app)
      .get('/messages')
      .set('Origin', 'https://myapp.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://myapp.vercel.app');
  });

  it('rejects non-matching origin when ALLOWED_ORIGIN is set', async () => {
    process.env.ALLOWED_ORIGIN = 'https://myapp.vercel.app';
    const res = await request(app)
      .get('/messages')
      .set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows any origin when ALLOWED_ORIGIN is not set', async () => {
    delete process.env.ALLOWED_ORIGIN;
    const res = await request(app)
      .get('/messages')
      .set('Origin', 'https://anywhere.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://anywhere.example.com');
  });
});
