(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const R = (NX.reports = {});
  const ui = { tab: null, week: U.weekStart(U.today()), month: U.monthKey(U.today()) };
  const refresh = () => NX.app.refresh();
  const section = (title, kids) => el('section', { class: 'card' }, [el('h3', { text: title })].concat(kids));

  // Insight hanya dibuat dari data yang ada. Bila data belum cukup, dikatakan terus terang.
  R.insights = function (key) {
    const out = [], m = NX.fin.month(key), tx = NX.fin.inMonth(key).filter(t => t.type === 'expense');
    if (m.count < 3) return { enough: false, items: ['Data bulan ini belum cukup untuk analisis (minimal 3 transaksi). Teruslah mencatat.'] };
    const cats = NX.fin.byCategory(key, 'expense');
    if (cats.length && m.expense > 0) out.push('Pengeluaran terbesar bulan ini ada di kategori ' + cats[0].label + ' (' + U.fmtIDR(cats[0].value) + ', ' + Math.round(cats[0].value / m.expense * 100) + '% dari total pengeluaran).');
    NX.budget.nearLimit(key).forEach(n => out.push(n.name + ' sudah terpakai ' + n.pct + '%' + (n.pct >= 100 ? ' dan melewati batas.' : '. Perhatikan sisa hari di bulan ini.')));
    const prev = NX.fin.month(U.addMonths(key, -1));
    if (prev.expense > 0 && m.expense > 0) {
      const diff = Math.round((m.expense - prev.expense) / prev.expense * 100);
      out.push('Dibandingkan bulan lalu, pengeluaran ' + (diff >= 0 ? 'naik ' : 'turun ') + Math.abs(diff) + '%.');
    }
    // Pengeluaran berulang: deskripsi dan nominal sama di minimal 2 bulan berbeda
    const groups = {};
    S().transactions.filter(t => t.type === 'expense' && t.description).forEach(t => { const k = t.description.trim().toLowerCase() + '|' + t.amount; (groups[k] = groups[k] || new Set()).add(t.date.slice(0, 7)); });
    const rec = tx.filter(t => t.description && groups[t.description.trim().toLowerCase() + '|' + t.amount] && groups[t.description.trim().toLowerCase() + '|' + t.amount].size >= 2);
    const seen = new Set();
    rec.forEach(t => { const k = t.description.trim().toLowerCase(); if (!seen.has(k) && seen.size < 3) { seen.add(k); out.push('"' + t.description + '" (' + U.fmtIDR(t.amount) + ') muncul berulang di beberapa bulan. Mungkin layak ditinjau apakah masih dibutuhkan.'); } });
    const avg = NX.savings.avgNet();
    if (avg !== null) out.push(avg > 0 ? 'Dari bulan-bulan sebelumnya, selisih pemasukan dan pengeluaranmu rata-rata ' + U.fmtIDR(avg) + ' per bulan. Itulah perkiraan kemampuan menabung bila polanya sama.' : 'Dari bulan-bulan sebelumnya, pengeluaran rata-rata sedikit melebihi pemasukan (' + U.fmtIDR(avg) + ' per bulan). Menabung mungkin perlu menunggu atau menyesuaikan pengeluaran.');
    return { enough: true, items: out.length ? out : ['Belum ada pola khusus yang menonjol bulan ini.'] };
  };

  function weekly(host) {
    const ws = ui.week, we = U.addDays(ws, 6), st = S(), w = NX.schedule.weekStats(ws), goal = Number(st.settings.weeklyGoalMin) || 0;
    const shift = n => { ui.week = U.addDays(ws, n * 7); refresh(); };
    host.append(el('div', { class: 'toolbar wrap' }, [el('h2', { class: 'section-title', text: 'Pekan ' + U.fmtShort(ws) + ' – ' + U.fmtShort(we) }), el('div', { class: 'row gap' }, [el('button', { class: 'btn', type: 'button', 'aria-label': 'Pekan sebelumnya', text: '‹', onclick: () => shift(-1) }), el('button', { class: 'btn', type: 'button', text: 'Pekan ini', onclick: () => { ui.week = U.weekStart(U.today()); refresh(); } }), el('button', { class: 'btn', type: 'button', 'aria-label': 'Pekan berikutnya', text: '›', onclick: () => shift(1) })])]));
    host.append(section('Belajar', [
      el('div', { class: 'grid stats' }, [U.stat('Waktu belajar', U.fmtDur(w.done), goal ? 'Target ' + U.fmtDur(goal) : null), U.stat('Sesi selesai', String(w.doneCount), w.missed + ' terlewat'), U.stat('Hari aktif', w.activeDays + ' dari 7')]),
      U.barChart(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], [{ name: 'Menit belajar', values: w.perDay, cls: 's1' }], { label: 'Menit belajar per hari', format: x => x + ' mnt', height: 170 }),
      el('ul', { class: 'bullets' }, NX.schedule.recommend(ws, goal).map(t => el('li', { text: t })))]));
    const due = st.tasks.filter(t => t.due >= ws && t.due <= we), dn = due.filter(t => t.status === 'done').length;
    host.append(section('Tugas', [due.length ? el('p', { text: dn + ' dari ' + due.length + ' tugas dengan tenggat pekan ini sudah selesai.' }) : el('p', { class: 'muted', text: 'Tidak ada tugas dengan tenggat di pekan ini.' }), U.progress(due.length ? dn / due.length * 100 : 0, '', 'Tugas selesai pekan ini')]));
    const tx = st.transactions.filter(t => t.date >= ws && t.date <= we);
    host.append(section('Keuangan', [tx.length ? el('div', { class: 'grid stats' }, [U.stat('Pemasukan', U.fmtIDR(NX.fin.sum(tx, 'income')), null, 'ok'), U.stat('Pengeluaran', U.fmtIDR(NX.fin.sum(tx, 'expense')), tx.length + ' transaksi', 'warn')]) : el('p', { class: 'muted', text: 'Belum ada transaksi di pekan ini.' })]));
    const hr = NX.habits.weekRate(ws);
    host.append(section('Kebiasaan', [hr ? el('p', { text: hr.done + ' dari ' + hr.target + ' target kebiasaan tercapai (' + hr.pct + '%).' }) : el('p', { class: 'muted', text: 'Belum ada kebiasaan yang dilacak.' })]));
  }

  function monthly(host) {
    const key = ui.month, st = S(), m = NX.fin.month(key), prev = NX.fin.month(U.addMonths(key, -1));
    const shift = n => { ui.month = U.addMonths(key, n); refresh(); };
    host.append(el('div', { class: 'toolbar wrap' }, [el('h2', { class: 'section-title', text: U.fmtMonth(key) }), el('div', { class: 'row gap' }, [el('button', { class: 'btn', type: 'button', 'aria-label': 'Bulan sebelumnya', text: '‹', onclick: () => shift(-1) }), el('button', { class: 'btn', type: 'button', text: 'Bulan ini', onclick: () => { ui.month = U.monthKey(U.today()); refresh(); } }), el('button', { class: 'btn', type: 'button', 'aria-label': 'Bulan berikutnya', text: '›', onclick: () => shift(1) })])]));
    host.append(el('div', { class: 'grid stats' }, [U.stat('Pemasukan', U.fmtIDR(m.income), 'Bulan lalu ' + U.fmtIDR(prev.income), 'ok'), U.stat('Pengeluaran', U.fmtIDR(m.expense), 'Bulan lalu ' + U.fmtIDR(prev.expense), 'warn'), U.stat('Selisih', U.fmtIDR(m.net), m.count + ' transaksi', m.net >= 0 ? 'ok' : 'bad'), U.stat('Saldo saat ini', U.fmtIDR(NX.fin.balance()))]));
    const months = []; for (let i = 5; i >= 0; i--) months.push(U.addMonths(key, -i));
    host.append(section('Pemasukan dan pengeluaran 6 bulan', [U.barChart(months.map(U.fmtMonthShort), [{ name: 'Pemasukan', values: months.map(k => NX.fin.month(k).income), cls: 's1' }, { name: 'Pengeluaran', values: months.map(k => NX.fin.month(k).expense), cls: 's2' }], { label: 'Pemasukan dan pengeluaran per bulan', format: U.fmtIDR })]));
    const cats = NX.fin.byCategory(key, 'expense');
    host.append(section('Pengeluaran per kategori', [cats.length ? U.hbars(cats, U.fmtIDR) : el('p', { class: 'muted', text: 'Belum ada pengeluaran di bulan ini.' })]));
    const bs = NX.budget.status(key);
    host.append(section('Anggaran dan tabungan', [bs.total.budget ? el('p', { text: 'Anggaran terpakai ' + bs.total.pct + '% (' + U.fmtIDR(bs.total.used) + ' dari ' + U.fmtIDR(bs.total.budget) + ').' }) : el('p', { class: 'muted', text: 'Anggaran keseluruhan belum diatur.' }),
      st.savings.length ? el('ul', { class: 'list' }, st.savings.map(g => { const got = NX.savings.collected(g); return el('li', {}, [el('div', { class: 'row between' }, [el('span', { text: g.name }), el('span', { text: U.fmtIDR(got) + ' / ' + U.fmtIDR(g.target) })]), U.progress(Math.min(100, got / g.target * 100), '', 'Progres ' + g.name)]); })) : el('p', { class: 'muted', text: 'Belum ada target tabungan.' })]));
    const ins = R.insights(key);
    host.append(section('Wawasan dari datamu', [el('ul', { class: 'bullets' }, ins.items.map(t => el('li', { text: t }))), el('p', { class: 'muted small', text: 'Wawasan dihitung dari transaksi yang kamu catat, bukan saran keuangan profesional.' })]));
  }

  NX.views.laporan = {
    render(host) {
      if (!ui.tab) ui.tab = S().settings.reportPeriod === 'mingguan' ? 'mingguan' : 'bulanan';
      host.append(el('div', { class: 'toolbar' }, U.tabs([['mingguan', 'Mingguan'], ['bulanan', 'Bulanan']], ui.tab, v => { ui.tab = v; refresh(); }, 'Periode laporan')));
      if (ui.tab === 'mingguan') weekly(host); else monthly(host);
    }
  };
})();
