import { MerchantType } from '../types';
import { apiUrl } from './apiBase';

const baseUrl = apiUrl('/api/merchant-types');

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

export const merchantTypeApi = {
  getAll: async (): Promise<MerchantType[]> => {
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<MerchantType[]>;
  },
  create: async (data: Omit<MerchantType, 'id'>): Promise<MerchantType> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MerchantType>;
  },
  update: async (id: string, data: Omit<MerchantType, 'id'>): Promise<MerchantType> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MerchantType>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
