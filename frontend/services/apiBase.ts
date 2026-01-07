type AppConfig = {
  apiBaseUrl?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

const normalizeBase = (base: string) => base.replace(/\/$/, '');

const getApiBase = () =>
  window.__APP_CONFIG__?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '';

export const apiUrl = (path: string) => {
  const base = getApiBase();
  if (!base) {
    return path;
  }
  if (path.startsWith('/')) {
    return `${normalizeBase(base)}${path}`;
  }
  return `${normalizeBase(base)}/${path}`;
};

export const getAuthToken = () => {
  try {
    return localStorage.getItem('authToken') || '';
  } catch {
    return '';
  }
};

export const authFetch = async (path: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), { ...options, headers });
};
