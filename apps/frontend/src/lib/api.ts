import { authStorage } from '@/lib/auth-storage';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Transaction,
} from '@expense-tracker/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `Request failed: ${res.status}`);
    throw new ApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}

async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authStorage.getToken();
  if (!token) throw new ApiError(401, 'Not authenticated');
  return request<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export const authApi = {
  register: (dto: RegisterRequest) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(dto) }),
  login: (dto: LoginRequest) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(dto) }),
};

export const transactionsApi = {
  getAll: () => authenticatedRequest<Transaction[]>('/transactions'),
};
