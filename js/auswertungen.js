// Auswertungen: Perioden, Kundenkategorien, Seniorenzentrum-Liste, Treuhänder-Export (Excel)
import * as db from './db.js';
import { h, chf, today, isoDate, fmtDate, fmtDateTime, monthOf, monthLabel, monthShort, lastDayOfMonth, saveBlob, collator } from './util.js';
import { field, segmented, toast, printNode } from './ui.js';
import { buildXlsx, XLSX_MIME } from './xlsx.js';
import { periodBar } from './periodbar.js';
import { nav } from './nav.js';

const state = {
  tab: 'perioden',
  custom: false, from: '', to: '',
  senKat: '', vj: false, level: 'monat', year: String(new Date().getFullYear() - 1),
};
const REPORTS = [
  ['perioden', 'Perioden'], ['kategorien', 'Kategorien'], ['senioren', 'Kundenliste'], ['treuhaender', 'Treuhänder'],
];

const inRange = (b) => b.datum >= state.from && b.datum <= state.to;
const sum = (arr) => arr.reduce((s, b) => s + b.betrag, 0);
const th = (...c) => h('thead', {}, h('tr', {}, ...c.map((x, i) => h('th', { class: x.num ? 'num' : '' }, x.t ?? x))));

export function auswertungenScreen() {
  if (!state.custom) { state.from = `${monthOf(today())}-01`; state.to = lastDayOfMonth(monthOf(today())); } // nach Monatswechsel wieder der aktuelle Monat
  const tabs = segmented(REPORTS.map(([value, label]) => ({ value, label })), state.tab, (v) => { state.tab = v; nav.refresh(); });
  tabs.classList.add('compact');
  const body = { perioden, kategorien, senioren, treuhaender }[state.tab]();
  const vjBtn = state.tab === 'perioden' || state.tab === 'kategorien'
    ? h('button', { type: 'button', class: `btn small toggle${state.vj ? ' on' : ''}`, 'aria-pressed': String(state.vj), title: 'Vorjahresvergleich', onclick: () => { state.vj = !state.vj; nav.refresh(); } }, 'VJ-Vergleich') : null;
  const bar = state.tab === 'treuhaender' ? yearBar() : periodBar({ from: state.from, to: state.to, extra: vjBtn, onSet: (f, t) => { state.from = f; state.to = t; state.custom = true; nav.refresh(); } });
  // Kopfbereich (Reiter + Periode) bleibt beim Scrollen stehen
  return {
    title: 'Auswertungen', back: 'menu',
    actions: body._print ? [h('button', { class: 'btn', onclick: body._print }, 'Drucken / PDF')] : [],
    node: h('div', { class: 'stack' }, h('div', { class: 'sticky-head' }, tabs, bar), body),
  };
}

/** Treuhänder: immer ein ganzes Jahr (Vorgabe: Vorjahr) */
function yearBar() {
  const cy = new Date().getFullYear();
  const years = new Set([cy, cy - 1, +state.year, ...db.buchungenList().map((b) => +b.datum.slice(0, 4))]);
  const sel = h('select', { 'aria-label': 'Jahr', onchange: () => { state.year = sel.value; nav.refresh(); } }, ...[...years].sort((a, b) => b - a).map((y) => h('option', { value: String(y) }, String(y))));
  sel.value = state.year;
  return field('Jahr', sel);
}

// ---- Vorjahresvergleich (optional) -------------------------------------------------------
const shiftYear = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y - 1, m - 1, Math.min(d, new Date(y - 1, m, 0).getDate())));
};
const prevRange = (b) => b.datum >= shiftYear(state.from) && b.datum <= shiftYear(state.to);

