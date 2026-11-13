// Datensicherung (verschlüsselt) und Restore
import * as db from './db.js';
import { h, saveBlob, pickFile, fmtDateTime } from './util.js';
import { encryptJson, decryptJson } from './crypto.js';
import { VERSION } from './version.js';
import { passwordDlg, confirmDlg, alertDlg, toast, showModal } from './ui.js';
import { nav } from './nav.js';

let passConfirmedThisSession = false;
const p2 = (n) => String(n).padStart(2, '0');

/** Gerätename für den Dateinamen: nur Buchstaben/Ziffern/_ (Rest wird zu _) */
const safeDevice = (s) => String(s || '').trim().replace(/[^A-Za-z0-9äöüÄÖÜéèàÉÈÀ_]+/g, '_').replace(/^_+|_+$/g, '');

export function backupFilename(d = new Date(), device = db.deviceName()) {
  const dev = safeDevice(device);
  return `kassenbuch-${dev ? dev + '-' : ''}${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}-v${VERSION}.enc`;
}

/** Gerätename und Zeitpunkt aus dem Dateinamen einer Sicherung lesen */
export function parseBackupFilename(name) {
  const m = /^kassenbuch-(?:(.+?)-)?(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-v.*)?\.enc$/i.exec(name || '');
  if (!m) return { device: '', date: null };
  return { device: (m[1] || '').replace(/_/g, ' '), date: new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7]).getTime() };
}

export async function makeBackup(pass) {
  const snap = { ...db.snapshot(), appVersion: VERSION };
  const text = await encryptJson(snap, pass);
  return { blob: new Blob([text], { type: 'application/octet-stream' }), filename: backupFilename(new Date(snap.createdAt)) };
}

export async function startBackup() {
  const pass = await passwordDlg({
    title: 'Datensicherung',
    hint: 'Die Sicherung wird mit diesem Passwort verschlüsselt. Das Passwort wird nirgends gespeichert – ohne Passwort kann die Sicherung nicht mehr gelesen werden.',
    confirmField: !passConfirmedThisSession, ok: 'Sichern',
  });
  if (!pass) return;
  const { blob, filename } = await makeBackup(pass);
  const res = await saveBlob(blob, filename, { share: true });
  if (res === 'cancelled') { toast('Datensicherung abgebrochen'); return; }
  passConfirmedThisSession = true;
  await db.setMeta('lastBackup', Date.now());
  toast(res === 'shared' ? 'Datensicherung gespeichert' : `Datensicherung heruntergeladen: ${filename}`);
  nav.refresh();
}

export async function startRestore() {
  let file = null;
  const files = await pickFile({ multiple: true });
  if (!files.length) return;
  if (files.length === 1) file = files[0];
  else {
    // mehrere mögliche Restore-Dateien: mit Gerätename und Zeitpunkt zur Auswahl anzeigen
    const infos = files.map((f) => ({ f, ...parseBackupFilename(f.name) })).sort((a, b) => (b.date || 0) - (a.date || 0));
    const ctl = showModal({
      title: 'Welche Sicherung einspielen?',
      body: h('div', { class: 'list' }, ...infos.map((i) => h('button', { type: 'button', class: 'row', onclick: () => ctl.close(i.f) },
        h('div', { class: 'row-main' }, h('strong', {}, i.device || 'Ohne Gerätename'), h('span', { class: 'muted' }, i.date ? fmtDateTime(i.date) : '')),
        h('div', { class: 'row-sub muted' }, i.f.name)))),
      buttons: [{ label: 'Abbrechen', value: null }],
    });
    file = (await ctl.closed) || null;
    if (!file) return;
  }
  const fileInfo = parseBackupFilename(file.name);
  const text = await file.text();
  const pass = await passwordDlg({ title: 'Passwort der Datensicherung', ok: 'Entschlüsseln', min: 1 });
  if (!pass) return;
  let snap;
  try {
    snap = await decryptJson(text, pass);
    db.validateSnapshot(snap);
  } catch (e) { await alertDlg(e.message, { title: 'Restore nicht möglich' }); return; }

  const local = db.data.meta.lastChange || 0;
  const lines = [
    `Datei: ${file.name}`,
    fileInfo.device ? `Gerät: ${fileInfo.device}` : null,
    `Datensicherung vom: ${fmtDateTime(snap.createdAt)}`,
    `Letzte Änderung der Daten in der Sicherung: ${fmtDateTime(snap.lastChange)}`,
    `Letzte Änderung der lokalen Daten: ${local ? fmtDateTime(local) : 'keine Daten vorhanden'}`,
    `Inhalt der Sicherung: ${snap.stores.buchung.length} Buchungen, ${snap.stores.kontakt.filter((k) => !k.sys).length} Kontakte`,
  ];
  let warn = '';
  if (local && local > (snap.lastChange || 0)) warn = '\n\nACHTUNG: Die lokalen Daten sind neuer als die Sicherung.\nWillst du die lokalen Daten wirklich überschreiben?';
  else if (local && db.hasUnsavedChanges()) warn = '\n\nHinweis: Die lokalen Daten enthalten Änderungen, die noch nicht gesichert wurden.';
  const ok = await confirmDlg(lines.filter(Boolean).join('\n') + warn + '\n\nDie lokalen Daten werden durch die Sicherung ersetzt.', {
    title: 'Restore', ok: warn.includes('ACHTUNG') ? 'Ja, lokale Daten überschreiben' : 'Restore durchführen', danger: !!warn,
  });
  if (!ok) return;
  await db.replaceAll(snap);
  passConfirmedThisSession = true;
  toast('Datensicherung wurde eingespielt');
  nav.go('buchung');
}
