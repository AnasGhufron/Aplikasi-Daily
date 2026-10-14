(function () {
  'use strict';
  const NX = window.NX, U = NX.util;
  const KEY = 'nexus.v1', BACKUP = 'nexus.backup.v1', SCHEMA = 1;
  const status = { memoryOnly: false, recovered: false, quotaError: false };
  let state = null, memBackup = null;

  const ARR = ['schedule', 'exceptions', 'sessions', 'tasks', 'transactions', 'savings', 'routines', 'habits'];
  const OBJ = ['settings', 'categories', 'progress', 'budgets', 'routineLogs', 'habitLogs', 'reviews', 'alerts'];
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const isInt = n => Number.isSafeInteger(n);

  function defaults() {
    return {
      version: SCHEMA,
      settings: {
        theme: 'dark', name: '', startingBalance: 0, incomeSources: '', incomeFrequency: '', reportPeriod: 'bulanan',
        financeSetup: 'pending', travelMinutes: 0, wake: '06:00', sleep: '22:00', dailyGoalMin: 120, weeklyGoalMin: 840,
        remindersOn: true, browserNotif: false, reminderLead: 10
      },
      categories: {
        income: ['Uang saku', 'Hadiah', 'Penghasilan', 'Penjualan', 'Pemasukan lainnya'],
        expense: ['Makanan', 'Transportasi', 'Pendidikan', 'Kebutuhan pribadi', 'Hiburan', 'Langganan', 'Kesehatan', 'Tabungan', 'Pengeluaran lainnya']
      },
      schedule: [], exceptions: [], sessions: [], progress: {}, tasks: [], transactions: [],
      budgets: { total: 0, categories: {} }, savings: [], routines: [], routineLogs: {}, habits: [], habitLogs: {}, reviews: {}, alerts: {}
    };
  }

  function validate(o) {
    if (!isObj(o)) return { ok: false, error: 'Berkas bukan data NEXUS yang valid (bukan objek JSON).' };
    if (o.version !== undefined && (!isInt(o.version) || o.version < 1 || o.version > SCHEMA)) return { ok: false, error: 'Versi data tidak didukung: ' + o.version + '.' };
    if (!ARR.concat(OBJ).some(k => o[k] !== undefined)) return { ok: false, error: 'Berkas tidak berisi data NEXUS yang dikenali.' };
    for (const k of ARR) if (o[k] !== undefined && !Array.isArray(o[k])) return { ok: false, error: 'Bagian "' + k + '" harus berupa daftar.' };
    for (const k of OBJ) if (o[k] !== undefined && !isObj(o[k])) return { ok: false, error: 'Bagian "' + k + '" tidak valid.' };
    const bad = (k, i, why) => ({ ok: false, error: 'Data "' + k + '" nomor ' + (i + 1) + ': ' + why + '.' });
    const list = k => o[k] || [];
    const tOK = x => U.isTime(x);
    const checks = {
      transactions: t => !isObj(t) ? 'bukan objek' : (t.type !== 'income' && t.type !== 'expense') ? 'jenis tidak valid' : (!isInt(t.amount) || t.amount <= 0) ? 'nominal tidak valid' : !U.isDate(t.date) ? 'tanggal tidak valid' : (typeof t.category !== 'string' || !t.category) ? 'kategori kosong' : null,
      schedule: c => !isObj(c) ? 'bukan objek' : typeof c.title !== 'string' ? 'judul tidak valid' : (!tOK(c.start) || !tOK(c.end) || c.end <= c.start) ? 'jam tidak valid' : (c.recurring === false ? !U.isDate(c.date) : !(isInt(c.day) && c.day >= 0 && c.day <= 6)) ? 'hari atau tanggal tidak valid' : null,
      exceptions: e => !isObj(e) ? 'bukan objek' : !U.isDate(e.date) ? 'tanggal tidak valid' : ['libur', 'pengecualian', 'sekolah'].indexOf(e.type) < 0 ? 'jenis tidak valid' : null,
      sessions: s => !isObj(s) ? 'bukan objek' : typeof s.title !== 'string' ? 'judul tidak valid' : !U.isDate(s.date) ? 'tanggal tidak valid' : (!tOK(s.start) || !tOK(s.end) || s.end <= s.start) ? 'jam tidak valid' : ['direncanakan', 'selesai', 'terlewat', 'dijadwalkan_ulang'].indexOf(s.status) < 0 ? 'status tidak valid' : null,
      tasks: t => !isObj(t) ? 'bukan objek' : typeof t.title !== 'string' || !t.title ? 'judul tidak valid' : ['todo', 'doing', 'done'].indexOf(t.status) < 0 ? 'status tidak valid' : (t.due && !U.isDate(t.due)) ? 'tenggat tidak valid' : null,
      savings: g => !isObj(g) ? 'bukan objek' : typeof g.name !== 'string' ? 'nama tidak valid' : (!isInt(g.target) || g.target <= 0) ? 'nominal target tidak valid' : (g.contributions !== undefined && (!Array.isArray(g.contributions) || g.contributions.some(c => !isObj(c) || !isInt(c.amount) || !U.isDate(c.date)))) ? 'kontribusi tidak valid' : null,
      routines: r => !isObj(r) ? 'bukan objek' : (typeof r.title !== 'string' || !tOK(r.start)) ? 'data tidak valid' : null,
      habits: h => !isObj(h) ? 'bukan objek' : typeof h.name !== 'string' ? 'nama tidak valid' : null
    };
    for (const k of Object.keys(checks)) {
      const arr = list(k);
      for (let i = 0; i < arr.length; i++) { const why = checks[k](arr[i]); if (why) return bad(k, i, why); }
    }
    if (o.settings && o.settings.startingBalance !== undefined && !Number.isFinite(o.settings.startingBalance)) return { ok: false, error: 'Saldo awal tidak valid.' };
    return { ok: true };
  }

  function strList(a, fallback) {
    const out = [];
    (Array.isArray(a) && a.length ? a : fallback).forEach(x => { if (typeof x === 'string' && x.trim() && out.indexOf(x.trim()) < 0) out.push(x.trim()); });
    return out;
  }
  function migrate(o) {
    const d = defaults();
    const s = Object.assign({}, d, o);
    delete s.app; delete s.exportedAt;
    s.version = SCHEMA;
    s.settings = Object.assign({}, d.settings, isObj(o.settings) ? o.settings : {});
    const cat = isObj(o.categories) ? o.categories : {};
    s.categories = { income: strList(cat.income, d.categories.income), expense: strList(cat.expense, d.categories.expense) };
    const b = isObj(o.budgets) ? o.budgets : {};
    s.budgets = { total: Number.isFinite(b.total) && b.total > 0 ? b.total : 0, categories: isObj(b.categories) ? b.categories : {} };
    ARR.forEach(k => { s[k] = Array.isArray(o[k]) ? o[k] : []; s[k].forEach(it => { if (isObj(it) && !it.id) it.id = U.uid(); }); });
    s.savings.forEach(g => { if (!Array.isArray(g.contributions)) g.contributions = []; g.contributions.forEach(c => { if (!c.id) c.id = U.uid(); }); });
    ['progress', 'routineLogs', 'habitLogs', 'reviews', 'alerts'].forEach(k => { s[k] = isObj(o[k]) ? o[k] : {}; });
    s.transactions.forEach(t => { if (s.categories[t.type].indexOf(t.category) < 0) s.categories[t.type].push(t.category); });
    return s;
  }
  function mergeStates(cur, inc) {
    const out = JSON.parse(JSON.stringify(cur));
    ARR.forEach(k => { const ids = new Set(out[k].map(x => x.id)); inc[k].forEach(x => { if (!ids.has(x.id)) out[k].push(x); }); });
    inc.savings.forEach(g => {
      const mine = out.savings.find(x => x.id === g.id);
      if (mine) { const cids = new Set(mine.contributions.map(c => c.id)); g.contributions.forEach(c => { if (!cids.has(c.id)) mine.contributions.push(c); }); }
    });
    ['income', 'expense'].forEach(t => inc.categories[t].forEach(c => { if (out.categories[t].indexOf(c) < 0) out.categories[t].push(c); }));
    ['progress', 'routineLogs', 'habitLogs', 'reviews', 'alerts'].forEach(k => { out[k] = Object.assign({}, inc[k], out[k]); });
    out.budgets.categories = Object.assign({}, inc.budgets.categories, out.budgets.categories);
    if (!out.budgets.total) out.budgets.total = inc.budgets.total;
    return out;
  }
  function summarize(d) {
    return [['Jadwal sekolah', d.schedule.length], ['Pengecualian jadwal', d.exceptions.length], ['Sesi belajar', d.sessions.length], ['Materi dengan progres', Object.keys(d.progress).length],
      ['Tugas', d.tasks.length], ['Transaksi', d.transactions.length], ['Target tabungan', d.savings.length], ['Rutinitas', d.routines.length], ['Kebiasaan', d.habits.length]];
  }
  function storageOK() { try { localStorage.setItem('__nx__', '1'); localStorage.removeItem('__nx__'); return true; } catch (e) { return false; } }
  function persist() {
    if (status.memoryOnly) return true;
    try { localStorage.setItem(KEY, JSON.stringify(state)); status.quotaError = false; return true; }
    catch (e) { status.quotaError = true; NX.bus.emit('storage-error', e); return false; }
  }

  NX.storage = {
    status,
    init() {
      status.memoryOnly = !storageOK();
      let raw = null;
      if (!status.memoryOnly) { try { raw = localStorage.getItem(KEY); } catch (e) { status.memoryOnly = true; } }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const v = validate(parsed);
          if (!v.ok) throw new Error(v.error);
          state = migrate(parsed);
        } catch (e) {
          try { localStorage.setItem(KEY + '.rusak.' + Date.now(), raw); } catch (_) { /* abaikan */ }
          status.recovered = true;
          state = defaults();
        }
      } else state = defaults();
      return state;
    },
    get: () => state,
    update(fn, opts) {
      const r = fn(state);
      persist();
      if (!(opts && opts.silent)) NX.bus.emit('change');
      return r;
    },
    exportJSON() { return JSON.stringify(Object.assign({ app: 'NEXUS', exportedAt: new Date().toISOString() }, state), null, 2); },
    parseImport(text) {
      let o;
      try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'Berkas bukan JSON yang valid.' }; }
      const v = validate(o);
      if (!v.ok) return v;
      const data = migrate(o);
      return { ok: true, data, summary: summarize(data) };
    },
    summarize,
    applyImport(data, mode) {
      NX.storage.backup();
      state = mode === 'merge' ? migrate(mergeStates(state, data)) : migrate(data);
      persist();
      NX.bus.emit('change');
    },
    backup() {
      const snap = { createdAt: new Date().toISOString(), data: state };
      if (status.memoryOnly) { memBackup = JSON.parse(JSON.stringify(snap)); return true; }
      try { localStorage.setItem(BACKUP, JSON.stringify(snap)); return true; } catch (e) { return false; }
    },
    backupInfo() {
      try {
        const s = status.memoryOnly ? memBackup : JSON.parse(localStorage.getItem(BACKUP) || 'null');
        return s && s.data ? { createdAt: s.createdAt, summary: summarize(migrate(s.data)) } : null;
      } catch (e) { return null; }
    },
    restoreBackup() {
      try {
        const s = status.memoryOnly ? memBackup : JSON.parse(localStorage.getItem(BACKUP) || 'null');
        if (!s || !s.data) return false;
        const v = validate(s.data);
        if (!v.ok) return false;
        state = migrate(s.data);
        persist();
        NX.bus.emit('change');
        return true;
      } catch (e) { return false; }
    },
    reset() { NX.storage.backup(); state = defaults(); persist(); NX.bus.emit('change'); },
    _defaults: defaults, _validate: validate, _migrate: migrate
  };
})();