/** Tabelle mit optionaler Vorjahresspalte. rows: [name, aktuell, vorjahr, [anzahl]] */
function compareTable(title, firstCol, rows, cls, { count = false } = {}) {
  const vj = state.vj;
  const tot = rows.reduce((t, r) => [t[0] + r[1], t[1] + r[2]], [0, 0]);
  const diff = (a, b) => h('td', { class: `num ${(a - b >= 0) === (cls !== 'out') ? 'in' : 'out'}` }, `${a - b > 0 ? '+' : ''}${chf(a - b)}`);
  return h('div', { class: 'card' }, h('h3', {}, title),
    h('table', { class: 'tbl amt' },
      th(firstCol, ...(count ? [{ t: 'Anzahl', num: 1 }] : []), { t: 'Betrag', num: 1 }, ...(vj ? [{ t: 'Vorjahr', num: 1 }, { t: 'Diff.', num: 1 }] : [])),
      h('tbody', {}, ...rows.flatMap(([n, v, p, c, kids]) => {
        const cells = (cnt, vv, pp) => [...(count ? [h('td', { class: 'num' }, cnt ?? '')] : []), h('td', { class: 'num' }, chf(vv)), ...(vj ? [h('td', { class: 'num' }, chf(pp)), diff(vv, pp)] : [])];
        const main = h('tr', {}, h('td', {}, n), ...cells(c, v, p));
        if (!kids || !kids.length) return [main];
        const kidRows = kids.map(([kn, kv, kp, kc]) => { const r = h('tr', { class: 'kid' }, h('td', {}, kn), ...cells(kc, kv, kp)); r.hidden = true; return r; });
        main.classList.add('drill'); main.title = 'Antippen: Aufteilung nach Kategorie';
        main.addEventListener('click', () => { const open = main.classList.toggle('open'); kidRows.forEach((r) => { r.hidden = !open; }); });
        return [main, ...kidRows];
      }),
        h('tr', { class: 'total' }, h('td', {}, 'Total'), ...(count ? [h('td', {})] : []), h('td', { class: `num ${cls}` }, chf(tot[0])),
          ...(vj ? [h('td', { class: 'num' }, chf(tot[1])), diff(tot[0], tot[1])] : [])))));
}

/** Gruppiert Buchungen (aktuell/Vorjahr) nach keyFn und liefert [name, summe, vorjahr, anzahl] */
function groupRows(cur, prev, keyFn, nameFn) {
  const m = new Map();
  const add = (arr, i) => arr.forEach((b) => { const k = keyFn(b); const o = m.get(k) || [0, 0, 0]; o[i] += db.artOf(b) === 'ausgabe' ? -b.betrag : b.betrag; if (i === 0) o[2]++; m.set(k, o); });
  add(cur, 0); if (state.vj) add(prev, 1);
  return [...m].map(([k, o]) => [nameFn(k), o[0], o[1], o[2]]).sort((a, b) => collator.compare(a[0], b[0]));
}

