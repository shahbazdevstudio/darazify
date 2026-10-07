import { Auth } from './auth.js';
import { Cart } from './cart.js';
import { initTheme, toggleTheme, toast } from './ui.js';
import { initSearch } from './search.js';
import { bindGlobalHandlers } from './components.js';
import { icon } from './icons.js';
import { SITE } from './config.js';
import { esc } from './utils.js';

const LINKS = [
  { href: '/pages/games.html', label: 'Games' },
  { href: '/pages/products.html', label: 'Leather' },
];

const here = () => window.location.pathname;
const isActive = (href) => here().endsWith(href.replace('/pages', '').replace('/pages/', '')) || here() === href;

const searchHTML = (id) => `
  <div class="search" data-search>
    <form role="search" autocomplete="off">
      <span class="search__icon">${icon('search', 20)}</span>
      <input id="${id}" type="search" name="q" placeholder="Search games or leather" aria-label="Search games and leather products" role="combobox" aria-expanded="false" aria-controls="${id}-panel" maxlength="60">
    </form>
    <div class="search__panel" id="${id}-panel" role="listbox" hidden></div>
  </div>`;

const headerHTML = () => `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="nav" id="nav">
    <div class="container nav__bar">
      <button class="icon-btn nav__burger" id="navOpen" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${icon('menu', 22)}</button>
      <a class="brand" href="/index.html" aria-label="Darazify home">
        <span class="brand__mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="30" height="30"><rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="currentColor"/><rect x="5.5" y="5.5" width="21" height="21" rx="6" fill="none" stroke="var(--brand-stitch)" stroke-width="1.4" stroke-dasharray="2.6 2.2"/><path d="M11.5 9.5h4.6c4.3 0 6.4 2.7 6.4 6.5s-2.1 6.5-6.4 6.5h-4.6z" fill="var(--brand-letter)"/></svg></span>
        <span class="brand__name">Daraz<span>ify</span></span>
      </a>
      <div class="nav__search nav__search--desktop">${searchHTML('navSearch')}</div>
      <nav class="nav__links" aria-label="Main">
        ${LINKS.map((l) => `<a href="${l.href}" class="${isActive(l.href) ? 'is-active' : ''}">${l.label}</a>`).join('')}
      </nav>
      <div class="nav__actions">
        <button class="icon-btn" id="themeBtn" aria-label="Toggle colour theme"></button>
        <div class="nav__auth" data-auth-area></div>
        <a class="cart-btn" href="/pages/cart.html" aria-label="Cart">${icon('bag', 22)}<span class="cart-btn__count" data-cart-count hidden>0</span></a>
      </div>
    </div>
    <div class="container nav__search nav__search--mobile">${searchHTML('navSearchM')}</div>
  </header>

  <div class="drawer-overlay" id="drawerOverlay" hidden></div>
  <aside class="drawer" id="drawer" aria-label="Menu" aria-hidden="true">
    <div class="drawer__head">
      <span class="brand__name">Daraz<span>ify</span></span>
      <button class="icon-btn" id="navClose" aria-label="Close menu">${icon('x', 22)}</button>
    </div>
    <nav class="drawer__links">
      <a href="/index.html">Home</a>
      ${LINKS.map((l) => `<a href="${l.href}">${l.label === 'Leather' ? 'Leather products' : l.label}</a>`).join('')}
      <a href="/pages/cart.html">Cart <span class="pill" data-cart-count hidden>0</span></a>
    </nav>
    <div class="drawer__auth" data-auth-drawer></div>
  </aside>`;

