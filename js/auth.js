import { api } from './api.js';

let user = null;
const HINT = 'dz_session_hint';
const emit = () => window.dispatchEvent(new CustomEvent('auth:change', { detail: { user } }));

/** Session state for customers. The httpOnly cookie is the source of truth; this mirrors it for the UI. */
export const Auth = {
  get user() { return user; },
  get isLoggedIn() { return Boolean(user); },
  /** True if the last visit ended logged-in (lets the navbar avoid a login/logout flash). */
  get hint() { return localStorage.getItem(HINT) === '1'; },

  async init() {
    try {
      const data = await api('/auth/me');
      user = data.user;
      localStorage.setItem(HINT, '1');
    } catch {
      user = null;
      localStorage.removeItem(HINT);
    }
    emit();
    return user;
  },

  async login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    user = data.user;
    localStorage.setItem(HINT, '1');
    emit();
    return user;
  },

  async register(payload) {
    const data = await api('/auth/register', { method: 'POST', body: payload });
    user = data.user;
    localStorage.setItem(HINT, '1');
    emit();
    return user;
  },

  async logout() {
    try { await api('/auth/logout', { method: 'POST' }); } finally {
      user = null;
      localStorage.removeItem(HINT);
      emit();
    }
  },

  setUser(u) { user = u; emit(); },
};

/** Redirects to the login page (remembering where to return) when no one is logged in. */
export function requireLogin() {
  if (Auth.user) return true;
  const next = window.location.pathname + window.location.search;
  window.location.replace(`/pages/login.html?next=${encodeURIComponent(next)}`);
  return false;
}

/** Reads ?next= and only allows same-site relative paths (prevents open redirects). */
export function safeNext(fallback = '/index.html') {
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : fallback;
}
