// Buchungsseite: Erfassung (Datum, Kunde, Betrag, Art, Kategorie, Text) und Liste der zuletzt erfassten Buchungen
import * as db from './db.js';
import { h, uuid, chf, parseBetrag, today, fmtDate, monthOf, normalize } from './util.js';
import { field, segmented, toast, confirmDlg } from './ui.js';
import { editKontakt } from './kontakte.js';
import { startBackup } from './backup.js';
import { openBuchung } from './kassenbuch.js';
import { nav } from './nav.js';

// Entwurf bleibt über Neuzeichnen erhalten
const draft = { datum: today(), kontaktId: null, art: 'einnahme', betrag: '', kategorieId: '', text: '' };

const lastBuchungOf = (kontaktId) => db.buchungenOf(kontaktId).sort((a, b) => (b.created || 0) - (a.created || 0))[0];

export function buchungScreen() {
  if (!db.data.kontakt.has(draft.kontaktId)) draft.kontaktId = null;
  if (draft.kategorieId && !db.data.buchungskategorie.has(draft.kategorieId)) draft.kategorieId = '';

  const datum = h('input', { type: 'date', value: draft.datum, required: true, onchange: (e) => { draft.datum = e.target.value; } });
  const betrag = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0.00', value: draft.betrag, autocomplete: 'off', 'aria-label': 'Betrag in CHF', oninput: (e) => { draft.betrag = e.target.value; } });
  const katSel = h('select', { 'aria-label': 'Buchungskategorie', onchange: (e) => { draft.kategorieId = e.target.value; } });
  const text = h('input', { type: 'text', value: draft.text, placeholder: 'optional', autocomplete: 'off', oninput: (e) => { draft.text = e.target.value; } });

  const drawKat = () => {
    const cats = db.kategorienList('buchungskategorie', draft.art);
    katSel.replaceChildren(h('option', { value: '' }, '– wählen –'), ...cats.map((c) => h('option', { value: c.id }, c.name)));
    katSel.value = cats.some((c) => c.id === draft.kategorieId) ? draft.kategorieId : '';
    if (katSel.value !== draft.kategorieId) draft.kategorieId = katSel.value;
  };

  const artSeg = h('div', {});
  const drawArt = () => artSeg.replaceChildren(segmented([{ value: 'einnahme', label: 'Einnahme', cls: 'in' }, { value: 'ausgabe', label: 'Ausgabe', cls: 'out' }], draft.art, (v) => {
    draft.art = v;
    const k = db.data.kontakt.get(draft.kontaktId);
    const mismatch = k && k.istLieferant !== (v === 'ausgabe');
    if (mismatch) { draft.kontaktId = null; drawKontakt(true); }
    drawKat();
  }));

  /** Kontakt gewählt: Betrag, Art und Kategorie aus der letzten Buchung vorbelegen */
  const pick = (id) => {
    draft.kontaktId = id;
    const k = db.data.kontakt.get(id);
    const last = lastBuchungOf(id);
    if (last) {
      draft.art = db.artOf(last);
      draft.betrag = (Math.abs(last.betrag) / 100).toFixed(2);
      draft.kategorieId = last.kategorieId;
    } else {
      draft.art = k.istLieferant ? 'ausgabe' : 'einnahme';
      draft.betrag = '';
      draft.kategorieId = '';
    }
    betrag.value = draft.betrag;
    drawArt(); drawKat(); drawKontakt(false);
    betrag.focus(); betrag.select();
  };

  const kBox = h('div', { class: 'kontaktpick' });
  const drawKontakt = (focus) => {
    const k = db.data.kontakt.get(draft.kontaktId);
    const label = 'Kunde / Lieferant';
    if (k) {
      kBox.replaceChildren(h('span', { class: 'lbl' }, label),
        h('div', { class: 'chip' }, h('strong', {}, db.kontaktName(k)),
          h('button', { type: 'button', class: 'btn small', onclick: () => { draft.kontaktId = null; drawKontakt(true); } }, 'Ändern')));
      return;
    }
    const input = h('input', { type: 'text', placeholder: 'Kunde oder Lieferant suchen…', autocomplete: 'off', 'aria-label': label });
    const sugg = h('div', { class: 'sugg' });
    let found = [];
    const drawSugg = () => {
      const terms = normalize(input.value).split(/\s+/).filter(Boolean);
      const pool = [...db.kontakteList(false, false), ...db.kontakteList(true, false)];
      found = pool.filter((c) => terms.every((t) => normalize(db.kontaktName(c) + ' ' + c.ort).includes(t))).slice(0, 8);
      sugg.replaceChildren(...found.map((c) => h('button', { type: 'button', class: 'row', onclick: () => pick(c.id) },
        h('strong', {}, db.kontaktName(c)), h('span', { class: 'muted' }, [c.istLieferant ? 'Lieferant' : '', c.plz, c.ort, c.sys === 'eigene' ? 'eigene Firma' : ''].filter(Boolean).join(' ')))));
      if (!found.length && input.value.trim()) sugg.append(h('p', { class: 'muted pad' }, 'Nicht gefunden.'));
    };
    input.addEventListener('input', drawSugg);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && found.length) { e.preventDefault(); pick(found[0].id); } });
    const newBtn = (lief) => h('button', { type: 'button', class: 'btn small', onclick: async () => {
      const t = input.value.trim(); const parts = t.split(/\s+/).filter(Boolean);
      const prefill = lief ? { name1: t } : { vorname: parts.slice(0, -1).join(' '), name: parts.slice(-1)[0] || '' };
      const id = await editKontakt({ prefill, lockType: lief ? 'lieferant' : 'kunde' });
      if (id) pick(id);
    } }, lief ? '+ Neuer Lieferant' : '+ Neuer Kunde');
    kBox.replaceChildren(h('span', { class: 'lbl' }, label), h('div', { class: 'kp-row' }, input), h('div', { class: 'kp-row' }, newBtn(false), newBtn(true)), sugg);
    drawSugg();
    if (focus) input.focus();
    kBox.firstFocus = () => input.focus();
  };

  drawArt(); drawKat(); drawKontakt(false);

  const save = async () => {
    const cents = parseBetrag(betrag.value);
    if (!datum.value) { toast('Bitte ein Datum wählen.', 'err'); return; }
    const k = db.data.kontakt.get(draft.kontaktId);
    if (!k) { toast('Bitte einen Kunden oder Lieferanten wählen.', 'err'); return; }
    if (!cents) { toast('Bitte einen Betrag grösser als 0 erfassen (z. B. 65.00).', 'err'); betrag.focus(); return; }
    if (k.istLieferant !== (draft.art === 'ausgabe')) { toast('Der Kontakt passt nicht zur Art der Buchung.', 'err'); return; }
    if (!katSel.value) { toast('Bitte eine Buchungskategorie wählen.', 'err'); return; }
    await db.put('buchung', { id: uuid(), datum: datum.value, betrag: draft.art === 'ausgabe' ? -cents : cents, kontaktId: k.id, kategorieId: katSel.value, text: text.value.trim(), created: Date.now() });
    toast('Buchung gespeichert');
    Object.assign(draft, { kontaktId: null, betrag: '', kategorieId: '', text: '' });
    nav.refresh();
    if (await confirmDlg('Die Buchung wurde gespeichert.\nJetzt eine Datensicherung erstellen?', { title: 'Datensicherung', ok: 'Sichern', cancel: 'Später' })) await startBackup();
  };

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

  const kontaktInput = () => kBox.querySelector('input');
  setTimeout(() => { if (!document.getElementById('modal-root').children.length && !draft.kontaktId) kontaktInput()?.focus(); }, 0);

  return {
    title: 'Buchung', back: null,
    actions: [h('button', { class: 'btn', onclick: () => nav.go('kassenbuch') }, 'Kassenbuch')],
    node: h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        field('Datum', datum), kBox, field('Betrag (CHF)', betrag), artSeg,
        field('Buchungskategorie', katSel), field('Buchungstext', text),
        h('button', { type: 'button', class: 'btn primary big', onclick: save }, 'Speichern')),
      h('h3', {}, 'Zuletzt erfasst'), list),
  };
}
