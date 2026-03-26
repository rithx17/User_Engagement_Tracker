const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:5050/api';

function createHeaders(token, includeJson = true) {
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, options = {}) {
  const response = await globalThis.fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { status: response.status, body, contentType };
}

async function main() {
  const health = await request('/health');
  if (health.status !== 200) {
    throw new Error(`Health check failed: ${health.status}`);
  }

  const registerEmail = `smoke-${Date.now()}@example.com`;
  const register = await request('/auth/register', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      name: 'Smoke Tester',
      email: registerEmail,
      password: 'password123'
    })
  });
  if (register.status !== 201) {
    throw new Error(`Register failed: ${register.status}`);
  }

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'password123'
    })
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.status}`);
  }

  const userLogin = await request('/auth/login', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      email: registerEmail,
      password: 'password123'
    })
  });
  if (userLogin.status !== 200) {
    throw new Error(`User login failed: ${userLogin.status}`);
  }

  const track = await request('/events/track', {
    method: 'POST',
    headers: createHeaders(userLogin.body.token),
    body: JSON.stringify({
      eventType: 'page_visit',
      sessionId: `smoke-${Date.now()}`,
      page: '/dashboard',
      durationMs: 1250,
      activeMs: 1000,
      idleMs: 250,
      scrollDepth: 42
    })
  });
  if (track.status !== 201) {
    throw new Error(`Track event failed: ${track.status}`);
  }

  const overview = await request('/analytics/overview', {
    headers: createHeaders(adminLogin.body.token)
  });
  if (overview.status !== 200) {
    throw new Error(`Overview failed: ${overview.status}`);
  }

  const adminUsers = await request('/admin/users', {
    headers: createHeaders(adminLogin.body.token)
  });
  if (adminUsers.status !== 200) {
    throw new Error(`Admin users failed: ${adminUsers.status}`);
  }

  const forbiddenDemoSeed = await request('/analytics/generate-demo-data', {
    method: 'POST',
    headers: createHeaders(userLogin.body.token),
    body: JSON.stringify({})
  });
  if (forbiddenDemoSeed.status !== 403) {
    throw new Error(`Expected user demo seed to be forbidden, got ${forbiddenDemoSeed.status}`);
  }

  const exportCsv = await request('/analytics/export', {
    headers: createHeaders(adminLogin.body.token, false)
  });
  if (exportCsv.status !== 200 || !String(exportCsv.body).includes('occurredAt,userId,sessionId')) {
    throw new Error(`CSV export failed: ${exportCsv.status}`);
  }

  console.log(
    JSON.stringify(
      {
        apiBase: API_BASE,
        checks: {
          health: health.status,
          register: register.status,
          adminLogin: adminLogin.status,
          userLogin: userLogin.status,
          track: track.status,
          overview: overview.status,
          adminUsers: adminUsers.status,
          forbiddenDemoSeed: forbiddenDemoSeed.status,
          exportCsv: exportCsv.status
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
