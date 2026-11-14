// Buchungsseite: Erfassung (Datum, Kunde, Betrag, Art, Kategorie, Text) und Liste der zuletzt erfassten Buchungen
import * as db from './db.js';
import { h, uuid, chf, parseBetrag, today, fmtDate } from './util.js';
import { field, toast, confirmDlg } from './ui.js';
import { kontaktPicker, betragFields, kategorienFor } from './kontaktpick.js';
import { startBackup, beenden } from './backup.js';
import { openBuchung } from './kassenbuch.js';
import { nav } from './nav.js';

// Entwurf bleibt über Neuzeichnen erhalten
const draft = { datum: today(), kontaktId: null, sign: '+', betrag: '', kategorieId: '', text: '' };
const resetDraft = () => Object.assign(draft, { kontaktId: null, sign: '+', betrag: '', kategorieId: '', text: '' });

const lastBuchungOf = (kontaktId) => db.buchungenOf(kontaktId).sort((a, b) => (b.created || 0) - (a.created || 0))[0];

export function buchungScreen() {
  if (!db.data.kontakt.has(draft.kontaktId)) draft.kontaktId = null;
  if (draft.kategorieId && !db.data.buchungskategorie.has(draft.kategorieId)) draft.kategorieId = '';

  const datum = h('input', { type: 'date', value: draft.datum, required: true, onchange: (e) => { draft.datum = e.target.value; } });
  const bf = betragFields(draft.sign, draft.betrag);
  bf.input.addEventListener('input', () => { draft.betrag = bf.input.value; });
  bf.signSel.addEventListener('change', () => { draft.sign = bf.signSel.value; });
  const katSel = h('select', { 'aria-label': 'Buchungskategorie', onchange: (e) => { draft.kategorieId = e.target.value; } });
  const text = h('input', { type: 'text', value: draft.text, placeholder: 'optional', autocomplete: 'off', oninput: (e) => { draft.text = e.target.value; } });

  const drawKat = () => {
    const k = db.data.kontakt.get(draft.kontaktId);
    const cats = kategorienFor(k);
    katSel.replaceChildren(h('option', { value: '' }, k ? '– wählen –' : '– zuerst Kontakt wählen –'), ...cats.map((c) => h('option', { value: c.id }, c.name)));
    katSel.value = cats.some((c) => c.id === draft.kategorieId) ? draft.kategorieId : '';
    draft.kategorieId = katSel.value;
  };

  /** Kontakt gewählt: Vorzeichen, Betrag und Kategorie aus der letzten Buchung vorbelegen */
  const picker = kontaktPicker({
    getId: () => draft.kontaktId,
    onSelect: (id) => {
      draft.kontaktId = id;
      const k = db.data.kontakt.get(id);
      const last = lastBuchungOf(id);
      if (last) {
        draft.sign = last.betrag < 0 ? '-' : '+';
        draft.betrag = (Math.abs(last.betrag) / 100).toFixed(2);
        draft.kategorieId = last.kategorieId;
      } else {
        draft.sign = k.istLieferant ? '-' : '+';
        draft.betrag = '';
        draft.kategorieId = '';
      }
      bf.signSel.value = draft.sign; bf.input.value = draft.betrag;
      drawKat(); picker.draw();
      bf.input.focus(); bf.input.select();
    },
    onClear: () => { draft.kontaktId = null; drawKat(); },
  });
  picker.draw(); drawKat();

  const save = async (again) => {
    const cents = parseBetrag(bf.input.value);
    if (!datum.value) { toast('Bitte ein Datum wählen.', 'err'); return; }
    const k = db.data.kontakt.get(draft.kontaktId);
    if (!k) { toast('Bitte einen Kunden oder Lieferanten wählen.', 'err'); return; }
    if (!cents) { toast('Bitte einen Betrag grösser als 0 erfassen (z. B. 65.00).', 'err'); bf.input.focus(); return; }
    if (!katSel.value) { toast('Bitte eine Buchungskategorie wählen.', 'err'); return; }
    await db.put('buchung', { id: uuid(), datum: datum.value, betrag: bf.signSel.value === '-' ? -cents : cents, kontaktId: k.id, kategorieId: katSel.value, text: text.value.trim(), created: Date.now() });
    toast('Buchung gespeichert');
    resetDraft();
    if (again) { nav.refresh(); return; }
    // „Speichern“: erst fragen, ob ein Backup erstellt werden soll, danach ins Kassenbuch
    if (await confirmDlg('Die Buchung wurde gespeichert.\nSoll jetzt eine Datensicherung erstellt werden?', { title: 'Datensicherung', ok: 'Ja, sichern', cancel: 'Nein' })) await startBackup();
    nav.go('kassenbuch');
  };
  const cancel = () => { resetDraft(); nav.go('kassenbuch'); };

  // ---- Liste der zuletzt erfassten Buchungen (nach Erfassungszeitpunkt absteigend)
  const recent = [...db.data.buchung.values()].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 25);
  const list = h('div', { class: 'list' });
  if (!recent.length) list.append(h('p', { class: 'muted pad' }, 'Noch keine Buchungen erfasst.'));
  for (const b of recent) {
    const kat = db.data.buchungskategorie.get(b.kategorieId);
    list.append(h('button', { type: 'button', class: 'row', onclick: async () => { await openBuchung(b); } },
      h('div', { class: 'row-main' }, h('strong', {}, db.kontaktName(db.data.kontakt.get(b.kontaktId))), h('span', { class: b.betrag < 0 ? 'out' : 'in' }, chf(b.betrag))),
      h('div', { class: 'row-sub muted' }, [fmtDate(b.datum), kat?.name, b.text, b.test ? 'Test' : ''].filter(Boolean).join(' · '))));
  }

  setTimeout(() => { if (!document.getElementById('modal-root').children.length && !draft.kontaktId) picker.el.querySelector('input')?.focus(); }, 0);

  return {
    title: 'Buchung', back: null,
    actions: [h('button', { class: 'btn', onclick: () => nav.go('kassenbuch') }, 'Kassenbuch'), h('button', { class: 'btn', onclick: () => beenden() }, 'Beenden')],
    node: h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        field('Datum', datum), picker.el, bf.el,
        field('Buchungskategorie', katSel), field('Buchungstext', text),
        h('div', { class: 'presets' },
          h('button', { type: 'button', class: 'btn big', onclick: cancel }, 'Abbrechen'),
          h('button', { type: 'button', class: 'btn big', onclick: () => save(true) }, 'Speichern & neu'),
          h('button', { type: 'button', class: 'btn primary big', onclick: () => save(false) }, 'Speichern'))),
      h('h3', {}, 'Zuletzt erfasst'), list),
  };
}
