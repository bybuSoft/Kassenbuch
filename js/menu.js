// Navigationsseite (Startmenü): zwei Spalten, große Buttons für das Handy
import * as db from './db.js';
import { h } from './util.js';
import { startBackup, beenden } from './backup.js';
import { nav } from './nav.js';

export function menuScreen() {
  const dot = db.hasUnsavedChanges() ? h('span', { class: 'dot', title: 'Ungesicherte Änderungen', 'aria-label': 'Ungesicherte Änderungen' }) : null;
  const btn = (label, onclick, extra) => h('button', { type: 'button', class: 'menu-btn', onclick }, label, extra);
  return {
    title: 'Menü', back: null,
    actions: [h('button', { class: 'btn', onclick: () => beenden() }, 'Beenden')],
    node: h('nav', { class: 'menu-grid', 'aria-label': 'Navigation' },
      btn('Buchung', () => nav.go('buchung')), btn('Kassenbuch', () => nav.go('kassenbuch')),
      btn('Kunden', () => nav.go('kunden')), btn('Lieferanten', () => nav.go('lieferanten')),
      btn('Auswertungen', () => nav.go('auswertungen')), btn('Datensicherung', () => startBackup(), dot),
      btn('Einstellungen', () => nav.go('einstellungen')), btn('Infos', () => nav.go('infos'))),
  };
}
