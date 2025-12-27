import { MineQuarryData } from '../types';

const baseUrl = '/api/mine-quarries';

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

export const mineQuarryApi = {
  getAll: async (): Promise<MineQuarryData[]> => {
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<MineQuarryData[]>;
  },
  create: async (data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<MineQuarryData> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MineQuarryData>;
  },
  update: async (id: string, data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<MineQuarryData> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MineQuarryData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
