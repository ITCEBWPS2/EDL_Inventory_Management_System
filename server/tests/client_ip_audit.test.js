const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { AuditLog } = require('../src/models');
const auditLogger = require('../src/services/auditLogger');
const {
  getClientIp,
  getClientIpDetails,
  getLocalLanIp,
  normalizeIp,
  isLoopbackIp
} = require('../src/utils/clientIp');

test('Client IP Detection & Audit Log Telemetry Test Suite', async (t) => {
  await setupTestDb();

  t.after(async () => {
    await teardownTestDb();
  });

  await t.test('1. normalizeIp cleans IPv6-mapped IPv4, ports, zone IDs, and lists', () => {
    // IPv6 mapped IPv4
    assert.equal(normalizeIp('::ffff:192.168.1.25'), '192.168.1.25');
    assert.equal(normalizeIp('::ffff:10.0.0.1'), '10.0.0.1');

    // Comma-separated list (takes first client IP)
    assert.equal(normalizeIp('192.168.1.55, 10.0.0.1, 172.16.0.1'), '192.168.1.55');

    // IPv4 with port
    assert.equal(normalizeIp('192.168.1.99:54321'), '192.168.1.99');

    // IPv6 with brackets and port
    assert.equal(normalizeIp('[::1]:8080'), '::1');
    assert.equal(normalizeIp('[2001:db8::1]:443'), '2001:db8::1');

    // IPv6 with zone ID
    assert.equal(normalizeIp('fe80::1%eth0'), 'fe80::1');
    assert.equal(normalizeIp('fe80::1%12'), 'fe80::1');

    // Plain IPv6 preserved
    assert.equal(normalizeIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    assert.equal(normalizeIp('::1'), '::1');
    assert.equal(normalizeIp('127.0.0.1'), '127.0.0.1');

    // Empty or non-string
    assert.equal(normalizeIp(null), '');
    assert.equal(normalizeIp(''), '');
  });

  await t.test('2. isLoopbackIp accurately identifies loopback origins', () => {
    assert.equal(isLoopbackIp('::1'), true);
    assert.equal(isLoopbackIp('127.0.0.1'), true);
    assert.equal(isLoopbackIp('127.0.1.1'), true);
    assert.equal(isLoopbackIp('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackIp('[::1]:3000'), true);
    assert.equal(isLoopbackIp('localhost'), true);

    assert.equal(isLoopbackIp('192.168.1.100'), false);
    assert.equal(isLoopbackIp('10.238.5.39'), false);
    assert.equal(isLoopbackIp('203.0.113.195'), false);
  });

  await t.test('3. Loopback requests resolve to host machine LAN IPv4 address with source "local-resolved"', () => {
    const lanIp = getLocalLanIp();
    assert.match(lanIp, /^(\d{1,3}\.){3}\d{1,3}$/);

    // Mock Express request originating from ::1
    const mockReq = {
      socket: { remoteAddress: '::1' },
      headers: {},
      app: { get: (k) => (k === 'trust proxy' ? false : undefined) }
    };

    const details = getClientIpDetails(mockReq);
    assert.equal(details.ip, lanIp);
    assert.equal(details.rawIp, '::1');
    assert.equal(details.source, 'local-resolved');
  });

  await t.test('4. X-Forwarded-For is strictly ignored when trust proxy is false (spoofing prevented)', () => {
    const mockReq = {
      socket: { remoteAddress: '203.0.113.50' },
      headers: {
        'x-forwarded-for': '198.51.100.99, 10.0.0.1' // Spoofed client header
      },
      app: { get: (k) => (k === 'trust proxy' ? false : undefined) }
    };

    const details = getClientIpDetails(mockReq);
    assert.equal(details.ip, '203.0.113.50');
    assert.equal(details.source, 'direct');
    assert.notEqual(details.ip, '198.51.100.99');
  });

  await t.test('5. X-Forwarded-For is honoured when trust proxy is enabled', () => {
    const mockReq = {
      ip: '198.51.100.99', // Express populates req.ip from X-Forwarded-For when trust proxy is enabled
      socket: { remoteAddress: '10.0.0.1' }, // Proxy server address
      headers: {
        'x-forwarded-for': '198.51.100.99'
      },
      app: { get: (k) => (k === 'trust proxy' ? true : undefined) }
    };

    const details = getClientIpDetails(mockReq);
    assert.equal(details.ip, '198.51.100.99');
    assert.equal(details.source, 'proxy');
  });

  await t.test('6. Invalid IP strings fall back to "unknown"', () => {
    const mockReq = {
      socket: { remoteAddress: 'not-a-valid-ip' },
      headers: {},
      app: { get: (k) => false }
    };

    const details = getClientIpDetails(mockReq);
    assert.equal(details.ip, 'unknown');
    assert.equal(details.source, 'unknown');
  });

  await t.test('7. AuditLog persistence accurately records ip_address, ip_raw, and ip_source', async () => {
    const lanIp = getLocalLanIp();

    const mockReq = {
      socket: { remoteAddress: '::1' },
      headers: { 'user-agent': 'Mozilla/5.0 Test Suite' },
      user: { id: 'test-user-1', full_name: 'Test Operator', username: 'testop', role: 'local_admin' },
      app: { get: (k) => false }
    };

    const log = await auditLogger.log({
      action: 'TEST_IP_ACTION',
      module: 'Settings',
      description: 'Testing client IP persistence',
      req: mockReq
    });

    assert.ok(log);
    assert.equal(log.ip_address, lanIp);
    assert.equal(log.ip_raw, '::1');
    assert.equal(log.ip_source, 'local-resolved');

    // Verify stored directly in MongoDB
    const fetched = await AuditLog.findOne({ id: log.id }).lean();
    assert.ok(fetched);
    assert.equal(fetched.ip_address, lanIp);
    assert.equal(fetched.ip_raw, '::1');
    assert.equal(fetched.ip_source, 'local-resolved');
  });
});

