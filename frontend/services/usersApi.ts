import { authFetch } from './apiBase';
import { User } from '../types';

export const usersApi = {
  listUsers: async (role?: string): Promise<User[]> => {
    const qs = role ? `?role=${encodeURIComponent(role)}` : '';
    const response = await authFetch(`/api/users${qs}`);
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },
  createUser: async (data: Partial<User> & { password?: string }): Promise<User> => {
    const response = await authFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || 'Failed to create user');
    }
    return response.json();
  },
  updateUser: async (id: string, data: Partial<User> & { password?: string }): Promise<User> => {
    const response = await authFetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || 'Failed to update user');
    }
    return response.json();
  },
};
