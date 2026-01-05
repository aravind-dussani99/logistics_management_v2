import { MaterialRate } from '../types';
import { apiUrl } from './apiBase';

const baseUrl = apiUrl('/api/material-rates');

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

export const materialRateApi = {
  getAll: async (): Promise<MaterialRate[]> => {
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<MaterialRate[]>;
  },
  create: async (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>): Promise<MaterialRate> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MaterialRate>;
  },
  update: async (id: string, data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>): Promise<MaterialRate> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MaterialRate>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
