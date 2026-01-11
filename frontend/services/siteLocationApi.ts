import { SiteLocation } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/site-locations';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || 'Request failed';
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
};

export const siteLocationApi = {
  getAll: async (): Promise<SiteLocation[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<SiteLocation[]>;
  },
  create: async (site: Omit<SiteLocation, 'id'>): Promise<SiteLocation> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(site),
    });
    return handleResponse(response) as Promise<SiteLocation>;
  },
  update: async (id: string, site: Omit<SiteLocation, 'id'>): Promise<SiteLocation> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(site),
    });
    return handleResponse(response) as Promise<SiteLocation>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
