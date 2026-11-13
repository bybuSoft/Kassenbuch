// Auswertungen: Perioden, Kundenkategorien, Seniorenzentrum-Liste, Treuhänder-Export (Excel), Serienbrief
import * as db from './db.js';
import { h, chf, today, isoDate, fmtDate, monthOf, monthLabel, lastDayOfMonth, saveBlob, collator } from './util.js';
import { field, segmented, toast, printNode, checkField } from './ui.js';
import { buildXlsx, XLSX_MIME } from './xlsx.js';
import { nav } from './nav.js';

const now = new Date();
const state = {
  tab: 'perioden',
  from: `${monthOf(today())}-01`, to: lastDayOfMonth(monthOf(today())),
  senKat: '', serKat: '', vj: false,
};
const REPORTS = [
  ['perioden', 'Perioden'], ['kategorien', 'Kundenkategorien'], ['senioren', 'Kundenliste'],
  ['treuhaender', 'Treuhänder-Export'], ['serienbrief', 'Serienbrief'],
];

const inRange = (b) => b.datum >= state.from && b.datum <= state.to;
const sum = (arr) => arr.reduce((s, b) => s + b.betrag, 0);
const th = (...c) => h('thead', {}, h('tr', {}, ...c.map((x, i) => h('th', { class: x.num ? 'num' : '' }, x.t ?? x))));

function periodControl() {
  const from = h('input', { type: 'date', value: state.from, 'aria-label': 'Von' });
  const to = h('input', { type: 'date', value: state.to, 'aria-label': 'Bis' });
  const apply = () => { state.from = from.value || state.from; state.to = to.value || state.to; nav.refresh(); };
  from.addEventListener('change', apply); to.addEventListener('change', apply);
  const preset = (label, f, t) => h('button', { type: 'button', class: 'btn small', onclick: () => { state.from = f; state.to = t; nav.refresh(); } }, label);
  const y = now.getFullYear(), m = monthOf(today());
  const pm = monthOf(isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  return h('div', { class: 'stack period' },
    h('div', { class: 'grid2' }, field('Von', from), field('Bis', to)),
    h('div', { class: 'presets' },
      preset('Dieser Monat', `${m}-01`, lastDayOfMonth(m)), preset('Letzter Monat', `${pm}-01`, lastDayOfMonth(pm)),
      preset('Dieses Jahr', `${y}-01-01`, `${y}-12-31`), preset('Letztes Jahr', `${y - 1}-01-01`, `${y - 1}-12-31`)));
}

export function auswertungenScreen() {
  const tabs = segmented(REPORTS.map(([value, label]) => ({ value, label })), state.tab, (v) => { state.tab = v; nav.refresh(); });
  tabs.classList.add('scroll');
  const body = { perioden, kategorien, senioren, treuhaender, serienbrief }[state.tab]();
  return { title: 'Auswertungen', back: 'kassenbuch', actions: [], node: h('div', { class: 'stack' }, tabs, body) };
}

// ---- Vorjahresvergleich (optional) -------------------------------------------------------
const shiftYear = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y - 1, m - 1, Math.min(d, new Date(y - 1, m, 0).getDate())));
};
const prevRange = (b) => b.datum >= shiftYear(state.from) && b.datum <= shiftYear(state.to);

function compareControl() {
  return checkField('Vorjahresvergleich anzeigen', h('input', { type: 'checkbox', checked: state.vj, onchange: (e) => { state.vj = e.target.checked; nav.refresh(); } }));
}

/** Tabelle mit optionaler Vorjahresspalte. rows: [name, aktuell, vorjahr, [anzahl]] */
function compareTable(title, firstCol, rows, cls, { count = false } = {}) {
  const vj = state.vj;
  const tot = rows.reduce((t, r) => [t[0] + r[1], t[1] + r[2]], [0, 0]);
  const diff = (a, b) => h('td', { class: `num ${a - b >= 0 ? 'in' : 'out'}` }, `${a - b > 0 ? '+' : ''}${chf(a - b)}`);
  return h('div', { class: 'card' }, h('h3', {}, title),
    h('table', { class: 'tbl' },
      th(firstCol, ...(count ? [{ t: 'Anzahl', num: 1 }] : []), { t: 'Betrag', num: 1 }, ...(vj ? [{ t: 'Vorjahr', num: 1 }, { t: 'Diff.', num: 1 }] : [])),
      h('tbody', {}, ...rows.map(([n, v, p, c]) => h('tr', {}, h('td', {}, n), ...(count ? [h('td', { class: 'num' }, c ?? '')] : []), h('td', { class: 'num' }, chf(v)),
        ...(vj ? [h('td', { class: 'num' }, chf(p)), diff(v, p)] : []))),
        h('tr', { class: 'total' }, h('td', {}, 'Total'), ...(count ? [h('td', {})] : []), h('td', { class: `num ${cls}` }, chf(tot[0])),
          ...(vj ? [h('td', { class: 'num' }, chf(tot[1])), diff(tot[0], tot[1])] : [])))));
}

