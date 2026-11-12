// Einstellungen und Infos
import * as db from './db.js';
import { h, uuid, fmtDateTime } from './util.js';
import { confirmDlg, promptDlg, passwordDlg, showModal, field, toast, alertDlg } from './ui.js';
import { editKontakt } from './kontakte.js';
import { changePin } from './lock.js';
import { createTestData, removeTestData, hasTestData } from './testdata.js';
import { VERSION, CHANGES } from './version.js';
import { startBackup, startRestore } from './backup.js';
import { nav } from './nav.js';

/** Liste der Kategorien mit Neu/Ändern/Löschen (nur wenn nirgends verwendet) */
function kategorieCard(title, store, art) {
  const rows = db.kategorienList(store, art).map((c) => {
    const used = db.kategorieInUse(store, c.id);
    return h('div', { class: 'catrow' }, h('span', {}, c.name, used ? h('span', { class: 'muted' }, ' · in Verwendung') : null),
      h('button', { class: 'btn small', onclick: async () => {
        const name = await promptDlg({ title: 'Kategorie umbenennen', label: 'Name', value: c.name, validate: (v) => (!v ? 'Bitte einen Namen eingeben.' : dupName(store, art, v, c.id) ? 'Diese Kategorie gibt es schon.' : null) });
        if (name) { await db.put(store, { ...c, name }); nav.refresh(); }
      } }, 'Ändern'),
      h('button', { class: 'btn small danger', onclick: async () => {
        if (db.kategorieInUse(store, c.id)) { await alertDlg(`„${c.name}“ wird verwendet und kann nicht gelöscht werden.`, { title: 'Löschen nicht möglich' }); return; }
        if (await confirmDlg(`Kategorie „${c.name}“ löschen?`, { ok: 'Löschen', danger: true })) { await db.del(store, c.id); nav.refresh(); }
      } }, 'Löschen'));
  });
  return h('div', { class: 'card stack' }, h('h3', {}, title), ...rows,
    h('button', { class: 'btn', onclick: async () => {
      const name = await promptDlg({ title: 'Neue Kategorie', label: 'Name', validate: (v) => (!v ? 'Bitte einen Namen eingeben.' : dupName(store, art, v) ? 'Diese Kategorie gibt es schon.' : null) });
      if (name) { await db.put(store, art ? { id: uuid(), name, art } : { id: uuid(), name }); nav.refresh(); }
    } }, '+ Neue Kategorie'));
}
const dupName = (store, art, name, exceptId) => db.kategorienList(store, art).some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());

export function einstellungenScreen() {
  const test = hasTestData();
  const eig = db.eigene();
  return {
    title: 'Einstellungen', back: 'kassenbuch', actions: [],
    node: h('div', { class: 'stack' },
      h('div', { class: 'card stack' }, h('h3', {}, 'Eigene Firma'),
        h('p', {}, h('strong', {}, db.kontaktName(eig)), h('br'), [eig.strasse, [eig.plz, eig.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')),
        h('button', { class: 'btn', onclick: async () => { await editKontakt({ id: eig.id }); nav.refresh(); } }, 'Bearbeiten')),
      kategorieCard('Kundenkategorien', 'kundenkategorie'),
      kategorieCard('Buchungskategorien – Einnahmen', 'buchungskategorie', 'einnahme'),
      kategorieCard('Buchungskategorien – Ausgaben', 'buchungskategorie', 'ausgabe'),
      h('div', { class: 'card stack' }, h('h3', {}, 'Datensicherung'),
        h('p', { class: 'muted' }, `Letzte Änderung der Daten: ${fmtDateTime(db.data.meta.lastChange)}\nLetzte Datensicherung: ${fmtDateTime(db.data.meta.lastBackup)}`),
        h('div', { class: 'presets' }, h('button', { class: 'btn', onclick: () => startBackup() }, 'Sicherung erstellen'), h('button', { class: 'btn', onclick: () => startRestore() }, 'Restore aus Datei'))),
      h('div', { class: 'card stack' }, h('h3', {}, 'PIN'),
        h('button', { class: 'btn', onclick: async () => {
          const o = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off' }), n = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off' });
          const ctl = showModal({ title: 'PIN ändern', body: [field('Aktuelle PIN', o), field('Neue PIN (4–12 Ziffern)', n)], buttons: [{ label: 'Abbrechen' }, { label: 'Ändern', cls: 'primary', onClick: async () => { await changePin(o.value, n.value); toast('PIN geändert'); } }] });
          await ctl.closed;
        } }, 'PIN ändern')),
      h('div', { class: 'card stack' }, h('h3', {}, 'Testdaten'),
        h('p', { class: 'muted' }, 'Erzeugt 10 Kunden, 2 Lieferanten und Buchungen für jeden Fall (alle Kategorien, mit/ohne Text, eigene Firma, Dublette, Kunde ohne Buchungen).'),
        h('div', { class: 'presets' },
          h('button', { class: 'btn', disabled: test, onclick: async () => {
            if (!db.isEmpty() && !(await confirmDlg('Es sind bereits echte Daten vorhanden. Die Testdaten werden zusätzlich angelegt und sind als Test markiert. Vorher eine Datensicherung erstellen!\n\nTestdaten trotzdem erzeugen?', { title: 'Testdaten erzeugen', ok: 'Erzeugen' }))) return;
            const r = await createTestData(); toast(`Testdaten erzeugt: ${r.kunden} Kunden, ${r.lieferanten} Lieferanten, ${r.buchungen} Buchungen`); nav.refresh();
          } }, 'Testdaten erzeugen'),
          h('button', { class: 'btn danger', disabled: !test, onclick: async () => {
            if (!(await confirmDlg('Alle Testdaten (Kunden, Lieferanten und deren Buchungen) entfernen?', { ok: 'Entfernen', danger: true }))) return;
            const n = await removeTestData(); toast(`${n} Testkontakte entfernt`); nav.refresh();
          } }, 'Testdaten entfernen'))),
    ),
  };
}

export function infosScreen() {
  return {
    title: 'Infos', back: 'kassenbuch', actions: [],
    node: h('div', { class: 'stack' }, h('div', { class: 'card stack' }, h('h3', {}, `Kassenbuch Version ${VERSION}`),
      h('p', { class: 'muted' }, 'Die dritte Stelle der Versionsnummer ist der Merge-Code, die ersten beiden werden manuell vergeben.'),
      h('h4', {}, 'Versionsverlauf'),
      ...CHANGES.map((c) => h('p', {}, h('strong', {}, `v${c.v}`), ` – ${c.text}`)))),
  };
}
