import { mountAdmin, adminApi, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog } from '../ui.js';
import { esc, gameImg } from '../utils.js';
import { errorState, renderPagination } from '../components.js';
import { PAGE_SIZE } from '../config.js';

const TABS = {
  hero: { limit: 3, label: 'Featured banner', hint: 'The games in the big home page banner (max 3). Position 1 is shown first.', empty: 'No game is in the banner yet. Turn on <b>Hero</b> for a game in Games → In your store.' },
  popular: { limit: 10, label: 'Popular games', hint: 'The order of the Popular games section on the home page. The home page shows the first 10.', empty: 'No popular games yet. Turn on <b>Popular</b> for a game in Games → In your store.' },
  all: { limit: PAGE_SIZE.games, label: 'All games', hint: `The order of the Games page. Each block below is one page of the website (${PAGE_SIZE.games} games per page). Games without a number follow the numbered ones in the default order (newest first).`, empty: 'No games in the store yet.' },
};

const $ = (id) => document.getElementById(id);
let tab = 'hero';
let page = 1;
let games = [];
let total = 0;
let busy = false;
let seq = 0;

const limitOf = () => TABS[tab].limit;
/** Where this position ends up on the website. */
const where = (pos) => {
  if (tab === 'all') return ` · Website page ${Math.ceil(pos / limitOf())}`;
  return pos <= limitOf() ? ' · Shown on the home page' : ' · Not shown on the home page';
};
const sep = (pos) => (tab === 'all' && (pos - 1) % limitOf() === 0 ? `<li class="rk-sep" aria-hidden="true">Website page ${Math.ceil(pos / limitOf())}</li>` : '');

const row = (g) => sep(g.position) + `
  <li class="rk-row ${g.pinned ? 'is-pinned' : ''}" data-id="${g._id}" data-pos="${g.position}">
    <span class="rk-grip" aria-hidden="true">${icon('grip', 18)}</span>
    <input class="input rk-num" type="number" inputmode="numeric" min="1" step="1" value="${g.position}" aria-label="Position of ${esc(g.name)}">
    <img class="rk-img" src="${esc(gameImg(g.image, 160) || '')}" alt="" width="80" height="45" loading="lazy" draggable="false">
    <span class="rk-name"><strong>${esc(g.name)}</strong><small>${g.pinned ? 'Fixed position' : 'Default order'}${g.isCustom ? ' · Custom' : ''}${where(g.position)}</small></span>
    <span class="rk-actions">
      <button class="icon-btn" data-step="-1" aria-label="Move ${esc(g.name)} up" ${g.position <= 1 ? 'disabled' : ''}>${icon('up', 18)}</button>
      <button class="icon-btn" data-step="1" aria-label="Move ${esc(g.name)} down" ${g.position >= total ? 'disabled' : ''}>${icon('down', 18)}</button>
      ${g.pinned ? `<button class="icon-btn" data-unpin aria-label="Back to default order for ${esc(g.name)}" title="Back to default order">${icon('refresh', 16)}</button>` : ''}
    </span>
  </li>`;

