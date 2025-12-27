import { Notification } from '../types';

const baseUrl = '/api/notifications';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || 'Request failed';
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
};

export const notificationApi = {
  getAll: async (role?: string): Promise<Notification[]> => {
    const url = role ? `${baseUrl}?role=${encodeURIComponent(role)}` : baseUrl;
    const response = await fetch(url);
    return handleResponse(response) as Promise<Notification[]>;
  },
  getAllForUser: async (role: string, user: string): Promise<Notification[]> => {
    const url = `${baseUrl}?role=${encodeURIComponent(role)}&user=${encodeURIComponent(user)}`;
    const response = await fetch(url);
    return handleResponse(response) as Promise<Notification[]>;
  },
  getById: async (id: string): Promise<Notification> => {
    const response = await fetch(`${baseUrl}/${id}`);
    return handleResponse(response) as Promise<Notification>;
  },
  create: async (data: {
    message: string;
    type?: Notification['type'];
    targetRole?: string | null;
    targetUser?: string | null;
    tripId?: number | null;
    requestType?: Notification['requestType'];
    requesterName?: string | null;
    requesterRole?: string | null;
    requestMessage?: string | null;
  }): Promise<Notification> => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response) as Promise<Notification>;
  },
  markRead: async (id: string): Promise<Notification> => {
    const response = await fetch(`${baseUrl}/${id}/read`, { method: 'PUT' });
    return handleResponse(response) as Promise<Notification>;
  },
};