/** Gruppiert Buchungen (aktuell/Vorjahr) nach keyFn und liefert [name, summe, vorjahr, anzahl] */
function groupRows(cur, prev, keyFn, nameFn) {
  const m = new Map();
  const add = (arr, i) => arr.forEach((b) => { const k = keyFn(b); const o = m.get(k) || [0, 0, 0]; o[i] += Math.abs(b.betrag); if (i === 0) o[2]++; m.set(k, o); });
  add(cur, 0); if (state.vj) add(prev, 1);
  return [...m].map(([k, o]) => [nameFn(k), o[0], o[1], o[2]]).sort((a, b) => collator.compare(a[0], b[0]));
}

// ---- Perioden ---------------------------------------------------------------
function perioden() {
  const all = db.buchungenList();
  const bs = all.filter(inRange), pv = state.vj ? all.filter(prevRange) : [];
  const ein = sum(bs.filter((b) => b.betrag > 0)), aus = -sum(bs.filter((b) => b.betrag < 0));
  const pein = sum(pv.filter((b) => b.betrag > 0)), paus = -sum(pv.filter((b) => b.betrag < 0));
  const catName = (id) => db.data.buchungskategorie.get(id)?.name || '?';
  const byCat = (art) => groupRows(bs.filter((b) => db.artOf(b) === art), pv.filter((b) => db.artOf(b) === art), (b) => b.kategorieId, catName);
  const sm = (label, v, p, cls) => h('div', {}, h('span', { class: 'muted' }, label), h('strong', { class: cls }, chf(v)), state.vj ? h('span', { class: 'muted' }, `Vorjahr ${chf(p)}`) : null);
  const months = new Map();
  const addM = (arr, vj) => arr.forEach((b) => {
    const mo = vj ? `${+monthOf(b.datum).slice(0, 4) + 1}${monthOf(b.datum).slice(4)}` : monthOf(b.datum);
    const o = months.get(mo) || { e: 0, a: 0, pe: 0, pa: 0 };
    if (b.betrag > 0) o[vj ? 'pe' : 'e'] += b.betrag; else o[vj ? 'pa' : 'a'] -= b.betrag;
    months.set(mo, o);
  });
  addM(bs, false); addM(pv, true);
  const monthRows = [...months].sort().filter(([, o]) => o.e || o.a || !state.vj).map(([mo, o]) => h('tr', {}, h('td', {}, monthLabel(mo)),
    h('td', { class: 'num' }, chf(o.e)), h('td', { class: 'num' }, chf(o.a)), h('td', { class: 'num' }, chf(o.e - o.a)),
    ...(state.vj ? [h('td', { class: 'num' }, chf(o.pe - o.pa))] : [])));
  return h('div', { class: 'stack' }, periodControl(), compareControl(),
    h('div', { class: 'summary' }, sm('Einnahmen (Kunden)', ein, pein, 'in'), sm('Ausgaben (Lieferanten)', aus, paus, 'out'), sm('Saldo', ein - aus, pein - paus, '')),
    compareTable('Einnahmen (Kunden) nach Kategorie', 'Kategorie', byCat('einnahme'), 'in'),
    compareTable('Ausgaben (Lieferanten) nach Kategorie', 'Kategorie', byCat('ausgabe'), 'out'),
    h('div', { class: 'card' }, h('h3', {}, 'Nach Monat'),
      h('table', { class: 'tbl' }, th('Monat', { t: 'Einnahmen', num: 1 }, { t: 'Ausgaben', num: 1 }, { t: 'Saldo', num: 1 }, ...(state.vj ? [{ t: 'Saldo Vorjahr', num: 1 }] : [])), h('tbody', {}, ...monthRows))));
}

