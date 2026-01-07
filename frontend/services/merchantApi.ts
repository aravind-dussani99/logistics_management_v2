import { Merchant } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/merchants';

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

export const merchantApi = {
  getAll: async (): Promise<Merchant[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<Merchant[]>;
  },
  create: async (data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<Merchant> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Merchant>;
  },
  update: async (id: string, data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<Merchant> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Merchant>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
