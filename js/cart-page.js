import { mountLayout } from './layout.js';
import { Cart } from './cart.js';
import { Auth } from './auth.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { esc, formatPrice, gameImg, cdn } from './utils.js';
import { emptyState, qtyStepper, bindQty } from './components.js';

const root = document.getElementById('cartRoot');

const thumb = (i) => (i.image
  ? `<img src="${esc(i.itemType === 'game' ? gameImg(i.image, 200) : cdn(i.image, 200))}" alt="" loading="lazy">`
  : icon(i.itemType === 'game' ? 'gamepad' : 'bag', 28));
const href = (i) => (i.itemType === 'game' ? `/pages/game-details.html?id=${encodeURIComponent(i.itemId)}` : `/pages/product-details.html?id=${encodeURIComponent(i.itemId)}`);

function render() {
  const { items, count, subtotal } = Cart.summary();
  if (!items.length) {
    root.innerHTML = emptyState({
      iconName: 'bag', title: 'Your cart is empty', text: 'Add a game or a leather piece and it will show up here.',
      actions: '<a class="btn btn-signal" href="/pages/games.html">Explore games</a><a class="btn btn-primary" href="/pages/products.html">Shop products</a>',
    });
    return;
  }

  root.innerHTML = `
    <div class="cart-layout">
      <section class="cart-list" aria-label="Cart items">
        ${items.map((i) => `
          <article class="cart-row" data-type="${i.itemType}" data-id="${esc(i.itemId)}">
            <a class="cart-row__img" href="${href(i)}">${thumb(i)}</a>
            <div class="cart-row__info">
              <span class="chip chip--sm">${i.itemType === 'game' ? 'Game' : 'Leather'}</span>
              <h3><a href="${href(i)}">${esc(i.name)}</a></h3>
              <p>${formatPrice(i.price)} each</p>
            </div>
            <div class="cart-row__qty">${qtyStepper(i.quantity)}</div>
            <strong class="cart-row__total">${formatPrice(i.price * i.quantity)}</strong>
            <button class="icon-btn cart-row__remove" data-remove aria-label="Remove ${esc(i.name)}">${icon('trash', 20)}</button>
          </article>`).join('')}
        <a class="btn btn-secondary cart-continue" href="/pages/games.html">Continue shopping</a>
      </section>
      <aside class="summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <dl>
          <div><dt>Items (${count})</dt><dd>${formatPrice(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd class="muted">Arranged by the seller</dd></div>
          <div class="summary__total"><dt>Total</dt><dd>${formatPrice(subtotal)}</dd></div>
        </dl>
        <a class="btn btn-lg btn-primary btn-block" href="/pages/checkout.html">Proceed to checkout</a>
        ${Auth.user ? '' : '<p class="summary__note">You will be asked to log in or create an account at checkout. Your cart is saved.</p>'}
        <p class="summary__note">No online payment. The seller contacts you to confirm your order.</p>
      </aside>
    </div>`;

  root.querySelectorAll('.cart-row').forEach((row) => {
    const { type, id } = row.dataset;
    const run = async (fn, okMsg) => {
      row.classList.add('is-busy');
      try { await fn(); if (okMsg) toast(okMsg, 'success'); } catch (err) { toast(err.message, 'error'); render(); }
    };
    bindQty(row.querySelector('[data-qty]'), (q) => run(() => Cart.setQty(type, id, q)));
    row.querySelector('[data-remove]').addEventListener('click', () => run(() => Cart.remove(type, id), 'Item removed'));
  });
}

(async () => {
  await mountLayout();
  render();
  window.addEventListener('cart:change', render);
})();
