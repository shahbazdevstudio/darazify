import { mountAdmin, adminApi, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog, setBusy } from '../ui.js';
import { esc, cdn } from '../utils.js';
import { errorState } from '../components.js';

const $ = (id) => document.getElementById(id);
const OK = ['image/png', 'image/webp', 'image/jpeg'];
let list = [];
let file = null;

const card = (s) => `
  <article class="sr-card" data-id="${s._id}">
    <div class="sr-card__logo"><img src="${esc(cdn(s.image.url, 480))}" alt=""></div>
    <input class="input" data-name value="${esc(s.name)}" maxlength="60" aria-label="Series name">
    <p class="sr-card__meta">${s.count} game${s.count === 1 ? '' : 's'} · <a href="/pages/games.html?series=${encodeURIComponent(s.slug)}" target="_blank" rel="noopener">Preview</a></p>
    <div class="sr-card__row">
      <label class="switch switch--bare" title="Show on the website"><input type="checkbox" data-active ${s.isActive ? 'checked' : ''} aria-label="Visible on website"><i></i></label>
      <label class="btn btn-sm btn-secondary">${icon('upload', 16)}<span>Change logo</span><input type="file" data-logo accept="image/png,image/webp,image/jpeg" hidden></label>
      <button class="icon-btn danger-icon" data-del aria-label="Delete ${esc(s.name)}">${icon('trash', 18)}</button>
    </div>
  </article>`;

async function load() {
  const box = $('srList');
  try {
    ({ series: list } = await adminApi('/admin/series'));
    box.innerHTML = list.length ? list.map(card).join('') : '<p class="muted sr-empty">No series yet. Create your first one above.</p>';
    $('srCount').textContent = `${list.length} series`;
  } catch {
    box.innerHTML = errorState('Unable to load series');
    box.querySelector('[data-retry]').addEventListener('click', load);
  }
}

const patch = async (id, body, ok) => {
  try { await adminApi(`/admin/series/${id}`, { method: 'PATCH', body }); toast(ok, 'success', 2200); await load(); } catch (err) { toast(err.message, 'error'); load(); }
};

(async () => {
  const el = await mountAdmin({ active: 'series', title: 'Game series' });
  el.innerHTML = `
    <section class="card-box gadd">
      <header><h2>Create a series</h2></header>
      <p class="gadd__lead">A series works like a playlist. It appears as a white card under the home banner. After creating it, open <a href="/admin/games.html"><b>Games → In your store</b></a> and pick the series in each game's <b>Series</b> column.</p>
      <div class="sr-form">
        <label class="sr-drop" id="srDrop" for="srFile"><span id="srPrev">${icon('image', 28)}<b>Upload PNG logo</b><small>Transparent PNG works best · max 5 MB</small></span></label>
        <input type="file" id="srFile" accept="image/png,image/webp,image/jpeg" hidden>
        <div class="sr-form__side">
          <div class="field"><label for="srName">Series name</label><input class="input" id="srName" maxlength="60" placeholder="e.g. Grand Theft Auto"></div>
          <button class="btn btn-lg btn-signal" id="srCreate">${icon('plus', 18)}<span>Create series</span></button>
        </div>
      </div>
    </section>
    <section class="card-box">
      <header><h2>Your series</h2><span class="muted" id="srCount"></span></header>
      <div class="sr-grid" id="srList"><div class="skeleton" style="height:220px;border-radius:16px"></div></div>
    </section>`;

  $('srFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!OK.includes(f.type)) { toast('Please choose a PNG, WEBP or JPG image', 'error'); e.target.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { toast('The image must be under 5 MB', 'error'); e.target.value = ''; return; }
    file = f;
    $('srPrev').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="Logo preview">`;
  });

  $('srCreate').addEventListener('click', async (e) => {
    const name = $('srName').value.trim();
    if (name.length < 2) return toast('Enter a series name', 'error');
    if (!file) return toast('Upload a PNG logo first', 'error');
    const fd = new FormData();
    fd.set('name', name);
    fd.set('image', file);
    setBusy(e.currentTarget, true, 'Uploading…');
    try {
      await adminApi('/admin/series', { method: 'POST', body: fd });
      toast('Series created', 'success');
      file = null; $('srFile').value = ''; $('srName').value = '';
      $('srPrev').innerHTML = `${icon('image', 28)}<b>Upload PNG logo</b><small>Transparent PNG works best · max 5 MB</small>`;
      load();
    } catch (err) { toast(err.message, 'error'); }
    setBusy(e.currentTarget, false);
  });

  const list$ = $('srList');
  list$.addEventListener('change', (e) => {
    const id = e.target.closest('.sr-card')?.dataset.id;
    if (!id) return;
    if (e.target.matches('[data-name]')) patch(id, { name: e.target.value }, 'Series renamed');
    if (e.target.matches('[data-active]')) patch(id, { isActive: e.target.checked }, e.target.checked ? 'Series is visible' : 'Series hidden');
    if (e.target.matches('[data-logo]') && e.target.files[0]) { const fd = new FormData(); fd.set('image', e.target.files[0]); patch(id, fd, 'Logo updated'); }
  });
  list$.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const s = list.find((x) => x._id === b.closest('.sr-card').dataset.id);
    const ok = await confirmDialog({ title: `Delete “${s?.name}”?`, message: 'The series card disappears. Its games stay in your store, just without a series.', confirmText: 'Delete series', danger: true });
    if (!ok) return;
    try { await adminApi(`/admin/series/${s._id}`, { method: 'DELETE' }); toast('Series deleted', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  });

  load();
})();
