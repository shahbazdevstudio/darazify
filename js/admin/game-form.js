import { mountAdmin, adminApi, toast } from './core.js';
import { icon } from '../icons.js';
import { setBusy } from '../ui.js';
import { esc, gameImg, getParams } from '../utils.js';
import { setFieldError, clearErrors, formAlert, applyServerErrors } from '../forms.js';
import { errorState } from '../components.js';

const MAX_IMAGES = 7; // cover + 6 gallery images
const MAX_MB = 5;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const editId = getParams().get('id');
let existing = []; // { url, remove }
let fresh = [];    // { file, url }

const activeCount = () => existing.filter((i) => !i.remove).length + fresh.length;

function renderImages() {
  const tiles = [
    ...existing.map((im, i) => ({ kind: 'old', i, url: gameImg(im.url, 300), removed: im.remove })),
    ...fresh.map((im, i) => ({ kind: 'new', i, url: im.url, removed: false })),
  ];
  let firstShown = false;
  document.getElementById('imgGrid').innerHTML = tiles.map((t) => {
    const cover = !t.removed && !firstShown && (firstShown = true);
    return `<figure class="img-tile ${t.removed ? 'is-removed' : ''}" style="aspect-ratio:16/10">
      <img src="${esc(t.url)}" alt="Game image">
      ${cover ? '<span class="img-tile__cover">Cover</span>' : ''}${t.kind === 'new' ? '<span class="img-tile__new">New</span>' : ''}
      <button type="button" class="img-tile__x" data-kind="${t.kind}" data-i="${t.i}" aria-label="${t.removed ? 'Restore image' : 'Remove image'}">${icon(t.removed ? 'refresh' : 'x', 16)}</button>
    </figure>`;
  }).join('');
  document.getElementById('imgCount').textContent = `${activeCount()} of ${MAX_IMAGES}`;
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

function validate(form, f) {
  clearErrors(form);
  const errs = [];
  const add = (input, msg) => { setFieldError(input, msg); errs.push(input); };
  if (f.name.value.trim().length < 2) add(f.name, 'Enter the game name');
  if (f.price.value !== '' && !(Number(f.price.value) >= 1)) add(f.price, 'Enter a price of 1 PKR or more, or leave it empty for the default');
  if (f.rating.value !== '' && !(Number(f.rating.value) >= 0 && Number(f.rating.value) <= 5)) add(f.rating, 'Rating must be between 0 and 5');
  if (f.metacritic.value !== '' && !(Number.isInteger(Number(f.metacritic.value)) && Number(f.metacritic.value) >= 0 && Number(f.metacritic.value) <= 100)) add(f.metacritic, 'Enter a whole number from 0 to 100');
  if (!activeCount()) add(f.imgInput, 'Add at least one image (the first one is the cover)');
  errs[0]?.focus?.();
  errs[0]?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  return !errs.length;
}

const input = (id, label, val = '', attrs = '') => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" value="${esc(val)}" ${attrs}></div>`;
const toggle = (n, l, h, on) => `<label class="switch"><input type="checkbox" name="${n}" ${on ? 'checked' : ''}><i></i><span><b>${l}</b><small>${h}</small></span></label>`;

(async () => {
  let g = null;
  const el = await mountAdmin({ active: 'games', title: editId ? 'Edit custom game' : 'Create custom game', actions: '<a class="btn btn-secondary btn-sm" href="/admin/games.html">Back to games</a>' });

  if (editId) {
    el.innerHTML = '<div class="skeleton" style="height:480px;border-radius:20px"></div>';
    try {
      ({ game: g } = await adminApi(`/admin/games/${editId}`));
      if (!g.isCustom) throw Object.assign(new Error('Only custom games can be edited'), { status: 404 });
    } catch (err) {
      el.innerHTML = errorState(err.status === 404 ? 'Custom game not found' : 'Unable to load this game');
      el.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
      return;
    }
    existing = [g.image, ...(g.screenshots || [])].filter(Boolean).map((url) => ({ url, remove: false }));
  }
  g = g || {};
  let seriesList = [];
  try { ({ series: seriesList } = await adminApi('/admin/series')); } catch { /* series are optional */ }

  el.innerHTML = `
  <form id="gForm" class="pform" novalidate>
    <div class="pform__main">
      <section class="card-box"><header><h2>Game details</h2></header>
        <div class="form-stack">
          ${input('name', 'Game name', g.name, 'maxlength="120" placeholder="e.g. My Indie Adventure"')}
          <div class="field"><label for="description">Description</label><textarea class="input" id="description" name="description" rows="7" maxlength="6000" placeholder="Tell players what the game is about. Leave a blank line between paragraphs.">${esc(g.description || '')}</textarea></div>
          ${input('genres', 'Genres <span class="muted">(comma separated)</span>', (g.genres || []).join(', '), 'maxlength="200" placeholder="Action, Adventure, RPG"')}
          ${input('released', 'Release date', g.released, 'type="date"')}
          ${input('developers', 'Developer <span class="muted">(optional)</span>', (g.developers || []).join(', '), 'maxlength="120"')}
          ${input('publishers', 'Publisher <span class="muted">(optional)</span>', (g.publishers || []).join(', '), 'maxlength="120"')}
          ${input('esrb', 'Age rating <span class="muted">(optional)</span>', g.esrb, 'maxlength="30" placeholder="e.g. Mature"')}
          ${input('rating', 'Rating 0–5 <span class="muted">(optional)</span>', g.rating || '', 'type="number" min="0" max="5" step="0.1" inputmode="decimal"')}
          ${input('metacritic', 'Metacritic score <span class="muted">(optional)</span>', g.metacritic ?? '', 'type="number" min="0" max="100" step="1" inputmode="numeric"')}
        </div>
      </section>
      <section class="card-box"><header><h2>Images</h2><span class="muted" id="imgCount"></span></header>
        <div class="field"><div class="dropzone" id="drop"><span>${icon('upload', 26)}</span><p><strong>Drop images here</strong> or <label for="imgInput" class="link">browse</label></p><small>JPG, PNG, WEBP or AVIF, up to ${MAX_MB}MB each. Use wide (16:9) images. The first image is the cover; the second one shows when a card is hovered.</small>
          <input id="imgInput" name="imgInput" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden></div></div>
        <div class="img-grid" id="imgGrid"></div>
      </section>
    </div>
    <aside class="pform__side">
      <section class="card-box"><header><h2>Price</h2></header>
        <div class="form-stack">${input('price', 'Price (PKR)', g.price ?? '', 'type="number" min="1" step="1" inputmode="numeric" placeholder="250 (default)"')}<p class="muted small">Leave empty to use the standard game price.</p></div>
      </section>
      <section class="card-box"><header><h2>Where to show it</h2></header>
        <div class="form-stack">
          <div class="field"><label for="series">Series</label><select class="select" id="series" name="series"><option value="">No series</option>${seriesList.map((s) => `<option value="${s._id}" ${String(g.series) === String(s._id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
          ${toggle('isHero', 'Home banner (Hero)', 'Max 3 games in the banner', !!g.isHero)}
          ${toggle('isPopular', 'Popular games', 'Shown in the Popular games section', !!g.isPopular)}
          ${toggle('isLatest', 'Latest games', 'Shown in the Latest games section', !!g.isLatest)}
          ${toggle('isActive', 'Visible in store', 'Hidden games stay in admin only', g.isActive !== false)}
        </div>
      </section>
      <div class="pform__actions">
        <button class="btn btn-lg btn-signal btn-block" type="submit" id="saveBtn">${editId ? 'Save changes' : 'Create game'}</button>
        <a class="btn btn-secondary btn-block" href="/admin/games.html">Cancel</a>
      </div>
    </aside>
  </form>`;

  const form = document.getElementById('gForm');
  const f = form.elements;
  renderImages();

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
    ['name', 'description', 'genres', 'released', 'developers', 'publishers', 'esrb', 'rating', 'metacritic', 'price', 'series'].forEach((k) => fd.set(k, f[k].value.trim()));
    ['isHero', 'isPopular', 'isLatest', 'isActive'].forEach((k) => fd.set(k, f[k].checked ? 'true' : 'false'));
    fresh.forEach((im) => fd.append('images', im.file));
    existing.filter((i) => i.remove).forEach((i) => fd.append('removeImages', i.url));

    const btn = document.getElementById('saveBtn');
    setBusy(btn, true, fresh.length ? 'Uploading images…' : 'Saving…');
    try {
      await adminApi(editId ? `/admin/games/${editId}/custom` : '/admin/games/custom', { method: editId ? 'PUT' : 'POST', body: fd });
      toast(`Game ${editId ? 'updated' : 'created'}`, 'success');
      setTimeout(() => { window.location.href = '/admin/games.html'; }, 600);
    } catch (err) {
      setBusy(btn, false);
      if (!applyServerErrors(form, err)) formAlert(form, err.message);
      toast(err.message, 'error');
    }
  });
})();
