import { apiUrl, authFetch } from './apiBase';
import { User } from '../types';

type LoginResponse = {
  token: string;
  user: User;
};

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || 'Login failed');
    }
    return response.json();
  },
  me: async (): Promise<User> => {
    const response = await authFetch('/api/auth/me');
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || 'Failed to load user');
    }
    const payload = await response.json();
    return payload.user;
  },
};
