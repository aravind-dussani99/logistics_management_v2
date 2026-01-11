import { TransportOwnerVehicle } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/transport-owner-vehicles';

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

export const transportOwnerVehicleApi = {
  getAll: async (): Promise<TransportOwnerVehicle[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<TransportOwnerVehicle[]>;
  },
  create: async (data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>): Promise<TransportOwnerVehicle> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TransportOwnerVehicle>;
  },
  update: async (id: string, data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>): Promise<TransportOwnerVehicle> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TransportOwnerVehicle>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
