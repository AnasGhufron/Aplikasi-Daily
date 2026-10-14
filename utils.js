(function () {
  'use strict';
  const NX = (window.NX = window.NX || {});
  NX.views = {};
  const listeners = {};
  NX.bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, data) { (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
  };
  const U = (NX.util = {});
  const pad = n => String(n).padStart(2, '0');
  U.pad = pad;

  /* ---------- DOM ---------- */
  function append(node, kids) {
    if (kids === undefined || kids === null || kids === false) return;
    if (!Array.isArray(kids)) kids = [kids];
    for (const k of kids) {
      if (k === undefined || k === null || k === false) continue;
      if (Array.isArray(k)) append(node, k);
      else node.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }
  function applyAttrs(node, attrs) {
    let value;
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'value') value = v;
      else if (k === 'checked') node.checked = true;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    return value;
  }
  const el = (U.el = function (tag, attrs, kids) {
    const node = document.createElement(tag);
    const value = applyAttrs(node, attrs);
    append(node, kids);
    if (value !== undefined) node.value = value;
    return node;
  });
  U.svg = function (tag, attrs, kids) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k of Object.keys(attrs || {})) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    append(n, kids);
    return n;
  };
  U.$ = (sel, root) => (root || document).querySelector(sel);
  const ICONS = {
    dashboard: 'M3 3h8v8H3z M13 3h8v5h-8z M13 11h8v10h-8z M3 14h8v7H3z',
    calendar: 'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
    tasks: 'M4 6l2 2 3-3 M4 14l2 2 3-3 M12 7h8 M12 15h8',
    wallet: 'M3 7h18v12H3z M3 7l2-3h14l2 3 M16 13h3',
    pie: 'M12 3a9 9 0 1 0 9 9h-9z M14 3.2A9 9 0 0 1 20.8 10H14z',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    sun: 'M12 4v2 M12 18v2 M4 12h2 M18 12h2 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    bars: 'M5 20V10 M12 20V4 M19 20v-7',
    sliders: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M14 5v4 M6 15v4',
    menu: 'M4 7h16 M4 12h16 M4 17h16',
    x: 'M6 6l12 12 M18 6L6 18',
    half: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18 M12 3a9 9 0 0 1 0 18z'
  };
  U.icon = name => U.svg('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, U.svg('path', { d: ICONS[name] || '' }));

  /* ---------- Tanggal & waktu ---------- */
  U.DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  U.dateStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  U.today = () => U.dateStr(new Date());
  U.parseDate = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  U.addDays = (s, n) => { const d = U.parseDate(s); d.setDate(d.getDate() + n); return U.dateStr(d); };
  U.isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && U.dateStr(U.parseDate(s)) === s;
  U.isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  U.weekday = s => (U.parseDate(s).getDay() + 6) % 7; // 0 = Senin
  U.weekStart = s => U.addDays(s, -U.weekday(s));
  U.monthKey = s => s.slice(0, 7);
  U.monthEnd = key => { const p = key.split('-').map(Number); return U.dateStr(new Date(p[0], p[1], 0)); };
  U.addMonths = (key, n) => { const p = key.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  U.toMin = t => { const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
  U.toTime = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  U.nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  U.fmtDate = (s, o) => new Intl.DateTimeFormat('id-ID', o || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(U.parseDate(s));
  U.fmtShort = s => U.fmtDate(s, { day: 'numeric', month: 'short' });
  U.fmtMonth = key => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(U.parseDate(key + '-01'));
  U.fmtMonthShort = key => new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(U.parseDate(key + '-01'));
  U.fmtDur = m => { m = Math.round(m); if (m < 60) return m + ' mnt'; const h = Math.floor(m / 60), r = m % 60; return h + ' j' + (r ? ' ' + r + ' mnt' : ''); };
  const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  U.fmtIDR = n => idr.format(n);
  U.uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  U.sum = (arr, fn) => arr.reduce((a, x) => a + (fn ? fn(x) : x), 0);
  U.debounce = (fn, ms) => { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; };

  /* ---------- Komponen kecil ---------- */
  U.badge = (text, kind) => el('span', { class: 'badge ' + (kind || ''), text });
  U.progress = (pct, kind, label) => el('div', { class: 'progress ' + (kind || ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(Math.max(0, Math.min(100, pct))), 'aria-label': label || 'Progres' },
    el('div', { class: 'progress-bar', style: 'width:' + Math.max(0, Math.min(100, pct)) + '%' }));
  U.empty = (title, text, action) => el('div', { class: 'empty' }, [el('strong', { text: title }), text ? el('p', { class: 'muted', text }) : null, action || null]);
  U.stat = (label, value, sub, kind) => el('div', { class: 'stat ' + (kind || '') }, [el('span', { class: 'stat-label', text: label }), el('strong', { class: 'stat-value', text: value }), sub ? el('span', { class: 'stat-sub', text: sub }) : null]);
  U.tabs = (items, current, onChange, label) => el('div', { class: 'tabs', role: 'group', 'aria-label': label || 'Pilihan tampilan' },
    items.map(it => el('button', { type: 'button', class: 'tab' + (it[0] === current ? ' active' : ''), 'aria-pressed': String(it[0] === current), onclick: () => onChange(it[0]) }, [it[1], it[2] !== undefined && it[2] !== null ? el('span', { class: 'tab-count', text: String(it[2]) }) : null])));

  U.toast = (msg, type) => {
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = el('div', { class: 'toast ' + (type || 'info'), role: type === 'error' ? 'alert' : 'status', text: msg });
    host.append(t);
    setTimeout(() => t.remove(), type === 'error' || type === 'warn' ? 7000 : 3800);
  };

  /* ---------- Modal & konfirmasi ---------- */
  U.initModal = function () {
    const dlg = document.getElementById('modal');
    document.getElementById('modalClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => {
      if (dlg.open) return;
      document.getElementById('modalBody').replaceChildren();
      const cb = dlg._onClose; dlg._onClose = null;
      if (cb) cb();
    });
  };
  U.openModal = function (title, body, opts) {
    opts = opts || {};
    const dlg = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').replaceChildren(body);
    dlg.classList.toggle('wide', !!opts.wide);
    dlg._onClose = opts.onClose || null;
    if (!dlg.open) dlg.showModal();
  };
  U.closeModal = () => { const d = document.getElementById('modal'); if (d && d.open) d.close(); };
  U.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const dlg = el('dialog', { class: 'modal confirm', 'aria-label': 'Konfirmasi' });
      const done = r => { try { dlg.close(); } catch (e) { /* sudah tertutup */ } dlg.remove(); resolve(r); };
      const cancelBtn = el('button', { type: 'button', class: 'btn', text: opts.cancelLabel || 'Batal', onclick: () => done(false) });
      dlg.append(el('div', { class: 'modal-body' }, [
        el('p', { class: 'confirm-msg', text: message }),
        opts.detail ? el('p', { class: 'muted', text: opts.detail }) : null,
        el('div', { class: 'form-actions' }, [cancelBtn, el('button', { type: 'button', class: 'btn ' + (opts.danger ? 'danger' : 'primary'), text: opts.okLabel || 'Lanjutkan', onclick: () => done(true) })])
      ]));
      dlg.addEventListener('cancel', e => { e.preventDefault(); done(false); });
      document.body.append(dlg);
      dlg.showModal();
      cancelBtn.focus();
    });
  };

  /* ---------- Pembuat formulir ---------- */
  U.form = function (o) {
    const form = el('form', { class: 'form', novalidate: true });
    const err = el('p', { class: 'form-error', role: 'alert', hidden: true });
    const inputs = {}, wraps = {};
    const values = o.values || {};
    const mkOpts = opts => opts.map(x => typeof x === 'object' ? el('option', { value: x.value, text: x.label }) : el('option', { value: x, text: x }));
    o.fields.forEach(f => {
      const id = 'f' + Math.random().toString(36).slice(2, 8);
      let input;
      if (f.type === 'select') input = el('select', { id, name: f.name }, mkOpts(f.options));
      else if (f.type === 'textarea') input = el('textarea', { id, name: f.name, rows: f.rows || 3, placeholder: f.placeholder, maxlength: f.maxlength || 2000 });
      else if (f.type === 'checkbox') input = el('input', { id, name: f.name, type: 'checkbox' });
      else input = el('input', { id, name: f.name, type: f.type || 'text', placeholder: f.placeholder, min: f.min, max: f.max, step: f.step, inputmode: f.inputmode, maxlength: (!f.type || f.type === 'text') ? (f.maxlength || 200) : undefined, autocomplete: 'off' });
      const v = values[f.name] !== undefined && values[f.name] !== null ? values[f.name] : (f.default !== undefined ? f.default : '');
      if (f.type === 'checkbox') input.checked = !!v; else input.value = v;
      if (f.type === 'select' && input.selectedIndex < 0) input.selectedIndex = 0;
      inputs[f.name] = input;
      const hint = f.hint ? el('small', { class: 'hint', id: id + 'h', text: f.hint }) : null;
      if (hint) input.setAttribute('aria-describedby', id + 'h');
      const label = el('label', { for: id }, [f.label, f.required ? el('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null]);
      wraps[f.name] = el('div', { class: 'field' + (f.type === 'checkbox' ? ' check' : '') + (f.half ? ' half' : '') }, f.type === 'checkbox' ? [input, label, hint] : [label, input, hint]);
      form.append(wraps[f.name]);
    });
    const api = {
      get: n => (inputs[n].type === 'checkbox' ? inputs[n].checked : inputs[n].value),
      set: (n, v) => { if (inputs[n].type === 'checkbox') inputs[n].checked = !!v; else inputs[n].value = v; },
      on: (n, fn) => { const h = () => fn(api.get(n)); inputs[n].addEventListener('change', h); },
      setOptions: (n, opts, keep) => { const cur = inputs[n].value; inputs[n].replaceChildren(...mkOpts(opts)); if (keep) inputs[n].value = cur; if (inputs[n].selectedIndex < 0) inputs[n].selectedIndex = 0; },
      show: (n, on) => { wraps[n].hidden = !on; }
    };
    form.api = api;
    form.append(err);
    const submit = el('button', { type: 'submit', class: 'btn primary', text: o.submitLabel || 'Simpan' });
    const actions = el('div', { class: 'form-actions' }, [
      o.onDelete ? el('button', { type: 'button', class: 'btn danger-ghost', text: 'Hapus', onclick: async () => { await o.onDelete(); } }) : null,
      el('span', { class: 'spacer' }),
      el('button', { type: 'button', class: 'btn', text: 'Batal', onclick: () => U.closeModal() }),
      submit
    ]);
    form.append(actions);
    const showErr = m => { err.textContent = m; err.hidden = false; };
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const out = {}, msgs = [];
      let firstBad = null;
      for (const f of o.fields) {
        const inp = inputs[f.name];
        inp.removeAttribute('aria-invalid');
        if (wraps[f.name].hidden) { out[f.name] = f.type === 'number' ? null : (f.type === 'checkbox' ? false : ''); continue; }
        let v = f.type === 'checkbox' ? inp.checked : inp.value;
        if (typeof v === 'string') v = v.trim();
        let bad = null;
        if (f.type === 'checkbox') { /* tidak divalidasi */ }
        else if (v === '') { if (f.required) bad = f.label + ' wajib diisi.'; if (f.type === 'number') v = null; }
        else if (f.type === 'number') {
          const n = Number(v);
          if (!Number.isFinite(n)) bad = f.label + ' harus berupa angka.';
          else if (f.integer && !Number.isInteger(n)) bad = f.label + ' harus bilangan bulat.';
          else if (f.min !== undefined && n < f.min) bad = f.label + ' minimal ' + f.min + '.';
          else if (f.max !== undefined && n > f.max) bad = f.label + ' maksimal ' + f.max + '.';
          else v = n;
        } else if (f.type === 'date' && !U.isDate(v)) bad = f.label + ' tidak valid.';
        else if (f.type === 'time' && !U.isTime(v)) bad = f.label + ' tidak valid.';
        if (bad) { msgs.push(bad); inp.setAttribute('aria-invalid', 'true'); if (!firstBad) firstBad = inp; }
        out[f.name] = v;
      }
      const message = msgs[0] || (o.validate ? o.validate(out) : null);
      if (message) { showErr(message); if (firstBad) firstBad.focus(); return; }
      err.hidden = true;
      submit.disabled = true;
      try {
        const r = await o.onSubmit(out);
        if (typeof r === 'string') showErr(r);
        else if (r !== false) U.closeModal();
      } catch (e) { console.error(e); showErr('Terjadi kesalahan: ' + (e.message || e)); }
      submit.disabled = false;
    });
    if (o.setup) o.setup(api);
    return form;
  };
  U.formModal = function (o) {
    const f = U.form(o);
    U.openModal(o.title, f, { wide: o.wide });
    const first = f.querySelector('input:not([type=checkbox]),select,textarea');
    if (first) first.focus();
    return f;
  };

  /* ---------- Grafik ringan (SVG, tanpa pustaka) ---------- */
  U.barChart = function (labels, series, opts) {
    opts = opts || {};
    const W = 640, H = opts.height || 200, pl = 6, pb = 26, pt = 8;
    const fmt = opts.format || (x => x);
    const max = Math.max(1, ...series.flatMap(s => s.values));
    const gw = (W - pl * 2) / labels.length;
    const bw = Math.min(40, (gw - 10) / series.length);
    const summary = labels.map((l, i) => l + ': ' + series.map(s => s.name + ' ' + fmt(s.values[i])).join(', ')).join('; ');
    const svg = U.svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': (opts.label || 'Grafik batang') + '. ' + summary });
    svg.append(U.svg('line', { x1: pl, x2: W - pl, y1: H - pb, y2: H - pb, class: 'axis' }));
    labels.forEach((lab, i) => {
      const gx = pl + i * gw + (gw - bw * series.length) / 2;
      series.forEach((s, j) => {
        const h = Math.round((H - pb - pt) * s.values[i] / max);
        const r = U.svg('rect', { x: gx + j * bw, y: H - pb - h, width: Math.max(1, bw - 2), height: h, rx: 3, class: 'bar ' + (s.cls || 's1') });
        r.append(U.svg('title', {}, lab + ' — ' + s.name + ': ' + fmt(s.values[i])));
        svg.append(r);
      });
      svg.append(U.svg('text', { x: pl + i * gw + gw / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis-label' }, lab));
    });
    const legend = series.length > 1 ? el('div', { class: 'legend' }, series.map(s => el('span', {}, [el('i', { class: 'dot ' + (s.cls || 's1') }), s.name]))) : null;
    return el('div', { class: 'chart-wrap' }, [svg, legend]);
  };
  U.hbars = function (items, format, cls) {
    const max = Math.max(1, ...items.map(i => i.value));
    return el('ul', { class: 'hbars' }, items.map(i => el('li', {}, [
      el('span', { class: 'hb-label', text: i.label }),
      el('span', { class: 'hb-track' }, el('span', { class: 'hb-fill ' + (i.cls || cls || ''), style: 'width:' + Math.round(i.value / max * 100) + '%' })),
      el('span', { class: 'hb-val', text: format ? format(i.value) : String(i.value) })
    ])));
  };

  /* ---------- Ekspor ---------- */
  U.csv = rows => rows.map(r => r.map(c => {
    let s = c === null || c === undefined ? '' : String(c);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di spreadsheet
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
  U.download = function (name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
