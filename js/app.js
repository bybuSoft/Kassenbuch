// App-Start, Navigation, Sperre
import * as db from './db.js';
import { h, fmtDateTime } from './util.js';
import { nav } from './nav.js';
import { lockScreen } from './lock.js';
import { toast, confirmDlg } from './ui.js';
import { startRestore, startBackup, latestBackupInfo, compareWithLocal } from './backup.js';
import { kassenbuchScreen } from './kassenbuch.js';
import { buchungScreen } from './buchung.js';
import { menuScreen } from './menu.js';
import { hilfeScreen } from './hilfe.js';
import { kontakteScreen } from './kontakte.js';
import { auswertungenScreen } from './auswertungen.js';
import { einstellungenScreen, infosScreen } from './einstellungen.js';
import { VERSION } from './version.js';

const app = document.getElementById('app');
let current = { name: 'lock' };
let unlocked = false;
let hiddenAt = 0;
const LOCK_AFTER_MS = 5 * 60 * 1000;

let startCheck = null; // Ergebnis von „Daten prüfen“ (nur auf dem Willkommensscreen)

function startScreen() {
  const n = [...db.data.kontakt.values()].filter((k) => !k.sys).length;
  const empty = db.isEmpty();
  const lvl = startCheck?.level;
  // Beim Einstieg nur „Daten prüfen“. Danach: grün = aktuell, gelb = neuere Sicherung, rot = ungesicherte lokale Änderungen
  const weiterCls = { ok: 'ok', warn: 'warn', red: 'danger' }[lvl] ?? '';
  const restoreCls = lvl === 'red' || startCheck?.dirty ? 'danger' : lvl === 'warn' ? 'ok' : '';
  const showRestore = (lvl === 'warn' || lvl === 'red') && !startCheck.noBackup;
  return {
    title: 'Kassenbuch', back: null, actions: [],
    node: h('div', { class: 'card stack start' },
      h('h2', {}, 'Willkommen'),
      h('p', { class: 'muted pre' }, empty
        ? 'Auf diesem Gerät sind noch keine Daten vorhanden.\nPrüfe, ob eine Datensicherung vorhanden ist.'
        : `Lokale Daten: ${db.data.buchung.size} Buchungen, ${n} Kontakte\nLetzte Änderung: ${fmtDateTime(db.data.meta.lastChange)}\nLetzte Datensicherung: ${fmtDateTime(db.data.meta.lastBackup)}`),
      startCheck ? h('p', { class: `status ${lvl}` }, startCheck.text) : null,
      h('button', { class: `btn big ${startCheck ? '' : 'primary'}`, onclick: async () => {
        let info = await latestBackupInfo();
        if (!info) { if (!db.isEmpty()) return; info = { none: true }; } // Abbruch bei leerer App: ohne Restore starten möglich
        startCheck = compareWithLocal(info);
        nav.refresh();
      } }, startCheck ? 'Erneut prüfen' : 'Daten prüfen'),
      !startCheck ? h('button', { class: 'btn big danger', onclick: async () => {
        const ok = await confirmDlg('ACHTUNG: Ohne Prüfung weißt du nicht, ob eine neuere Datensicherung existiert oder ob lokale Änderungen noch nicht gesichert sind.\n\nWenn du auf einem veralteten Stand weiterarbeitest, können Daten verloren gehen oder doppelt erfasst werden.\n\nPrüfung wirklich überspringen?', { title: 'Prüfung überspringen', ok: 'Ja, überspringen', danger: true });
        if (ok) nav.go('buchung');
      } }, 'Überspringen') : null,
      startCheck ? h('button', { class: `btn big ${weiterCls}`, onclick: () => nav.go('buchung') }, lvl === 'none' ? 'Ohne Restore starten' : 'Weiter zur Buchung') : null,
      showRestore ? h('button', { class: `btn big ${restoreCls}`, onclick: () => startRestore() }, 'Datensicherung einspielen (Restore)') : null,
      startCheck?.dirty && !empty ? h('button', { class: 'btn big ok', onclick: async () => { if (await startBackup()) { startCheck = null; nav.refresh(); } } }, 'Jetzt sichern') : null),
  };
}