// ---- Perioden ---------------------------------------------------------------
function perioden() {
  const all = db.buchungenList();
  const bs = all.filter(inRange), pv = state.vj ? all.filter(prevRange) : [];
  const isE = (b) => db.artOf(b) === 'einnahme', isA = (b) => db.artOf(b) === 'ausgabe';
  const ein = sum(bs.filter(isE)), aus = -sum(bs.filter(isA));
  const pein = sum(pv.filter(isE)), paus = -sum(pv.filter(isA));
  const catName = (id) => db.data.buchungskategorie.get(id)?.name || '?';
  const byCat = (art) => groupRows(bs.filter((b) => db.artOf(b) === art), pv.filter((b) => db.artOf(b) === art), (b) => b.kategorieId, catName);
  const sm = (label, v, p, cls) => h('div', {}, h('span', { class: 'muted' }, label), h('strong', { class: cls }, chf(v)), state.vj ? h('span', { class: 'muted' }, `Vorjahr ${chf(p)}`) : null);
  const months = new Map();
  const addM = (arr, vj) => arr.forEach((b) => {
    const mo = vj ? `${+monthOf(b.datum).slice(0, 4) + 1}${monthOf(b.datum).slice(4)}` : monthOf(b.datum);
    const o = months.get(mo) || { e: 0, a: 0, pe: 0, pa: 0 };
    if (db.artOf(b) === 'einnahme') o[vj ? 'pe' : 'e'] += b.betrag; else o[vj ? 'pa' : 'a'] -= b.betrag;
    months.set(mo, o);
  });
  addM(bs, false); addM(pv, true);
  const monthRows = [...months].sort().filter(([, o]) => o.e || o.a || !state.vj).map(([mo, o]) => h('tr', {}, h('td', {}, monthShort(mo)),
    h('td', { class: 'num' }, chf(o.e)), h('td', { class: 'num' }, chf(o.a)), h('td', { class: 'num' }, chf(o.e - o.a)),
    ...(state.vj ? [h('td', { class: 'num' }, chf(o.pe - o.pa))] : [])));
  return h('div', { class: 'stack' },
    h('div', { class: 'summary' }, sm('Einnahmen (Kunden)', ein, pein, 'in'), sm('Ausgaben (Lieferanten)', aus, paus, 'out'), sm('Saldo', ein - aus, pein - paus, '')),
    compareTable('Einnahmen (Kunden) nach Kategorie', 'Kategorie', byCat('einnahme'), 'in'),
    compareTable('Ausgaben (Lieferanten) nach Kategorie', 'Kategorie', byCat('ausgabe'), 'out'),
    h('div', { class: 'card' }, h('h3', {}, 'Nach Monat'),
      h('table', { class: 'tbl amt' }, th('Monat', { t: 'Einnahmen', num: 1 }, { t: 'Ausgaben', num: 1 }, { t: 'Saldo', num: 1 }, ...(state.vj ? [{ t: 'Saldo Vorjahr', num: 1 }] : [])), h('tbody', {}, ...monthRows))));
}

// ---- Kategorien: Kunden (nach Kundenkategorie) und Lieferanten (nach Lieferant) -----------------
function kategorien() {
  const all = db.buchungenList();
  const sel = (arr) => arr.filter((b) => db.artOf(b) === 'einnahme');
  const lie = (arr) => arr.filter((b) => db.artOf(b) === 'ausgabe');
  const cur = all.filter(inRange), prev = state.vj ? all.filter(prevRange) : [];
  const katOf = (b) => db.data.kontakt.get(b.kontaktId)?.kategorieId || '';
  const kundenRows = groupRows(sel(cur), sel(prev), katOf, (id) => (id ? db.data.kundenkategorie.get(id)?.name || '?' : '(ohne Kategorie)'));
  const lieferantRows = groupRows(lie(cur), lie(prev), (b) => b.kontaktId, (id) => db.kontaktName(db.data.kontakt.get(id)) || '?');
  const catName = (id) => db.data.buchungskategorie.get(id)?.name || '?';
  // Drilldown: je Lieferant nach Buchungskategorie
  const ids = new Map(); // Name -> Kontakt-IDs (gleichnamige Lieferanten werden getrennt aufgelöst)
  [...lie(cur), ...lie(prev)].forEach((b) => { const n = db.kontaktName(db.data.kontakt.get(b.kontaktId)) || '?'; if (!ids.has(n)) ids.set(n, new Set()); ids.get(n).add(b.kontaktId); });
  lieferantRows.forEach((r) => {
    const set = ids.get(r[0]) || new Set();
    const of = (arr) => arr.filter((b) => set.has(b.kontaktId));
    r[4] = groupRows(of(lie(cur)), of(lie(prev)), (b) => b.kategorieId, catName);
  });
  return h('div', { class: 'stack' },
    compareTable('Kunden: Einnahmen nach Kundenkategorie', 'Kategorie', kundenRows, 'in', { count: true }),
    compareTable('Lieferanten: Ausgaben nach Lieferant (antippen für Kategorien)', 'Lieferant', lieferantRows, 'out', { count: true }));
}

