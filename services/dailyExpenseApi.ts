import { DailyExpense } from '../types';

const baseUrl = '/api/daily-expenses';

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
    const response = await fetch(`${baseUrl}?supervisor=${encodeURIComponent(supervisorName)}`);
    return handleResponse(response) as Promise<{ expenses: DailyExpense[]; openingBalance: number }>;
  },
  getAll: async (): Promise<DailyExpense[]> => {
    const response = await fetch(`${baseUrl}/all`);
    return handleResponse(response) as Promise<DailyExpense[]>;
  },
  create: async (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>): Promise<DailyExpense> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<DailyExpense>;
  },
  update: async (id: string, data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>): Promise<DailyExpense> => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<DailyExpense>;
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
    await handleResponse(response);
  },
  exportCsv: async (supervisorName?: string): Promise<Blob> => {
    const url = supervisorName ? `${baseUrl}/export?supervisor=${encodeURIComponent(supervisorName)}` : `${baseUrl}/export`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error || 'Request failed';
      throw new Error(message);
    }
    return response.blob();
  },
};
