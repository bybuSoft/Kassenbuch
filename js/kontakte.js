// Kunden- und Lieferantenverwaltung
import * as db from './db.js';
import { h, uuid, normalize } from './util.js';
import { showModal, confirmDlg, field, checkField, toast, datumField } from './ui.js';
import { nav } from './nav.js';
import { printQuittung } from './kassenbuch.js';
import { fmtDate, chf, today, parseBetrag } from './util.js';
import { betragFields, kategorienFor, prefillFor } from './kontaktpick.js';

const HEALTH = [['diabetes', 'Diabetes'], ['antikoaguliert', 'Antikoaguliert'], ['allergien', 'Allergien'], ['hiv', 'HIV-positiv'], ['haemophilie', 'Hämophilie']];
const listState = { kunde: { q: '', kat: '' }, lieferant: { q: '' } };

/** Liste der Kunden bzw. Lieferanten */
export function kontakteScreen(typ) {
  const lief = typ === 'lieferant';
  const st = listState[typ];
  const q = h('input', { type: 'search', placeholder: 'Suchen…', value: st.q, 'aria-label': 'Suchen' });
  const katSel = lief ? null : h('select', { 'aria-label': 'Kategorie' },
    h('option', { value: '' }, 'Alle Kategorien'),
    ...db.kategorienList('kundenkategorie').map((c) => h('option', { value: c.id }, c.name)));
  if (katSel) katSel.value = st.kat;
  const list = h('div', { class: 'list' });

  const draw = () => {
    st.q = q.value; if (katSel) st.kat = katSel.value;
    const terms = normalize(q.value).split(/\s+/).filter(Boolean);
    const rows = db.kontakteList(lief).filter((k) => {
      if (katSel && katSel.value && k.kategorieId !== katSel.value) return false;
      const hay = normalize(`${db.kontaktName(k)} ${k.ort} ${k.plz} ${k.strasse}`);
      return terms.every((t) => hay.includes(t));
    });
    list.replaceChildren(...(rows.length ? rows.map((k) => {
      const kat = db.data.kundenkategorie.get(k.kategorieId);
      const prefer = db.commsOf(k.id).filter((c) => c.bevorzugt)[0] || db.commsOf(k.id)[0];
      return h('button', { type: 'button', class: 'row', onclick: async () => { await editKontakt({ id: k.id }); nav.refresh(); } },
        h('div', { class: 'row-main' },
          h('strong', {}, db.kontaktName(k) || '(ohne Name)'),
          h('span', { class: 'muted' }, [k.plz, k.ort].filter(Boolean).join(' '))),
        h('div', { class: 'row-sub muted' }, [kat?.name, prefer?.wert, k.sys === 'eigene' ? 'eigene Firma' : ''].filter(Boolean).join(' · ')));
    }) : [h('p', { class: 'muted pad' }, 'Keine Einträge.')]));
  };
  q.addEventListener('input', draw);
  katSel?.addEventListener('change', draw);
  draw();

  return {
    title: lief ? 'Lieferanten' : 'Kunden', back: 'menu',
    actions: [h('button', { class: 'btn primary', onclick: async () => { await editKontakt({ prefill: { istLieferant: lief } }); nav.refresh(); } }, '+ Neu')],
    node: h('div', { class: 'stack' }, h('div', { class: `filters${lief ? ' one' : ''}` }, q, katSel), list),
  };
}

