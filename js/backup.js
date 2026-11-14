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
  // Reihenfolge: Datum-Zeit (inkl. Sekunden) / Gerät / Version
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}${dev ? '-' + dev : ''}-v${VERSION}.enc`;
}

/** Gerätename und Zeitpunkt aus dem Dateinamen einer Sicherung lesen (neues und altes Namensschema) */
export function parseBackupFilename(name) {
  const mk = (y, mo, d, h, mi, s, dev) => ({ device: (dev || '').replace(/_/g, ' '), date: new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime() });
  let m = /^(?:kassenbuch-)?(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(?!v\d)([^-]+))?(?:-v.*)?\.enc$/i.exec(name || '');
  if (m) return mk(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
  m = /^kassenbuch-(?:(.+?)-)?(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-v.*)?\.enc$/i.exec(name || ''); // älteres Schema: Gerät vor dem Datum
  if (m) return mk(m[2], m[3], m[4], m[5], m[6], m[7], m[1]);
  return { device: '', date: null };
}

// ---- Standardordner (File System Access API: Chrome/Edge am Desktop/Android; nicht auf iPhone/iPad) ----
export const folderSupported = () => typeof window.showDirectoryPicker === 'function';
export const backupFolder = () => db.data.meta.backupDir || null;

export async function chooseBackupFolder() {
  const handle = await window.showDirectoryPicker({ id: 'kassenbuch-backup', mode: 'readwrite' });
  await db.setMeta('backupDir', handle);
  return handle;
}
export const clearBackupFolder = () => db.setMeta('backupDir', null);

async function folderAccess(handle) {
  try {
    const opt = { mode: 'readwrite' };
    if ((await handle.queryPermission(opt)) === 'granted') return true;
    return (await handle.requestPermission(opt)) === 'granted';
  } catch { return false; }
}

export async function makeBackup(pass) {
  const snap = { ...db.snapshot(), appVersion: VERSION };
  const text = await encryptJson(snap, pass);
  return { blob: new Blob([text], { type: 'application/octet-stream' }), filename: backupFilename(new Date(snap.createdAt)), createdAt: snap.createdAt };
}

export async function startBackup() {
  const pass = await passwordDlg({
    title: 'Datensicherung',
    hint: 'Die Sicherung wird mit diesem Passwort verschlüsselt. Das Passwort wird nirgends gespeichert – ohne Passwort kann die Sicherung nicht mehr gelesen werden.',
    confirmField: !passConfirmedThisSession, ok: 'Sichern',
  });
  if (!pass) return false;
  const { blob, filename, createdAt } = await makeBackup(pass);
  let res;
  const dir = backupFolder();
  if (dir && folderSupported() && await folderAccess(dir)) {
    try {
      const w = await (await dir.getFileHandle(filename, { create: true })).createWritable();
      await w.write(blob); await w.close();
      res = 'folder';
    } catch (e) { toast(`Standardordner nicht beschreibbar (${e.message}) – Datei wird heruntergeladen`, 'err'); }
  }
  if (!res) res = await saveBlob(blob, filename, { share: true });
  if (res === 'cancelled') { toast('Datensicherung abgebrochen'); return false; }
  passConfirmedThisSession = true;
  await db.setMeta('lastBackup', Date.now());
  await db.setMeta('syncedTo', createdAt); // Stand der Daten = Zeitpunkt dieser Sicherung
  toast(res === 'folder' ? `Datensicherung im Ordner „${dir.name}“ gespeichert: ${filename}` : res === 'shared' ? 'Datensicherung gespeichert' : `Datensicherung heruntergeladen: ${filename}`);
  nav.refresh();
  return true;
}

// ---- Daten prüfen: jüngste Sicherung (nur Dateiname) mit dem lokalen Stand vergleichen ----------------
/** Jüngste Sicherung im Standardordner bzw. aus der gewählten Dateiauswahl. null = abgebrochen, {none:true} = keine gefunden. */
export async function latestBackupInfo() {
  let names = [];
  const dir = backupFolder();
  if (dir && folderSupported() && await folderAccess(dir)) {
    try { for await (const [name, entry] of dir.entries()) if (entry.kind === 'file' && /\.enc$/i.test(name)) names.push(name); }
    catch (e) { toast(`Standardordner nicht lesbar (${e.message})`, 'err'); return null; }
  } else {
    const picked = await pickFile({ multiple: true });
    if (!picked.length) return null;
    names = picked.map((f) => f.name);
  }
  const infos = names.map((name) => ({ name, ...parseBackupFilename(name) })).filter((i) => i.date).sort((a, b) => b.date - a.date);
  return infos[0] || { none: true };
}

/** Bewertung: level 'ok' (grün), 'warn' (gelb), 'red' (rot) oder 'none' (keine Sicherung gefunden, keine Daten) */
export function compareWithLocal(info) {
  const last = db.data.meta.lastChange || 0;
  const synced = db.data.meta.syncedTo ?? db.data.meta.lastBackup ?? 0; // letzter gesicherter/wiederhergestellter Stand
  const dirty = last > synced;                                          // lokale Änderungen seit diesem Stand
  const hasData = !db.isEmpty();
  const sec = (t) => Math.floor(t / 1000);
  if (info.none) {
    return hasData ? { level: 'red', text: 'ACHTUNG: Es wurde keine Sicherung gefunden, die lokalen Daten sind nicht gesichert. Bitte jetzt sichern.' }
      : { level: 'none', text: 'Es wurde keine Sicherung gefunden und es sind keine lokalen Daten vorhanden.' };
  }
  const newer = sec(info.date) > sec(synced);
  const from = `${info.device ? `Gerät „${info.device}“` : 'unbekanntes Gerät'}, ${fmtDateTime(info.date)}`;
  const same = info.device && info.device === db.deviceName() ? ' (dieses Gerät)' : '';
  if (dirty && newer) return { level: 'red', text: `ACHTUNG: Es gibt eine neuere Sicherung (${from}${same}) UND lokale Änderungen, die noch nicht gesichert sind. Ein Restore würde die lokalen Änderungen überschreiben.` };
  if (dirty) return { level: 'red', text: `ACHTUNG: Die lokalen Änderungen sind noch nicht gesichert (letzte Änderung ${fmtDateTime(last)}, letzte Sicherung ${from}${same}). Ein Restore ist nicht nötig und würde Daten überschreiben. Bitte zuerst sichern.` };
  if (newer) return { level: 'warn', text: `Es gibt eine neuere Sicherung (${from}${same}) als den lokalen Stand. Lokal wurde nichts geändert – ein Restore wird empfohlen.` };
  return { level: 'ok', text: `Die lokalen Daten sind aktuell (jüngste Sicherung: ${from}${same}). Es ist kein Restore nötig.` };
}

/** „Beenden“: Backupdialog mit Abbruchmöglichkeit; nach erfolgreicher Sicherung wird die App beendet. */
export async function beenden() {
  const ctl = showModal({
    title: 'Beenden',
    body: h('p', { class: 'pre' }, `${db.hasUnsavedChanges() ? 'Es gibt ungesicherte Änderungen.' : 'Alle Änderungen sind gesichert.'}\n\nVor dem Beenden eine Datensicherung erstellen?`),
    buttons: [{ label: 'Abbrechen', value: 'cancel' }, { label: 'Ohne Sicherung beenden', value: 'quit' }, { label: 'Sichern & beenden', cls: 'primary', value: 'backup' }],
  });
  const r = await ctl.closed;
  if (r === 'quit') nav.exit();
  else if (r === 'backup' && await startBackup()) nav.exit();
}

/** Auswahlliste mit Gerätename und Zeitpunkt (aus dem Dateinamen). Gibt File, 'other' oder null zurück. */
async function chooseFromList(files, { other = false } = {}) {
  const infos = files.map((f) => ({ f, ...parseBackupFilename(f.name) })).sort((a, b) => (b.date || 0) - (a.date || 0));
  const ctl = showModal({
    title: 'Welche Sicherung einspielen?',
    body: h('div', { class: 'list' }, ...(infos.length ? infos.map((i) => h('button', { type: 'button', class: 'row', onclick: () => ctl.close(i.f) },
      h('div', { class: 'row-main' }, h('strong', {}, i.device || 'Ohne Gerätename'), h('span', { class: 'muted' }, i.date ? fmtDateTime(i.date) : '')),
      h('div', { class: 'row-sub muted' }, i.f.name))) : [h('p', { class: 'muted pad' }, 'Keine Sicherungen im Standardordner gefunden.')])),
    buttons: [{ label: 'Abbrechen', value: null }, ...(other ? [{ label: 'Andere Datei…', value: 'other' }] : [])],
  });
  return (await ctl.closed) || null;
}

export async function startRestore() {
  let file = null;
  const dir = backupFolder();
  if (dir && folderSupported() && await folderAccess(dir)) {
    try {
      const found = [];
      for await (const [name, entry] of dir.entries()) if (entry.kind === 'file' && /\.enc$/i.test(name)) found.push(await entry.getFile());
      const r = await chooseFromList(found, { other: true });
      if (!r) return;
      if (r !== 'other') file = r;
    } catch (e) { toast(`Standardordner nicht lesbar (${e.message})`, 'err'); }
  }
  if (!file) {
    const files = await pickFile({ multiple: true });
    if (!files.length) return;
    file = files.length === 1 ? files[0] : await chooseFromList(files);
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
  await db.setMeta('syncedTo', snap.createdAt);
  passConfirmedThisSession = true;
  toast('Datensicherung wurde eingespielt');
  nav.go('buchung');
}
