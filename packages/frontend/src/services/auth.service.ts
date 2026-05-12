import { api } from '@/lib/api';
import type { AuthUser } from '@/contexts/AuthContext';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { email: string; name: string; password: string; }
export interface AuthResponse { user: AuthUser; token: string; }

export const authService = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload),
};
