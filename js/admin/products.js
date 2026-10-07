import { mountAdmin, adminApi, skeletonRows, tableState, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog } from '../ui.js';
import { esc, formatPrice, debounce, cdn } from '../utils.js';
import { errorState, renderPagination } from '../components.js';

let state = { search: '', category: '', page: 1 };
let ctl = 0;
let byId = {};

const flags = (p) => [p.featured && '<span class="tag tag--accent">Featured</span>', p.popular && '<span class="tag">Popular</span>', !p.isActive && '<span class="tag tag--muted">Hidden</span>'].filter(Boolean).join('');

const row = (p) => `
  <tr>
    <td data-label="Product"><div class="who"><span class="thumb-sm thumb-sm--lg">${p.images?.[0] ? `<img src="${esc(cdn(p.images[0].url, 120))}" alt="">` : icon('image', 20)}</span><div><strong>${esc(p.title)}</strong><small>${esc(p.category)}</small></div></div></td>
    <td data-label="Price"><div><strong>${formatPrice(p.price)}</strong>${p.originalPrice && p.originalPrice > p.price ? `<small><s>${formatPrice(p.originalPrice)}</s> · -${p.discountPercent}%</small>` : ''}</div></td>
    <td data-label="Stock"><span class="${p.stock === 0 ? 'is-out' : p.stock <= 5 ? 'is-low' : ''}">${p.stock === 0 ? 'Sold out' : p.stock}</span></td>
    <td data-label="Flags"><div class="tags">${flags(p) || '<span class="muted">—</span>'}</div></td>
    <td class="tbl__actions" data-label="Actions">
      <a class="btn btn-sm btn-secondary" href="/admin/product-form.html?id=${p._id}">${icon('edit', 15)}<span>Edit</span></a>
      <button class="icon-btn danger-icon" data-del="${p._id}" aria-label="Delete ${esc(p.title)}">${icon('trash', 18)}</button>
    </td>
  </tr>`;

async function load() {
  const my = ++ctl;
  const box = document.getElementById('productsBox');
  box.innerHTML = skeletonRows(6, 5);
  try {
    const { products, pagination } = await adminApi('/admin/products', { params: { search: state.search, category: state.category, page: state.page, limit: 10, sort: 'newest' } });
    if (my !== ctl) return;
    byId = Object.fromEntries(products.map((p) => [p._id, p]));
    document.getElementById('count').textContent = `${pagination.total} product${pagination.total === 1 ? '' : 's'}`;
    if (!products.length) {
      box.innerHTML = tableState('package', state.search || state.category ? 'No products match' : 'No products yet', state.search || state.category ? 'Try a different search or category.' : 'Add your first leather product to show it on the store.');
      document.getElementById('pager').innerHTML = '';
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Flags</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${products.map(row).join('')}</tbody></table></div>`;
    renderPagination(document.getElementById('pager'), pagination, (p) => { state.page = p; load(); });
  } catch (err) {
    if (my !== ctl) return;
    box.innerHTML = errorState('Unable to load products');
    box.querySelector('[data-retry]').addEventListener('click', load);
  }
}

(async () => {
  const el = await mountAdmin({ active: 'products', title: 'Products', actions: `<a class="btn btn-primary btn-sm" href="/admin/product-form.html">${icon('plus', 16)}<span>Add product</span></a>` });
  el.innerHTML = `
    <div class="toolbar-row">
      <div class="input-icon grow"><span>${icon('search', 18)}</span><input class="input" id="q" type="search" placeholder="Search by title or category" aria-label="Search products"></div>
      <select class="select" id="cat" aria-label="Filter by category"><option value="">All categories</option></select>
    </div>
    <div class="card-box card-box--flush"><div id="productsBox"></div></div>
    <div class="list-foot"><span id="count" class="muted"></span></div>
    <div id="pager"></div>`;

  document.getElementById('q').addEventListener('input', debounce((e) => { state = { ...state, search: e.target.value.trim(), page: 1 }; load(); }, 350));
  document.getElementById('cat').addEventListener('change', (e) => { state = { ...state, category: e.target.value, page: 1 }; load(); });
  adminApi('/products/categories').then(({ categories }) => {
    document.getElementById('cat').insertAdjacentHTML('beforeend', categories.map((c) => `<option>${esc(c.name)}</option>`).join(''));
  }).catch(() => {});

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const p = byId[b.dataset.del];
    const ok = await confirmDialog({ title: `Delete “${p?.title || 'product'}”?`, message: 'The product and its images are permanently removed. Past orders keep their own copy of the item.', confirmText: 'Delete product', danger: true });
    if (!ok) return;
    try { await adminApi(`/products/${b.dataset.del}`, { method: 'DELETE' }); toast('Product deleted', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  });
  await load();
})();
