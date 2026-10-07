/**
 * Central frontend configuration.
 * To point the site at a different backend, set window.DARAZIFY_API_URL before loading any module,
 * or edit API_BASE_URL below. The games API key lives only on the backend (see backend/.env).
 */
const host = window.location.hostname || 'localhost';

export const API_BASE_URL = window.DARAZIFY_API_URL || `${window.location.protocol}//${host}:5000/api`;
export const GAMES_API_URL = `${API_BASE_URL}/games`;

export const GAME_PRICE = 250;
export const PAGE_SIZE = { games: 16, products: 12 };

/** CHANGE ME: contact details shown in the footer. Empty values are hidden automatically. */
export const SITE = {
  name: 'Darazify',
  email: 'support@darazify.com',
  phone: '',
  whatsapp: '',
  social: { instagram: '', facebook: '', tiktok: '' },
};
