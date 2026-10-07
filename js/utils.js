export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatPrice = (n) => `${Number(n || 0).toLocaleString('en-PK')} PKR`;

export const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

/** Cloudinary on-the-fly resize/optimise. */
export const cdn = (url, w = 640) =>
  url && url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${w},c_limit,q_auto,f_auto/`) : url;

/** RAWG serves resized copies of its images, which keeps game grids fast. */
export const gameImg = (url, w = 420) =>
  url && url.includes('media.rawg.io/media/games/') ? url.replace('/media/games/', `/media/resize/${w}/-/games/`) : url;

export const getParams = () => new URLSearchParams(window.location.search);

/** Updates the URL query string without reloading (keeps filters shareable). */
export const setParams = (obj, { replace = false } = {}) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined && v !== 1) p.set(k, v); });
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
};

export const truncate = (s = '', n = 110) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

export const stripHtml = (html = '') => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Turns plain text with blank-line separated paragraphs into safe <p> markup. */
export const paragraphs = (text = '') =>
  esc(text).split(/\n{2,}|\r\n\r\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
