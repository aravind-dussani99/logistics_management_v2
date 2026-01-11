import { DailyExpense } from '../types';
import { authFetch } from './apiBase';

const basePath = '/api/daily-expenses';

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

export const dailyExpenseApi = {
  getBySupervisor: async (supervisorName: string): Promise<{ expenses: DailyExpense[]; openingBalance: number }> => {
    const response = await authFetch(`${basePath}?supervisor=${encodeURIComponent(supervisorName)}`);
    return handleResponse(response) as Promise<{ expenses: DailyExpense[]; openingBalance: number }>;
  },
  getAll: async (): Promise<DailyExpense[]> => {
    const response = await authFetch(`${basePath}/all`);
    return handleResponse(response) as Promise<DailyExpense[]>;
  },
  create: async (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>): Promise<DailyExpense> => {
    const response = await authFetch(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<DailyExpense>;
  },
  update: async (id: string, data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>): Promise<DailyExpense> => {
    const response = await authFetch(`${basePath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<DailyExpense>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await authFetch(`${basePath}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  exportCsv: async (supervisorName?: string): Promise<Blob> => {
    const url = supervisorName ? `${basePath}/export?supervisor=${encodeURIComponent(supervisorName)}` : `${basePath}/export`;
    const response = await authFetch(url);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error || 'Request failed';
      throw new Error(message);
    }
    return response.blob();
  },
};
