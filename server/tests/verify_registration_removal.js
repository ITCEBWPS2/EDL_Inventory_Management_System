const http = require('http');

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:5000/api' + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

(async () => {
  console.log('=== VERIFYING PUBLIC REGISTRATION REMOVAL & ROLE RESTRICTIONS ===\n');

  // 1. Direct hit to old public registration endpoint
  console.log('Test 1: Public POST /api/auth/register endpoint returns 403 Forbidden');
  const regRes = await request('/auth/register', 'POST', {
    first_name: 'Self',
    last_name: 'Registrant',
    username: 'selfreg',
    password: 'password123'
  });
  console.log(`Status: ${regRes.status} (Expected: 403)`);
  console.log(`Message: ${regRes.body.message}`);
  if (regRes.status !== 403) throw new Error('Registration should be blocked with 403!');

  // 2. Login as Unit Head & test User Management lockout
  console.log('\nTest 2: Non-admin (Unit Head) cannot access User Management');
  const headLogin = await request('/auth/login', 'POST', { username: 'headit@edl.lk', password: 'head123' });
  const headToken = headLogin.body.data?.token;
  const headGetUsers = await request('/users', 'GET', null, headToken);
  console.log(`GET /api/users as Unit Head -> Status: ${headGetUsers.status} (Expected: 403)`);
  const headPostUser = await request('/users', 'POST', {
    username: 'unauth_user',
    full_name: 'Unauthorized User',
    role: 'employee'
  }, headToken);
  console.log(`POST /api/users as Unit Head -> Status: ${headPostUser.status} (Expected: 403)`);
  if (headGetUsers.status !== 403 || headPostUser.status !== 403) throw new Error('Unit Head must be blocked from User Management!');

  // 3. Super Admin creates employee with 3 permission levels & non-employee with null
  console.log('\nTest 3: Super Admin creates users with valid permission levels');
  const sadminLogin = await request('/auth/login', 'POST', { username: 'sadmin@edl.lk', password: 'sadmin123' });
  const sadminToken = sadminLogin.body.data?.token;

  const perms = ['read_only', 'read_write', 'no_permission'];
  for (const p of perms) {
    const uname = `test_emp_${p}_${Date.now()}`;
    const res = await request('/users', 'POST', {
      username: uname,
      full_name: `Test Employee ${p}`,
      role: 'employee',
      permission_level: p,
      unit_ids: ['11111111-1111-1111-1111-111111111145'],
      password: 'password123'
    }, sadminToken);
    console.log(`Created employee with ${p} -> Status: ${res.status}, Assigned: ${res.body.data?.permission_level}`);
    if (res.status !== 201 || res.body.data?.permission_level !== p) {
      throw new Error(`Failed to create employee with permission ${p}`);
    }
  }

  // Non-employee (e.g. Unit Head) created by Super Admin -> permission_level must be null
  const uhUname = `test_uh_${Date.now()}`;
  const uhRes = await request('/users', 'POST', {
    username: uhUname,
    full_name: 'Test Unit Head',
    role: 'unit_head',
    permission_level: 'read_write', // caller might pass something, must be set to null
    unit_ids: ['11111111-1111-1111-1111-111111111145'],
    password: 'password123'
  }, sadminToken);
  console.log(`Created non-employee unit_head -> Status: ${uhRes.status}, Permission Level: ${uhRes.body.data?.permission_level} (Expected: null)`);
  if (uhRes.status !== 201 || uhRes.body.data?.permission_level !== null) {
    throw new Error('Non-employee roles must have permission_level = null');
  }

  // 4. Local Admin scope enforcement
  console.log('\nTest 4: Local Admin scope enforcement');
  const ladminLogin = await request('/auth/login', 'POST', { username: 'ladmin@edl.lk', password: 'ladmin123' });
  const ladminToken = ladminLogin.body.data?.token;

  // Local Admin attempting to create Super Admin -> 403
  const ladminCreateSadmin = await request('/users', 'POST', {
    username: `illegal_sadmin_${Date.now()}`,
    full_name: 'Illegal Super Admin',
    role: 'super_admin',
    unit_ids: ['11111111-1111-1111-1111-111111111140']
  }, ladminToken);
  console.log(`Local Admin creating Super Admin -> Status: ${ladminCreateSadmin.status} (Expected: 403)`);
  if (ladminCreateSadmin.status !== 403) throw new Error('Local Admin must not create Super Admin!');

  // Local Admin attempting to assign user to out-of-scope unit (EDL-HQ: 11111111-1111-1111-1111-111111111001) -> 403
  const ladminOutScope = await request('/users', 'POST', {
    username: `out_of_scope_${Date.now()}`,
    full_name: 'Out of Scope User',
    role: 'employee',
    permission_level: 'read_write',
    unit_ids: ['11111111-1111-1111-1111-111111111001']
  }, ladminToken);
  console.log(`Local Admin assigning out-of-scope unit -> Status: ${ladminOutScope.status} (Expected: 403)`);
  if (ladminOutScope.status !== 403) throw new Error('Local Admin must be blocked from assigning out-of-scope units!');

  // Local Admin assigning in-scope unit (Homagama CSC: 11111111-1111-1111-1111-111111111145) -> 201
  const ladminInScope = await request('/users', 'POST', {
    username: `in_scope_${Date.now()}`,
    full_name: 'In Scope User',
    role: 'employee',
    permission_level: 'read_only',
    unit_ids: ['11111111-1111-1111-1111-111111111145'],
    password: 'password123'
  }, ladminToken);
  console.log(`Local Admin assigning in-scope unit -> Status: ${ladminInScope.status} (Expected: 201)`);
  if (ladminInScope.status !== 201) throw new Error('Local Admin should successfully create users in scope!');

  console.log('\nAll registration removal and role/permission/scoping checks passed successfully!');
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