/** Alle Buchungen eines Kunden/Lieferanten (nach Datum absteigend) mit Schnellerfassung einer neuen Buchung */
function showKontaktBuchungen(k) {
  const body = h('div', { class: 'stack' });
  let doSave = async () => {};
  const draw = (focusDatum) => {
    const bs = db.buchungenOf(k.id).sort((a, b) => (a.datum === b.datum ? (b.created || 0) - (a.created || 0) : a.datum < b.datum ? 1 : -1));
    const total = bs.reduce((s, b) => s + b.betrag, 0);
    // Neue Buchung: Datum (heute, änderbar), Betrag und Kategorie aus der jüngsten Buchung vorbelegt
    const p = prefillFor(k);
    const df = datumField(today()); const datum = df.input;
    const bf = betragFields(p.sign, p.betrag);
    const cats = kategorienFor(k);
    const kat = h('select', { 'aria-label': 'Buchungskategorie' }, h('option', { value: '' }, '– wählen –'), ...cats.map((c) => h('option', { value: c.id }, c.name)));
    kat.value = p.kategorieId;
    const text = h('input', { type: 'text', placeholder: 'optional', autocomplete: 'off', 'aria-label': 'Buchungstext' });
    const save = async () => {
      const cents = parseBetrag(bf.input.value);
      const dv = df.value;
      if (!dv) { toast('Bitte ein gültiges Datum erfassen (TT.MM.JJJJ).', 'err'); datum.focus(); return; }
      if (!cents) { toast('Bitte einen Betrag grösser als 0 erfassen.', 'err'); bf.input.focus(); return; }
      if (!kat.value) { toast('Bitte eine Buchungskategorie wählen.', 'err'); kat.focus(); return; }
      await db.put('buchung', { id: uuid(), datum: dv, betrag: bf.signSel.value === '-' ? -cents : cents, kontaktId: k.id, kategorieId: kat.value, text: text.value.trim(), created: Date.now() });
      toast('Buchung gespeichert');
      draw(true);
    };
    datum.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); bf.input.focus(); bf.input.select(); } });
    bf.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kat.focus(); } });
    kat.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); text.focus(); } });
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    doSave = save;
    const form = h('div', { class: 'stack' }, field('Datum', df.el), bf.el, field('Buchungskategorie', kat), field('Buchungstext', text));
    const list = h('div', { class: 'list' }, ...(bs.length ? bs.map((b) => h('div', { class: 'row static' },
      h('div', { class: 'row-main' }, h('strong', {}, fmtDate(b.datum)), h('div', { class: 'amt' }, h('span', { class: b.betrag < 0 ? 'out' : 'in' }, chf(b.betrag)),
        db.artOf(b) === 'einnahme' && b.betrag > 0 ? h('button', { type: 'button', class: 'print-btn', title: 'Quittung drucken', 'aria-label': 'Quittung drucken', onclick: () => printQuittung(b) }, '🖨') : null)),
      h('div', { class: 'row-sub muted' }, [db.data.buchungskategorie.get(b.kategorieId)?.name, b.text].filter(Boolean).join(' · ')))) : [h('p', { class: 'muted pad' }, 'Keine Buchungen vorhanden.')]));
    body.replaceChildren(form, h('p', { class: 'muted small' }, `${bs.length} Buchung${bs.length === 1 ? '' : 'en'} · Total ${chf(total)}`), list);
    if (focusDatum) setTimeout(() => datum.focus(), 0);
  };
  draw(true);
  return showModal({ title: `Buchungen: ${db.kontaktName(k)}`, wide: true, body,
    buttons: [{ label: 'Schliessen' }, { label: 'Buchen', cls: 'primary', onClick: async () => { await doSave(); return false; } }] }).closed;
}

/**
 * Kontakt anlegen/bearbeiten. Gibt die ID des gespeicherten Kontakts zurück (null bei Abbruch/Löschen).
 * lockType ('kunde'|'lieferant'): Typ ist fest vorgegeben (z. B. aus dem Buchungsdialog).
 */
