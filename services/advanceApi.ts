import { Advance } from '../types';

const baseUrl = '/api/advances';

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<Advance[]>;
  },
  create: async (data: Omit<Advance, 'id'>): Promise<Advance> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Advance>;
  },
  update: async (id: string, data: Omit<Advance, 'id'>): Promise<Advance> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Advance>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  exportCsv: async (): Promise<Blob> => {
    const response = await fetch(`${baseUrl}/export`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error || 'Request failed';
      throw new Error(message);
    }
    return response.blob();
  },
};
