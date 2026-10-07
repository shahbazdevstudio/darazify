import { api } from './api.js';
import { mountLayout } from './layout.js';
import { Cart } from './cart.js';
import { Auth, requireLogin } from './auth.js';
import { icon } from './icons.js';
import { setBusy, toast } from './ui.js';
import { esc, formatPrice, gameImg, cdn, getParams } from './utils.js';
import { emptyState } from './components.js';
import { rules, validate, formAlert, applyServerErrors } from './forms.js';

const root = document.getElementById('checkoutRoot');
const DELIVERY_MSG = 'Please complete your delivery information before placing your order.';

const readBuyNow = () => {
  if (getParams().get('mode') !== 'buynow') return null;
  try { return JSON.parse(sessionStorage.getItem('dz_buynow')); } catch { return null; }
};

const thumb = (i) => (i.image ? `<img src="${esc(i.itemType === 'game' ? gameImg(i.image, 160) : cdn(i.image, 160))}" alt="" loading="lazy">` : icon(i.itemType === 'game' ? 'gamepad' : 'bag', 24));

(async () => {
  await mountLayout();
  if (!requireLogin()) return;

  const buyNow = readBuyNow();
  const lines = buyNow ? [buyNow] : Cart.items;
  if (!lines.length) {
    root.innerHTML = emptyState({ iconName: 'bag', title: 'Nothing to check out', text: 'Your cart is empty. Add a game or a leather piece first.', actions: '<a class="btn btn-signal" href="/pages/games.html">Explore games</a><a class="btn btn-primary" href="/pages/products.html">Shop products</a>' });
    return;
  }

  // Always use the freshest profile for delivery details
  let user = Auth.user;
  try { user = (await api('/users/me')).user; Auth.setUser(user); } catch { /* fall back to cached */ }

  const total = lines.reduce((n, i) => n + i.price * i.quantity, 0);
  const count = lines.reduce((n, i) => n + i.quantity, 0);
  const complete = Boolean(user.name && user.phone && user.address && user.city);
  let editing = !complete;

  const draw = () => {
    root.innerHTML = `
    <div class="cart-layout">
      <section class="panel" aria-labelledby="delTitle">
        <div class="panel__head"><h2 id="delTitle">Delivery information</h2>${complete && !editing ? `<button class="btn btn-secondary btn-sm" id="editBtn">${icon('edit', 16)}<span>Edit</span></button>` : ''}</div>
        ${!complete ? `<div class="notice">${icon('info', 18)}<span>${DELIVERY_MSG}</span></div>` : ''}
        ${editing ? `
        <form id="deliveryForm" novalidate class="form-grid">
          <div class="field"><label for="fullName">Full name</label><input class="input" id="fullName" name="fullName" autocomplete="name" value="${esc(user.name || '')}" maxlength="80"></div>
          <div class="field"><label for="phone">Phone number</label><input class="input" id="phone" name="phone" type="tel" autocomplete="tel" placeholder="0300 1234567" value="${esc(user.phone || '')}"></div>
          <div class="field field--full"><label for="address">Address</label><textarea class="input input--area" id="address" name="address" rows="3" autocomplete="street-address" placeholder="House, street, area" maxlength="250">${esc(user.address || '')}</textarea></div>
          <div class="field"><label for="city">City</label><input class="input" id="city" name="city" autocomplete="address-level2" value="${esc(user.city || '')}" maxlength="80"></div>
          <label class="check field--full"><input type="checkbox" id="saveInfo" checked><span>Save these details to my account</span></label>
        </form>` : `
        <dl class="info-list">
          <div><dt>Name</dt><dd>${esc(user.name)}</dd></div>
          <div><dt>Phone</dt><dd>${esc(user.phone)}</dd></div>
          <div><dt>Address</dt><dd>${esc(user.address)}</dd></div>
          <div><dt>City</dt><dd>${esc(user.city)}</dd></div>
          <div><dt>Email</dt><dd>${esc(user.email)}</dd></div>
        </dl>`}
      </section>

      <aside class="summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <ul class="mini-list">
          ${lines.map((i) => `<li><span class="mini-list__img">${thumb(i)}<b>${i.quantity}</b></span><span class="mini-list__name">${esc(i.name)}</span><span>${formatPrice(i.price * i.quantity)}</span></li>`).join('')}
        </ul>
        <dl>
          <div><dt>Items (${count})</dt><dd>${formatPrice(total)}</dd></div>
          <div><dt>Delivery</dt><dd class="muted">Arranged by the seller</dd></div>
          <div class="summary__total"><dt>Total</dt><dd>${formatPrice(total)}</dd></div>
        </dl>
        <button class="btn btn-lg btn-primary btn-block" id="placeBtn">Place order</button>
        <p class="summary__note">${icon('shield', 14)} No online payment. The seller will contact you shortly to confirm your order.</p>
        ${buyNow ? '' : '<a class="link-btn" href="/pages/cart.html">Back to cart</a>'}
      </aside>
    </div>`;

    document.getElementById('editBtn')?.addEventListener('click', () => { editing = true; draw(); });
    document.getElementById('placeBtn').addEventListener('click', placeOrder);
  };

  async function placeOrder(e) {
    const btn = e.currentTarget;
    const form = document.getElementById('deliveryForm');
    let shipping = { fullName: user.name, phone: user.phone, address: user.address, city: user.city };

    if (form) {
      const f = form.elements;
      const ok = validate(form, [
        { input: f.fullName, check: () => rules.required(f.fullName.value, 'Full name') },
        { input: f.phone, check: () => rules.phone(f.phone.value) },
        { input: f.address, check: () => (f.address.value.trim().length < 8 ? 'Enter your full delivery address' : '') },
        { input: f.city, check: () => rules.required(f.city.value, 'City') },
      ]);
      if (!ok) return;
      shipping = { fullName: f.fullName.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(), city: f.city.value.trim() };
    }

    setBusy(btn, true, 'Placing order…');
    try {
      if (form && document.getElementById('saveInfo').checked) {
        const { user: saved } = await api('/users/me', { method: 'PUT', body: { phone: shipping.phone, address: shipping.address, city: shipping.city } });
        Auth.setUser(saved);
      }
      const { order } = await api('/orders', {
        method: 'POST',
        body: buyNow
          ? { source: 'direct', items: [{ itemType: buyNow.itemType, itemId: buyNow.itemId, quantity: buyNow.quantity }], shipping }
          : { source: 'cart', shipping },
      });
      sessionStorage.removeItem('dz_buynow');
      await Cart.sync();
      window.location.href = `/pages/order-success.html?id=${encodeURIComponent(order.orderId)}`;
    } catch (err) {
      setBusy(btn, false);
      if (form && applyServerErrors(form, err)) return;
      if (form) formAlert(form, err.message); else toast(err.message, 'error');
      if (err.status === 422 && !form) { editing = true; draw(); }
    }
  }

  draw();
})();
