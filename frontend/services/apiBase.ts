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
