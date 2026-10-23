import { mountAdmin, adminApi, toast } from './core.js';
import { icon } from '../icons.js';
import { confirmDialog, setBusy } from '../ui.js';
import { esc } from '../utils.js';
import { errorState } from '../components.js';

const $ = (id) => document.getElementById(id);
let list = [];

const card = (s) => `
  <article class="sr-card" data-id="${s._id}">
    <input class="input" data-name value="${esc(s.name)}" maxlength="60" aria-label="Series name">
    <p class="sr-card__meta">${s.count} game${s.count === 1 ? '' : 's'} · <a href="/pages/games.html?series=${encodeURIComponent(s.slug)}" target="_blank" rel="noopener">Preview</a></p>
    <div class="sr-card__row">
      <label class="switch switch--bare" title="Show on the website"><input type="checkbox" data-active ${s.isActive ? 'checked' : ''} aria-label="Visible on website"><i></i></label>
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
      <p class="gadd__lead">A series works like a playlist. It appears as a card (series name + total games) on the home page. After creating it, open <a href="/admin/games.html"><b>Games → In your store</b></a> and pick the series in each game's <b>Series</b> column.</p>
      <div class="sr-form">
        <div class="field"><label for="srName">Series name</label><input class="input" id="srName" maxlength="60" placeholder="e.g. Grand Theft Auto"></div>
        <button class="btn btn-lg btn-signal" id="srCreate">${icon('plus', 18)}<span>Create series</span></button>
      </div>
    </section>
    <section class="card-box">
      <header><h2>Your series</h2><span class="muted" id="srCount"></span></header>
      <div class="sr-grid" id="srList"><div class="skeleton" style="height:220px;border-radius:16px"></div></div>
    </section>`;

  $('srCreate').addEventListener('click', async (e) => {
    const name = $('srName').value.trim();
    if (name.length < 2) return toast('Enter a series name', 'error');
    const fd = new FormData();
    fd.set('name', name);
    setBusy(e.currentTarget, true, 'Creating…');
    try {
      await adminApi('/admin/series', { method: 'POST', body: fd });
      toast('Series created', 'success');
      $('srName').value = '';
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
