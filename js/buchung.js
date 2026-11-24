// Buchungsseite: Erfassung (Datum, Kunde/Lieferant, Positionen mit Kategorie/Betrag/Stiftung, Text) und Liste der zuletzt erfassten Buchungen
import * as db from './db.js';
import { h, uuid, today, fmtDate } from './util.js';
import { field, toast, confirmDlg } from './ui.js';
import { kontaktPicker, positionenEditor, defaultRows, prefillRows, confirmBuchungDup, confirmNullBetrag } from './kontaktpick.js';
import { startBackup, beenden } from './backup.js';
import { offline } from './net.js';
import { buchungRow } from './kassenbuch.js';
import { nav } from './nav.js';

// Entwurf bleibt über Neuzeichnen erhalten
const draft = { datum: today(), datumGeaendert: false, kontaktId: null, rows: defaultRows(null), text: '' };
const resetDraft = () => Object.assign(draft, { kontaktId: null, rows: defaultRows(null), text: '' });

export function buchungScreen() {
  if (!draft.datumGeaendert) draft.datum = today(); // App kann über Nacht offen bleiben: Vorgabe immer der heutige Tag
  if (!db.data.kontakt.has(draft.kontaktId)) draft.kontaktId = null;

  const datum = h('input', { type: 'date', value: draft.datum, required: true, onchange: (e) => { draft.datum = e.target.value; draft.datumGeaendert = true; } });
  const text = h('input', { type: 'text', value: draft.text, placeholder: 'optional', autocomplete: 'off', oninput: (e) => { draft.text = e.target.value; } });
  const editor = positionenEditor({ rows: draft.rows, getKontakt: () => db.data.kontakt.get(draft.kontaktId), onEnterLast: () => text.focus() });

  /** Kontakt gewählt: Kategorien, Vorzeichen, Beträge und Stiftung aus der letzten Buchung vorbelegen */
  const picker = kontaktPicker({
    getId: () => draft.kontaktId,
    onSelect: (id) => {
      draft.kontaktId = id;
      editor.set(prefillRows(db.data.kontakt.get(id)));
      picker.draw();
      editor.focusFirst();
    },
    onClear: () => { draft.kontaktId = null; editor.set(defaultRows(null)); },
  });
  picker.draw();

  const save = async (again) => {
    if (!datum.value) { toast('Bitte ein Datum wählen.', 'err'); return; }
    const k = db.data.kontakt.get(draft.kontaktId);
    if (!k) { toast('Bitte einen Kunden oder Lieferanten wählen.', 'err'); return; }
    const r = editor.read();
    if (r.error) { toast(r.error, 'err'); return; }
    const nb = { id: uuid(), datum: datum.value, kontaktId: k.id, text: text.value.trim(), created: Date.now(), positionen: r.positionen };
    if (db.posSum(nb) === 0 && !(await confirmNullBetrag())) return;
    if (!(await confirmBuchungDup(nb))) return;
    await db.put('buchung2', nb);
    toast('Buchung gespeichert');
    resetDraft();
    if (again) { nav.refresh(); return; }
    // „Speichern“: erst fragen, ob ein Backup erstellt werden soll, danach ins Kassenbuch
    if (await confirmDlg('Die Buchung wurde gespeichert.\nSoll jetzt eine Datensicherung erstellt werden?' + (offline() ? '\n\nOhne Internet nicht möglich.' : ''), { title: 'Datensicherung', ok: 'Ja, sichern', cancel: 'Nein', okDisabled: offline() })) await startBackup();
    nav.go('menu');
  };
  const cancel = () => { resetDraft(); nav.go('menu'); };

  // ---- Liste der zuletzt erfassten Buchungen (nach Buchungsdatum absteigend, innerhalb nach Erfassungszeitpunkt absteigend)
  const recent = db.buchungenList().slice(0, 25);
  const list = h('div', { class: 'list' });
  if (!recent.length) list.append(h('p', { class: 'muted pad' }, 'Noch keine Buchungen erfasst.'));
  for (const b of recent) {
    list.append(buchungRow(b, [fmtDate(b.datum), db.posText(b), b.text, b.test ? 'Test' : '']));
  }

  setTimeout(() => { if (!document.getElementById('modal-root').children.length && !draft.kontaktId) picker.el.querySelector('input')?.focus(); }, 0);

  return {
    title: 'Buchung', back: 'menu',
    actions: [h('button', { class: 'btn', onclick: () => beenden() }, 'Beenden')],
    node: h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        field('Datum', datum), picker.el, editor.el,
        field('Buchungstext', text),
        h('div', { class: 'btnrow' },
          h('button', { type: 'button', class: 'btn', onclick: cancel }, 'Abbrechen'),
          h('button', { type: 'button', class: 'btn', onclick: () => save(true) }, 'Speichern & neu'),
          h('button', { type: 'button', class: 'btn primary', onclick: () => save(false) }, 'Speichern'))),
      h('h4', { class: 'sect' }, 'Zuletzt erfasst'), list),
  };
}