const footerHTML = () => {
  const contact = [
    SITE.email && `<li>${icon('mail', 16)}<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></li>`,
    SITE.phone && `<li>${icon('phone', 16)}<a href="tel:${esc(SITE.phone.replace(/\s/g, ''))}">${esc(SITE.phone)}</a></li>`,
    SITE.whatsapp && `<li>${icon('chat', 16)}<a href="https://wa.me/${esc(SITE.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp us</a></li>`,
  ].filter(Boolean).join('');
  const socials = Object.entries(SITE.social).filter(([, v]) => v)
    .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" class="chip">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');

  return `
  <footer class="footer">
    <div class="container footer__grid">
      <div class="footer__brand">
        <a class="brand" href="/index.html"><span class="brand__name">Daraz<span>ify</span></span></a>
        <p>Leather goods made to be carried daily, and PC games at one simple price. Order both in a single cart and the seller confirms by phone.</p>
        ${socials ? `<div class="footer__social">${socials}</div>` : ''}
      </div>
      <div><h4>Shop</h4><ul><li><a href="/pages/games.html">All games</a></li><li><a href="/pages/products.html">Leather products</a></li><li><a href="/pages/cart.html">Cart</a></li></ul></div>
      <div><h4>Account</h4><ul id="footerAccount"></ul></div>
      ${contact ? `<div><h4>Contact</h4><ul class="footer__contact">${contact}</ul></div>` : ''}
    </div>
    <div class="container footer__bottom"><span>© ${new Date().getFullYear()} ${esc(SITE.name)}. All rights reserved.</span><span>Prices in Pakistani rupees (PKR).</span></div>
  </footer>`;
};

const authHTML = (user, mobile = false) => {
  if (user) {
    const first = esc(user.name.split(' ')[0]);
    return `<a class="btn btn-ghost btn-sm" href="/pages/account.html">${icon('user', 18)}<span>${first}</span></a>
            <button class="btn btn-secondary btn-sm" data-logout>${icon('logout', 16)}<span>Log out</span></button>`;
  }
  if (Auth.hint && !Auth.user && !mobile) return `<span class="skeleton nav__auth-skel"></span>`;
  return `<a class="btn btn-ghost btn-sm" href="/pages/login.html">Log in</a><a class="btn btn-primary btn-sm" href="/pages/signup.html">Sign up</a>`;
};

export async function mountLayout() {
  initTheme();
  document.getElementById('site-header').innerHTML = headerHTML();
  document.getElementById('site-footer').innerHTML = footerHTML();
  bindGlobalHandlers();

  const themeBtn = document.getElementById('themeBtn');
  const paintTheme = () => {
    const light = document.documentElement.dataset.theme === 'light';
    themeBtn.innerHTML = icon(light ? 'moon' : 'sun', 20);
    themeBtn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  };
  paintTheme();
  themeBtn.addEventListener('click', () => { toggleTheme(); paintTheme(); });

  document.querySelectorAll('[data-search]').forEach(initSearch);

  // Auth area (desktop + drawer)
  const paintAuth = () => {
    document.querySelector('[data-auth-area]').innerHTML = authHTML(Auth.user);
    document.querySelector('[data-auth-drawer]').innerHTML = authHTML(Auth.user, true);
  };
  const paintFooter = () => {
    document.getElementById('footerAccount').innerHTML = Auth.user
      ? '<li><a href="/pages/account.html">My account</a></li><li><a href="/pages/orders.html">My orders</a></li><li><a href="/pages/cart.html">Cart</a></li>'
      : '<li><a href="/pages/login.html">Log in</a></li><li><a href="/pages/signup.html">Create account</a></li><li><a href="/pages/orders.html">Track an order</a></li>';
  };
  paintAuth();
  paintFooter();
  window.addEventListener('auth:change', () => { paintAuth(); paintFooter(); });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-logout]')) return;
    try {
      await Auth.logout();
      toast('You have been logged out', 'success');
      if (/account|orders|checkout/.test(window.location.pathname)) window.location.href = '/index.html';
    } catch (err) { toast(err.message, 'error'); }
  });

  // Cart badge
  window.addEventListener('cart:change', (e) => {
    const n = e.detail.count;
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n > 99 ? '99+' : n; el.hidden = n === 0; });
  });

  // Sticky header shadow
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile drawer
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const openBtn = document.getElementById('navOpen');
  const setDrawer = (open) => {
    drawer.classList.toggle('is-open', open);
    overlay.hidden = !open;
    drawer.setAttribute('aria-hidden', String(!open));
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
  };
  openBtn.addEventListener('click', () => setDrawer(true));
  document.getElementById('navClose').addEventListener('click', () => setDrawer(false));
  overlay.addEventListener('click', () => setDrawer(false));
  drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

  await Auth.init();
  await Cart.init();
}
