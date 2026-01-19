import { MaterialRate, RatePartyType } from '../types';
import { authFetch } from './apiBase';

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

export type TripRateApplyPayload = {
  tripId: number;
  ratePartyType: RatePartyType;
  ratePerTon: number;
  applyScope?: 'trip' | 'range';
  effectiveFrom?: string;
  effectiveTo?: string;
};

export const tripRateApi = {
  apply: async (payload: TripRateApplyPayload): Promise<MaterialRate> => {
    const response = await authFetch('/api/trip-rates/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(response) as Promise<MaterialRate>;
  },
};
