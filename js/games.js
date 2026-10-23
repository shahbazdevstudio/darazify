import { api, isAbort } from './api.js';
import { mountLayout } from './layout.js';
import { gameCard, skeletonCards, emptyState, errorState, renderPagination } from './components.js';
import { getParams, setParams, debounce, esc, plural } from './utils.js';
import { icon } from './icons.js';
import { setSeo, resetSeo } from './seo.js';
import { PAGE_SIZE } from './config.js';

mountLayout();

const $ = (s) => document.querySelector(s);
const els = { grid: $('#gamesGrid'), pager: $('#pager'), q: $('#fSearch'), genre: $('#fGenre'), sort: $('#fSort'), count: $('#resultCount'), clear: $('#clearFilters') };

const readState = () => {
  const p = getParams();
  return { q: p.get('q') || '', genre: p.get('genre') || '', sort: p.get('sort') || '', series: p.get('series') || '', page: Math.max(1, parseInt(p.get('page'), 10) || 1) };
};
let state = readState();
let controller;

const syncControls = () => {
  els.q.value = state.q;
  els.genre.value = state.genre;
  els.sort.value = state.sort;
  els.clear.hidden = !(state.q || state.genre || state.sort || state.series);
  showSeries();
};

// When a series card was clicked, the page becomes that series' page
let seriesInfo = null;
const head = $('.page-head');
const baseHead = head.innerHTML;
const renderSeriesHead = (total) => {
  if (!seriesInfo || seriesInfo.slug !== state.series) return;
  const n = total ?? seriesInfo.count;
  const countText = n === undefined ? '' : `${plural(n, 'game')} in our store. `;
  head.innerHTML = `<span class="series-tag">${icon('gamepad', 14)}Series</span><h1>${esc(seriesInfo.name)}</h1><p>${countText}Every ${esc(seriesInfo.name)} game we sell, in one place. <a class="link-btn" href="/pages/games.html">Browse all games</a></p>`;
  setSeo({
    title: `${seriesInfo.name} series — buy PC games`,
    description: `Buy ${seriesInfo.name} PC games${n ? ` (${plural(n, 'game')})` : ''} at Darazify. Simple pricing from 250 PKR, confirmed by the seller after you order.`,
    keywords: [`${seriesInfo.name} PC games`, `buy ${seriesInfo.name}`, `${seriesInfo.name} series`, 'PC games Pakistan'],
    canonical: `/pages/games.html?series=${encodeURIComponent(seriesInfo.slug)}`,
  });
};
async function showSeries() {
  if (!state.series) { if (seriesInfo) resetSeo(); seriesInfo = null; head.innerHTML = baseHead; return; }
  if (seriesInfo?.slug !== state.series) {
    try { ({ series: seriesInfo } = await api(`/series/${encodeURIComponent(state.series)}`)); } catch { seriesInfo = null; }
  }
  renderSeriesHead();
}

async function load({ scroll = false } = {}) {
  controller?.abort();
  controller = new AbortController();
  els.grid.innerHTML = skeletonCards(PAGE_SIZE.games, 'game');
  els.grid.setAttribute('aria-busy', 'true');
  els.pager.innerHTML = '';
  if (scroll) window.scrollTo({ top: $('#results').offsetTop - 110, behavior: 'smooth' });

  try {
    const { games, pagination } = await api('/games', {
      params: { search: state.q, genres: state.genre, ordering: state.sort, series: state.series, page: state.page, pageSize: PAGE_SIZE.games },
      signal: controller.signal,
    });
    if (!games.length) {
      els.count.textContent = 'No results';
      els.grid.innerHTML = emptyState({
        iconName: 'search', title: 'No games found',
        text: state.q ? `Nothing matched “${state.q}”. Try another title or clear the filters.` : 'Try a different genre or clear the filters.',
        actions: '<button class="btn btn-primary" data-clear>Clear filters</button>',
      });
      els.grid.querySelector('[data-clear]')?.addEventListener('click', clearAll);
      return;
    }
    els.count.textContent = `${pagination.total.toLocaleString()} games · page ${pagination.page} of ${pagination.totalPages}`;
    if (state.series && !state.q && !state.genre) renderSeriesHead(pagination.total);
    els.grid.innerHTML = games.map(gameCard).join('');
    renderPagination(els.pager, pagination, (page) => { state.page = page; push(); load({ scroll: true }); });
  } catch (err) {
    if (isAbort(err)) return;
    els.count.textContent = '';
    els.grid.innerHTML = errorState('Unable to load games');
    els.grid.querySelector('[data-retry]').addEventListener('click', () => load());
  } finally {
    els.grid.removeAttribute('aria-busy');
  }
}

const push = () => { setParams(state); syncControls(); };
const clearAll = () => { state = { q: '', genre: '', sort: '', series: '', page: 1 }; push(); load(); };

const change = (patch) => { state = { ...state, ...patch, page: 1 }; push(); load(); };
els.q.addEventListener('input', debounce(() => change({ q: els.q.value.trim() }), 400));
els.genre.addEventListener('change', () => change({ genre: els.genre.value }));
els.sort.addEventListener('change', () => change({ sort: els.sort.value }));
els.clear.addEventListener('click', clearAll);
window.addEventListener('popstate', () => { state = readState(); syncControls(); load(); });

// Genres are optional: if they fail to load the page still works
api('/games/genres').then(({ genres }) => {
  els.genre.insertAdjacentHTML('beforeend', genres.map((g) => `<option value="${esc(g.slug)}">${esc(g.name)}</option>`).join(''));
  els.genre.value = state.genre;
}).catch(() => { els.genre.closest('.field').hidden = true; });

syncControls();
load();
