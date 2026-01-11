import { MaterialRate } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/material-rates';

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
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<MaterialRate[]>;
  },
  create: async (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>): Promise<MaterialRate> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MaterialRate>;
  },
  update: async (id: string, data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>): Promise<MaterialRate> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MaterialRate>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
