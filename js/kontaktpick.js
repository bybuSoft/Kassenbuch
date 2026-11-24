// Gemeinsame Bausteine für Buchungserfassung: Kontaktwahl mit Smartsuche (nur Namen) und Vorzeichen-/Betragsfeld
import * as db from './db.js';
import { h, normalize, chf, fmtDate, parseBetrag } from './util.js';
import { confirmDlg } from './ui.js';
import { editKontakt } from './kontakte.js';

/** Kunde/Lieferant wählen. Vorschläge erscheinen erst nach Eingabe. */
export function kontaktPicker({ getId, onSelect, onClear }) {
  const box = h('div', { class: 'kontaktpick' });
  const draw = (focus = false) => {
    const k = db.data.kontakt.get(getId());
    const label = 'Kunde / Lieferant';
    if (k) {
      box.replaceChildren(h('span', { class: 'lbl' }, k.istLieferant ? 'Lieferant' : 'Kunde'),
        h('div', { class: 'chip' }, h('strong', {}, db.kontaktListName(k)),
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
        h('strong', {}, db.kontaktListName(c)), h('span', { class: 'muted' }, [c.istLieferant ? 'Lieferant' : '', c.plz, c.ort, c.sys === 'eigene' ? 'eigene Firma' : ''].filter(Boolean).join(' ')))));
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

/** Betragsfeld: erster Klick markiert den ganzen Betrag (direkt überschreibbar), der zweite setzt den Cursor */
function betragInput(value = '') {
  const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0.00', value, autocomplete: 'off', 'aria-label': 'Betrag in CHF' });
  let fresh = false;
  input.addEventListener('focus', () => { fresh = true; setTimeout(() => { input.select(); }, 0); setTimeout(() => { fresh = false; }, 600); });
  input.addEventListener('blur', () => { fresh = false; });
  for (const ev of ['mouseup', 'touchend']) input.addEventListener(ev, (e) => { if (fresh) { e.preventDefault(); fresh = false; } });
  return input;
}
const signSelect = (sign) => {
  const signSel = h('select', { class: 'sign', 'aria-label': 'Vorzeichen' }, h('option', { value: '+' }, '+'), h('option', { value: '-' }, '−'));
  signSel.value = sign;
  return signSel;
};

/** Buchungskategorien passend zum Kontakt (Kunde: Einnahmen, Lieferant: Ausgaben); die alte Kategorie „Stiftung“ wird nicht mehr angeboten */
export const kategorienFor = (k) => (k ? db.erfassKategorien(db.artOfKontakt(k)) : []);

const leereZeile = (over = {}) => ({ kategorieId: '', sign: '+', betrag: '', stiftung: false, ...over });
const katByName = (name) => db.erfassKategorien('einnahme').find((c) => c.name.toLowerCase() === name.toLowerCase());
/** Erfassungszeilen (Kategorie, +/−, Betrag, Stiftung) aus den Positionen einer Buchung */
export const rowsFromPositionen = (ps) => ps.map((p) => leereZeile({ kategorieId: p.kategorieId, sign: p.betrag < 0 ? '-' : '+', betrag: (Math.abs(p.betrag) / 100).toFixed(2), stiftung: !!p.stiftung }));

/** Vorgabezeilen ohne Vorbuchung: Kunde: Podologie und Verkauf, Lieferant: eine leere Zeile (Kategorie wählen) */
export function defaultRows(kontakt) {
  if (kontakt && !kontakt.istLieferant) return ['Podologie', 'Verkauf'].map((n) => leereZeile({ kategorieId: katByName(n)?.id || '' }));
  return [leereZeile({ sign: kontakt?.istLieferant ? '-' : '+' })];
}

/** Vorbelegung nach der Kontaktwahl aus der letzten Buchung dieses Kontakts (ohne excludeId): Kategorien, Vorzeichen, Beträge, Stiftung.
 *  Kunden haben immer die Zeilen Podologie und Verkauf; ohne Buchung: Standard je Kontakttyp. */
export function prefillRows(kontakt, excludeId = null) {
  const last = db.buchungenOf(kontakt.id).filter((b) => b.id !== excludeId).sort((a, b) => (b.created || 0) - (a.created || 0))[0];
  if (!last) return defaultRows(kontakt);
  const valid = new Set(kategorienFor(kontakt).map((c) => c.id));
  const rows = rowsFromPositionen(last.positionen.filter((p) => valid.has(p.kategorieId)));
  if (kontakt.istLieferant) return rows.length ? rows : defaultRows(kontakt);
  const stiftung = db.hasStiftung(last);
  for (const n of ['Podologie', 'Verkauf']) {
    const c = katByName(n);
    if (c && !rows.some((r) => r.kategorieId === c.id)) rows.push(leereZeile({ kategorieId: c.id, stiftung }));
  }
  const rank = (r) => ['podologie', 'verkauf'].indexOf((db.data.buchungskategorie.get(r.kategorieId)?.name || '').toLowerCase());
  return rows.map((r, i) => ({ r, i })).sort((x, y) => (rank(x.r) < 0 ? 9 : rank(x.r)) - (rank(y.r) < 0 ? 9 : rank(y.r)) || x.i - y.i).map((x) => x.r);
}

/** Zeilen → Positionen. Zeilen ohne Betrag werden übersprungen. Liefert {positionen} oder {error, index}. */
export function positionenFromRows(rows) {
  const positionen = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!String(r.betrag).trim()) continue;
    const cents = parseBetrag(r.betrag);
    if (cents === null) return { error: 'Bitte einen gültigen Betrag erfassen (z. B. 65.00).', index: i };
    if (!r.kategorieId) return { error: 'Bitte eine Buchungskategorie wählen.', index: i };
    positionen.push({ kategorieId: r.kategorieId, betrag: r.sign === '-' ? -cents : cents, stiftung: !!r.stiftung });
  }
  if (!positionen.length) return { error: 'Bitte mindestens einen Betrag erfassen (z. B. 65.00).', index: 0 };
  return { positionen };
}

