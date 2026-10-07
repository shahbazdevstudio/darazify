import { icon } from './icons.js';
import { esc, formatPrice, gameImg, cdn, truncate, stripHtml } from './utils.js';
import { Cart } from './cart.js';
import { toast, setBusy } from './ui.js';
import { GAME_PRICE } from './config.js';

/* ------------------------------ Cards ------------------------------ */
const ratingBadge = (r) => (r > 0 ? `<span class="rating">${icon('star', 13)}${Number(r).toFixed(1)}</span>` : '');

const addBtn = (attrs, cls, label = 'Add to cart') =>
  `<button class="btn btn-sm ${cls}" type="button" data-add ${attrs}>${icon('bag', 16)}<span>${label}</span></button>`;

export function gameCard(g) {
  const href = `/pages/game-details.html?id=${encodeURIComponent(g.id)}`;
  const media = g.image
    ? `<img class="card-img" src="${esc(gameImg(g.image, 420))}" alt="${esc(g.name)}" loading="lazy" width="420" height="260">`
    : `<div class="card-img card-img--empty">${icon('gamepad', 36)}</div>`;
  const meta = [g.genres?.slice(0, 2).join(', '), g.released?.slice(0, 4)].filter(Boolean).join(' · ');
  const attrs = `data-type="game" data-id="${esc(g.id)}" data-name="${esc(g.name)}" data-image="${esc(g.image || '')}" data-price="${g.price || GAME_PRICE}"`;
  return `
  <article class="card g-card">
    <a class="card__media" href="${href}" aria-label="${esc(g.name)}">${media}${ratingBadge(g.rating) ? `<span class="card__badge card__badge--rating">${ratingBadge(g.rating)}</span>` : ''}</a>
    <div class="card__body">
      <h3 class="card__title"><a href="${href}">${esc(g.name)}</a></h3>
      <p class="card__meta">${esc(meta) || '&nbsp;'}</p>
      <div class="card__price"><strong>${formatPrice(g.price || GAME_PRICE)}</strong><span class="chip chip--sm">${esc(g.platforms?.[0] || 'PC')}</span></div>
      <div class="card__actions">
        <a class="btn btn-sm btn-secondary" href="${href}">View details</a>
        ${addBtn(attrs, 'btn-signal')}
      </div>
    </div>
  </article>`;
}

export function productCard(p) {
  const href = `/pages/product-details.html?id=${encodeURIComponent(p._id)}`;
  const [a, b] = p.images || [];
  const media = a
    ? `<img class="card-img" src="${esc(cdn(a.url, 560))}" alt="${esc(p.title)}" loading="lazy" width="560" height="560">${b ? `<img class="card-img card-img--alt" src="${esc(cdn(b.url, 560))}" alt="" loading="lazy" width="560" height="560">` : ''}`
    : `<div class="card-img card-img--empty">${icon('bag', 36)}</div>`;
  const out = p.stock <= 0;
  const attrs = `data-type="product" data-id="${esc(p._id)}" data-name="${esc(p.title)}" data-image="${esc(a?.url || '')}" data-price="${p.price}"`;
  const short = p.shortDescription || truncate(stripHtml(p.description), 90);
  return `
  <article class="card p-card">
    <a class="card__media card__media--square" href="${href}" aria-label="${esc(p.title)}">${media}
      ${p.discountPercent > 0 ? `<span class="card__badge card__badge--sale">-${p.discountPercent}%</span>` : ''}
      ${out ? '<span class="card__badge card__badge--out">Sold out</span>' : ''}
    </a>
    <div class="card__body">
      <p class="card__cat">${esc(p.category)}</p>
      <h3 class="card__title"><a href="${href}">${esc(p.title)}</a></h3>
      <p class="card__desc">${esc(short)}</p>
      <div class="card__price">
        <strong>${formatPrice(p.price)}</strong>
        ${p.originalPrice && p.originalPrice > p.price ? `<s>${formatPrice(p.originalPrice)}</s>` : ''}
      </div>
      ${!out && p.stock <= 5 ? `<p class="card__stock">Only ${p.stock} left</p>` : ''}
      <div class="card__actions">
        <a class="btn btn-sm btn-secondary" href="${href}">View details</a>
        ${out ? '<button class="btn btn-sm btn-primary" disabled>Sold out</button>' : addBtn(attrs, 'btn-primary')}
      </div>
    </div>
  </article>`;
}

/* ---------------------------- Placeholders ---------------------------- */
export const skeletonCards = (n = 8, kind = 'game') =>
  Array.from({ length: n }, () => `
    <div class="card card--skeleton" aria-hidden="true">
      <div class="skeleton card__media ${kind === 'product' ? 'card__media--square' : ''}"></div>
      <div class="card__body"><div class="skeleton sk-line w60"></div><div class="skeleton sk-line w40"></div><div class="skeleton sk-line w100 sk-btn"></div></div>
    </div>`).join('');

export const emptyState = ({ iconName = 'package', title, text = '', actions = '' }) => `
  <div class="state state--empty">
    <div class="state__icon">${icon(iconName, 30)}</div>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${actions ? `<div class="state__actions">${actions}</div>` : ''}
  </div>`;

export const errorState = (message, retryLabel = 'Try again') => `
  <div class="state state--error" role="alert">
    <div class="state__icon">${icon('alert', 30)}</div>
    <h3>${esc(message)}</h3>
    <p>This is usually temporary.</p>
    <div class="state__actions"><button class="btn btn-secondary" data-retry>${icon('refresh', 16)}<span>${esc(retryLabel)}</span></button></div>
  </div>`;

