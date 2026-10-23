import { api } from './api.js';
import { mountLayout } from './layout.js';
import { Cart } from './cart.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { esc, formatPrice, cdn, getParams } from './utils.js';
import { qtyStepper, bindQty, errorState, notFoundState, productCard } from './components.js';
import { setSeo, breadcrumbLd, productLd } from './seo.js';

// One script powers /pages/product-details.html (leather) and /pages/software-details.html (software).
const TYPE = document.body.dataset.type === 'software' ? 'software' : 'product';
const API = TYPE === 'software' ? '/software' : '/products';
const root = document.getElementById('detail');
const id = getParams().get('id');

const skeleton = `<div class="detail"><div class="skeleton detail__skel-media" style="aspect-ratio:1"></div><div class="detail__info"><div class="skeleton sk-line w60" style="height:34px"></div><div class="skeleton sk-line w40"></div><div class="skeleton sk-line w100" style="height:120px"></div></div></div>`;

function render(data) {
  const p = data.product || data.software;
  const related = data.related;
  const imgs = p.images || [];
  const out = p.stock <= 0;
  const soft = TYPE === 'software';
  const listHref = soft ? '/pages/software.html' : '/pages/products.html';
  const url = `/pages/${soft ? 'software' : 'product'}-details.html?id=${encodeURIComponent(p._id)}`;
  const kind = soft ? 'software' : 'leather';
  setSeo({
    title: soft ? `${p.title} — Buy Software Online` : `${p.title} — Handmade Leather ${p.category || 'Goods'}`,
    description: p.shortDescription || p.description || `Buy ${p.title} at Darazify for ${formatPrice(p.price)}. ${soft ? 'Software' : 'Leather goods'} confirmed by the seller after you order.`,
    keywords: [p.title, p.category, `buy ${p.title}`, soft ? 'software Pakistan' : 'leather goods Pakistan', soft ? 'buy software online' : `${p.category || 'leather'} online`, 'Darazify'],
    canonical: url,
    image: imgs[0]?.url ? cdn(imgs[0].url, 1200) : undefined,
    type: 'product',
    jsonLd: [
      breadcrumbLd([{ name: 'Home', url: '/index.html' }, { name: soft ? 'Software' : 'Leather', url: listHref }, ...(p.category ? [{ name: p.category, url: `${listHref}?category=${encodeURIComponent(p.category)}` }] : []), { name: p.title, url }]),
      productLd({ name: p.title, description: p.shortDescription || p.description || `${p.title} (${kind})`, url, price: p.price, inStock: !out, sku: p._id, category: p.category, images: imgs.map((im) => cdn(im.url, 1200)) }),
    ],
  });
  const stockLabel = out ? '<span class="stock stock--out">Out of stock</span>' : p.stock <= 5 ? `<span class="stock stock--low">Only ${p.stock} left</span>` : '<span class="stock stock--in">In stock</span>';

  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/index.html">Home</a><span>/</span><a href="${listHref}">${soft ? 'Software' : 'Leather'}</a><span>/</span><a href="${listHref}?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a><span>/</span><span aria-current="page">${esc(p.title)}</span></nav>
    <div class="detail">
      <div class="gallery">
        <div class="gallery__main gallery__main--square${soft ? '' : ' gallery__main--zoom'}" id="zoomBox">
          ${imgs.length ? `<img id="mainImg" src="${esc(cdn(imgs[0].url, 1000))}" alt="${esc(p.title)}" width="1000" height="1000">` : `<div class="card-img--empty gallery__empty">${icon('bag', 64)}</div>`}
          ${imgs.length > 1 ? `<button class="gallery__nav gallery__nav--prev" data-nav="-1" aria-label="Previous image">${icon('left', 20)}</button><button class="gallery__nav gallery__nav--next" data-nav="1" aria-label="Next image">${icon('right', 20)}</button>` : ''}
          ${p.discountPercent > 0 ? `<span class="card__badge card__badge--sale">-${p.discountPercent}%</span>` : ''}
        </div>
        ${imgs.length > 1 ? `<div class="gallery__thumbs">${imgs.map((im, i) => `<button class="thumb ${i === 0 ? 'is-on' : ''}" data-i="${i}" aria-label="Show image ${i + 1}"><img src="${esc(cdn(im.url, 200))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="detail__info">
        <a class="detail__cat" href="${listHref}?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a>
        <h1 class="detail__title">${esc(p.title)}</h1>
        <div class="detail__price">
          <strong>${formatPrice(p.price)}</strong>
          ${p.originalPrice && p.originalPrice > p.price ? `<s>${formatPrice(p.originalPrice)}</s><span class="save">Save ${formatPrice(p.originalPrice - p.price)}</span>` : ''}
        </div>
        <div class="detail__avail">${soft && !out && p.stock > 5 ? '<span class="stock stock--in">Available</span>' : stockLabel}</div>
        ${p.shortDescription ? `<p class="detail__short">${esc(p.shortDescription)}</p>` : ''}
        <div class="detail__buy">
          ${out ? '' : `<div class="field"><label for="qty">Quantity</label>${qtyStepper(1, { max: Math.min(10, p.stock), id: 'qty' })}</div>`}
          <div class="detail__buttons">
            <button class="btn btn-lg ${soft ? 'btn-soft' : 'btn-primary'}" id="addBtn" ${out ? 'disabled' : ''}>${icon('bag', 18)}<span>${out ? 'Sold out' : 'Add to cart'}</span></button>
            <button class="btn btn-lg btn-secondary" id="buyBtn" ${out ? 'disabled' : ''}>Buy now</button>
          </div>
        </div>
        <ul class="assure"><li>${icon('shield', 18)}Confirmed by the seller after you order</li>${soft ? '' : `<li>${icon('truck', 18)}Delivered to your address</li>`}</ul>
      </div>
    </div>
    ${p.description ? `<section class="detail__about"><h2>${soft ? 'About this software' : 'Product details'}</h2><div class="rich">${p.description}</div></section>` : ''}
    ${related?.length ? `<section class="detail__related"><div class="section__head"><h2 class="section__title">You may also like</h2></div><div class="grid grid--products">${related.map((r) => productCard(r, TYPE)).join('')}</div></section>` : ''}`;

  // Gallery
  if (imgs.length) {
    const main = document.getElementById('mainImg');
    let idx = 0;
    const show = (i) => {
      idx = (i + imgs.length) % imgs.length;
      main.src = cdn(imgs[idx].url, 1000);
      root.querySelectorAll('.thumb').forEach((t, n) => t.classList.toggle('is-on', n === idx));
    };
    root.querySelectorAll('.thumb').forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.i))));
    root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => show(idx + Number(b.dataset.nav))));
    const box = document.getElementById('zoomBox');
    if (!soft) box.addEventListener('mousemove', (e) => {
      const r = box.getBoundingClientRect();
      main.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
  }

  if (out) return;
  const getQty = bindQty(root.querySelector('[data-qty]'));
  const item = { itemType: TYPE, itemId: p._id, name: p.title, image: imgs[0]?.url || '', price: p.price };

  document.getElementById('addBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await Cart.add(item, getQty());
      toast(`${p.title} added to your cart`, 'success');
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
  });
  document.getElementById('buyBtn').addEventListener('click', () => {
    sessionStorage.setItem('dz_buynow', JSON.stringify({ ...item, quantity: getQty() }));
    window.location.href = '/pages/checkout.html?mode=buynow';
  });
}

(async () => {
  await mountLayout();
  if (!id) { setSeo({ title: 'Not found', noindex: true }); root.innerHTML = notFoundState(TYPE === 'software' ? 'Software' : 'Product', TYPE === 'software' ? '/pages/software.html' : '/pages/products.html', TYPE === 'software' ? 'Browse software' : 'Browse products'); return; }
  root.innerHTML = skeleton;
  try {
    render(await api(`${API}/${encodeURIComponent(id)}`));
  } catch (err) {
    if (err.status === 404) { setSeo({ title: 'Not found', noindex: true }); root.innerHTML = notFoundState(TYPE === 'software' ? 'Software' : 'Product', TYPE === 'software' ? '/pages/software.html' : '/pages/products.html', TYPE === 'software' ? 'Browse software' : 'Browse products'); }
    else { root.innerHTML = errorState(`Unable to load this ${TYPE}`); root.querySelector('[data-retry]').addEventListener('click', () => window.location.reload()); }
  }
})();
