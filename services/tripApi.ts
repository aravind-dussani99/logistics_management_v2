import { Trip } from '../types';

const baseUrl = '/api/trips';

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<Trip[]>;
  },
  create: async (data: Omit<Trip, 'id'>): Promise<Trip> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Trip>;
  },
  update: async (id: number, data: Partial<Trip>): Promise<Trip> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Trip>;
  },
  remove: async (id: number): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  requestDelete: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string }): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}/request-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
  requestUpdate: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string }): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}/request-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
};
