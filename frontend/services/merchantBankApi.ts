import { MerchantBankAccount } from '../types';
import { apiUrl } from './apiBase';

const baseUrl = apiUrl('/api/merchant-bank-accounts');

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<MerchantBankAccount[]>;
  },
  create: async (data: Omit<MerchantBankAccount, 'id' | 'merchantName'>): Promise<MerchantBankAccount> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MerchantBankAccount>;
  },
  update: async (id: string, data: Omit<MerchantBankAccount, 'id' | 'merchantName'>): Promise<MerchantBankAccount> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MerchantBankAccount>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
