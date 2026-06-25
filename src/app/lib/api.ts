const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api';

interface ApiEnvelope<T> {
  data: T | null;
  meta: Record<string, unknown>;
  error: { code: string; message: string; fields?: Record<string, string> } | null;
}

const ACCESS_TOKEN_KEY = 'nexushq_access_token';
const REFRESH_TOKEN_KEY = 'nexushq_refresh_token';
const SELECTED_TENANT_KEY = 'nexushq_selected_tenant_id';
const ADMIN_IMPERSONATION_KEY = 'nexushq_admin_impersonation';

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

export function isAdminImpersonating() {
  return localStorage.getItem(ADMIN_IMPERSONATION_KEY) === 'true';
}

export function setSelectedTenantId(tenantId: string | null) {
  if (tenantId) {
    localStorage.setItem(SELECTED_TENANT_KEY, tenantId);
  } else {
    localStorage.removeItem(SELECTED_TENANT_KEY);
  }
}

export function setAdminImpersonation(tenantId: string | null) {
  setSelectedTenantId(tenantId);
  if (tenantId) {
    localStorage.setItem(ADMIN_IMPERSONATION_KEY, 'true');
  } else {
    localStorage.removeItem(ADMIN_IMPERSONATION_KEY);
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
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const selectedTenantId = getSelectedTenantId();
  if (selectedTenantId && isAdminImpersonating()) {
    headers.set('X-Tenant-Id', selectedTenantId);
    headers.set('X-Admin-Impersonation', 'true');
  }

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

export async function downloadPdfBlob(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const selectedTenantId = getSelectedTenantId();
  if (selectedTenantId && isAdminImpersonating()) {
    headers['X-Tenant-Id'] = selectedTenantId;
    headers['X-Admin-Impersonation'] = 'true';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) throw new Error('Failed to download PDF');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
