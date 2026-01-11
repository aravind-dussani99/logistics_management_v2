import { authFetch } from './apiBase';
import { Payment } from '../types';

const basePath = '/api/payments';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || 'Request failed';
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
};

export const paymentApi = {
  getAll: async (): Promise<Payment[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<Payment[]>;
  },
  create: async (data: Omit<Payment, 'id'>): Promise<Payment> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Payment>;
  },
  update: async (id: string, data: Omit<Payment, 'id'>): Promise<Payment> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Payment>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
