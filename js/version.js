// Versionsnummer: MAJOR.MINOR werden manuell vergeben, die dritte Stelle ist der Branch-Code
// (die Zeichen nach dem letzten "-" im Branch-Namen, z. B. claude/festive-cray-4a3xvr -> 4a3xvr).
// BRANCH_CODE wird beim Commit automatisch gesetzt (tools/set-version.sh, Hook in .githooks/).
export const MAJOR = 0;
export const MINOR = 22;
export const BRANCH_CODE = 'uc7ksu';
export const VERSION = `${MAJOR}.${MINOR}.${BRANCH_CODE}`;

// Kurze Beschreibung je Änderung (neueste zuerst)
export const CHANGES = [
  { v: '0.22', text: 'Benutzerhilfe (Infos → Hilfe, druckbar).' },
  { v: '0.21', text: 'Offlinefähig (Service Worker), Datumsvorgaben aktuell bei offener App, Treuhänder-Export mit einheitlicher Datenschutzregel und Hinweis, Schutz vor manipulierten Backup-Dateien, Tests, README.' },
  { v: '0.20', text: 'PIN-Dialog nach oben (Tastatur überdeckt nichts); Testdaten-Bereich nur im Entwicklermodus; Beenden ohne Rückfrage nach Sicherung, wenn alles gesichert ist.' },
  { v: '0.19', text: 'Kompaktere Bildschirme fürs Handy, Tastatur verdeckt Felder nicht mehr; Buchung: 3 Buttons in einer Zeile; Menü; Kassenbuch mit aufklappbarem Filter; Kunden/Lieferanten: Buchungen anzeigen; Auswertungen mit festem Kopfbereich und Drucken oben rechts.' },
  { v: '0.18', text: 'Testdaten nur im Entwicklermodus (7x auf den Titel „Einstellungen“ tippen, gilt bis zum Schliessen der App); „Testdaten entfernen“ bleibt sichtbar, solange Testdaten vorhanden sind.' },
  { v: '0.17', text: 'Testmodus: neue Telefon-/E-Mail-Einträge zu echten Kontakten werden nicht mehr als Test markiert (und beim Entfernen der Testdaten nicht gelöscht).' },
  { v: '0.16', text: 'Handy-Menüführung: neue Navigationsseite mit zwei Spalten (Buchung, Kassenbuch, Kunden, Lieferanten, Auswertungen, Datensicherung, Einstellungen, Infos); Verlassen der Buchung und aller Seiten führt dorthin.' },
  { v: '0.15', text: 'Backup-Passwort: erste Sicherung der Sitzung zweimal, danach einmal mit Vergleich gegen das bisherige Passwort (Tippfehler-Schutz).' },
  { v: '0.14', text: 'Willkommensscreen: Button „Überspringen“ (mit Warnung und Bestätigung); Daten prüfen liest den Ordner automatisch; ungesicherte Änderungen gelb.' },
  { v: '0.13', text: 'Alte Sicherungen werden geräteunabhängig bis zur eingestellten Anzahl gelöscht (andere Dateien bleiben). Willkommensscreen zeigt beim Einstieg nur „Daten prüfen“.' },
  { v: '0.12', text: 'Optional: ältere Sicherungen im Standardordner automatisch löschen (nur dieses Gerät, einstellbare Anzahl).' },
  { v: '0.11', text: 'Willkommensscreen: „Daten prüfen“ vergleicht die jüngste Sicherung mit dem lokalen Stand (grün/gelb/rot).' },
  { v: '0.10', text: 'Neues Icon (alte Registrierkasse), Backup-Dateiname ohne „Kassenbuch“, Serienbrief-Tab entfernt, Button Beenden mit Backupdialog.' },
  { v: '0.9', text: 'Backup-Dateiname: Datum/Zeit (mit Sekunden)/Gerät/Version. Serienbrieffelder aus dem Kunden-/Lieferantenstamm entfernt (Pflege im Auswertungs-Tab Serienbrief).' },
  { v: '0.8', text: 'Standardordner für Datensicherung/Restore einstellbar (nur Browser mit Ordnerzugriff, nicht iPhone/iPad).' },
  { v: '0.7', text: 'Treuhänder-Export: Buchungstexte nur bei Lieferanten; Auswertungen mit festen Betragsspalten; Dublettenprüfung zeigt alle Treffer.' },
  { v: '0.6', text: 'Buchung: Einnahme/Ausgabe ersetzt durch Vorzeichenfeld +/− beim Betrag (Gutschriften und Rückzahlungen); Kategorien richten sich nach Kunde/Lieferant.' },
  { v: '0.5', text: 'Kontaktsuche in der Buchung nur über Namen; Kunden/Lieferanten mit Feldern Geschlecht/Firma und Anrede (Du/Sie).' },
  { v: '0.4', text: 'Buchungsseite: Buttons Abbrechen / Speichern & neu / Speichern; Kontaktvorschläge erst nach Eingabe.' },
  { v: '0.3', text: 'Kunde: Adresse/Kommunikation unter Geburtsdatum, Serienbrief zuunterst, nur eine bevorzugte Kommunikation. Kassenbuch mit Suche/Filter statt Monatswahl. Auswertungen mit optionalem Vorjahresvergleich, getrennt nach Kunden/Lieferanten.' },
  { v: '0.2', text: 'Gerätename (im Dateinamen der Sicherung, Anzeige beim Restore), Testmodus für neue Daten, neue Buchungsseite mit Vorbelegung aus der letzten Buchung und Backup-Abfrage nach dem Speichern.' },
  { v: '0.1.4a3xvr', text: 'Dritte Stelle der Versionsnummer ist der Branch-Code, automatisch aus dem Git-Branch gesetzt.' },
  { v: '0.1.1', text: 'Erste Version: Kassenbuch, Kunden/Lieferanten, Auswertungen, Excel-Export, verschlüsselte Datensicherung, PIN, Testdaten.' },
];
