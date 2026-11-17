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
        h('span', {}, b('Daten prüfen: '), 'Auf dem Willkommensscreen prüfst du, ob die Daten auf diesem Gerät aktuell sind (siehe Abschnitt 7). Mit „Überspringen“ (nach Warnung) lässt sich die Prüfung auslassen. Ist kein Internet verfügbar, erscheint ein Hinweis (die Prüfung kann dann unvollständig sein, z. B. bei Sicherungen in iCloud Drive); Prüfen und Überspringen bleiben trotzdem möglich.'),
      )),

    sec('2. Datenerfassung: Datenübernahme und tägliche Erfassung',
      h('p', {}, 'Es gibt zwei Erfassungswege. Sie unterscheiden sich, weil die Ausgangslage und die Arbeitsweise verschieden sind:'),
      ul(
        h('span', {}, b('Datenübernahme (Altdaten): '), 'Du gehst vom Kontakt aus. Bei bestehenden Kunden liegen die Unterlagen meist pro Kunde vor (Karteikarte, Liste). Wenn du zuerst den Kunden vollständig erfasst und danach alle seine Buchungen am Stück, musst du den Kontakt nur einmal wählen, die Vorbelegung (Betrag, Kategorie aus der jüngsten Buchung) spart Tipparbeit, und du kannst pro Kunde auf Vollständigkeit prüfen.'),
        h('span', {}, b('Tägliche Erfassung: '), 'Du gehst vom Tag aus. Im Alltag fallen die Behandlungen eines Tages in zeitlicher Reihenfolge an und kommen aus Tageskasse oder Terminliste. Über „Buchung“ erfasst du sie direkt mit dem Datum des Tages, Kunde für Kunde, ohne jedes Mal den Kontakt öffnen zu müssen. So bleibt nichts liegen, und Dubletten werden sofort erkannt.'),
      ),
      h('h4', {}, 'Vorgehen Datenübernahme'),
      ul(
        'Menü → „Kunden“ (bzw. „Lieferanten“) → „+ Neu“: Kontakt mit Name, Adresse, Anrede, Telefon/E-Mail und Kategorie erfassen. Mit „Speichern und neu“ folgt gleich der nächste Kontakt.',
        'Kontakt in der Liste antippen und auf „Buchungen“ tippen. Oben erscheint die Erfassungszeile für eine neue Buchung.',
        'Datum der ersten Altbuchung eintragen (tippen oder 📅). Das Datum bleibt nach „Buchen“ stehen, bei der nächsten Buchung änderst du es nur bei Bedarf.',
        'Betrag und Kategorie prüfen bzw. anpassen, optional Text. „Buchen“ speichert, der Dialog bleibt für die nächste Buchung dieses Kontakts offen.',
        'Alle Buchungen des Kontakts nacheinander erfassen, dann schliessen und den nächsten Kontakt öffnen. Die Liste „Buchungen“ zeigt zur Kontrolle alle Einträge, neueste zuerst.',
        'Warnungen bei Dubletten oder Betrag 0 genau lesen: nur „Trotzdem speichern“, wenn die Buchung wirklich doppelt bzw. gewollt ist.',
        'Zum Schluss Summen im Kassenbuch und unter Auswertungen mit den Altunterlagen vergleichen und eine Datensicherung erstellen.',
      ),
      h('h4', {}, 'Vorgehen Tageserfassung'),
      ul(
        'Menü → „Buchung“. Datum ist der heutige Tag (bei Nacherfassung ändern).',
        'Kunden-Namen oder Vornamen eintippen und den Treffer antippen. Neu: „+ Neuer Kunde“. Betrag, Vorzeichen und Kategorie sind aus der letzten Buchung vorbelegt; Betrag direkt überschreiben, Behandlung/Kategorie wählen, bei Bedarf Text.',
        '„Speichern & neu“ für die nächste Behandlung des Tages; nach der letzten „Speichern“ und die Sicherung bestätigen.',
        'Ausgaben: Lieferant statt Kunde wählen, Vorzeichen − (Ausgabe) und passende Kategorie.',
        'Kontrolle: Unter dem Formular stehen die zuletzt erfassten Buchungen (antippen = ändern). Am Tagesende im Kassenbuch die Tagessumme mit der Kasse abgleichen.',
        'Quittung: Bei Einnahmen über das Druck-Icon.',
      )),

    sec('3. Menü',
      h('p', {}, 'Das Menü zeigt grosse Buttons: Buchung, Kassenbuch, Kunden, Lieferanten, Auswertungen, Datensicherung, Einstellungen, Infos. Ein roter Punkt bei „Datensicherung“ bedeutet: es gibt ungesicherte Änderungen. Mit „‹ Zurück“ gelangst du von jeder Seite zum Menü.')),

    sec('4. Buchung erfassen',
      ul(
        h('span', {}, b('Datum: '), 'Vorgabe ist der heutige Tag, solange du es nicht änderst.'),
        h('span', {}, b('Kunde/Lieferant: '), 'Name oder Vorname eintippen, in der Trefferliste den Kontakt antippen. Gesucht wird nur in den Namen. Gibt es den Kontakt noch nicht: „+ Neuer Kunde“ bzw. „+ Neuer Lieferant“.'),
        h('span', {}, b('Betrag: '), 'Nach der Kontaktwahl werden Vorzeichen, Betrag und Kategorie aus der letzten Buchung dieses Kontakts vorbelegt. Der Betrag ist markiert und kann direkt überschrieben werden. Ein Betrag von 0 ist erlaubt, löst aber eine Warnung aus („Abbrechen“ oder „Trotzdem speichern“); ein leeres oder ungültiges Betragsfeld wird abgelehnt.'),
        h('span', {}, b('Vorzeichen + / −: '), 'Kunde: + ist eine Einnahme, − eine Rückzahlung. Lieferant: − ist eine Ausgabe, + eine Gutschrift. Ob Einnahme oder Ausgabe, ergibt sich aus dem Kontakt und der Kategorie.'),
        h('span', {}, b('Kategorie und Text: '), 'Die Kategorien passen zum Kontakt (Kunde: Einnahmen, Lieferant: Ausgaben). Der Buchungstext ist optional.'),
        h('span', {}, b('Buttons: '), '„Abbrechen“ verwirft die Eingabe und geht zum Menü. „Speichern & neu“ speichert und lässt das Formular für die nächste Buchung leer. „Speichern“ speichert, fragt nach einer Datensicherung und geht danach zum Menü.'),
        h('span', {}, b('Zuletzt erfasst: '), 'Unter dem Formular stehen die zuletzt erfassten Buchungen; antippen zum Bearbeiten, bei positiven Einnahmen mit Druck-Icon für die Quittung.'),
      )),

    sec('5. Kassenbuch',
      ul(
        'Liste der Buchungen nach Datum, mit Summen für Einnahmen, Ausgaben und Saldo.',
        'Die Suche bleibt sichtbar (Name, Text, Kategorie, Betrag). Mit „Filter“ klappst du Periode (Monat, Vormonat, Jahr, Vorjahr, Alles oder Von/Bis), Art und Kategorie auf. Ein roter Punkt am Filter-Button zeigt einen aktiven Filter.',
        'Eine Buchung antippen: bearbeiten oder löschen. Bei positiven Einnahmen gibt es in der Liste rechts neben dem Betrag das Druck-Icon für die Quittung (Druckansicht; auf iPhone/iPad: Drucken → Als PDF sichern).',
      )),

    sec('6. Kunden und Lieferanten',
      ul(
        'Suche und Kategorie-Filter; „+ Neu“ legt einen Kontakt an, antippen öffnet ihn. Die Liste zeigt pro Kontakt Name, Adresse, Kategorie, bevorzugte Kommunikation und den Erstellungszeitpunkt (bei älteren Kontakten leer).',
        'Pro Kontakt: Adresse, Geschlecht/Firma, Anrede (Du/Sie), mehrere Telefonnummern/E-Mails (je eine Zeile; per „+ Telefon“ bzw. „+ E-Mail“ hinzufügen, direkt im Feld ändern, mit × löschen; genau eine ist „bevorzugt“, das Icon öffnet die Telefon-/Mail-App), Kundenkategorie, Gesundheitsangaben und Notizen.',
        'Neue Kontakte: „Speichern und neu“ speichert und öffnet sofort ein leeres Formular vom gleichen Typ. Das Geburtsdatum lässt sich tippen (TT.MM.JJJJ) oder über 📅 im Kalender wählen.',
        'Dublettenprüfung beim Speichern: gleicher Name und gleiche PLZ, Telefonnummer oder E-Mail-Adresse zeigt eine Warnung (mit „Trotzdem speichern“); ebenso bei gleichem Namen, wenn einer der beiden Einträge sonst keine Daten (PLZ, Ort, Strasse, Telefon, E-Mail) hat. Dasselbe gilt für Buchungen mit gleichem Kontakt, Datum und Betrag.',
        'Drucken (Button im Kontakt): Blatt mit allen Feldern des Kunden/Lieferanten (leere mit «–») und allen zugehörigen Buchungen, z. B. für Auskunftsbegehren nach Datenschutzrecht (auf iPhone/iPad: Drucken → Als PDF sichern).',
        'Der Button „Buchungen“ zeigt alle Buchungen des Kontakts, neueste zuerst (bei Einnahmen mit Quittungs-Icon). Oben kannst du direkt eine neue Buchung erfassen: Das Datum lässt sich tippen (das ganze Datum ist markiert und direkt überschreibbar) oder über 📅 im Kalender wählen und bleibt nach „Buchen“ stehen; Betrag und Kategorie sind aus der jüngsten Buchung vorbelegt, der Buchungstext ist leer. „Buchen“ speichert, der Dialog bleibt offen.',
        'Neben Telefonnummern und E-Mail-Adressen öffnen ☎ und ✉ die Telefon- bzw. Mail-App.',
                'Löschen: Die Buchungen bleiben erhalten und werden „Gelöschter Kunde“ bzw. „Gelöschter Lieferant“ zugeordnet.',
      )),

    sec('7. Datensicherung, Restore und „Daten prüfen“',
      ul(
        h('span', {}, b('Sichern: '), 'Menü → Datensicherung. Die Datei ist mit einem Passwort verschlüsselt. Das Passwort wird nirgends gespeichert – ohne Passwort ist die Sicherung nicht lesbar. Bitte sicher aufbewahren. Die erste Sicherung nach dem Start verlangt das Passwort zweimal, danach einmal (mit Warnung bei Tippfehler).'),
        h('span', {}, b('Dateiname: '), 'JJJJMMTT-HHMMSS-Gerät-vVersion.enc. Den Gerätenamen legst du in den Einstellungen fest. Er steht nur im Dateinamen, nicht in der Sicherung.'),
        h('span', {}, b('Speicherort: '), 'iPhone/iPad: im Teilen-Dialog „In Dateien sichern“ (z. B. iCloud Drive). Desktop (Chrome/Edge): in den Einstellungen einen Standardordner wählen, dann wird dort direkt gespeichert. Optional werden ältere Sicherungen automatisch bis zur eingestellten Anzahl gelöscht (andere Dateien bleiben unberührt).'),
        h('span', {}, b('Restore: '), 'Auf dem Willkommensscreen oder in den Einstellungen. Du wählst eine Sicherung (mit Gerät und Datum), gibst das Passwort ein und bestätigst. Die lokalen Daten werden durch die Sicherung ersetzt.'),
        h('span', {}, b('Daten prüfen: '), 'Liest die Dateinamen der Sicherungen (Standardordner bzw. Dateiauswahl) und vergleicht die jüngste mit dem lokalen Stand. Grün = aktuell, weiter (zum Menü bzw. zur Buchung, je nach Einstellung „Start“). Gelb = neuere Sicherung vorhanden (Restore empfohlen) oder ungesicherte lokale Änderungen (jetzt sichern). Rot = neuere Sicherung und ungesicherte Änderungen: ein Restore würde die lokalen Änderungen überschreiben, zuerst sichern.'),
      )),

    sec('8. Auswertungen',
      ul(
        'Reiter: Perioden, Kategorien, Kundenliste, Treuhänder. Reiter und Periode bleiben beim Scrollen oben stehen.',
        'Periode mit Von/Bis oder den Schnellwahlen (Monat, Vormonat, Jahr, Vorjahr). „VJ-Vergleich“ zeigt zusätzlich die Vorjahreswerte und die Differenz.',
        'Perioden: Einnahmen (Kunden) und Ausgaben (Lieferanten) nach Kategorie und nach Monat. Kategorien: Kunden nach Kundenkategorie, Lieferanten nach Lieferant; eine Lieferantenzeile antippen zeigt die Aufteilung nach Buchungskategorie.',
        'Kundenliste: zuerst die Kundenkategorie wählen. Vorname, Name, Betrag nach Tag mit Total pro Monat, im Kopf Firmenname und -adresse sowie der Zeitpunkt, an dem die Liste erstellt wurde; „Drucken / PDF“ oben rechts (erst mit gewählter Kategorie).',
        'Treuhänder: Jahr wählen (Vorgabe: Vorjahr; es wird immer ein ganzes Jahr exportiert) und die Zusammenfassungsebene (Einzelbuchung, Tag, Monat – Vorgabe –, Jahr). Excel-Datei: Tab 1 mit Firma, Adresse, Zeitraum, Erzeugungszeitpunkt und Ebene; Tab 2 mit den Buchungen (Datum, Lieferant, Kundenkategorie, Buchungskategorie, Betrag), ohne Summen. Das Datum ist ein echtes Excel-Datum für den Import; bei der Ebene Monat steht der letzte Tag des Monats, bei Jahr der 31.12. Bei Kunden stehen weder Name noch Buchungstext in der Datei, bei Lieferanten der Name. Ein Hinweis erscheint, wenn eine Buchung nicht zum Kontakttyp passt.',
      )),

    sec('9. Einstellungen',
      ul(
        'Eigene Firma: erscheint auf Quittungen und kann bei Ausgaben als Kontakt gewählt werden.',
        'Start: Nach „Daten prüfen“ öffnet sich das Menü oder die Buchung.',
        'Gerät: Gerätename für die Dateinamen der Sicherungen.',
        'Datensicherung: Sicherung erstellen, Restore, Standardordner (nur Desktop-Browser) und automatisches Löschen alter Sicherungen.',
        'PIN ändern.',
        'Kategorien für Kunden, Einnahmen und Ausgaben (zuunterst): neu, ändern, löschen (löschen nur, wenn sie nirgends verwendet werden).',
      )),

    sec('9a. Notizen',
      ul(
        'Infos → „Notizen“ (neben „Hilfe“): freie Notizen mit Titel und Text. „• Punkt einfügen“ setzt einen Aufzählungspunkt; Enter in einer Punktzeile beginnt den nächsten Punkt, ein leerer Punkt beendet die Liste.',
        'Bilder/Screenshots: „Bild / Screenshot wählen“ (iPhone/iPad: Fotos, dort liegen auch Bildschirmfotos), „Bild aus Zwischenablage“ oder per Einfügen (Strg+V bzw. langes Tippen → Einfügen) ins Textfeld. Bilder werden verkleinert gespeichert (höchstens 12 pro Notiz); antippen vergrössert, × entfernt.',
        'Senden: Die Empfängeradresse steht in den Einstellungen unter „Notizen“. „Senden“ öffnet die E-Mail-App mit Adresse, Betreff und Text. Bilder lassen sich dort nicht anhängen: bei Notizen mit Bildern gibt es zusätzlich „Teilen mit Bildern“ (Mail wählen, Adresse selbst eintragen). E-Mail ist nicht verschlüsselt: keine sensiblen Kundendaten senden.',
        'Notizen sind Teil der Datensicherung (die Empfängeradresse nicht).',
      )),

    sec('10. Beenden',
      h('p', {}, 'Im Menü „Beenden“: Sind alle Änderungen gesichert, bestätigst du mit OK. Gibt es ungesicherte Änderungen, kannst du vorher sichern. Danach ist die App gesperrt. Eine Web-App kann sich nicht selbst schliessen: auf iPhone/iPad nach oben wischen.')),

    sec('11. Tipps',
      ul(
        'Regelmässig sichern, am besten nach jeder Erfassungsrunde – das geht direkt nach „Speichern“.',
        'Mehrere Geräte: Auf dem Willkommensscreen „Daten prüfen“ zeigt, ob eine neuere Sicherung von einem anderen Gerät vorliegt. Immer zuerst Restore, dann weiterarbeiten.',
        'Ohne Netz funktioniert die App weiter. Updates werden beim nächsten Start mit Netz geladen (Version in der Fusszeile).',
      )),

    sec('12. Installieren (iPhone/iPad)',
      h('p', {}, 'In Safari öffnen, Teilen → „Zum Home-Bildschirm“. So bleiben die Daten zuverlässig erhalten, und die App funktioniert auch ohne Netz.')),
  );
}

export function hilfeScreen() {
  const content = helpContent();
  return {
    title: 'Hilfe', back: 'infos',
    actions: [h('button', { class: 'btn', onclick: () => printNode(helpContent()) }, 'Drucken / PDF')],
    node: h('div', { class: 'card' }, content),
  };
}
