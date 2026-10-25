import { api } from './api.js';
import { mountLayout } from './layout.js';
import { gameCard, productCard, softwareCard, skeletonCards, emptyState, loadInto } from './components.js';
import { esc, gameImg, formatPrice, plural } from './utils.js';
import { icon } from './icons.js';

mountLayout();

const $ = (s) => document.querySelector(s);

// One shared request feeds both the hero covers and the Popular Games rail
const popularRequest = () => api('/games', { params: { type: 'popular', pageSize: 10 } });
let popularPromise = popularRequest();

const grid = (cards) => cards.join('');

/* ----------------------------- Hero covers ----------------------------- */
const renderCovers = (games) => {
  const picks = games.filter((g) => g.image).slice(0, 3);
  if (!picks.length) throw new Error('no covers');
  // 1 game -> centre slot, 2 games -> left + right, 3 games -> all three
  const slots = picks.length === 1 ? [2] : picks.length === 2 ? [1, 3] : [1, 2, 3];
  $('#heroStage').innerHTML = picks.map((g, i) => `
    <a class="cover cover--${slots[i]}" href="/pages/game-details.html?id=${encodeURIComponent(g.id)}" aria-label="${esc(g.name)}">
      <img src="${esc(gameImg(g.image, 420))}" alt="${esc(g.name)}" ${slots[i] === 2 ? 'fetchpriority="high"' : ''} width="420" height="525">
      <span class="cover__cap"><strong>${esc(g.name)}</strong><span>${g.rating ? `${icon('star', 12)} ${Number(g.rating).toFixed(1)}` : ''}<em>${formatPrice(g.price)}</em></span></span>
    </a>`).join('');
};

// 1) the games the admin chose for the banner (max 3)
// 2) otherwise the Popular games, 3) otherwise any game in the store
api('/games', { params: { type: 'hero', pageSize: 3 } })
  .then(({ games }) => renderCovers(games))
  .catch(() => popularPromise.then(({ games }) => renderCovers(games)))
  .catch(() => api('/games', { params: { pageSize: 3 } }).then(({ games }) => renderCovers(games)))
  .catch(() => {
    $('#heroStage').innerHTML = `<div class="cover-fallback">${icon('gamepad', 56)}<p>Games appear here as soon as they are added to the store.</p></div>`;
  });

/* ------------------------------ Sections ------------------------------ */
const gamesEmpty = emptyState({ iconName: 'gamepad', title: 'No games here yet', text: 'New games are added to the store regularly. Check back soon.', actions: '<a class="btn btn-primary" href="/pages/games.html">Browse all games</a>' });
const productsEmpty = emptyState({ iconName: 'bag', title: 'New leather pieces are on the way', text: 'Our collection is being stocked. In the meantime, explore the games.', actions: '<a class="btn btn-primary" href="/pages/games.html">Explore games</a>' });

loadInto($('#latestGames'), {
  fetcher: () => api('/games', { params: { type: 'latest', pageSize: 8 } }),
  render: ({ games }) => (games.length ? grid(games.map(gameCard)) : null),
  skeleton: skeletonCards(8, 'game'), empty: gamesEmpty, errorText: 'Unable to load games',
});

loadInto($('#popularGames'), {
  fetcher: () => popularPromise.catch(() => { popularPromise = popularRequest(); return popularPromise; }),
  render: ({ games }) => (games.length ? grid(games.map(gameCard)) : null),
  skeleton: skeletonCards(6, 'game'), empty: gamesEmpty, errorText: 'Unable to load popular games',
});

loadInto($('#featuredProducts'), {
  fetcher: () => api('/products', { params: { featured: 'true', limit: 8 } }),
  render: ({ products }) => (products.length ? grid(products.map((p) => productCard(p))) : null),
  skeleton: skeletonCards(4, 'product'), empty: productsEmpty, errorText: 'Unable to load products',
});

