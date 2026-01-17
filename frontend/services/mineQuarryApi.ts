import { MineQuarryData } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/mine-quarries';

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
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<MineQuarryData[]>;
  },
  create: async (data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<MineQuarryData> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MineQuarryData>;
  },
  update: async (id: string, data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<MineQuarryData> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MineQuarryData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  merge: async (sourceId: string, targetId: string): Promise<void> => {
    const response = await authFetch('/api/merge/mine-quarries', {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId }),
    });
    await handleResponse(response);
  },
};
