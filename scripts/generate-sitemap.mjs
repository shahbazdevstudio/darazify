/**
 * Builds sitemap.xml with the static pages + every game, series, leather product and software item.
 *   npm run sitemap
 * Run it before each deploy (or on a schedule) so new items are discovered by Google quickly.
 * Needs Node 18+ (global fetch). Override the API with  API_URL=http://localhost:5000/api npm run sitemap
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE = process.env.SITE_URL || 'https://www.darazify.site';
const API = process.env.API_URL || 'https://darazify-backend.vercel.app/api';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'sitemap.xml');

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
};

async function paged(path, key, size, sizeParam) {
  const out = [];
  for (let page = 1; page < 500; page += 1) {
    const data = await get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&${sizeParam}=${size}`);
    out.push(...(data[key] || []));
    if (page >= (data.pagination?.totalPages || 1)) break;
  }
  return out;
}

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = new Date().toISOString().slice(0, 10);
const urls = [
  ['/', 'daily', '1.0'],
  ['/pages/games.html', 'daily', '0.9'],
  ['/pages/products.html', 'weekly', '0.9'],
  ['/pages/software.html', 'weekly', '0.8'],
];

const safe = async (label, fn) => { try { return await fn(); } catch (e) { console.warn(`! ${label}: ${e.message}`); return []; } };

const [games, series, products, software] = await Promise.all([
  safe('games', () => paged('/games', 'games', 40, 'pageSize')),
  safe('series', async () => (await get('/series')).series || []),
  safe('products', () => paged('/products', 'products', 50, 'limit')),
  safe('software', () => paged('/software', 'software', 50, 'limit')),
]);

series.forEach((s) => urls.push([`/pages/games.html?series=${encodeURIComponent(s.slug)}`, 'weekly', '0.8']));
games.forEach((g) => urls.push([`/pages/game-details.html?id=${encodeURIComponent(g.id)}`, 'weekly', '0.7']));
products.forEach((p) => urls.push([`/pages/product-details.html?id=${encodeURIComponent(p._id)}`, 'weekly', '0.7']));
software.forEach((p) => urls.push([`/pages/software-details.html?id=${encodeURIComponent(p._id)}`, 'weekly', '0.6']));

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map(([p, f, pr]) => `  <url><loc>${x(SITE + p)}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`)
  .join('\n')}\n</urlset>\n`;

writeFileSync(OUT, xml);
console.log(`sitemap.xml written: ${urls.length} URLs (${games.length} games, ${series.length} series, ${products.length} leather, ${software.length} software)`);
