// Dialog „Buchungen migrieren“: zeigt die Vorschläge für die neue Buchungsstruktur und übernimmt nur, was bestätigt wird.
import * as db from './db.js';
import { h, chf, fmtDate } from './util.js';
import { showModal, confirmDlg, toast } from './ui.js';
import { planMigration, kontrolle, applyMigration, migrierte, geaenderteMigrierte, uebernommen, verwerfeMigrierte } from './migration.js';
import { nav } from './nav.js';

const katName = (id) => db.data.buchungskategorie.get(id)?.name || '?';
const altText = (alt) => alt.map((a) => `${katName(a.kategorieId)} ${chf(a.betrag)}`).join(' + ');
const neuText = (ps) => ps.map((p) => `${katName(p.kategorieId)} ${chf(p.betrag)}${p.stiftung ? ' (Stiftung)' : ''}`).join(' + ');

/** Migrationsdialog. Wiederholbar: übernommen wird nur, was noch nicht übernommen ist; „Neu aufbauen“ verwirft die migrierten Buchungen. */
export async function openMigration() {
  const sel = new Set();     // bestätigte Vorschläge (key)
  let einfachOn = true;      // einfache 1:1-Übernahmen
  let nurAuffaellig = false;
  let plan = null;
  const body = h('div', { class: 'stack' });

  const load = () => {
    plan = planMigration();
    sel.clear();
    // Vorgabe: Vorschläge ohne Auffälligkeit sind vorgewählt; Auffälliges muss von Hand bestätigt werden
    plan.vorschlaege.filter((v) => !v.einfach && !v.hinweise.length).forEach((v) => sel.add(v.key));
  };
  const chosen = () => plan.vorschlaege.filter((v) => (v.einfach ? einfachOn : sel.has(v.key)));

  const render = () => {
    const einfach = plan.vorschlaege.filter((v) => v.einfach);
    const detail = plan.vorschlaege.filter((v) => !v.einfach).sort((a, b) => (b.hinweise.length ? 1 : 0) - (a.hinweise.length ? 1 : 0) || (a.datum < b.datum ? -1 : 1));
    const shown = nurAuffaellig ? detail.filter((v) => v.hinweise.length) : detail;
    const ch = chosen();
    const ko = kontrolle(ch);
    const done = uebernommen().size;
    const rows = shown.map((v) => {
      const k = db.data.kontakt.get(v.kontaktId);
      const cb = h('input', { type: 'checkbox', checked: sel.has(v.key), onchange: () => { if (cb.checked) sel.add(v.key); else sel.delete(v.key); render(); } });
      return h('label', { class: `mig-row${v.hinweise.length ? ' warn' : ''}` }, cb,
        h('div', {}, h('strong', {}, `${fmtDate(v.datum)} · ${db.kontaktListName(k)}${v.test ? ' (Test)' : ''}`),
          h('div', { class: 'muted small' }, `Alt (${v.quellen.length}): ${altText(v.alt)}`),
          h('div', { class: 'small' }, `Neu: ${neuText(v.positionen)}${v.text ? ` · ${v.text}` : ''}`),
          ...v.hinweise.map((t) => h('div', { class: 'small out' }, `⚠ ${t}`))));
    });
    body.replaceChildren(...[
      h('p', {}, `Alte Buchungen: ${db.data.buchung.size} · bereits übernommen: ${done} · offen: ${plan.offen}`),
      h('p', { class: 'muted small' }, `Neue Buchungen: ${db.data.buchung2.size} (davon migriert: ${migrierte().length}${geaenderteMigrierte() ? `, davon bearbeitet: ${geaenderteMigrierte()}` : ''}). Die alten Buchungen werden nie verändert; die Migration lässt sich wiederholen.`),
      plan.error ? h('p', { class: 'notice' }, plan.error) : null,
      !plan.offen ? h('p', { class: 'notice' }, 'Alle alten Buchungen sind übernommen. Mit „Neu aufbauen“ lässt sich die Migration bei Bedarf wiederholen.') : null,
      einfach.length ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: einfachOn, onchange: (e) => { einfachOn = e.target.checked; render(); } }),
        h('span', {}, `${einfach.length} einfache Buchungen 1:1 übernehmen (eine Kategorie, ohne Stiftung, nicht zusammengefasst)`)) : null,
      detail.length ? h('div', { class: 'stack' },
        h('h4', {}, `${detail.length} ${detail.length === 1 ? 'Vorschlag' : 'Vorschläge'} zur Bestätigung (zusammengefasst oder mit Stiftung)`),
        h('div', { class: 'presets' },
          h('button', { type: 'button', class: 'btn small', onclick: () => { detail.forEach((v) => sel.add(v.key)); render(); } }, 'Alle wählen'),
          h('button', { type: 'button', class: 'btn small', onclick: () => { sel.clear(); render(); } }, 'Keine'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: nurAuffaellig, onchange: (e) => { nurAuffaellig = e.target.checked; render(); } }), h('span', {}, 'nur Auffällige'))),
        h('div', { class: 'list miglist' }, ...(rows.length ? rows : [h('p', { class: 'muted pad' }, 'Keine Vorschläge.')]))) : null,
      ch.length ? h('div', { class: 'card stack' }, h('h4', {}, 'Kontrolle der Auswahl'),
        h('p', { class: 'small' }, `${ko.anzahlAlt} alte Buchungen → ${ko.anzahlNeu} neue Buchungen`),
        h('p', { class: 'small' }, `Alt: ${ko.alt.map(([n, v]) => `${n} ${chf(v)}`).join(' · ')}`),
        h('p', { class: 'small' }, `Neu: ${ko.neu.map(([n, v]) => `${n} ${chf(v)}`).join(' · ')}`),
        h('p', { class: `small ${ko.totalAlt === ko.totalNeu ? 'in' : 'out'}` }, `Total alt ${chf(ko.totalAlt)} · Total neu ${chf(ko.totalNeu)} ${ko.totalAlt === ko.totalNeu ? '✓' : '✗ Abweichung!'}`)) : null,
      h('div', { class: 'presets' },
        h('button', { type: 'button', class: 'btn primary', disabled: !ch.length || ko.totalAlt !== ko.totalNeu, onclick: apply }, `${ch.length} Buchung${ch.length === 1 ? '' : 'en'} übernehmen`),
        migrierte().length ? h('button', { type: 'button', class: 'btn danger', onclick: rebuild }, 'Neu aufbauen…') : null)].filter(Boolean));
  };

  async function apply() {
    const ch = chosen();
    if (db.hasUnsavedChanges() && !(await confirmDlg('Es gibt ungesicherte Änderungen. Bitte vor der Migration eine Datensicherung erstellen (Menü → Datensicherung).\n\nTrotzdem fortfahren?', { title: 'Datensicherung', ok: 'Trotzdem fortfahren', danger: true }))) return;
    const n = await applyMigration(ch);
    toast(`${n} Buchung${n === 1 ? '' : 'en'} übernommen`);
    load(); render(); nav.refresh();
  }
  async function rebuild() {
    const edited = geaenderteMigrierte();
    const msg = `Alle ${migrierte().length} migrierten Buchungen werden verworfen und können neu aus den alten Buchungen übernommen werden.${edited ? `\n\nAchtung: ${edited} davon wurden inzwischen bearbeitet; diese Änderungen gehen verloren.` : ''}\n\nVon Hand neu erfasste Buchungen bleiben erhalten. Vorher eine Datensicherung erstellen!`;
    if (!(await confirmDlg(msg, { title: 'Neu aufbauen', ok: 'Verwerfen', danger: true }))) return;
    const n = await verwerfeMigrierte();
    toast(`${n} migrierte Buchungen verworfen`);
    load(); render(); nav.refresh();
  }

  load(); render();
  await showModal({ title: 'Buchungen migrieren', wide: true, body, buttons: [{ label: 'Schliessen' }] }).closed;
  nav.refresh();
}
