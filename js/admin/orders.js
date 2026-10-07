import { mountAdmin, adminApi, skeletonRows, tableState, openSheet, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog } from '../ui.js';
import { esc, formatPrice, formatDate, formatDateTime, debounce, getParams, gameImg, cdn } from '../utils.js';
import { statusBadge, errorState, renderPagination } from '../components.js';

const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
let state = { search: '', status: '', page: 1 };
let ctl = 0;
let ordersById = {};

const thumb = (i) => (i.image ? `<img src="${esc(i.itemType === 'game' ? gameImg(i.image, 120) : cdn(i.image, 120))}" alt="">` : '');

async function changeStatus(order, status, selectEl) {
  if (status === order.status) return true;
  if (status === 'Cancelled') {
    const ok = await confirmDialog({ title: `Cancel order #${order.orderId}?`, message: 'Stock for its products is returned, and a cancelled order cannot be reopened.', confirmText: 'Cancel order', cancelText: 'Keep order', danger: true });
    if (!ok) { if (selectEl) selectEl.value = order.status; return false; }
  }
  try {
    const { order: updated } = await adminApi(`/admin/orders/${order._id}/status`, { method: 'PATCH', body: { status } });
    Object.assign(order, { status: updated.status, statusHistory: updated.statusHistory });
    toast(`Order #${order.orderId} marked ${status}`, 'success');
    return true;
  } catch (err) {
    if (selectEl) selectEl.value = order.status;
    toast(err.message, 'error');
    return false;
  }
}

const statusSelect = (o, cls = '') => `<select class="select select--sm ${cls}" data-status="${o._id}" aria-label="Change status of ${esc(o.orderId)}" ${o.status === 'Cancelled' ? 'disabled' : ''}>${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`;

const row = (o) => `
  <tr>
    <td data-label="Order"><div><strong>#${esc(o.orderId)}</strong><small>${formatDateTime(o.createdAt)}</small></div></td>
    <td data-label="Customer"><div><strong>${esc(o.customer.name)}</strong><small>${esc(o.customer.phone)} · ${esc(o.customer.city)}</small></div></td>
    <td data-label="Items">${o.items.reduce((n, i) => n + i.quantity, 0)}</td>
    <td data-label="Total"><strong>${formatPrice(o.total)}</strong></td>
    <td data-label="Status">${statusSelect(o)}</td>
    <td class="tbl__actions" data-label="Actions"><button class="btn btn-sm btn-secondary" data-view="${o._id}">View</button></td>
  </tr>`;

async function showOrder(idOrOrderId) {
  const sheet = openSheet({ title: 'Order details', html: skeletonRows(6, 2) });
  try {
    const { order: o } = await adminApi(`/admin/orders/${encodeURIComponent(idOrOrderId)}`);
    const draw = () => {
      sheet.body.innerHTML = `
        <div class="sheet-hero"><div><h3>#${esc(o.orderId)}</h3><p>${formatDateTime(o.createdAt)}</p></div>${statusBadge(o.status)}</div>
        <div class="status-edit"><label for="sheetStatus">Change status</label><div>${statusSelect(o, 'grow')}<button class="btn btn-primary" id="applyStatus" ${o.status === 'Cancelled' ? 'disabled' : ''}>Update</button></div>
          ${o.status === 'Cancelled' ? '<small class="muted">Cancelled orders cannot be changed.</small>' : ''}</div>
        <h4 class="sheet-h">Customer</h4>
        <dl class="info-list info-list--2">
          <div><dt>Name</dt><dd>${esc(o.customer.name)}</dd></div>
          <div><dt>Phone</dt><dd><a class="link" href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></dd></div>
          <div class="full"><dt>Email</dt><dd>${esc(o.customer.email)}</dd></div>
          <div class="full"><dt>Address</dt><dd>${esc(o.customer.address)}, ${esc(o.customer.city)}</dd></div>
          ${o.user ? `<div class="full"><dt>Account</dt><dd>${esc(o.user.name)}${o.user.isBlocked ? ' <span class="status status--cancelled">Blocked</span>' : ''}</dd></div>` : '<div class="full"><dt>Account</dt><dd class="muted">Deleted account</dd></div>'}
        </dl>
        <h4 class="sheet-h">Items</h4>
        <ul class="sheet-list sheet-list--items">${o.items.map((i) => `<li><span class="thumb-sm">${thumb(i)}</span><div><strong>${esc(i.name)}</strong><small>${i.itemType === 'game' ? 'Game' : 'Leather'} · ${formatPrice(i.price)} × ${i.quantity}</small></div><b>${formatPrice(i.price * i.quantity)}</b></li>`).join('')}</ul>
        <div class="sheet-total"><span>Total</span><strong>${formatPrice(o.total)}</strong></div>
        <h4 class="sheet-h">History</h4>
        <ol class="history">${(o.statusHistory || []).slice().reverse().map((h) => `<li>${statusBadge(h.status)}<small>${formatDateTime(h.at)}</small></li>`).join('')}</ol>
        <p class="muted small">WhatsApp notification: ${o.whatsappNotified ? 'sent' : 'not sent'}</p>`;
      const sel = sheet.body.querySelector('[data-status]');
      sheet.body.querySelector('#applyStatus').addEventListener('click', async () => {
        if (await changeStatus(o, sel.value, sel)) { draw(); load(); }
      });
    };
    draw();
  } catch (err) {
    sheet.body.innerHTML = errorState('Unable to load this order');
  }
}