/**
 * Loads data into a container with skeleton → content / empty / error states.
 * fetcher: () => Promise<data>, render: (data) => html | null (null means "empty").
 */
export async function loadInto(container, { fetcher, render, skeleton, empty, errorText }) {
  if (!container) return;
  const run = async () => {
    container.innerHTML = skeleton;
    container.setAttribute('aria-busy', 'true');
    try {
      const data = await fetcher();
      const html = render(data);
      container.innerHTML = html || empty;
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
      container.innerHTML = errorState(errorText || err.message);
      container.querySelector('[data-retry]')?.addEventListener('click', run);
      return null;
    } finally {
      container.removeAttribute('aria-busy');
    }
  };
  return run();
}

/* ----------------------------- Pagination ----------------------------- */
const pageList = (page, total) => {
  const set = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) { set.add(2); set.add(3); set.add(4); }
  if (page >= total - 2) { set.add(total - 1); set.add(total - 2); set.add(total - 3); }
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
};

export function renderPagination(container, { page, totalPages }, onChange) {
  if (!container) return;
  if (!totalPages || totalPages <= 1) { container.innerHTML = ''; return; }
  const btn = (label, p, { disabled = false, current = false, aria = '' } = {}) =>
    `<button class="page-btn${current ? ' is-current' : ''}" ${disabled ? 'disabled' : ''} data-page="${p}" ${current ? 'aria-current="page"' : ''} ${aria ? `aria-label="${aria}"` : ''}>${label}</button>`;
  container.innerHTML = `<nav class="pagination" aria-label="Pagination">
    ${btn(`${icon('left', 16)}<span class="page-btn__text">Previous</span>`, page - 1, { disabled: page <= 1, aria: 'Previous page' })}
    <div class="pagination__pages">${pageList(page, totalPages).map((n) => (n === '…' ? '<span class="page-gap">…</span>' : btn(n, n, { current: n === page, aria: `Page ${n}` }))).join('')}</div>
    ${btn(`<span class="page-btn__text">Next</span>${icon('right', 16)}`, page + 1, { disabled: page >= totalPages, aria: 'Next page' })}
  </nav>`;
  container.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => onChange(Number(b.dataset.page))));
}

/* ------------------- Global behaviours (add-to-cart, images) ------------------- */
let bound = false;
export function bindGlobalHandlers() {
  if (bound) return;
  bound = true;

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn || btn.disabled) return;
    const { type, id, name, image, price } = btn.dataset;
    const original = btn.innerHTML;
    btn.disabled = true;
    try {
      await Cart.add({ itemType: type, itemId: id, name, image, price: Number(price) }, 1);
      btn.classList.add('is-added');
      btn.innerHTML = `${icon('check', 16)}<span>Added</span>`;
      toast(`${name} added to your cart`, 'success');
      setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = original; btn.disabled = false; }, 1400);
    } catch (err) {
      btn.innerHTML = original;
      btn.disabled = false;
      toast(err.message, 'error');
    }
  });

  // Broken images fall back to a neutral placeholder instead of an empty box
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.classList.contains('card-img')) {
      const holder = document.createElement('div');
      holder.className = 'card-img card-img--empty';
      holder.innerHTML = icon('gamepad', 36);
      img.replaceWith(holder);
    }
  }, true);
}

/* --------------------- Shared bits for Phase 3 pages --------------------- */
export const statusBadge = (status) => `<span class="status status--${String(status).toLowerCase()}">${esc(status)}</span>`;

export const starRating = (r = 0) => `<span class="stars" style="--p:${Math.min(100, (r / 5) * 100)}%" role="img" aria-label="${Number(r).toFixed(1)} out of 5">★★★★★</span>`;

export const qtyStepper = (value = 1, { max = 99, id = '' } = {}) => `
  <div class="qty" data-qty data-max="${max}">
    <button type="button" data-dec aria-label="Decrease quantity">${icon('minus', 16)}</button>
    <input ${id ? `id="${id}"` : ''} type="text" inputmode="numeric" value="${value}" aria-label="Quantity" maxlength="2">
    <button type="button" data-inc aria-label="Increase quantity">${icon('plus', 16)}</button>
  </div>`;

/** Wires a .qty stepper; calls onChange(newValue) with a clamped value. */
export function bindQty(root, onChange) {
  const input = root.querySelector('input');
  const max = Number(root.dataset.max) || 99;
  const set = (v) => {
    const n = Math.max(1, Math.min(max, parseInt(v, 10) || 1));
    input.value = n;
    onChange?.(n);
  };
  root.querySelector('[data-dec]').addEventListener('click', () => set(Number(input.value) - 1));
  root.querySelector('[data-inc]').addEventListener('click', () => set(Number(input.value) + 1));
  input.addEventListener('change', () => set(input.value));
  return () => Math.max(1, Math.min(max, parseInt(input.value, 10) || 1));
}

export const notFoundState = (what, backHref, backLabel) => emptyState({
  iconName: 'search', title: `${what} not found`, text: 'The link may be outdated, or it has been removed from the store.',
  actions: `<a class="btn btn-primary" href="${backHref}">${esc(backLabel)}</a><a class="btn btn-secondary" href="/index.html">Back to home</a>`,
});
