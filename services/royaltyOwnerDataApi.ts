import { RoyaltyOwnerData } from '../types';

const baseUrl = '/api/royalty-owners';

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<RoyaltyOwnerData[]>;
  },
  create: async (data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<RoyaltyOwnerData> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<RoyaltyOwnerData>;
  },
  update: async (id: string, data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<RoyaltyOwnerData> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<RoyaltyOwnerData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
