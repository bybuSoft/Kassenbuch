import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './setup.js';
import { prefillFor } from '../js/kontaktpick.js';

const cat = (db, art) => [...db.data.buchungskategorie.values()].find((c) => c.art === art);
const buchung = (db, kontaktId, kategorieId, betrag, id = Math.random().toString(36)) => ({ id, datum: '2026-11-01', betrag, kontaktId, kategorieId, text: 'T', created: Date.now() });

test('Testmodus: nur im Entwicklermodus und nur neue Kontakte/Buchungen werden markiert', async () => {
  const db = await freshDb();
  await db.setMeta('testMode', true);
  const real = db.newKontakt({ name: 'Real' });
  await db.put('kontakt', real);
  assert.ok(!db.data.kontakt.get(real.id).test, 'gesperrt: keine Markierung');

  db.devMode.unlocked = true;
  const t = db.newKontakt({ name: 'Test' });
  await db.put('kontakt', t);
  assert.equal(db.data.kontakt.get(t.id).test, true);

  // neue Telefonnummer bei echtem Kontakt: nie Test; bei Test-Kontakt: Test
  await db.put('kommunikation', { id: 'c-real', kontaktId: real.id, typ: 'tel', wert: '1' });
  await db.put('kommunikation', { id: 'c-test', kontaktId: t.id, typ: 'tel', wert: '2' });
  assert.ok(!db.data.kommunikation.get('c-real').test);
  assert.equal(db.data.kommunikation.get('c-test').test, true);
});

test('Testdaten entfernen: echte Kontakte und deren Kommunikation bleiben', async () => {
  const db = await freshDb();
  const { removeTestData, createTestData, hasTestData } = await import('../js/testdata.js');
  const real = db.newKontakt({ name: 'Real' });
  await db.put('kontakt', real);
  await db.put('kommunikation', { id: 'c1', kontaktId: real.id, typ: 'tel', wert: '079' });
  await createTestData();
  assert.ok(hasTestData());
  await removeTestData();
  assert.ok(!hasTestData());
  assert.ok(db.data.kontakt.has(real.id) && db.data.kommunikation.has('c1'));
});

test('Art einer Buchung folgt der Kategorie; Rückzahlung/Gutschrift ändern sie nicht', async () => {
  const db = await freshDb();
  const k = db.newKontakt({ name: 'K' }); await db.put('kontakt', k);
  const l = db.newKontakt({ istLieferant: true, name1: 'L' }); await db.put('kontakt', l);
  assert.equal(db.artOf(buchung(db, k.id, cat(db, 'einnahme').id, -500)), 'einnahme');
  assert.equal(db.artOf(buchung(db, l.id, cat(db, 'ausgabe').id, 500)), 'ausgabe');
});

test('Kontakt löschen: Buchungen gehen an den Dummy-Kontakt', async () => {
  const db = await freshDb();
  const k = db.newKontakt({ name: 'K' }); await db.put('kontakt', k);
  await db.put('buchung', buchung(db, k.id, cat(db, 'einnahme').id, 100, 'b1'));
  await db.deleteKontakt(k.id);
  assert.equal(db.data.buchung.get('b1').kontaktId, db.sysKontakt('dummyKunde').id);
  assert.ok(!db.data.kontakt.has(k.id));
});

test('Snapshot/Restore: Roundtrip und Konsistenzprüfung', async () => {
  const db = await freshDb();
  const k = db.newKontakt({ name: 'K' }); await db.put('kontakt', k);
  await db.put('buchung', buchung(db, k.id, cat(db, 'einnahme').id, 100, 'b1'));
  const snap = db.snapshot();
  await db.put('buchung', buchung(db, k.id, cat(db, 'einnahme').id, 200, 'b2'));
  await db.replaceAll(snap);
  assert.ok(db.data.buchung.has('b1') && !db.data.buchung.has('b2'));
  const bad = structuredClone(snap); bad.stores.buchung[0].kontaktId = 'gibt-es-nicht';
  assert.throws(() => db.validateSnapshot(bad), /inkonsistent/);
  assert.throws(() => db.validateSnapshot({ app: 'x' }), /keine Kassenbuch/);
});

test('Restore setzt syncedTo und Systemkontakte', async () => {
  const db = await freshDb();
  const snap = structuredClone(db.snapshot());
  snap.createdAt = 1234567;
  snap.stores.kontakt = snap.stores.kontakt.filter((k) => !k.sys);
  await db.replaceAll(snap);
  assert.equal(db.data.meta.syncedTo, 1234567);
  assert.ok(db.eigene() && db.sysKontakt('dummyKunde') && db.sysKontakt('dummyLieferant'));
});

const setup2 = async () => {
  const db = await freshDb();
  const k = db.newKontakt({ name: 'K' }); await db.put('kontakt', k);
  await db.put('buchung', buchung(db, k.id, cat(db, 'einnahme').id, 100, 'b1'));
  const snap = structuredClone(db.snapshot());
  await db.put('buchung', buchung(db, k.id, cat(db, 'einnahme').id, 200, 'b2'));
  return { db, snap, lastChange: db.data.meta.lastChange };
};
const assertOld = async (db, lastChange) => {
  assert.ok(db.data.buchung.has('b1') && db.data.buchung.has('b2') && !db.data.buchung.has('b9'));
  assert.equal(db.data.meta.lastChange, lastChange);
  assert.equal(db.data.meta.syncedTo, undefined);
  db.closeDb(); await db.init(); // auch die Datenbank selbst muss den alten Stand haben
  assert.ok(db.data.buchung.has('b1') && db.data.buchung.has('b2') && !db.data.buchung.has('b9'));
  assert.equal(db.data.meta.lastChange, lastChange);
  assert.equal(db.data.meta.syncedTo, undefined);
};

