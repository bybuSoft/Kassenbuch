// Migration der alten Buchungen (eine Kategorie je Buchung, Store „buchung“) in die neue Struktur (Store „buchung2“:
// eine Buchung mit mehreren Positionen {kategorieId, betrag, stiftung}).
//
// - Die alte Struktur wird NIE verändert: Die Migration liest nur und kann beliebig oft wiederholt werden.
// - Welche alten Buchungen schon übernommen sind, steht in den neuen Buchungen (`quellen` = IDs der alten Buchungen).
//   Der Zustand ergibt sich also aus den Daten selbst und geht mit Sicherung/Restore mit.
// - Es werden nur Vorschläge berechnet; übernommen wird, was die Benutzerin im Dialog bestätigt.
import * as db from './db.js';
import { uuid } from './util.js';

/** Stiftung-Pauschale für die Podologie in Rappen (CHF 91.00); der Rest einer Stiftung-Buchung geht auf Verkauf */
export const STIFTUNG_PODOLOGIE = 9100;

const findKat = (name) => [...db.data.buchungskategorie.values()].find((c) => c.art === 'einnahme' && c.name.trim().toLowerCase() === name.toLowerCase());

/** Verteilung einer alten Stiftung-Buchung auf Positionen (alle mit stiftung = true):
 *  > 91.00: 91.00 Podologie + Rest Verkauf · < 91.00 (positiv): alles Verkauf · genau 91.00, 0 oder negativ: Podologie */
export function splitStiftung(betrag, podId, verkId) {
  if (betrag > STIFTUNG_PODOLOGIE) return [{ kategorieId: podId, betrag: STIFTUNG_PODOLOGIE, stiftung: true }, { kategorieId: verkId, betrag: betrag - STIFTUNG_PODOLOGIE, stiftung: true }];
  if (betrag > 0 && betrag < STIFTUNG_PODOLOGIE) return [{ kategorieId: verkId, betrag, stiftung: true }];
  return [{ kategorieId: podId, betrag, stiftung: true }];
}

/** IDs der alten Buchungen, die schon in einer neuen Buchung übernommen sind */
export const uebernommen = () => new Set([...db.data.buchung2.values()].flatMap((b) => b.quellen || []));
/** Alte Buchungen, die noch nicht übernommen sind */
export const offeneAlt = () => { const u = uebernommen(); return [...db.data.buchung.values()].filter((b) => !u.has(b.id)); };
/** Es gibt alte Buchungen, die noch nicht übernommen sind */
export const migrationOffen = () => db.data.buchung.size > 0 && offeneAlt().length > 0;
/** Bereits migrierte Buchungen (neue Struktur) */
export const migrierte = () => [...db.data.buchung2.values()].filter((b) => b.migriert);

/**
 * Berechnet die Vorschläge für alle noch nicht übernommenen alten Buchungen. Schreibt nichts.
 * Zusammengefasst werden Buchungen EINES KUNDEN am SELBEN TAG (und mit gleichem Testflag); Lieferanten und gelöschte Kontakte 1:1.
 * @returns {{error?: string, offen: number, vorschlaege: Array}}
 */
