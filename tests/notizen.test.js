import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './setup.js';
import { validMail } from '../js/notizen.js';

test('Notiz speichern, ändern, löschen und in der Sicherung mitführen', async () => {
  const db = await freshDb();
  const n = db.newNotiz({ titel: 'Idee', text: '• eins\n• zwei', bilder: ['data:image/jpeg;base64,AAAA'] });
  await db.put('notiz', n);
  assert.equal(db.notizenList().length, 1);
  const snap = JSON.parse(JSON.stringify(db.snapshot()));
  assert.equal(snap.stores.notiz.length, 1);
  assert.deepEqual(snap.stores.notiz[0].bilder, ['data:image/jpeg;base64,AAAA']);
  await db.del('notiz', n.id);
  assert.equal(db.notizenList().length, 0);
  await db.replaceAll(snap);
  assert.equal(db.data.notiz.get(n.id).text, '• eins\n• zwei');
});

test('Ältere Sicherung ohne Notizen lässt sich einspielen und entfernt lokale Notizen', async () => {
  const db = await freshDb();
  const old = JSON.parse(JSON.stringify(db.snapshot()));
  delete old.stores.notiz;
  await db.put('notiz', db.newNotiz({ text: 'x' }));
  await db.replaceAll(old);
  assert.equal(db.data.notiz.size, 0);
});

test('Notizen sortiert nach letzter Änderung', async () => {
  const db = await freshDb();
  await db.put('notiz', db.newNotiz({ id: 'a', text: 'a', modified: 1 }));
  await db.put('notiz', db.newNotiz({ id: 'b', text: 'b', modified: 2 }));
  assert.deepEqual(db.notizenList().map((n) => n.id), ['b', 'a']);
});

test('E-Mail-Prüfung', () => {
  assert.ok(validMail('a@b.ch'));
  assert.ok(!validMail('a@b'));
  assert.ok(!validMail('a b@c.ch'));
  assert.ok(!validMail('a@b.ch, c@d.ch'));
});
