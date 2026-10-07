import { api } from './api.js';
import { mountLayout } from './layout.js';
import { Auth, safeNext } from './auth.js';
import { setBusy, toast } from './ui.js';
import { getParams } from './utils.js';
import { rules, validate, formAlert, applyServerErrors, bindPasswordToggles } from './forms.js';

const page = document.body.dataset.page;
const form = document.getElementById('authForm');
const f = form.elements;

const strength = () => {
  const el = document.getElementById('pwMeter');
  if (!el || !f.password) return;
  f.password.addEventListener('input', () => {
    const v = f.password.value;
    const score = [v.length >= 8, /[A-Z]/.test(v) && /[a-z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v) || v.length >= 12].filter(Boolean).length;
    el.dataset.score = v ? score : 0;
    el.querySelector('span').textContent = v ? ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][score] : '';
  });
};

const handlers = {
  async login() {
    if (!validate(form, [{ input: f.email, check: () => rules.email(f.email.value) }, { input: f.password, check: () => rules.required(f.password.value, 'Password') }])) return;
    await Auth.login(f.email.value.trim(), f.password.value);
    await import('./cart.js').then(({ Cart }) => Cart.sync());
    toast('Welcome back!', 'success');
    window.location.href = safeNext();
  },
  async signup() {
    if (!validate(form, [
      { input: f.name, check: () => (f.name.value.trim().length < 2 ? 'Enter your full name' : '') },
      { input: f.email, check: () => rules.email(f.email.value) },
      { input: f.password, check: () => rules.password(f.password.value) },
      { input: f.confirmPassword, check: () => rules.match(f.confirmPassword.value, f.password.value) },
    ])) return;
    await Auth.register({ name: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value, confirmPassword: f.confirmPassword.value });
    await import('./cart.js').then(({ Cart }) => Cart.sync());
    toast('Account created. Welcome to Darazify!', 'success');
    window.location.href = safeNext();
  },
  async forgot() {
    if (!validate(form, [{ input: f.email, check: () => rules.email(f.email.value) }])) return;
    await api('/auth/forgot-password', { method: 'POST', body: { email: f.email.value.trim() } });
    form.hidden = true;
    document.getElementById('sentBox').hidden = false;
    document.getElementById('sentEmail').textContent = f.email.value.trim();
  },
  async reset() {
    const token = getParams().get('token');
    if (!token) { formAlert(form, 'This reset link is missing its token. Request a new one.'); return; }
    if (!validate(form, [
      { input: f.password, check: () => rules.password(f.password.value) },
      { input: f.confirmPassword, check: () => rules.match(f.confirmPassword.value, f.password.value) },
    ])) return;
    await api('/auth/reset-password', { method: 'POST', body: { token, password: f.password.value, confirmPassword: f.confirmPassword.value } });
    form.hidden = true;
    document.getElementById('doneBox').hidden = false;
    setTimeout(() => { window.location.href = '/pages/login.html'; }, 3000);
  },
};

(async () => {
  await mountLayout();
  if (Auth.user && (page === 'login' || page === 'signup')) { window.location.replace(safeNext()); return; }
  bindPasswordToggles(form);
  strength();

  // Keep ?next= when switching between login and signup
  const next = getParams().get('next');
  if (next) document.querySelectorAll('[data-keep-next]').forEach((a) => { a.href += `?next=${encodeURIComponent(next)}`; });

  if (page === 'reset' && !getParams().get('token')) formAlert(form, 'This reset link is invalid. Request a new one from the forgot-password page.');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    setBusy(btn, true, 'Please wait…');
    try { await handlers[page](); } catch (err) {
      if (!applyServerErrors(form, err)) formAlert(form, err.message);
    } finally { if (!btn.isConnected || !form.hidden) setBusy(btn, false); }
  });
})();