// ---- Kundenliste (z. B. Seniorenzentrum): Vorname, Name, Betrag, gruppiert nach Tag, Total pro Monat ---------
function senioren() {
  const kats = db.kategorienList('kundenkategorie');
  if (state.senKat && !db.data.kundenkategorie.has(state.senKat)) state.senKat = '';
  const sel = h('select', { 'aria-label': 'Kundenkategorie', onchange: () => { state.senKat = sel.value; nav.refresh(); } }, h('option', { value: '' }, '– Kategorie wählen –'), ...kats.map((c) => h('option', { value: c.id }, c.name)));
  sel.value = state.senKat;
  const bs = !state.senKat ? [] : db.buchungenList().filter(inRange).filter((b) => db.artOf(b) === 'einnahme' && db.data.kontakt.get(b.kontaktId)?.kategorieId === state.senKat)
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  const out = h('div', { class: 'report' });
  const catName = db.data.kundenkategorie.get(state.senKat)?.name || '';
  out.append(h('p', {}, h('strong', {}, db.kontaktName(db.eigene()))), h('h3', {}, `Kundenliste ${catName}`), h('p', { class: 'muted' }, `${fmtDate(state.from)} – ${fmtDate(state.to)}`));
  if (!state.senKat) out.append(h('p', { class: 'muted' }, 'Bitte eine Kundenkategorie wählen.'));
  else if (!bs.length) out.append(h('p', { class: 'muted' }, 'Keine Buchungen für diese Kategorie im gewählten Zeitraum.'));
  const months = [...new Set(bs.map((b) => monthOf(b.datum)))];
  for (const mo of months) {
    out.append(h('h4', {}, monthLabel(mo)));
    const rows = [];
    let lastDay = '';
    for (const b of bs.filter((x) => monthOf(x.datum) === mo)) {
      if (b.datum !== lastDay) { lastDay = b.datum; rows.push(h('tr', { class: 'daytr' }, h('td', { colspan: 3 }, fmtDate(b.datum)))); }
      const k = db.data.kontakt.get(b.kontaktId);
      rows.push(h('tr', {}, h('td', {}, k.vorname), h('td', {}, k.name), h('td', { class: 'num' }, chf(b.betrag))));
    }
    rows.push(h('tr', { class: 'total' }, h('td', { colspan: 2 }, `Total ${monthLabel(mo)}`), h('td', { class: 'num' }, chf(sum(bs.filter((x) => monthOf(x.datum) === mo))))));
    out.append(h('table', { class: 'tbl amt' }, th('Vorname', 'Name', { t: 'Betrag (CHF)', num: 1 }), h('tbody', {}, ...rows)));
  }
  const node = h('div', { class: 'stack' }, field('Kundenkategorie', sel), h('div', { class: 'card' }, out));
  node._print = () => printNode(out.cloneNode(true));
  return node;
}

// ---- Treuhänder-Export ---------------------------------------------------------------
/** Anzahl Buchungen, bei denen die Kategorie nicht zum Kontakttyp passt (Kunde: Einnahme, Lieferant: Ausgabe) */
export const unstimmigeBuchungen = (bs) => bs.filter((b) => { const k = db.data.kontakt.get(b.kontaktId); return k && db.artOf(b) !== db.artOfKontakt(k); }).length;

export const LEVELS = [['einzel', 'Einzelbuchung'], ['tag', 'Tag'], ['monat', 'Monat'], ['jahr', 'Jahr']];
const levelLabel = (l) => LEVELS.find(([v]) => v === l)?.[1] || 'Monat';

/**
 * Daten für den Treuhänder-Export. level: 'einzel' | 'tag' | 'monat' | 'jahr'.
 * Personenbezug: Namen nur bei Lieferanten (nie bei Kunden), keine Buchungstexte.
 */
