const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');
const { resetPasswordLimiterStore } = require('../src/middleware/rateLimiter');

let server = null;
let API_BASE = '';

test('Forgot and Update Password API Test Suite', async (t) => {
  await setupTestDb();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      API_BASE = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await teardownTestDb();
  });

  t.beforeEach(() => {
    resetPasswordLimiterStore();
  });

  await t.test('1. FORGOT PASSWORD: rejects invalid password rules (< 8 chars, no number, no letter)', async () => {
    // Too short
    const res1 = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        newPassword: 'short',
        confirmPassword: 'short'
      })
    });
    assert.equal(res1.status, 400);

    // No number
    const res2 = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        newPassword: 'allletterslong',
        confirmPassword: 'allletterslong'
      })
    });
    assert.equal(res2.status, 400);

    // No letter
    const res3 = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        newPassword: '1234567890',
        confirmPassword: '1234567890'
      })
    });
    assert.equal(res3.status, 400);
  });

  await t.test('2. FORGOT PASSWORD: rejects mismatched confirm password', async () => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        newPassword: 'ValidPassword123',
        confirmPassword: 'DifferentPassword123'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.message, 'Passwords do not match.');
  });

  await t.test('3. FORGOT PASSWORD: fake username returns generic error message without revealing existence', async () => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'non_existent_user_99999',
        newPassword: 'ValidPassword123',
        confirmPassword: 'ValidPassword123'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.message, 'Unable to reset the password. Please check the details and try again.');
  });

  await t.test('4. FORGOT PASSWORD: valid username and matching password updates password and enables login', async () => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        newPassword: 'NewForgotPass123',
        confirmPassword: 'NewForgotPass123'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'Password updated. You can now log in.');

    // Verify login with new password
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        password: 'NewForgotPass123'
      })
    });
    const loginJson = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.equal(loginJson.success, true);
    assert.ok(loginJson.data.token);
  });

  await t.test('5. UPDATE PASSWORD: rejects when current password is wrong with generic message', async () => {
    const res = await fetch(`${API_BASE}/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        current_password: 'WrongCurrentPassword999',
        new_password: 'BrandNewPassword456'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.message, 'Username or current password is incorrect.');
  });

  await t.test('6. UPDATE PASSWORD: fake username returns same generic message', async () => {
    const res = await fetch(`${API_BASE}/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'completely_fake_user',
        current_password: 'SomePassword123',
        new_password: 'BrandNewPassword456'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.message, 'Username or current password is incorrect.');
  });

  await t.test('7. UPDATE PASSWORD: new password must differ from current password', async () => {
    const res = await fetch(`${API_BASE}/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        current_password: 'NewForgotPass123',
        new_password: 'NewForgotPass123'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.equal(json.message, 'New password must be different from the current password.');
  });

  await t.test('8. UPDATE PASSWORD: valid update works and restores password', async () => {
    const res = await fetch(`${API_BASE}/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        current_password: 'NewForgotPass123',
        new_password: 'RestoredHead123'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'Password updated. You can now log in.');

    // Verify login with restored password
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unithead',
        password: 'RestoredHead123'
      })
    });
    const loginJson = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.equal(loginJson.success, true);
  });

  await t.test('9. RATE LIMITING: 5 attempts succeed, 6th attempt returns 429', async () => {
    resetPasswordLimiterStore();

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'rate_limit_test_user',
          newPassword: 'Short',
          confirmPassword: 'Short'
        })
      });
      assert.equal(res.status, 400, `Attempt ${i + 1} should not be rate limited`);
    }

    // 6th attempt must be 429
    const blockedRes = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'rate_limit_test_user',
        newPassword: 'Short',
        confirmPassword: 'Short'
      })
    });
    const blockedJson = await blockedRes.json();
    assert.equal(blockedRes.status, 429);
    assert.equal(blockedJson.success, false);
    assert.equal(blockedJson.message, 'Too many attempts. Please try again later.');
  });
});