/**
 * Editor für die Positionen einer Buchung: je Zeile Kategorie, +/−, Betrag und Checkbox „Stiftung“ (nur bei Kunden).
 * `rows` ist ein Array von {kategorieId, sign, betrag (Text), stiftung} und wird direkt verändert (bleibt so über Neuzeichnen erhalten).
 * Zeilen ohne Betrag werden beim Speichern ignoriert. onEnterLast: Enter im letzten Betragsfeld.
 */
export function positionenEditor({ rows, getKontakt, onEnterLast }) {
  const el = h('div', { class: 'stack posedit' });
  const inputs = [];
  const draw = () => {
    const k = getKontakt();
    const cats = kategorienFor(k);
    const showStiftung = !!k && !k.istLieferant; // Stiftung gibt es nur bei Kunden
    inputs.length = 0;
    const rowEls = rows.map((r, i) => {
      const katSel = h('select', { 'aria-label': 'Buchungskategorie', onchange: () => { r.kategorieId = katSel.value; } },
        h('option', { value: '' }, k ? '– Kategorie wählen –' : '– zuerst Kontakt wählen –'), ...cats.map((c) => h('option', { value: c.id }, c.name)));
      if (r.kategorieId && !cats.some((c) => c.id === r.kategorieId)) r.kategorieId = '';
      katSel.value = r.kategorieId;
      const signSel = signSelect(r.sign); signSel.addEventListener('change', () => { r.sign = signSel.value; });
      const inp = betragInput(r.betrag); inp.addEventListener('input', () => { r.betrag = inp.value; });
      inputs.push(inp);
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const n = inputs[inputs.indexOf(inp) + 1];
        if (n) { n.focus(); n.select(); } else onEnterLast?.();
      });
      const stift = h('input', { type: 'checkbox', checked: !!r.stiftung, onchange: (e) => { r.stiftung = e.target.checked; } });
      const del = rows.length > 1 ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Zeile entfernen', title: 'Zeile entfernen', onclick: () => { rows.splice(i, 1); draw(); } }, '✕') : null;
      // eine Zeile: Kategorie, +/−, Betrag, Stiftung (nur Kunden), Entfernen
      return h('div', { class: 'posrow' }, katSel, signSel, inp,
        showStiftung ? h('label', { class: 'check stift' }, stift, h('span', {}, 'Stiftung')) : null, del);
    });
    el.replaceChildren(...rowEls,
      h('button', { type: 'button', class: 'btn small', onclick: () => { rows.push(leereZeile({ sign: rows.at(-1)?.sign || '+' })); draw(); inputs.at(-1)?.focus(); } }, '+ Zeile'));
  };
  draw();
  return {
    el, draw,
    /** Zeilen ersetzen (z. B. nach der Kontaktwahl) */
    set(newRows) { rows.splice(0, rows.length, ...newRows); draw(); },
    focusFirst() { inputs[0]?.focus(); inputs[0]?.select(); },
    /** Positionen lesen; bei Fehler Meldung und {error} */
    read() {
      const r = positionenFromRows(rows);
      if (r.positionen && getKontakt()?.istLieferant) r.positionen.forEach((p) => { p.stiftung = false; }); // Lieferanten: nie Stiftung
      return r;
    },
  };
}

/** Warnung bei Betrag 0: true = trotzdem speichern, false = abbrechen. */
export const confirmNullBetrag = () => confirmDlg('Der Betrag ist 0.00. Soll die Buchung trotzdem gespeichert werden?', { title: 'Betrag 0', ok: 'Trotzdem speichern', cancel: 'Abbrechen' });

/** Dublettenprüfung für eine Buchung: true = speichern (kein Treffer oder trotzdem bestätigt). */
export async function confirmBuchungDup(b) {
  const dups = db.findDuplicateBuchungen(b);
  if (!dups.length) return true;
  const lines = dups.map((d) => `• ${fmtDate(d.datum)}, CHF ${chf(db.posSum(d))}${d.text ? `, ${d.text}` : ''}`).join('\n');
  return confirmDlg(`Für ${db.kontaktListName(db.data.kontakt.get(b.kontaktId))} gibt es schon ${dups.length === 1 ? 'eine Buchung' : `${dups.length} Buchungen`} mit gleichem Datum und gleicher Summe:\n${lines}\n\nTrotzdem speichern?`, { title: 'Dublettenprüfung', ok: 'Trotzdem speichern' });
}
