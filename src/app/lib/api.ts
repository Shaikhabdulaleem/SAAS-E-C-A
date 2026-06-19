const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api';

interface ApiEnvelope<T> {
  data: T | null;
  meta: Record<string, unknown>;
  error: { code: string; message: string; fields?: Record<string, string> } | null;
}

const ACCESS_TOKEN_KEY = 'nexushq_access_token';
const REFRESH_TOKEN_KEY = 'nexushq_refresh_token';
const SELECTED_TENANT_KEY = 'nexushq_selected_tenant_id';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getSelectedTenantId() {
  return localStorage.getItem(SELECTED_TENANT_KEY);
}

export function setSelectedTenantId(tenantId: string | null) {
  if (tenantId) {
    localStorage.setItem(SELECTED_TENANT_KEY, tenantId);
  } else {
    localStorage.removeItem(SELECTED_TENANT_KEY);
  }
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const payload = (await response.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
  if (!response.ok || payload.error || !payload.data) return false;

  setAuthTokens(payload.data.accessToken, payload.data.refreshToken);
  return true;
}

async function rawApiRequest<T>(path: string, options: RequestInit = {}): Promise<{ response: Response; payload: ApiEnvelope<T> }> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const selectedTenantId = getSelectedTenantId();
  if (selectedTenantId) headers.set('X-Tenant-Id', selectedTenantId);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = (await response.json().catch(() => ({ data: null, meta: {}, error: null }))) as ApiEnvelope<T>;

  return { response, payload };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let { response, payload } = await rawApiRequest<T>(path, options);

  if (response.status === 401 && await refreshAccessToken()) {
    ({ response, payload } = await rawApiRequest<T>(path, options));
  }

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? 'API request failed');
  }

  return payload.data as T;
}
