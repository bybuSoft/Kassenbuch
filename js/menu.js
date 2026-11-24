// Navigationsseite (Startmenü): zwei Spalten, große Buttons für das Handy
import * as db from './db.js';
import { h } from './util.js';
import { startBackup, beenden } from './backup.js';
import { nav } from './nav.js';
import { offline } from './net.js';
import { migrationOffen } from './migration.js';

export function menuScreen() {
  const dot = db.hasUnsavedChanges() ? h('span', { class: 'dot', title: 'Ungesicherte Änderungen', 'aria-label': 'Ungesicherte Änderungen' }) : null;
  const btn = (label, onclick, extra, disabled = false) => h('button', { type: 'button', class: 'menu-btn', disabled, title: disabled ? 'Ohne Internet nicht möglich' : null, onclick }, label, extra);
  return {
    title: 'Menü', back: null,
    actions: [h('button', { class: 'btn', onclick: () => beenden() }, 'Beenden')],
    node: h('div', { class: 'stack' }, migrationOffen() ? h('div', { class: 'notice' }, 'Es gibt noch nicht übernommene alte Buchungen. ', h('button', { class: 'btn small', onclick: () => nav.go('einstellungen') }, 'Einstellungen → Buchungen migrieren')) : null,
      h('nav', { class: 'menu-grid', 'aria-label': 'Navigation' },
      btn('Buchung', () => nav.go('buchung')), btn('Kassenbuch', () => nav.go('kassenbuch')),
      btn('Kunden', () => nav.go('kunden')), btn('Lieferanten', () => nav.go('lieferanten')),
      btn('Auswertungen', () => nav.go('auswertungen')), btn('Datensicherung', () => startBackup(), dot, offline()),
      btn('Einstellungen', () => nav.go('einstellungen')), btn('Infos', () => nav.go('infos')))),
  };
}
