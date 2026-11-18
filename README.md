# Kassenbuch

Einfache Kosten-/Ertragserfassung (Einnahmen/Ausgaben) als Basis für den Abschluss beim Treuhänder.
Eine PWA für iPad/iPhone (Safari), ohne Backend und ohne Build-Schritt. Die Daten liegen lokal im Gerät (IndexedDB).

## Starten

Die App muss über **https://** (oder `localhost`) ausgeliefert werden, sonst ist die Verschlüsselung (WebCrypto) nicht verfügbar.

```bash
python3 -m http.server 8080   # dann http://localhost:8080 öffnen
```

Auf dem iPad/iPhone: in Safari öffnen, *Teilen → Zum Home-Bildschirm*.

## Funktionen

- **Menü** (Startseite nach „Daten prüfen“, in den Einstellungen unter „Start“ wählbar: Menü oder Buchung): grosse Buttons in zwei Spalten für Buchung, Kassenbuch, Kunden, Lieferanten, Auswertungen, Datensicherung, Einstellungen, Infos. „Beenden“ fragt (bei ungesicherten Änderungen) nach einer Sicherung und sperrt die App.
- **Buchung** (Erfassungsseite): Datum, Kunde/Lieferant (Smartsuche nur über Namen, Vorschläge erst nach Eingabe), Betrag mit Vorzeichenfeld **+/−**, Kategorie, Text. Nach der Kontaktwahl werden Vorzeichen, Betrag und Kategorie aus der letzten Buchung des Kontakts vorbelegt. Darunter die zuletzt erfassten Buchungen (mit Quittungs-Icon). Der Betrag wird beim Antippen markiert. Buttons: Abbrechen, Speichern & neu, Speichern (fragt anschliessend nach einer Datensicherung).
  - Die **Art** (Einnahme/Ausgabe) ergibt sich aus dem Kontakt: Kunde = Einnahme, Lieferant = Ausgabe. Das Vorzeichen bildet Rückzahlungen (Kunde) und Gutschriften (Lieferant) ab.
- **Kassenbuch**: Liste mit Suche und aufklappbarem Filter (Periode, Art, Kategorie; Vorgabe: alles), Summen, Bearbeiten/Löschen, Quittungs-Icon (🖨) rechts neben dem Betrag bei positiven Einnahmen.
- **Kunden/Lieferanten**: mehrere Telefonnummern/E-Mails, je eine Zeile mit Icon (öffnet Telefon-/Mail-App); genau eine ist bevorzugt, Geschlecht/Firma, Anrede (Du/Sie), „Speichern und neu“, „Speichern und buchen“ (Standard, in den Einstellungen wählbar; öffnet danach die Buchungen) und „Speichern und zurück“, Geburtsdatum tippbar oder per Kalender, Dublettenprüfung (Name + PLZ/Telefon/E-Mail, oder Name wenn einer der Einträge sonst keine Daten hat; zeigt alle Treffer), Button „Ausgeben“ (Zeitraum wählen, dann Drucken; kompakt, Stammdaten und ca. 20 Buchungen auf der ersten Seite; alle Felder, leere mit «–», inkl. Buchungen, für Auskunft nach DSGVO), Kategorie und Stock (Kunden; Stock ist Freitext), Notizen mit Marker, Gesundheitsangaben, Telefon-/Mail-Buttons (öffnen die jeweilige App), Button „Buchungen“: alle Buchungen des Kontakts mit Quittungs-Icon und Schnellerfassung einer neuen Buchung (Datum tippbar, ganz markiert, oder per Kalender, bleibt nach dem Buchen stehen; Betrag und Kategorie aus der jüngsten Buchung vorbelegt, Buchungstext leer; Button „Buchen“). Löschen ersetzt den Kontakt in den Buchungen durch „Gelöschter Kunde/Lieferant“.
- **PIN/Passwort**: Option „Eingabe anzeigen“ beim Sperrbildschirm, bei „PIN ändern“ und bei der Passwortabfrage der Datensicherung.
- **Quittung** (Druck-Icon bei einer positiven Einnahme in der Buchungsliste, auch in „Buchungen“ eines Kunden): Druckansicht, auf iOS *Drucken → Als PDF sichern*.
- **Auswertungen**: Perioden und Kategorien (Kunden nach Kundenkategorie, Lieferanten nach Lieferant mit Drilldown nach Buchungskategorie) mit optionalem **Vorjahresvergleich**, Kundenliste (nach Buchungskategorien, Mehrfachauswahl, nicht gespeichert, Vorgabe immer Stiftung, mit „Alle“ eine Liste über alles; Firmenkopf, Drucken/PDF), **Excel-Export für den Treuhänder**. Der Kopfbereich bleibt beim Scrollen stehen.
  - Treuhänder-Export: immer ein ganzes Jahr (Auswahl, Vorgabe Vorjahr), Zusammenfassungsebene Einzelbuchung/Tag/Monat/Jahr (Vorgabe Monat). Tab 1: Firma mit Adresse, Zeitraum, Erzeugungszeitpunkt, Ebene. Tab 2 „Buchungen“: Datum (echtes Excel-Datum; bei Monat der letzte Tag des Monats, bei Jahr der 31.12.), Lieferant (bei Kunden leer), Kundenkategorie, Buchungskategorie, Betrag; keine Summen und keine Buchungstexte. Namen nur bei **Lieferanten**, nie bei Kunden. Hinweis bei Buchungen, deren Kategorie nicht zum Kontakttyp passt.
