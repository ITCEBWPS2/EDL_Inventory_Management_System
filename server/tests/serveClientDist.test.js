const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

describe('Serve Client Dist Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Clear cache to ensure fresh load
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/server')];
    process.env.SERVE_CLIENT = 'true';
    const app = require('../src/server');

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Root URL (GET /) serves index.html with HTML Content-Type and no-cache', async () => {
    const res = await fetch(`${baseUrl}/`, {
      headers: { Accept: 'text/html' }
    });

    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /html/);
    const text = await res.text();
    assert.match(text, /<div id="root">/i);
    const cacheControl = res.headers.get('cache-control') || '';
    assert.match(cacheControl, /no-cache/);
  });

  test('2. Deep link SPA route (GET /login) falls back to index.html with no-cache', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      headers: { Accept: 'text/html' }
    });

    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /html/);
    const text = await res.text();
    assert.match(text, /<div id="root">/i);
    const cacheControl = res.headers.get('cache-control') || '';
    assert.match(cacheControl, /no-cache/);
  });

  test('3. Deep link nested route (GET /disposal-requests/some-id) falls back to index.html', async () => {
    const res = await fetch(`${baseUrl}/disposal-requests/03473962-72c8-4f82-9c86-a717288d3867`, {
      headers: { Accept: 'text/html' }
    });

    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /html/);
    const text = await res.text();
    assert.match(text, /<div id="root">/i);
  });

  test('4. Hashed static assets in /assets receive immutable long-term caching headers', async () => {
    const assetsDir = path.resolve(__dirname, '../../client/dist/assets');
    const files = fs.readdirSync(assetsDir);
    const jsOrCss = files.find(f => f.endsWith('.js') || f.endsWith('.css'));

    assert.ok(jsOrCss, 'Must have at least one asset file in client/dist/assets');

    const res = await fetch(`${baseUrl}/assets/${jsOrCss}`);
    assert.equal(res.status, 200);
    const cacheControl = res.headers.get('cache-control') || '';
    assert.match(cacheControl, /max-age=31536000.*immutable/);
  });

  test('5. API health route (GET /api/health) returns JSON, not index.html', async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /json/);
    const json = await res.json();
    assert.equal(json.status, 'online');
  });

  test('6. Unknown API route (GET /api/nonexistent) returns JSON 404, never index.html', async () => {
    const res = await fetch(`${baseUrl}/api/unknown-endpoint-xyz`, {
      headers: { Accept: 'text/html,application/json' }
    });

    assert.equal(res.status, 404);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /json/);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.message, 'API Route GET /api/unknown-endpoint-xyz not found.');
  });

  test('7. SERVE_CLIENT=false disables client serving and returns JSON 404 for GET /', async () => {
    let disabledServer;
    try {
      // Set SERVE_CLIENT=false
      process.env.SERVE_CLIENT = 'false';
      delete require.cache[require.resolve('../src/config/env')];
      delete require.cache[require.resolve('../src/server')];

      const disabledApp = require('../src/server');

      const disabledUrl = await new Promise((resolve) => {
        disabledServer = disabledApp.listen(0, '127.0.0.1', () => {
          const port = disabledServer.address().port;
          resolve(`http://127.0.0.1:${port}`);
        });
      });

      const res = await fetch(`${disabledUrl}/`, {
        headers: { Accept: 'text/html' }
      });

      assert.equal(res.status, 404);
      const contentType = res.headers.get('content-type') || '';
      assert.match(contentType, /json/);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.message, 'API Route GET / not found.');
    } finally {
      if (disabledServer) {
        await new Promise((resolve) => disabledServer.close(resolve));
      }
      delete process.env.SERVE_CLIENT;
      delete require.cache[require.resolve('../src/config/env')];
      delete require.cache[require.resolve('../src/server')];
    }
  });
});
