import { TransportOwnerVehicle } from '../types';

const baseUrl = '/api/transport-owner-vehicles';

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<TransportOwnerVehicle[]>;
  },
  create: async (data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>): Promise<TransportOwnerVehicle> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TransportOwnerVehicle>;
  },
  update: async (id: string, data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>): Promise<TransportOwnerVehicle> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TransportOwnerVehicle>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
