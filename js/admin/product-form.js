import { mountAdmin, adminApi, toast } from './core.js';
import { icon } from '../icons.js';
import { setBusy } from '../ui.js';
import { esc, cdn, getParams } from '../utils.js';
import { createEditor } from './rte.js';
import { setFieldError, clearErrors, formAlert, applyServerErrors } from '../forms.js';
import { errorState } from '../components.js';

const MAX_IMAGES = 8;
const MAX_MB = 5;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const editId = getParams().get('id');
let existing = [];   // { url, publicId, remove }
let fresh = [];      // { file, url }
let editor;

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const activeCount = () => existing.filter((i) => !i.remove).length + fresh.length;

function renderImages() {
  const grid = document.getElementById('imgGrid');
  const tiles = [
    ...existing.map((im, i) => ({ kind: 'old', i, url: cdn(im.url, 300), removed: im.remove })),
    ...fresh.map((im, i) => ({ kind: 'new', i, url: im.url, removed: false })),
  ];
  let firstShown = false;
  grid.innerHTML = tiles.map((t) => {
    const cover = !t.removed && !firstShown && (firstShown = true);
    return `<figure class="img-tile ${t.removed ? 'is-removed' : ''}">
      <img src="${esc(t.url)}" alt="Product image">
      ${cover ? '<span class="img-tile__cover">Cover</span>' : ''}
      ${t.kind === 'new' ? '<span class="img-tile__new">New</span>' : ''}
      <button type="button" class="img-tile__x" data-kind="${t.kind}" data-i="${t.i}" aria-label="${t.removed ? 'Restore image' : 'Remove image'}">${icon(t.removed ? 'refresh' : 'x', 16)}</button>
    </figure>`;
  }).join('');
  document.getElementById('imgCount').textContent = `${activeCount()} of ${MAX_IMAGES}`;
  setFieldError(document.getElementById('imgInput'), '');
}