export function treuhaenderRows(from, to, level = 'monat', now = Date.now()) {
  const bs = db.buchungenList().filter((b) => b.datum >= from && b.datum <= to);
  const B = (s) => ({ s, b: true });
  const eig = db.eigene();
  const firma = [[B(db.kontaktName(eig))], ...[eig.strasse, [eig.plz, eig.ort].filter(Boolean).join(' ')].filter(Boolean).map((l) => [l]), ['Zeitraum', `${fmtDate(from)} – ${fmtDate(to)}`], ['Erzeugt', fmtDateTime(now)], ['Zusammenfassung', levelLabel(level)]];

  const periodKey = (b) => (level === 'jahr' ? b.datum.slice(0, 4) : level === 'monat' ? b.datum.slice(0, 7) : b.datum);
  const periodCell = (k) => (level === 'jahr' ? k : level === 'monat' ? `${k.slice(5, 7)}.${k.slice(0, 4)}` : { d: k });
  const periodHead = level === 'jahr' ? 'Jahr' : level === 'monat' ? 'Monat' : 'Datum';
  const items = bs.map((b) => {
    const k = db.data.kontakt.get(b.kontaktId);
    const lief = !!k?.istLieferant;
    return { b, per: periodKey(b), lief: lief ? (db.kontaktName(k) || '?') : '', liefId: lief ? b.kontaktId : '',
      kk: lief ? '' : (db.data.kundenkategorie.get(k?.kategorieId)?.name || ''), bk: db.data.buchungskategorie.get(b.kategorieId)?.name || '' };
  });
  let lines;
  if (level === 'einzel') lines = items.map((i) => ({ ...i, betrag: i.b.betrag, created: i.b.created || 0 }));
  else {
    const m = new Map();
    for (const i of items) { const key = [i.per, i.liefId, i.kk, i.bk].join('\u0001'); const o = m.get(key); if (o) o.betrag += i.b.betrag; else m.set(key, { ...i, betrag: i.b.betrag }); }
    lines = [...m.values()];
  }
  lines.sort((x, y) => (x.per < y.per ? -1 : x.per > y.per ? 1 : collator.compare(x.lief, y.lief) || collator.compare(x.kk, y.kk) || collator.compare(x.bk, y.bk) || (x.created || 0) - (y.created || 0)));
  const buchungen = [[B(periodHead), B('Lieferant (Kunde leer)'), B('Kundenkategorie'), B('Buchungskategorie'), B('Betrag CHF')],
    ...lines.map((l) => [periodCell(l.per), l.lief, l.kk, l.bk, { n: l.betrag / 100, f: 'money' }])];
  return { firma, buchungen, count: bs.length, unstimmig: unstimmigeBuchungen(bs) };
}

function treuhaender() {
  const from = `${state.year}-01-01`, to = `${state.year}-12-31`;
  const { count, unstimmig } = treuhaenderRows(from, to, state.level);
  const eig = db.eigene();
  const levels = segmented(LEVELS.map(([value, label]) => ({ value, label })), state.level, (v) => { state.level = v; nav.refresh(); });
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' },
      h('h3', {}, 'Export für den Treuhänder (Excel)'),
      h('p', { class: 'notice' }, 'Hinweis: Es werden keine personenbezogenen Daten exportiert. Kunden erscheinen nur mit ihrer Kategorie, ohne Name und Buchungstext; bei Lieferanten steht der Name.'),
      unstimmig ? h('p', { class: 'notice' }, `Hinweis: ${unstimmig} Buchung${unstimmig === 1 ? '' : 'en'} mit unstimmiger Zuordnung (Kategorie passt nicht zum Kontakttyp, z. B. nach Typwechsel eines Kontakts). Bitte vor dem Versand prüfen.`) : null,
      field('Zusammenfassungsebene', levels),
      h('p', { class: 'muted' }, `${count} Buchungen im Jahr ${state.year}.`),
      h('button', { class: 'btn primary', disabled: !count, onclick: async () => {
        const { firma, buchungen } = treuhaenderRows(from, to, state.level);
        const bytes = buildXlsx([
          { name: db.kontaktName(eig).slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Firma', rows: firma, widths: [24, 30] },
          { name: 'Buchungen', rows: buchungen, widths: [14, 30, 24, 24, 14] },
        ]);
        const name = `kassenbuch-treuhaender-${state.year}.xlsx`;
        await saveBlob(new Blob([bytes], { type: XLSX_MIME }), name);
        toast(`Excel erstellt: ${name}`);
      } }, 'Excel-Datei erstellen'),
      h('p', { class: 'muted' }, `Absender: ${db.kontaktName(eig)}`)));
}
