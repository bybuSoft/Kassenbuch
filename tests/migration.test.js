import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './setup.js';

const kat = (db, name) => [...db.data.buchungskategorie.values()].find((c) => c.name === name);

/** Datenbank mit der alten Struktur: Kategorie „Stiftung“ gibt es (wie in bestehenden Installationen) */
async function setup() {
  const db = await freshDb();
  const mig = await import('../js/migration.js');
  await db.put('buchungskategorie', { id: 'k-stift', name: 'Stiftung', art: 'einnahme' });
  const anna = db.newKontakt({ vorname: 'Anna', name: 'Meier' }); await db.put('kontakt', anna);
  const bea = db.newKontakt({ vorname: 'Bea', name: 'Keller' }); await db.put('kontakt', bea);
  const lief = db.newKontakt({ istLieferant: true, name1: 'Podo Supply' }); await db.put('kontakt', lief);
  let n = 0;
  const alt = (id, kontakt, katId, betrag, over = {}) => db.put('buchung', { id, datum: '2026-03-05', betrag, kontaktId: kontakt.id, kategorieId: katId, text: '', created: ++n, ...over });
  return { db, mig, anna, bea, lief, alt, pod: kat(db, 'Podologie').id, verk: kat(db, 'Verkauf').id, stift: 'k-stift', ausg: kat(db, 'Miete Lokal').id };
}

test('Stiftung-Regel: >91 → 91 Podologie + Rest Verkauf, =91 Podologie, <91 Verkauf, negativ Podologie; immer Stiftung', async () => {
  const { mig } = await setup();
  const s = (b) => mig.splitStiftung(b, 'P', 'V');
  assert.deepEqual(s(12000), [{ kategorieId: 'P', betrag: 9100, stiftung: true }, { kategorieId: 'V', betrag: 2900, stiftung: true }]);
  assert.deepEqual(s(9100), [{ kategorieId: 'P', betrag: 9100, stiftung: true }]);
  assert.deepEqual(s(6500), [{ kategorieId: 'V', betrag: 6500, stiftung: true }]);
  assert.deepEqual(s(-5000), [{ kategorieId: 'P', betrag: -5000, stiftung: true }]);
  assert.deepEqual(s(0), [{ kategorieId: 'P', betrag: 0, stiftung: true }]);
});

test('Plan: Kunde am selben Tag wird zusammengefasst, Stiftung aufgeteilt, bar bleibt bar', async () => {
  const { db, mig, anna, alt, pod, verk, stift } = await setup();
  await alt('a1', anna, stift, 12000, { text: 'Behandlung' });
  await alt('a2', anna, verk, 2500, { text: 'Creme' });
  await alt('a3', anna, verk, 500, { text: 'Creme' });
  const { vorschlaege, offen } = mig.planMigration();
  assert.equal(offen, 3);
  assert.equal(vorschlaege.length, 1);
  const v = vorschlaege[0];
  assert.deepEqual(v.quellen.sort(), ['a1', 'a2', 'a3']);
  assert.equal(v.text, 'Behandlung, Creme', 'gleiche Texte nur einmal');
  assert.equal(v.created, 1, 'frühester Erfassungszeitpunkt');
  assert.deepEqual(v.positionen, [
    { kategorieId: pod, betrag: 9100, stiftung: true },
    { kategorieId: verk, betrag: 3000, stiftung: false }, // 25 + 5 bar zusammengefasst
    { kategorieId: verk, betrag: 2900, stiftung: true },
  ]);
  assert.ok(v.hinweise.some((h) => /Verkauf: bar und via Stiftung/.test(h)), 'Bestätigung nötig: gleiche Kategorie bar und Stiftung');
  assert.equal(v.summe, 15000);
  assert.equal(db.data.buchung2.size, 0, 'planen schreibt nichts');
});

test('Plan: verschiedene Kunden/Tage/Testflag getrennt; Lieferanten 1:1; gelöschte Kontakte nicht zusammengefasst', async () => {
  const { db, mig, anna, bea, lief, alt, pod, ausg } = await setup();
  await alt('a1', anna, pod, 6500);
  await alt('a2', anna, pod, 6500, { datum: '2026-03-06' });
  await alt('a3', bea, pod, 6500);
  await alt('a4', anna, pod, 6500, { test: true });
  await alt('l1', lief, ausg, -9000); await alt('l2', lief, ausg, -1000);
  const dummy = db.sysKontakt('dummyKunde');
  await alt('d1', dummy, pod, 100); await alt('d2', dummy, pod, 200);
  const { vorschlaege } = mig.planMigration();
  assert.equal(vorschlaege.length, 8);
  assert.ok(vorschlaege.every((v) => v.quellen.length === 1));
  assert.equal(vorschlaege.filter((v) => v.einfach).length, 8, 'ohne Stiftung/Zusammenfassung: einfache 1:1-Übernahme');
  assert.ok(vorschlaege.find((v) => v.quellen[0] === 'a4').test);
});

