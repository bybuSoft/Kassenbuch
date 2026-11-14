import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './setup.js';
import { backupFilename, parseBackupFilename, compareWithLocal, pruneBackups } from '../js/backup.js';

const D = (day, h = 10) => new Date(2026, 10, day, h, 0, 0);

test('Dateiname: Datum/Zeit/Gerät/Version, ohne „kassenbuch“', async () => {
  const db = await freshDb();
  const n = backupFilename(new Date(2026, 10, 14, 9, 5, 7), 'iPhone Marlene');
  assert.match(n, /^20261114-090507-iPhone_Marlene-v.+\.enc$/);
  assert.match(backupFilename(new Date(2026, 10, 14, 9, 5, 7), ''), /^20261114-090507-v.+\.enc$/);
  assert.equal(db.deviceName(), '');
});

test('Dateiname lesen: neues, vorheriges und älteres Schema', () => {
  const t = new Date(2026, 10, 14, 9, 5, 7).getTime();
  assert.deepEqual(parseBackupFilename('20261114-090507-iPhone_Marlene-v0.9.x.enc'), { device: 'iPhone Marlene', date: t });
  assert.deepEqual(parseBackupFilename('20261114-090507-v0.9.x.enc'), { device: '', date: t });
  assert.deepEqual(parseBackupFilename('kassenbuch-20261114-090507-PC_Sepp-v0.9.x.enc'), { device: 'PC Sepp', date: t });
  assert.deepEqual(parseBackupFilename('kassenbuch-PC_Sepp-20261114-090507-v0.2.x.enc'), { device: 'PC Sepp', date: t });
  assert.equal(parseBackupFilename('tabelle.xlsx').date, null);
});

test('Daten prüfen: grün / gelb / rot / keine Sicherung', async () => {
  const db = await freshDb();
  const info = (d) => ({ name: 'x', device: 'X', date: Math.floor(d / 1000) * 1000 });
  // leer
  assert.equal(compareWithLocal({ none: true }).level, 'none');
  assert.equal(compareWithLocal(info(Date.now())).level, 'warn');            // neue Installation, Sicherung vorhanden -> Restore empfohlen
  // lokale Daten vorhanden (Kontakt + Buchung)
  const k = db.newKontakt({ name: 'Meier' });
  await db.put('kontakt', k);
  await db.put('buchung', { id: 'b1', datum: '2026-11-01', betrag: 100, kontaktId: k.id, kategorieId: [...db.data.buchungskategorie.keys()][0], text: '', created: 1 });
  const now = Date.now();
  db.data.meta.lastChange = now - 10000;
  db.data.meta.syncedTo = now - 5000;                                         // gesichert nach letzter Änderung
  assert.equal(compareWithLocal(info(now - 5000)).level, 'ok');
  assert.equal(compareWithLocal(info(now - 90000)).level, 'ok');             // älteres Backup gewählt, Stand aber gesichert
  const warn = compareWithLocal(info(now + 60000));                          // neuere Sicherung, lokal unverändert
  assert.equal(warn.level, 'warn'); assert.ok(!warn.dirty);
  db.data.meta.lastChange = now;                                              // Änderung nach dem Stand
  db.data.meta.syncedTo = now - 5000;
  const dirty = compareWithLocal(info(now - 5000));
  assert.equal(dirty.level, 'warn'); assert.equal(dirty.dirty, true);        // ungesichert: gelb, mit „Jetzt sichern“
  const conflict = compareWithLocal(info(now + 60000));
  assert.equal(conflict.level, 'red'); assert.equal(conflict.dirty, true);   // neuere Sicherung UND lokale Änderungen
  assert.equal(compareWithLocal({ none: true }).level, 'red');                // Daten vorhanden, keine Sicherung
});

test('Alte Sicherungen löschen: jüngste bleiben, andere Dateien unberührt (geräteunabhängig)', async () => {
  await freshDb();
  const names = [backupFilename(D(1), 'Mac'), backupFilename(D(2), 'Mac'), backupFilename(D(3), 'iPhone'), backupFilename(D(4), 'Mac'), 'tabelle.xlsx', 'notiz.enc', 'kassenbuch-x.txt'];
  const files = new Set(names);
  const dir = { async *entries() { for (const n of [...files]) yield [n, { kind: 'file' }]; }, async removeEntry(n) { files.delete(n); } };
  const deleted = await pruneBackups(dir, 2, backupFilename(D(4), 'Mac'));
  assert.equal(deleted, 2);
  assert.deepEqual([...files].sort(), [backupFilename(D(3), 'iPhone'), backupFilename(D(4), 'Mac'), 'kassenbuch-x.txt', 'notiz.enc', 'tabelle.xlsx'].sort());
});
