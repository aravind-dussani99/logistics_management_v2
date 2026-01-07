import { VehicleMaster } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/vehicle-masters';

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

export const vehicleMasterApi = {
  getAll: async (): Promise<VehicleMaster[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<VehicleMaster[]>;
  },
  create: async (data: Omit<VehicleMaster, 'id'>): Promise<VehicleMaster> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VehicleMaster>;
  },
  update: async (id: string, data: Omit<VehicleMaster, 'id'>): Promise<VehicleMaster> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VehicleMaster>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