const screens = {
  start: startScreen,
  menu: menuScreen,
  buchung: buchungScreen,
  kassenbuch: kassenbuchScreen,
  kunden: () => kontakteScreen('kunde'),
  lieferanten: () => kontakteScreen('lieferant'),
  auswertungen: auswertungenScreen,
  einstellungen: einstellungenScreen,
  infos: infosScreen,
  hilfe: hilfeScreen,
};

function render() {
  if (!unlocked) { showLock(); return; }
  const s = screens[current.name](current.params);
  const top = h('header', { class: 'top' },
    s.back ? h('button', { class: 'btn', onclick: () => nav.go(s.back) }, '‹ Zurück') : null,
    h('h1', { onclick: s.onTitleTap }, s.title), h('div', { class: 'top-actions' }, ...s.actions));
  const scrollY = current.keepScroll ? window.scrollY : 0;
  app.replaceChildren(top, h('main', {}, s.node), h('footer', { class: 'foot muted' }, `Kassenbuch v${VERSION}`));
  document.documentElement.style.setProperty('--top-h', `${top.offsetHeight}px`);
  window.scrollTo(0, scrollY);
  current.keepScroll = false;
}

function showLock() {
  app.replaceChildren(h('main', { class: 'center lockpos' }, lockScreen(() => { unlocked = true; startCheck = null; nav.go('start'); })));
}

nav.go = (name, params) => { current = { name, params }; render(); };
nav.exit = () => {
  unlocked = false; db.devMode.unlocked = false;
  document.getElementById('modal-root').replaceChildren();
  document.body.classList.remove('modal-open');
  window.close(); // klappt nur, wenn der Browser es erlaubt (nicht in iOS-Web-Apps)
  app.replaceChildren(h('main', { class: 'center' }, h('div', { class: 'card stack' },
    h('h1', {}, 'Kassenbuch beendet'), h('p', { class: 'muted' }, 'Die App ist gesperrt und kann jetzt geschlossen werden (iPhone/iPad: nach oben wischen).'),
    h('button', { class: 'btn primary', onclick: () => render() }, 'Wieder öffnen'))));
};
nav.refresh = () => { current.keepScroll = true; render(); };

// Bildschirmtastatur (iOS überlagert die Seite): Platz unten schaffen und fokussiertes Feld sichtbar halten
const setKb = () => {
  const vv = window.visualViewport;
  if (!vv) return;
  document.documentElement.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
};
window.visualViewport?.addEventListener('resize', setKb);
window.visualViewport?.addEventListener('scroll', setKb);
document.addEventListener('focusin', (e) => {
  if (!e.target.matches?.('input:not([type=checkbox]):not([type=date]),textarea,select')) return;
  setTimeout(() => { setKb(); e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (unlocked && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) {
    unlocked = false; db.devMode.unlocked = false;
    document.getElementById('modal-root').replaceChildren();
    document.body.classList.remove('modal-open');
    render();
  }
});

window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast(e.reason?.message || 'Unerwarteter Fehler', 'err'); });

(async function boot() {
  try {
    if (!window.indexedDB) throw new Error('Dieser Browser unterstützt keine lokale Datenspeicherung (IndexedDB).');
    if (!crypto.subtle) throw new Error('Bitte die App über eine https://-Adresse öffnen (Verschlüsselung nicht verfügbar).');
    await db.init();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker:', e));
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    window.__kassenbuch = { db, nav, startBackup }; // für Tests/Debugging
    showLock();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('main', { class: 'center' }, h('div', { class: 'card' }, h('h1', {}, 'Fehler'), h('p', {}, e.message))));
  }
})();
