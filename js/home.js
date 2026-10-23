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
// A clean cover card built only from the series API: cover image (image.url), name and total games.
// On hover (or keyboard focus) the image dims under an overlay showing the name and the game count.
// The cover can be { url, publicId } (admin shape) or a plain url string (public shape).
const coverOf = (s) => (typeof s.image === 'string' ? s.image : s.image?.url) || '';

const seriesCard = (s) => {
  const cover = coverOf(s);
  const count = Number(s.count) || 0;
  return `
  <a class="scard${cover ? '' : ' scard--noimg'}" href="/pages/games.html?series=${encodeURIComponent(s.slug)}" aria-label="${esc(s.name)} series, ${plural(count, 'game')}">
    ${cover ? `<img class="scard__img" src="${esc(gameImg(cover, 640))}" alt="${esc(s.name)}" loading="lazy" width="316" height="400">` : ''}
    <span class="scard__overlay">
      <span class="scard__name">${esc(s.name)}</span>
      <span class="scard__count">${icon('gamepad', 15)}${esc(plural(count, 'game'))}</span>
    </span>
  </a>`;
};

// Auto-swiping slider with pagination dots (native scroll + snap, so touch swipe still works)
const initSeriesSlider = (rail, dotsEl) => {
  const cards = [...rail.children];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DELAY = 3800;
  let pages = 1, perView = 1, current = 0, timer = null, paused = false, visible = true;

  const measure = () => {
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : rail.clientWidth;
    perView = Math.max(1, Math.round((rail.clientWidth + 1) / Math.max(step, 1)));
    pages = Math.max(1, Math.ceil(cards.length / perView));
    dotsEl.hidden = pages <= 1;
    dotsEl.innerHTML = Array.from({ length: pages }, (_, i) => `<button type="button" class="series-dot" data-page="${i}" aria-label="Go to page ${i + 1}"></button>`).join('');
    mark(pageFromScroll());
  };
  const maxScroll = () => rail.scrollWidth - rail.clientWidth;
  const pageFromScroll = () => {
    if (pages <= 1) return 0;
    if (rail.scrollLeft >= maxScroll() - 4) return pages - 1;
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    return Math.min(pages - 1, Math.round(rail.scrollLeft / (step * perView)));
  };
  const mark = (i) => {
    current = i;
    dotsEl.querySelectorAll('.series-dot').forEach((d, n) => { d.classList.toggle('is-active', n === i); d.setAttribute('aria-current', n === i ? 'true' : 'false'); });
  };
  const goTo = (i) => {
    const card = cards[Math.min(cards.length - 1, i * perView)];
    const left = Math.min(maxScroll(), rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left);
    rail.scrollTo({ left: i === pages - 1 ? maxScroll() : left, behavior: 'smooth' });
  };
  const tick = () => { if (!paused && visible && !document.hidden && pages > 1) goTo((current + 1) % pages); };
  const start = () => { stop(); if (!reduceMotion) timer = setInterval(tick, DELAY); };
  const stop = () => { clearInterval(timer); timer = null; };
  const pause = (v) => { paused = v; };

  rail.addEventListener('scroll', () => mark(pageFromScroll()), { passive: true });
  dotsEl.addEventListener('click', (e) => { const d = e.target.closest('[data-page]'); if (d) { goTo(Number(d.dataset.page)); start(); } });
  ['mouseenter', 'focusin', 'touchstart'].forEach((ev) => rail.addEventListener(ev, () => pause(true), { passive: true }));
  ['mouseleave', 'focusout'].forEach((ev) => rail.addEventListener(ev, () => pause(false)));
  rail.addEventListener('touchend', () => setTimeout(() => pause(false), 2500), { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.2 }).observe(rail);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(measure, 150); });

  measure();
  start();
};

// Public series endpoint (same data as /admin/series: name, slug, image, count). The admin one needs
// an admin login, so normal visitors could never load it.
api('/series').then(({ series }) => {
  const list = (series || []).filter((s) => s.isActive !== false && s.name && s.slug);
  if (!list.length) return;
  const rail = $('#seriesRail');
  rail.innerHTML = list.map(seriesCard).join('');
  $('#seriesSection').hidden = false;
  initSeriesSlider(rail, $('#seriesDots'));
}).catch(() => { /* series are optional: the section just stays hidden */ });