export async function editKontakt({ id = null, prefill = {}, lockType = null } = {}) {
  const ex = id ? db.data.kontakt.get(id) : null;
  const k = ex ? { ...ex } : db.newKontakt({ ...prefill, ...(lockType ? { istLieferant: lockType === 'lieferant' } : {}) });
  const comms = ex ? db.commsOf(id).map((c) => ({ ...c })) : [];
  comms.forEach((c, i) => { if (c.bevorzugt && comms.findIndex((o) => o.bevorzugt) !== i) c.bevorzugt = false; }); // nur eine bevorzugt
  const locked = !!lockType || !!k.sys;

  // ---- Felder
  const chkLief = h('input', { type: 'checkbox', checked: k.istLieferant, disabled: locked });
  const vorname = h('input', { value: k.vorname, autocomplete: 'off' });
  const name = h('input', { value: k.name, autocomplete: 'off' });
  const geb = h('input', { type: 'date', value: k.geburtsdatum });
  const kat = h('select', {}, h('option', { value: '' }, '– keine –'),
    ...db.kategorienList('kundenkategorie').map((c) => h('option', { value: c.id }, c.name)));
  kat.value = k.kategorieId || '';
  const health = Object.fromEntries(HEALTH.map(([key]) => [key, h('input', { type: 'checkbox', checked: !!k[key] })]));
  const name1 = h('input', { value: k.name1, autocomplete: 'off' });
  const name2 = h('input', { value: k.name2, autocomplete: 'off' });
  const strasse = h('input', { value: k.strasse, autocomplete: 'off' });
  const plz = h('input', { value: k.plz, inputmode: 'numeric', autocomplete: 'off' });
  const ort = h('input', { value: k.ort, autocomplete: 'off' });
  const notizen = h('textarea', { rows: 4, placeholder: 'Freitext, z. B. Hinweise zur Behandlung' }, k.notizen);
  notizen.value = k.notizen;

  const kundeTop = h('div', { class: 'stack' },
    h('div', { class: 'grid2' }, field('Vorname', vorname), field('Name', name)),
    h('div', { class: 'grid2' }, field('Geburtsdatum', geb), field('Kundenkategorie', kat)));
  const kundeHealth = h('fieldset', { class: 'fs' }, h('legend', {}, 'Gesundheit'),
    h('div', { class: 'checks' }, ...HEALTH.map(([key, label]) => checkField(label, health[key]))));
  const geschlecht = h('select', { 'aria-label': 'Geschlecht / Firma' }, h('option', { value: '' }, '– keine Angabe –'),
    h('option', { value: 'w' }, 'weiblich'), h('option', { value: 'm' }, 'männlich'), h('option', { value: 'firma' }, 'Firma'));
  geschlecht.value = k.geschlecht || '';
  const anrede = h('select', { 'aria-label': 'Anrede' }, h('option', { value: '' }, '– keine Angabe –'),
    h('option', { value: 'du' }, 'Du'), h('option', { value: 'sie' }, 'Sie'));
  anrede.value = k.anrede || '';
  const lieferantBox = h('div', { class: 'grid2' }, field('Name 1', name1), field('Name 2', name2));
  const syncType = () => {
    kundeTop.hidden = kundeHealth.hidden = chkLief.checked; lieferantBox.hidden = !chkLief.checked;
  };
  chkLief.addEventListener('change', syncType);
  syncType();

  // Kommunikation (mehrere Telefonnummern/E-Mails)
  const commBox = h('div', { class: 'stack' });
  const drawComms = () => {
    commBox.replaceChildren(...comms.map((c, i) => {
      const typ = h('select', { 'aria-label': 'Art', onchange: () => { c.typ = typ.value; drawComms(); } },
        h('option', { value: 'tel' }, 'Telefon'), h('option', { value: 'mail' }, 'E-Mail'));
      typ.value = c.typ;
      const wert = h('input', { value: c.wert, type: c.typ === 'mail' ? 'email' : 'tel', 'aria-label': c.typ === 'mail' ? 'E-Mail' : 'Telefonnummer', autocomplete: 'off', oninput: () => { c.wert = wert.value; } });
      const pref = h('input', { type: 'checkbox', checked: !!c.bevorzugt, onchange: () => {
        comms.forEach((o) => { o.bevorzugt = false; }); // es kann nur eine Kommunikation bevorzugt sein
        c.bevorzugt = pref.checked; drawComms();
      } });
      const href = c.wert.trim() ? (c.typ === 'mail' ? `mailto:${c.wert.trim()}` : `tel:${c.wert.trim().replace(/[^\d+]/g, '')}`) : '';
      const open = href ? h('a', { class: 'btn small', href, 'aria-label': c.typ === 'mail' ? 'E-Mail-App öffnen' : 'Anrufen' }, c.typ === 'mail' ? '✉' : '☎') : null;
      return h('div', { class: 'comm' }, typ, wert, open, checkField('bevorzugt', pref),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Entfernen', onclick: () => { comms.splice(i, 1); drawComms(); } }, '×'));
    }), h('button', { type: 'button', class: 'btn small', onclick: () => { comms.push({ id: uuid(), kontaktId: k.id, typ: 'tel', wert: '', bevorzugt: false }); drawComms(); } }, '+ Telefon/E-Mail'));
  };
  drawComms();

  const marker = h('button', { type: 'button', class: 'btn small', onclick: () => {
    const v = notizen.value; const pos = notizen.selectionStart ?? v.length;
    const before = v.slice(0, pos); const prefix = before && !before.endsWith('\n') ? '\n' : '';
    notizen.value = `${before}${prefix}• ${v.slice(pos)}`;
    const np = before.length + prefix.length + 2; notizen.focus(); notizen.setSelectionRange(np, np);
  } }, '• Marker einfügen');

  const body = h('div', { class: 'stack' },
    k.sys === 'eigene' ? h('p', { class: 'muted' }, 'Eigene Firma: erscheint auf Quittungen und kann bei Ausgaben als Kontakt gewählt werden.') : null,
    locked ? null : checkField('Lieferant (juristische Person)', chkLief),
    kundeTop, lieferantBox,
    h('div', { class: 'grid2' }, field('Geschlecht / Firma', geschlecht), field('Anrede', anrede)),
    h('div', { class: 'grid3' }, field('Strasse', strasse, 'span3'), field('PLZ', plz), field('Ort', ort, 'span2')),
    h('fieldset', { class: 'fs' }, h('legend', {}, 'Kommunikation'), commBox),
    kundeHealth,
    h('fieldset', { class: 'fs' }, h('legend', {}, 'Notizen'), notizen, marker));

  const buttons = [];
  if (ex && !ex.sys) {
    buttons.push({ label: 'Löschen', cls: 'danger left', onClick: async (ctl) => {
      const n = db.buchungenOf(ex.id).length;
      const dummy = db.kontaktName(db.sysKontakt(ex.istLieferant ? 'dummyLieferant' : 'dummyKunde'));
      const ok = await confirmDlg(`„${db.kontaktName(ex)}“ wirklich löschen?` + (n ? `\n\n${n} Buchung${n === 1 ? '' : 'en'} bleiben erhalten und werden „${dummy}“ zugeordnet.` : ''), { title: 'Kontakt löschen', ok: 'Löschen', danger: true });
      if (!ok) return false;
      await db.deleteKontakt(ex.id);
      toast('Kontakt gelöscht');
      ctl.close({ deleted: true });
      return false;
    } });
  }
  if (ex) buttons.push({ label: 'Buchungen', onClick: async () => { await showKontaktBuchungen(ex); return false; } });
  buttons.push({ label: 'Abbrechen', value: null });
  buttons.push({ label: 'Speichern', cls: 'primary', onClick: async () => {
    const lief = chkLief.checked;
    const out = { ...k, istLieferant: lief, geschlecht: geschlecht.value, anrede: anrede.value, strasse: strasse.value.trim(), plz: plz.value.trim(), ort: ort.value.trim(), notizen: notizen.value };
    if (lief) {
      out.name1 = name1.value.trim(); out.name2 = name2.value.trim();
      if (!out.name1) { toast('Bitte Name 1 erfassen.', 'err'); name1.focus(); return false; }
    } else {
      out.vorname = vorname.value.trim(); out.name = name.value.trim();
      if (!out.name) { toast('Bitte einen Namen erfassen.', 'err'); name.focus(); return false; }
      out.geburtsdatum = geb.value; out.kategorieId = kat.value || null;
      HEALTH.forEach(([key]) => { out[key] = health[key].checked; });
    }
    const cl = comms.filter((c) => c.wert.trim()).map((c) => ({ ...c, wert: c.wert.trim() }));
    let seenPref = false; cl.forEach((c) => { if (c.bevorzugt) { if (seenPref) c.bevorzugt = false; seenPref = true; } });
    const dups = db.findDuplicates(out, cl);
    if (dups.length) {
      const lines = dups.map((d) => `• ${db.kontaktName(d)}${d.plz || d.ort ? `, ${[d.plz, d.ort].filter(Boolean).join(' ')}` : ''}`).join('\n');
      const ok = await confirmDlg(`Mögliche Doppeleinträge (${dups.length}):\n${lines}\n\nTrotzdem speichern?`, { title: 'Dublettenprüfung', ok: 'Trotzdem speichern' });
      if (!ok) return false;
    }
    const ops = [{ op: 'put', store: 'kontakt', obj: out }];
    db.commsOf(out.id).forEach((c) => ops.push({ op: 'del', store: 'kommunikation', id: c.id }));
    cl.forEach((c) => ops.push({ op: 'put', store: 'kommunikation', obj: c }));
    await db.batch(ops);
    toast('Gespeichert');
    return { saved: out.id };
  } });

  const ctl = showModal({ title: ex ? (k.istLieferant ? 'Lieferant bearbeiten' : 'Kunde bearbeiten') : (k.istLieferant ? 'Neuer Lieferant' : 'Neuer Kunde'), body, buttons, wide: true });
  const r = await ctl.closed;
  return r && r.saved ? r.saved : null;
}
