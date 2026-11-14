// Gemeinsame Bausteine für Buchungserfassung: Kontaktwahl mit Smartsuche (nur Namen) und Vorzeichen-/Betragsfeld
import * as db from './db.js';
import { h, normalize } from './util.js';
import { editKontakt } from './kontakte.js';

/** Kunde/Lieferant wählen. Vorschläge erscheinen erst nach Eingabe. */
export function kontaktPicker({ getId, onSelect, onClear }) {
  const box = h('div', { class: 'kontaktpick' });
  const draw = (focus = false) => {
    const k = db.data.kontakt.get(getId());
    const label = 'Kunde / Lieferant';
    if (k) {
      box.replaceChildren(h('span', { class: 'lbl' }, k.istLieferant ? 'Lieferant' : 'Kunde'),
        h('div', { class: 'chip' }, h('strong', {}, db.kontaktName(k)),
          h('button', { type: 'button', class: 'btn small', onclick: () => { onClear(); draw(true); } }, 'Ändern'),
          db.isDummy(k) ? null : h('button', { type: 'button', class: 'btn small', onclick: async () => { await editKontakt({ id: k.id, lockType: k.istLieferant ? 'lieferant' : 'kunde' }); draw(); } }, 'Bearbeiten')));
      return;
    }
    const input = h('input', { type: 'text', placeholder: 'Kunde oder Lieferant suchen…', autocomplete: 'off', 'aria-label': label });
    const sugg = h('div', { class: 'sugg' });
    let found = [];
    const drawSugg = () => {
      const terms = normalize(input.value).split(/\s+/).filter(Boolean);
      const pool = [...db.kontakteList(false, false), ...db.kontakteList(true, false)];
      found = !terms.length ? [] : pool.filter((c) => terms.every((t) => normalize(db.kontaktName(c)).includes(t))).slice(0, 8);
      sugg.replaceChildren(...found.map((c) => h('button', { type: 'button', class: 'row', onclick: () => onSelect(c.id) },
        h('strong', {}, db.kontaktName(c)), h('span', { class: 'muted' }, [c.istLieferant ? 'Lieferant' : '', c.plz, c.ort, c.sys === 'eigene' ? 'eigene Firma' : ''].filter(Boolean).join(' ')))));
      if (!found.length && terms.length) sugg.append(h('p', { class: 'muted pad' }, 'Nicht gefunden.'));
      newRow.hidden = !terms.length;
    };
    const newBtn = (lief) => h('button', { type: 'button', class: 'btn small', onclick: async () => {
      const t = input.value.trim(); const parts = t.split(/\s+/).filter(Boolean);
      const prefill = lief ? { name1: t } : { vorname: parts.slice(0, -1).join(' '), name: parts.slice(-1)[0] || '' };
      const id = await editKontakt({ prefill, lockType: lief ? 'lieferant' : 'kunde' });
      if (id) onSelect(id);
    } }, lief ? '+ Neuer Lieferant' : '+ Neuer Kunde');
    const newRow = h('div', { class: 'kp-row' }, newBtn(false), newBtn(true));
    input.addEventListener('input', drawSugg);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && found.length) { e.preventDefault(); onSelect(found[0].id); } });
    box.replaceChildren(h('span', { class: 'lbl' }, label), h('div', { class: 'kp-row' }, input), newRow, sugg);
    drawSugg();
    if (focus) input.focus();
  };
  return { el: box, draw };
}

/** Vorzeichenfeld (+/−) links neben dem Betrag. Beide Vorzeichen sind bei Kunden (Rückzahlung) und Lieferanten (Gutschrift) möglich. */
export function betragFields(sign = '+', value = '') {
  const signSel = h('select', { class: 'sign', 'aria-label': 'Vorzeichen' }, h('option', { value: '+' }, '+'), h('option', { value: '-' }, '−'));
  signSel.value = sign;
  const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0.00', value, autocomplete: 'off', 'aria-label': 'Betrag in CHF' });
  const el = h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Betrag (CHF)'), h('div', { class: 'amount-row' }, signSel, input));
  return { el, signSel, input };
}

/** Buchungskategorien passend zum Kontakt (Kunde: Einnahmen, Lieferant: Ausgaben) */
export const kategorienFor = (k) => (k ? db.kategorienList('buchungskategorie', db.artOfKontakt(k)) : []);

/** Vorbelegung nach der Kontaktwahl aus der letzten Buchung dieses Kontakts (ohne excludeId); ohne Buchung: Standard je Kontakttyp. */
export function prefillFor(kontakt, excludeId = null) {
  const last = db.buchungenOf(kontakt.id).filter((b) => b.id !== excludeId).sort((a, b) => (b.created || 0) - (a.created || 0))[0];
  if (!last) return { sign: kontakt.istLieferant ? '-' : '+', betrag: '', kategorieId: '' };
  const kat = db.data.buchungskategorie.get(last.kategorieId);
  return { sign: last.betrag < 0 ? '-' : '+', betrag: (Math.abs(last.betrag) / 100).toFixed(2), kategorieId: kat && kat.art === db.artOfKontakt(kontakt) ? kat.id : '' };
}
