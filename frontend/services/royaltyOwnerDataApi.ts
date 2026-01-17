import { RoyaltyOwnerData } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/royalty-owners';

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

export const royaltyOwnerDataApi = {
  getAll: async (): Promise<RoyaltyOwnerData[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<RoyaltyOwnerData[]>;
  },
  create: async (data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<RoyaltyOwnerData> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<RoyaltyOwnerData>;
  },
  update: async (id: string, data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<RoyaltyOwnerData> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<RoyaltyOwnerData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  merge: async (sourceId: string, targetId: string): Promise<void> => {
    const response = await authFetch('/api/merge/royalty-owners', {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId }),
    });
    await handleResponse(response);
  },
};
