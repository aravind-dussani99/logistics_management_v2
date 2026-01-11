import { MerchantBankAccount } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/merchant-bank-accounts';

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

export const merchantBankApi = {
  getAll: async (): Promise<MerchantBankAccount[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<MerchantBankAccount[]>;
  },
  create: async (data: Omit<MerchantBankAccount, 'id' | 'merchantName'>): Promise<MerchantBankAccount> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MerchantBankAccount>;
  },
  update: async (id: string, data: Omit<MerchantBankAccount, 'id' | 'merchantName'>): Promise<MerchantBankAccount> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MerchantBankAccount>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
