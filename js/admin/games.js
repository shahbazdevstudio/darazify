import { mountAdmin, adminApi, skeletonRows, tableState, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog, setBusy } from '../ui.js';
import { esc, formatDate, debounce, gameImg } from '../utils.js';
import { errorState, renderPagination } from '../components.js';

let state = { search: '', filter: '', page: 1 };
let tab = 'browse';                       // 'browse' (all games) | 'store' (my games)
let cat = { search: '', ordering: '-added', page: 1 };
let catCtl = 0;
let tiles = {};                           // rawg id -> catalogue game (with store state)
let ctl = 0;
let byId = {};
let picked = null;       // game chosen from the suggestions
let suggestions = [];
let active = -1;

const $ = (s) => document.getElementById(s);
const yearOf = (g) => (g.released ? g.released.slice(0, 4) : 'TBA');
const flagSwitch = (name, on, label) => `<label class="switch switch--bare" title="${label}"><input type="checkbox" data-flag="${name}" ${on ? 'checked' : ''} aria-label="${label}"><i></i></label>`;

/* ----------------------------- Catalogue search ----------------------------- */
const closePanel = () => { $('gPanel').hidden = true; active = -1; };

function renderSuggestions(q, list) {
  suggestions = list;
  const panel = $('gPanel');
  if (!list.length) { panel.innerHTML = `<div class="gsug-empty">No games found for “${esc(q)}”. Try the full game title.</div>`; panel.hidden = false; return; }
  panel.innerHTML = list.map((g, i) => `
    <button type="button" class="gsug" role="option" data-i="${i}" ${g.added ? 'disabled' : ''}>
      <span class="gsug__thumb">${g.image ? `<img src="${esc(gameImg(g.image, 160))}" alt="" loading="lazy">` : icon('gamepad', 20)}</span>
      <span class="gsug__text"><strong>${esc(g.name)}</strong><small>${yearOf(g)}${g.genres?.length ? ` · ${esc(g.genres.slice(0, 2).join(', '))}` : ''}${g.rating ? ` · ${Number(g.rating).toFixed(1)} rating` : ''}</small></span>
      ${g.added ? '<span class="gsug__tag">In store</span>' : ''}
    </button>`).join('');
  panel.hidden = false;
}

let searchCtl;
const runSearch = debounce(async () => {
  const q = $('gQuery').value.trim();
  searchCtl?.abort();
  if (q.length < 2) { closePanel(); return; }
  $('gPanel').innerHTML = '<div class="gsug-empty"><span class="spinner spinner--lg"></span></div>';
  $('gPanel').hidden = false;
  searchCtl = new AbortController();
  try {
    const { games } = await adminApi('/admin/games/search', { params: { q }, signal: searchCtl.signal });
    if ($('gQuery').value.trim() !== q) return;
    renderSuggestions(q, games);
  } catch (err) {
    if (err.name === 'AbortError') return;
    $('gPanel').innerHTML = `<div class="gsug-empty">${esc(err.message)}</div>`;
  }
}, 300);

function pick(i) {
  const g = suggestions[i];
  if (!g || g.added) return;
  picked = g;
  closePanel();
  $('gQuery').value = '';
  drawPicked();
}

