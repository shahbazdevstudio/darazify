import { api } from '../api.js';
import { initTheme, setBusy } from '../ui.js';
import { rules, validate, formAlert, applyServerErrors, bindPasswordToggles } from '../forms.js';
import { icon } from '../icons.js';

initTheme();
const form = document.getElementById('admLogin');
const f = form.elements;
bindPasswordToggles(form);
document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = icon(el.dataset.i, Number(el.dataset.s) || 20); });

// Already signed in? Go straight to the dashboard.
api('/auth/admin/me').then(() => window.location.replace('/admin/index.html')).catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate(form, [{ input: f.email, check: () => rules.email(f.email.value) }, { input: f.password, check: () => rules.required(f.password.value, 'Password') }])) return;
  const btn = form.querySelector('[type="submit"]');
  setBusy(btn, true, 'Signing in…');
  try {
    await api('/auth/admin/login', { method: 'POST', body: { email: f.email.value.trim(), password: f.password.value } });
    window.location.href = '/admin/index.html';
  } catch (err) {
    setBusy(btn, false);
    if (!applyServerErrors(form, err)) formAlert(form, err.message);
  }
});
