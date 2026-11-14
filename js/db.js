// Datenhaltung: IndexedDB mit Write-Through-Cache im Speicher.
// Tabellen verknüpfen immer über IDs; referenzielle Integrität wird hier sichergestellt.
import { uuid, normalize, collator } from './util.js';

const DB_NAME = 'kassenbuch';
const DB_VERSION = 1;
export const STORES = ['kontakt', 'kommunikation', 'kundenkategorie', 'buchungskategorie', 'buchung'];
const ALL_STORES = [...STORES, 'meta'];

/** Entwicklermodus (Testdaten): nur im Arbeitsspeicher, gilt bis zum Sperren/Beenden/Schliessen der App. */
export const devMode = { unlocked: false };

/** Cache: je Tabelle eine Map id -> Objekt; meta ist ein einfaches Objekt key -> value */
export const data = {
  kontakt: new Map(), kommunikation: new Map(), kundenkategorie: new Map(),
  buchungskategorie: new Map(), buchung: new Map(), meta: {},
};

let idb = null;

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txP = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error || new Error('Transaktion abgebrochen'));
});

/** Schliesst die Datenbankverbindung (für Tests, damit die Datenbank neu angelegt werden kann). */
export function closeDb() { if (idb) { idb.close(); idb = null; } }

export async function init() {
  idb = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const s of ALL_STORES) r.result.createObjectStore(s, { keyPath: s === 'meta' ? 'key' : 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Datenbank blockiert (andere Instanz offen?)'));
  });
  await loadAll();
  await ensureSeed();
}

async function loadAll() {
  const tx = idb.transaction(ALL_STORES, 'readonly');
  const reqs = ALL_STORES.map((s) => reqP(tx.objectStore(s).getAll()));
  const res = await Promise.all(reqs);
  ALL_STORES.forEach((s, i) => {
    if (s === 'meta') { data.meta = {}; res[i].forEach((m) => { data.meta[m.key] = m.value; }); }
    else { data[s] = new Map(res[i].map((o) => [o.id, o])); }
  });
}

/** Mehrere Schreiboperationen atomar. ops: {op:'put'|'del', store, obj|id}. touch: lastChange setzen. */
export async function batch(ops, touch = true) {
  // Testmodus: neu angelegte Daten werden als Test markiert (lassen sich später entfernen)
  const isNew = (o) => o.op === 'put' && !data[o.store].has(o.obj.id) && !o.obj.sys && o.obj.test === undefined;
  const testKontakte = new Set([...data.kontakt.values()].filter((k) => k.test).map((k) => k.id));
  if (data.meta.testMode && devMode.unlocked) {
    // neue Kontakte und Buchungen werden als Test markiert
    for (const o of ops) {
      if ((o.store === 'kontakt' || o.store === 'buchung') && isNew(o)) { o.obj = { ...o.obj, test: true }; if (o.store === 'kontakt') testKontakte.add(o.obj.id); }
    }
  }
  // Kommunikation ist nur dann Test, wenn der zugehörige Kontakt ein Test-Kontakt ist (nie bei echten Kontakten)
  for (const o of ops) {
    if (o.store === 'kommunikation' && isNew(o) && testKontakte.has(o.obj.kontaktId)) o.obj = { ...o.obj, test: true };
  }
  const stores = new Set(ops.map((o) => o.store));
  if (touch) stores.add('meta');
  const tx = idb.transaction([...stores], 'readwrite');
  const done = txP(tx);
  const now = Date.now();
  for (const o of ops) {
    const os = tx.objectStore(o.store);
    if (o.op === 'put') os.put(o.obj); else os.delete(o.id);
  }
  if (touch) tx.objectStore('meta').put({ key: 'lastChange', value: now });
  await done;
  for (const o of ops) {
    if (o.store === 'meta') {
      if (o.op === 'put') data.meta[o.obj.key] = o.obj.value; else delete data.meta[o.id];
    } else if (o.op === 'put') data[o.store].set(o.obj.id, o.obj);
    else data[o.store].delete(o.id);
  }
  if (touch) data.meta.lastChange = now;
}

export const put = (store, obj, touch = true) => batch([{ op: 'put', store, obj }], touch);
export const del = (store, id, touch = true) => batch([{ op: 'del', store, id }], touch);
export const deviceName = () => data.meta.deviceName || '';
export const setMeta = (key, value, touch = false) => put('meta', { key, value }, touch);

