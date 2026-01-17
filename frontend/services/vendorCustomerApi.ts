import { VendorCustomerData } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/vendor-customers';

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

export const vendorCustomerApi = {
  getAll: async (): Promise<VendorCustomerData[]> => {
    const response = await authFetch(basePath);
    return handleResponse(response) as Promise<VendorCustomerData[]>;
  },
  create: async (data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<VendorCustomerData> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VendorCustomerData>;
  },
  update: async (id: string, data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<VendorCustomerData> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VendorCustomerData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  merge: async (sourceId: string, targetId: string): Promise<void> => {
    const response = await authFetch('/api/merge/vendor-customers', {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId }),
    });
    await handleResponse(response);
  },
};
