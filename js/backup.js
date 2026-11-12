// Datensicherung (verschlüsselt) und Restore
import * as db from './db.js';
import { h, saveBlob, pickFile, fmtDateTime } from './util.js';
import { encryptJson, decryptJson } from './crypto.js';
import { VERSION } from './version.js';
import { passwordDlg, confirmDlg, alertDlg, toast } from './ui.js';
import { nav } from './nav.js';

let passConfirmedThisSession = false;
const p2 = (n) => String(n).padStart(2, '0');

export function backupFilename(d = new Date()) {
  return `kassenbuch-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}-v${VERSION}.enc`;
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
  const file = await pickFile();
  if (!file) return;
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
    `Datensicherung vom: ${fmtDateTime(snap.createdAt)}`,
    `Letzte Änderung der Daten in der Sicherung: ${fmtDateTime(snap.lastChange)}`,
    `Letzte Änderung der lokalen Daten: ${local ? fmtDateTime(local) : 'keine Daten vorhanden'}`,
    `Inhalt der Sicherung: ${snap.stores.buchung.length} Buchungen, ${snap.stores.kontakt.filter((k) => !k.sys).length} Kontakte`,
  ];
  let warn = '';
  if (local && local > (snap.lastChange || 0)) warn = '\n\nACHTUNG: Die lokalen Daten sind neuer als die Sicherung.\nWillst du die lokalen Daten wirklich überschreiben?';
  else if (local && db.hasUnsavedChanges()) warn = '\n\nHinweis: Die lokalen Daten enthalten Änderungen, die noch nicht gesichert wurden.';
  const ok = await confirmDlg(lines.join('\n') + warn + '\n\nDie lokalen Daten werden durch die Sicherung ersetzt.', {
    title: 'Restore', ok: warn.includes('ACHTUNG') ? 'Ja, lokale Daten überschreiben' : 'Restore durchführen', danger: !!warn,
  });
  if (!ok) return;
  await db.replaceAll(snap);
  passConfirmedThisSession = true;
  toast('Datensicherung wurde eingespielt');
  nav.go('kassenbuch');
}