test('Restore atomar: Fehler beim Schreiben -> alter Stand unverändert', async () => {
  const { db, snap, lastChange } = await setup2();
  snap.stores.buchung.push({ ...snap.stores.buchung[0], id: 'b9', boom: () => 1 }); // nicht speicherbar
  await assert.rejects(() => db.replaceAll(snap), (e) => /nicht eingespielt/.test(e.message) && !e.fatal);
  await assertOld(db, lastChange);
});

test('Restore atomar: Fehler nach dem Schreiben -> Rollback auf alten Stand', async () => {
  const { db, snap, lastChange } = await setup2();
  let n = 0;
  db.testHooks.afterWrite = () => { if (!n++) throw new Error('Neuladen kaputt'); };
  try { await assert.rejects(() => db.replaceAll(snap), (e) => /wiederhergestellt/.test(e.message) && !e.fatal); }
  finally { db.testHooks.afterWrite = null; }
  await assertOld(db, lastChange);
});

test('Restore atomar: Rollback scheitert ebenfalls -> fatal', async () => {
  const { db, snap } = await setup2();
  db.testHooks.afterWrite = () => { throw new Error('immer kaputt'); };
  try { await assert.rejects(() => db.replaceAll(snap), (e) => e.fatal === true && /neu geladen/.test(e.message)); }
  finally { db.testHooks.afterWrite = null; }
});

test('Filtereinstellungen gehen in die Sicherung und werden wiederhergestellt', async () => {
  const db = await freshDb();
  await db.saveFilter('kassenbuch', { from: '2026-01-01', to: '2026-12-31', kat: '', art: 'einnahme' });
  const snap = JSON.parse(JSON.stringify(db.snapshot()));
  assert.equal(snap.filters.kassenbuch.art, 'einnahme');
  await db.saveFilter('kassenbuch', { art: 'ausgabe' });
  await db.replaceAll(snap);
  assert.equal(db.getFilter('kassenbuch').art, 'einnahme');
});

test('Vorbelegung nach Kontaktwahl: letzte Buchung bzw. Standard je Typ', async () => {
  const db = await freshDb();
  const k = db.newKontakt({ name: 'K' }); await db.put('kontakt', k);
  const l = db.newKontakt({ istLieferant: true, name1: 'L' }); await db.put('kontakt', l);
  assert.deepEqual(prefillFor(k), { sign: '+', betrag: '', kategorieId: '' });
  assert.deepEqual(prefillFor(l), { sign: '-', betrag: '', kategorieId: '' });
  const kat = cat(db, 'einnahme').id;
  await db.put('buchung', { ...buchung(db, k.id, kat, -6500, 'b1'), created: 1 });
  await db.put('buchung', { ...buchung(db, k.id, kat, 8500, 'b2'), created: 2 });
  assert.deepEqual(prefillFor(k), { sign: '+', betrag: '85.00', kategorieId: kat });
  assert.deepEqual(prefillFor(k, 'b2'), { sign: '-', betrag: '65.00', kategorieId: kat }); // beim Bearbeiten: ohne die eigene Buchung
});

test('Dublettenprüfung Kontakte: gleicher Name + PLZ/Telefon/E-Mail', async () => {
  const db = await freshDb();
  const a = db.newKontakt({ vorname: 'Anna', name: 'Meier', plz: '3900' }); await db.put('kontakt', a);
  await db.put('kommunikation', { id: 'm1', kontaktId: a.id, typ: 'mail', wert: 'Anna@Example.ch' });
  const mk = (over) => db.newKontakt({ vorname: 'Anna', name: 'Meier', plz: '3000', ...over });
  assert.equal(db.findDuplicates(mk({ plz: '3900' }), []).length, 1, 'gleiche PLZ');
  assert.equal(db.findDuplicates(mk(), []).length, 0, 'andere PLZ, keine Kommunikation');
  assert.equal(db.findDuplicates(mk(), [{ typ: 'mail', wert: ' anna@example.ch ' }]).length, 1, 'gleiche E-Mail');
  assert.equal(db.findDuplicates(mk({ name: 'Müller' }), [{ typ: 'mail', wert: 'anna@example.ch' }]).length, 0, 'anderer Name');
});

test('Dublettenprüfung Buchungen: gleicher Kontakt, Datum, Betrag', async () => {
  const db = await freshDb();
  const k = db.newKontakt({ name: 'K' }); await db.put('kontakt', k);
  const c = cat(db, 'einnahme').id;
  await db.put('buchung', buchung(db, k.id, c, 6500, 'b1'));
  assert.equal(db.findDuplicateBuchungen(buchung(db, k.id, c, 6500, 'neu')).length, 1);
  assert.equal(db.findDuplicateBuchungen(buchung(db, k.id, c, 6500, 'b1')).length, 0, 'sich selbst ignorieren');
  assert.equal(db.findDuplicateBuchungen(buchung(db, k.id, c, 7000, 'neu')).length, 0, 'anderer Betrag');
  assert.equal(db.findDuplicateBuchungen({ ...buchung(db, k.id, c, 6500, 'neu'), datum: '2026-11-02' }).length, 0, 'anderes Datum');
});
