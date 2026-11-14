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
  const { rows, count, unstimmig } = treuhaenderRows('2026-11-01', '2026-11-30');
  assert.equal(count, 5);
  assert.equal(unstimmig, 1);
  const text = JSON.stringify(rows);
  assert.ok(!/Anna|Geheim/.test(text), 'kein Kundenname/-text im Export');
  const byLabel = (l) => rows.filter((r) => r[1] === l).length;
  assert.equal(byLabel('Ausgabe (Gutschrift)'), 1);
  assert.equal(byLabel('Einnahme (Rückzahlung)'), 1);
  assert.ok(text.includes('Podo Supply') && text.includes('Material'));
});
