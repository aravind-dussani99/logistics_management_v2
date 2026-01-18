import { TransportOwnerData } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/transport-owners';

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

export const transportOwnerApi = {
  getAll: async (): Promise<TransportOwnerData[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<TransportOwnerData[]>;
  },
  create: async (data: Omit<TransportOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<TransportOwnerData> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TransportOwnerData>;
  },
  update: async (id: string, data: Omit<TransportOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<TransportOwnerData> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TransportOwnerData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  merge: async (sourceId: string, targetId: string): Promise<void> => {
    const response = await authFetch('/api/merge/transport-owners', {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId }),
    });
    await handleResponse(response);
  },
};
