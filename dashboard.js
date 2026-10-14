(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();

  function greeting() {
    const h = new Date().getHours();
    return h < 4 ? 'Selamat malam' : h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  }
  const card = (title, kids, cls) => el('section', { class: 'card ' + (cls || '') }, [title ? el('h2', { class: 'card-title', text: title }) : null].concat(kids));
  const link = (text, hash) => el('a', { class: 'link-btn', href: hash, text });

  function unfinished(today) {
    const st = S(), items = [];
    st.sessions.filter(s => s.date === today && s.status === 'direncanakan').forEach(s => items.push({ kind: 'Belajar', text: s.start + ' ' + s.title, hash: '#/jadwal', warn: NX.schedule.isOverdue(s) }));
    st.tasks.filter(t => t.status !== 'done' && t.due && t.due <= today).forEach(t => items.push({ kind: 'Tugas', text: t.title + (t.due < today ? ' (terlambat)' : ''), hash: '#/tugas', warn: t.due < today }));
    st.routines.filter(r => !NX.habits.routineDone(today, r.id) && U.toMin(r.start) <= U.nowMin()).forEach(r => items.push({ kind: 'Rutinitas', text: r.start + ' ' + r.title, hash: '#/rutinitas' }));
    st.habits.filter(h => !NX.habits.habitDone(h.id, today)).forEach(h => items.push({ kind: 'Kebiasaan', text: h.name, hash: '#/rutinitas' }));
    return items;
  }

  function upcoming(today) {
    const st = S(), rows = [];
    for (let i = 0; i <= 7 && rows.length < 12; i++) {
      const d = U.addDays(today, i);
      NX.schedule.eventsOn(d).forEach(ev => {
        if (ev.session && ev.session.status !== 'direncanakan') return;
        if (i === 0 && U.toMin(ev.end) < U.nowMin()) return;
        rows.push({ date: d, sort: d + ev.start, text: ev.start + ' ' + ev.title, tag: ev.kind === 'belajar' ? 'Belajar' : 'Sekolah' });
      });
    }
    st.tasks.filter(t => t.status !== 'done' && t.due && t.due >= today && t.due <= U.addDays(today, 7)).forEach(t => rows.push({ date: t.due, sort: t.due + '99', text: 'Tenggat: ' + t.title, tag: 'Tugas' }));
    st.savings.filter(g => !g.achieved && NX.savings.collected(g) < g.target && g.date && g.date >= today && g.date <= U.addDays(today, 30)).forEach(g => rows.push({ date: g.date, sort: g.date + '98', text: 'Target tabungan: ' + g.name, tag: 'Tabungan' }));
    return rows.sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 10);
  }

  NX.views.dashboard = {
    render(host) {
      const st = S(), today = U.today(), key = U.monthKey(today), ws = U.weekStart(today);
      const events = NX.schedule.eventsOn(today).filter(e => !(e.session && e.session.status === 'dijadwalkan_ulang'));
      const dueToday = st.tasks.filter(t => t.status !== 'done' && t.due === today);
      const holiday = st.exceptions.find(e => e.date === today && e.type === 'libur');
      const name = st.settings.name ? ', ' + st.settings.name : '';

      // A. Ringkasan hari ini
      const hero = card(null, [
        el('div', { class: 'hero-top' }, [el('div', {}, [el('h2', { class: 'hero-title', text: greeting() + name }), el('p', { class: 'muted', text: U.fmtDate(today) })]),
          el('p', { class: 'hero-count', text: events.length + ' agenda · ' + dueToday.length + ' tugas jatuh tempo' })]),
        holiday ? el('p', { class: 'note info', text: 'Hari libur: tidak ada kegiatan sekolah.' }) : null,
        events.length ? el('ul', { class: 'timeline' }, events.map(e => el('li', { class: e.kind }, [el('span', { class: 'tl-time', text: e.start + '–' + e.end }), el('span', { class: 'tl-title', text: e.title }), U.badge(e.kind === 'belajar' ? 'Belajar' : 'Sekolah', e.kind === 'belajar' ? 'accent' : 'muted')])))
          : U.empty('Belum ada agenda hari ini', 'Isi jadwal sekolahmu atau rencanakan sesi belajar singkat.', el('div', { class: 'row gap' }, [link('Buka Jadwal Saya', '#/jadwal')]))
      ], 'hero');
      host.append(hero);

      const todo = unfinished(today);
      host.append(card('Aktivitas yang belum selesai', [todo.length ? el('ul', { class: 'list' }, todo.slice(0, 8).map(i => el('li', { class: 'row between' }, [el('span', {}, [U.badge(i.kind, i.warn ? 'warn' : 'muted'), ' ' + i.text]), link('Buka', i.hash)]))) : el('p', { class: 'muted', text: 'Tidak ada yang tertunda. Nikmati waktu istirahatmu.' }),
        todo.length > 8 ? el('p', { class: 'muted small', text: '+' + (todo.length - 8) + ' lainnya' }) : null]));

      // B. Statistik pembelajaran
      const w = NX.schedule.weekStats(ws), goal = Number(st.settings.weeklyGoalMin) || 0, ls = NX.learning.stats();
      host.append(el('h2', { class: 'section-title', text: 'Pembelajaran' }));
      host.append(el('div', { class: 'grid stats' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: 'Waktu belajar pekan ini' }), el('strong', { class: 'stat-value', text: U.fmtDur(w.done) }), goal ? U.progress(w.done / goal * 100, '', 'Target belajar mingguan') : null, el('span', { class: 'stat-sub', text: goal ? 'Target mingguan ' + U.fmtDur(goal) : 'Target mingguan belum diatur' })]),
        U.stat('Sesi selesai pekan ini', String(w.doneCount), w.missed ? w.missed + ' terlewat' : 'Belum ada yang terlewat'),
        U.stat('Materi dikuasai', ls.mastered + ' dari ' + ls.total, ls.done + ' materi selesai'),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: 'Progres roadmap' }), el('strong', { class: 'stat-value', text: ls.pct + '%' }), U.progress(ls.pct, '', 'Progres roadmap'), el('span', { class: 'stat-sub', text: ls.next ? 'Berikutnya: ' + ls.next.title : 'Roadmap selesai' })])
      ]));

      // C. Statistik keuangan
      const m = NX.fin.month(key), bs = NX.budget.status(key), sv = NX.savings.totals();
      host.append(el('h2', { class: 'section-title', text: 'Keuangan' }));
      host.append(el('div', { class: 'grid stats' }, [
        U.stat('Saldo', U.fmtIDR(NX.fin.balance()), 'Tersedia ' + U.fmtIDR(NX.fin.available())),
        U.stat('Pemasukan bulan ini', U.fmtIDR(m.income), null, 'ok'),
        U.stat('Pengeluaran bulan ini', U.fmtIDR(m.expense), null, 'warn'),
        U.stat('Selisih', U.fmtIDR(m.net), m.net >= 0 ? 'Surplus bulan ini' : 'Defisit bulan ini', m.net >= 0 ? 'ok' : 'bad'),
        bs.total.budget ? U.stat('Anggaran tersedia', U.fmtIDR(Math.max(0, bs.total.left)), bs.total.pct + '% terpakai' + (bs.total.left < 0 ? ' · lebih ' + U.fmtIDR(-bs.total.left) : '')) : U.stat('Anggaran tersedia', 'Belum diatur', 'Atur di menu Anggaran'),
        sv.count ? el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: 'Progres tabungan' }), el('strong', { class: 'stat-value', text: U.fmtIDR(sv.saved) }), U.progress(sv.target ? sv.saved / sv.target * 100 : 0, '', 'Progres tabungan'), el('span', { class: 'stat-sub', text: 'dari ' + U.fmtIDR(sv.target) + ' · ' + sv.count + ' target' })]) : U.stat('Progres tabungan', 'Belum ada target', 'Buat di menu Target Tabungan')
      ]));

      // D. Aktivitas mendatang
      const up = upcoming(today), near = NX.budget.nearLimit(key);
      host.append(el('div', { class: 'grid two' }, [
        card('Aktivitas mendatang', [up.length ? el('ul', { class: 'list' }, up.map(r => el('li', { class: 'row between' }, [el('span', { text: (r.date === today ? 'Hari ini' : U.fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })) + ' · ' + r.text }), U.badge(r.tag, 'muted')]))) : el('p', { class: 'muted', text: 'Tidak ada jadwal, tenggat, atau target dalam 7 hari ke depan.' })]),
        card('Pengingat anggaran', [near.length ? el('ul', { class: 'list' }, near.map(n => el('li', { class: 'row between' }, [el('span', { text: n.name }), U.badge(n.pct + '%', n.pct >= 100 ? 'bad' : 'warn')]))) : el('p', { class: 'muted', text: bs.total.budget || bs.cats.length ? 'Semua anggaran masih aman.' : 'Belum ada anggaran yang diatur.' })])
      ]));

      // E. Aksi cepat
      const a = (text, fn, cls) => el('button', { type: 'button', class: 'btn ' + (cls || ''), text, onclick: fn });
      host.append(card('Aksi cepat', [el('div', { class: 'row gap wrap' }, [
        a('Mulai sesi belajar', () => NX.schedule.startNow(), 'primary'),
        a('Tambah jadwal', () => NX.schedule.openClassForm(null)),
        a('Tambah tugas', () => NX.tasks.openForm(null)),
        a('Catat pemasukan', () => NX.fin.openTxForm(null, 'income')),
        a('Catat pengeluaran', () => NX.fin.openTxForm(null, 'expense')),
        a('Tambah target tabungan', () => NX.savings.openGoalForm(null))
      ])]));
    }
  };
})();