- **Datensicherung**: verschlüsselt (PBKDF2 + AES-GCM). Dateiname `JJJJMMTT-HHMMSS-Gerät-vVersion.enc`. Der **Gerätename** steht in den Einstellungen (nicht in der Sicherung). Passwort: erste Sicherung der Sitzung zweimal, danach einmal mit Vergleich gegen das bisherige Passwort (Tippfehlerschutz).
  - **Standardordner** (nur Browser mit Ordnerzugriff, z. B. Chrome/Edge; nicht iPhone/iPad): Sicherungen werden direkt dort abgelegt, der Restore listet sie. Optional werden ältere Sicherungen (`.enc`) automatisch bis zur eingestellten Anzahl gelöscht; andere Dateien bleiben unberührt.
  - **Daten prüfen** (Willkommensscreen): liest die Dateinamen der Sicherungen und vergleicht die jüngste mit dem lokalen Stand. **Grün** = aktuell, **gelb** = neuere Sicherung vorhanden oder ungesicherte lokale Änderungen, **rot** = neuere Sicherung *und* ungesicherte lokale Änderungen (Restore würde überschreiben). Ohne Internet erscheint sofort ein Hinweis, „Daten prüfen“ ist ausgegraut, „Überspringen“ (nach Warnung) bleibt möglich. Ohne Internet sind auch alle Sicherungs- und Restore-Buttons ausgegraut (Verbindungstest in `js/net.js`).
  - **Filtereinstellungen** (Kassenbuch, Kunden-Kategorie, Auswertungen) liegen in `meta.filters`, sind als `filters` Teil der Sicherung und werden beim Restore wiederhergestellt; ältere Sicherungen ohne Filter gelten als Standard (alles).
  - Restore: mit Hinweis auf Sicherungs-/Änderungsdatum, Gerät und Warnung, wenn die lokalen Daten neuer sind.
