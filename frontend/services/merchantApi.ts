import { Merchant } from '../types';
import { apiUrl } from './apiBase';

const baseUrl = apiUrl('/api/merchants');

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<Merchant[]>;
  },
  create: async (data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<Merchant> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Merchant>;
  },
  update: async (id: string, data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<Merchant> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Merchant>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
