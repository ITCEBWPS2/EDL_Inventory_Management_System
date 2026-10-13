const http = require('http');
const app = require('../src/server');
const { setupTestDb, teardownTestDb } = require('./testHelper');

let server;
let baseUrl = 'http://localhost:5000';

const request = (path, method, body, token) => {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(`${baseUrl}${path}`, {
      method,
      headers
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

(async () => {
  await setupTestDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  console.log('=== VERIFYING SINGLE-UNIT ENFORCEMENT & STRUCTURAL AREA RESTRICTIONS ===\n');

  // 1. Login as Super Admin
  const loginRes = await request('/api/auth/login', 'POST', {
    username: 'sadmin@edl.lk',
    password: 'sadmin123'
  });
  if (loginRes.status !== 200 || !loginRes.body.data?.token) {
    console.error('Failed to log in as sadmin:', loginRes);
    process.exit(1);
  }
  const token = loginRes.body.data.token;
  console.log('[PASS] Logged in as Super Admin.');

  // Unit IDs from seed:
  const WPS2_AREA_ID = '11111111-1111-1111-1111-111111111003'; // Branch / Area
  const HORANA_AREA_ID = '11111111-1111-1111-1111-111111111140'; // Branch / Area
  const CSC_HOKANDARA_ID = '11111111-1111-1111-1111-111111111144'; // Leaf CSC
  const CSC_HOMAGAMA_ID = '11111111-1111-1111-1111-111111111145'; // Leaf CSC

  const rand = Date.now().toString().slice(-5);

  // 2. Reject multi-unit assignment
  console.log('\n--- Test 1: Reject multi-unit array ---');
  const multiRes = await request('/api/users', 'POST', {
    username: `multi_user_${rand}`,
    full_name: 'Multi Test',
    role: 'employee',
    permission_level: 'read_write',
    password: 'Password123!',
    unit_ids: [CSC_HOKANDARA_ID, CSC_HOMAGAMA_ID]
  }, token);
  console.log(`Status: ${multiRes.status}, Message: ${multiRes.body?.message}`);
  if (multiRes.status === 400 && multiRes.body?.message?.includes('exactly one unit')) {
    console.log('[PASS] Multi-unit assignment rejected with 400.');
  } else {
    console.error('[FAIL] Multi-unit assignment was not rejected properly!');
    process.exit(1);
  }

  // 3. Reject empty unit assignment
  console.log('\n--- Test 2: Reject empty unit ---');
  const emptyRes = await request('/api/users', 'POST', {
    username: `empty_user_${rand}`,
    full_name: 'Empty Test',
    role: 'employee',
    permission_level: 'read_write',
    password: 'Password123!',
    unit_id: ''
  }, token);
  console.log(`Status: ${emptyRes.status}, Message: ${emptyRes.body?.message}`);
  if (emptyRes.status === 400 && emptyRes.body?.message?.includes('exactly one unit')) {
    console.log('[PASS] Empty unit assignment rejected with 400.');
  } else {
    console.error('[FAIL] Empty unit assignment was not rejected properly!');
    process.exit(1);
  }

  // 4. Reject structural area branch (WPS-II)
  console.log('\n--- Test 3: Reject structural branch node (WPS-II area) ---');
  const branchRes1 = await request('/api/users', 'POST', {
    username: `branch_user1_${rand}`,
    full_name: 'Branch Test WPS2',
    role: 'employee',
    permission_level: 'read_write',
    password: 'Password123!',
    unit_id: WPS2_AREA_ID
  }, token);
  console.log(`Status: ${branchRes1.status}, Message: ${branchRes1.body?.message}`);
  if (branchRes1.status === 400 && branchRes1.body?.message?.includes('structural only')) {
    console.log('[PASS] Structural branch WPS-II rejected with 400.');
  } else {
    console.error('[FAIL] Structural branch was not rejected properly!');
    process.exit(1);
  }

  // 5. Reject structural area branch (AREA HORANA)
  console.log('\n--- Test 4: Reject structural branch node (AREA HORANA area) ---');
  const branchRes2 = await request('/api/users', 'POST', {
    username: `branch_user2_${rand}`,
    full_name: 'Branch Test Horana',
    role: 'employee',
    permission_level: 'read_write',
    password: 'Password123!',
    unit_id: HORANA_AREA_ID
  }, token);
  console.log(`Status: ${branchRes2.status}, Message: ${branchRes2.body?.message}`);
  if (branchRes2.status === 400 && branchRes2.body?.message?.includes('structural only')) {
    console.log('[PASS] Structural branch AREA HORANA rejected with 400.');
  } else {
    console.error('[FAIL] Structural branch was not rejected properly!');
    process.exit(1);
  }

  // 6. Successfully create user with valid leaf unit (CSC_HOKANDARA)
  console.log('\n--- Test 5: Allow valid operational leaf unit (CSC_HOKANDARA) ---');
  const validUsername = `leaf_user_${rand}`;
  const validRes = await request('/api/users', 'POST', {
    username: validUsername,
    full_name: 'Leaf Unit User',
    role: 'employee',
    permission_level: 'read_write',
    password: 'Password123!',
    unit_id: CSC_HOKANDARA_ID
  }, token);
  console.log(`Status: ${validRes.status}, Message: ${validRes.body?.message}`);
  if (validRes.status === 201 && validRes.body.data?.units?.length === 1 && validRes.body.data.units[0].id === CSC_HOKANDARA_ID) {
    console.log('[PASS] User successfully created with exactly ONE leaf unit.');
  } else {
    console.error('[FAIL] User creation failed!', validRes);
    process.exit(1);
  }

  const createdUserId = validRes.body.data.id;

  // 7. Update user to another valid leaf unit (CSC_HOMAGAMA)
  console.log('\n--- Test 6: Update user unit assignment (replace with CSC_HOMAGAMA) ---');
  const updateRes = await request(`/api/users/${createdUserId}`, 'PUT', {
    unit_id: CSC_HOMAGAMA_ID
  }, token);
  console.log(`Status: ${updateRes.status}, Message: ${updateRes.body?.message}`);
  if (updateRes.status === 200 && updateRes.body.data?.units?.length === 1 && updateRes.body.data.units[0].id === CSC_HOMAGAMA_ID) {
    console.log('[PASS] User unit replaced with exactly one new unit (CSC_HOMAGAMA).');
  } else {
    console.error('[FAIL] User update failed!', updateRes);
    process.exit(1);
  }

  // 8. Reject update with structural branch
  console.log('\n--- Test 7: Reject updating user to structural area branch ---');
  const badUpdateRes = await request(`/api/users/${createdUserId}`, 'PUT', {
    unit_id: WPS2_AREA_ID
  }, token);
  console.log(`Status: ${badUpdateRes.status}, Message: ${badUpdateRes.body?.message}`);
  if (badUpdateRes.status === 400 && badUpdateRes.body?.message?.includes('structural only')) {
    console.log('[PASS] Updating to structural branch rejected with 400.');
  } else {
    console.error('[FAIL] Updating to structural branch was not rejected!');
    process.exit(1);
  }

  console.log('\n ALL BACKEND ENFORCEMENT & STRUCTURAL BRANCH RESTRICTION TESTS PASSED!');
  if (server) server.close();
  await teardownTestDb();
  process.exit(0);
})();
