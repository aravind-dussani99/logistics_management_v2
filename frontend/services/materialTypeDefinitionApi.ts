import { MaterialTypeDefinition } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/material-types';

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

export const materialTypeDefinitionApi = {
  getAll: async (): Promise<MaterialTypeDefinition[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<MaterialTypeDefinition[]>;
  },
  create: async (data: Omit<MaterialTypeDefinition, 'id'>): Promise<MaterialTypeDefinition> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MaterialTypeDefinition>;
  },
  update: async (id: string, data: Omit<MaterialTypeDefinition, 'id'>): Promise<MaterialTypeDefinition> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<MaterialTypeDefinition>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  merge: async (sourceId: string, targetId: string): Promise<void> => {
    const response = await authFetch('/api/merge/material-types', {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId }),
    });
    await handleResponse(response);
  },
};
