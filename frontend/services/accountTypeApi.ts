import { AccountType } from '../types';
import { apiUrl } from './apiBase';

const baseUrl = apiUrl('/api/account-types');

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

export const accountTypeApi = {
  getAll: async (): Promise<AccountType[]> => {
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<AccountType[]>;
  },
  create: async (data: Omit<AccountType, 'id'>): Promise<AccountType> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<AccountType>;
  },
  update: async (id: string, data: Omit<AccountType, 'id'>): Promise<AccountType> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<AccountType>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
