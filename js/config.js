/**
 * Central frontend configuration.
 *
 * The site always talks to the production API below (also when the frontend itself is opened on
 * localhost). To point it somewhere else for a test, set window.DARAZIFY_API_URL before the
 * modules load, or edit API_BASE_URL.
 */
const PROD_API = 'https://darazify-backend.vercel.app/api';

// While testing on localhost / 127.0.0.1 you can switch to the API running on your own computer
// (cd backend && npm run dev -> port 5000). Open any page once with ?api=local to turn it on and
// ?api=prod to go back to the live API. The choice is remembered in this browser.
const pickApi = () => {
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return PROD_API;
  try {
    const q = new URLSearchParams(window.location.search).get('api');
    if (q === 'local') localStorage.setItem('dz_api', 'local');
    else if (q === 'prod') localStorage.removeItem('dz_api');
    if (localStorage.getItem('dz_api') === 'local') return `http://${host}:5000/api`;
  } catch { /* storage blocked: stay on the live API */ }
  return PROD_API;
};

export const API_BASE_URL = window.DARAZIFY_API_URL || pickApi();

/**
 * Public address of the live website (no trailing slash). Used for canonical links, Open Graph URLs,
 * structured data and the sitemap. Change it here (and in robots.txt / sitemap.xml) if the main domain changes.
 */
export const SITE_URL = 'https://www.darazify.site';

export const GAMES_API_URL = `${API_BASE_URL}/games`;

export const GAME_PRICE = 250;

export const PAGE_SIZE = {
  games: 16,
  products: 12,
};

/**
 * Contact details shown in the footer.
 * Empty values are hidden automatically.
 */
export const SITE = {
  name: 'Darazify',
  email: 'support.darazify@gmail.com',
  phone: '+92 305 7152387',
  whatsapp: '+92 305 7152387',

  // Channel link shown in the footer. Paste the URL here; it stays hidden while empty.
  channel: { url: '', label: 'Join our channel' },

  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
};
