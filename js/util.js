// Kleine Hilfsfunktionen: DOM, Formatierung, Datei-Speichern

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map(v => v.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** DOM-Helfer: h('div', {class:'x', onclick:fn}, child, ...) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' || k === 'for' || k === 'list' || !(k in el)) el.setAttribute(k, v === true ? '' : v);
    else el[k] = v;
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  if (value !== undefined) el.value = value;
  return el;
}

// ---- Formatierung -------------------------------------------------------
/** Rappen (Integer) -> "1’234.50" */
export const chf = (rappen) => (rappen / 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12.5" / "12,50" / "1'234.50" -> Rappen, sonst null */
export function parseBetrag(s) {
  const t = String(s ?? '').trim().replace(/[’'\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

const p2 = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const today = () => isoDate(new Date());
export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
export const fmtDateTime = (ts) => (ts ? new Date(ts).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }) : '–');
export const monthOf = (iso) => iso.slice(0, 7);
export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
};
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
};
export const lastDayOfMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return isoDate(new Date(y, m, 0));
};

export const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

// ---- Dateien ------------------------------------------------------------
/** Speichert eine Datei: optional über das Share-Sheet (iOS), sonst Download. Gibt 'shared' | 'downloaded' | 'cancelled' zurück. */
export async function saveBlob(blob, filename, { share = false } = {}) {
  if (share && navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // sonst: Fallback auf Download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

/** Öffnet den Dateiauswahldialog; null bei Abbruch (mit multiple: Array, leer bei Abbruch). */
export function pickFile({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', style: 'display:none', multiple });
    const empty = () => (multiple ? [] : null);
    input.addEventListener('change', () => { resolve(multiple ? [...input.files] : (input.files[0] || null)); input.remove(); });
    input.addEventListener('cancel', () => { resolve(empty()); input.remove(); });
    document.body.append(input);
    input.click();
  });
}
