import { SiteLocation } from '../types';

const baseUrl = '/api/site-locations';

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<SiteLocation[]>;
  },
  create: async (site: Omit<SiteLocation, 'id'>): Promise<SiteLocation> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(site),
    });
    return handleResponse(response) as Promise<SiteLocation>;
  },
  update: async (id: string, site: Omit<SiteLocation, 'id'>): Promise<SiteLocation> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(site),
    });
    return handleResponse(response) as Promise<SiteLocation>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
