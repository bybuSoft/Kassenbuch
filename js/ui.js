// UI-Bausteine: Dialoge, Toasts, Formularfelder, Druck
import { h } from './util.js';

let modalCount = 0;

/** Zeigt einen Dialog. buttons: [{label, cls, value, onClick(ctl), left}]. onClick kann false liefern, um offen zu bleiben. */
export function showModal({ title, body, buttons = [], dismissable = true, wide = false }) {
  let resolve;
  const closed = new Promise((r) => { resolve = r; });
  const back = h('div', { class: 'backdrop' });
  let dlg;
  const ctl = {
    el: null, closed,
    close(v) {
      if (!back.isConnected) return;
      back.remove(); modalCount--;
      if (modalCount === 0) document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    },
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable && back === document.getElementById('modal-root').lastElementChild) { e.stopPropagation(); ctl.close(undefined); }
  };
  const btnEls = buttons.map((b) => {
    const el = h('button', { type: 'button', class: `btn ${b.cls || ''}${b.left ? ' left' : ''}` }, b.label);
    el.addEventListener('click', async () => {
      el.disabled = true;
      try {
        const r = await b.onClick?.(ctl);
        if (r === false) return;
        ctl.close(b.value !== undefined ? b.value : r);
      } catch (e) {
        console.error(e);
        toast(e.message || String(e), 'err');
      } finally { el.disabled = false; }
    });
    return el;
  });
  dlg = h('div', { class: `dialog${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'dlg-head' }, h('h2', {}, title),
      dismissable ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Schliessen', onclick: () => ctl.close(undefined) }, '×') : null),
    h('div', { class: 'dlg-body' }, body),
    btnEls.length ? h('div', { class: 'dlg-foot' }, btnEls) : null);
  ctl.el = dlg;
  back.append(dlg);
  if (dismissable) back.addEventListener('mousedown', (e) => { if (e.target === back) ctl.close(undefined); });
  document.getElementById('modal-root').append(back);
  document.body.classList.add('modal-open');
  modalCount++;
  document.addEventListener('keydown', onKey, true);
  const first = dlg.querySelector('input:not([type=checkbox]):not([type=hidden]),select,textarea');
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
  return ctl;
}

export async function confirmDlg(message, { title = 'Bestätigen', ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  const ctl = showModal({
    title, body: h('p', { class: 'pre' }, message),
    buttons: [{ label: cancel, value: false }, { label: ok, cls: danger ? 'danger' : 'primary', value: true }],
  });
  return (await ctl.closed) === true;
}

export async function alertDlg(message, { title = 'Hinweis', ok = 'OK' } = {}) {
  await showModal({ title, body: h('p', { class: 'pre' }, message), buttons: [{ label: ok, cls: 'primary' }] }).closed;
}

/** Texteingabe. Gibt String oder null zurück. */
export async function promptDlg({ title, label, value = '', ok = 'OK', type = 'text', validate }) {
  const input = h('input', { type, value, autocomplete: 'off' });
  const err = h('div', { class: 'err' });
  const ctl = showModal({
    title, body: [field(label, input), err],
    buttons: [{ label: 'Abbrechen', value: null }, {
      label: ok, cls: 'primary',
      onClick: () => {
        const v = input.value.trim();
        const m = validate ? validate(v) : null;
        if (m) { err.textContent = m; return false; }
        return v;
      },
    }],
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctl.el.querySelector('.btn.primary').click(); });
  const r = await ctl.closed;
  return r === undefined ? null : r;
}

/** Passwortabfrage (optional mit Wiederholung). */
export async function passwordDlg({ title, hint, confirmField = false, ok = 'OK', min = 6 }) {
  const p1 = h('input', { type: 'password', autocomplete: 'off' });
  const p2 = h('input', { type: 'password', autocomplete: 'off' });
  const err = h('div', { class: 'err' });
  const ctl = showModal({
    title,
    body: [hint ? h('p', { class: 'muted pre' }, hint) : null, field('Passwort', p1), confirmField ? field('Passwort wiederholen', p2) : null, err],
    buttons: [{ label: 'Abbrechen', value: null }, {
      label: ok, cls: 'primary',
      onClick: () => {
        if (p1.value.length < min) { err.textContent = `Mindestens ${min} Zeichen.`; return false; }
        if (confirmField && p1.value !== p2.value) { err.textContent = 'Die Passwörter stimmen nicht überein.'; return false; }
        return p1.value;
      },
    }],
  });
  ctl.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctl.el.querySelector('.btn.primary').click(); });
  const r = await ctl.closed;
  return r === undefined ? null : r;
}

let toastTimer;
export function toast(msg, kind = '') {
  const root = document.getElementById('toast-root');
  root.replaceChildren(h('div', { class: `toast ${kind}`, role: 'status' }, msg));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.replaceChildren(), kind === 'err' ? 6000 : 2800);
}

export const field = (label, input, cls = '') => h('label', { class: `field ${cls}` }, h('span', { class: 'lbl' }, label), input);
export const checkField = (label, input) => h('label', { class: 'check' }, input, h('span', {}, label));

/** Segmentiertes Auswahlfeld. options: [{value,label}] */
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const render = () => wrap.replaceChildren(...options.map((o) =>
    h('button', { type: 'button', class: `seg-btn ${o.cls || ''}${o.value === value ? ' on' : ''}`, 'aria-pressed': String(o.value === value), onclick: () => { value = o.value; render(); onChange(value); } }, o.label)));
  render();
  return wrap;
}

/** Inhalt in den Druckbereich legen und drucken (auf iOS: Teilen > Sichern als PDF). */
export function printNode(node) {
  const area = document.getElementById('print-area');
  area.replaceChildren(node);
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => document.getElementById('print-area')?.replaceChildren());
