import { AccountType } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/account-types';

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
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<AccountType[]>;
  },
  create: async (data: Omit<AccountType, 'id'>): Promise<AccountType> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<AccountType>;
  },
  update: async (id: string, data: Omit<AccountType, 'id'>): Promise<AccountType> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<AccountType>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
