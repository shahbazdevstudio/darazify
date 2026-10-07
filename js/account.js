import { api } from './api.js';
import { mountLayout } from './layout.js';
import { Auth, requireLogin } from './auth.js';
import { Cart } from './cart.js';
import { icon } from './icons.js';
import { setBusy, toast, confirmDialog } from './ui.js';
import { esc, formatDate } from './utils.js';
import { rules, validate, formAlert, applyServerErrors, bindPasswordToggles, clearErrors } from './forms.js';

const TABS = ['profile', 'delivery', 'password', 'danger'];
let user;

const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

function paintHeader() {
  document.getElementById('acctName').textContent = user.name;
  document.getElementById('acctEmail').textContent = user.email;
  document.getElementById('acctAvatar').textContent = initials(user.name);
  document.getElementById('acctSince').textContent = `Member since ${formatDate(user.createdAt)}`;
}

function fillForms() {
  const p = document.getElementById('profileForm').elements;
  p.name.value = user.name || '';
  p.email.value = user.email || '';
  const d = document.getElementById('deliveryForm').elements;
  d.phone.value = user.phone || '';
  d.address.value = user.address || '';
  d.city.value = user.city || '';
  document.getElementById('deliveryStatus').innerHTML = user.phone && user.address && user.city
    ? `<span class="status status--delivered">Complete</span>`
    : `<span class="status status--pending">Needs details</span>`;
}

function showTab(name) {
  if (!TABS.includes(name)) name = 'profile';
  document.querySelectorAll('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  if (window.location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
}

const submitter = (form, run, okMsg) => form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('[type="submit"]');
  setBusy(btn, true, 'Saving…');
  try {
    await run();
    toast(okMsg, 'success');
  } catch (err) {
    if (!applyServerErrors(form, err)) formAlert(form, err.message);
  } finally { setBusy(btn, false); }
});

(async () => {
  await mountLayout();
  if (!requireLogin()) return;
  try { user = (await api('/users/me')).user; } catch { user = Auth.user; }
  Auth.setUser(user);
  paintHeader();
  fillForms();
  bindPasswordToggles();

  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab(window.location.hash.slice(1));
  window.addEventListener('hashchange', () => showTab(window.location.hash.slice(1)));

  // Profile (name + email; email change needs the current password)
  const pf = document.getElementById('profileForm');
  const pe = pf.elements;
  pe.email.addEventListener('input', () => {
    document.getElementById('emailPwField').hidden = pe.email.value.trim().toLowerCase() === user.email;
  });
  submitter(pf, async () => {
    if (!validate(pf, [
      { input: pe.name, check: () => (pe.name.value.trim().length < 2 ? 'Enter your full name' : '') },
      { input: pe.email, check: () => rules.email(pe.email.value) },
    ])) throw Object.assign(new Error('Please fix the highlighted fields'), { errors: [{ field: 'x' }] });
    const body = { name: pe.name.value.trim() };
    if (pe.email.value.trim().toLowerCase() !== user.email) { body.email = pe.email.value.trim(); body.currentPassword = pe.currentPassword.value; }
    ({ user } = await api('/users/me', { method: 'PUT', body }));
    Auth.setUser(user); paintHeader(); fillForms();
    document.getElementById('emailPwField').hidden = true; pe.currentPassword.value = '';
  }, 'Profile updated');

  // Delivery
  const df = document.getElementById('deliveryForm');
  const de = df.elements;
  submitter(df, async () => {
    if (!validate(df, [
      { input: de.phone, check: () => rules.phone(de.phone.value) },
      { input: de.address, check: () => (de.address.value.trim().length < 8 ? 'Enter your full delivery address' : '') },
      { input: de.city, check: () => rules.required(de.city.value, 'City') },
    ])) throw Object.assign(new Error('Please fix the highlighted fields'), { errors: [{ field: 'x' }] });
    ({ user } = await api('/users/me', { method: 'PUT', body: { phone: de.phone.value.trim(), address: de.address.value.trim(), city: de.city.value.trim() } }));
    Auth.setUser(user); fillForms();
  }, 'Delivery information saved');

  // Password
  const wf = document.getElementById('passwordForm');
  const we = wf.elements;
  submitter(wf, async () => {
    if (!validate(wf, [
      { input: we.currentPassword, check: () => rules.required(we.currentPassword.value, 'Current password') },
      { input: we.newPassword, check: () => rules.password(we.newPassword.value) },
      { input: we.confirmPassword, check: () => rules.match(we.confirmPassword.value, we.newPassword.value) },
    ])) throw Object.assign(new Error('Please fix the highlighted fields'), { errors: [{ field: 'x' }] });
    await api('/users/me/password', { method: 'PUT', body: { currentPassword: we.currentPassword.value, newPassword: we.newPassword.value, confirmPassword: we.confirmPassword.value } });
    wf.reset(); clearErrors(wf);
  }, 'Password changed');

  // Delete account
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    const pw = await confirmDialog({
      title: 'Delete your account?',
      message: 'This permanently deletes your account and saved details. Your past orders stay with the seller. This cannot be undone.',
      confirmText: 'Delete my account', danger: true, passwordLabel: 'Enter your password to confirm',
    });
    if (!pw) return;
    try {
      await api('/users/me', { method: 'DELETE', body: { password: pw } });
      localStorage.removeItem('dz_session_hint');
      Auth.setUser(null);
      await Cart.sync();
      toast('Your account has been deleted', 'success');
      setTimeout(() => { window.location.href = '/index.html'; }, 900);
    } catch (err) { toast(err.message, 'error'); }
  });
})();