test('Plan: Auffälligkeiten (negative Stiftung, mehrere Stiftung am Tag, Ausgabe-Kategorie bei Kunde)', async () => {
  const { mig, anna, bea, alt, stift, ausg } = await setup();
  await alt('n1', anna, stift, -5000);
  await alt('m1', bea, stift, 9100); await alt('m2', bea, stift, 3000);
  const { vorschlaege } = mig.planMigration();
  const byQ = (id) => vorschlaege.find((v) => v.quellen.includes(id));
  assert.ok(byQ('n1').hinweise.some((h) => /Negativer Stiftung/.test(h)));
  assert.ok(byQ('m1').hinweise.some((h) => /Mehrere Stiftung/.test(h)));
  assert.deepEqual(byQ('n1').positionen, [{ kategorieId: [...(await import('../js/db.js')).data.buchungskategorie.values()].find((c) => c.name === 'Podologie').id, betrag: -5000, stiftung: true }]);
  await alt('u1', anna, ausg, -100, { datum: '2026-04-01' });
  assert.ok(mig.planMigration().vorschlaege.find((v) => v.quellen.includes('u1')).hinweise.some((h) => /passt nicht/.test(h)));
});

test('Übernahme: Summen alt = neu, alte Buchungen unverändert, wiederholbar und idempotent', async () => {
  const { db, mig, anna, bea, alt, pod, verk, stift } = await setup();
  await alt('a1', anna, stift, 12000); await alt('a2', anna, pod, 6500);
  await alt('b1', bea, verk, 2490, { datum: '2026-03-07' });
  const before = JSON.stringify(db.altBuchungenList());
  const { vorschlaege } = mig.planMigration();
  const ko = mig.kontrolle(vorschlaege);
  assert.equal(ko.totalAlt, ko.totalNeu);
  assert.equal(ko.totalAlt, 12000 + 6500 + 2490);
  assert.equal(ko.anzahlAlt, 3); assert.equal(ko.anzahlNeu, 2);
  assert.equal(await mig.applyMigration(vorschlaege), 2);
  assert.equal(JSON.stringify(db.altBuchungenList()), before, 'alte Struktur bleibt unverändert');
  assert.equal(db.data.buchung2.size, 2);
  assert.equal(db.buchungenList().reduce((s, b) => s + db.posSum(b), 0), 12000 + 6500 + 2490);
  // nichts mehr offen; erneut planen ergibt keine Vorschläge, erneutes Übernehmen legt nichts doppelt an
  assert.equal(mig.planMigration().vorschlaege.length, 0);
  assert.equal(mig.migrationOffen(), false);
  assert.equal(await mig.applyMigration(mig.planMigration().vorschlaege), 0);
  // Neu aufbauen: migrierte verwerfen, von Hand erfasste bleiben
  await db.put('buchung2', { id: 'hand', datum: '2026-05-01', kontaktId: anna.id, text: '', created: 99, positionen: [{ kategorieId: pod, betrag: 100, stiftung: false }] });
  assert.equal(await mig.verwerfeMigrierte(), 2);
  assert.deepEqual([...db.data.buchung2.keys()], ['hand']);
  assert.equal(mig.planMigration().vorschlaege.length, 2, 'Vorschläge wieder da');
  assert.equal(mig.migrationOffen(), true);
});

test('Teilübernahme: unbestätigte Vorschläge bleiben offen', async () => {
  const { mig, anna, bea, alt, pod } = await setup();
  await alt('a1', anna, pod, 6500); await alt('b1', bea, pod, 6500);
  const { vorschlaege } = mig.planMigration();
  await mig.applyMigration([vorschlaege.find((v) => v.quellen.includes('a1'))]);
  const rest = mig.planMigration();
  assert.equal(rest.offen, 1);
  assert.deepEqual(rest.vorschlaege[0].quellen, ['b1']);
});

