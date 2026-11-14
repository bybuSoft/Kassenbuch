// Benutzerhilfe (druckbar): Aufbau als Abschnitte, Ausdruck über den Druckbereich (iOS: Drucken → Als PDF sichern)
import { h } from './util.js';
import { printNode } from './ui.js';
import { VERSION } from './version.js';

const sec = (title, ...kids) => h('section', { class: 'help-sec' }, h('h3', {}, title), ...kids);
const ul = (...items) => h('ul', {}, ...items.map((i) => h('li', {}, i)));
const b = (t) => h('strong', {}, t);

/** Inhalt der Hilfe (wird am Bildschirm und für den Ausdruck verwendet) */
export function helpContent() {
  return h('div', { class: 'help report' },
    h('h2', {}, 'Kassenbuch – Benutzerhilfe'),
    h('p', { class: 'muted' }, `Version ${VERSION}`),

    sec('1. Erste Schritte',
      ul(
        h('span', {}, b('PIN: '), 'Beim ersten Start legst du eine PIN (4–12 Ziffern) fest. Die App sperrt sich nach 5 Minuten im Hintergrund und verlangt dann die PIN. Die PIN ist eine Sperre, keine Verschlüsselung der lokalen Daten.'),
        h('span', {}, b('Daten prüfen: '), 'Auf dem Willkommensscreen prüfst du, ob die Daten auf diesem Gerät aktuell sind (siehe Abschnitt 6). Mit „Überspringen“ (nach Warnung) lässt sich die Prüfung auslassen.'),
        h('span', {}, b('Installieren (iPhone/iPad): '), 'In Safari öffnen, Teilen → „Zum Home-Bildschirm“. So bleiben die Daten zuverlässig erhalten, und die App funktioniert auch ohne Netz.'),
      )),

    sec('2. Menü',
      h('p', {}, 'Das Menü zeigt grosse Buttons: Buchung, Kassenbuch, Kunden, Lieferanten, Auswertungen, Datensicherung, Einstellungen, Infos. Ein roter Punkt bei „Datensicherung“ bedeutet: es gibt ungesicherte Änderungen. Mit „‹ Zurück“ gelangst du von jeder Seite zum Menü.')),

    sec('3. Buchung erfassen',
      ul(
        h('span', {}, b('Datum: '), 'Vorgabe ist der heutige Tag, solange du es nicht änderst.'),
        h('span', {}, b('Kunde/Lieferant: '), 'Name oder Vorname eintippen, in der Trefferliste den Kontakt antippen. Gesucht wird nur in den Namen. Gibt es den Kontakt noch nicht: „+ Neuer Kunde“ bzw. „+ Neuer Lieferant“.'),
        h('span', {}, b('Betrag: '), 'Nach der Kontaktwahl werden Vorzeichen, Betrag und Kategorie aus der letzten Buchung dieses Kontakts vorbelegt. Der Betrag ist markiert und kann direkt überschrieben werden.'),
        h('span', {}, b('Vorzeichen + / −: '), 'Kunde: + ist eine Einnahme, − eine Rückzahlung. Lieferant: − ist eine Ausgabe, + eine Gutschrift. Ob Einnahme oder Ausgabe, ergibt sich aus dem Kontakt und der Kategorie.'),
        h('span', {}, b('Kategorie und Text: '), 'Die Kategorien passen zum Kontakt (Kunde: Einnahmen, Lieferant: Ausgaben). Der Buchungstext ist optional.'),
        h('span', {}, b('Buttons: '), '„Abbrechen“ verwirft die Eingabe und geht zum Menü. „Speichern & neu“ speichert und lässt das Formular für die nächste Buchung leer. „Speichern“ speichert, fragt nach einer Datensicherung und geht danach zum Menü.'),
        h('span', {}, b('Zuletzt erfasst: '), 'Unter dem Formular stehen die zuletzt erfassten Buchungen; antippen zum Bearbeiten.'),
      )),

    sec('4. Kassenbuch',
      ul(
        'Liste der Buchungen nach Datum, mit Summen für Einnahmen, Ausgaben und Saldo.',
        'Die Suche bleibt sichtbar (Name, Text, Kategorie, Betrag). Mit „Filter“ klappst du Periode (Monat, Vormonat, Jahr, Vorjahr, Alles oder Von/Bis), Art und Kategorie auf. Ein roter Punkt am Filter-Button zeigt einen aktiven Filter.',
        'Eine Buchung antippen: bearbeiten oder löschen. Bei positiven Einnahmen gibt es den Button „Quittung“ (Druckansicht; auf iPhone/iPad: Drucken → Als PDF sichern).',
      )),

    sec('5. Kunden und Lieferanten',
      ul(
        'Suche und Kategorie-Filter; „+ Neu“ legt einen Kontakt an, antippen öffnet ihn.',
        'Pro Kontakt: Adresse, Geschlecht/Firma, Anrede (Du/Sie), mehrere Telefonnummern/E-Mails (nur eine kann „bevorzugt“ sein), Kundenkategorie, Gesundheitsangaben und Notizen.',
        'Der Button „Buchungen“ zeigt alle Buchungen des Kontakts, neueste zuerst.',
        'Beim Speichern warnt die Dublettenprüfung vor gleichnamigen Kontakten mit gleicher PLZ oder gleicher Telefonnummer und listet alle Treffer.',
        'Löschen: Die Buchungen bleiben erhalten und werden „Gelöschter Kunde“ bzw. „Gelöschter Lieferant“ zugeordnet.',
      )),

    sec('6. Datensicherung, Restore und „Daten prüfen“',
      ul(
        h('span', {}, b('Sichern: '), 'Menü → Datensicherung. Die Datei ist mit einem Passwort verschlüsselt. Das Passwort wird nirgends gespeichert – ohne Passwort ist die Sicherung nicht lesbar. Bitte sicher aufbewahren. Die erste Sicherung nach dem Start verlangt das Passwort zweimal, danach einmal (mit Warnung bei Tippfehler).'),
        h('span', {}, b('Dateiname: '), 'JJJJMMTT-HHMMSS-Gerät-vVersion.enc. Den Gerätenamen legst du in den Einstellungen fest. Er steht nur im Dateinamen, nicht in der Sicherung.'),
        h('span', {}, b('Speicherort: '), 'iPhone/iPad: im Teilen-Dialog „In Dateien sichern“ (z. B. iCloud Drive). Desktop (Chrome/Edge): in den Einstellungen einen Standardordner wählen, dann wird dort direkt gespeichert. Optional werden ältere Sicherungen automatisch bis zur eingestellten Anzahl gelöscht (andere Dateien bleiben unberührt).'),
        h('span', {}, b('Restore: '), 'Auf dem Willkommensscreen oder in den Einstellungen. Du wählst eine Sicherung (mit Gerät und Datum), gibst das Passwort ein und bestätigst. Die lokalen Daten werden durch die Sicherung ersetzt.'),
        h('span', {}, b('Daten prüfen: '), 'Liest die Dateinamen der Sicherungen (Standardordner bzw. Dateiauswahl) und vergleicht die jüngste mit dem lokalen Stand. Grün = aktuell, weiter zur Buchung. Gelb = neuere Sicherung vorhanden (Restore empfohlen) oder ungesicherte lokale Änderungen (jetzt sichern). Rot = neuere Sicherung und ungesicherte Änderungen: ein Restore würde die lokalen Änderungen überschreiben, zuerst sichern.'),
      )),

    sec('7. Auswertungen',
      ul(
        'Reiter: Perioden, Kategorien, Kundenliste, Treuhänder. Reiter und Periode bleiben beim Scrollen oben stehen.',
        'Periode mit Von/Bis oder den Schnellwahlen (Monat, Vormonat, Jahr, Vorjahr). „VJ-Vergleich“ zeigt zusätzlich die Vorjahreswerte und die Differenz.',
        'Perioden: Einnahmen (Kunden) und Ausgaben (Lieferanten) nach Kategorie und nach Monat. Kategorien: Kunden nach Kundenkategorie, Lieferanten nach Lieferant.',
        'Kundenliste: Vorname, Name, Betrag nach Tag mit Total pro Monat; „Drucken / PDF“ oben rechts.',
        'Treuhänder: Excel-Datei mit Buchungen und Summen. Es werden keine Kundendaten exportiert – bei Kunden stehen weder Name noch Buchungstext in der Datei, bei Lieferanten beides. Ein Hinweis erscheint, wenn eine Buchung nicht zum Kontakttyp passt.',
      )),

    sec('8. Einstellungen',
      ul(
        'Eigene Firma: erscheint auf Quittungen und kann bei Ausgaben als Kontakt gewählt werden.',
        'Kategorien für Kunden, Einnahmen und Ausgaben: neu, ändern, löschen (löschen nur, wenn sie nirgends verwendet werden).',
        'Gerät: Gerätename für die Dateinamen der Sicherungen.',
        'Datensicherung: Sicherung erstellen, Restore, Standardordner (nur Desktop-Browser) und automatisches Löschen alter Sicherungen.',
        'PIN ändern.',
      )),

    sec('9. Beenden',
      h('p', {}, 'Im Menü „Beenden“: Sind alle Änderungen gesichert, bestätigst du mit OK. Gibt es ungesicherte Änderungen, kannst du vorher sichern. Danach ist die App gesperrt. Eine Web-App kann sich nicht selbst schliessen: auf iPhone/iPad nach oben wischen.')),

    sec('10. Tipps',
      ul(
        'Regelmässig sichern, am besten nach jeder Erfassungsrunde – das geht direkt nach „Speichern“.',
        'Mehrere Geräte: Auf dem Willkommensscreen „Daten prüfen“ zeigt, ob eine neuere Sicherung von einem anderen Gerät vorliegt. Immer zuerst Restore, dann weiterarbeiten.',
        'Ohne Netz funktioniert die App weiter. Updates werden beim nächsten Start mit Netz geladen (Version in der Fusszeile).',
      )));
}

export function hilfeScreen() {
  const content = helpContent();
  return {
    title: 'Hilfe', back: 'infos',
    actions: [h('button', { class: 'btn', onclick: () => printNode(helpContent()) }, 'Drucken / PDF')],
    node: h('div', { class: 'card' }, content),
  };
}
