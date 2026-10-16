/**
 * Central frontend configuration.
 *
 * The site always talks to the production API below (also when the frontend itself is opened on
 * localhost). To point it somewhere else for a test, set window.DARAZIFY_API_URL before the
 * modules load, or edit API_BASE_URL.
 */
export const API_BASE_URL = window.DARAZIFY_API_URL || 'https://darazify-backend.vercel.app/api';

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
