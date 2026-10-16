import { adminApi, toast } from './core.js';
import { icon } from '../icons.js';
import { esc } from '../utils.js';

const BATCH = 10;       // names per request (small, so each request finishes quickly)
const WORKERS = 2;      // requests in parallel
const MAX_NAMES = 5000;
const MAX_BYTES = 2 * 1024 * 1024;

/** One game title per line. Empty lines and lines starting with # are ignored; duplicates removed. */
export function parseNames(text) {
  const seen = new Set();
  const names = [];
  String(text).replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line) => {
    const name = line.replace(/\s+/g, ' ').trim();
    if (!name || name.startsWith('#')) return;
    const k = name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    names.push(name);
  });
  return names;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtTime = (s) => (s < 90 ? `${Math.max(1, Math.round(s))} sec` : `${Math.round(s / 60)} min`);

/**
 * Bulk "import games from a file" card. The file is read in the browser and the titles are sent to
 * POST /api/admin/games/import in small batches, with a progress bar (a server cannot process
 * thousands of titles in one request).
 */
export function mountImport(root, { onDone } = {}) {
  root.innerHTML = `
    <header><h2>Import games from a file</h2></header>
    <p class="gadd__lead">Upload a <b>.txt</b> file with one game name per line. Each game found in the catalogue (PC) is added to your store at the default price, and games already in your store are skipped. You can change prices, Popular, Latest and Hero afterwards.</p>

    <div class="dropzone" id="impDrop" tabindex="0" role="button" aria-label="Choose a games file">
      <span>${icon('upload', 26)}</span>
      <p><strong>Drop your games file here</strong> or <span class="link">browse</span></p>
      <small>.txt or .csv, one game name per line, up to ${MAX_NAMES.toLocaleString()} names.</small>
      <input id="impFile" type="file" accept=".txt,.csv,text/plain,text/csv" hidden>
    </div>

    <div class="imp-ready" id="impReady" hidden></div>
    <div class="imp-run" id="impRun" hidden></div>
    <div class="imp-done" id="impDone" hidden></div>`;

  const $ = (id) => root.querySelector(`#${id}`);
  const drop = $('impDrop');
  const fileInput = $('impFile');

  let names = [];
  let fileName = '';
  let running = false;
  let paused = false;
  let cancelled = false;
  const unload = (e) => { e.preventDefault(); e.returnValue = ''; };

  /* ----------------------------- choosing a file ----------------------------- */
  const reset = () => {
    names = []; fileName = '';
    $('impReady').hidden = true; $('impRun').hidden = true; $('impDone').hidden = true; drop.hidden = false;
  };

  async function onFile(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) { toast('That file is too large. Use a plain text file under 2 MB.', 'error'); return; }
    if (!/\.(txt|csv)$/i.test(file.name) && !/^text\//.test(file.type)) { toast('Please choose a .txt or .csv file.', 'error'); return; }
    const parsed = parseNames(await file.text());
    if (!parsed.length) { toast('No game names found in that file.', 'error'); return; }
    if (parsed.length > MAX_NAMES) { toast(`Only the first ${MAX_NAMES.toLocaleString()} names will be imported.`, 'info', 5000); parsed.length = MAX_NAMES; }
    names = parsed; fileName = file.name;
    showReady();
  }

  function showReady() {
    drop.hidden = true; $('impRun').hidden = true; $('impDone').hidden = true;
    const box = $('impReady');
    box.hidden = false;
    box.innerHTML = `
      <div class="imp-file"><span class="imp-file__icon">${icon('receipt', 22)}</span>
        <div><strong>${esc(fileName)}</strong><small>${names.length.toLocaleString()} unique game names found</small></div></div>
      <div class="imp-preview">${names.slice(0, 8).map((n) => `<span class="chip chip--sm">${esc(n)}</span>`).join('')}${names.length > 8 ? `<span class="muted">+${(names.length - 8).toLocaleString()} more</span>` : ''}</div>
      <div class="picked__actions"><button class="btn btn-primary" id="impStart">${icon('upload', 16)}<span>Start import</span></button><button class="btn btn-secondary" id="impChange">Choose another file</button></div>`;
    $('impStart').addEventListener('click', () => run(names));
    $('impChange').addEventListener('click', reset);
  }

  /* -------------------------------- the import -------------------------------- */
  async function run(list, { retry = false } = {}) {
    running = true; paused = false; cancelled = false;
    window.addEventListener('beforeunload', unload);
    $('impReady').hidden = true; $('impDone').hidden = true;
    const runBox = $('impRun');
    runBox.hidden = false;

    const tally = { added: 0, exists: 0, not_found: 0, error: 0, skipped: 0 };
    const notFound = [];
    const failed = [];
    const batches = [];
    for (let i = 0; i < list.length; i += BATCH) batches.push(list.slice(i, i + BATCH));
    let next = 0;
    let processed = 0;
    const startedAt = Date.now();

    const paint = () => {
      const pct = list.length ? Math.round((processed / list.length) * 100) : 0;
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = processed > 0 ? (elapsed / processed) * (list.length - processed) : 0;
      runBox.innerHTML = `
        <div class="imp-run__top"><strong>${paused ? 'Paused' : 'Importing…'}</strong><span>${processed.toLocaleString()} of ${list.length.toLocaleString()} (${pct}%)${processed && !paused && processed < list.length ? ` · about ${fmtTime(left)} left` : ''}</span></div>
        <div class="imp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <div class="imp-stats">
          <span class="chip imp-chip imp-chip--ok">Added <b>${tally.added}</b></span>
          <span class="chip imp-chip">Already in store <b>${tally.exists}</b></span>
          <span class="chip imp-chip imp-chip--warn">Not found <b>${tally.not_found}</b></span>
          <span class="chip imp-chip imp-chip--bad">Failed <b>${tally.error}</b></span>
        </div>
        <div class="picked__actions"><button class="btn btn-secondary btn-sm" id="impPause">${paused ? 'Resume' : 'Pause'}</button><button class="btn btn-secondary btn-sm danger-outline" id="impCancel">Stop</button></div>`;
      $('impPause').addEventListener('click', () => { paused = !paused; paint(); });
      $('impCancel').addEventListener('click', () => { cancelled = true; paused = false; });
    };
    paint();

    const worker = async () => {
      while (!cancelled) {
        while (paused && !cancelled) await sleep(300);
        if (cancelled) break;
        const idx = next++;
        if (idx >= batches.length) break;
        const batch = batches[idx];

        let results = null;
        for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
          try { results = (await adminApi('/admin/games/import', { method: 'POST', body: { names: batch } })).results; break; } catch (err) {
            if (err.status && err.status < 500 && err.status !== 429) { toast(err.message, 'error'); break; }
            await sleep(1500 * (attempt + 1));
          }
        }
        if (!results) results = batch.map((name) => ({ name, status: 'error' }));

        results.forEach((r) => {
          tally[r.status] = (tally[r.status] || 0) + 1;
          if (r.status === 'not_found') notFound.push(r);
          if (r.status === 'error') failed.push(r.name);
        });
        processed += batch.length;
        paint();
      }
    };

    await Promise.all(Array.from({ length: WORKERS }, worker));
    running = false;
    window.removeEventListener('beforeunload', unload);
    runBox.hidden = true;
    finish({ tally, notFound, failed, total: list.length, processed, stopped: cancelled });
    onDone?.();
  }

  function finish({ tally, notFound, failed, total, processed, stopped }) {
    const box = $('impDone');
    box.hidden = false;
    const left = total - processed;
    box.innerHTML = `
      <div class="imp-done__head ${stopped ? 'is-stopped' : ''}"><span class="imp-done__icon">${icon(stopped ? 'alert' : 'check', 22)}</span>
        <div><strong>${stopped ? 'Import stopped' : 'Import finished'}</strong><small>${stopped ? `${processed.toLocaleString()} of ${total.toLocaleString()} names processed (${left.toLocaleString()} not started).` : `${total.toLocaleString()} names processed.`}</small></div></div>
      <div class="imp-stats">
        <span class="chip imp-chip imp-chip--ok">Added <b>${tally.added}</b></span>
        <span class="chip imp-chip">Already in store <b>${tally.exists}</b></span>
        <span class="chip imp-chip imp-chip--warn">Not found <b>${tally.not_found}</b></span>
        <span class="chip imp-chip imp-chip--bad">Failed <b>${tally.error}</b></span>
      </div>
      ${notFound.length ? `<details class="imp-list"><summary>${notFound.length} not found in the catalogue (tap to see)</summary>
        <ul>${notFound.slice(0, 200).map((r) => `<li><span>${esc(r.name)}</span>${r.suggestion ? `<small>closest: ${esc(r.suggestion)}</small>` : ''}</li>`).join('')}</ul>
        ${notFound.length > 200 ? `<p class="muted">Showing 200 of ${notFound.length}. Download the full list below.</p>` : ''}</details>` : ''}
      <div class="picked__actions">
        ${notFound.length ? `<button class="btn btn-secondary" id="impDl">Download not-found list</button>` : ''}
        ${failed.length ? `<button class="btn btn-primary" id="impRetry">Retry ${failed.length} failed</button>` : ''}
        <button class="btn btn-secondary" id="impAgain">Import another file</button>
      </div>`;
    $('impDl')?.addEventListener('click', () => {
      const blob = new Blob([notFound.map((r) => r.name).join('\r\n')], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'games-not-found.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('impRetry')?.addEventListener('click', () => run(failed, { retry: true }));
    $('impAgain').addEventListener('click', reset);
  }

  /* ------------------------------ file selection UI ------------------------------ */
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { onFile(fileInput.files[0]); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => onFile(e.dataTransfer.files[0]));
}
