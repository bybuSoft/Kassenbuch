// Versionsnummer: MAJOR.MINOR werden manuell vergeben, die dritte Stelle ist der Branch-Code
// (die Zeichen nach dem letzten "-" im Branch-Namen, z. B. claude/festive-cray-4a3xvr -> 4a3xvr).
// BRANCH_CODE wird beim Commit automatisch gesetzt (tools/set-version.sh, Hook in .githooks/).
export const MAJOR = 0;
export const MINOR = 1;
export const BRANCH_CODE = '4a3xvr';
export const VERSION = `${MAJOR}.${MINOR}.${BRANCH_CODE}`;

// Kurze Beschreibung je Änderung (neueste zuerst)
export const CHANGES = [
  { v: '0.1.4a3xvr', text: 'Dritte Stelle der Versionsnummer ist der Branch-Code, automatisch aus dem Git-Branch gesetzt.' },
  { v: '0.1.1', text: 'Erste Version: Kassenbuch, Kunden/Lieferanten, Auswertungen, Excel-Export, verschlüsselte Datensicherung, PIN, Testdaten.' },
];
