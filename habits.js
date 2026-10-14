(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const H = (NX.habits = {});
  const TEMPLATE = [['Bangun tidur', '06:00', 10, true], ['Persiapan sekolah', '06:15', 45, true], ['Pengerjaan tugas', '16:30', 60, true], ['Belajar Cyber Security', '19:00', 60, false], ['Istirahat', '20:15', 30, true], ['Evaluasi harian', '21:00', 10, true], ['Persiapan hari berikutnya', '21:15', 15, true]];
  const SUGGEST = ['Belajar sesuai target harian', 'Menyelesaikan tugas sekolah', 'Mencatat transaksi harian', 'Meninjau jadwal besok'];

  /* ---------- Data bantu (dipakai dashboard dan laporan) ---------- */
  H.routineDone = (date, id) => !!(S().routineLogs[date] && S().routineLogs[date][id]);
  H.habitDone = (id, date) => !!(S().habitLogs[id] && S().habitLogs[id][date]);
  H.target = h => (h.frequency === 'harian' ? 7 : Math.max(1, Math.min(7, Number(h.targetDays) || 3)));
  H.weekDone = (h, ws) => { let n = 0; for (let i = 0; i < 7; i++) if (H.habitDone(h.id, U.addDays(ws, i))) n++; return n; };
  H.toggleRoutine = (date, id) => NX.storage.update(st => { const d = (st.routineLogs[date] = st.routineLogs[date] || {}); if (d[id]) delete d[id]; else d[id] = 1; if (!Object.keys(d).length) delete st.routineLogs[date]; });
  H.toggleHabit = (hid, date) => NX.storage.update(st => { const d = (st.habitLogs[hid] = st.habitLogs[hid] || {}); if (d[date]) delete d[date]; else d[date] = 1; });
  H.weekRate = function (ws) {
    const hs = S().habits;
    if (!hs.length) return null;
    const target = U.sum(hs, H.target), done = U.sum(hs, h => Math.min(H.weekDone(h, ws), H.target(h)));
    return { done, target, pct: target ? Math.round(done / target * 100) : 0 };
  };

  /* ---------- Formulir ---------- */
  function routineForm(r) {
    const edit = !!r;
    U.formModal({
      title: edit ? 'Ubah rutinitas' : 'Tambah rutinitas', values: Object.assign({ start: '06:00', duration: 30, blocks: true }, r || {}),
      fields: [
        { name: 'title', label: 'Nama rutinitas', required: true },
        { name: 'start', label: 'Jam mulai', type: 'time', required: true, half: true },
        { name: 'duration', label: 'Durasi (menit)', type: 'number', min: 5, max: 600, integer: true, required: true, half: true },
        { name: 'blocks', label: 'Anggap waktu ini sibuk saat mencari saran jadwal belajar', type: 'checkbox' }
      ],
      onSubmit(o) {
        NX.storage.update(st => { const item = { id: r ? r.id : U.uid(), title: o.title, start: o.start, duration: o.duration, blocks: o.blocks }; if (edit) st.routines[st.routines.findIndex(x => x.id === r.id)] = item; else st.routines.push(item); });
        U.toast('Rutinitas disimpan.', 'ok');
      },
      onDelete: edit ? async () => { if (await U.confirm('Hapus rutinitas "' + r.title + '"?', { danger: true, okLabel: 'Hapus' })) { NX.storage.update(st => { st.routines = st.routines.filter(x => x.id !== r.id); }); U.closeModal(); } } : null
    });
  }
  function habitForm(h, preset) {
    const edit = !!h;
    U.formModal({
      title: edit ? 'Ubah kebiasaan' : 'Tambah kebiasaan', values: Object.assign({ frequency: 'harian', targetDays: 5, name: preset || '' }, h || {}),
      fields: [
        { name: 'name', label: 'Nama kebiasaan', required: true },
        { name: 'frequency', label: 'Frekuensi', type: 'select', options: [{ value: 'harian', label: 'Harian (setiap hari)' }, { value: 'mingguan', label: 'Mingguan (beberapa hari per minggu)' }] },
        { name: 'targetDays', label: 'Target hari per minggu', type: 'number', min: 1, max: 7, integer: true, hint: 'Target adalah panduan, bukan hukuman. Melewatkan hari tidak menghapus progresmu.' }
      ],
      setup(api) { const sync = () => api.show('targetDays', api.get('frequency') === 'mingguan'); api.on('frequency', sync); sync(); },
      onSubmit(o) {
        NX.storage.update(st => { const item = { id: h ? h.id : U.uid(), name: o.name, frequency: o.frequency, targetDays: o.frequency === 'harian' ? 7 : (o.targetDays || 3) }; if (edit) st.habits[st.habits.findIndex(x => x.id === h.id)] = item; else st.habits.push(item); });
        U.toast('Kebiasaan disimpan.', 'ok');
      },
      onDelete: edit ? async () => { if (await U.confirm('Hapus kebiasaan "' + h.name + '"?', { danger: true, okLabel: 'Hapus', detail: 'Riwayat centangnya ikut terhapus.' })) { NX.storage.update(st => { st.habits = st.habits.filter(x => x.id !== h.id); delete st.habitLogs[h.id]; }); U.closeModal(); } } : null
    });
  }
  H.openHabitForm = habitForm;

  NX.views.rutinitas = {
    render(host) {
      const st = S(), today = U.today(), ws = U.weekStart(today);
      // Rutinitas harian
      const rc = el('section', { class: 'card' }, [el('div', { class: 'row between wrap' }, [el('h2', { text: 'Rutinitas harian' }), el('div', { class: 'row gap' }, [el('button', { class: 'btn primary', type: 'button', text: 'Tambah rutinitas', onclick: () => routineForm(null) })])])]);
      if (!st.routines.length) {
        rc.append(U.empty('Belum ada rutinitas', 'Susun ritme harianmu sendiri. Kamu juga bisa memakai contoh di bawah lalu mengubah jamnya.', el('button', { class: 'btn', type: 'button', text: 'Pakai contoh rutinitas', onclick: () => { NX.storage.update(s => { TEMPLATE.forEach(t => s.routines.push({ id: U.uid(), title: t[0], start: t[1], duration: t[2], blocks: t[3] })); }); U.toast('Contoh ditambahkan. Ubah sesuai kebutuhanmu.', 'ok'); } })));
      } else {
        const list = st.routines.slice().sort((a, b) => a.start.localeCompare(b.start));
        const done = list.filter(r => H.routineDone(today, r.id)).length;
        rc.append(el('p', { class: 'muted', text: 'Hari ini: ' + done + ' dari ' + list.length + ' selesai.' }), el('ul', { class: 'checks big' }, list.map(r => {
          const cb = el('input', { type: 'checkbox', id: 'r' + r.id });
          cb.checked = H.routineDone(today, r.id);
          cb.addEventListener('change', () => H.toggleRoutine(today, r.id));
          return el('li', {}, [cb, el('label', { for: 'r' + r.id }, [el('strong', { text: r.start + ' ' }), r.title, el('span', { class: 'muted small', text: ' · ' + U.fmtDur(r.duration) })]), el('button', { type: 'button', class: 'btn small', text: 'Ubah', 'aria-label': 'Ubah rutinitas ' + r.title, onclick: () => routineForm(r) })]);
        })));
      }
      host.append(rc);
      // Kebiasaan
      const hc = el('section', { class: 'card' }, [el('div', { class: 'row between wrap' }, [el('h2', { text: 'Kebiasaan' }), el('button', { class: 'btn primary', type: 'button', text: 'Tambah kebiasaan', onclick: () => habitForm(null) })])]);
      if (!st.habits.length) {
        hc.append(U.empty('Belum ada kebiasaan', 'Mulai dari satu atau dua kebiasaan kecil. Pilih saran atau buat sendiri.'), el('div', { class: 'row gap wrap' }, SUGGEST.map(s => el('button', { type: 'button', class: 'btn small', text: s, onclick: () => habitForm(null, s) }))));
      } else {
        const rate = H.weekRate(ws);
        hc.append(el('div', { class: 'row between' }, [el('strong', { text: 'Pekan ini: ' + rate.done + ' dari ' + rate.target + ' target' }), el('span', { text: rate.pct + '%' })]), U.progress(rate.pct, '', 'Progres kebiasaan pekan ini'));
        hc.append(el('ul', { class: 'habits' }, st.habits.map(h => {
          const cb = el('input', { type: 'checkbox', id: 'h' + h.id });
          cb.checked = H.habitDone(h.id, today);
          cb.addEventListener('change', () => H.toggleHabit(h.id, today));
          const dots = el('div', { class: 'dots', role: 'img', 'aria-label': '14 hari terakhir' });
          let n14 = 0;
          for (let i = 13; i >= 0; i--) { const d = U.addDays(today, -i), on = H.habitDone(h.id, d); if (on) n14++; dots.append(el('span', { class: 'dot-day' + (on ? ' on' : ''), title: U.fmtShort(d) + (on ? ': selesai' : ': tidak dicentang') })); }
          dots.setAttribute('aria-label', n14 + ' dari 14 hari terakhir dicentang');
          return el('li', { class: 'habit' }, [el('div', { class: 'row between wrap' }, [el('div', { class: 'check-line' }, [cb, el('label', { for: 'h' + h.id, text: h.name })]), el('button', { type: 'button', class: 'btn small', text: 'Ubah', 'aria-label': 'Ubah kebiasaan ' + h.name, onclick: () => habitForm(h) })]),
            el('div', { class: 'row between wrap' }, [dots, el('span', { class: 'muted small', text: 'Pekan ini ' + Math.min(H.weekDone(h, ws), 7) + ' dari target ' + H.target(h) + ' hari' })])]);
        })));
        hc.append(el('p', { class: 'muted small', text: 'Tidak ada skor atau rangkaian hari beruntun. Hari yang terlewat hanyalah hari yang terlewat.' }));
      }
      host.append(hc);
    }
  };
})();
