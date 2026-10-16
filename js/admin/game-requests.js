import { mountAdmin, adminApi, skeletonRows, tableState, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog } from '../ui.js';
import { esc, formatDateTime, debounce } from '../utils.js';
import { errorState, renderPagination } from '../components.js';

const $ = (id) => document.getElementById(id);
const FILTERS = [['', 'All'], ['new', 'New'], ['added', 'Added'], ['rejected', 'Rejected']];
const BADGE = { new: 'pending', added: 'delivered', rejected: 'cancelled' };
let state = { status: '', search: '', page: 1 };
let byId = {};
let seq = 0;

const contactLink = (c) => (c.includes('@') ? `<a href="mailto:${esc(c)}">${esc(c)}</a>` : `<a href="https://wa.me/${esc(c.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c)}</a>`);

const row = (r) => `
  <tr data-id="${r._id}">
    <td data-label="Game"><strong>${esc(r.gameName)}</strong>${r.note ? `<small>${esc(r.note)}</small>` : ''}</td>
    <td data-label="From">${esc(r.name) || '<span class="muted">Anonymous</span>'}<small>${contactLink(r.contact)}</small></td>
    <td data-label="Requested">${formatDateTime(r.createdAt)}</td>
    <td data-label="Status"><span class="status status--${BADGE[r.status]}">${r.status}</span></td>
    <td data-label="Actions" class="tbl__actions">
      <select class="select select--sm" data-status aria-label="Status of ${esc(r.gameName)}">${['new', 'added', 'rejected'].map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>
      <button class="icon-btn danger-icon" data-del aria-label="Delete request">${icon('trash', 18)}</button>
    </td>
  </tr>`;

async function load() {
  const my = ++seq;
  const box = $('reqBox');
  box.innerHTML = skeletonRows(6, 5);
  try {
    const { requests, counts, pagination } = await adminApi('/admin/game-requests', { params: { ...state, limit: 12 } });
    if (my !== seq) return;
    byId = Object.fromEntries(requests.map((r) => [r._id, r]));
    document.querySelectorAll('[data-filter]').forEach((b) => { b.querySelector('small').textContent = counts[b.dataset.filter || 'all'] ?? 0; });
    if (!requests.length) {
      box.innerHTML = tableState('chat', state.search || state.status ? 'No requests match' : 'No game requests yet', state.search || state.status ? 'Try a different search or filter.' : 'When a visitor asks for a game from the Games page, it shows up here.');
      $('pager').innerHTML = '';
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Game</th><th>From</th><th>Requested</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${requests.map(row).join('')}</tbody></table></div>`;
    renderPagination($('pager'), pagination, (p) => { state.page = p; load(); });
  } catch {
    if (my !== seq) return;
    box.innerHTML = errorState('Unable to load requests');
    box.querySelector('[data-retry]').addEventListener('click', load);
  }
}

(async () => {
  const el = await mountAdmin({ active: 'requests', title: 'Game requests' });
  el.innerHTML = `
    <section class="card-box">
      <header><h2>Requested games</h2></header>
      <p class="gadd__lead">Games your visitors asked for. After you add one to the store, mark it <b>Added</b>. Tap a contact to reply by email or WhatsApp.</p>
      <div class="toolbar-row">
        <div class="input-icon grow"><span>${icon('search', 18)}</span><input class="input" id="rq" type="search" placeholder="Search by game name" aria-label="Search requests"></div>
      </div>
      <div class="chips" role="group" aria-label="Request status">${FILTERS.map(([v, l], i) => `<button class="chip chip--btn ${i ? '' : 'is-on'}" data-filter="${v}" aria-pressed="${!i}">${l} <small>0</small></button>`).join('')}</div>
    </section>
    <section class="card-box card-box--flush"><div id="reqBox"></div></section>
    <div id="pager"></div>`;

  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    state = { ...state, status: b.dataset.filter, page: 1 };
    document.querySelectorAll('[data-filter]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    load();
  }));
  $('rq').addEventListener('input', debounce((e) => { state = { ...state, search: e.target.value.trim(), page: 1 }; load(); }, 350));

  $('reqBox').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    sel.disabled = true;
    try { await adminApi(`/admin/game-requests/${sel.closest('tr').dataset.id}`, { method: 'PATCH', body: { status: sel.value } }); toast('Request updated', 'success', 2000); } catch (err) { toast(err.message, 'error'); }
    load();
  });
  $('reqBox').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const r = byId[b.closest('tr').dataset.id];
    const ok = await confirmDialog({ title: `Delete the request for “${r?.gameName}”?`, message: 'This cannot be undone.', confirmText: 'Delete request', danger: true });
    if (!ok) return;
    try { await adminApi(`/admin/game-requests/${r._id}`, { method: 'DELETE' }); toast('Request deleted', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  });
  load();
})();
