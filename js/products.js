import { api, isAbort } from './api.js';
import { mountLayout } from './layout.js';
import { productCard, skeletonCards, emptyState, errorState, renderPagination } from './components.js';
import { getParams, setParams, debounce, esc } from './utils.js';
import { PAGE_SIZE } from './config.js';

mountLayout();

const $ = (s) => document.querySelector(s);
const els = { grid: $('#productsGrid'), pager: $('#pager'), q: $('#fSearch'), sort: $('#fSort'), cats: $('#catChips'), count: $('#resultCount'), clear: $('#clearFilters') };

const readState = () => {
  const p = getParams();
  return { q: p.get('q') || '', category: p.get('category') || '', sort: p.get('sort') || '', page: Math.max(1, parseInt(p.get('page'), 10) || 1) };
};
let state = readState();
let controller;

const syncControls = () => {
  els.q.value = state.q;
  els.sort.value = state.sort || 'newest';
  els.clear.hidden = !(state.q || state.category || (state.sort && state.sort !== 'newest'));
  els.cats.querySelectorAll('[data-cat]').forEach((c) => {
    const on = c.dataset.cat === state.category;
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-pressed', String(on));
  });
};

async function load({ scroll = false } = {}) {
  controller?.abort();
  controller = new AbortController();
  els.grid.innerHTML = skeletonCards(PAGE_SIZE.products, 'product');
  els.grid.setAttribute('aria-busy', 'true');
  els.pager.innerHTML = '';
  if (scroll) window.scrollTo({ top: $('#results').offsetTop - 110, behavior: 'smooth' });

  try {
    const { products, pagination } = await api('/products', {
      params: { search: state.q, category: state.category, sort: state.sort || 'newest', page: state.page, limit: PAGE_SIZE.products },
      signal: controller.signal,
    });
    if (!products.length) {
      els.count.textContent = 'No results';
      const filtered = state.q || state.category;
      els.grid.innerHTML = emptyState({
        iconName: 'bag', title: filtered ? 'No products found' : 'No products yet',
        text: filtered ? 'Try another search or clear the filters.' : 'New leather pieces will appear here soon.',
        actions: filtered ? '<button class="btn btn-primary" data-clear>Clear filters</button>' : '<a class="btn btn-primary" href="/pages/games.html">Explore games</a>',
      });
      els.grid.querySelector('[data-clear]')?.addEventListener('click', clearAll);
      return;
    }
    els.count.textContent = `${pagination.total} product${pagination.total === 1 ? '' : 's'}${pagination.totalPages > 1 ? ` · page ${pagination.page} of ${pagination.totalPages}` : ''}`;
    els.grid.innerHTML = products.map(productCard).join('');
    renderPagination(els.pager, pagination, (page) => { state.page = page; push(); load({ scroll: true }); });
  } catch (err) {
    if (isAbort(err)) return;
    els.count.textContent = '';
    els.grid.innerHTML = errorState('Unable to load products');
    els.grid.querySelector('[data-retry]').addEventListener('click', () => load());
  } finally {
    els.grid.removeAttribute('aria-busy');
  }
}

const push = () => { setParams(state); syncControls(); };
const clearAll = () => { state = { q: '', category: '', sort: '', page: 1 }; push(); load(); };
const change = (patch) => { state = { ...state, ...patch, page: 1 }; push(); load(); };

els.q.addEventListener('input', debounce(() => change({ q: els.q.value.trim() }), 400));
els.sort.addEventListener('change', () => change({ sort: els.sort.value }));
els.clear.addEventListener('click', clearAll);
els.cats.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-cat]');
  if (chip) change({ category: chip.dataset.cat });
});
window.addEventListener('popstate', () => { state = readState(); syncControls(); load(); });

api('/products/categories').then(({ categories }) => {
  els.cats.insertAdjacentHTML('beforeend', categories.map((c) => `<button class="chip chip--btn" data-cat="${esc(c.name)}" aria-pressed="false">${esc(c.name)} <small>${c.count}</small></button>`).join(''));
  syncControls();
}).catch(() => {});

syncControls();
load();
