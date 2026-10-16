import { api } from './api.js';
import { icon } from './icons.js';
import { setBusy } from './ui.js';
import { setFieldError, clearErrors, formAlert, applyServerErrors } from './forms.js';

const form = document.getElementById('requestForm');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isPhone = (v) => /^[+\d\s()-]+$/.test(v) && v.replace(/\D/g, '').length >= 7;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(form);
  const f = form.elements;
  const game = f.gameName.value.trim();
  const contact = f.contact.value.trim();
  let bad = null;
  if (game.length < 2) { setFieldError(f.gameName, 'Enter the name of the game'); bad = f.gameName; }
  if (!isEmail(contact) && !isPhone(contact)) { setFieldError(f.contact, 'Enter a valid email or phone / WhatsApp number'); bad = bad || f.contact; }
  if (bad) return bad.focus();

  const btn = document.getElementById('rSend');
  setBusy(btn, true, 'Sending…');
  try {
    await api('/game-requests', { method: 'POST', body: { gameName: game, contact, name: f.name.value.trim(), note: f.note.value.trim(), website: f.website.value } });
    form.innerHTML = `<div class="request__done" role="status">${icon('check', 30)}<h3>Request received</h3><p>Thank you! We will add <b></b> if we can and get in touch.</p><button class="btn btn-secondary" type="button" id="rAgain">Request another game</button></div>`;
    form.querySelector('b').textContent = game;
    document.getElementById('rAgain').addEventListener('click', () => window.location.reload());
  } catch (err) {
    setBusy(btn, false);
    if (!applyServerErrors(form, err)) formAlert(form, err.message);
  }
});
