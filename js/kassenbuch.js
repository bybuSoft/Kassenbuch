// Kassenbuch: Buchungsliste, Buchungsdialog, Quittung
import * as db from './db.js';
import { h, uuid, chf, parseBetrag, today, fmtDate, monthOf, shiftMonth, lastDayOfMonth, normalize } from './util.js';
import { showModal, confirmDlg, field, segmented, toast, printNode } from './ui.js';
import { editKontakt } from './kontakte.js';
import { startBackup } from './backup.js';
import { nav } from './nav.js';

const FIRST = () => `${monthOf(today())}-01`;
const view = { lastArt: 'einnahme', from: FIRST(), to: lastDayOfMonth(monthOf(today())), q: '', kat: '', art: '' };

export function kassenbuchScreen() {
  const dot = db.hasUnsavedChanges() ? h('span', { class: 'dot', title: 'Ungesicherte Änderungen', 'aria-label': 'Ungesicherte Änderungen' }) : null;
  const toolbar = h('nav', { class: 'toolbar', 'aria-label': 'Funktionen' },
    h('button', { class: 'btn', onclick: () => nav.go('kunden') }, 'Kunden'),
    h('button', { class: 'btn', onclick: () => nav.go('lieferanten') }, 'Lieferanten'),
    h('button', { class: 'btn', onclick: () => nav.go('auswertungen') }, 'Auswertungen'),
    h('button', { class: 'btn', onclick: () => startBackup() }, 'Datensicherung', dot),
    h('button', { class: 'btn', onclick: () => nav.go('einstellungen') }, 'Einstellungen'),
    h('button', { class: 'btn', onclick: () => nav.go('infos') }, 'Infos'));

  // ---- Filter: Periode, Art, Kategorie, Suche
  const from = h('input', { type: 'date', value: view.from, 'aria-label': 'Von' });
  const to = h('input', { type: 'date', value: view.to, 'aria-label': 'Bis' });
  const q = h('input', { type: 'search', placeholder: 'Suchen (Name, Text, Kategorie, Betrag)…', value: view.q, 'aria-label': 'Suchen' });
  const katSel = h('select', { 'aria-label': 'Buchungskategorie' });
  const artSel = h('select', { 'aria-label': 'Art' }, h('option', { value: '' }, 'Einnahmen und Ausgaben'), h('option', { value: 'einnahme' }, 'Nur Einnahmen'), h('option', { value: 'ausgabe' }, 'Nur Ausgaben'));
  artSel.value = view.art;
  const drawKatOpts = () => {
    const cats = db.kategorienList('buchungskategorie', view.art || undefined);
    katSel.replaceChildren(h('option', { value: '' }, 'Alle Kategorien'), ...cats.map((c) => h('option', { value: c.id }, `${c.name}${view.art ? '' : c.art === 'einnahme' ? ' (Einnahme)' : ' (Ausgabe)'}`)));
    if (!cats.some((c) => c.id === view.kat)) view.kat = '';
    katSel.value = view.kat;
  };
  drawKatOpts();
  const preset = (label, f, t) => h('button', { type: 'button', class: 'btn small', onclick: () => { view.from = f; view.to = t; nav.refresh(); } }, label);
  const y = new Date().getFullYear(), m = monthOf(today());
  const pm = shiftMonth(m, -1);
  const filters = h('div', { class: 'stack period' },
    h('div', { class: 'grid2' }, field('Von', from), field('Bis', to)),
    h('div', { class: 'presets' },
      preset('Dieser Monat', `${m}-01`, lastDayOfMonth(m)), preset('Letzter Monat', `${pm}-01`, lastDayOfMonth(pm)),
      preset('Dieses Jahr', `${y}-01-01`, `${y}-12-31`), preset('Letztes Jahr', `${y - 1}-01-01`, `${y - 1}-12-31`),
      preset('Alles', '0000-01-01', '9999-12-31')),
    q, h('div', { class: 'grid2' }, artSel, katSel));

  const result = h('div', { class: 'stack' });
  const draw = () => {
    view.q = q.value;
    const terms = normalize(q.value).split(/\s+/).filter(Boolean);
    const all = db.buchungenList().filter((b) => b.datum >= view.from && b.datum <= view.to
      && (!view.art || db.artOf(b) === view.art) && (!view.kat || b.kategorieId === view.kat)
      && (!terms.length || terms.every((t) => normalize(`${db.kontaktName(db.data.kontakt.get(b.kontaktId))} ${b.text} ${db.data.buchungskategorie.get(b.kategorieId)?.name} ${(Math.abs(b.betrag) / 100).toFixed(2)}`).includes(t))));
    const ein = all.filter((b) => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
    const aus = all.filter((b) => b.betrag < 0).reduce((s, b) => s - b.betrag, 0);
    const summary = h('div', { class: 'summary' },
      h('div', {}, h('span', { class: 'muted' }, 'Einnahmen'), h('strong', { class: 'in' }, chf(ein))),
      h('div', {}, h('span', { class: 'muted' }, 'Ausgaben'), h('strong', { class: 'out' }, chf(aus))),
      h('div', {}, h('span', { class: 'muted' }, 'Saldo'), h('strong', {}, chf(ein - aus))));
    const list = h('div', { class: 'list' });
    if (!all.length) list.append(h('p', { class: 'muted pad' }, 'Keine Buchungen gefunden.'));
    let lastDay = '';
    for (const b of all) {
      if (b.datum !== lastDay) { lastDay = b.datum; list.append(h('div', { class: 'day' }, fmtDate(b.datum))); }
      const k = db.data.kontakt.get(b.kontaktId);
      const kat = db.data.buchungskategorie.get(b.kategorieId);
      list.append(h('button', { type: 'button', class: 'row', onclick: () => openBuchung(b) },
        h('div', { class: 'row-main' }, h('strong', {}, db.kontaktName(k)), h('span', { class: b.betrag < 0 ? 'out' : 'in' }, chf(b.betrag))),
        h('div', { class: 'row-sub muted' }, [kat?.name, b.text].filter(Boolean).join(' · '))));
    }
    result.replaceChildren(summary, h('p', { class: 'muted' }, `${all.length} Buchung${all.length === 1 ? '' : 'en'}`), list);
  };
  q.addEventListener('input', draw);
  katSel.addEventListener('change', () => { view.kat = katSel.value; draw(); });
  artSel.addEventListener('change', () => { view.art = artSel.value; drawKatOpts(); draw(); });
  const apply = () => { view.from = from.value || view.from; view.to = to.value || view.to; draw(); };
  from.addEventListener('change', apply); to.addEventListener('change', apply);
  draw();

  return {
    title: 'Kassenbuch', back: 'buchung',
    actions: [h('button', { class: 'btn primary', onclick: () => nav.go('buchung') }, '+ Buchung')],
    node: h('div', { class: 'stack' }, toolbar, filters, result),
  };
}

/** Buchungsdialog (neu oder bearbeiten) */
export async function openBuchung(existing) {
  const ex = existing ? { ...existing } : null;
  let art = ex ? db.artOf(ex) : view.lastArt;
  let kontaktId = ex ? ex.kontaktId : null;

  const datum = h('input', { type: 'date', value: ex ? ex.datum : today(), required: true });
  const betrag = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0.00', value: ex ? (Math.abs(ex.betrag) / 100).toFixed(2) : '', autocomplete: 'off', 'aria-label': 'Betrag in CHF' });
  const katSel = h('select', { 'aria-label': 'Buchungskategorie' });
  const text = h('input', { type: 'text', value: ex ? ex.text || '' : '', placeholder: 'optional', autocomplete: 'off' });

  const artSeg = segmented([{ value: 'einnahme', label: 'Einnahme', cls: 'in' }, { value: 'ausgabe', label: 'Ausgabe', cls: 'out' }], art, (v) => {
    art = v;
    const k = db.data.kontakt.get(kontaktId);
    if (k && k.istLieferant !== (art === 'ausgabe')) kontaktId = null;
    drawKat(); drawKontakt();
  });

  const drawKat = () => {
    const keep = katSel.value;
    const cats = db.kategorienList('buchungskategorie', art);
    katSel.replaceChildren(h('option', { value: '' }, '– wählen –'), ...cats.map((c) => h('option', { value: c.id }, c.name)));
    katSel.value = cats.some((c) => c.id === keep) ? keep : (ex && db.data.buchungskategorie.get(ex.kategorieId)?.art === art ? ex.kategorieId : '');
  };

  // ---- Kontaktwahl mit Suche
  const kBox = h('div', { class: 'kontaktpick' });
  const drawKontakt = () => {
    const k = db.data.kontakt.get(kontaktId);
    const label = art === 'ausgabe' ? 'Lieferant' : 'Kunde';
    if (k) {
      kBox.replaceChildren(h('span', { class: 'lbl' }, label),
        h('div', { class: 'chip' }, h('strong', {}, db.kontaktName(k)),
          h('button', { type: 'button', class: 'btn small', onclick: () => { kontaktId = null; drawKontakt(); } }, 'Ändern'),
          k.sys === 'dummyKunde' || k.sys === 'dummyLieferant' ? null : h('button', { type: 'button', class: 'btn small', onclick: async () => { await editKontakt({ id: k.id, lockType: art === 'ausgabe' ? 'lieferant' : 'kunde' }); drawKontakt(); } }, 'Bearbeiten')));
      return;
    }
    const input = h('input', { type: 'text', placeholder: `${label} suchen…`, autocomplete: 'off', 'aria-label': `${label} suchen` });
    const sugg = h('div', { class: 'sugg' });
    const drawSugg = () => {
      const terms = normalize(input.value).split(/\s+/).filter(Boolean);
      const found = db.kontakteList(art === 'ausgabe', false).filter((c) => terms.every((t) => normalize(db.kontaktName(c) + ' ' + c.ort).includes(t))).slice(0, 8);
      sugg.replaceChildren(...found.map((c) => h('button', { type: 'button', class: 'row', onclick: () => { kontaktId = c.id; drawKontakt(); } },
        h('strong', {}, db.kontaktName(c)), h('span', { class: 'muted' }, [c.plz, c.ort, c.sys === 'eigene' ? 'eigene Firma' : ''].filter(Boolean).join(' ')))));
      if (!found.length && input.value.trim()) sugg.append(h('p', { class: 'muted pad' }, 'Nicht gefunden.'));
    };
    input.addEventListener('input', drawSugg);
    const newBtn = h('button', { type: 'button', class: 'btn small', onclick: async () => {
      const t = input.value.trim(); const parts = t.split(/\s+/).filter(Boolean);
      const prefill = art === 'ausgabe' ? { name1: t } : { vorname: parts.slice(0, -1).join(' '), name: parts.slice(-1)[0] || '' };
      const id = await editKontakt({ prefill, lockType: art === 'ausgabe' ? 'lieferant' : 'kunde' });
      if (id) { kontaktId = id; drawKontakt(); }
    } }, `+ Neuer ${label}`);
    kBox.replaceChildren(h('span', { class: 'lbl' }, label), h('div', { class: 'kp-row' }, input, newBtn), sugg);
    drawSugg();
  };

  drawKat(); drawKontakt();

  const body = h('div', { class: 'stack' },
    field('Datum', datum), artSeg, field('Betrag (CHF)', betrag), kBox,
    field('Buchungskategorie', katSel), field('Buchungstext', text));

  const buttons = [];
  if (ex) {
    buttons.push({ label: 'Löschen', cls: 'danger left', onClick: async (ctl) => {
      if (!(await confirmDlg('Diese Buchung wirklich löschen?', { title: 'Buchung löschen', ok: 'Löschen', danger: true }))) return false;
      await db.del('buchung', ex.id); toast('Buchung gelöscht'); ctl.close('deleted'); return false;
    } });
    if (db.artOf(ex) === 'einnahme') buttons.push({ label: 'Quittung', onClick: () => { printQuittung(ex); return false; } });
  }
  buttons.push({ label: 'Abbrechen', value: null });
  const save = async (again) => {
    const cents = parseBetrag(betrag.value);
    if (!datum.value) { toast('Bitte ein Datum wählen.', 'err'); return false; }
    if (!cents) { toast('Bitte einen Betrag grösser als 0 erfassen (z. B. 65.00).', 'err'); betrag.focus(); return false; }
    const k = db.data.kontakt.get(kontaktId);
    if (!k) { toast(art === 'ausgabe' ? 'Bitte einen Lieferanten wählen (oder die eigene Firma).' : 'Bitte einen Kunden aus der Liste wählen.', 'err'); return false; }
    if (k.istLieferant !== (art === 'ausgabe')) { toast('Der Kontakt passt nicht zur Art der Buchung.', 'err'); return false; }
    if (!katSel.value) { toast('Bitte eine Buchungskategorie wählen.', 'err'); return false; }
    const b = { id: ex ? ex.id : uuid(), datum: datum.value, betrag: art === 'ausgabe' ? -cents : cents, kontaktId, kategorieId: katSel.value, text: text.value.trim(), created: ex ? ex.created : Date.now() };
    await db.put('buchung', b);
    view.lastArt = art;
    toast('Buchung gespeichert');
    return again ? 'again' : 'saved';
  };
  if (!ex) buttons.push({ label: 'Speichern & weitere', onClick: () => save(true) });
  buttons.push({ label: 'Speichern', cls: 'primary', onClick: () => save(false) });

  const ctl = showModal({ title: ex ? 'Buchung bearbeiten' : 'Neue Buchung', body, buttons });
  const r = await ctl.closed;
  nav.refresh();
  if (r === 'again') openBuchung(null);
}

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
