import { VendorCustomerData } from '../types';

const baseUrl = '/api/vendor-customers';

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
    const response = await fetch(baseUrl);
    return handleResponse(response) as Promise<VendorCustomerData[]>;
  },
  create: async (data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<VendorCustomerData> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VendorCustomerData>;
  },
  update: async (id: string, data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>): Promise<VendorCustomerData> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<VendorCustomerData>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
};