function drawPicked() {
  const box = $('picked');
  if (!picked) { box.hidden = true; box.innerHTML = ''; return; }
  const g = picked;
  box.hidden = false;
  box.innerHTML = `
    <div class="picked__img">${g.image ? `<img src="${esc(gameImg(g.image, 640))}" alt="${esc(g.name)}">` : ''}</div>
    <div class="picked__body">
      <div><h3>${esc(g.name)}</h3>
        <div class="picked__meta"><span>${yearOf(g)}</span>${g.genres?.length ? `<span>${esc(g.genres.slice(0, 3).join(', '))}</span>` : ''}${g.rating ? `<span>${Number(g.rating).toFixed(1)} rating</span>` : ''}${g.platforms?.length ? `<span>${esc(g.platforms.slice(0, 3).join(', '))}</span>` : ''}</div></div>
      <div class="picked__flags">
        <label class="switch"><input type="checkbox" id="pPopular"><i></i><span><b>Popular games</b><small>Show in the “Popular games” list</small></span></label>
        <label class="switch"><input type="checkbox" id="pLatest"><i></i><span><b>Latest games</b><small>Show in the “Latest games” list</small></span></label>
      </div>
      <div class="picked__actions"><button class="btn btn-primary" id="pAdd">${icon('plus', 16)}<span>Add to store</span></button><button class="btn btn-secondary" id="pCancel">Cancel</button></div>
    </div>`;
  $('pCancel').addEventListener('click', () => { picked = null; drawPicked(); });
  $('pAdd').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true, 'Adding…');
    try {
      await adminApi('/admin/games', { method: 'POST', body: { rawgId: picked.id, isPopular: $('pPopular').checked, isLatest: $('pLatest').checked } });
      toast(`${picked.name} added to the store`, 'success');
      picked = null; drawPicked(); state.page = 1; if (tab === 'store') load(); else loadCatalogue(); refreshCounts();
    } catch (err) { setBusy(btn, false); toast(err.message, 'error'); }
  });
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}


/* --------------------- Browse the whole catalogue --------------------- */
const tileFlags = (g) => `
  <div class="gtile__flags">
    <label class="gtile__flag" title="Show in Popular games"><span>Popular</span><span class="switch switch--bare"><input type="checkbox" data-tflag="isPopular" ${g.isPopular ? 'checked' : ''}><i></i></span></label>
    <label class="gtile__flag" title="Show in Latest games"><span>Latest</span><span class="switch switch--bare"><input type="checkbox" data-tflag="isLatest" ${g.isLatest ? 'checked' : ''}><i></i></span></label>
    <label class="gtile__flag" title="Visible on the website"><span>Visible</span><span class="switch switch--bare"><input type="checkbox" data-tflag="isActive" ${g.isActive ? 'checked' : ''}><i></i></span></label>
  </div>`;

const tileHTML = (g) => `
  <article class="gtile ${g.added ? 'is-added' : ''}" data-rawg="${esc(g.id)}">
    <div class="gtile__img">${g.image ? `<img src="${esc(gameImg(g.image, 420))}" alt="" loading="lazy">` : icon('gamepad', 30)}${g.added ? '<span class="gtile__badge">In store</span>' : ''}</div>
    <div class="gtile__body">
      <h3 title="${esc(g.name)}">${esc(g.name)}</h3>
      <p>${yearOf(g)}${g.genres?.length ? ` · ${esc(g.genres.slice(0, 2).join(', '))}` : ''}${g.rating ? ` · ${Number(g.rating).toFixed(1)}★` : ''}</p>
      ${g.added
        ? `${tileFlags(g)}<button class="btn btn-sm btn-secondary danger-outline" data-tremove>Remove from store</button>`
        : `<button class="btn btn-sm btn-primary" data-tadd>${icon('plus', 15)}<span>Add to store</span></button>`}
    </div>
  </article>`;

async function loadCatalogue() {
  const my = ++catCtl;
  const box = $('catBox');
  box.innerHTML = '<div class="gtiles">' + '<div class="skeleton" style="height:300px;border-radius:18px"></div>'.repeat(8) + '</div>';
  try {
    const { games, pagination } = await adminApi('/admin/games/catalogue', { params: { search: cat.search, ordering: cat.ordering, page: cat.page, pageSize: 24 } });
    if (my !== catCtl) return;
    tiles = Object.fromEntries(games.map((g) => [g.id, g]));
    $('catCount').textContent = `${pagination.total.toLocaleString()} games in the catalogue`;
    if (!games.length) { box.innerHTML = tableState('gamepad', 'No games found', 'Try a different name.'); $('catPager').innerHTML = ''; return; }
    box.innerHTML = `<div class="gtiles">${games.map(tileHTML).join('')}</div>`;
    renderPagination($('catPager'), pagination, (p) => { cat.page = p; loadCatalogue(); window.scrollTo({ top: $('catTop').offsetTop - 80, behavior: 'smooth' }); });
  } catch (err) {
    if (my !== catCtl) return;
    box.innerHTML = errorState(err.message || 'Unable to load the games catalogue');
    box.querySelector('[data-retry]').addEventListener('click', loadCatalogue);
  }
}

