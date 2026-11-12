// Testdaten: 10 Kunden, 2 Lieferanten, Buchungen für jeden Fall. Alles mit test:true markiert, damit es sich wieder entfernen lässt.
import * as db from './db.js';
import { uuid, isoDate } from './util.js';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); };

export const hasTestData = () => [...db.data.kontakt.values()].some((k) => k.test);

export async function createTestData() {
  const katId = (store, name, art) => [...db.data[store].values()].find((c) => c.name === name && (!art || c.art === art))?.id;
  const kk = (n) => katId('kundenkategorie', n);
  const ops = [];
  const comm = (kontaktId, typ, wert, bevorzugt = false) => ops.push({ op: 'put', store: 'kommunikation', obj: { id: uuid(), kontaktId, typ, wert, bevorzugt, test: true } });
  const kunde = (vorname, name, kat, extra = {}, comms = []) => {
    const k = db.newKontakt({ vorname, name, kategorieId: kk(kat), test: true, ...extra });
    ops.push({ op: 'put', store: 'kontakt', obj: k });
    comms.forEach(([typ, wert, pref]) => comm(k.id, typ, wert, pref));
    return k.id;
  };
  const lieferant = (name1, name2, extra = {}, comms = []) => {
    const k = db.newKontakt({ istLieferant: true, name1, name2, test: true, ...extra });
    ops.push({ op: 'put', store: 'kontakt', obj: k });
    comms.forEach(([typ, wert, pref]) => comm(k.id, typ, wert, pref));
    return k.id;
  };

  const K = {
    anna: kunde('Anna', 'Meier', 'Maria', { geburtsdatum: '1938-04-12', strasse: 'Dorfstrasse 4', plz: '3904', ort: 'Naters', diabetes: true, allergien: true, notizen: '• Nägel sehr hart\n• Kommt immer dienstags' }, [['tel', '079 111 22 33', true], ['mail', 'anna.meier@example.com', true]]),
    beat: kunde('Beat', 'Imboden', 'Michael', { geburtsdatum: '1945-09-30', strasse: 'Bahnhofstrasse 10', plz: '3900', ort: 'Brig', antikoaguliert: true }, [['tel', '027 923 44 55', true]]),
    claudia: kunde('Claudia', 'Zenklusen', 'Externe', { strasse: 'Kirchweg 2', plz: '3930', ort: 'Visp' }, [['tel', '078 222 33 44', true], ['tel', '027 946 11 22', false]]),
    daniel: kunde('Daniel', 'Walker', 'Maria', { geburtsdatum: '1952-01-05', plz: '3904', ort: 'Naters', haemophilie: true, hiv: false, diabetes: true }),
    erika: kunde('Erika', 'Brunner', 'Maria', { strasse: 'Poststrasse 7', plz: '3902', ort: 'Glis', briefErhalten: true, briefDatum: daysAgo(40) }, [['mail', 'erika.b@example.com', true]]),
    franz: kunde('Franz', 'Kalbermatten', 'Michael', { plz: '3900', ort: 'Brig' }, [['tel', '079 555 66 77', true]]),
    gerda: kunde('Gerda', 'Summermatter', 'Externe', { strasse: 'Matte 3', plz: '3922', ort: 'Stalden', allergien: true }, [['tel', '079 333 44 55', true], ['mail', 'gerda@example.com', false]]),
    hans: kunde('Hans', 'Jossen', 'Maria', { plz: '3904', ort: 'Naters', antikoaguliert: true, notizen: '• Bitte Rezept mitbringen' }),
    annaBrig: kunde('Anna', 'Meier', 'Externe', { strasse: 'Saltinaplatz 1', plz: '3900', ort: 'Brig' }), // Dublettentest (anderer Ort)
    karl: kunde('Karl', 'Pfammatter', 'Externe', { plz: '3904', ort: 'Naters' }), // ohne Buchungen
  };
  const L = {
    supply: lieferant('Podo Supply GmbH', 'Fusspflege-Bedarf', { strasse: 'Industriestrasse 5', plz: '3900', ort: 'Brig' }, [['tel', '027 922 00 11', true], ['mail', 'info@podosupply.example', true]]),
    energie: lieferant('Oberwalliser Energie AG', '', { strasse: 'Werkstrasse 1', plz: '3930', ort: 'Visp' }),
  };
  const eig = db.eigene().id;

  const ein = (kunde, kat, franken, text, d) => ({ kontaktId: kunde, kategorieId: katId('buchungskategorie', kat, 'einnahme'), betrag: Math.round(franken * 100), text, datum: daysAgo(d) });
  const aus = (lief, kat, franken, text, d) => ({ kontaktId: lief, kategorieId: katId('buchungskategorie', kat, 'ausgabe'), betrag: -Math.round(franken * 100), text, datum: daysAgo(d) });
  const list = [
    ein(K.anna, 'Podologie', 65, 'Fusspflege', 0), ein(K.beat, 'Podologie', 85, 'Behandlung mit Nagelspange', 1),
    ein(K.claudia, 'Verkauf', 24.9, 'Fusscreme', 2), ein(K.daniel, 'Stiftung', 120, '', 3),
    ein(K.erika, 'Podologie', 65, '', 3), ein(K.franz, 'Podologie', 65, 'Hornhaut', 6), ein(K.gerda, 'Verkauf', 18.5, '', 8),
    ein(K.hans, 'Podologie', 65, '', 9), ein(K.annaBrig, 'Podologie', 70, 'Erstbehandlung', 12), ein(K.anna, 'Podologie', 65, '', 33),
    ein(K.beat, 'Podologie', 65, '', 34), ein(K.erika, 'Stiftung', 100, 'Beitrag Stiftung', 36), ein(K.daniel, 'Podologie', 85, '', 38), ein(K.franz, 'Verkauf', 12.9, 'Einlagen-Spray', 40),
    aus(L.supply, 'Waren/Material', 312.4, 'Verbrauchsmaterial', 2), aus(L.energie, 'Strom', 88.55, '', 5),
    aus(eig, 'Miete Lokal', 900, '', 4), aus(eig, 'Miete Parkplatz', 80, '', 4),
    aus(L.supply, 'Versicherungen', 210, 'Betriebshaftpflicht', 15), aus(L.energie, 'Telefon', 59.9, '', 16), aus(L.supply, 'IT', 129, 'Software-Lizenz', 18),
    aus(eig, 'Beiträge/Spenden', 50, 'Verbandsbeitrag', 20), aus(L.supply, 'Treuhand/Beratung', 450, 'Jahresabschluss', 22), aus(L.energie, 'Werbung', 75, 'Inserat', 25),
    aus(eig, 'Verpflegung', 32.8, 'Kaffee/Gebäck Kunden', 30), aus(eig, 'Spesen', 24, 'Parkgebühr Hausbesuch', 31), aus(L.supply, 'Waren/Material', 198.2, '', 35),
  ];
  list.forEach((b, i) => ops.push({ op: 'put', store: 'buchung', obj: { id: uuid(), created: Date.now() + i, test: true, ...b } }));
  await db.batch(ops);
  return { kunden: Object.keys(K).length, lieferanten: Object.keys(L).length, buchungen: list.length };
}

export async function removeTestData() {
  const ids = new Set([...db.data.kontakt.values()].filter((k) => k.test).map((k) => k.id));
  const ops = [];
  [...db.data.buchung.values()].filter((b) => b.test || ids.has(b.kontaktId)).forEach((b) => ops.push({ op: 'del', store: 'buchung', id: b.id }));
  [...db.data.kommunikation.values()].filter((c) => c.test || ids.has(c.kontaktId)).forEach((c) => ops.push({ op: 'del', store: 'kommunikation', id: c.id }));
  ids.forEach((id) => ops.push({ op: 'del', store: 'kontakt', id }));
  if (ops.length) await db.batch(ops);
  return ids.size;
}
