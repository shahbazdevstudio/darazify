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
// A clear portrait cover with only the series name on it. The cover is the one set in the admin,
// otherwise the image of the series' first game.
const seriesCard = (s) => `
  <a class="scard${s.image ? '' : ' scard--noimg'}" href="/pages/games.html?series=${encodeURIComponent(s.slug)}" aria-label="${esc(s.name)} series, ${plural(s.count, 'game')}" title="${esc(plural(s.count, 'game'))}">
    ${s.image ? `<img class="scard__img" src="${esc(gameImg(s.image, 480))}" alt="" loading="lazy" width="270" height="480">` : ''}
    <h3 class="scard__name">${esc(s.name)}</h3>
  </a>`;

// Older API versions send no image: take the first game's image for such a series
const withImage = (s) => (s.image !== undefined ? s : api('/games', { params: { series: s.slug, pageSize: 3 } })
  .then(({ games }) => ({ ...s, image: games.find((g) => g.image)?.image || '' }))
  .catch(() => ({ ...s, image: '' })));

api('/series').then(async ({ series }) => {
  if (!series.length) return;
  const full = await Promise.all(series.map(withImage));
  $('#seriesRail').innerHTML = full.map(seriesCard).join('');
  $('#seriesSection').hidden = false;
}).catch(() => { /* series are optional: the section just stays hidden */ });
