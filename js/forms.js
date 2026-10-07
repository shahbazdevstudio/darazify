import { icon } from './icons.js';

/** Inline field errors + password toggles shared by every form. */
export const setFieldError = (input, message) => {
  const field = input.closest('.field');
  if (!field) return;
  field.classList.toggle('has-error', Boolean(message));
  let box = field.querySelector('.field__error');
  if (message && !box) {
    box = document.createElement('p');
    box.className = 'field__error';
    box.setAttribute('role', 'alert');
    field.appendChild(box);
  }
  if (box) box.textContent = message || '';
  if (!message && box) box.remove();
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
};

export const clearErrors = (form) => {
  form.querySelectorAll('.field').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field__error').forEach((e) => e.remove());
  form.querySelector('.form-alert')?.remove();
};

/** Shows a form-level message (server errors) at the top of the form. */
export const formAlert = (form, message, type = 'error') => {
  form.querySelector('.form-alert')?.remove();
  const el = document.createElement('div');
  el.className = `form-alert form-alert--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check', 18)}<span></span>`;
  el.querySelector('span').textContent = message;
  form.prepend(el);
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

/** Maps backend 422 { errors: [{field,message}] } onto inputs; returns true if something was mapped. */
export const applyServerErrors = (form, err) => {
  let mapped = false;
  (err.errors || []).forEach(({ field, message }) => {
    const name = field.split('.').pop();
    const input = form.querySelector(`[name="${name}"]`);
    if (input) { setFieldError(input, message); mapped = true; }
  });
  return mapped;
};

export const rules = {
  required: (v, label = 'This field') => (v.trim() ? '' : `${label} is required`),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address'),
  password: (v) => (v.length < 8 ? 'Use at least 8 characters' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Include at least one letter and one number' : ''),
  phone: (v) => (/^[+\d][\d\s-]{6,18}$/.test(v.trim()) ? '' : 'Enter a valid phone number, e.g. 0300 1234567'),
  match: (v, other) => (v === other ? '' : 'Passwords do not match'),
};

/** Validates [{ input, check: () => message }]. Focuses the first invalid input. */
export const validate = (form, checks) => {
  clearErrors(form);
  let first = null;
  checks.forEach(({ input, check }) => {
    const msg = check();
    if (msg) { setFieldError(input, msg); first ||= input; }
  });
  first?.focus();
  return !first;
};

export function bindPasswordToggles(root = document) {
  root.querySelectorAll('[data-pw-toggle]').forEach((btn) => {
    btn.innerHTML = icon('eye', 18);
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeoff' : 'eye', 18);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
}
