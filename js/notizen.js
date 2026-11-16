// Notizen: Liste, Bearbeiten (Text mit Punkten, Bilder/Screenshots) und Senden per E-Mail
import * as db from './db.js';
import { h, fmtDateTime, pickFile } from './util.js';
import { showModal, confirmDlg, alertDlg, toast, field } from './ui.js';
import { nav } from './nav.js';

const MAX_SIDE = 1600;      // längste Bildseite in Pixel (spart Platz in Datenbank und Sicherung)
const MAX_IMAGES = 12;
const MAIL_LIMIT = 1800;    // mailto-Links werden von vielen Mail-Apps ab ca. 2000 Zeichen abgeschnitten

export const notizMail = () => (db.data.meta.notizMail || '').trim();
export const validMail = (s) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(s || '').trim());

const titelOf = (n) => (n.titel || '').trim() || (n.text || '').split('\n').find((l) => l.trim())?.replace(/^[•\-*\s]+/, '').slice(0, 60) || 'Notiz';

/** Bild (Datei/Blob) einlesen und auf MAX_SIDE verkleinern; Ergebnis: JPEG-Data-URL (PNG bleibt PNG, wenn klein) */
export async function imageToDataUrl(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), hh = Math.max(1, Math.round(bmp.height * k));
  const c = h('canvas', { width: w, height: hh });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); // transparente PNGs auf weiss
  ctx.drawImage(bmp, 0, 0, w, hh);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.85);
}

const dataUrlToFile = async (url, name) => {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
};

/** Text der Notiz für die E-Mail */
export const mailBody = (n) => `${n.text || ''}${n.bilder?.length ? `\n\n(${n.bilder.length} Bild${n.bilder.length === 1 ? '' : 'er'} in der Notiz – per „Teilen“ mit Bildern senden)` : ''}`.trim();

