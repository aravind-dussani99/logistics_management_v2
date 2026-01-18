import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { apiUrl } from '../services/apiBase';

const ConfigManager: React.FC = () => {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('');

  const loadConfig = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/config.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load config.json');
      }
      const data = await response.json();
      setApiBaseUrl(data.apiBaseUrl || '');
      setStatus('idle');
    } catch (error) {
      console.warn('Failed to load runtime config', error);
      setStatus('error');
      setMessage('Could not load config.json from the frontend bucket.');
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!apiBaseUrl.trim()) {
      setStatus('error');
      setMessage('API Base URL is required.');
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      const response = await fetch(apiUrl('/api/admin/config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiBaseUrl: apiBaseUrl.trim() }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to update config.json');
      }
      setStatus('success');
      setMessage('Config saved to GCS. Refresh the UI to see changes.');
    } catch (error) {
      console.error('Failed to save config', error);
      setStatus('error');
      setMessage('Failed to update config.json via backend.');
    }
  };

  return (
    <div className="relative">
      <PageHeader
        title="Runtime Configuration"
        subtitle="Update frontend runtime config stored in GCS."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={undefined}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">API Base URL</label>
            <input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="https://api.example.com"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              This value is stored in <span className="font-semibold">config.json</span> in the frontend GCS bucket.
            </p>
          </div>

          {status !== 'idle' && message && (
            <div
              className={`rounded-md px-4 py-3 text-sm ${
                status === 'success'
                  ? 'bg-green-100 text-green-700'
                  : status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={status === 'saving'}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {status === 'saving' ? 'Saving...' : 'Save to GCS'}
            </button>
            <button
              type="button"
              onClick={loadConfig}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Reload from GCS
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConfigManager;