- **Notizen** (Infos → Notizen): Titel, Text mit Aufzählungspunkten, Bilder/Screenshots (Datei, Zwischenablage, Einfügen; verkleinert als JPEG gespeichert, max. 12), Senden per `mailto:` an die Adresse aus den Einstellungen (nur Text) bzw. Teilen mit Bildern (Web Share). Eigener Store `notiz` (DB-Version 2), Teil der Datensicherung; ältere Sicherungen ohne Notizen lassen sich weiter einspielen.
- **PIN** als Zugriffsschutz (Cursor steht beim Start sofort im PIN-Feld; pro Gerät; sperrt nach 5 Minuten im Hintergrund). Die PIN ist eine Sperre, **keine Verschlüsselung** der lokalen Daten – die Sicherungsdateien sind verschlüsselt.
- **Hilfe**: Infos → „Hilfe“ (oben rechts) zeigt die Benutzerhilfe (u. a. Datenübernahme vs. tägliche Erfassung im Detail, Installieren als letzter Punkt), „Drucken / PDF“ druckt sie.
- **Offline**: Ein Service Worker (`sw.js`) hält die App offlinefähig („Netz zuerst, Cache als Rückfall“, d. h. online ist immer die aktuelle Fassung aktiv).
- **Testdaten** (nur im Entwicklermodus: 7× auf den Titel „Einstellungen“ tippen, gilt bis zum Schliessen der App): Testmodus (neue Kontakte/Buchungen werden als Test markiert), Testdaten erzeugen/entfernen.
- **Versionierung**: `js/version.js` – MAJOR.MINOR manuell in `js/version.js` ändern (`MAJOR`, `MINOR`), dritte Stelle = Branch-Code (z. B. 4a3xvr), der bei jedem Commit automatisch aus dem Git-Branch gesetzt wird (`tools/set-version.sh`, Hook in `.githooks/`). In Claude-Code-Sessions aktiviert `.claude/hooks/session-start.sh` den Hook automatisch. In einer eigenen Arbeitskopie einmalig: `git config core.hooksPath .githooks`. Auf master/main bleibt der Code des gemergten Branches stehen. Änderungsbeschreibung auf dem Infos-Screen.

> **Hinweis iPhone/iPad:** In einem normalen Safari-Tab kann iOS lokale Daten nach längerer Nichtnutzung löschen. Die App deshalb über *Teilen → Zum Home-Bildschirm* installieren und regelmässig sichern („Daten prüfen“ zeigt den Stand).

## Tests

Die App hat keinen Build-Schritt. Für die Tests (Node ≥ 20, `fake-indexeddb` als einzige Abhängigkeit):

```bash
npm install
npm test
```

Abgedeckt: Dateinamen und „Daten prüfen“, Löschen alter Sicherungen, Verschlüsselung (inkl. manipulierte Kopfdaten), Testmodus/Testdaten, Restore/Snapshot, Vorbelegung, Datumseingabe, Treuhänder-Export (Datenschutz, Zusammenfassungsebenen).

## Struktur

```
index.html, sw.js, manifest.webmanifest, css/style.css, icons/, tests/
js/app.js          Start, Navigation, Sperre, Startseite „Daten prüfen“
js/net.js           Verbindungstest (offline: Sicherung/Restore gesperrt)
js/menu.js         Menü (Navigationsseite)
js/hilfe.js        Benutzerhilfe (druckbar, Infos → Hilfe)
js/buchung.js      Buchungsseite (Erfassung + zuletzt erfasst)
js/kassenbuch.js   Buchungsliste mit Filter und Druck-Icon, Buchungsdialog
js/quittung.js     Quittung (Druckansicht)
js/kontaktpick.js  Kontaktwahl (Smartsuche), Betrag/Vorzeichen, Vorbelegung
js/kontakte.js     Kunden-/Lieferantenverwaltung
js/auswertungen.js Auswertungen und Treuhänder-Export; periodbar.js: Periodenwahl
js/db.js           IndexedDB + Cache, Referenzielle Integrität, Snapshot/Restore
js/einstellungen.js Einstellungen, Infos
js/crypto.js, backup.js, lock.js, xlsx.js, testdata.js, ui.js, util.js, version.js
```

## Datenmodell (alle Verknüpfungen über IDs)

`kontakt` (Kunde oder Lieferant, Systemkontakte: eigene Firma, Dummy-Kunde, Dummy-Lieferant) · `kommunikation` (kontaktId) ·
`kundenkategorie` · `buchungskategorie` (art: einnahme/ausgabe) · `buchung` (datum, betrag in Rappen mit Vorzeichen – Einnahme/Ausgabe ergibt sich aus der Kategorie, kontaktId, kategorieId, text) · `meta`.