const redrawTile = (g) => {
  const el = document.querySelector(`.gtile[data-rawg="${CSS.escape(g.id)}"]`);
  if (el) el.outerHTML = tileHTML(g);
};

async function tileAction(e) {
  const art = e.target.closest('.gtile');
  if (!art) return;
  const g = tiles[art.dataset.rawg];
  if (!g) return;

  if (e.target.closest('[data-tadd]')) {
    const btn = e.target.closest('[data-tadd]');
    setBusy(btn, true, 'Adding…');
    try {
      const { game } = await adminApi('/admin/games', { method: 'POST', body: { rawgId: g.id, isPopular: false, isLatest: false } });
      Object.assign(g, { added: true, storeId: game._id, isPopular: false, isLatest: false, isActive: true });
      redrawTile(g);
      toast(`${g.name} added. Turn on Popular or Latest below it if you want it highlighted.`, 'success', 4500);
      refreshCounts();
    } catch (err) { setBusy(btn, false); toast(err.message, 'error'); }
  }

  if (e.target.closest('[data-tremove]')) {
    const ok = await confirmDialog({ title: `Remove “${g.name}”?`, message: 'It disappears from the website. You can add it again any time.', confirmText: 'Remove game', danger: true });
    if (!ok) return;
    try {
      await adminApi(`/admin/games/${g.storeId}`, { method: 'DELETE' });
      Object.assign(g, { added: false, storeId: null, isPopular: false, isLatest: false, isActive: true });
      redrawTile(g);
      toast('Game removed from the store', 'success');
      refreshCounts();
    } catch (err) { toast(err.message, 'error'); }
  }
}

async function tileToggle(e) {
  const t = e.target.closest('[data-tflag]');
  if (!t) return;
  const g = tiles[t.closest('.gtile').dataset.rawg];
  t.disabled = true;
  try {
    await adminApi(`/admin/games/${g.storeId}`, { method: 'PATCH', body: { [t.dataset.tflag]: t.checked } });
    g[t.dataset.tflag] = t.checked;
    toast(`${g.name}: ${{ isPopular: 'Popular', isLatest: 'Latest', isActive: 'Visible' }[t.dataset.tflag]} ${t.checked ? 'on' : 'off'}`, 'success', 2000);
    refreshCounts();
  } catch (err) { t.checked = !t.checked; toast(err.message, 'error'); }
  t.disabled = false;
}

/* ------------------------------- Store list ------------------------------- */
const row = (g) => `
  <tr data-id="${g._id}">
    <td data-label="Game"><div class="who"><span class="thumb-sm thumb-sm--lg" style="width:76px">${g.image ? `<img src="${esc(gameImg(g.image, 200))}" alt="">` : icon('gamepad', 20)}</span><div><strong>${esc(g.name)}</strong><small>${esc((g.genres || []).slice(0, 2).join(', ')) || '—'}</small></div></div></td>
    <td data-label="Released">${g.released ? formatDate(g.released) : '—'}</td>
    <td data-label="Rating">${g.rating ? Number(g.rating).toFixed(1) : '—'}</td>
    <td class="tgl-cell" data-label="Popular">${flagSwitch('isPopular', g.isPopular, 'Show in Popular games')}</td>
    <td class="tgl-cell" data-label="Latest">${flagSwitch('isLatest', g.isLatest, 'Show in Latest games')}</td>
    <td class="tgl-cell" data-label="Visible">${flagSwitch('isActive', g.isActive, 'Visible in store')}</td>
    <td class="tbl__actions" data-label="Actions"><button class="icon-btn danger-icon" data-del="${g._id}" aria-label="Remove ${esc(g.name)}">${icon('trash', 18)}</button></td>
  </tr>`;

