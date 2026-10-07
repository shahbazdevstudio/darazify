import { api, isAbort } from './api.js';
import { mountLayout } from './layout.js';
import { gameCard, skeletonCards, emptyState, errorState, renderPagination } from './components.js';
import { getParams, setParams, debounce, esc } from './utils.js';
import { PAGE_SIZE } from './config.js';

mountLayout();

const $ = (s) => document.querySelector(s);
const els = { grid: $('#gamesGrid'), pager: $('#pager'), q: $('#fSearch'), genre: $('#fGenre'), sort: $('#fSort'), count: $('#resultCount'), clear: $('#clearFilters') };

const readState = () => {
  const p = getParams();
  return { q: p.get('q') || '', genre: p.get('genre') || '', sort: p.get('sort') || '', page: Math.max(1, parseInt(p.get('page'), 10) || 1) };
};
let state = readState();
let controller;

const syncControls = () => {
  els.q.value = state.q;
  els.genre.value = state.genre;
  els.sort.value = state.sort;
  els.clear.hidden = !(state.q || state.genre || state.sort);
};

async function load({ scroll = false } = {}) {
  controller?.abort();
  controller = new AbortController();
  els.grid.innerHTML = skeletonCards(PAGE_SIZE.games, 'game');
  els.grid.setAttribute('aria-busy', 'true');
  els.pager.innerHTML = '';
  if (scroll) window.scrollTo({ top: $('#results').offsetTop - 110, behavior: 'smooth' });

  try {
    const { games, pagination } = await api('/games', {
      params: { search: state.q, genres: state.genre, ordering: state.sort, page: state.page, pageSize: PAGE_SIZE.games },
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
const clearAll = () => { state = { q: '', genre: '', sort: '', page: 1 }; push(); load(); };

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
