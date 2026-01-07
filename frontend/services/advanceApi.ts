import { Advance } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/advances';

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

export const advanceApi = {
  getAll: async (): Promise<Advance[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<Advance[]>;
  },
  create: async (data: Omit<Advance, 'id'>): Promise<Advance> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Advance>;
  },
  update: async (id: string, data: Omit<Advance, 'id'>): Promise<Advance> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Advance>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  exportCsv: async (): Promise<Blob> => {
    const response = await authFetch(`${basePath}/export`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error || 'Request failed';
      throw new Error(message);
    }
    return response.blob();
  },
};
