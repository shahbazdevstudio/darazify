import { api } from './api.js';
import { mountLayout } from './layout.js';
import { Cart } from './cart.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { esc, formatPrice, gameImg, getParams, paragraphs } from './utils.js';
import { qtyStepper, bindQty, starRating, errorState, notFoundState } from './components.js';

const root = document.getElementById('detail');
const id = getParams().get('id');

const skeleton = `<div class="detail"><div class="skeleton detail__skel-media"></div><div class="detail__info"><div class="skeleton sk-line w60" style="height:34px"></div><div class="skeleton sk-line w40"></div><div class="skeleton sk-line w100" style="height:120px"></div></div></div>`;

const fact = (label, value) => (value && value.length ? `<div><dt>${label}</dt><dd>${esc(Array.isArray(value) ? value.join(', ') : value)}</dd></div>` : '');

function render(g) {
  document.title = `${g.name} — Darazify`;
  const shots = [g.image, ...(g.screenshots || [])].filter(Boolean);
  const released = g.released ? new Date(g.released).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/index.html">Home</a><span>/</span><a href="/pages/games.html">Games</a><span>/</span><span aria-current="page">${esc(g.name)}</span></nav>
    <div class="detail">
      <div class="gallery">
        <div class="gallery__main">${shots.length ? `<img id="mainImg" src="${esc(gameImg(shots[0], 1000))}" alt="${esc(g.name)}" width="1000" height="600">` : `<div class="card-img--empty gallery__empty">${icon('gamepad', 64)}</div>`}</div>
        ${shots.length > 1 ? `<div class="gallery__thumbs" role="list">${shots.map((s, i) => `<button class="thumb ${i === 0 ? 'is-on' : ''}" data-src="${esc(gameImg(s, 1000))}" aria-label="Show image ${i + 1}"><img src="${esc(gameImg(s, 200))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="detail__info">
        <div class="detail__tags">${(g.genres || []).slice(0, 3).map((x) => `<span class="chip chip--sm">${esc(x)}</span>`).join('')}</div>
        <h1 class="detail__title">${esc(g.name)}</h1>
        ${g.rating ? `<div class="detail__rating">${starRating(g.rating)}<strong>${Number(g.rating).toFixed(1)}</strong><span>${g.ratingsCount ? `${g.ratingsCount.toLocaleString()} ratings` : ''}</span>${g.metacritic ? `<span class="meta-score" title="Metacritic score">${g.metacritic}</span>` : ''}</div>` : ''}
        <div class="detail__price"><strong>${formatPrice(g.price)}</strong><span class="chip chip--sm">${esc(g.platforms?.[0] || 'PC')}</span></div>
        <div class="detail__buy">
          <div class="field"><label for="qty">Quantity</label>${qtyStepper(1, { max: 10, id: 'qty' })}</div>
          <div class="detail__buttons">
            <button class="btn btn-lg btn-signal" id="addBtn">${icon('bag', 18)}<span>Add to cart</span></button>
            <button class="btn btn-lg btn-secondary" id="buyBtn">Buy now</button>
          </div>
        </div>
        <dl class="facts">
          ${fact('Platforms', g.platforms)}${fact('Released', released)}${fact('Developer', g.developers)}${fact('Publisher', g.publishers)}${fact('Age rating', g.esrb)}
        </dl>
      </div>
    </div>
    ${g.description ? `<section class="detail__about"><h2>About this game</h2><div class="rich">${paragraphs(g.description)}</div></section>` : ''}`;

  const main = document.getElementById('mainImg');
  root.querySelectorAll('.thumb').forEach((t) => t.addEventListener('click', () => {
    main.src = t.dataset.src;
    root.querySelectorAll('.thumb').forEach((x) => x.classList.toggle('is-on', x === t));
  }));

  const getQty = bindQty(root.querySelector('[data-qty]'));
  const item = { itemType: 'game', itemId: g.id, name: g.name, image: g.image || '', price: g.price };

  document.getElementById('addBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await Cart.add(item, getQty());
      toast(`${g.name} added to your cart`, 'success');
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
  if (!id) { root.innerHTML = notFoundState('Game', '/pages/games.html', 'Browse games'); return; }
  root.innerHTML = skeleton;
  try {
    const { game } = await api(`/games/${encodeURIComponent(id)}`);
    render(game);
  } catch (err) {
    if (err.status === 404) root.innerHTML = notFoundState('Game', '/pages/games.html', 'Browse games');
    else { root.innerHTML = errorState('Unable to load this game'); root.querySelector('[data-retry]').addEventListener('click', () => window.location.reload()); }
  }
})();
