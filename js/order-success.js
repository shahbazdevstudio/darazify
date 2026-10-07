import { api } from './api.js';
import { mountLayout } from './layout.js';
import { requireLogin } from './auth.js';
import { icon } from './icons.js';
import { esc, formatPrice, getParams, formatDateTime, gameImg, cdn } from './utils.js';
import { statusBadge, errorState, notFoundState } from './components.js';

const root = document.getElementById('successRoot');

(async () => {
  await mountLayout();
  if (!requireLogin()) return;
  const id = getParams().get('id');
  if (!id) { root.innerHTML = notFoundState('Order', '/pages/orders.html', 'My orders'); return; }

  try {
    const { order: o } = await api(`/orders/${encodeURIComponent(id)}`);
    document.title = `Order ${o.orderId} placed — Darazify`;
    root.innerHTML = `
      <div class="success">
        <div class="success__mark" aria-hidden="true">${icon('check', 38)}</div>
        <h1>Order placed successfully</h1>
        <p class="success__id">Order <strong>#${esc(o.orderId)}</strong></p>
        <p class="success__lead">Your order has been received successfully. The seller will contact you shortly regarding your order.</p>
        <div class="success__status"><span>Order status</span>${statusBadge(o.status)}</div>
      </div>
      <div class="cart-layout success__grid">
        <section class="panel">
          <h2>Order summary</h2>
          <ul class="mini-list mini-list--lg">
            ${o.items.map((i) => `<li><span class="mini-list__img">${i.image ? `<img src="${esc(i.itemType === 'game' ? gameImg(i.image, 160) : cdn(i.image, 160))}" alt="">` : icon('bag', 24)}<b>${i.quantity}</b></span><span class="mini-list__name">${esc(i.name)}<small>${formatPrice(i.price)} each</small></span><span>${formatPrice(i.price * i.quantity)}</span></li>`).join('')}
          </ul>
          <dl class="totals"><div><dt>Subtotal</dt><dd>${formatPrice(o.subtotal)}</dd></div><div class="summary__total"><dt>Total amount</dt><dd>${formatPrice(o.total)}</dd></div></dl>
        </section>
        <aside class="panel">
          <h2>Customer information</h2>
          <dl class="info-list">
            <div><dt>Name</dt><dd>${esc(o.customer.name)}</dd></div>
            <div><dt>Phone</dt><dd>${esc(o.customer.phone)}</dd></div>
            <div><dt>Email</dt><dd>${esc(o.customer.email)}</dd></div>
            <div><dt>Address</dt><dd>${esc(o.customer.address)}, ${esc(o.customer.city)}</dd></div>
            <div><dt>Placed on</dt><dd>${formatDateTime(o.createdAt)}</dd></div>
          </dl>
        </aside>
      </div>
      <div class="success__actions">
        <a class="btn btn-lg btn-secondary" href="/pages/games.html">Continue shopping</a>
        <a class="btn btn-lg btn-primary" href="/pages/orders.html?id=${encodeURIComponent(o.orderId)}">View order</a>
      </div>`;
  } catch (err) {
    if (err.status === 404) root.innerHTML = notFoundState('Order', '/pages/orders.html', 'My orders');
    else { root.innerHTML = errorState('Unable to load your order'); root.querySelector('[data-retry]').addEventListener('click', () => window.location.reload()); }
  }
})();