async function load() {
  const my = ++ctl;
  const box = document.getElementById('ordersBox');
  box.innerHTML = skeletonRows(7, 5);
  try {
    const { orders, pagination } = await adminApi('/admin/orders', { params: { search: state.search, status: state.status, page: state.page, limit: 10 } });
    if (my !== ctl) return;
    ordersById = Object.fromEntries(orders.map((o) => [o._id, o]));
    document.getElementById('count').textContent = `${pagination.total} order${pagination.total === 1 ? '' : 's'}`;
    if (!orders.length) { box.innerHTML = tableState('receipt', 'No orders found', state.search || state.status ? 'Try another search or status.' : 'Orders will show up here as soon as customers place them.'); document.getElementById('pager').innerHTML = ''; return; }
    box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${orders.map(row).join('')}</tbody></table></div>`;
    renderPagination(document.getElementById('pager'), pagination, (p) => { state.page = p; load(); });
  } catch (err) {
    if (my !== ctl) return;
    box.innerHTML = errorState('Unable to load orders');
    box.querySelector('[data-retry]').addEventListener('click', load);
  }
}

async function loadTabs() {
  try {
    const d = await adminApi('/admin/stats');
    const counts = { '': d.totalOrders, ...d.statusCounts };
    document.querySelectorAll('[data-tab-status]').forEach((b) => { b.querySelector('small').textContent = counts[b.dataset.tabStatus] ?? 0; });
  } catch { /* counts are optional */ }
}

(async () => {
  const el = await mountAdmin({ active: 'orders', title: 'Orders' });
  el.innerHTML = `
    <div class="toolbar-row">
      <div class="input-icon grow"><span>${icon('search', 18)}</span><input class="input" id="q" type="search" placeholder="Search order ID, customer, phone or email" aria-label="Search orders"></div>
    </div>
    <div class="chips" role="group" aria-label="Filter by status">
      ${[['', 'All'], ...STATUSES.map((s) => [s, s])].map(([v, l]) => `<button class="chip chip--btn ${v === '' ? 'is-on' : ''}" data-tab-status="${v}" aria-pressed="${v === ''}">${l} <small>·</small></button>`).join('')}
    </div>
    <div class="card-box card-box--flush"><div id="ordersBox"></div></div>
    <div class="list-foot"><span id="count" class="muted"></span></div>
    <div id="pager"></div>`;

  el.addEventListener('click', (e) => { const v = e.target.closest('[data-view]'); if (v) showOrder(v.dataset.view); });
  el.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-status]');
    if (!sel) return;
    const o = ordersById[sel.dataset.status];
    if (o && (await changeStatus(o, sel.value, sel))) { loadTabs(); if (state.status) load(); }
  });
  el.querySelectorAll('[data-tab-status]').forEach((b) => b.addEventListener('click', () => {
    state = { ...state, status: b.dataset.tabStatus, page: 1 };
    el.querySelectorAll('[data-tab-status]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    load();
  }));
  document.getElementById('q').addEventListener('input', debounce((e) => { state = { ...state, search: e.target.value.trim(), page: 1 }; load(); }, 350));

  loadTabs();
  await load();
  const open = getParams().get('id');
  if (open) showOrder(open);
})();