/** Senden: E-Mail-App mit vorgegebener Adresse (nur Text); bei Bildern zusätzlich Teilen mit Bildanhängen. */
export async function sendNotiz(n) {
  const to = notizMail();
  if (!validMail(to)) { await alertDlg('Es ist noch keine gültige Empfänger-E-Mail-Adresse hinterlegt.\n\nBitte unter Einstellungen → Notizen eintragen.', { title: 'Senden nicht möglich' }); return; }
  const subject = titelOf(n);
  const openMail = () => {
    let body = mailBody(n);
    if (body.length > MAIL_LIMIT) { body = `${body.slice(0, MAIL_LIMIT)}…`; toast('Text für die E-Mail-App gekürzt – bei langen Notizen „Teilen“ verwenden', 'err'); }
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const canShareFiles = !!(n.bilder?.length && navigator.canShare && navigator.share);
  if (!canShareFiles) { openMail(); return; }
  const ctl = showModal({
    title: 'Notiz senden', body: h('div', { class: 'stack' },
      h('p', {}, `Empfänger: ${to}`),
      h('p', { class: 'muted pre' }, 'E-Mail-App: Adresse und Betreff sind vorgegeben, die Bilder werden aber nicht angehängt.\nTeilen: Text und Bilder werden mitgegeben; Mail wählen und die Adresse selbst eintragen (steht oben).')),
    buttons: [{ label: 'Abbrechen' },
      { label: 'E-Mail-App (nur Text)', onClick: () => { openMail(); } },
      { label: 'Teilen mit Bildern', cls: 'primary', onClick: async () => {
        try {
          const files = await Promise.all(n.bilder.map((u, i) => dataUrlToFile(u, `bild-${i + 1}.jpg`)));
          if (!navigator.canShare({ files })) throw new Error('Teilen mit Bildern wird hier nicht unterstützt.');
          await navigator.share({ files, title: subject, text: `An: ${to}\n\n${n.text || ''}` });
        } catch (e) { if (e?.name !== 'AbortError') toast(e.message || 'Teilen nicht möglich', 'err'); }
      } }],
  });
  await ctl.closed;
}

/** Dialog zum Erfassen/Ändern einer Notiz. Gibt true zurück, wenn gespeichert oder gelöscht wurde. */
export async function editNotiz({ id } = {}) {
  const ex = id ? db.data.notiz.get(id) : null;
  const n = ex ? { ...ex, bilder: [...ex.bilder] } : db.newNotiz();
  const titel = h('input', { type: 'text', value: n.titel, placeholder: 'Titel (optional)', autocomplete: 'off' });
  const text = h('textarea', { rows: 8, placeholder: 'Punkte, Ideen, Fehler … (Enter nach einem Punkt setzt automatisch den nächsten)' });
  text.value = n.text;
  const err = h('div', { class: 'err' });

  // Punkte: „• “ am Zeilenanfang einfügen; Enter in einer Punktzeile setzt den nächsten Punkt (leerer Punkt beendet die Liste)
  const insertBullet = () => {
    const v = text.value; const pos = text.selectionStart ?? v.length;
    const before = v.slice(0, pos); const prefix = before && !before.endsWith('\n') ? '\n' : '';
    text.value = `${before}${prefix}• ${v.slice(pos)}`;
    const np = before.length + prefix.length + 2; text.focus(); text.setSelectionRange(np, np);
  };
  text.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const pos = text.selectionStart; const v = text.value;
    const ls = v.lastIndexOf('\n', pos - 1) + 1; const line = v.slice(ls, pos);
    if (!line.startsWith('• ')) return;
    e.preventDefault();
    if (line === '• ') { text.value = `${v.slice(0, ls)}${v.slice(pos)}`; text.setSelectionRange(ls, ls); return; } // leerer Punkt: Liste beenden
    text.value = `${v.slice(0, pos)}\n• ${v.slice(pos)}`;
    text.setSelectionRange(pos + 3, pos + 3);
  });

  const gallery = h('div', { class: 'note-imgs' });
  const drawImages = () => {
    gallery.replaceChildren(...n.bilder.map((u, i) => h('div', { class: 'note-img' },
      h('img', { src: u, alt: `Bild ${i + 1}`, onclick: () => viewImage(u) }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bild entfernen', onclick: () => { n.bilder.splice(i, 1); drawImages(); } }, '×'))));
  };
  drawImages();

  const addFiles = async (files) => {
    const imgs = files.filter((f) => f && f.type?.startsWith('image/'));
    if (!imgs.length) return false;
    for (const f of imgs) {
      if (n.bilder.length >= MAX_IMAGES) { toast(`Höchstens ${MAX_IMAGES} Bilder pro Notiz`, 'err'); break; }
      try { n.bilder.push(await imageToDataUrl(f)); } catch (e) { console.error(e); toast('Bild konnte nicht gelesen werden', 'err'); }
    }
    drawImages();
    return true;
  };

  const pasteBtn = h('button', { type: 'button', class: 'btn small', onclick: async () => {
    try {
      const items = await navigator.clipboard.read();
      const files = [];
      for (const it of items) { const t = it.types.find((x) => x.startsWith('image/')); if (t) files.push(new File([await it.getType(t)], 'einfuegen', { type: t })); }
      if (!(await addFiles(files))) toast('In der Zwischenablage ist kein Bild', 'err');
    } catch { toast('Kein Zugriff auf die Zwischenablage – Bild ins Textfeld einfügen (lange tippen → Einfügen)', 'err'); }
  } }, 'Bild aus Zwischenablage');
  const fileBtn = h('button', { type: 'button', class: 'btn small', onclick: async () => {
    const f = await pickFile({ multiple: true });
    if (f.length && !(await addFiles(f))) toast('Das ist kein Bild', 'err');
  } }, 'Bild / Screenshot wählen');

  // Einfügen (Strg+V / langes Tippen → Einfügen) irgendwo im Dialog: Bilder übernehmen, Text normal einfügen
  const onPaste = async (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); await addFiles(files); }
  };

  const body = h('div', { class: 'stack' }, field('Titel', titel), field('Notiz', text),
    h('div', { class: 'presets' }, h('button', { type: 'button', class: 'btn small', onclick: insertBullet }, '• Punkt einfügen'), pasteBtn, fileBtn),
    gallery, err);

  const buttons = [];
  if (ex) buttons.push({ label: 'Löschen', cls: 'danger left', onClick: async () => {
    if (!(await confirmDlg(`Notiz „${titelOf(ex)}“ löschen?`, { ok: 'Löschen', danger: true }))) return false;
    await db.del('notiz', ex.id);
  }, value: 'deleted' });
  buttons.push({ label: 'Abbrechen', value: false });
  buttons.push({ label: 'Senden', onClick: async () => { collect(); if (!isEmpty()) await sendNotiz(n); else { err.textContent = 'Die Notiz ist leer.'; return false; } return false; } });
  const collect = () => { n.titel = titel.value.trim(); n.text = text.value.replace(/\s+$/, ''); };
  const isEmpty = () => !n.titel && !n.text && !n.bilder.length;
  buttons.push({ label: 'Speichern', cls: 'primary', value: true, onClick: async () => {
    collect();
    if (isEmpty()) { err.textContent = 'Die Notiz ist leer.'; return false; }
    await db.put('notiz', { ...n, modified: Date.now() });
  } });

  const ctl = showModal({ title: ex ? 'Notiz' : 'Neue Notiz', body, buttons, wide: true, dismissable: true });
  ctl.el.addEventListener('paste', onPaste);
  return !!(await ctl.closed);
}

function viewImage(url) {
  showModal({ title: 'Bild', wide: true, body: h('img', { src: url, class: 'note-full', alt: 'Bild' }), buttons: [{ label: 'Schliessen', cls: 'primary' }] });
}

export function notizenScreen() {
  const to = notizMail();
  const rows = db.notizenList().map((n) => {
    const first = (n.text || '').split('\n').filter((l) => l.trim()).slice(0, 2).join(' ');
    return h('button', { type: 'button', class: 'note-row', onclick: async () => { if (await editNotiz({ id: n.id })) nav.refresh(); } },
      n.bilder?.[0] ? h('img', { src: n.bilder[0], alt: '', class: 'note-thumb' }) : null,
      h('span', { class: 'note-main' }, h('strong', {}, titelOf(n)), first ? h('span', { class: 'muted note-sub' }, first) : null,
        h('span', { class: 'muted note-sub' }, `${fmtDateTime(n.modified)}${n.bilder?.length ? ` · ${n.bilder.length} Bild${n.bilder.length === 1 ? '' : 'er'}` : ''}`)));
  });
  return {
    title: 'Notizen', back: 'infos',
    actions: [h('button', { class: 'btn primary', onclick: async () => { if (await editNotiz()) nav.refresh(); } }, '+ Neu')],
    node: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, to ? `Empfänger beim Senden: ${to}` : 'Noch keine Empfänger-Adresse: bitte unter Einstellungen → Notizen eintragen.'),
      rows.length ? h('div', { class: 'card stack' }, ...rows) : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Noch keine Notizen. Mit „+ Neu“ eine Notiz anlegen.'))),
  };
}