// ---- Stammdaten / Seed --------------------------------------------------
export const DEFAULT_KUNDENKATEGORIEN = ['Maria', 'Michael', 'Externe'];
export const DEFAULT_EINNAHMEN = ['Podologie', 'Verkauf', 'Stiftung'];
export const DEFAULT_AUSGABEN = ['Waren/Material', 'Miete Lokal', 'Miete Parkplatz', 'Strom', 'Versicherungen', 'Telefon',
  'IT', 'Beiträge/Spenden', 'Treuhand/Beratung', 'Werbung', 'Verpflegung', 'Spesen'];

const blankKontakt = () => ({
  id: uuid(), istLieferant: false, geschlecht: '', anrede: '', vorname: '', name: '', name1: '', name2: '', geburtsdatum: '',
  strasse: '', plz: '', ort: '', kategorieId: null, diabetes: false, antikoaguliert: false, allergien: false,
  hiv: false, haemophilie: false, notizen: '', sys: null,
});
export const newKontakt = (over = {}) => ({ ...blankKontakt(), ...over });

async function ensureSeed() {
  const ops = [];
  if (!data.meta.seeded) {
    DEFAULT_KUNDENKATEGORIEN.forEach((name) => ops.push({ op: 'put', store: 'kundenkategorie', obj: { id: uuid(), name } }));
    DEFAULT_EINNAHMEN.forEach((name) => ops.push({ op: 'put', store: 'buchungskategorie', obj: { id: uuid(), name, art: 'einnahme' } }));
    DEFAULT_AUSGABEN.forEach((name) => ops.push({ op: 'put', store: 'buchungskategorie', obj: { id: uuid(), name, art: 'ausgabe' } }));
    ops.push({ op: 'put', store: 'meta', obj: { key: 'seeded', value: true } });
  }
  ops.push(...systemKontaktOps());
  if (ops.length) await batch(ops, false);
}

/** Systemkontakte: eigene Firma (änderbar, nicht löschbar) und Dummies für gelöschte Kontakte. */
function systemKontaktOps() {
  const have = new Set([...data.kontakt.values()].map((k) => k.sys).filter(Boolean));
  const ops = [];
  if (!have.has('eigene')) ops.push({ op: 'put', store: 'kontakt', obj: newKontakt({ sys: 'eigene', istLieferant: true, name1: 'Marlene Nebel Body & Care', strasse: 'Landstrasse 13', plz: '3904', ort: 'Naters' }) });
  if (!have.has('dummyKunde')) ops.push({ op: 'put', store: 'kontakt', obj: newKontakt({ sys: 'dummyKunde', name: 'Gelöschter Kunde' }) });
  if (!have.has('dummyLieferant')) ops.push({ op: 'put', store: 'kontakt', obj: newKontakt({ sys: 'dummyLieferant', istLieferant: true, name1: 'Gelöschter Lieferant' }) });
  return ops;
}

// ---- Abfragen -------------------------------------------------------------
export const kontaktName = (k) => (k ? (k.istLieferant ? [k.name1, k.name2] : [k.vorname, k.name]).filter(Boolean).join(' ').trim() : '');
export const sysKontakt = (sys) => [...data.kontakt.values()].find((k) => k.sys === sys);
export const eigene = () => sysKontakt('eigene');
export const isDummy = (k) => k && (k.sys === 'dummyKunde' || k.sys === 'dummyLieferant');
export const commsOf = (kontaktId) => [...data.kommunikation.values()].filter((c) => c.kontaktId === kontaktId);
export const kontaktSortKey = (k) => (k.istLieferant ? kontaktName(k) : `${k.name} ${k.vorname}`);
export const sortKontakte = (arr) => arr.sort((a, b) => collator.compare(kontaktSortKey(a), kontaktSortKey(b)));
export const kontakteList = (lieferant, includeSys = false) =>
  sortKontakte([...data.kontakt.values()].filter((k) => k.istLieferant === lieferant && (includeSys ? true : !isDummy(k))));
export const kategorienList = (store, art) =>
  [...data[store].values()].filter((c) => !art || c.art === art).sort((a, b) => collator.compare(a.name, b.name));
export const buchungenList = () =>
  [...data.buchung.values()].sort((a, b) => (a.datum === b.datum ? (b.created || 0) - (a.created || 0) : a.datum < b.datum ? 1 : -1));
/** Art einer Buchung (Einnahme/Ausgabe) ergibt sich aus der Buchungskategorie; Vorzeichen des Betrags (Gutschrift/Rückzahlung) ändert sie nicht. */
export const artOf = (b) => data.buchungskategorie.get(b.kategorieId)?.art || (b.betrag < 0 ? 'ausgabe' : 'einnahme');
export const artOfKontakt = (k) => (k.istLieferant ? 'ausgabe' : 'einnahme');

