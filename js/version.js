// Versionsnummer: MAJOR.MINOR werden manuell vergeben, die dritte Stelle ist der Merge-Code
// (fortlaufende Nummer, bei jedem Merge/Release um 1 erhöhen).
export const MAJOR = 0;
export const MINOR = 1;
export const BUILD = 1;
export const VERSION = `${MAJOR}.${MINOR}.${BUILD}`;

// Kurze Beschreibung je Änderung (neueste zuerst)
export const CHANGES = [
  { v: '0.1.1', text: 'Erste Version: Kassenbuch, Kunden/Lieferanten, Auswertungen, Excel-Export, verschlüsselte Datensicherung, PIN, Testdaten.' },
];
