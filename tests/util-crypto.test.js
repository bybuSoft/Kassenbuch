import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBetrag, chf, normalize, parseDatum } from '../js/util.js';
import { encryptJson, decryptJson } from '../js/crypto.js';

test('parseBetrag: gültige und ungültige Eingaben', () => {
  assert.equal(parseBetrag('65'), 6500);
  assert.equal(parseBetrag('65.5'), 6550);
  assert.equal(parseBetrag('1’234,50'), 123450);
  assert.equal(parseBetrag("1'234.50"), 123450);
  assert.equal(parseBetrag('12.345'), null);
  assert.equal(parseBetrag('abc'), null);
  assert.equal(parseBetrag(''), null);
});

test('chf: kein „-0.00“', () => {
  assert.equal(chf(-0), chf(0));
  assert.ok(!chf(-0).startsWith('-'));
  assert.match(chf(123450), /1.234\.50$/);
});

test('normalize: Gross-/Kleinschreibung und Akzente', () => {
  assert.equal(normalize('  Müller-Écu '), 'muller-ecu');
});

test('Verschlüsselung: Roundtrip, falsches Passwort, manipulierte Kopfdaten', async () => {
  const obj = { a: 1, text: 'Grüezi' };
  const enc = await encryptJson(obj, 'geheim1');
  assert.deepEqual(await decryptJson(enc, 'geheim1'), obj);
  await assert.rejects(decryptJson(enc, 'falsch'), /Falsches Passwort/);
  const f = JSON.parse(enc);
  await assert.rejects(decryptJson(JSON.stringify({ ...f, it: 2_000_000_000 }), 'geheim1'), /gültige/);
  await assert.rejects(decryptJson(JSON.stringify({ ...f, it: 1 }), 'geheim1'), /gültige/);
  await assert.rejects(decryptJson('kein json', 'x'), /keine Kassenbuch/);
});

test('parseDatum: Eingabeformen und ungültige Jahre', () => {
  const ref = new Date(2026, 10, 15);
  const ok = { '15.11.2026': '2026-11-15', '1.3': '2026-03-01', '0503': '2026-03-05', '050326': '2026-03-05', '05032026': '2026-03-05', '7': '2026-11-07', ' 3 . 4 . 27': '2027-04-03' };
  for (const [i, o] of Object.entries(ok)) assert.equal(parseDatum(i, ref), o, i);
  for (const i of ['', '31.2.2026', '15.11.202', '15.11.2', '15.11.1800', 'abc', '1.2.3.4']) assert.equal(parseDatum(i, ref), '', i);
});
