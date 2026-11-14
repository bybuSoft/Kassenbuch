// Einstellungen und Infos
import * as db from './db.js';
import { h, uuid, fmtDateTime } from './util.js';
import { confirmDlg, promptDlg, passwordDlg, showModal, field, checkField, toast, alertDlg } from './ui.js';
import { editKontakt } from './kontakte.js';
import { changePin } from './lock.js';
import { createTestData, removeTestData, hasTestData } from './testdata.js';
import { VERSION, CHANGES } from './version.js';
import { startBackup, startRestore, folderSupported, backupFolder, chooseBackupFolder, clearBackupFolder, pruneSettings } from './backup.js';
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

const removeTest = async () => {
  if (!(await confirmDlg('Alle Testdaten (als Test markierte Kunden, Lieferanten, Buchungen) entfernen?', { ok: 'Entfernen', danger: true }))) return;
  const n = await removeTestData(); toast(`Testdaten entfernt (${n} Kontakte)`); nav.refresh();
};

/** Freigeschaltet (Entwicklermodus): Testmodus, Erzeugen, Entfernen */
const testCard = (test) => h('div', { class: 'card stack' }, h('h3', {}, 'Testdaten (Entwicklermodus)'),
  checkField('Testdaten: neue Daten als Test markieren', h('input', { type: 'checkbox', checked: !!db.data.meta.testMode,
    onchange: async (e) => { await db.setMeta('testMode', e.target.checked); toast(e.target.checked ? 'Neue Daten werden als Test markiert' : 'Neue Daten werden normal gespeichert'); nav.refresh(); } })),
  db.data.meta.testMode ? h('p', { class: 'notice' }, 'Testmodus aktiv: Neue Kontakte und Buchungen sind als Test markiert und können mit „Testdaten entfernen“ gelöscht werden.') : null,
  h('p', { class: 'muted' }, 'Erzeugt 10 Kunden, 2 Lieferanten und Buchungen für jeden Fall (alle Kategorien, mit/ohne Text, eigene Firma, Dublette, Kunde ohne Buchungen).'),
  h('div', { class: 'presets' },
    h('button', { class: 'btn', disabled: test, onclick: async () => {
      if (!db.isEmpty() && !(await confirmDlg('Es sind bereits echte Daten vorhanden. Die Testdaten werden zusätzlich angelegt und sind als Test markiert. Vorher eine Datensicherung erstellen!\n\nTestdaten trotzdem erzeugen?', { title: 'Testdaten erzeugen', ok: 'Erzeugen' }))) return;
      const r = await createTestData(); toast(`Testdaten erzeugt: ${r.kunden} Kunden, ${r.lieferanten} Lieferanten, ${r.buchungen} Buchungen`); nav.refresh();
    } }, 'Testdaten erzeugen'),
    h('button', { class: 'btn danger', disabled: !test, onclick: removeTest }, 'Testdaten entfernen')),
  h('button', { class: 'btn', onclick: () => { db.devMode.unlocked = false; toast('Entwicklermodus beendet'); nav.refresh(); } }, 'Entwicklermodus beenden'));

// 7x auf den Titel „Einstellungen“ tippen schaltet den Entwicklermodus frei (bis zum Sperren/Beenden der App)
let taps = 0, lastTap = 0;
const titleTap = () => {
  const t = Date.now(); taps = t - lastTap < 1500 ? taps + 1 : 1; lastTap = t;
  if (taps >= 7) { taps = 0; if (!db.devMode.unlocked) { db.devMode.unlocked = true; toast('Entwicklermodus aktiv (bis zum Schliessen der App)'); nav.refresh(); } }
};