async function load() {
  const my = ++seq;
  const box = $('rkBox');
  box.classList.add('is-busy');
  try {
    const d = await adminApi(`/admin/games/ranking/${tab}`, { params: { page, limit: limitOf() } });
    if (my !== seq) return;
    if (page > 1 && !d.games.length) { page = Math.max(1, d.pagination.totalPages); return load(); }
    games = d.games;
    total = d.pagination.total;
    $('rkMeta').textContent = `${total} game${total === 1 ? '' : 's'} · ${d.pinned} with a fixed position`;
    $('rkReset').hidden = !d.pinned;
    box.innerHTML = games.length ? `<ol class="rk-list" id="rkList">${games.map(row).join('')}</ol>` : `<p class="muted rk-empty">${TABS[tab].empty}</p>`;
    renderPagination($('pager'), d.pagination, (p) => { page = p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  } catch {
    if (my !== seq) return;
    box.innerHTML = errorState('Unable to load the ranking');
    box.querySelector('[data-retry]').addEventListener('click', load);
  } finally {
    if (my === seq) box.classList.remove('is-busy');
  }
}

/** One call does every kind of move: typing a number, the arrows and drag and drop. */
async function move(id, position) {
  if (busy) return;
  busy = true;
  try {
    const { position: final } = await adminApi(`/admin/games/ranking/${tab}/${id}`, { method: 'PUT', body: { position } });
    toast(`Moved to position ${final}`, 'success', 1800);
    page = Math.ceil(final / limitOf()); // follow the game to its new page
  } catch (err) { toast(err.message, 'error'); }
  busy = false;
  await load();
}

(async () => {
  const el = await mountAdmin({ active: 'ranking', title: 'Game ranking', actions: '<a class="btn btn-secondary btn-sm" href="/admin/games.html">Back to games</a>' });
  el.innerHTML = `
    <section class="card-box">
      <div class="chips" role="tablist" aria-label="Ranking list">${Object.entries(TABS).map(([k, t]) => `<button class="chip chip--btn ${k === tab ? 'is-on' : ''}" role="tab" data-tab="${k}" aria-selected="${k === tab}">${t.label}</button>`).join('')}</div>
      <p class="gadd__lead" id="rkHint"></p>
      <p class="gadd__lead"><b>How to use:</b> drag a game, type its position number, or use the arrows. The game takes that exact place and the others move one step. Other games never change place on their own.</p>
      <div class="rk-bar"><span class="muted" id="rkMeta"></span><button class="btn btn-sm btn-secondary" id="rkReset" hidden>Reset to default order</button></div>
    </section>
    <section class="card-box card-box--flush"><div id="rkBox"><div class="skeleton" style="height:320px"></div></div></section>
    <div id="pager"></div>`;
  $('rkHint').textContent = TABS[tab].hint;

  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === tab) return;
    tab = b.dataset.tab; page = 1;
    document.querySelectorAll('[data-tab]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    $('rkHint').textContent = TABS[tab].hint;
    load();
  }));

  const box = $('rkBox');
  box.addEventListener('change', (e) => {
    const input = e.target.closest('.rk-num');
    if (!input) return;
    const r = input.closest('.rk-row');
    const pos = Number(input.value);
    if (!Number.isInteger(pos) || pos < 1) { input.value = r.dataset.pos; return toast('Enter a position number, like 1, 2 or 3', 'error'); }
    if (pos === Number(r.dataset.pos)) return;
    move(r.dataset.id, pos);
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.rk-num')) e.target.blur(); });
  box.addEventListener('click', async (e) => {
    const r = e.target.closest('.rk-row');
    if (!r) return;
    const step = e.target.closest('[data-step]');
    if (step) return move(r.dataset.id, Number(r.dataset.pos) + Number(step.dataset.step));
    if (e.target.closest('[data-unpin]')) {
      try { await adminApi(`/admin/games/ranking/${tab}/${r.dataset.id}`, { method: 'DELETE' }); toast('Back to the default order', 'success', 1800); } catch (err) { toast(err.message, 'error'); }
      load();
    }
  });

  // Drag and drop: dropping on a row gives the dragged game that row's position.
  // A row is draggable only when a mouse press starts outside the number box and the buttons
  // (a draggable parent breaks typing inside inputs in Firefox).
  box.addEventListener('pointerdown', (e) => {
    const r = e.target.closest?.('.rk-row');
    if (r) r.draggable = e.pointerType === 'mouse' && !e.target.closest('input, button');
  });
  let dragId = null;
  box.addEventListener('dragstart', (e) => { const r = e.target.closest?.('.rk-row'); if (!r || e.target.closest('.rk-num')) return; dragId = r.dataset.id; r.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
  box.addEventListener('dragend', () => { dragId = null; box.querySelectorAll('.rk-row[draggable="true"]').forEach((n) => { n.draggable = false; }); box.querySelectorAll('.is-dragging, .is-over').forEach((n) => n.classList.remove('is-dragging', 'is-over')); });
  box.addEventListener('dragover', (e) => { const r = e.target.closest('.rk-row'); if (!r || !dragId) return; e.preventDefault(); box.querySelectorAll('.is-over').forEach((n) => n !== r && n.classList.remove('is-over')); r.classList.add('is-over'); });
  box.addEventListener('drop', (e) => {
    const r = e.target.closest('.rk-row');
    if (!r || !dragId) return;
    e.preventDefault();
    const id = dragId;
    if (id !== r.dataset.id) move(id, Number(r.dataset.pos));
  });

  $('rkReset').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Reset “${TABS[tab].label}”?`, message: 'All fixed positions in this list are removed and the games go back to the default order.', confirmText: 'Reset order', danger: true });
    if (!ok) return;
    try { await adminApi(`/admin/games/ranking/${tab}`, { method: 'DELETE' }); toast('The list is back to its default order', 'success'); page = 1; } catch (err) { toast(err.message, 'error'); }
    load();
  });

  load();
})();
