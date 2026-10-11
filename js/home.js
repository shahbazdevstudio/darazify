import { api } from './api.js';
import { mountLayout } from './layout.js';
import { gameCard, productCard, softwareCard, skeletonCards, emptyState, loadInto } from './components.js';
import { esc, gameImg, formatPrice } from './utils.js';
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
  $('#heroStage').innerHTML = picks.map((g, i) => `
    <a class="cover cover--${i + 1}" href="/pages/game-details.html?id=${encodeURIComponent(g.id)}" aria-label="${esc(g.name)}">
      <img src="${esc(gameImg(g.image, 420))}" alt="${esc(g.name)}" ${i === 1 ? 'fetchpriority="high"' : ''} width="420" height="525">
      <span class="cover__cap"><strong>${esc(g.name)}</strong><span>${g.rating ? `${icon('star', 12)} ${Number(g.rating).toFixed(1)}` : ''}<em>${formatPrice(g.price)}</em></span></span>
    </a>`).join('');
};

// Covers come from the Popular list; if the admin has not picked any yet, use any game in the store.
popularPromise
  .then(({ games }) => renderCovers(games))
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