export function planMigration() {
  const offen = offeneAlt();
  if (!offen.length) return { offen: 0, vorschlaege: [] };
  const pod = findKat('Podologie'), verk = findKat('Verkauf'), stift = findKat('Stiftung');
  if (stift && offen.some((b) => b.kategorieId === stift.id) && (!pod || !verk)) {
    return { offen: offen.length, vorschlaege: [], error: 'Für die Migration von Stiftung-Buchungen müssen die Einnahme-Kategorien „Podologie“ und „Verkauf“ existieren.' };
  }
  const groups = new Map();
  for (const b of offen.sort((x, y) => (x.created || 0) - (y.created || 0))) {
    const k = db.data.kontakt.get(b.kontaktId);
    const merge = k && !k.istLieferant && !db.isDummy(k);
    const key = merge ? `${b.kontaktId}|${b.datum}|${b.test ? 1 : 0}` : `einzel|${b.id}`;
    (groups.get(key) || groups.set(key, []).get(key)).push(b);
  }
  const vorschlaege = [];
  for (const arr of groups.values()) {
    const first = arr[0];
    const k = db.data.kontakt.get(first.kontaktId);
    const hinweise = [];
    const merged = new Map();
    let stiftCount = 0;
    for (const b of arr) {
      let ps;
      if (stift && b.kategorieId === stift.id) {
        stiftCount++;
        ps = splitStiftung(b.betrag, pod.id, verk.id);
        if (b.betrag < 0) hinweise.push('Negativer Stiftung-Betrag: auf Podologie gebucht');
        if (b.betrag === 0) hinweise.push('Stiftung-Betrag 0');
      } else {
        ps = [{ kategorieId: b.kategorieId, betrag: b.betrag, stiftung: false }];
        const art = db.data.buchungskategorie.get(b.kategorieId)?.art;
        if (k && art && art !== db.artOfKontakt(k)) hinweise.push('Kategorie passt nicht zum Kontakttyp');
      }
      for (const p of ps) {
        const mk = `${p.kategorieId}|${p.stiftung ? 1 : 0}`;
        const o = merged.get(mk);
        if (o) o.betrag += p.betrag; else merged.set(mk, { ...p });
      }
    }
    if (stiftCount > 1) hinweise.push('Mehrere Stiftung-Buchungen am selben Tag');
    // gleiche Kategorie sowohl bar als auch via Stiftung (zwei Positionen in derselben Kategorie): Hinweis zur Bestätigung
    const perKat = new Map();
    for (const p of merged.values()) (perKat.get(p.kategorieId) || perKat.set(p.kategorieId, []).get(p.kategorieId)).push(p);
    for (const ps of perKat.values()) if (ps.length > 1) { hinweise.push(`${db.data.buchungskategorie.get(ps[0].kategorieId)?.name || '?'}: bar und via Stiftung am selben Tag`); break; }
    // Reihenfolge: Podologie, Verkauf, übrige; bar vor Stiftung
    const rank = (p) => (pod && p.kategorieId === pod.id ? 0 : verk && p.kategorieId === verk.id ? 1 : 2);
    const positionen = [...merged.values()].sort((a, b) => rank(a) - rank(b) || (a.stiftung ? 1 : 0) - (b.stiftung ? 1 : 0));
    const texte = [...new Set(arr.map((b) => (b.text || '').trim()).filter(Boolean))];
    const alt = arr.map((b) => ({ id: b.id, kategorieId: b.kategorieId, betrag: b.betrag }));
    const summeAlt = alt.reduce((s, a) => s + a.betrag, 0), summeNeu = positionen.reduce((s, p) => s + p.betrag, 0);
    if (summeAlt !== summeNeu) throw new Error(`Interner Fehler: Summe stimmt nicht (${summeAlt} ≠ ${summeNeu})`);
    vorschlaege.push({
      key: arr.map((b) => b.id).join(','), kontaktId: first.kontaktId, datum: first.datum, test: !!first.test,
      quellen: arr.map((b) => b.id), alt, text: texte.join(', '), created: Math.min(...arr.map((b) => b.created || 0)) || Date.now(),
      positionen, hinweise: [...new Set(hinweise)], summe: summeNeu,
      einfach: arr.length === 1 && stiftCount === 0 && !hinweise.length,
    });
  }
  vorschlaege.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0) || a.created - b.created);
  return { offen: offen.length, vorschlaege };
}

/** Kontrollsummen alt/neu je Kategorie (neu: bar und Stiftung getrennt) für eine Auswahl von Vorschlägen */
export function kontrolle(vorschlaege) {
  const nm = (id) => db.data.buchungskategorie.get(id)?.name || '?';
  const alt = new Map(), neu = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const v of vorschlaege) {
    v.alt.forEach((a) => add(alt, nm(a.kategorieId), a.betrag));
    v.positionen.forEach((p) => add(neu, `${nm(p.kategorieId)}${p.stiftung ? ' (Stiftung)' : ''}`, p.betrag));
  }
  const total = (m) => [...m.values()].reduce((s, x) => s + x, 0);
  return { alt: [...alt].sort(), neu: [...neu].sort(), totalAlt: total(alt), totalNeu: total(neu), anzahlAlt: vorschlaege.reduce((s, v) => s + v.quellen.length, 0), anzahlNeu: vorschlaege.length };
}

/** Übernimmt die bestätigten Vorschläge als neue Buchungen (eine Transaktion; die alten Buchungen bleiben unberührt). */
export async function applyMigration(vorschlaege) {
  const ops = vorschlaege.map((v) => ({
    op: 'put', store: 'buchung2',
    obj: { id: uuid(), datum: v.datum, kontaktId: v.kontaktId, text: v.text, created: v.created, positionen: v.positionen.map((p) => ({ ...p })), migriert: true, quellen: [...v.quellen], test: v.test },
  }));
  if (ops.length) await db.batch(ops);
  return ops.length;
}

/** Anzahl migrierter Buchungen, die inzwischen von Hand bearbeitet wurden (würden beim Neuaufbau verloren gehen) */
export const geaenderteMigrierte = () => migrierte().filter((b) => b.geaendert).length;

/** „Neu aufbauen“: verwirft alle migrierten Buchungen (von Hand erfasste bleiben); danach liefert planMigration() wieder alle Vorschläge. */
export async function verwerfeMigrierte() {
  const ops = migrierte().map((b) => ({ op: 'del', store: 'buchung2', id: b.id }));
  if (ops.length) await db.batch(ops);
  return ops.length;
}
