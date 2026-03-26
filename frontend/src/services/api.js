const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(`Network error: cannot reach API at ${API_BASE}. Check backend server and CORS.`);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (isJson && payload?.message) || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  getCsv: async (path) => {
    const token = getToken();
    let response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch {
      throw new Error(`Network error: cannot reach API at ${API_BASE}. Check backend server and CORS.`);
    }

    if (!response.ok) {
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const payload = isJson ? await response.json() : null;
      throw new Error(payload?.message || `Export failed (${response.status})`);
    }

    return response.blob();
  }
};
