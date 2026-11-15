// Quittung (Druckansicht)
import * as db from './db.js';
import { h, chf, fmtDate } from './util.js';
import { printNode } from './ui.js';

/** Quittung als Druckansicht (iOS: Teilen/Drucken > als PDF sichern) */
export function printQuittung(b) {
  const k = db.data.kontakt.get(b.kontaktId);
  const eig = db.eigene();
  const kat = db.data.buchungskategorie.get(b.kategorieId);
  const adr = (c) => [c.strasse, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean);
  const row = (l, v) => h('tr', {}, h('th', {}, l), h('td', {}, v));
  printNode(h('div', { class: 'quittung' },
    h('div', { class: 'q-absender' }, h('strong', {}, db.kontaktName(eig)), ...adr(eig).map((l) => h('div', {}, l))),
    h('h1', {}, 'Quittung'),
    h('table', {},
      row('Datum', fmtDate(b.datum)),
      row('Erhalten von', h('div', {}, h('div', {}, db.kontaktName(k)), ...adr(k).map((l) => h('div', {}, l)))),
      row('Betrag', `CHF ${chf(Math.abs(b.betrag))}`),
      row('Für', [kat?.name, b.text].filter(Boolean).join(' – '))),
    h('div', { class: 'q-sign' }, h('div', {}, `${eig.ort || ''}${eig.ort ? ', ' : ''}${fmtDate(b.datum)}`), h('div', { class: 'line' }, 'Unterschrift'))));
}