loadInto($('#latestProducts'), {
  fetcher: () => api('/products', { params: { sort: 'newest', limit: 8 } }),
  render: ({ products }) => (products.length ? grid(products.map((p) => productCard(p))) : null),
  skeleton: skeletonCards(4, 'product'), empty: productsEmpty, errorText: 'Unable to load products',
});

loadInto($('#softwareList'), {
  fetcher: () => api('/software', { params: { sort: 'newest', limit: 4 } }),
  render: ({ software }) => (software.length ? grid(software.map(softwareCard)) : null),
  skeleton: skeletonCards(4, 'product'),
  empty: emptyState({ iconName: 'code', title: 'Software is coming soon', text: 'We are adding software to the store. Check back shortly.', actions: '<a class="btn btn-primary" href="/pages/products.html">Shop leather</a>' }),
  errorText: 'Unable to load software',
});

// Rail arrows
document.querySelectorAll('[data-rail-btn]').forEach((b) => b.addEventListener('click', () => {
  const rail = document.getElementById(b.dataset.railBtn);
  rail.scrollBy({ left: (b.dataset.dir === 'next' ? 1 : -1) * rail.clientWidth * 0.85, behavior: 'smooth' });
}));

/* ------------------------------ Game series ------------------------------ */
// Cards are built ONLY from the public series API (GET /api/series): { id, name, slug, count, image }.
// `image` is a plain URL (the cover the admin uploaded, or the first game's picture as a fallback).
// The rail is a native scroll-snap row: it works with touch, mouse wheel, keyboard and the arrow buttons,
// with no transform maths that could break.
const coverOf = (s) => (typeof s.image === 'string' ? s.image : s.image?.url) || '';

const seriesCard = (s) => {
  const cover = coverOf(s);
  const count = Number(s.count) || 0;
  const label = `${s.name} series, ${plural(count, 'game')}`;
  return `
  <a class="scard${cover ? '' : ' scard--noimg'}" role="listitem" href="/pages/games.html?series=${encodeURIComponent(s.slug)}" aria-label="${esc(label)}">
    ${cover ? `<img class="scard__img" src="${esc(gameImg(cover, 480))}" alt="" loading="lazy" decoding="async" width="200" height="320" onerror="var a=this.parentElement;this.remove();a.classList.add('scard--noimg')">` : ''}
    <span class="scard__letter" aria-hidden="true">${esc(s.name.trim().charAt(0).toUpperCase())}</span>
    <span class="scard__info">
      <span class="scard__name">${esc(s.name)}</span>
      <span class="scard__count">${icon('gamepad', 14)}${esc(plural(count, 'game'))}</span>
    </span>
  </a>`;
};

const initSeriesRail = (rail, prev, next, btns) => {
  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    btns.hidden = max <= 4; // everything fits: no arrows needed
    prev.disabled = rail.scrollLeft <= 4;
    next.disabled = rail.scrollLeft >= max - 4;
  };
  const move = (dir) => rail.scrollBy({ left: dir * rail.clientWidth * 0.9, behavior: 'smooth' });
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  rail.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  window.addEventListener('resize', sync);
  rail.querySelectorAll('img').forEach((im) => im.addEventListener('load', sync, { once: true }));
  sync();
};

const loadSeries = () => api('/series').then(({ series }) => {
  const list = (series || []).filter((s) => s && s.name && s.slug);
  if (!list.length) return;
  const rail = $('#seriesRail');
  rail.innerHTML = list.map(seriesCard).join('');
  $('#seriesSection').hidden = false; // visible before measuring the rail
  initSeriesRail(rail, $('#seriesPrev'), $('#seriesNext'), $('#seriesBtns'));
}).catch((err) => {
  // Series are optional on the home page, so the section just stays hidden, but say why in the console.
  console.warn('[series] Could not load /series:', err?.message || err, '(is the latest backend deployed? try ?api=local)');
});

loadSeries();