// ---- Kategorien: Kunden (nach Kundenkategorie) und Lieferanten (nach Lieferant) -----------------
function kategorien() {
  const all = db.buchungenList();
  const sel = (arr) => arr.filter((b) => b.betrag > 0);
  const lie = (arr) => arr.filter((b) => b.betrag < 0);
  const cur = all.filter(inRange), prev = state.vj ? all.filter(prevRange) : [];
  const katOf = (b) => db.data.kontakt.get(b.kontaktId)?.kategorieId || '';
  const kundenRows = groupRows(sel(cur), sel(prev), katOf, (id) => (id ? db.data.kundenkategorie.get(id)?.name || '?' : '(ohne Kategorie)'));
  const lieferantRows = groupRows(lie(cur), lie(prev), (b) => b.kontaktId, (id) => db.kontaktName(db.data.kontakt.get(id)) || '?');
  return h('div', { class: 'stack' }, periodControl(), compareControl(),
    compareTable('Kunden: Einnahmen nach Kundenkategorie', 'Kategorie', kundenRows, 'in', { count: true }),
    compareTable('Lieferanten: Ausgaben nach Lieferant', 'Lieferant', lieferantRows, 'out', { count: true }));
}

// ---- Kundenliste (z. B. Seniorenzentrum): Vorname, Name, Betrag, gruppiert nach Tag, Total pro Monat ---------
function senioren() {
  const kats = db.kategorienList('kundenkategorie');
  if (!state.senKat || !db.data.kundenkategorie.has(state.senKat)) state.senKat = (kats.find((k) => /senior/i.test(k.name)) || kats[0])?.id || '';
  const sel = h('select', { 'aria-label': 'Kundenkategorie', onchange: () => { state.senKat = sel.value; nav.refresh(); } }, ...kats.map((c) => h('option', { value: c.id }, c.name)));
  sel.value = state.senKat;
  const bs = db.buchungenList().filter(inRange).filter((b) => b.betrag > 0 && db.data.kontakt.get(b.kontaktId)?.kategorieId === state.senKat)
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  const out = h('div', { class: 'report' });
  const catName = db.data.kundenkategorie.get(state.senKat)?.name || '';
  out.append(h('h3', {}, `Kundenliste ${catName}`), h('p', { class: 'muted' }, `${fmtDate(state.from)} – ${fmtDate(state.to)}`));
  if (!bs.length) out.append(h('p', { class: 'muted' }, 'Keine Buchungen für diese Kategorie im gewählten Zeitraum.'));
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
    out.append(h('table', { class: 'tbl' }, th('Vorname', 'Name', { t: 'Betrag (CHF)', num: 1 }), h('tbody', {}, ...rows)));
  }
  return h('div', { class: 'stack' }, periodControl(), field('Kundenkategorie', sel),
    h('div', { class: 'card' }, out),
    h('button', { class: 'btn', onclick: () => printNode(out.cloneNode(true)) }, 'Drucken / als PDF'));
}

// ---- Treuhänder-Export ---------------------------------------------------------------
export function treuhaenderRows(from, to) {
  const bs = db.buchungenList().filter((b) => b.datum >= from && b.datum <= to).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : (a.created || 0) - (b.created || 0)));
  const rows = [[{ s: 'Datum', b: true }, { s: 'Art', b: true }, { s: 'Kategorie', b: true }, { s: 'Lieferant', b: true }, { s: 'Betrag CHF', b: true }, { s: 'Buchungstext', b: true }]];
  for (const b of bs) {
    const k = db.data.kontakt.get(b.kontaktId);
    const art = db.artOf(b);
    // Keine Kundendaten im Export: bei Einnahmen wird kein Kontakt ausgegeben.
    rows.push([{ d: b.datum }, art === 'einnahme' ? 'Einnahme' : 'Ausgabe', db.data.buchungskategorie.get(b.kategorieId)?.name || '', art === 'ausgabe' ? db.kontaktName(k) : '', { n: b.betrag / 100, f: 'money' }, b.text || '']);
  }
  const sums = [[{ s: 'Art', b: true }, { s: 'Kategorie', b: true }, { s: 'Total CHF', b: true }]];
  let te = 0, ta = 0;
  for (const art of ['einnahme', 'ausgabe']) {
    for (const c of db.kategorienList('buchungskategorie', art)) {
      const t = bs.filter((b) => b.kategorieId === c.id).reduce((s, b) => s + b.betrag, 0);
      if (!t) continue;
      sums.push([art === 'einnahme' ? 'Einnahme' : 'Ausgabe', c.name, { n: t / 100, f: 'money' }]);
      if (art === 'einnahme') te += t; else ta += t;
    }
  }
  sums.push([{ s: 'Total Einnahmen', b: true }, '', { n: te / 100, f: 'money', b: true }], [{ s: 'Total Ausgaben', b: true }, '', { n: ta / 100, f: 'money', b: true }], [{ s: 'Ergebnis', b: true }, '', { n: (te + ta) / 100, f: 'money', b: true }]);
  return { rows, sums, count: bs.length };
}

