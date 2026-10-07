import { api } from './api.js';
import { mountLayout } from './layout.js';
import { requireLogin } from './auth.js';
import { icon } from './icons.js';
import { toast, confirmDialog } from './ui.js';
import { esc, formatPrice, formatDate, formatDateTime, getParams, setParams, gameImg, cdn } from './utils.js';
import { statusBadge, emptyState, errorState, notFoundState, skeletonCards, renderPagination } from './components.js';

const root = document.getElementById('ordersRoot');
const FLOW = ['Pending', 'Processing', 'Shipped', 'Delivered'];
const NOTE = {
  Pending: 'Seller will contact you shortly.',
  Processing: 'Your order is being prepared.',
  Shipped: 'Your order is on its way.',
  Delivered: 'Delivered. Thank you for shopping with Darazify.',
  Cancelled: 'This order was cancelled.',
};
const img = (i) => (i.image ? `<img src="${esc(i.itemType === 'game' ? gameImg(i.image, 160) : cdn(i.image, 160))}" alt="" loading="lazy">` : icon(i.itemType === 'game' ? 'gamepad' : 'bag', 22));

/* ------------------------------- List ------------------------------- */
async function showList(page = 1) {
  document.title = 'My orders — Darazify';
  root.innerHTML = `<div class="orders-list">${'<div class="skeleton" style="height:150px;border-radius:20px"></div>'.repeat(3)}</div>`;
  try {
    const { orders, pagination } = await api('/orders', { params: { page, limit: 8 } });
    if (!orders.length) {
      root.innerHTML = emptyState({ iconName: 'receipt', title: 'No orders yet', text: 'When you place an order it will show up here with its status.', actions: '<a class="btn btn-signal" href="/pages/games.html">Explore games</a><a class="btn btn-primary" href="/pages/products.html">Shop products</a>' });
      return;
    }
    root.innerHTML = `<div class="orders-list">${orders.map((o) => `
      <article class="order-card">
        <header>
          <div><h3>Order #${esc(o.orderId)}</h3><p>${formatDate(o.createdAt)}</p></div>
          ${statusBadge(o.status)}
        </header>
        <div class="order-card__items">
          ${o.items.slice(0, 4).map((i) => `<span class="mini-list__img" title="${esc(i.name)}">${img(i)}<b>${i.quantity}</b></span>`).join('')}
          ${o.items.length > 4 ? `<span class="order-card__more">+${o.items.length - 4}</span>` : ''}
          <span class="order-card__count">${o.items.reduce((n, i) => n + i.quantity, 0)} item${o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'}</span>
        </div>
        <footer>
          <p class="order-card__note">${NOTE[o.status] || ''}</p>
          <div><strong>${formatPrice(o.total)}</strong><a class="btn btn-sm btn-secondary" href="/pages/orders.html?id=${encodeURIComponent(o.orderId)}">View details</a></div>
        </footer>
      </article>`).join('')}</div><div id="pager"></div>`;
    renderPagination(document.getElementById('pager'), pagination, (p) => { setParams({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); showList(p); });
  } catch (err) {
    root.innerHTML = errorState('Unable to load your orders');
    root.querySelector('[data-retry]').addEventListener('click', () => showList(page));
  }
}

/* ------------------------------ Detail ------------------------------ */
async function showDetail(id) {
  root.innerHTML = '<div class="skeleton" style="height:380px;border-radius:20px"></div>';
  try {
    const { order: o } = await api(`/orders/${encodeURIComponent(id)}`);
    document.title = `Order ${o.orderId} — Darazify`;
    const cancelled = o.status === 'Cancelled';
    const idx = FLOW.indexOf(o.status);
    const when = Object.fromEntries((o.statusHistory || []).map((h) => [h.status, h.at]));

    root.innerHTML = `
      <a class="link-btn back-link" href="/pages/orders.html">${icon('left', 16)} All orders</a>
      <div class="order-head"><div><h2>Order #${esc(o.orderId)}</h2><p>Placed ${formatDateTime(o.createdAt)}</p></div>${statusBadge(o.status)}</div>
      <p class="order-note ${cancelled ? 'is-cancelled' : ''}">${NOTE[o.status]}</p>
      ${cancelled ? '' : `<ol class="timeline" aria-label="Order progress">${FLOW.map((s, i) => `<li class="${i < idx ? 'is-done' : ''} ${i === idx ? 'is-current' : ''}"><span class="timeline__dot">${i <= idx ? icon('check', 14) : ''}</span><strong>${s}</strong><small>${when[s] ? formatDate(when[s]) : ''}</small></li>`).join('')}</ol>`}
      <div class="cart-layout success__grid">
        <section class="panel"><h3>Items</h3>
          <ul class="mini-list mini-list--lg">${o.items.map((i) => `<li><span class="mini-list__img">${img(i)}<b>${i.quantity}</b></span><span class="mini-list__name">${esc(i.name)}<small>${formatPrice(i.price)} each</small></span><span>${formatPrice(i.price * i.quantity)}</span></li>`).join('')}</ul>
          <dl class="totals"><div class="summary__total"><dt>Total</dt><dd>${formatPrice(o.total)}</dd></div></dl>
        </section>
        <aside class="panel"><h3>Delivery details</h3>
          <dl class="info-list"><div><dt>Name</dt><dd>${esc(o.customer.name)}</dd></div><div><dt>Phone</dt><dd>${esc(o.customer.phone)}</dd></div><div><dt>Address</dt><dd>${esc(o.customer.address)}, ${esc(o.customer.city)}</dd></div><div><dt>Email</dt><dd>${esc(o.customer.email)}</dd></div></dl>
          ${o.status === 'Pending' ? `<button class="btn btn-secondary btn-block danger-outline" id="cancelBtn">Cancel order</button>` : ''}
        </aside>
      </div>`;

    document.getElementById('cancelBtn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Cancel this order?', message: `Order #${o.orderId} will be cancelled. You can place a new order any time.`, confirmText: 'Cancel order', cancelText: 'Keep order', danger: true });
      if (!ok) return;
      try { await api(`/orders/${encodeURIComponent(o.orderId)}/cancel`, { method: 'PATCH' }); toast('Order cancelled', 'success'); showDetail(id); } catch (err) { toast(err.message, 'error'); }
    });
  } catch (err) {
    if (err.status === 404) root.innerHTML = notFoundState('Order', '/pages/orders.html', 'My orders');
    else { root.innerHTML = errorState('Unable to load this order'); root.querySelector('[data-retry]').addEventListener('click', () => showDetail(id)); }
  }
}

(async () => {
  await mountLayout();
  if (!requireLogin()) return;
  const id = getParams().get('id');
  if (id) showDetail(id); else showList(Math.max(1, parseInt(getParams().get('page'), 10) || 1));
})();
