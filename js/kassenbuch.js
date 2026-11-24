// Kassenbuch: Buchungsliste, Buchungsdialog, Quittung
import * as db from './db.js';
import { h, uuid, chf, today, fmtDate, normalize } from './util.js';
import { showModal, confirmDlg, field, toast, printNode } from './ui.js';
import { periodBar } from './periodbar.js';
import { kontaktPicker, positionenEditor, defaultRows, prefillRows, rowsFromPositionen, kategorienFor, confirmBuchungDup, confirmNullBetrag } from './kontaktpick.js';
import { beenden } from './backup.js';
import { nav } from './nav.js';
import { printQuittung } from './quittung.js';

// Vorgabe: alles (alle Zeiträume, Einnahmen und Ausgaben, alle Kategorien). Filter werden gespeichert und mitgesichert.
const ALL = { from: '0000-01-01', to: '9999-12-31' };
const view = { open: false, ...ALL, q: '', kat: '', art: '', zahl: '' };
const saveView = () => db.saveFilter('kassenbuch', { from: view.from, to: view.to, kat: view.kat, art: view.art, zahl: view.zahl });

export function kassenbuchScreen() {
  Object.assign(view, { ...ALL, kat: '', art: '', zahl: '' }, db.getFilter('kassenbuch'));
  // ---- Filter (aufklappbar): Suche bleibt sichtbar
  const q = h('input', { type: 'search', placeholder: 'Suchen (Name, Text, Kategorie, Betrag)…', value: view.q, 'aria-label': 'Suchen' });
  const katSel = h('select', { 'aria-label': 'Buchungskategorie' });
  const artSel = h('select', { 'aria-label': 'Art' }, h('option', { value: '' }, 'Einnahmen und Ausgaben'), h('option', { value: 'einnahme' }, 'Nur Einnahmen'), h('option', { value: 'ausgabe' }, 'Nur Ausgaben'));
  artSel.value = view.art;
  const drawKatOpts = () => {
    const cats = db.erfassKategorien(view.art || undefined);
    katSel.replaceChildren(h('option', { value: '' }, 'Alle Kategorien'), ...cats.map((c) => h('option', { value: c.id }, `${c.name}${view.art ? '' : c.art === 'einnahme' ? ' (Einnahme)' : ' (Ausgabe)'}`)));
    if (!cats.some((c) => c.id === view.kat)) view.kat = '';
    katSel.value = view.kat;
  };
  drawKatOpts();
  const zahlSel = h('select', { 'aria-label': 'Zahlungsart' }, h('option', { value: '' }, 'Bar und Stiftung'), h('option', { value: 'bar' }, 'Nur bar'), h('option', { value: 'stiftung' }, 'Nur Stiftung'));
  zahlSel.value = view.zahl;
  const bar = periodBar({ from: view.from, to: view.to, all: true, onSet: (a, b) => { view.from = a; view.to = b; saveView(); nav.refresh(); } });
  const panel = h('div', { class: 'stack filterpanel' }, bar, h('div', { class: 'grid2' }, artSel, katSel), zahlSel);
  panel.hidden = !view.open;
  const active = () => !!(view.art || view.kat || view.zahl) || view.from !== ALL.from || view.to !== ALL.to;
  const toggle = h('button', { type: 'button', class: 'btn', 'aria-expanded': String(!!view.open), onclick: () => { view.open = !view.open; panel.hidden = !view.open; toggle.setAttribute('aria-expanded', String(view.open)); } },
    'Filter ', view.open ? '▴' : '▾', active() ? h('span', { class: 'dot' }) : null);
  const filters = h('div', { class: 'stack' }, h('div', { class: 'searchrow' }, q, toggle), panel);

  const result = h('div', { class: 'stack' });
  const draw = () => {
    view.q = q.value;
    const terms = normalize(q.value).split(/\s+/).filter(Boolean);
    // Filter wirken auf die Positionen: angezeigt werden die Buchungen mit mindestens einer passenden Position, mit der Summe der passenden Positionen
    const posOk = (z) => (!view.art || db.artOf(z) === view.art) && (!view.kat || z.kategorieId === view.kat)
      && (!view.zahl || (view.zahl === 'stiftung') === z.stiftung);
    const all = db.buchungenList().filter((b) => b.datum >= view.from && b.datum <= view.to)
      .map((b) => ({ b, zs: db.zeilenOf(b).filter(posOk) }))
      .filter(({ b, zs }) => zs.length && (!terms.length || terms.every((t) => normalize(`${db.kontaktName(db.data.kontakt.get(b.kontaktId))} ${b.text} ${zs.map((z) => `${db.data.buchungskategorie.get(z.kategorieId)?.name} ${(Math.abs(z.betrag) / 100).toFixed(2)}${z.stiftung ? ' stiftung' : ''}`).join(' ')}`).includes(t))));
    const zeilen = all.flatMap(({ zs }) => zs);
    const ein = zeilen.filter((z) => db.artOf(z) === 'einnahme').reduce((s, z) => s + z.betrag, 0);
    const aus = zeilen.filter((z) => db.artOf(z) === 'ausgabe').reduce((s, z) => s - z.betrag, 0);
    const stiftung = zeilen.filter((z) => db.artOf(z) === 'einnahme' && z.stiftung).reduce((s, z) => s + z.betrag, 0);
    const summary = h('div', { class: 'summary' },
      h('div', {}, h('span', { class: 'muted' }, 'Einnahmen'), h('strong', { class: 'in' }, chf(ein)), stiftung ? h('span', { class: 'muted small' }, `davon Stiftung ${chf(stiftung)}`) : null),
      h('div', {}, h('span', { class: 'muted' }, 'Ausgaben'), h('strong', { class: 'out' }, chf(aus))),
      h('div', {}, h('span', { class: 'muted' }, 'Saldo'), h('strong', {}, chf(ein - aus))));
    const list = h('div', { class: 'list' });
    if (!all.length) list.append(h('p', { class: 'muted pad' }, 'Keine Buchungen gefunden.'));
    let lastDay = '';
    for (const { b, zs } of all) {
      if (b.datum !== lastDay) { lastDay = b.datum; list.append(h('div', { class: 'day' }, fmtDate(b.datum))); }
      list.append(buchungRow(b, [db.posText(b, b.positionen.filter((p) => zs.some((z) => z.kategorieId === p.kategorieId && z.betrag === p.betrag && z.stiftung === !!p.stiftung))), b.text], zs.reduce((s, z) => s + z.betrag, 0)));
    }
    result.replaceChildren(summary, h('p', { class: 'muted small' }, `${all.length} Buchung${all.length === 1 ? '' : 'en'} · ${fmtDate(view.from)} – ${fmtDate(view.to)}`), list);
  };
  q.addEventListener('input', draw);
  katSel.addEventListener('change', () => { view.kat = katSel.value; saveView(); draw(); });
  zahlSel.addEventListener('change', () => { view.zahl = zahlSel.value; saveView(); draw(); });
  artSel.addEventListener('change', () => { view.art = artSel.value; drawKatOpts(); saveView(); draw(); });
  draw();

  return {
    title: 'Kassenbuch', back: 'menu',
    actions: [h('button', { class: 'btn', onclick: () => beenden() }, 'Beenden'), h('button', { class: 'btn primary', 'aria-label': 'Neue Buchung', title: 'Neue Buchung', onclick: () => nav.go('buchung') }, '+')],
    node: h('div', { class: 'stack' }, filters, result),
  };
}

