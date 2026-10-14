(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const V = (NX.savings = {});
  const collected = g => U.sum(g.contributions, c => c.amount);
  V.collected = collected;
  V.totals = () => { const gs = S().savings; return { target: U.sum(gs, g => g.target), saved: U.sum(gs, collected), count: gs.length, achieved: gs.filter(g => collected(g) >= g.target || g.achieved).length }; };

  // Rata-rata selisih pemasukan dan pengeluaran dari maksimal 3 bulan terakhir yang punya pemasukan tercatat.
  V.avgNet = function () {
    const months = NX.fin.months().filter(k => k < U.monthKey(U.today())).slice(-3).map(k => NX.fin.month(k)).filter(m => m.income > 0);
    return months.length ? Math.round(U.sum(months, m => m.net) / months.length) : null;
  };
  V.need = function (g) {
    const left = Math.max(0, g.target - collected(g));
    if (!g.date || left === 0) return null;
    const days = Math.round((U.parseDate(g.date) - U.parseDate(U.today())) / 86400000);
    if (days <= 0) return { left, overdue: true };
    return { left, days, perWeek: Math.ceil(left / Math.max(1, days / 7)), perMonth: Math.ceil(left / Math.max(1, days / 30)) };
  };

  V.openGoalForm = function (g) {
    const edit = !!g;
    U.formModal({
      title: edit ? 'Ubah target tabungan' : 'Tambah target tabungan', values: g || {},
      fields: [
        { name: 'name', label: 'Nama target', required: true },
        { name: 'target', label: 'Nominal tujuan (Rupiah)', type: 'number', min: 1, integer: true, required: true },
        { name: 'date', label: 'Tanggal target (opsional)', type: 'date' },
        { name: 'notes', label: 'Catatan', type: 'textarea', rows: 2 }
      ],
      onSubmit(o) {
        NX.storage.update(st => {
          if (edit) Object.assign(st.savings.find(x => x.id === g.id), { name: o.name, target: o.target, date: o.date, notes: o.notes });
          else st.savings.push({ id: U.uid(), name: o.name, target: o.target, date: o.date, notes: o.notes, contributions: [], achieved: false, createdAt: new Date().toISOString() });
        });
        U.toast(edit ? 'Target diperbarui.' : 'Target tabungan dibuat.', 'ok');
      },
      onDelete: edit ? async () => {
        const saved = collected(g);
        if (await U.confirm('Hapus target "' + g.name + '"?', { danger: true, okLabel: 'Hapus', detail: saved ? U.fmtIDR(saved) + ' yang sudah dialokasikan akan kembali menjadi saldo tersedia. Tidak ada transaksi yang berubah.' : '' })) { NX.storage.update(st => { st.savings = st.savings.filter(x => x.id !== g.id); }); U.closeModal(); U.toast('Target dihapus.', 'ok'); }
      } : null
    });
  };

  function openContribution(g, correction) {
    const max = collected(g);
    U.formModal({
      title: (correction ? 'Koreksi (kurangi) tabungan: ' : 'Tambah tabungan: ') + g.name, values: { date: U.today() },
      fields: [
        { name: 'amount', label: 'Nominal (Rupiah)', type: 'number', min: 1, integer: true, required: true, hint: correction ? 'Maksimal ' + U.fmtIDR(max) + ' (yang sudah terkumpul).' : 'Saldo tersedia: ' + U.fmtIDR(NX.fin.available()) + '. Ini memindahkan uang ke pos tabungan, bukan pengeluaran baru.' },
        { name: 'date', label: 'Tanggal', type: 'date', required: true },
        { name: 'note', label: correction ? 'Alasan koreksi' : 'Catatan (opsional)', required: !!correction }
      ],
      onSubmit(o) {
        if (correction && o.amount > max) return 'Koreksi melebihi jumlah yang terkumpul (' + U.fmtIDR(max) + ').';
        if (!correction && o.amount > NX.fin.available()) return 'Saldo tersedia tidak cukup (' + U.fmtIDR(NX.fin.available()) + '). Catat pemasukan dulu atau kurangi nominal.';
        NX.storage.update(st => { st.savings.find(x => x.id === g.id).contributions.push({ id: U.uid(), date: o.date, amount: correction ? -o.amount : o.amount, note: o.note, type: correction ? 'koreksi' : 'setoran' }); });
        U.toast(correction ? 'Koreksi dicatat.' : 'Tabungan ditambahkan.', 'ok');
      }
    });
  }
  function openHistory(g) {
    const rows = g.contributions.slice().sort((a, b) => b.date.localeCompare(a.date));
    U.openModal('Riwayat: ' + g.name, el('div', {}, rows.length ? el('ul', { class: 'list' }, rows.map(c => el('li', { class: 'row between' }, [el('span', { text: U.fmtDate(c.date, { day: 'numeric', month: 'short', year: 'numeric' }) + (c.type === 'koreksi' ? ' · Koreksi' : '') + (c.note ? ' · ' + c.note : '') }), el('strong', { class: c.amount < 0 ? 'neg' : '', text: (c.amount < 0 ? '−' : '+') + U.fmtIDR(Math.abs(c.amount)) })]))) : U.empty('Belum ada riwayat')));
  }

  function card(g) {
    const got = collected(g), pct = Math.min(100, Math.round(got / g.target * 100)), done = got >= g.target || g.achieved, need = V.need(g);
    const kids = [
      el('div', { class: 'row between wrap' }, [el('h3', { text: g.name }), done ? U.badge('Tercapai', 'ok') : (g.date ? U.badge('Target ' + U.fmtShort(g.date), 'muted') : null)]),
      el('div', { class: 'row between' }, [el('strong', { text: U.fmtIDR(got) + ' dari ' + U.fmtIDR(g.target) }), el('span', { text: pct + '%' })]),
      U.progress(pct, done ? '' : '', 'Progres ' + g.name),
      el('p', { class: 'muted', text: done ? 'Target tercapai.' : 'Sisa ' + U.fmtIDR(Math.max(0, g.target - got)) + '.' })
    ];
    if (need && need.overdue) kids.push(el('p', { class: 'note warn', text: 'Tanggal target sudah lewat. Pertimbangkan menyesuaikan tanggal atau nominalnya.' }));
    else if (need) {
      kids.push(el('p', { class: 'muted', text: 'Untuk mencapainya sebelum ' + U.fmtShort(g.date) + ': sekitar ' + U.fmtIDR(need.perWeek) + ' per minggu atau ' + U.fmtIDR(need.perMonth) + ' per bulan.' }));
      const avg = V.avgNet();
      if (avg === null) kids.push(el('p', { class: 'muted small', text: 'Data pemasukan bulan-bulan sebelumnya belum cukup untuk menilai kecukupan dana.' }));
      else if (avg < need.perMonth) kids.push(el('p', { class: 'note warn', text: 'Selisih pemasukan dan pengeluaranmu rata-rata ' + U.fmtIDR(avg) + ' per bulan (dari bulan-bulan tercatat), lebih kecil daripada kebutuhan ' + U.fmtIDR(need.perMonth) + '. Pertimbangkan memperpanjang tenggat atau menurunkan nominal.' }));
      else kids.push(el('p', { class: 'muted small', text: 'Dengan pola tercatat (selisih rata-rata ' + U.fmtIDR(avg) + ' per bulan), target ini realistis.' }));
    }
    kids.push(el('div', { class: 'row gap wrap' }, [
      el('button', { type: 'button', class: 'btn primary small', text: 'Tambah tabungan', onclick: () => openContribution(g, false) }),
      el('button', { type: 'button', class: 'btn small', text: 'Koreksi', disabled: got <= 0, onclick: () => openContribution(g, true) }),
      el('button', { type: 'button', class: 'btn small', text: 'Riwayat', onclick: () => openHistory(g) }),
      !done ? el('button', { type: 'button', class: 'btn small', text: 'Tandai tercapai', onclick: () => NX.storage.update(st => { st.savings.find(x => x.id === g.id).achieved = true; }) }) : null,
      el('button', { type: 'button', class: 'btn small', text: 'Ubah', onclick: () => V.openGoalForm(g) })
    ]));
    return el('section', { class: 'card goal' }, kids);
  }

  NX.views.tabungan = {
    render(host) {
      const t = V.totals();
      host.append(el('div', { class: 'toolbar wrap' }, [el('h2', { class: 'section-title', text: 'Target tabungan' }), el('button', { class: 'btn primary', type: 'button', text: 'Tambah target', onclick: () => V.openGoalForm(null) })]));
      host.append(el('div', { class: 'grid stats' }, [U.stat('Total dialokasikan', U.fmtIDR(t.saved), t.count + ' target'), U.stat('Saldo tersedia', U.fmtIDR(NX.fin.available()), 'Saldo dikurangi dana tabungan'), U.stat('Target tercapai', t.achieved + ' dari ' + t.count)]));
      host.append(el('p', { class: 'muted small', text: 'Dana tabungan hanya dipisahkan dari saldo tersedia. Menambah tabungan tidak dihitung sebagai pengeluaran, sehingga uang tidak terhitung dua kali.' }));
      if (!S().savings.length) host.append(el('section', { class: 'card' }, U.empty('Belum ada target tabungan', 'Buat target pertamamu, misalnya perangkat belajar atau dana darurat.', el('button', { class: 'btn primary', type: 'button', text: 'Tambah target', onclick: () => V.openGoalForm(null) }))));
      else S().savings.forEach(g => host.append(card(g)));
    }
  };
})();
