// Verschlüsselung: PBKDF2 (SHA-256) + AES-GCM über WebCrypto. Kein Passwort wird gespeichert.
const ITERATIONS = 250000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function requireSubtle() {
  if (!crypto.subtle) throw new Error('Verschlüsselung nicht verfügbar. Bitte die App über https:// öffnen.');
}

async function deriveKey(pass, salt, iterations) {
  requireSubtle();
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, ITERATIONS);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  return JSON.stringify({ format: 'kassenbuch-backup', v: 1, kdf: 'PBKDF2-SHA256', it: ITERATIONS, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) });
}

export async function decryptJson(text, pass) {
  let f;
  try { f = JSON.parse(text); } catch { throw new Error('Die Datei ist keine Kassenbuch-Datensicherung.'); }
  if (!f || f.format !== 'kassenbuch-backup' || f.v !== 1) throw new Error('Die Datei ist keine Kassenbuch-Datensicherung.');
  // Plausibilitätsprüfung der Kopfdaten (verhindert manipulierte Dateien mit extrem vielen Durchläufen)
  if (!Number.isInteger(f.it) || f.it < 10000 || f.it > 1000000 || typeof f.salt !== 'string' || typeof f.iv !== 'string' || typeof f.ct !== 'string') throw new Error('Die Datei ist keine gültige Kassenbuch-Datensicherung.');
  const key = await deriveKey(pass, fromB64(f.salt), f.it);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(f.iv) }, key, fromB64(f.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new Error('Falsches Passwort oder beschädigte Datei.');
  }
}

// ---- PIN (App-Sperre) ---------------------------------------------------------
export async function hashPin(pin, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  requireSubtle();
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, 256));
  return { salt: toB64(salt), hash: toB64(bits) };
}

export async function verifyPin(pin, stored) {
  const { hash } = await hashPin(pin, stored.salt);
  return hash === stored.hash;
}