export function einstellungenScreen() {
  const test = hasTestData();
  const eig = db.eigene();
  return {
    title: 'Einstellungen', back: 'menu', actions: [], onTitleTap: titleTap,
    node: h('div', { class: 'stack' },
      h('div', { class: 'card stack' }, h('h3', {}, 'Eigene Firma'),
        h('p', {}, h('strong', {}, db.kontaktName(eig)), h('br'), [eig.strasse, [eig.plz, eig.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')),
        h('button', { class: 'btn', onclick: async () => { await editKontakt({ id: eig.id }); nav.refresh(); } }, 'Bearbeiten')),
      kategorieCard('Kundenkategorien', 'kundenkategorie'),
      kategorieCard('Buchungskategorien – Einnahmen', 'buchungskategorie', 'einnahme'),
      kategorieCard('Buchungskategorien – Ausgaben', 'buchungskategorie', 'ausgabe'),
      h('div', { class: 'card stack' }, h('h3', {}, 'Gerät'),
        field('Gerätename', h('input', { type: 'text', value: db.deviceName(), placeholder: 'z. B. iPhone-Marlene', autocomplete: 'off',
          onchange: async (e) => { await db.setMeta('deviceName', e.target.value.trim()); toast('Gerätename gespeichert'); } })),
        h('p', { class: 'muted' }, 'Wird Teil des Dateinamens der Datensicherung und beim Restore angezeigt. Er wird nicht in der Sicherung gespeichert.')),
      h('div', { class: 'card stack' }, h('h3', {}, 'Datensicherung'),
        h('p', { class: 'muted' }, `Letzte Änderung der Daten: ${fmtDateTime(db.data.meta.lastChange)}\nLetzte Datensicherung: ${fmtDateTime(db.data.meta.lastBackup)}`),
        folderSupported()
          ? h('div', { class: 'stack' }, h('p', {}, h('strong', {}, 'Standardordner: '), backupFolder() ? backupFolder().name : 'nicht festgelegt (Auswahl bei jeder Sicherung)'),
            h('div', { class: 'presets' },
              h('button', { class: 'btn', onclick: async () => { try { await chooseBackupFolder(); toast('Standardordner festgelegt'); nav.refresh(); } catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); } } }, 'Ordner wählen'),
              backupFolder() ? h('button', { class: 'btn', onclick: async () => { await clearBackupFolder(); nav.refresh(); } }, 'Ordner entfernen') : null),
            backupFolder() ? h('div', { class: 'stack' },
              checkField('Ältere Sicherungen im Ordner automatisch löschen', h('input', { type: 'checkbox', checked: pruneSettings().on, onchange: async (e) => {
                if (e.target.checked && !(await confirmDlg(`Nach jeder Sicherung in den Standardordner werden ältere Sicherungsdateien (.enc) im Ordner gelöscht, unabhängig vom Gerät. Es bleiben die jüngsten ${pruneSettings().keep}. Andere Dateien (z. B. Excel) bleiben unberührt.\n\nGelöschte Dateien lassen sich nicht wiederherstellen. Aktivieren?`, { title: 'Alte Sicherungen löschen', ok: 'Aktivieren', danger: true }))) { e.target.checked = false; return; }
                await db.setMeta('pruneOld', e.target.checked); nav.refresh();
              } })),
              pruneSettings().on ? field('Anzahl der jüngsten Sicherungen, die bleiben', h('input', { type: 'number', min: 1, max: 99, value: pruneSettings().keep, onchange: async (e) => { await db.setMeta('pruneKeep', Math.max(1, Math.round(Number(e.target.value) || 5))); nav.refresh(); } })) : null) : null)
          : h('p', { class: 'muted' }, 'Ein fester Standardordner kann auf iPhone/iPad nicht eingestellt werden (Einschränkung von Safari). Beim Sichern „In Dateien sichern“ wählen – iOS merkt sich meist den zuletzt benutzten Ordner. Auf Desktop-Chrome/Edge ist die Einstellung möglich.'),
        h('div', { class: 'presets' }, h('button', { class: 'btn', onclick: () => startBackup() }, 'Sicherung erstellen'), h('button', { class: 'btn', onclick: () => startRestore() }, 'Restore aus Datei'))),
      h('div', { class: 'card stack' }, h('h3', {}, 'PIN'),
        h('button', { class: 'btn', onclick: async () => {
          const o = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off' }), n = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off' });
          const ctl = showModal({ title: 'PIN ändern', body: [field('Aktuelle PIN', o), field('Neue PIN (4–12 Ziffern)', n)], buttons: [{ label: 'Abbrechen' }, { label: 'Ändern', cls: 'primary', onClick: async () => { await changePin(o.value, n.value); toast('PIN geändert'); } }] });
          await ctl.closed;
        } }, 'PIN ändern')),
      db.devMode.unlocked ? testCard(test) : null, // Testdaten nur im Entwicklermodus sichtbar
    ),
  };
}

export function infosScreen() {
  return {
    title: 'Infos', back: 'menu', actions: [],
    node: h('div', { class: 'stack' }, h('div', { class: 'card stack' }, h('h3', {}, `Kassenbuch Version ${VERSION}`),
      h('p', { class: 'muted' }, 'Die dritte Stelle der Versionsnummer ist der Branch-Code, die ersten beiden werden manuell vergeben.'),
      h('h4', {}, 'Versionsverlauf'),
      ...CHANGES.map((c) => h('p', {}, h('strong', {}, `v${c.v}`), ` – ${c.text}`)))),
  };
}
