import { icon } from './icons.js';

/** Fills <el data-i="name" data-s="size"> placeholders with inline SVG icons. */
document.querySelectorAll('[data-i]').forEach((el) => {
  el.innerHTML = icon(el.dataset.i, Number(el.dataset.s) || 22);
});