test('Bearbeitete migrierte Buchungen werden gezählt; Stiftung-Kategorie wird in der Erfassung nicht mehr angeboten', async () => {
  const { db, mig, anna, alt, pod } = await setup();
  await alt('a1', anna, pod, 6500);
  await mig.applyMigration(mig.planMigration().vorschlaege);
  const b = [...db.data.buchung2.values()][0];
  assert.equal(mig.geaenderteMigrierte(), 0);
  await db.put('buchung2', { ...b, geaendert: Date.now() });
  assert.equal(mig.geaenderteMigrierte(), 1);
  assert.ok(!db.erfassKategorien('einnahme').some((c) => c.name === 'Stiftung'));
  assert.ok(db.kategorienList('buchungskategorie', 'einnahme').some((c) => c.name === 'Stiftung'), 'Kategorie bleibt für die alten Buchungen bestehen');
  await alt('s1', anna, 'k-stift', 100, { datum: '2026-06-01' });
  assert.equal(db.kategorieInUse('buchungskategorie', 'k-stift'), true);
});

test('Sicherung: alter und neuer Stand gehen mit, ältere Sicherung ohne buchung2 ist einspielbar, Migration bleibt möglich', async () => {
  const { db, mig, anna, alt, pod } = await setup();
  await alt('a1', anna, pod, 6500);
  const old = structuredClone(db.snapshot()); delete old.stores.buchung2; old.schema = 1; // Sicherung aus der alten App
  await mig.applyMigration(mig.planMigration().vorschlaege);
  const neu = db.snapshot();
  assert.equal(neu.stores.buchung2.length, 1); assert.equal(neu.stores.buchung.length, 1);
  await db.replaceAll(old);
  assert.equal(db.data.buchung2.size, 0);
  assert.equal(mig.migrationOffen(), true, 'nach dem Einspielen einer alten Sicherung wieder offen');
  await db.replaceAll(neu);
  assert.equal(db.data.buchung2.size, 1);
  assert.equal(mig.migrationOffen(), false, 'Zustand ergibt sich aus den Daten und geht mit der Sicherung mit');
  const bad = structuredClone(neu); bad.stores.buchung2[0].positionen = [];
  assert.throws(() => db.validateSnapshot(bad), /inkonsistent/);
});

test('Kontakt löschen: auch alte Buchungen gehen an den Dummy (Migration bleibt konsistent)', async () => {
  const { db, anna, alt, pod } = await setup();
  await alt('a1', anna, pod, 6500);
  await db.put('buchung2', { id: 'n1', datum: '2026-05-01', kontaktId: anna.id, text: '', created: 1, positionen: [{ kategorieId: pod, betrag: 100, stiftung: false }] });
  await db.deleteKontakt(anna.id);
  const dummy = db.sysKontakt('dummyKunde').id;
  assert.equal(db.data.buchung.get('a1').kontaktId, dummy);
  assert.equal(db.data.buchung2.get('n1').kontaktId, dummy);
});

test('Auswertung je Position: Zeilen, Zahlungsart, Treuhänder-Export Bar/Stiftung je Monat', async () => {
  const { db, anna, pod, verk } = await setup();
  const { treuhaenderRows } = await import('../js/auswertungen.js');
  await db.put('buchung2', { id: 'x1', datum: '2026-03-05', kontaktId: anna.id, text: 'geheim', created: 1,
    positionen: [{ kategorieId: pod, betrag: 9100, stiftung: true }, { kategorieId: verk, betrag: 2900, stiftung: true }, { kategorieId: verk, betrag: 1000, stiftung: false }] });
  await db.put('buchung2', { id: 'x2', datum: '2026-03-20', kontaktId: anna.id, text: '', created: 2, positionen: [{ kategorieId: pod, betrag: 6500, stiftung: false }] });
  const z = db.zeilen(db.buchungenList());
  assert.equal(z.length, 4);
  assert.equal(z.filter((r) => r.stiftung).reduce((s, r) => s + r.betrag, 0), 12000);
  const { buchungen, count } = treuhaenderRows('2026-01-01', '2026-12-31', 'monat');
  assert.equal(count, 2, 'Anzahl zählt Buchungen');
  assert.deepEqual(buchungen[0].map((c) => c.s), ['Datum', 'Lieferant', 'Kundenkategorie', 'Buchungskategorie', 'Zahlungsart', 'Betrag CHF']);
  const rows = buchungen.slice(1).map((r) => [r[3], r[4], r[5].n]);
  assert.deepEqual(rows.sort(), [['Podologie', 'Bar', 65], ['Podologie', 'Stiftung', 91], ['Verkauf', 'Bar', 10], ['Verkauf', 'Stiftung', 29]]);
  assert.ok(!/geheim|Meier/.test(JSON.stringify(buchungen)));
});
