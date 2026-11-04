const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');

let server = null;
let serverPort = null;

const makeRequest = ({ path = '/api/health', method = 'GET', origin = null, extraHeaders = {} } = {}) => {
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    if (origin !== null && origin !== undefined) {
      headers['Origin'] = origin;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: serverPort,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
};

test('Dynamic CORS Origin & Preflight Validation Test Suite', async (t) => {
  await setupTestDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      serverPort = server.address().port;
      resolve();
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDb();
  });

  await t.test('Normal request from http://localhost:5173 receives Access-Control-Allow-Origin', async () => {
    const res = await makeRequest({
      path: '/api/health',
      method: 'GET',
      origin: 'http://localhost:5173'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  await t.test('Normal request from http://localhost:5174 receives Access-Control-Allow-Origin', async () => {
    const res = await makeRequest({
      path: '/api/health',
      method: 'GET',
      origin: 'http://localhost:5174'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5174');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  await t.test('Preflight OPTIONS request from http://localhost:5173 receives CORS headers and 200 status', async () => {
    const res = await makeRequest({
      path: '/api/auth/login',
      method: 'OPTIONS',
      origin: 'http://localhost:5173',
      extraHeaders: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
    assert.ok(res.headers['access-control-allow-methods'].includes('POST'));
    assert.ok(res.headers['access-control-allow-headers'].toLowerCase().includes('content-type'));
  });

  await t.test('Preflight OPTIONS request from http://localhost:5174 receives CORS headers and 200 status', async () => {
    const res = await makeRequest({
      path: '/api/auth/login',
      method: 'OPTIONS',
      origin: 'http://localhost:5174',
      extraHeaders: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5174');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
    assert.ok(res.headers['access-control-allow-methods'].includes('POST'));
    assert.ok(res.headers['access-control-allow-headers'].toLowerCase().includes('content-type'));
  });

  await t.test('Normal request from unrelated origin (https://evil.example) does NOT receive CORS allow origin header', async () => {
    const res = await makeRequest({
      path: '/api/health',
      method: 'GET',
      origin: 'https://evil.example'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  await t.test('Preflight request from unrelated origin (https://evil.example) does NOT receive CORS allow origin header and does not crash', async () => {
    const res = await makeRequest({
      path: '/api/auth/login',
      method: 'OPTIONS',
      origin: 'https://evil.example',
      extraHeaders: {
        'Access-Control-Request-Method': 'POST'
      }
    });

    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.notEqual(res.statusCode, 500);
  });

  await t.test('Server-to-server / curl request without Origin header succeeds normally', async () => {
    const res = await makeRequest({
      path: '/api/health',
      method: 'GET',
      origin: null
    });

    assert.equal(res.statusCode, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.status, 'online');
  });
});
