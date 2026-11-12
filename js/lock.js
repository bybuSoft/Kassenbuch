// App-Sperre per PIN (lokal pro Gerät, wird nicht in die Datensicherung übernommen)
import * as db from './db.js';
import { h } from './util.js';
import { hashPin, verifyPin } from './crypto.js';
import { field } from './ui.js';

export const hasPin = () => !!db.data.meta.pin;

/** Liefert den Sperr-Screen. onUnlock() wird nach Erfolg aufgerufen. */
export function lockScreen(onUnlock) {
  const setup = !hasPin();
  const p1 = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', placeholder: 'PIN', 'aria-label': 'PIN' });
  const p2 = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', placeholder: 'PIN wiederholen', 'aria-label': 'PIN wiederholen' });
  const err = h('div', { class: 'err', role: 'alert' });
  let fails = 0;
  const btn = h('button', { type: 'submit', class: 'btn primary big' }, setup ? 'PIN festlegen' : 'Entsperren');
  const form = h('form', { class: 'card lock', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    try {
      if (setup) {
        if (!/^\d{4,12}$/.test(p1.value)) { err.textContent = 'Die PIN muss aus 4 bis 12 Ziffern bestehen.'; return; }
        if (p1.value !== p2.value) { err.textContent = 'Die PINs stimmen nicht überein.'; return; }
        await db.setMeta('pin', await hashPin(p1.value));
        onUnlock();
      } else if (await verifyPin(p1.value, db.data.meta.pin)) {
        onUnlock();
      } else {
        fails++;
        err.textContent = 'Falsche PIN.';
        p1.value = '';
        if (fails >= 3) await new Promise((r) => setTimeout(r, Math.min(fails, 10) * 1000));
      }
    } catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
  } },
  h('h1', {}, 'Kassenbuch'),
  h('p', { class: 'muted' }, setup ? 'Bitte lege eine PIN für den Zugriffsschutz fest.' : 'Bitte PIN eingeben.'),
  field(setup ? 'Neue PIN' : 'PIN', p1), setup ? field('PIN wiederholen', p2) : null, err, btn);
  setTimeout(() => p1.focus(), 50);
  return form;
}

export async function changePin(oldPin, newPin) {
  if (!(await verifyPin(oldPin, db.data.meta.pin))) throw new Error('Die aktuelle PIN ist falsch.');
  if (!/^\d{4,12}$/.test(newPin)) throw new Error('Die neue PIN muss aus 4 bis 12 Ziffern bestehen.');
  await db.setMeta('pin', await hashPin(newPin));
}
