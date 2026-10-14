(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const F = (NX.fin = {});
  const METHODS = ['Tunai', 'Transfer bank', 'E-wallet', 'Kartu', 'Lainnya'];
  const ui = { q: '', type: '', category: '', from: '', to: '', sort: 'new', limit: 40 };
  const refresh = () => NX.app.refresh();

  /* ---------- Perhitungan (satu sumber kebenaran) ---------- */
  F.sum = (txs, type) => U.sum(txs.filter(t => t.type === type), t => t.amount);
  // Saldo akhir = saldo awal + total pemasukan - total pengeluaran. Saldo awal tidak pernah dihitung sebagai pemasukan.
  F.balance = () => { const st = S(); return (Number(st.settings.startingBalance) || 0) + F.sum(st.transactions, 'income') - F.sum(st.transactions, 'expense'); };
  // Dana yang sudah dialokasikan ke target tabungan (bukan pengeluaran, hanya dipisahkan dari saldo tersedia).
  F.saved = () => U.sum(S().savings, g => U.sum(g.contributions, c => c.amount));
  F.available = () => F.balance() - F.saved();
  F.inMonth = key => S().transactions.filter(t => t.date.slice(0, 7) === key);
  F.month = key => { const m = F.inMonth(key), income = F.sum(m, 'income'), expense = F.sum(m, 'expense'); return { income, expense, net: income - expense, count: m.length }; };
  F.byCategory = (key, type) => {
    const map = {};
    F.inMonth(key).filter(t => t.type === (type || 'expense')).forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.keys(map).map(k => ({ label: k, value: map[k] })).sort((a, b) => b.value - a.value);
  };
  F.months = () => { const set = new Set(S().transactions.map(t => t.date.slice(0, 7))); set.add(U.monthKey(U.today())); return Array.from(set).sort(); };
  F.parseAmount = v => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; };

  /* ---------- Formulir ---------- */
  F.openTxForm = function (tx, presetType) {
    const edit = !!tx, cats = S().categories;
    const v = Object.assign({ type: presetType || 'expense', date: U.today(), method: 'Tunai' }, tx || {});
    if (!v.category) v.category = cats[v.type][0];
    U.formModal({
      title: edit ? 'Ubah transaksi' : (v.type === 'income' ? 'Catat pemasukan' : 'Catat pengeluaran'), values: v,
      fields: [
        { name: 'type', label: 'Jenis', type: 'select', options: [{ value: 'income', label: 'Pemasukan' }, { value: 'expense', label: 'Pengeluaran' }] },
        { name: 'amount', label: 'Nominal (Rupiah)', type: 'number', min: 1, integer: true, required: true, inputmode: 'numeric', hint: 'Bilangan bulat tanpa titik, misalnya 25000.' },
        { name: 'category', label: 'Kategori', type: 'select', options: cats[v.type] || [], required: true, half: true },
        { name: 'date', label: 'Tanggal', type: 'date', required: true, half: true },
        { name: 'method', label: 'Sumber atau metode pembayaran', type: 'select', options: METHODS },
        { name: 'description', label: 'Deskripsi', hint: 'Contoh: makan siang, uang saku mingguan.' },
        { name: 'notes', label: 'Catatan (opsional)', type: 'textarea', rows: 2 }
      ],
      setup(api) { api.on('type', t => api.setOptions('category', S().categories[t])); },
      onSubmit(o) {
        const amount = F.parseAmount(o.amount);
        if (amount === null) return 'Nominal harus bilangan bulat lebih dari 0.';
        NX.storage.update(st => {
          const item = Object.assign({}, tx || {}, { id: tx ? tx.id : U.uid(), type: o.type, amount, category: o.category, date: o.date, method: o.method, description: o.description, notes: o.notes });
          if (!item.createdAt) item.createdAt = new Date().toISOString();
          if (edit) st.transactions[st.transactions.findIndex(x => x.id === tx.id)] = item; else st.transactions.push(item);
        });
        U.toast(edit ? 'Transaksi diperbarui.' : 'Transaksi dicatat.', 'ok');
        NX.budget.checkAlerts(U.monthKey(o.date));
      },
      onDelete: edit ? async () => {
        if (await U.confirm('Hapus transaksi ini?', { danger: true, okLabel: 'Hapus', detail: (tx.description || tx.category) + ' · ' + U.fmtIDR(tx.amount) + '. Saldo dan laporan akan dihitung ulang.' })) {
          NX.storage.update(st => { st.transactions = st.transactions.filter(x => x.id !== tx.id); });
          NX.budget.checkAlerts(U.monthKey(tx.date)); U.closeModal(); U.toast('Transaksi dihapus.', 'ok');
        }
      } : null
    });
  };

  F.openSetup = function () {
    const s = S().settings;
    U.formModal({
      title: 'Pengaturan keuangan awal', values: { startingBalance: s.startingBalance, incomeSources: s.incomeSources, incomeFrequency: s.incomeFrequency, monthlyBudget: S().budgets.total || '', reportPeriod: s.reportPeriod },
      fields: [
        { name: 'startingBalance', label: 'Saldo awal (Rupiah)', type: 'number', min: 0, integer: true, hint: 'Uang yang kamu miliki saat mulai mencatat. Boleh 0 atau dikosongkan.' },
        { name: 'incomeSources', label: 'Sumber pemasukan (opsional)', placeholder: 'Contoh: uang saku, hasil jualan' },
        { name: 'incomeFrequency', label: 'Frekuensi pemasukan', type: 'select', options: [{ value: '', label: 'Tidak tetap / belum diatur' }, { value: 'mingguan', label: 'Mingguan' }, { value: 'bulanan', label: 'Bulanan' }, { value: 'lainnya', label: 'Lainnya' }] },
        { name: 'monthlyBudget', label: 'Anggaran bulanan (opsional)', type: 'number', min: 0, integer: true, hint: 'Rincian per kategori diatur di menu Anggaran.' },
        { name: 'reportPeriod', label: 'Periode laporan utama', type: 'select', options: [{ value: 'mingguan', label: 'Mingguan' }, { value: 'bulanan', label: 'Bulanan' }] }
      ],
      submitLabel: 'Simpan pengaturan',
      onSubmit(o) {
        NX.storage.update(st => { Object.assign(st.settings, { startingBalance: o.startingBalance || 0, incomeSources: o.incomeSources, incomeFrequency: o.incomeFrequency, reportPeriod: o.reportPeriod, financeSetup: 'done' }); st.budgets.total = o.monthlyBudget || 0; });
        U.toast('Pengaturan keuangan disimpan.', 'ok');
      }
    });
  };

  /* ---------- Daftar transaksi ---------- */
  function filtered() {
    let list = S().transactions.slice();
    const q = ui.q.toLowerCase();
    if (q) list = list.filter(t => ((t.description || '') + ' ' + t.category + ' ' + (t.notes || '') + ' ' + (t.method || '')).toLowerCase().includes(q));
    if (ui.type) list = list.filter(t => t.type === ui.type);
    if (ui.category) list = list.filter(t => t.category === ui.category);
    if (ui.from) list = list.filter(t => t.date >= ui.from);
    if (ui.to) list = list.filter(t => t.date <= ui.to);
    const byDate = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '');
    if (ui.sort === 'new') list.sort((a, b) => byDate(b, a));
    else if (ui.sort === 'old') list.sort(byDate);
    else if (ui.sort === 'big') list.sort((a, b) => b.amount - a.amount);
    else list.sort((a, b) => a.amount - b.amount);
    return list;
  }
  F.exportCSV = function () {
    const rows = [['Tanggal', 'Jenis', 'Kategori', 'Nominal (IDR)', 'Metode', 'Deskripsi', 'Catatan']].concat(filtered().map(t => [t.date, t.type === 'income' ? 'Pemasukan' : 'Pengeluaran', t.category, t.amount, t.method || '', t.description || '', t.notes || '']));
    U.download('nexus-transaksi-' + U.today() + '.csv', '\ufeff' + U.csv(rows), 'text/csv;charset=utf-8');
  };

  NX.views.keuangan = {
    render(host) {
      const st = S(), key = U.monthKey(U.today()), m = F.month(key);
      if (st.settings.financeSetup === 'pending') host.append(el('section', { class: 'card note info' }, [el('strong', { text: 'Atur keuangan awalmu (opsional)' }), el('p', { class: 'muted', text: 'Isi saldo awal dan sumber pemasukan agar saldo akurat. Semua kolom boleh dikosongkan.' }), el('div', { class: 'row gap' }, [el('button', { class: 'btn primary', type: 'button', text: 'Atur sekarang', onclick: () => F.openSetup() }), el('button', { class: 'btn', type: 'button', text: 'Lewati', onclick: () => NX.storage.update(s => { s.settings.financeSetup = 'skipped'; }) })])]));
      host.append(el('div', { class: 'grid stats' }, [
        U.stat('Saldo', U.fmtIDR(F.balance()), 'Tersedia ' + U.fmtIDR(F.available()) + ' · dialokasikan ke tabungan ' + U.fmtIDR(F.saved())),
        U.stat('Pemasukan ' + U.fmtMonth(key), U.fmtIDR(m.income), null, 'ok'),
        U.stat('Pengeluaran ' + U.fmtMonth(key), U.fmtIDR(m.expense), null, 'warn'),
        U.stat('Selisih bulan ini', U.fmtIDR(m.net), m.net >= 0 ? 'Pemasukan lebih besar' : 'Pengeluaran lebih besar', m.net >= 0 ? 'ok' : 'bad')
      ]));
      host.append(el('div', { class: 'toolbar wrap' }, [el('h2', { class: 'section-title', text: 'Riwayat transaksi' }), el('div', { class: 'row gap wrap' }, [
        el('button', { class: 'btn primary', type: 'button', text: 'Catat pemasukan', onclick: () => F.openTxForm(null, 'income') }),
        el('button', { class: 'btn primary', type: 'button', text: 'Catat pengeluaran', onclick: () => F.openTxForm(null, 'expense') }),
        el('button', { class: 'btn', type: 'button', text: 'Ekspor CSV', onclick: () => F.exportCSV() }),
        el('button', { class: 'btn', type: 'button', text: 'Pengaturan keuangan', onclick: () => F.openSetup() })])]));
      const allCats = Array.from(new Set(st.categories.income.concat(st.categories.expense)));
      const sel = (label, key2, opts) => { const s = el('select', { 'aria-label': label }, opts.map(o => el('option', { value: o[0], text: o[1] }))); s.value = ui[key2]; s.addEventListener('change', () => { ui[key2] = s.value; ui.limit = 40; renderList(); }); return s; };
      const dt = (label, key2) => { const i = el('input', { type: 'date', 'aria-label': label, title: label, value: ui[key2] }); i.addEventListener('change', () => { ui[key2] = U.isDate(i.value) ? i.value : ''; ui.limit = 40; renderList(); }); return i; };
      const q = el('input', { type: 'search', placeholder: 'Cari transaksi', 'aria-label': 'Cari transaksi', value: ui.q });
      q.addEventListener('input', U.debounce(() => { ui.q = q.value.trim(); ui.limit = 40; renderList(); }, 200));
      host.append(el('div', { class: 'filters' }, [q, sel('Semua jenis', 'type', [['', 'Semua jenis'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran']]), sel('Semua kategori', 'category', [['', 'Semua kategori']].concat(allCats.map(c => [c, c]))), dt('Dari tanggal', 'from'), dt('Sampai tanggal', 'to'), sel('Urutan', 'sort', [['new', 'Terbaru'], ['old', 'Terlama'], ['big', 'Nominal terbesar'], ['small', 'Nominal terkecil']])]));
      const box = el('section', { class: 'card' });
      host.append(box);
      function renderList() {
        const list = filtered();
        box.replaceChildren();
        if (!list.length) { box.append(U.empty(S().transactions.length ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi', S().transactions.length ? 'Ubah filter untuk melihat transaksi lain.' : 'Catat pemasukan atau pengeluaran pertamamu. Semua ringkasan dihitung dari catatan ini.')); return; }
        box.append(el('ul', { class: 'txs' }, list.slice(0, ui.limit).map(t => el('li', { class: 'tx ' + t.type }, [
          el('div', { class: 'tx-main' }, [el('strong', { text: t.description || t.category }), el('span', { class: 'muted small', text: U.fmtDate(t.date, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + t.category + (t.method ? ' · ' + t.method : '') })]),
          el('span', { class: 'tx-amt', text: (t.type === 'income' ? '+' : '−') + U.fmtIDR(t.amount) }),
          el('button', { type: 'button', class: 'btn small', text: 'Ubah', 'aria-label': 'Ubah transaksi ' + (t.description || t.category), onclick: () => F.openTxForm(t) })]))));
        const tot = el('p', { class: 'muted small', text: 'Menampilkan ' + Math.min(ui.limit, list.length) + ' dari ' + list.length + ' transaksi. Pemasukan ' + U.fmtIDR(F.sum(list, 'income')) + ', pengeluaran ' + U.fmtIDR(F.sum(list, 'expense')) + '.' });
        box.append(tot);
        if (list.length > ui.limit) box.append(el('button', { type: 'button', class: 'btn', text: 'Tampilkan lebih banyak', onclick: () => { ui.limit += 40; renderList(); } }));
      }
      renderList();
    }
  };
})();
