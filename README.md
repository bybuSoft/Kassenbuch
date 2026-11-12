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

- **Kassenbuch**: Buchungen pro Monat, Einnahme/Ausgabe, Betrag, Kontakt (Auto-Suche), Buchungskategorie, optionaler Buchungstext. Bearbeiten/Löschen jederzeit.
  - Einnahme: Kunde aus der Liste; Kategorien Podologie, Verkauf, Stiftung.
  - Ausgabe: Lieferant oder die eigene Firma; Kategorien Waren/Material, Miete Lokal, … Spesen.
- **Kunden/Lieferanten**: mehrere Telefonnummern/E-Mails (bevorzugt), Dublettenprüfung (Name + PLZ/Telefon), Kundenkategorien, Notizen mit Marker, Gesundheitsangaben. Löschen ersetzt den Kontakt in den Buchungen durch „Gelöschter Kunde/Lieferant“.
- **Quittung** (aus einer Einnahme): Druckansicht, auf iOS *Drucken → Als PDF sichern*.
- **Auswertungen**: Perioden, Kundenkategorien, Kundenliste (Vorname, Name, Betrag, nach Tag, Total pro Monat), Serienbrief-Status/Adressliste, **Excel-Export für den Treuhänder** (ohne Kundendaten).
- **Datensicherung**: verschlüsselt (PBKDF2 + AES-GCM), Dateiname mit Zeitstempel und Version, Speichern über das Share-Sheet bzw. die Dateien-App (iCloud Drive). Roter Punkt bei ungesicherten Änderungen. Beim Start kann ein **Restore** gemacht werden, mit Hinweis auf Sicherungs-/Änderungsdatum und Warnung, wenn die lokalen Daten neuer sind.
- **PIN** als Zugriffsschutz (pro Gerät; sperrt nach 5 Minuten im Hintergrund).
- **Testdaten**: Button in den Einstellungen (10 Kunden, 2 Lieferanten, Buchungen für jeden Fall), wieder entfernbar.
- **Versionierung**: `js/version.js` – MAJOR.MINOR manuell, dritte Stelle = Merge-Code; Änderungsbeschreibung auf dem Infos-Screen.

## Struktur

```
index.html, manifest.webmanifest, css/style.css, icons/
js/app.js          Start, Navigation, Sperre
js/db.js           IndexedDB + Cache, Referenzielle Integrität, Snapshot/Restore
js/kassenbuch.js   Buchungsliste, Buchungsdialog, Quittung
js/kontakte.js     Kunden-/Lieferantenverwaltung
js/auswertungen.js Auswertungen und Treuhänder-Export
js/einstellungen.js Einstellungen, Infos
js/crypto.js, backup.js, lock.js, xlsx.js, testdata.js, ui.js, util.js, version.js
```

## Datenmodell (alle Verknüpfungen über IDs)

`kontakt` (Kunde oder Lieferant, Systemkontakte: eigene Firma, Dummy-Kunde, Dummy-Lieferant) · `kommunikation` (kontaktId) ·
`kundenkategorie` · `buchungskategorie` (art: einnahme/ausgabe) · `buchung` (datum, betrag in Rappen mit Vorzeichen, kontaktId, kategorieId, text) · `meta`.