function treuhaender() {
  const { count } = treuhaenderRows(state.from, state.to);
  const eig = db.eigene();
  return h('div', { class: 'stack' }, periodControl(),
    h('div', { class: 'card stack' },
      h('h3', {}, 'Export für den Treuhänder (Excel)'),
      h('p', { class: 'notice' }, 'Hinweis: Es werden keine personenbezogenen Daten exportiert. Einnahmen enthalten keinen Kunden, bei Ausgaben steht der Lieferant.'),
      h('p', { class: 'muted' }, `${count} Buchungen im Zeitraum ${fmtDate(state.from)} – ${fmtDate(state.to)}.`),
      h('button', { class: 'btn primary', disabled: !count, onclick: async () => {
        const { rows, sums } = treuhaenderRows(state.from, state.to);
        const bytes = buildXlsx([
          { name: 'Buchungen', rows, widths: [12, 10, 22, 30, 14, 40] },
          { name: 'Summen', rows: sums, widths: [18, 24, 14] },
        ]);
        const name = `kassenbuch-treuhaender-${state.from}_${state.to}.xlsx`;
        await saveBlob(new Blob([bytes], { type: XLSX_MIME }), name);
        toast(`Excel erstellt: ${name}`);
      } }, 'Excel-Datei erstellen'),
      h('p', { class: 'muted' }, `Absender: ${db.kontaktName(eig)}`)));
}

// ---- Serienbrief ---------------------------------------------------------------------------
function serienbrief() {
  const kats = db.kategorienList('kundenkategorie');
  const sel = h('select', { 'aria-label': 'Kundenkategorie', onchange: () => { state.serKat = sel.value; nav.refresh(); } },
    h('option', { value: '' }, 'Alle Kategorien'), ...kats.map((c) => h('option', { value: c.id }, c.name)));
  sel.value = state.serKat;
  const kunden = db.kontakteList(false).filter((k) => !state.serKat || k.kategorieId === state.serKat);
  const rows = kunden.map((k) => {
    const chk = h('input', { type: 'checkbox', checked: !!k.briefErhalten, 'aria-label': `Brief erhalten: ${db.kontaktName(k)}`, onchange: async () => {
      await db.put('kontakt', { ...k, briefErhalten: chk.checked, briefDatum: chk.checked ? (k.briefDatum || today()) : '' }); nav.refresh();
    } });
    return h('tr', {}, h('td', {}, chk), h('td', {}, h('div', {}, db.kontaktName(k)), h('div', { class: 'muted' }, [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))), h('td', {}, fmtDate(k.briefDatum)));
  });
  const markAll = async () => {
    const t = today();
    await db.batch(kunden.map((k) => ({ op: 'put', store: 'kontakt', obj: { ...k, briefErhalten: true, briefDatum: t } })));
    toast(`${kunden.length} Kunden als versendet markiert`); nav.refresh();
  };
  const printList = () => printNode(h('div', { class: 'report' }, h('h3', {}, 'Adressliste Serienbrief'),
    h('table', { class: 'tbl' }, th('Name', 'Adresse', 'Brief erhalten'),
      h('tbody', {}, ...kunden.map((k) => h('tr', {}, h('td', {}, db.kontaktName(k)), h('td', {}, [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')), h('td', {}, k.briefErhalten ? `ja, ${fmtDate(k.briefDatum)}` : 'nein')))))));
  return h('div', { class: 'stack' }, field('Kundenkategorie', sel),
    h('div', { class: 'card' }, h('table', { class: 'tbl' }, th('Erhalten', 'Kunde', 'Letzter Versand'), h('tbody', {}, ...rows)), rows.length ? null : h('p', { class: 'muted' }, 'Keine Kunden.')),
    h('div', { class: 'presets' }, h('button', { class: 'btn', onclick: markAll, disabled: !kunden.length }, 'Alle angezeigten: heute versendet'), h('button', { class: 'btn', onclick: printList }, 'Adressliste drucken')));
}
