// Quittung (Druckansicht)
import * as db from './db.js';
import { h, chf, fmtDate } from './util.js';
import { printNode, showModal } from './ui.js';

/** Bei Buchungen mit Stiftung-Anteil: fragen, welcher Betrag auf die Quittung soll. Liefert die Positionen, null = Abbruch. */
async function askPositionen(b) {
  const ps = b.positionen;
  if (!ps.some((p) => p.stiftung)) return ps;
  const bar = ps.filter((p) => !p.stiftung), stift = ps.filter((p) => p.stiftung);
  const sum = (arr) => arr.reduce((s, p) => s + p.betrag, 0);
  const opts = [{ label: `Gesamtbetrag CHF ${chf(sum(ps))}`, value: ps, cls: 'primary' }];
  if (bar.length && stift.length) {
    opts.push({ label: `Nur Barbetrag CHF ${chf(sum(bar))}`, value: bar }, { label: `Nur Stiftungsbetrag CHF ${chf(sum(stift))}`, value: stift });
  }
  const ctl = showModal({
    title: 'Quittung drucken',
    body: h('p', { class: 'pre' }, `Diese Buchung enthält einen Betrag, der über die Stiftung abgerechnet wird.\nWelcher Betrag soll auf die Quittung?\n\nDavon via Stiftung: CHF ${chf(sum(stift))}\nDavon bar: CHF ${chf(sum(bar))}`),
    buttons: [...opts.map((o, i) => ({ ...o, row: i, grow: true })), { label: 'Abbrechen', value: null, row: opts.length, grow: true }],
  });
  const r = await ctl.closed;
  return r === undefined ? null : r;
}

/** Quittung als Druckansicht (iOS: Teilen/Drucken > als PDF sichern). Bei Stiftung-Anteil wird vorher nach dem Betrag gefragt. */
export async function printQuittung(b) {
  const ps = await askPositionen(b);
  if (!ps) return;
  const k = db.data.kontakt.get(b.kontaktId);
  const eig = db.eigene();
  const adr = (c) => [c.strasse, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean);
  const row = (l, v) => h('tr', {}, h('th', {}, l), h('td', {}, v));
  const total = ps.reduce((s, p) => s + p.betrag, 0);
  const nm = (p) => db.data.buchungskategorie.get(p.kategorieId)?.name || '?';
  const fuer = ps.length > 1
    ? h('div', {}, ...ps.map((p) => h('div', {}, `${nm(p)}: CHF ${chf(Math.abs(p.betrag))}`)), b.text ? h('div', {}, b.text) : null)
    : [nm(ps[0]), b.text].filter(Boolean).join(' – ');
  printNode(h('div', { class: 'quittung' },
    h('div', { class: 'q-absender' }, h('strong', {}, db.kontaktName(eig)), ...adr(eig).map((l) => h('div', {}, l))),
    h('h1', {}, 'Quittung'),
    h('table', {},
      row('Datum', fmtDate(b.datum)),
      row('Erhalten von', h('div', {}, h('div', {}, db.kontaktListName(k)), ...adr(k).map((l) => h('div', {}, l)))),
      row('Betrag', `CHF ${chf(Math.abs(total))}`),
      row('Für', fuer)),
    h('div', { class: 'q-sign' }, h('div', {}, `${eig.ort || ''}${eig.ort ? ', ' : ''}${fmtDate(b.datum)}`), h('div', { class: 'line' }, 'Unterschrift'))));
}
