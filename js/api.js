import { API_BASE_URL } from './config.js';

/**
 * The login token is ALSO kept here and sent as `Authorization: Bearer`. This is a fallback for
 * browsers that block cross-site cookies (the httpOnly cookie is still used whenever it works).
 * Customers and admins keep separate tokens.
 */
export const TOKEN_KEYS = { user: 'dz_token', admin: 'dz_admin_token' };
const area = () => (window.location.pathname.startsWith('/admin') ? 'admin' : 'user');
export const getToken = (a = area()) => localStorage.getItem(TOKEN_KEYS[a]);
export const setToken = (token, a = area()) => (token ? localStorage.setItem(TOKEN_KEYS[a], token) : localStorage.removeItem(TOKEN_KEYS[a]));

export class ApiError extends Error {
  constructor(message, status = 0, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Thin fetch wrapper: sends cookies, serialises JSON/FormData, unwraps { success, data }
 * and throws ApiError with a user-friendly message on failure.
 */
export async function api(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(API_BASE_URL + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, credentials: 'include', headers, signal };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Unable to reach the server. Check your connection and try again.');
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.message || 'Something went wrong. Please try again.', res.status, json?.errors);
  }
  return json?.data ?? {};
}

export const isAbort = (e) => e?.name === 'AbortError';
