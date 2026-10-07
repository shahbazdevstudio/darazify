import { icon } from './icons.js';
import { esc } from './utils.js';

/* ------------------------------ Theme ------------------------------ */
export const initTheme = () => {
  document.documentElement.dataset.theme = localStorage.getItem('dz_theme') || 'dark';
};
export const toggleTheme = () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('dz_theme', next);
  return next;
};

/* ------------------------------ Toasts ------------------------------ */
const toastRoot = () => {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
};

export function toast(message, type = 'info', duration = 3600) {
  const names = { success: 'check', error: 'alert', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast__icon">${icon(names[type] || 'info', 18)}</span><span class="toast__msg">${esc(message)}</span><button class="toast__close" aria-label="Dismiss">${icon('x', 16)}</button>`;
  const close = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast__close').addEventListener('click', close);
  toastRoot().appendChild(el);
  if (duration) setTimeout(close, duration);
}

/* ------------------------- Confirmation dialog ------------------------- */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false, passwordLabel = '' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="modal__title">${esc(title)}</h2>
        <p class="modal__text">${esc(message)}</p>
        ${passwordLabel ? `<div class="field modal__field"><label for="modal-pw">${esc(passwordLabel)}</label><input class="input" id="modal-pw" type="password" autocomplete="current-password"></div>` : ''}
        <div class="modal__actions">
          <button class="btn btn-secondary" data-cancel>${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>
        </div>
      </div>`;
    const previous = document.activeElement;
    const done = (val) => {
      overlay.classList.add('is-leaving');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { overlay.remove(); previous?.focus?.(); }, 180);
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => done(false));
    overlay.querySelector('[data-ok]').addEventListener('click', () => {
      if (!passwordLabel) return done(true);
      const v = overlay.querySelector('#modal-pw').value;
      if (!v) { overlay.querySelector('#modal-pw').focus(); return; }
      done(v); // resolves with the typed password
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    (overlay.querySelector('#modal-pw') || overlay.querySelector('[data-cancel]')).focus();
  });
}

/* ------------------------ Button busy state ------------------------ */
export function setBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-busy');
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${busyLabel ? `<span>${esc(busyLabel)}</span>` : ''}`;
  } else {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}
