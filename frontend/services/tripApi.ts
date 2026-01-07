import { Trip } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/trips';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || 'Request failed';
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
};

export const tripApi = {
  getAll: async (): Promise<Trip[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<Trip[]>;
  },
  create: async (data: Omit<Trip, 'id'>): Promise<Trip> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Trip>;
  },
  update: async (id: number, data: Partial<Trip>): Promise<Trip> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Trip>;
  },
  remove: async (id: number): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  requestDelete: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string }): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}/request-delete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
  requestUpdate: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string }): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}/request-update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
};
