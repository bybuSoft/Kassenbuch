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
        h('span', {}, b('Daten prüfen: '), 'Auf dem Willkommensscreen prüfst du, ob die Daten auf diesem Gerät aktuell sind (siehe Abschnitt 7). Mit „Überspringen“ (nach Warnung) lässt sich die Prüfung auslassen. Ist kein Internet verfügbar, erscheint sofort ein Hinweis und „Daten prüfen“ ist ausgegraut; „Überspringen“ bleibt möglich.'),
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
        'Kundennamen oder Vornamen eintippen und den Treffer antippen. Neu: „+ Neuer Kunde“. Betrag, Vorzeichen und Kategorie sind aus der letzten Buchung vorbelegt; Betrag direkt überschreiben, Kategorie wählen, bei Bedarf Text.',
        '„Speichern & neu“ für die nächste Behandlung des Tages; nach der letzten „Speichern“ und die Datensicherung bestätigen.',
        'Ausgaben: Lieferant statt Kunde wählen, Vorzeichen − (Ausgabe) und passende Kategorie.',
        'Kontrolle: Unter dem Formular stehen die zuletzt erfassten Buchungen (antippen = ändern). Am Tagesende im Kassenbuch die Tagessumme mit der Kasse abgleichen.',
        'Quittung: Bei Einnahmen über das Druck-Icon.',
      )),

    sec('3. Menü',
      h('p', {}, 'Das Menü zeigt grosse Buttons: Buchung, Kassenbuch, Kunden, Lieferanten, Auswertungen, Datensicherung, Einstellungen, Infos. Ein roter Punkt bei „Datensicherung“ bedeutet: Es gibt ungesicherte Änderungen. Mit „‹ Zurück“ gelangst du von jeder Seite zum Menü.')),

    sec('4. Buchung erfassen',
      ul(
        'Das Datum ist vorbelegt mit dem heutigen Tag. Nach der Kontaktwahl werden Vorzeichen, Betrag und Kategorie aus der letzten Buchung dieses Kontakts vorbelegt; der Betrag ist markiert und direkt überschreibbar.',
        'Vorzeichen: Kunde + = Einnahme, − = Rückzahlung; Lieferant − = Ausgabe, + = Gutschrift.',
        'Betrag 0 löst eine Warnung aus („Trotzdem speichern“ möglich); ein leeres oder ungültiges Betragsfeld wird abgelehnt.',
        '„Speichern & neu“ lässt das Formular für die nächste Buchung leer; „Speichern“ fragt nach einer Datensicherung und geht zum Menü.',
        'Zuletzt erfasste Buchungen stehen unter dem Formular (antippen = bearbeiten; bei Einnahmen mit Druck-Icon für die Quittung).',
      )),

    sec('5. Kassenbuch',
      ul(
        'Die Suche gilt für Name, Text, Kategorie und Betrag. Ein roter Punkt am Button „Filter“ zeigt einen aktiven Filter.',
        'Vorgabe ist „alles“: alle Zeiträume, Einnahmen und Ausgaben, alle Kategorien. Zeitraum, Art und Kategorie werden gespeichert (der Suchtext nicht).',
        'Eine Buchung antippen: bearbeiten oder löschen. Quittung: Druck-Icon neben dem Betrag (auf iPhone/iPad: Drucken → Als PDF sichern).',
      )),

    sec('6. Kunden und Lieferanten',
      ul(
        'Telefon und E-Mail: mehrere Einträge möglich, genau einer ist „bevorzugt“; ☎ und ✉ öffnen die Telefon- bzw. Mail-App.',
        'Der Button „Buchungen“ zeigt alle Buchungen des Kontakts und erlaubt die direkte Erfassung (siehe Abschnitt 2). Datum und Kategorie bleiben nach „Buchen“ stehen.',
        'Dublettenprüfung: Gleicher Name mit gleicher PLZ, Telefonnummer oder E-Mail-Adresse (oder ein Eintrag ohne weitere Daten) löst eine Warnung aus. Ebenso Buchungen mit gleichem Kontakt, Datum und Betrag.',
        'Drucken (im Kontakt): alle Felder und Buchungen auf einem Blatt, z. B. für Auskunftsbegehren nach Datenschutzrecht.',
        'Löschen: Die Buchungen bleiben erhalten und werden „Gelöschter Kunde“ bzw. „Gelöschter Lieferant“ zugeordnet.',
      )),

    sec('7. Datensicherung, Restore und „Daten prüfen“',
      ul(
        h('span', {}, b('Passwort: '), 'Die Sicherung ist verschlüsselt. Das Passwort wird nirgends gespeichert; ohne Passwort ist die Sicherung nicht lesbar. Bitte sicher aufbewahren.'),
        h('span', {}, b('Dateiname: '), 'JJJJMMTT-HHMMSS-Gerät-vVersion.enc. Der Gerätename wird in den Einstellungen festgelegt und steht nur im Dateinamen.'),
        h('span', {}, b('Speicherort: '), 'iPhone/iPad: Teilen-Dialog → „In Dateien sichern“ (z. B. iCloud Drive). Desktop (Chrome/Edge): Standardordner in den Einstellungen wählen; ältere Sicherungen können automatisch gelöscht werden.'),
        h('span', {}, b('Ohne Internet: '), 'Ist kein Internet verfügbar, sind „Daten prüfen“ sowie alle Sicherungs- und Restore-Buttons ausgegraut (Willkommensscreen, Menü, Einstellungen, Beenden, Rückfrage nach dem Speichern). Sie werden automatisch wieder aktiv, sobald eine Verbindung besteht.'),
        h('span', {}, b('Restore: '), 'Die lokalen Daten werden vollständig durch die Sicherung ersetzt, inklusive der Filtereinstellungen.'),
        h('span', {}, b('Filtereinstellungen: '), 'Die Filter im Kassenbuch, bei den Kunden und in den Auswertungen sind Teil der Sicherung und werden beim Restore wiederhergestellt.'),
        h('span', {}, b('Daten prüfen: '), 'Vergleicht die jüngste Sicherung (nur Dateiname) mit dem lokalen Stand. Grün = aktuell. Gelb = neuere Sicherung vorhanden (Restore empfohlen) oder ungesicherte lokale Änderungen (jetzt sichern). Rot = beides: Ein Restore würde die lokalen Änderungen überschreiben, daher zuerst sichern.'),
      )),

    sec('8. Auswertungen',
      ul(
        '„VJ-Vergleich“ zeigt zusätzlich die Vorjahreswerte und die Differenz.',
        'Kategorien: Eine Lieferantenzeile antippen zeigt die Aufteilung nach Buchungskategorie.',
        'Kundenliste: zuerst die Kundenkategorie wählen; „Drucken / PDF“ ist erst dann möglich.',
        'Treuhänder: immer ein ganzes Jahr (Vorgabe: Vorjahr), Ebene Einzelbuchung, Tag, Monat (Vorgabe) oder Jahr. Bei Monat steht der letzte Tag des Monats, bei Jahr der 31.12. Bei Kunden werden weder Name noch Buchungstext exportiert, bei Lieferanten der Name. Ein Hinweis erscheint, wenn eine Buchung nicht zum Kontakttyp passt.',
      )),

    sec('9. Einstellungen',
      ul(
        'Eigene Firma (erscheint auf Quittungen), Start (Menü oder Buchung nach „Daten prüfen“), Gerätename, Sicherungs-Optionen, PIN ändern.',
        'Kategorien: neu, ändern, löschen; Löschen nur, wenn sie nirgends verwendet werden.',
      )),

    sec('10. Notizen',
      ul(
        'Infos → „Notizen“: freie Notizen mit Titel, Text und bis zu 12 Bildern (verkleinert gespeichert). Notizen sind Teil der Datensicherung.',
        '„Senden“ öffnet die E-Mail-App mit der Adresse aus den Einstellungen. Bilder lassen sich dort nicht anhängen; dafür gibt es „Teilen mit Bildern“. E-Mail ist nicht verschlüsselt: keine sensiblen Kundendaten senden.',
      )),

    sec('11. Beenden',
      h('p', {}, 'Im Menü „Beenden“: bei ungesicherten Änderungen wird vorher eine Sicherung angeboten. Danach ist die App gesperrt. Eine Web-App kann sich nicht selbst schliessen: auf iPhone/iPad nach oben wischen.')),

    sec('12. Tipps',
      ul(
        'Regelmässig sichern, am besten nach jeder Erfassungsrunde.',
        'Mehrere Geräte: Auf dem Willkommensscreen zuerst „Daten prüfen“ und bei neuerer Sicherung ein Restore, dann weiterarbeiten.',
        'Ohne Netz funktioniert die App weiter. Updates werden beim nächsten Start mit Netz geladen (Version in der Fusszeile).',
      )),

    sec('13. Installieren (iPhone/iPad)',
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