export function kategorieInUse(store, id) {
  if (store === 'kundenkategorie') return [...data.kontakt.values()].some((k) => k.kategorieId === id);
  return [...data.buchung.values()].some((b) => b.kategorieId === id);
}

/** Mögliche Dubletten: gleicher Name UND (gleiche PLZ ODER gemeinsame Telefonnummer). */
export function findDuplicates(k, comms) {
  const nm = normalize(kontaktName(k));
  if (!nm) return [];
  const digits = (s) => String(s).replace(/\D/g, '');
  const phones = new Set(comms.filter((c) => c.typ === 'tel').map((c) => digits(c.wert)).filter(Boolean));
  return [...data.kontakt.values()].filter((o) => {
    if (o.id === k.id || o.sys || o.istLieferant !== k.istLieferant) return false;
    if (normalize(kontaktName(o)) !== nm) return false;
    const samePlz = (o.plz || '').trim() === (k.plz || '').trim();
    const samePhone = commsOf(o.id).some((c) => c.typ === 'tel' && phones.has(digits(c.wert)));
    return samePlz || samePhone;
  });
}

export const buchungenOf = (kontaktId) => [...data.buchung.values()].filter((b) => b.kontaktId === kontaktId);

/** Kontakt löschen: Buchungen bleiben erhalten und werden dem Dummy-Kontakt zugeordnet. */
export async function deleteKontakt(id) {
  const k = data.kontakt.get(id);
  if (!k || k.sys) throw new Error('Dieser Kontakt kann nicht gelöscht werden.');
  const dummy = sysKontakt(k.istLieferant ? 'dummyLieferant' : 'dummyKunde');
  const ops = [];
  buchungenOf(id).forEach((b) => ops.push({ op: 'put', store: 'buchung', obj: { ...b, kontaktId: dummy.id } }));
  commsOf(id).forEach((c) => ops.push({ op: 'del', store: 'kommunikation', id: c.id }));
  ops.push({ op: 'del', store: 'kontakt', id });
  await batch(ops);
}

// ---- Snapshot / Restore ----------------------------------------------------
export function snapshot() {
  const stores = {};
  STORES.forEach((s) => { stores[s] = [...data[s].values()]; });
  return { app: 'kassenbuch', schema: 1, createdAt: Date.now(), lastChange: data.meta.lastChange || 0, stores };
}

export function validateSnapshot(snap) {
  if (!snap || snap.app !== 'kassenbuch' || !snap.stores) throw new Error('Das ist keine Kassenbuch-Datensicherung.');
  for (const s of STORES) if (!Array.isArray(snap.stores[s])) throw new Error(`Datensicherung unvollständig (${s}).`);
  const ids = (s) => new Set(snap.stores[s].map((o) => o.id));
  const kon = ids('kontakt'), kk = ids('kundenkategorie'), bk = ids('buchungskategorie');
  for (const b of snap.stores.buchung) if (!kon.has(b.kontaktId) || !bk.has(b.kategorieId)) throw new Error('Datensicherung inkonsistent (Buchung ohne Kontakt/Kategorie).');
  for (const c of snap.stores.kommunikation) if (!kon.has(c.kontaktId)) throw new Error('Datensicherung inkonsistent (Kommunikation ohne Kontakt).');
  for (const k of snap.stores.kontakt) if (k.kategorieId && !kk.has(k.kategorieId)) throw new Error('Datensicherung inkonsistent (Kundenkategorie).');
}

/** Ersetzt alle lokalen Daten durch die Sicherung (PIN bleibt lokal erhalten). */
export async function replaceAll(snap) {
  validateSnapshot(snap);
  const tx = idb.transaction([...STORES, 'meta'], 'readwrite');
  const done = txP(tx);
  for (const s of STORES) {
    const os = tx.objectStore(s);
    os.clear();
    snap.stores[s].forEach((o) => os.put(o));
  }
  const m = tx.objectStore('meta');
  m.put({ key: 'lastChange', value: snap.lastChange || 0 });
  m.put({ key: 'lastBackup', value: Date.now() });
  m.put({ key: 'seeded', value: true });
  await done;
  await loadAll();
  const ops = systemKontaktOps();
  if (ops.length) await batch(ops, false);
}

export const isEmpty = () => data.buchung.size === 0 && ![...data.kontakt.values()].some((k) => !k.sys);
export const hasUnsavedChanges = () => (data.meta.lastChange || 0) > (data.meta.lastBackup || 0);
