import { api, isAbort } from './api.js';
import { icon } from './icons.js';
import { esc, debounce, formatPrice, gameImg, cdn } from './utils.js';

/** Navbar search with debounced suggestions for games and leather products. */
export function initSearch(root) {
  const input = root.querySelector('input');
  const panel = root.querySelector('.search__panel');
  const form = root.querySelector('form');
  let controller;
  let active = -1;

  const open = () => { panel.hidden = false; input.setAttribute('aria-expanded', 'true'); };
  const close = () => { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const options = () => [...panel.querySelectorAll('[role="option"]')];

  const row = (href, img, title, sub) => `
    <a class="sug" role="option" href="${href}">
      <span class="sug__thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</span>
      <span class="sug__text"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
    </a>`;

  const render = (q, { games, products }) => {
    if (!games.length && !products.length) {
      panel.innerHTML = `<div class="sug-empty">${icon('search', 22)}<p>No games or products match “${esc(q)}”.</p><small>Try a shorter name or check the spelling.</small></div>`;
      return;
    }
    panel.innerHTML = `
      ${games.length ? `<div class="sug-group"><h4>Games</h4>${games.map((g) => row(`/pages/game-details.html?id=${encodeURIComponent(g.id)}`, g.image && gameImg(g.image, 80), g.name, `${formatPrice(g.price)}${g.rating ? ` · ${Number(g.rating).toFixed(1)} rating` : ''}`)).join('')}</div>` : ''}
      ${products.length ? `<div class="sug-group"><h4>Leather products</h4>${products.map((p) => row(`/pages/product-details.html?id=${p._id}`, p.images?.[0] && cdn(p.images[0].url, 80), p.title, `${formatPrice(p.price)} · ${p.category}`)).join('')}</div>` : ''}
      <div class="sug-all">
        <a role="option" href="/pages/games.html?q=${encodeURIComponent(q)}">All games for “${esc(q)}”</a>
        <a role="option" href="/pages/products.html?q=${encodeURIComponent(q)}">All products for “${esc(q)}”</a>
      </div>`;
  };

  const search = debounce(async () => {
    const q = input.value.trim();
    controller?.abort();
    if (q.length < 2) { close(); return; }
    panel.innerHTML = `<div class="sug-loading"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>`;
    open();
    controller = new AbortController();
    try {
      const data = await api('/search', { params: { q }, signal: controller.signal });
      render(q, data);
    } catch (err) {
      if (isAbort(err)) return;
      panel.innerHTML = `<div class="sug-empty">${icon('alert', 22)}<p>Search is unavailable right now.</p><small>${esc(err.message)}</small></div>`;
    }
  }, 300);

  input.addEventListener('input', search);
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2 && panel.innerHTML) open(); });

  input.addEventListener('keydown', (e) => {
    const list = options();
    if (e.key === 'Escape') { close(); input.blur(); }
    if (!list.length || panel.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list.forEach((el, i) => el.classList.toggle('is-active', i === active));
      list[active].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); list[active].click(); }
  });

  // Enter without a highlighted suggestion opens the games results (products are one click away in the panel)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) window.location.href = `/pages/games.html?q=${encodeURIComponent(q)}`;
  });

  document.addEventListener('click', (e) => { if (!root.contains(e.target)) close(); });
}
