// Kunden-/Lieferantenblatt (Druckansicht, z. B. für Auskunftsbegehren nach DSGVO/DSG): alle gespeicherten Daten inkl. Buchungen
import * as db from './db.js';
import { h, chf, fmtDate, fmtDateTime } from './util.js';
import { printNode } from './ui.js';

const HEALTH = [['diabetes', 'Diabetes'], ['antikoaguliert', 'Antikoaguliert'], ['allergien', 'Allergien'], ['hiv', 'HIV-positiv'], ['haemophilie', 'Hämophilie']];
const GESCHLECHT = { w: 'weiblich', m: 'männlich', firma: 'Firma' };
const ANREDE = { du: 'Du', sie: 'Sie' };

/** Alle zum Kontakt gespeicherten Daten und Buchungen als Druckansicht (iOS: Drucken > Als PDF sichern). */
export function printKontakt(k) {
  const eig = db.eigene();
  const kat = db.data.kundenkategorie.get(k.kategorieId);
  const comms = db.commsOf(k.id).sort((a, b) => (b.bevorzugt ? 1 : 0) - (a.bevorzugt ? 1 : 0));
  const bs = db.buchungenOf(k.id).sort((a, b) => (a.datum === b.datum ? (a.created || 0) - (b.created || 0) : a.datum < b.datum ? -1 : 1));
  const total = bs.reduce((s, b) => s + b.betrag, 0);
  const row = (l, v) => (v ? h('tr', {}, h('th', {}, l), h('td', { class: 'pre' }, v)) : null);
  const health = k.istLieferant ? [] : HEALTH.filter(([key]) => k[key]).map(([, label]) => label);
  const adr = (c) => [c.strasse, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean);

  const stamm = h('table', { class: 'kd-tbl' },
    row('Art', k.istLieferant ? 'Lieferant' : 'Kunde'),
    k.istLieferant ? row('Name 1', k.name1) : row('Vorname', k.vorname),
    k.istLieferant ? row('Name 2', k.name2) : row('Name', k.name),
    row('Geburtsdatum', fmtDate(k.geburtsdatum)),
    row('Kundenkategorie', kat?.name),
    row('Geschlecht / Firma', GESCHLECHT[k.geschlecht]),
    row('Anrede', ANREDE[k.anrede]),
    row('Strasse', k.strasse),
    row('PLZ / Ort', [k.plz, k.ort].filter(Boolean).join(' ')),
    ...comms.map((c) => row(c.typ === 'mail' ? 'E-Mail' : 'Telefon', c.wert + (c.bevorzugt ? ' (bevorzugt)' : ''))),
    row('Gesundheit', health.join(', ')),
    row('Notizen', (k.notizen || '').trim()),
    row('Erfasst am', k.created ? fmtDateTime(k.created) : ''));

  const rows = bs.map((b) => h('tr', {}, h('td', {}, fmtDate(b.datum)),
    h('td', {}, [db.data.buchungskategorie.get(b.kategorieId)?.name, b.text].filter(Boolean).join(' – ')),
    h('td', { class: 'num' }, chf(b.betrag))));
  const buchungen = bs.length
    ? h('table', { class: 'tbl amt kd-bu' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Datum'), h('th', {}, 'Buchungskategorie / Text'), h('th', { class: 'num' }, 'Betrag (CHF)'))),
      h('tbody', {}, ...rows, h('tr', { class: 'total' }, h('td', { colspan: 2 }, `Total (${bs.length} Buchung${bs.length === 1 ? '' : 'en'})`), h('td', { class: 'num' }, chf(total)))))
    : h('p', {}, 'Keine Buchungen vorhanden.');

  printNode(h('div', { class: 'kontaktdruck' },
    h('div', { class: 'q-absender' }, h('strong', {}, db.kontaktName(eig)), ...adr(eig).map((l) => h('div', {}, l))),
    h('h1', {}, `Gespeicherte Daten: ${db.kontaktName(k)}`),
    h('p', { class: 'muted' }, `Erstellt: ${fmtDateTime(Date.now())}`),
    h('h3', {}, 'Stammdaten'), stamm,
    h('h3', {}, 'Buchungen'), buchungen));
}
