import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBetrag, chf, normalize } from '../js/util.js';
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
