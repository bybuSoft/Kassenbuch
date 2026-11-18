// Kunden-/Lieferantenblatt (Druckansicht, z. B. für Auskunftsbegehren nach DSGVO/DSG): alle gespeicherten Daten inkl. Buchungen
import * as db from './db.js';
import { h, chf, fmtDate, fmtDateTime } from './util.js';
import { printNode } from './ui.js';

const HEALTH = [['diabetes', 'Diabetes'], ['antikoaguliert', 'Antikoaguliert'], ['allergien', 'Allergien'], ['hiv', 'HIV-positiv'], ['haemophilie', 'Hämophilie']];
const GESCHLECHT = { w: 'weiblich', m: 'männlich', firma: 'Firma' };
const ANREDE = { du: 'Du', sie: 'Sie' };

/** Alle zum Kontakt gespeicherten Daten und Buchungen als Druckansicht (iOS: Drucken > Als PDF sichern). */
export function printKontakt(k, { from = '0000-01-01', to = '9999-12-31' } = {}) {
  const eig = db.eigene();
  const kat = db.data.kundenkategorie.get(k.kategorieId);
  const comms = db.commsOf(k.id).sort((a, b) => (b.bevorzugt ? 1 : 0) - (a.bevorzugt ? 1 : 0));
  const alles = from === '0000-01-01' && to === '9999-12-31';
  const bs = db.buchungenOf(k.id).filter((b) => b.datum >= from && b.datum <= to).sort((a, b) => (a.datum === b.datum ? (a.created || 0) - (b.created || 0) : a.datum < b.datum ? -1 : 1));
  const total = bs.reduce((s, b) => s + b.betrag, 0);
  const adr = (c) => [c.strasse, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean);
  const commText = (list) => list.map((c) => c.wert + (c.bevorzugt && list.length > 1 ? ' (bevorzugt)' : '')).join(', ');
  const mails = comms.filter((c) => c.typ === 'mail'); const tels = comms.filter((c) => c.typ !== 'mail');

  // Stammdaten kompakt: zwei Felder pro Zeile (alle Felder, leere mit «–»), Gesundheit und Notizen über die ganze Breite
  const items = [
    ['Art', k.istLieferant ? 'Lieferant' : 'Kunde'], ['Erfasst am', k.created ? fmtDateTime(k.created) : ''],
    ...(k.istLieferant
      ? [['Name 1', k.name1], ['Name 2', k.name2]]
      : [['Vorname', k.vorname], ['Name', k.name], ['Geburtsdatum', fmtDate(k.geburtsdatum)], ['Kategorie / Stock', [kat?.name, k.stock].filter(Boolean).join(' / ')]]),
    ['Geschlecht / Firma', GESCHLECHT[k.geschlecht]], ['Anrede', ANREDE[k.anrede]],
    ['Strasse', k.strasse], ['PLZ / Ort', [k.plz, k.ort].filter(Boolean).join(' ')],
    ['Telefon', commText(tels)], ['E-Mail', commText(mails)],
  ];
  const cell = (l, v) => [h('th', {}, l), h('td', {}, v || '–')];
  const trs = [];
  for (let i = 0; i < items.length; i += 2) trs.push(h('tr', {}, ...cell(...items[i]), ...(items[i + 1] ? cell(...items[i + 1]) : [h('th'), h('td')])));
  const wide = (l, v) => h('tr', {}, h('th', {}, l), h('td', { colspan: 3, class: 'pre' }, v || '–'));
  if (!k.istLieferant) trs.push(wide('Gesundheit', HEALTH.map(([key, label]) => `${label}: ${k[key] ? 'Ja' : 'Nein'}`).join(' · ')));
  trs.push(wide('Notizen', (k.notizen || '').trim()));
  const stamm = h('table', { class: 'kd-tbl' }, ...trs);

  const rows = bs.map((b) => h('tr', {}, h('td', {}, fmtDate(b.datum)),
    h('td', {}, [db.data.buchungskategorie.get(b.kategorieId)?.name, b.text].filter(Boolean).join(' – ')),
    h('td', { class: 'num' }, chf(b.betrag))));
  const buchungen = bs.length
    ? h('table', { class: 'tbl amt kd-bu' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Datum'), h('th', {}, 'Buchungskategorie / Text'), h('th', { class: 'num' }, 'Betrag (CHF)'))),
      h('tbody', {}, ...rows, h('tr', { class: 'total' }, h('td', { colspan: 2 }, `Total (${bs.length} Buchung${bs.length === 1 ? '' : 'en'})`), h('td', { class: 'num' }, chf(total)))))
    : h('p', {}, 'Keine Buchungen vorhanden.');

  printNode(h('div', { class: 'kontaktdruck' },
    h('div', { class: 'kd-head' }, h('div', { class: 'q-absender' }, h('strong', {}, db.kontaktName(eig)), ...adr(eig).map((l) => h('span', {}, ` · ${l}`))), h('span', { class: 'muted' }, `Erstellt: ${fmtDateTime(Date.now())}`)),
    h('h1', {}, `Gespeicherte Daten: ${db.kontaktName(k)}`),
    h('h3', {}, 'Stammdaten'), stamm,
    h('h3', {}, alles ? 'Buchungen' : `Buchungen ${fmtDate(from)} – ${fmtDate(to)}`), buchungen));
}