/** Zeile der Buchungsliste: Antippen = bearbeiten; bei positiven Einnahmen Druck-Icon (Quittung) rechts neben dem Betrag.
 *  amount: angezeigter Betrag (Vorgabe: Summe aller Positionen; bei aktiven Filtern die Summe der passenden Positionen) */
export function buchungRow(b, sub, amount = db.posSum(b)) {
  const k = db.data.kontakt.get(b.kontaktId);
  const quittung = db.artOfBuchung(b) === 'einnahme' && db.posSum(b) > 0;
  return h('div', { class: 'rowwrap' },
    h('button', { type: 'button', class: 'row', onclick: () => openBuchung(b) },
      h('div', { class: 'row-main' }, h('strong', {}, db.kontaktListName(k)), h('span', { class: amount < 0 ? 'out' : 'in' }, chf(amount))),
      h('div', { class: 'row-sub muted' }, sub.filter(Boolean).join(' · '))),
    quittung ? h('button', { type: 'button', class: 'print-btn', title: 'Quittung drucken', 'aria-label': 'Quittung drucken', onclick: () => printQuittung(b) }, '🖨') : null);
}

/** Buchungsdialog (neu oder bearbeiten) */
export async function openBuchung(existing) {
  const ex = existing ? { ...existing } : null;
  let kontaktId = ex ? ex.kontaktId : null;

  const datum = h('input', { type: 'date', value: ex ? ex.datum : today(), required: true });
  const text = h('input', { type: 'text', value: ex ? ex.text || '' : '', placeholder: 'optional', autocomplete: 'off' });
  const rows = ex ? rowsFromPositionen(ex.positionen) : defaultRows(null);
  const editor = positionenEditor({ rows, getKontakt: () => db.data.kontakt.get(kontaktId), onEnterLast: () => text.focus() });
  const rowsBlank = () => rows.every((r) => !String(r.betrag).trim());
  const picker = kontaktPicker({
    getId: () => kontaktId,
    onSelect: (id) => {
      kontaktId = id;
      const k = db.data.kontakt.get(id);
      const valid = new Set(kategorienFor(k).map((c) => c.id));
      // Leere Erfassung oder Kategorien, die zum neuen Kontakt nicht passen: Vorbelegung aus der letzten Buchung des Kontakts
      if (rowsBlank() || rows.some((r) => r.kategorieId && !valid.has(r.kategorieId))) editor.set(prefillRows(k, ex ? ex.id : null)); else editor.draw();
      picker.draw();
      editor.focusFirst();
    },
    onClear: () => { kontaktId = null; editor.draw(); },
  });
  picker.draw();

  const body = h('div', { class: 'stack' }, field('Datum', datum), picker.el, editor.el, field('Buchungstext', text));

  const buttons = [];
  if (ex) {
    buttons.push({ label: 'Löschen', cls: 'danger left', onClick: async (ctl) => {
      if (!(await confirmDlg('Diese Buchung wirklich löschen?', { title: 'Buchung löschen', ok: 'Löschen', danger: true }))) return false;
      await db.del('buchung2', ex.id); toast('Buchung gelöscht'); ctl.close('deleted'); return false;
    } });
  }
  buttons.push({ label: 'Abbrechen', value: null });
  const save = async (again) => {
    if (!datum.value) { toast('Bitte ein Datum wählen.', 'err'); return false; }
    const k = db.data.kontakt.get(kontaktId);
    if (!k) { toast('Bitte einen Kunden oder Lieferanten wählen.', 'err'); return false; }
    const r = editor.read();
    if (r.error) { toast(r.error, 'err'); return false; }
    // Felder der bestehenden Buchung (test, migriert, quellen …) bleiben erhalten; eine bearbeitete migrierte Buchung wird als geändert markiert
    const b = { ...(ex || {}), id: ex ? ex.id : uuid(), datum: datum.value, kontaktId, text: text.value.trim(), created: ex ? ex.created : Date.now(), positionen: r.positionen };
    if (ex?.migriert) b.geaendert = Date.now();
    if (db.posSum(b) === 0 && !(await confirmNullBetrag())) return false;
    if (!(await confirmBuchungDup(b))) return false;
    await db.put('buchung2', b);
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
