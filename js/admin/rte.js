import { icon } from '../icons.js';
import { esc } from '../utils.js';

/**
 * Lightweight rich-text editor (contenteditable). Produces simple HTML limited to the tags the
 * backend allows (headings, bold/italic/underline, lists, links, quotes, colour). The backend
 * sanitises again before saving, so this never has to be trusted.
 */
export function createEditor(container, { value = '', placeholder = 'Describe the product…' } = {}) {
  const colors = ['#1a1310', '#b5621f', '#a3271a', '#1f6f4a', '#2a4fb5', '#6b3fa0'];
  container.classList.add('rte');
  container.innerHTML = `
    <div class="rte__bar" role="toolbar" aria-label="Text formatting">
      <select data-block aria-label="Text style"><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>
      <span class="rte__sep"></span>
      <button type="button" data-cmd="bold" title="Bold (Ctrl+B)" aria-label="Bold">${icon('bold', 17)}</button>
      <button type="button" data-cmd="italic" title="Italic (Ctrl+I)" aria-label="Italic">${icon('italic', 17)}</button>
      <button type="button" data-cmd="underline" title="Underline (Ctrl+U)" aria-label="Underline">${icon('underline', 17)}</button>
      <span class="rte__sep"></span>
      <button type="button" data-cmd="insertUnorderedList" title="Bullet list" aria-label="Bullet list">${icon('ul', 17)}</button>
      <button type="button" data-cmd="insertOrderedList" title="Numbered list" aria-label="Numbered list">${icon('ol', 17)}</button>
      <button type="button" data-block-quote title="Quote" aria-label="Quote">${icon('quote', 17)}</button>
      <span class="rte__sep"></span>
      <button type="button" data-link title="Add link" aria-label="Add link">${icon('link', 17)}</button>
      <div class="rte__colors" role="group" aria-label="Text colour"><span>${icon('palette', 17)}</span>${colors.map((c) => `<button type="button" data-color="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
      <span class="rte__sep"></span>
      <button type="button" data-cmd="removeFormat" title="Clear formatting" aria-label="Clear formatting">${icon('eraser', 17)}</button>
      <button type="button" data-cmd="undo" title="Undo" aria-label="Undo">${icon('undo', 17)}</button>
      <button type="button" data-cmd="redo" title="Redo" aria-label="Redo">${icon('redo', 17)}</button>
    </div>
    <div class="rte__link" hidden><input class="input" type="url" placeholder="https://example.com" aria-label="Link address"><button type="button" class="btn btn-sm btn-primary" data-apply>Apply</button><button type="button" class="btn btn-sm btn-secondary" data-unlink>Remove</button></div>
    <div class="rte__area rich" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Description" data-placeholder="${esc(placeholder)}"></div>`;

  const area = container.querySelector('.rte__area');
  const bar = container.querySelector('.rte__bar');
  const linkBox = container.querySelector('.rte__link');
  const linkInput = linkBox.querySelector('input');
  const blockSel = container.querySelector('[data-block]');
  area.innerHTML = value;

  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* older browsers */ }

  let saved = null;
  const saveSel = () => { const s = window.getSelection(); if (s.rangeCount && area.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { area.focus(); if (saved) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); } };
  const exec = (cmd, arg = null) => { restoreSel(); document.execCommand('styleWithCSS', false, cmd === 'foreColor'); document.execCommand(cmd, false, arg); sync(); };

  const sync = () => {
    if (!area.textContent.trim() && !area.querySelector('li, hr')) area.innerHTML = '';
    bar.querySelectorAll('[data-cmd]').forEach((b) => {
      if (['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].includes(b.dataset.cmd)) {
        let on = false;
        try { on = document.queryCommandState(b.dataset.cmd); } catch { /* ignore */ }
        b.classList.toggle('is-on', on);
      }
    });
    let block = 'p';
    try { block = (document.queryCommandValue('formatBlock') || 'p').replace(/[<>]/g, '').toLowerCase(); } catch { /* ignore */ }
    blockSel.value = ['h2', 'h3'].includes(block) ? block : 'p';
  };

  bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); }); // keep the selection
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cmd) exec(b.dataset.cmd);
    else if (b.dataset.color) exec('foreColor', b.dataset.color);
    else if (b.hasAttribute('data-block-quote')) exec('formatBlock', document.queryCommandValue('formatBlock') === 'blockquote' ? 'p' : 'blockquote');
    else if (b.hasAttribute('data-link')) { saveSel(); linkBox.hidden = !linkBox.hidden; if (!linkBox.hidden) linkInput.focus(); }
  });
  blockSel.addEventListener('change', () => exec('formatBlock', blockSel.value));

  const applyLink = () => {
    let url = linkInput.value.trim();
    if (!url) return;
    if (!/^(https?:|mailto:|tel:)/i.test(url)) url = `https://${url}`;
    exec('createLink', url);
    linkInput.value = '';
    linkBox.hidden = true;
  };
  linkBox.querySelector('[data-apply]').addEventListener('click', applyLink);
  linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') linkBox.hidden = true; });
  linkBox.querySelector('[data-unlink]').addEventListener('click', () => { exec('unlink'); linkBox.hidden = true; });

  // Paste as plain text so no foreign markup or styles sneak in
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  area.addEventListener('keyup', () => { saveSel(); sync(); });
  area.addEventListener('mouseup', () => { saveSel(); sync(); });
  area.addEventListener('input', sync);
  area.addEventListener('blur', saveSel);

  return {
    getHTML: () => (area.textContent.trim() || area.querySelector('li, hr') ? area.innerHTML : ''),
    getText: () => area.textContent.trim(),
    focus: () => area.focus(),
  };
}
