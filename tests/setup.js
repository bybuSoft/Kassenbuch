// Testumgebung ohne Browser: IndexedDB per fake-indexeddb, minimale window-Attrappe für ui.js
import 'fake-indexeddb/auto';

globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };

/** Setzt die Datenbank zurück und initialisiert sie (Seed: Kategorien, Systemkontakte) */
export async function freshDb() {
  const db = await import('../js/db.js');
  db.closeDb();
  await new Promise((res) => { const r = indexedDB.deleteDatabase('kassenbuch'); r.onsuccess = r.onerror = () => res(); });
  await db.init();
  db.devMode.unlocked = false;
  return db;
}
