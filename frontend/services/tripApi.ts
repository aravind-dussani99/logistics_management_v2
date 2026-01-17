import { Trip, TripActivity } from '../types';
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
  createAtomic: async (data: Omit<Trip, 'id'>, createMasters?: {
    vendorCustomer?: boolean;
    mineQuarry?: boolean;
    royaltyOwner?: boolean;
    transportOwner?: boolean;
    vehicleMaster?: boolean;
    materialType?: boolean;
    pickupPlace?: boolean;
    dropOffPlace?: boolean;
  }): Promise<Trip> => {
    const response = await authFetch(`${basePath}/atomic`, {
      method: 'POST',
      body: JSON.stringify({ trip: data, createMasters }),
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
  getActivity: async (id: number): Promise<TripActivity[]> => {
    const response = await authFetch(`${basePath}/${id}/activity`);
    return handleResponse(response) as Promise<TripActivity[]>;
  },
  createActivity: async (id: number, data: { message?: string; action?: string; attachments?: { name: string; url: string }[]; notifyRole?: string | null; notifyUser?: string | null }): Promise<TripActivity> => {
    const response = await authFetch(`${basePath}/${id}/activity`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<TripActivity>;
  },
  remove: async (id: number): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  requestDelete: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string; requestedByContact?: string }): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}/request-delete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
  requestUpdate: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string; requestedByContact?: string }): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}/request-update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
  raiseIssue: async (id: number, data: { requestedBy: string; reason?: string; requestedByRole?: string; requestedByContact?: string }): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}/raise-issue`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await handleResponse(response);
  },
};
