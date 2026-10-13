const http = require('http');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');

let server;
let baseUrl = 'http://localhost:5000/api';

const login = (username, password) => {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ username, password }));
    req.end();
  });
};

const accounts = [
  { username: 'sadmin@edl.lk', password: 'sadmin123', expectedRole: 'super_admin' },
  { username: 'ladmin@edl.lk', password: 'ladmin123', expectedRole: 'local_admin' },
  { username: 'headit@edl.lk', password: 'head123', expectedRole: 'unit_head' },
  { username: 'emp.rw@edl.lk', password: 'emprw123', expectedRole: 'employee' },
  { username: 'emp.ro@edl.lk', password: 'empro123', expectedRole: 'employee' },
  { username: 'emp.none@edl.lk', password: 'empnone123', expectedRole: 'employee' },
];

(async () => {
  await setupTestDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  console.log('--- Testing All 6 Seeded Accounts with Simple Passwords ---');
  let allPassed = true;
  for (const acc of accounts) {
    const res = await login(acc.username, acc.password);
    const pass = res.status === 200 && res.body.data?.user?.role === acc.expectedRole;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${acc.username} (${acc.password}) -> Status: ${res.status}, Role: ${res.body.data?.user?.role || 'N/A'}`);
    if (!pass) allPassed = false;
  }

  console.log('\n--- Testing Bad Password (Should be 401) ---');
  const badRes = await login('sadmin@edl.lk', 'wrongpass999');
  console.log(`[${badRes.status === 401 ? 'PASS' : 'FAIL'}] sadmin@edl.lk (wrongpass999) -> Status: ${badRes.status} (${badRes.body.message})`);

  if (server) server.close();
  await teardownTestDb();

  if (allPassed && badRes.status === 401) {
    console.log('\nAll simple password authentications verified successfully!');
  } else {
    console.error('\nSome checks failed!');
    process.exit(1);
  }
})();
