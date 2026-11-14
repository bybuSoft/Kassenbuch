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
