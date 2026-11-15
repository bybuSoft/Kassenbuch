import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './setup.js';

const cat = (db, art) => [...db.data.buchungskategorie.values()].find((c) => c.art === art);

test('Treuhänder-Export: Namen/Texte nur bei Lieferanten, nie bei Kunden – auch bei unstimmiger Kategorie', async () => {
  const db = await freshDb();
  const { treuhaenderRows } = await import('../js/auswertungen.js');
  const kunde = db.newKontakt({ vorname: 'Anna', name: 'Geheim' }); await db.put('kontakt', kunde);
  const lief = db.newKontakt({ istLieferant: true, name1: 'Podo Supply' }); await db.put('kontakt', lief);
  const mk = (id, kontaktId, kat, betrag, text) => db.put('buchung', { id, datum: '2026-11-05', betrag, kontaktId, kategorieId: kat.id, text, created: 1 });
  await mk('b1', kunde.id, cat(db, 'einnahme'), 6500, 'Fusspflege Anna');
  await mk('b2', lief.id, cat(db, 'ausgabe'), -31240, 'Material');
  await mk('b3', lief.id, cat(db, 'ausgabe'), 1000, 'Gutschrift');
  await mk('b4', kunde.id, cat(db, 'einnahme'), -2000, 'Rückzahlung Anna');
  await mk('b5', kunde.id, cat(db, 'ausgabe'), -500, 'Unstimmig Anna');            // Kunde auf Ausgabe-Kategorie
  const { firma, buchungen, count, unstimmig } = treuhaenderRows('2026-11-01', '2026-11-30', 'einzel');
  assert.equal(count, 5);
  assert.equal(unstimmig, 1);
  assert.equal(buchungen.length, 6);
  const text = JSON.stringify([firma, buchungen]);
  assert.ok(!/Anna|Geheim/.test(text), 'kein Kundenname/-text im Export');
  assert.ok(text.includes('Podo Supply') && !text.includes('Gutschrift'), 'Lieferantenname ja, Buchungstext nein');
  assert.ok(text.includes('Einzelbuchung'));
  // Monat: zusammengefasst, Kunden ohne Namen, keine Summenzeilen
  const m = treuhaenderRows('2026-11-01', '2026-11-30', 'monat').buchungen;
  assert.equal(m[1][0], '11.2026');
  assert.ok(m.slice(1).every((r) => r[1] === '' || r[1] === 'Podo Supply'));
  const podo = m.slice(1).filter((r) => r[1] === 'Podo Supply');
  assert.equal(podo.length, 1); assert.equal(podo[0][4].n, -302.4);
  assert.equal(treuhaenderRows('2026-11-01', '2026-11-30', 'jahr').buchungen[1][0], '2026');
});

test('Treuhänder-Export: Zusammenfassung nach Tag fasst gleiche Kategorien zusammen, ohne Summenzeilen', async () => {
  const db = await freshDb();
  const { treuhaenderRows } = await import('../js/auswertungen.js');
  const kunde = db.newKontakt({ name: 'Muster' }); await db.put('kontakt', kunde);
  const c = cat(db, 'einnahme');
  for (const [id, d, b] of [['x1', '2026-03-05', 1000], ['x2', '2026-03-05', 2500], ['x3', '2026-03-06', 500]])
    await db.put('buchung', { id, datum: d, betrag: b, kontaktId: kunde.id, kategorieId: c.id, text: 't', created: 1 });
  const rows = treuhaenderRows('2026-01-01', '2026-12-31', 'tag').buchungen;
  assert.equal(rows.length, 3); // Kopf + 2 Tage
  assert.equal(rows[1][4].n, 35);
  assert.ok(!/Muster/.test(JSON.stringify(rows)));
});
