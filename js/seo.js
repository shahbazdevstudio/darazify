/**
 * Runtime SEO helper for pages whose content comes from the API (game, product, software and series pages).
 * It keeps <title>, meta description/keywords, canonical, Open Graph, Twitter cards and JSON-LD in sync with
 * what the visitor (and Google's renderer) actually sees. Static pages carry the same tags in their HTML.
 */
import { SITE_URL, SITE } from './config.js';
import { stripHtml, truncate } from './utils.js';

const BRAND = SITE.name || 'Darazify';
const DEFAULT_IMAGE = '/assets/og-image.png';
const JSONLD_ID = 'seo-jsonld';

export const absUrl = (u = '/') => (/^https?:\/\//i.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`);

const head = document.head;

function upsert(selector, create, attrs) {
  let el = head.querySelector(selector);
  if (!el) { el = document.createElement(create); head.appendChild(el); }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}
const meta = (name, content) => content !== undefined && content !== null && content !== '' && upsert(`meta[name="${name}"]`, 'meta', { name, content });
const prop = (property, content) => content !== undefined && content !== null && content !== '' && upsert(`meta[property="${property}"]`, 'meta', { property, content });

/** The values the HTML shipped with, so a page can go back to them (e.g. leaving a series filter). */
const defaults = {
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content || '',
  keywords: document.querySelector('meta[name="keywords"]')?.content || '',
  canonical: document.querySelector('link[rel="canonical"]')?.href || `${SITE_URL}${window.location.pathname}`,
};

const withBrand = (t) => (t.toLowerCase().includes(BRAND.toLowerCase()) ? t : `${t} | ${BRAND}`);

export function setSeo({ title, description, keywords, canonical, image, type = 'website', noindex = false, jsonLd } = {}) {
  const fullTitle = withBrand(title || defaults.title);
  const desc = truncate(stripHtml(description || defaults.description), 158);
  const kw = Array.isArray(keywords) ? keywords.filter(Boolean).join(', ') : (keywords || defaults.keywords);
  const url = canonical ? absUrl(canonical) : defaults.canonical;
  const img = absUrl(image || DEFAULT_IMAGE);

  document.title = fullTitle;
  meta('description', desc);
  meta('keywords', kw);
  meta('robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: url });

  prop('og:type', type);
  prop('og:site_name', BRAND);
  prop('og:locale', 'en_PK');
  prop('og:title', fullTitle);
  prop('og:description', desc);
  prop('og:url', url);
  prop('og:image', img);
  prop('og:image:alt', title || BRAND);
  meta('twitter:card', 'summary_large_image');
  meta('twitter:title', fullTitle);
  meta('twitter:description', desc);
  meta('twitter:image', img);

  setJsonLd(jsonLd);
}

export const resetSeo = () => setSeo({ canonical: defaults.canonical });

export function setJsonLd(data) {
  const old = document.getElementById(JSONLD_ID);
  if (!data || (Array.isArray(data) && !data.length)) { old?.remove(); return; }
  const el = old || Object.assign(document.createElement('script'), { id: JSONLD_ID, type: 'application/ld+json' });
  el.textContent = JSON.stringify(data);
  if (!old) head.appendChild(el);
}

/* ------------------------- JSON-LD builders ------------------------- */
export const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.url) })),
});

/** types: ['Product'] for leather/software, ['Product', 'VideoGame'] for games. */
export function productLd({ types = ['Product'], name, description, images = [], url, price, inStock = true, category, brand = BRAND, sku, extra = {} }) {
  return {
    '@context': 'https://schema.org',
    '@type': types.length === 1 ? types[0] : types,
    name,
    description: truncate(stripHtml(description || ''), 500) || name,
    ...(images.length ? { image: images.slice(0, 6).map(absUrl) } : {}),
    ...(sku ? { sku: String(sku) } : {}),
    ...(category ? { category } : {}),
    brand: { '@type': 'Brand', name: brand },
    url: absUrl(url),
    offers: {
      '@type': 'Offer',
      url: absUrl(url),
      priceCurrency: 'PKR',
      price: Number(price || 0).toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: BRAND },
    },
    ...extra,
  };
}
