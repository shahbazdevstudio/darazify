import { mountAdmin, adminApi, skeletonRows, tableState, userBadge, openSheet, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog } from '../ui.js';
import { esc, formatPrice, formatDate, debounce } from '../utils.js';
import { statusBadge, errorState, renderPagination } from '../components.js';

let state = { search: '', status: '', page: 1 };
let ctl = 0;
let usersById = {};
let el;

const rowHTML = (u) => `
  <tr>
    <td data-label="User"><div class="who"><span class="avatar-sm">${esc(u.name.slice(0, 1).toUpperCase())}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div></div></td>
    <td data-label="Phone">${esc(u.phone) || '<span class="muted">Not added</span>'}</td>
    <td data-label="Orders">${u.orderCount}</td>
    <td data-label="Joined">${formatDate(u.createdAt)}</td>
    <td data-label="Status">${userBadge(u)}</td>
    <td class="tbl__actions" data-label="Actions">
      <button class="btn btn-sm btn-secondary" data-act="view" data-id="${u._id}">View</button>
      <button class="btn btn-sm btn-secondary ${u.isBlocked ? '' : 'danger-outline'}" data-act="${u.isBlocked ? 'unblock' : 'block'}" data-id="${u._id}">${u.isBlocked ? 'Unblock' : 'Block'}</button>
      <button class="icon-btn danger-icon" data-act="delete" data-id="${u._id}" aria-label="Delete ${esc(u.name)}">${icon('trash', 18)}</button>
    </td>
  </tr>`;

async function load() {
  const my = ++ctl;
  const box = document.getElementById('usersBox');
  box.innerHTML = skeletonRows(7, 5);
  try {
    const { users, pagination } = await adminApi('/admin/users', { params: { search: state.search, status: state.status, page: state.page, limit: 10 } });
    if (my !== ctl) return;
    usersById = Object.fromEntries(users.map((u) => [u._id, u]));
    if (!users.length) { box.innerHTML = tableState('users', 'No users found', state.search || state.status ? 'Try a different search or filter.' : 'Customers will appear here after they sign up.'); document.getElementById('pager').innerHTML = ''; return; }
    box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>User</th><th>Phone</th><th>Orders</th><th>Joined</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${users.map(rowHTML).join('')}</tbody></table></div>`;
    document.getElementById('count').textContent = `${pagination.total} user${pagination.total === 1 ? '' : 's'}`;
    renderPagination(document.getElementById('pager'), pagination, (p) => { state.page = p; load(); });
  } catch (err) {
    if (my !== ctl) return;
    box.innerHTML = errorState('Unable to load users');
    box.querySelector('[data-retry]').addEventListener('click', load);
  }
}

async function showUser(id) {
  const sheet = openSheet({ title: 'User details', html: skeletonRows(5, 2) });
  try {
    const { user: u, orders, totalSpent } = await adminApi(`/admin/users/${id}`);
    sheet.body.innerHTML = `
      <div class="sheet-hero"><span class="avatar-sm avatar-sm--lg">${esc(u.name.slice(0, 1).toUpperCase())}</span><div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p></div>${userBadge(u)}</div>
      <dl class="info-list info-list--2">
        <div><dt>Phone</dt><dd>${esc(u.phone) || '—'}</dd></div><div><dt>City</dt><dd>${esc(u.city) || '—'}</dd></div>
        <div class="full"><dt>Address</dt><dd>${esc(u.address) || '—'}</dd></div>
        <div><dt>Joined</dt><dd>${formatDate(u.createdAt)}</dd></div><div><dt>Last login</dt><dd>${u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</dd></div>
        <div><dt>Orders</dt><dd>${orders.length}</dd></div><div><dt>Total spent</dt><dd>${formatPrice(totalSpent)}</dd></div>
      </dl>
      <h4 class="sheet-h">Orders</h4>
      ${orders.length ? `<ul class="sheet-list">${orders.map((o) => `<li><div><a class="link" href="/admin/orders.html?id=${esc(o.orderId)}">#${esc(o.orderId)}</a><small>${formatDate(o.createdAt)} · ${o.items.reduce((n, i) => n + i.quantity, 0)} items</small></div><div class="sheet-list__r"><b>${formatPrice(o.total)}</b>${statusBadge(o.status)}</div></li>`).join('')}</ul>` : '<p class="muted">This user has not placed any orders.</p>'}`;
  } catch (err) {
    sheet.body.innerHTML = errorState('Unable to load this user');
  }
}

async function act(kind, id) {
  if (kind === 'view') return showUser(id);
  const u = usersById[id];
  const name = u?.name || 'this user';
  const cfg = {
    block: { title: `Block ${name}?`, message: 'They will not be able to log in, use their cart or place orders until you unblock them.', confirmText: 'Block user', danger: true, req: { method: 'PATCH', path: `/admin/users/${id}/block` }, done: 'User blocked' },
    unblock: { title: `Unblock ${name}?`, message: 'They will be able to log in and place orders again.', confirmText: 'Unblock', danger: false, req: { method: 'PATCH', path: `/admin/users/${id}/unblock` }, done: 'User unblocked' },
    delete: { title: `Delete ${name}?`, message: 'This permanently removes the account and cart. Their past orders are kept for your records. This cannot be undone.', confirmText: 'Delete user', danger: true, req: { method: 'DELETE', path: `/admin/users/${id}` }, done: 'User deleted' },
  }[kind];
  if (!(await confirmDialog(cfg))) return;
  try { await adminApi(cfg.req.path, { method: cfg.req.method }); toast(cfg.done, 'success'); load(); } catch (err) { toast(err.message, 'error'); }
}

(async () => {
  el = await mountAdmin({ active: 'users', title: 'Users' });
  el.innerHTML = `
    <div class="toolbar-row">
      <div class="input-icon grow"><span>${icon('search', 18)}</span><input class="input" id="q" type="search" placeholder="Search by name, email or phone" aria-label="Search users"></div>
      <select class="select" id="status" aria-label="Filter by status"><option value="">All users</option><option value="active">Active</option><option value="blocked">Blocked</option></select>
    </div>
    <div class="card-box card-box--flush"><div id="usersBox"></div></div>
    <div class="list-foot"><span id="count" class="muted"></span></div>
    <div id="pager"></div>`;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset.id); });
  document.getElementById('q').addEventListener('input', debounce((e) => { state = { ...state, search: e.target.value.trim(), page: 1 }; load(); }, 350));
  document.getElementById('status').addEventListener('change', (e) => { state = { ...state, status: e.target.value, page: 1 }; load(); });
  await load();
})();