function addFiles(files) {
  const problems = [];
  [...files].forEach((f) => {
    if (!OK_TYPES.includes(f.type)) return problems.push(`${f.name}: use JPG, PNG, WEBP or AVIF`);
    if (f.size > MAX_MB * 1024 * 1024) return problems.push(`${f.name}: larger than ${MAX_MB}MB`);
    if (activeCount() >= MAX_IMAGES) return problems.push(`Maximum ${MAX_IMAGES} images`);
    fresh.push({ file: f, url: URL.createObjectURL(f) });
  });
  if (problems.length) toast(problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} more)` : ''), 'error', 5000);
  renderImages();
}

/* Price, original price and discount stay in sync */
function bindPricing(f) {
  const fromDiscount = () => {
    const o = num(f.originalPrice.value), d = num(f.discountPercent.value);
    if (o > 0 && d >= 0 && d <= 100) f.price.value = Math.round(o * (1 - d / 100));
  };
  const toDiscount = () => {
    const o = num(f.originalPrice.value), p = num(f.price.value);
    f.discountPercent.value = o > 0 && p >= 0 && o > p ? Math.round(((o - p) / o) * 100) : '';
  };
  f.discountPercent.addEventListener('input', fromDiscount);
  f.price.addEventListener('input', toDiscount);
  f.originalPrice.addEventListener('input', () => (f.discountPercent.value && !f.price.value ? fromDiscount() : toDiscount()));
}

function validate(form, f) {
  clearErrors(form);
  const errs = [];
  const add = (input, msg) => { setFieldError(input, msg); errs.push(input); };
  if (f.title.value.trim().length < 2) add(f.title, 'Enter a product title');
  if (!f.category.value.trim()) add(f.category, 'Choose or type a category');
  const price = num(f.price.value), orig = num(f.originalPrice.value);
  if (!(price >= 0)) add(f.price, 'Enter the selling price');
  if (!Number.isNaN(orig) && orig < price) add(f.originalPrice, 'Original price must be higher than the selling price');
  if (!(Number.isInteger(num(f.stock.value)) && num(f.stock.value) >= 0)) add(f.stock, 'Enter stock as a whole number (0 or more)');
  if (!editor.getText()) { toast('Add a description so customers know what they are buying', 'error'); errs.push(document.querySelector('.rte__area')); }
  if (!activeCount()) add(document.getElementById('imgInput'), 'Add at least one product image');
  errs[0]?.focus?.();
  errs[0]?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  return !errs.length;
}

(async () => {
  const el = await mountAdmin({ active: 'products', title: editId ? 'Edit product' : 'Add product', actions: '<a class="btn btn-secondary btn-sm" href="/admin/products.html">Back to products</a>' });

  let product = null;
  if (editId) {
    el.innerHTML = '<div class="skeleton" style="height:480px;border-radius:20px"></div>';
    try { product = (await adminApi(`/admin/products/${editId}`)).product; } catch (err) {
      el.innerHTML = errorState(err.status === 404 ? 'Product not found' : 'Unable to load this product');
      el.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
      return;
    }
    existing = product.images.map((i) => ({ ...i, remove: false }));
  }
  const p = product || {};

  el.innerHTML = `
  <form id="pForm" class="pform" novalidate>
    <div class="pform__main">
      <section class="card-box"><header><h2>Basics</h2></header>
        <div class="form-stack">
          <div class="field"><label for="title">Title</label><input class="input" id="title" name="title" maxlength="140" value="${esc(p.title || '')}" placeholder="e.g. Full-grain bifold wallet"></div>
          <div class="field"><label for="category">Category</label><input class="input" id="category" name="category" list="catList" maxlength="40" value="${esc(p.category || '')}" placeholder="Wallets, Bags, Belts…"><datalist id="catList"></datalist></div>
          <div class="field"><label for="shortDescription">Short description <span class="muted">(shown on cards)</span></label><input class="input" id="shortDescription" name="shortDescription" maxlength="220" value="${esc(p.shortDescription || '')}" placeholder="One line that sells the product"></div>
          <div class="field"><label>Description</label><div id="editor"></div></div>
        </div>
      </section>
      <section class="card-box"><header><h2>Images</h2><span class="muted" id="imgCount"></span></header>
        <div class="field"><div class="dropzone" id="drop"><span>${icon('upload', 26)}</span><p><strong>Drop images here</strong> or <label for="imgInput" class="link">browse</label></p><small>JPG, PNG, WEBP or AVIF, up to ${MAX_MB}MB each. The first image is the cover. Uploaded to Cloudinary.</small>
          <input id="imgInput" name="imgInput" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden></div></div>
        <div class="img-grid" id="imgGrid"></div>
      </section>
    </div>
    <aside class="pform__side">
      <section class="card-box"><header><h2>Pricing</h2></header>
        <div class="form-stack">
          <div class="field"><label for="originalPrice">Original price (PKR)</label><input class="input" id="originalPrice" name="originalPrice" type="number" min="0" step="1" inputmode="numeric" value="${p.originalPrice ?? ''}" placeholder="Optional"></div>
          <div class="field"><label for="discountPercent">Discount (%)</label><input class="input" id="discountPercent" name="discountPercent" type="number" min="0" max="100" step="1" inputmode="numeric" value="${p.discountPercent || ''}" placeholder="Optional"></div>
          <div class="field"><label for="price">Selling price (PKR)</label><input class="input" id="price" name="price" type="number" min="0" step="1" inputmode="numeric" value="${p.price ?? ''}" placeholder="0"></div>
          <p class="muted small">Enter the original price and a discount, or the selling price. The other value is calculated.</p>
        </div>
      </section>
      <section class="card-box"><header><h2>Inventory</h2></header>
        <div class="form-stack"><div class="field"><label for="stock">Stock</label><input class="input" id="stock" name="stock" type="number" min="0" step="1" inputmode="numeric" value="${p.stock ?? 0}"></div></div>
      </section>
      <section class="card-box"><header><h2>Visibility</h2></header>
        <div class="form-stack">
          ${[['isActive', 'Visible in store', 'Hidden products stay in admin only', p.isActive !== false], ['featured', 'Featured', 'Shown in “Featured leather” on the home page', !!p.featured], ['popular', 'Popular', 'Marks the product as a popular pick', !!p.popular]].map(([n, l, h, on]) => `<label class="switch"><input type="checkbox" name="${n}" ${on ? 'checked' : ''}><i></i><span><b>${l}</b><small>${h}</small></span></label>`).join('')}
        </div>
      </section>
      <div class="pform__actions">
        <button class="btn btn-lg btn-primary btn-block" type="submit" id="saveBtn">${editId ? 'Save changes' : 'Create product'}</button>
        <a class="btn btn-secondary btn-block" href="/admin/products.html">Cancel</a>
      </div>
    </aside>
  </form>`;

  const form = document.getElementById('pForm');
  const f = form.elements;
  editor = createEditor(document.getElementById('editor'), { value: p.description || '' });
  bindPricing(f);
  renderImages();

  adminApi('/products/categories').then(({ categories }) => {
    document.getElementById('catList').innerHTML = categories.map((c) => `<option value="${esc(c.name)}">`).join('');
  }).catch(() => {});

  // Images: browse, drag and drop, remove/restore
  const drop = document.getElementById('drop');
  f.imgInput.addEventListener('change', () => { addFiles(f.imgInput.files); f.imgInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  drop.addEventListener('click', (e) => { if (!e.target.closest('label')) f.imgInput.click(); });
  document.getElementById('imgGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.img-tile__x');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.kind === 'new') { URL.revokeObjectURL(fresh[i].url); fresh.splice(i, 1); }
    else if (existing[i].remove) { if (activeCount() >= MAX_IMAGES) return toast(`Maximum ${MAX_IMAGES} images`, 'error'); existing[i].remove = false; }
    else existing[i].remove = true;
    renderImages();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(form, f)) return;

    const fd = new FormData();
    fd.set('title', f.title.value.trim());
    fd.set('category', f.category.value.trim());
    fd.set('shortDescription', f.shortDescription.value.trim());
    fd.set('description', editor.getHTML());
    fd.set('price', f.price.value);
    fd.set('originalPrice', f.originalPrice.value);
    fd.set('discountPercent', f.discountPercent.value);
    fd.set('stock', f.stock.value);
    ['isActive', 'featured', 'popular'].forEach((k) => fd.set(k, f[k].checked ? 'true' : 'false'));
    fresh.forEach((im) => fd.append('images', im.file));
    existing.filter((i) => i.remove).forEach((i) => fd.append('removeImages', i.publicId));

    const btn = document.getElementById('saveBtn');
    setBusy(btn, true, fresh.length ? 'Uploading images…' : 'Saving…');
    try {
      await adminApi(editId ? `/products/${editId}` : '/products', { method: editId ? 'PUT' : 'POST', body: fd });
      toast(editId ? 'Product updated' : 'Product created', 'success');
      setTimeout(() => { window.location.href = '/admin/products.html'; }, 600);
    } catch (err) {
      setBusy(btn, false);
      if (!applyServerErrors(form, err)) formAlert(form, err.message);
      toast(err.message, 'error');
    }
  });
})();
