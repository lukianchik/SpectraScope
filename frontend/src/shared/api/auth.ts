import { fetchJson } from './client';

export interface SessionUser {
        username: string;
        role: string;
        authentication_required: boolean;
}

export const getSession = () => fetchJson<SessionUser>('/api/auth/me');

export const login = (username: string, password: string) =>
        fetchJson<SessionUser>('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
        });

export const logout = () => fetchJson<void>('/api/auth/logout', { method: 'POST' });
