import { Trip } from '../types';
import { authFetch } from './apiBase';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || 'Request failed';
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
};

export const billsApi = {
  apply: async (payload: { tripId: number; actualVendorCustomerName: string; vendorCustomerRatePerTon: number }): Promise<Trip> => {
    const response = await authFetch('/api/bills/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(response) as Promise<Trip>;
  },
};
