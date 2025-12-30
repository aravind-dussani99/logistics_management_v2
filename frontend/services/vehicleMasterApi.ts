import { VehicleMaster } from '../types';
import { apiUrl } from './apiBase';

const baseUrl = apiUrl('/api/vehicle-masters');

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<VehicleMaster[]>;
  },
  create: async (data: Omit<VehicleMaster, 'id'>): Promise<VehicleMaster> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VehicleMaster>;
  },
  update: async (id: string, data: Omit<VehicleMaster, 'id'>): Promise<VehicleMaster> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VehicleMaster>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
