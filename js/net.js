// Verbindungsstatus: echter Test (navigator.onLine ist unzuverlässig). Der Service Worker fällt bei ?ping nicht auf den Cache zurück.
import { nav } from './nav.js';

export let netOk = null; // null = noch nicht geprüft
let netAt = 0;

/** true = offline (nur wenn sicher festgestellt) */
export const offline = () => netOk === false;

export async function probeNet(force = false) {
  if (!force && Date.now() - netAt < 10000) return netOk;
  netAt = Date.now();
  let ok = navigator.onLine;
  if (ok) {
    try { const r = await fetch(`sw.js?ping=${Date.now()}`, { cache: 'no-store' }); ok = r.ok; } catch { ok = false; }
  }
  const changed = ok !== netOk;
  netOk = ok;
  if (changed) nav.refresh(); // Screens zeichnen Sicherungs-Buttons je nach Status (ausgegraut/aktiv)
  return ok;
}

export function watchNet() {
  for (const ev of ['online', 'offline']) window.addEventListener(ev, () => probeNet(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) probeNet(true); });
  probeNet(true);
}
