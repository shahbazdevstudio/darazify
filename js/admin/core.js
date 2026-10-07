import { api } from '../api.js';
import { initTheme, toggleTheme, toast } from '../ui.js';
import { icon } from '../icons.js';
import { esc } from '../utils.js';

/** Admin API wrapper: any auth failure sends the admin back to the admin login page. */
export async function adminApi(path, opts) {
  try {
    return await api(path, opts);
  } catch (err) {
    if (err.status === 401 || (err.status === 403 && /admin/i.test(err.message))) {
      window.location.replace('/admin/login.html');
    }
    throw err;
  }
}

const NAV = [
  { id: 'dashboard', href: '/admin/index.html', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', href: '/admin/orders.html', label: 'Orders', icon: 'receipt' },
  { id: 'products', href: '/admin/products.html', label: 'Products', icon: 'package' },
  { id: 'users', href: '/admin/users.html', label: 'Users', icon: 'users' },
];

/**
 * Verifies the admin session, renders the sidebar/topbar shell and returns the content element.
 * Unauthenticated visitors are redirected to /admin/login.html before anything is shown.
 */
export async function mountAdmin({ active, title, actions = '' }) {
  initTheme();
  const app = document.getElementById('admApp');
  app.innerHTML = '<div class="adm-loading"><span class="spinner spinner--lg"></span></div>';

  let admin;
  try {
    admin = (await api('/auth/admin/me')).user;
  } catch {
    window.location.replace('/admin/login.html');
    return new Promise(() => {});
  }

  app.innerHTML = `
  <div class="adm">
    <aside class="adm__side" id="admSide" aria-label="Admin navigation">
      <div class="adm__brand"><span class="brand__name">Daraz<span>ify</span></span><em>Admin</em></div>
      <nav class="adm__nav">
        ${NAV.map((n) => `<a href="${n.href}" class="${n.id === active ? 'is-active' : ''}" ${n.id === active ? 'aria-current="page"' : ''}>${icon(n.icon, 20)}<span>${n.label}</span></a>`).join('')}
      </nav>
      <div class="adm__side-foot">
        <a href="/index.html" target="_blank" rel="noopener">${icon('home', 18)}<span>View store</span></a>
        <button id="admLogout">${icon('logout', 18)}<span>Log out</span></button>
      </div>
    </aside>
    <div class="adm__overlay" id="admOverlay" hidden></div>
    <div class="adm__col">
      <header class="adm__top">
        <button class="icon-btn adm__burger" id="admBurger" aria-label="Open menu">${icon('menu', 22)}</button>
        <h1>${esc(title)}</h1>
        <div class="adm__top-actions">${actions}<button class="icon-btn" id="admTheme" aria-label="Toggle theme"></button><span class="adm__who" title="${esc(admin.email)}"><b>${esc(admin.name.slice(0, 1).toUpperCase())}</b><span>${esc(admin.name)}</span></span></div>
      </header>
      <main class="adm__main" id="admContent"></main>
    </div>
  </div>`;

  const themeBtn = document.getElementById('admTheme');
  const paint = () => { themeBtn.innerHTML = icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', 20); };
  paint();
  themeBtn.addEventListener('click', () => { toggleTheme(); paint(); });

  const side = document.getElementById('admSide');
  const overlay = document.getElementById('admOverlay');
  const setSide = (open) => { side.classList.toggle('is-open', open); overlay.hidden = !open; document.body.classList.toggle('no-scroll', open); };
  document.getElementById('admBurger').addEventListener('click', () => setSide(true));
  overlay.addEventListener('click', () => setSide(false));

  document.getElementById('admLogout').addEventListener('click', async () => {
    try { await api('/auth/admin/logout', { method: 'POST' }); } finally { window.location.href = '/admin/login.html'; }
  });

  return document.getElementById('admContent');
}

/* ----------------------------- UI helpers ----------------------------- */
export const skeletonRows = (rows = 6, cols = 5) =>
  `<div class="tbl-skel">${Array.from({ length: rows }, () => `<div class="tbl-skel__row">${Array.from({ length: cols }, () => '<span class="skeleton"></span>').join('')}</div>`).join('')}</div>`;

export const tableState = (iconName, title, text) =>
  `<div class="state state--empty adm-state"><div class="state__icon">${icon(iconName, 28)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;

export const userBadge = (u) => (u.isBlocked ? '<span class="status status--cancelled">Blocked</span>' : '<span class="status status--delivered">Active</span>');

/** Right-hand detail panel. Returns { body, close }. */
export function openSheet({ title, html = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg"></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="icon-btn" aria-label="Close">${icon('x', 22)}</button></header><div class="sheet__body">${html}</div></aside>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const close = () => {
    wrap.classList.add('is-leaving');
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 220);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.sheet-bg').addEventListener('click', close);
  wrap.querySelector('header .icon-btn').addEventListener('click', close);
  return { body: wrap.querySelector('.sheet__body'), close };
}

export { toast };
