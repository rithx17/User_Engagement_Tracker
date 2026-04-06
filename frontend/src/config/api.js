function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (import.meta.env.DEV) {
    return '/api';
  }

  return '/api';
}

export const API_BASE_URL = resolveApiBaseUrl();