async function refreshCounts() {
  try {
    const { counts } = await adminApi('/admin/games', { params: { limit: 1 } });
    $('tabStoreCount').textContent = counts.all;
    document.querySelectorAll('[data-filter]').forEach((b) => { b.querySelector('small').textContent = counts[b.dataset.filter || 'all'] ?? 0; });
  } catch { /* counts are optional */ }
}

function setTab(next) {
  tab = next;
  document.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('is-on', b.dataset.tab === tab); b.setAttribute('aria-pressed', String(b.dataset.tab === tab)); });
  $('paneBrowse').hidden = tab !== 'browse';
  $('paneStore').hidden = tab !== 'store';
  if (tab === 'store') load(); else loadCatalogue();
}

async function load() {
  const my = ++ctl;
  const box = $('gamesBox');
  box.innerHTML = skeletonRows(6, 5);
  try {
    const { games, counts, pagination } = await adminApi('/admin/games', { params: { search: state.search, filter: state.filter, page: state.page, limit: 10 } });
    if (my !== ctl) return;
    byId = Object.fromEntries(games.map((g) => [g._id, g]));
    document.querySelectorAll('[data-filter]').forEach((b) => { b.querySelector('small').textContent = counts[b.dataset.filter || 'all'] ?? 0; });
    $('count').textContent = `${pagination.total} game${pagination.total === 1 ? '' : 's'}`;
    if (!games.length) {
      box.innerHTML = tableState('gamepad', state.search || state.filter ? 'No games match' : 'No games in your store yet', state.search || state.filter ? 'Try a different search or filter.' : 'Search for a game above and add it. Only games you add are shown on the website.');
      $('pager').innerHTML = '';
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Game</th><th>Released</th><th>Rating</th><th class="tgl-cell">Popular</th><th class="tgl-cell">Latest</th><th class="tgl-cell">Visible</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${games.map(row).join('')}</tbody></table></div>`;
    renderPagination($('pager'), pagination, (p) => { state.page = p; load(); });
  } catch (err) {
    if (my !== ctl) return;
    box.innerHTML = errorState('Unable to load your games');
    box.querySelector('[data-retry]').addEventListener('click', load);
  }
}

(async () => {
  const el = await mountAdmin({ active: 'games', title: 'Games' });
  el.innerHTML = `
    <section class="card-box gadd">
      <header><h2>Add a game to your store</h2></header>
      <p class="gadd__lead">Only the games you add here appear on the website. Type a name, pick the game from the suggestions, then choose where it should be shown.</p>
      <div class="gsearch">
        <span class="gsearch__icon">${icon('search', 20)}</span>
        <input class="input" id="gQuery" type="search" placeholder="Type a game name, e.g. GTA V" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="gPanel" maxlength="80">
        <div class="gsug-panel" id="gPanel" role="listbox" hidden></div>
      </div>
      <div class="picked" id="picked" hidden></div>
    </section>

    <div class="chips" role="group" aria-label="Games views" id="catTop">
      <button class="chip chip--btn is-on" data-tab="browse" aria-pressed="true">Browse all games</button>
      <button class="chip chip--btn" data-tab="store" aria-pressed="false">In your store <small id="tabStoreCount">0</small></button>
    </div>

    <section class="stack" id="paneBrowse">
      <div class="toolbar-row">
        <div class="input-icon grow"><span>${icon('search', 18)}</span><input class="input" id="catQ" type="search" placeholder="Filter the catalogue by name" aria-label="Filter the catalogue"></div>
        <select class="select" id="catSort" aria-label="Sort games"><option value="-added">Most popular</option><option value="-rating">Top rated</option><option value="-released">Newest</option><option value="name">Name A–Z</option></select>
      </div>
      <div id="catBox"></div>
      <div class="list-foot"><span id="catCount" class="muted"></span></div>
      <div id="catPager"></div>
    </section>

    <section class="stack" id="paneStore" hidden>
      <div class="toolbar-row">
        <div class="input-icon grow"><span>${icon('search', 18)}</span><input class="input" id="q" type="search" placeholder="Search games in your store" aria-label="Search games in your store"></div>
      </div>
      <div class="chips" role="group" aria-label="Filter games">
        ${[['', 'All'], ['popular', 'Popular'], ['latest', 'Latest'], ['hidden', 'Hidden']].map(([v, l]) => `<button class="chip chip--btn chip--count ${v === '' ? 'is-on' : ''}" data-filter="${v}" aria-pressed="${v === ''}">${l} <small>0</small></button>`).join('')}
      </div>
      <div class="card-box card-box--flush"><div id="gamesBox"></div></div>
      <div class="list-foot"><span id="count" class="muted"></span></div>
      <div id="pager"></div>
    </section>`;

  const input = $('gQuery');
  input.addEventListener('input', runSearch);
  input.addEventListener('keydown', (e) => {
    const items = [...$('gPanel').querySelectorAll('.gsug:not([disabled])')];
    if (e.key === 'Escape') closePanel();
    if (!items.length || $('gPanel').hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((b, i) => b.classList.toggle('is-active', i === active));
      items[active].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') { e.preventDefault(); (items[active] || items[0]).click(); }
  });
  $('gPanel').addEventListener('click', (e) => { const b = e.target.closest('.gsug'); if (b) pick(Number(b.dataset.i)); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.gsearch')) closePanel(); });

  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    state = { ...state, filter: b.dataset.filter, page: 1 };
    document.querySelectorAll('[data-filter]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    load();
  }));
  $('q').addEventListener('input', debounce((e) => { state = { ...state, search: e.target.value.trim(), page: 1 }; load(); }, 350));

  // Toggle Popular / Latest / Visible directly in the table
  el.addEventListener('change', async (e) => {
    const t = e.target.closest('[data-flag]');
    if (!t) return;
    const tr = t.closest('tr');
    const g = byId[tr.dataset.id];
    const flag = t.dataset.flag;
    t.disabled = true;
    try {
      const { game } = await adminApi(`/admin/games/${g._id}`, { method: 'PATCH', body: { [flag]: t.checked } });
      Object.assign(g, game);
      toast(`${g.name}: ${flag === 'isPopular' ? 'Popular' : flag === 'isLatest' ? 'Latest' : 'Visible'} ${t.checked ? 'on' : 'off'}`, 'success', 2200);
      if (state.filter) load();
      else load().catch(() => {}); // refreshes the counts
    } catch (err) { t.checked = !t.checked; toast(err.message, 'error'); }
    t.disabled = false;
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const g = byId[b.dataset.del];
    const ok = await confirmDialog({ title: `Remove “${g?.name || 'this game'}”?`, message: 'It disappears from the website. Past orders keep their own copy of the game. You can add it again later.', confirmText: 'Remove game', danger: true });
    if (!ok) return;
    try { await adminApi(`/admin/games/${b.dataset.del}`, { method: 'DELETE' }); toast('Game removed from the store', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  });

  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('catQ').addEventListener('input', debounce((e) => { cat = { ...cat, search: e.target.value.trim(), page: 1 }; loadCatalogue(); }, 400));
  $('catSort').addEventListener('change', (e) => { cat = { ...cat, ordering: e.target.value, page: 1 }; loadCatalogue(); });
  $('paneBrowse').addEventListener('click', tileAction);
  $('paneBrowse').addEventListener('change', tileToggle);

  refreshCounts();
  loadCatalogue();
})();
