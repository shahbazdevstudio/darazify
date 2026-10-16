import { api } from './api.js';
import { icon } from './icons.js';
import { setBusy } from './ui.js';
import { setFieldError, clearErrors, formAlert, applyServerErrors } from './forms.js';

const mount = document.getElementById('requestMount');
if (mount) mount.innerHTML = `
  <section class="request" id="request" aria-labelledby="requestTitle">
    <div class="request__intro">
      <span class="request__icon">${icon('gamepad', 26)}</span>
      <h2 id="requestTitle">Can't find your game?</h2>
      <p>Tell us which game you want and how to reach you. We will add it to the store and contact you.</p>
    </div>
    <form class="request__form" id="requestForm" novalidate>
      <div class="field"><label for="rGame">Game name</label><input class="input" id="rGame" name="gameName" maxlength="120" placeholder="e.g. Red Dead Redemption 2" autocomplete="off"></div>
      <div class="field"><label for="rContact">Email or WhatsApp number</label><input class="input" id="rContact" name="contact" maxlength="100" placeholder="you@email.com or +92 3xx xxxxxxx" autocomplete="email"></div>
      <div class="field"><label for="rName">Your name <span class="muted">(optional)</span></label><input class="input" id="rName" name="name" maxlength="60" autocomplete="name"></div>
      <div class="field"><label for="rNote">Anything else? <span class="muted">(optional)</span></label><input class="input" id="rNote" name="note" maxlength="500" placeholder="Edition, platform, version…"></div>
      <input class="request__trap" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn btn-lg btn-signal" type="submit" id="rSend"><span>Request this game</span></button>
    </form>
  </section>`;

const form = document.getElementById('requestForm');
if (form) {
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
}
