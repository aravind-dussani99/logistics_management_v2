import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

type AppConfig = {
  apiBaseUrl?: string;
};

const loadConfig = async () => {
  try {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const config = (await response.json()) as AppConfig;
    window.__APP_CONFIG__ = config;
  } catch (error) {
    console.warn('Failed to load runtime config', error);
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

loadConfig().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
