import { api } from './api.js';
import { Auth } from './auth.js';

const KEY = 'dz_cart_v1';
const MAX = 99;
let items = [];
let syncing = null;

const emit = () => window.dispatchEvent(new CustomEvent('cart:change', { detail: Cart.summary() }));
const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const writeLocal = (list) => localStorage.setItem(KEY, JSON.stringify(list));
const same = (a, type, id) => a.itemType === type && String(a.itemId) === String(id);

/**
 * Cart store. Logged-in users use the server cart (/api/cart); guests use localStorage and
 * their items are merged into the server cart as soon as they log in.
 */
export const Cart = {
  get items() { return items; },
  summary() {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    return { items, count, subtotal, total: subtotal };
  },

  async init() {
    window.addEventListener('auth:change', () => Cart.sync());
    await Cart.sync();
  },

  /** Concurrent callers share one in-flight sync, so a guest cart can never be merged twice. */
  sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      if (Auth.isLoggedIn) {
        try {
          const guest = readLocal();
          const data = guest.length
            ? await api('/cart/merge', { method: 'POST', body: { items: guest } })
            : await api('/cart');
          if (guest.length) localStorage.removeItem(KEY);
          items = data.items;
        } catch { /* keep current items on a transient failure */ }
      } else {
        items = readLocal();
      }
      emit();
    })().finally(() => { syncing = null; });
    return syncing;
  },

  /** item: { itemType: 'game'|'product', itemId, name, image, price } */
  async add(item, quantity = 1) {
    if (Auth.isLoggedIn) {
      const data = await api('/cart', { method: 'POST', body: { itemType: item.itemType, itemId: item.itemId, quantity } });
      items = data.items;
    } else {
      const list = readLocal();
      const found = list.find((i) => same(i, item.itemType, item.itemId));
      if (found) found.quantity = Math.min(MAX, found.quantity + quantity);
      else list.push({ ...item, itemId: String(item.itemId), quantity });
      writeLocal(list);
      items = list;
    }
    emit();
  },

  async setQty(itemType, itemId, quantity) {
    if (Auth.isLoggedIn) {
      const data = await api('/cart', { method: 'PUT', body: { itemType, itemId, quantity } });
      items = data.items;
    } else {
      let list = readLocal();
      if (quantity <= 0) list = list.filter((i) => !same(i, itemType, itemId));
      else list.forEach((i) => { if (same(i, itemType, itemId)) i.quantity = Math.min(MAX, quantity); });
      writeLocal(list);
      items = list;
    }
    emit();
  },

  async remove(itemType, itemId) {
    if (Auth.isLoggedIn) {
      const data = await api(`/cart/${itemType}/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      items = data.items;
    } else {
      items = readLocal().filter((i) => !same(i, itemType, itemId));
      writeLocal(items);
    }
    emit();
  },

  async clear() {
    if (Auth.isLoggedIn) await api('/cart', { method: 'DELETE' });
    localStorage.removeItem(KEY);
    items = [];
    emit();
  },
};
