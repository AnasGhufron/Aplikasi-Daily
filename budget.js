(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const B = (NX.budget = {});
  const THRESHOLDS = [75, 90, 100];
  const ui = { month: U.monthKey(U.today()) };
  const refresh = () => NX.app.refresh();
  const kind = pct => (pct >= 100 ? 'bad' : pct >= 90 ? 'warn' : pct >= 75 ? 'caution' : '');
  const label = pct => (pct >= 100 ? 'Melewati anggaran' : pct >= 90 ? 'Hampir habis' : pct >= 75 ? 'Perlu diperhatikan' : 'Aman');

  // Anggaran berlaku sama untuk setiap bulan; riwayat membandingkannya dengan pengeluaran aktual per bulan.
  B.status = function (key) {
    const st = S(), spent = {};
    NX.fin.inMonth(key).filter(t => t.type === 'expense').forEach(t => { spent[t.category] = (spent[t.category] || 0) + t.amount; });
    const used = U.sum(Object.keys(spent), k => spent[k]);
    const budget = st.budgets.total || 0;
    const cats = Object.keys(st.budgets.categories).filter(c => st.budgets.categories[c] > 0).map(c => {
      const b = st.budgets.categories[c], u = spent[c] || 0;
      return { cat: c, budget: b, used: u, left: b - u, pct: Math.round(u / b * 100) };
    });
    return { total: { budget, used, left: budget - used, pct: budget ? Math.round(used / budget * 100) : 0 }, cats, spent };
  };

  // Peringatan 75/90/100%: setiap ambang hanya sekali per bulan dan per anggaran; dilepas lagi bila pemakaian turun.
  B.checkAlerts = function (key) {
    const stat = B.status(key), items = [];
    if (stat.total.budget > 0) items.push({ scope: 'total', name: 'anggaran bulanan', pct: stat.total.pct });
    stat.cats.forEach(c => items.push({ scope: 'cat:' + c.cat, name: 'anggaran ' + c.cat, pct: c.pct }));
    const fresh = [];
    NX.storage.update(st => {
      items.forEach(it => {
        let top = 0;
        THRESHOLDS.forEach(th => {
          const k = key + '|' + it.scope + '|' + th;
          if (it.pct >= th) { if (!st.alerts[k]) { st.alerts[k] = 1; top = th; } } else if (st.alerts[k]) delete st.alerts[k];
        });
        if (top) fresh.push({ name: it.name, th: top, pct: it.pct });
      });
      Object.keys(st.alerts).forEach(k => { const p = k.split('|'); if (p[0] === key && p[1] !== 'total' && !items.some(i => i.scope === p[1])) delete st.alerts[k]; });
    }, { silent: true });
    fresh.forEach(f => U.toast('Pemakaian ' + f.name + ' sudah ' + f.pct + '% (ambang ' + f.th + '%).', f.th >= 100 ? 'error' : 'warn'));
    return fresh;
  };

  B.nearLimit = function (key) {
    const s = B.status(key), out = [];
    if (s.total.budget && s.total.pct >= 75) out.push({ name: 'Anggaran bulanan', pct: s.total.pct });
    s.cats.filter(c => c.pct >= 75).forEach(c => out.push({ name: c.cat, pct: c.pct }));
    return out;
  };

  function openBudgetForm() {
    const st = S(), cats = st.categories.expense;
    const v = { total: st.budgets.total || '' };
    cats.forEach((c, i) => { v['c' + i] = st.budgets.categories[c] || ''; });
    U.formModal({
      title: 'Atur anggaran bulanan', values: v, wide: true,
      fields: [{ name: 'total', label: 'Anggaran keseluruhan per bulan (Rupiah)', type: 'number', min: 0, integer: true, hint: 'Kosongkan atau isi 0 bila tidak ingin membatasi.' }]
        .concat(cats.map((c, i) => ({ name: 'c' + i, label: 'Anggaran ' + c, type: 'number', min: 0, integer: true, half: true }))),
      onSubmit(o) {
        NX.storage.update(s => { s.budgets.total = o.total || 0; s.budgets.categories = {}; cats.forEach((c, i) => { if (o['c' + i] > 0) s.budgets.categories[c] = o['c' + i]; }); });
        U.toast('Anggaran disimpan.', 'ok');
        B.checkAlerts(ui.month);
      }
    });
  }

  NX.views.anggaran = {
    render(host) {
      const key = ui.month, s = B.status(key), st = S();
      const shift = n => { ui.month = U.addMonths(ui.month, n); refresh(); };
      host.append(el('div', { class: 'toolbar wrap' }, [
        el('h2', { class: 'section-title', text: 'Anggaran ' + U.fmtMonth(key) }),
        el('div', { class: 'row gap' }, [el('button', { class: 'btn', type: 'button', 'aria-label': 'Bulan sebelumnya', text: '‹', onclick: () => shift(-1) }), el('button', { class: 'btn', type: 'button', text: 'Bulan ini', onclick: () => { ui.month = U.monthKey(U.today()); refresh(); } }), el('button', { class: 'btn', type: 'button', 'aria-label': 'Bulan berikutnya', text: '›', onclick: () => shift(1) }), el('button', { class: 'btn primary', type: 'button', text: 'Atur anggaran', onclick: openBudgetForm })])
      ]));
      const card = el('section', { class: 'card' }, [el('h3', { text: 'Anggaran keseluruhan' })]);
      if (!s.total.budget) card.append(U.empty('Anggaran keseluruhan belum diatur', 'Tentukan batas pengeluaran bulanan agar kamu bisa memantau sisanya.', el('button', { class: 'btn primary', type: 'button', text: 'Atur anggaran', onclick: openBudgetForm })));
      else card.append(el('div', { class: 'row between' }, [el('strong', { text: U.fmtIDR(s.total.used) + ' dari ' + U.fmtIDR(s.total.budget) }), U.badge(s.total.pct + '% · ' + label(s.total.pct), kind(s.total.pct) || 'ok')]), U.progress(s.total.pct, kind(s.total.pct), 'Pemakaian anggaran keseluruhan'),
        el('p', { class: 'muted', text: s.total.left >= 0 ? 'Sisa anggaran ' + U.fmtIDR(s.total.left) + '.' : 'Pengeluaran melewati anggaran sebesar ' + U.fmtIDR(-s.total.left) + '.' }));
      host.append(card);
      const cc = el('section', { class: 'card' }, [el('h3', { text: 'Anggaran per kategori' })]);
      if (!s.cats.length) cc.append(el('p', { class: 'muted', text: 'Belum ada anggaran per kategori.' }));
      else s.cats.forEach(c => cc.append(el('div', { class: 'budget-row' }, [el('div', { class: 'row between' }, [el('strong', { text: c.cat }), U.badge(c.pct + '%', kind(c.pct) || 'ok')]), U.progress(c.pct, kind(c.pct), 'Pemakaian anggaran ' + c.cat), el('span', { class: 'muted small', text: U.fmtIDR(c.used) + ' dari ' + U.fmtIDR(c.budget) + (c.left >= 0 ? ' · sisa ' + U.fmtIDR(c.left) : ' · lebih ' + U.fmtIDR(-c.left)) })])));
      const unb = Object.keys(s.spent).filter(c => !(st.budgets.categories[c] > 0));
      if (unb.length) cc.append(el('p', { class: 'muted small', text: 'Pengeluaran tanpa anggaran kategori: ' + unb.map(c => c + ' ' + U.fmtIDR(s.spent[c])).join(', ') + '.' }));
      host.append(cc);
      // Riwayat: anggaran saat ini dibandingkan dengan pengeluaran aktual tiap bulan
      const months = NX.fin.months().slice(-6);
      const hist = el('section', { class: 'card' }, [el('h3', { text: 'Riwayat bulanan' })]);
      if (!st.budgets.total) hist.append(el('p', { class: 'muted', text: 'Atur anggaran keseluruhan untuk membandingkannya dengan pengeluaran tiap bulan.' }));
      else hist.append(el('div', { class: 'scroll-x' }, el('table', { class: 'table' }, [el('thead', {}, el('tr', {}, ['Bulan', 'Anggaran', 'Pengeluaran', 'Selisih'].map(h => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, months.map(k => { const u = NX.fin.month(k).expense, d = st.budgets.total - u; return el('tr', {}, [el('td', { text: U.fmtMonth(k) }), el('td', { text: U.fmtIDR(st.budgets.total) }), el('td', { text: U.fmtIDR(u) }), el('td', { class: d < 0 ? 'neg' : '', text: (d < 0 ? 'Lebih ' : 'Sisa ') + U.fmtIDR(Math.abs(d)) })]); }))])), el('p', { class: 'muted small', text: 'Anggaran yang berlaku adalah anggaran terkini untuk semua bulan.' }));
      host.append(hist);
    }
  };
})();
