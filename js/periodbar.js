// Kompakte Periodenwahl: Von/Bis und Schnellwahl auf je einer Zeile (für Kassenbuch und Auswertungen)
import { h, today, isoDate, monthOf, lastDayOfMonth, shiftMonth } from './util.js';

/** from/to: aktuelle Werte (ISO). onSet(from, to) wird bei jeder Änderung gerufen. extra: zusätzliches Element in der Datumszeile. all: Schnellwahl „Alles“. */
export function periodBar({ from, to, onSet, extra = null, all = false }) {
  const mk = (label, aria, value) => {
    const input = h('input', { type: 'date', value, 'aria-label': aria });
    return { input, el: h('label', { class: 'pb-d' }, h('span', {}, label), input) };
  };
  const f = mk('Von', 'Von', from), t = mk('Bis', 'Bis', to);
  const apply = () => onSet(f.input.value || from, t.input.value || to);
  f.input.addEventListener('change', apply); t.input.addEventListener('change', apply);
  const preset = (label, title, a, b) => h('button', { type: 'button', class: 'btn small', title, onclick: () => onSet(a, b) }, label);
  const y = new Date().getFullYear(), m = monthOf(today()), pm = shiftMonth(m, -1);
  return h('div', { class: 'periodbar' },
    h('div', { class: 'pb-dates' }, f.el, t.el, extra),
    h('div', { class: 'presets one' },
      preset('Monat', 'Dieser Monat', `${m}-01`, lastDayOfMonth(m)), preset('Vormonat', 'Letzter Monat', `${pm}-01`, lastDayOfMonth(pm)),
      preset('Jahr', 'Dieses Jahr', `${y}-01-01`, `${y}-12-31`), preset('Vorjahr', 'Letztes Jahr', `${y - 1}-01-01`, `${y - 1}-12-31`),
      all ? preset('Alles', 'Alle Buchungen', '0000-01-01', '9999-12-31') : null));
}
