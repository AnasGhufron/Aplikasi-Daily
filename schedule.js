(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const STATUS = { direncanakan: 'Direncanakan', selesai: 'Selesai', terlewat: 'Terlewat', dijadwalkan_ulang: 'Dijadwalkan Ulang' };
  const STATUS_KIND = { direncanakan: 'info', selesai: 'ok', terlewat: 'warn', dijadwalkan_ulang: 'muted' };
  const ui = { tab: 'kalender', mode: 'hari', date: U.today(), evalWeek: U.weekStart(U.today()) };
  const sched = (NX.schedule = {});
  const refresh = () => NX.app.refresh();
  const dur = s => U.toMin(s.end) - U.toMin(s.start);
  const doneMin = s => (s.actualMin !== null && s.actualMin !== undefined ? s.actualMin : dur(s));
  const overdue = s => s.status === 'direncanakan' && (s.date < U.today() || (s.date === U.today() && U.toMin(s.end) < U.nowMin()));
  sched.dur = dur; sched.doneMin = doneMin; sched.isOverdue = overdue; sched.STATUS = STATUS;

  /* ---------- Peristiwa pada suatu tanggal ---------- */
  function schoolOn(date) {
    const st = S();
    const ex = st.exceptions.filter(e => e.date === date);
    if (ex.some(e => e.type === 'libur')) return [];
    const wd = U.weekday(date);
    const skip = new Set(ex.filter(e => e.type === 'pengecualian').map(e => e.scheduleId));
    const out = st.schedule.filter(c => (c.recurring === false ? c.date === date : c.day === wd) && !skip.has(c.id))
      .map(c => ({ kind: 'sekolah', id: c.id, title: c.title, start: c.start, end: c.end, note: c.location || '', cls: c }));
    ex.filter(e => e.type === 'sekolah').forEach(e => out.push({ kind: 'sekolah', id: e.id, title: e.title || 'Hari sekolah khusus', start: e.start, end: e.end, note: e.note || '', extra: true }));
    return out;
  }
  function routinesOn(blockingOnly) {
    return S().routines.filter(r => !blockingOnly || r.blocks !== false).map(r => ({ kind: 'rutinitas', id: r.id, title: r.title, start: r.start, end: U.toTime(Math.min(1439, U.toMin(r.start) + (Number(r.duration) || 15))) }));
  }
  function sessionsOn(date) {
    return S().sessions.filter(s => s.date === date).map(s => ({ kind: 'belajar', id: s.id, title: s.title, start: s.start, end: s.end, status: s.status, note: '', session: s }));
  }
  sched.eventsOn = function (date, opts) {
    let ev = schoolOn(date).concat(sessionsOn(date));
    if (opts && opts.routines) ev = ev.concat(routinesOn(false));
    return ev.sort((a, b) => U.toMin(a.start) - U.toMin(b.start) || U.toMin(a.end) - U.toMin(b.end));
  };
  sched.schoolOn = schoolOn;

  /* ---------- Bentrok & waktu luang ---------- */
  function conflicts(date, start, end, ignoreId) {
    const s = U.toMin(start), e = U.toMin(end);
    return schoolOn(date).concat(sessionsOn(date), routinesOn(true))
      .filter(ev => ev.id !== ignoreId && ev.status !== 'dijadwalkan_ulang' && ev.status !== 'terlewat' && s < U.toMin(ev.end) && U.toMin(ev.start) < e);
  }
  const describe = list => list.map(c => c.title + ' (' + c.start + '–' + c.end + ')').join(', ');
  sched.conflicts = conflicts;
  function mergeBlocks(blocks) {
    const b = blocks.filter(x => x[1] > x[0]).sort((a, c) => a[0] - c[0]);
    const out = [];
    b.forEach(x => { const l = out[out.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push([x[0], x[1]]); });
    return out;
  }
  function busyBlocks(date) {
    const st = S(), trav = Number(st.settings.travelMinutes) || 0, B = [];
    const school = schoolOn(date);
    if (school.length) B.push([Math.min.apply(null, school.map(e => U.toMin(e.start))) - trav, Math.max.apply(null, school.map(e => U.toMin(e.end))) + trav]);
    sessionsOn(date).filter(e => e.status === 'direncanakan' || e.status === 'selesai').forEach(e => B.push([U.toMin(e.start), U.toMin(e.end)]));
    routinesOn(true).forEach(e => B.push([U.toMin(e.start), U.toMin(e.end)]));
    const wake = U.toMin(st.settings.wake), sleep = U.toMin(st.settings.sleep);
    if (sleep > wake) B.push([0, wake], [sleep - 60, 1440]); else B.push([sleep, wake]);
    return mergeBlocks(B.map(x => [Math.max(0, x[0]), Math.min(1440, x[1])]));
  }
  sched.freeWindows = function (date, minLen) {
    minLen = minLen || 45;
    if (date < U.today()) return [];
    const blocks = mergeBlocks(busyBlocks(date).map(x => [x[0] - 15, x[1] + 15]));
    const free = [];
    let cur = 0;
    blocks.forEach(x => { if (x[0] - cur >= minLen) free.push([cur, x[0]]); cur = Math.max(cur, x[1]); });
    if (1440 - cur >= minLen) free.push([cur, 1440]);
    const nm = Math.ceil((U.nowMin() + 5) / 5) * 5;
    return free.map(f => ({ start: date === U.today() ? Math.max(f[0], nm) : f[0], end: f[1] })).map(f => ({ start: f.start, end: f.end, len: f.end - f.start })).filter(f => f.len >= minLen);
  };

  /* ---------- Statistik minggu ---------- */
  sched.weekStats = function (ws) {
    const days = []; for (let i = 0; i < 7; i++) days.push(U.addDays(ws, i));
    const ss = S().sessions.filter(s => days.indexOf(s.date) >= 0);
    const active = ss.filter(s => s.status !== 'dijadwalkan_ulang');
    const done = ss.filter(s => s.status === 'selesai');
    const perDay = days.map(d => U.sum(done.filter(s => s.date === d), doneMin));
    return {
      days, sessions: ss, planned: U.sum(active, dur), done: U.sum(done, doneMin), doneCount: done.length,
      missed: ss.filter(s => s.status === 'terlewat').length, unmarked: ss.filter(overdue).length,
      rescheduled: ss.filter(s => s.status === 'dijadwalkan_ulang').length, activeDays: perDay.filter(m => m > 0).length, perDay
    };
  };
  function recommend(ws, goal) {
    const w = sched.weekStats(ws);
    const out = [];
    if (!w.sessions.length) return ['Belum ada sesi belajar di minggu ini. Mulailah dengan 2–3 sesi pendek di waktu yang paling longgar; kamu bisa menambahnya nanti.'];
    if (w.done >= goal) out.push('Target mingguan tercapai (' + U.fmtDur(w.done) + ' dari ' + U.fmtDur(goal) + '). Pertahankan ritmenya dan jaga waktu istirahat.');
    else out.push('Waktu belajar selesai ' + U.fmtDur(w.done) + ' dari target ' + U.fmtDur(goal) + '. Itu tetap kemajuan nyata.');
    if (w.planned > 0) {
      const ratio = w.done / w.planned;
      if (ratio < 0.6) out.push('Hanya sekitar ' + Math.round(ratio * 100) + '% dari rencana yang terlaksana. Minggu depan, coba kurangi total rencana sekitar seperempat dan pilih sesi yang lebih pendek (30–45 menit) agar lebih mudah dijalani.');
      else if (ratio < 0.9) out.push('Sebagian besar rencana terlaksana. Pindahkan sesi yang terlewat ke slot yang lebih longgar daripada menambah beban.');
      else out.push('Rencanamu realistis: hampir semuanya terlaksana. Kalau masih terasa ringan, tambah satu sesi pendek saja.');
    }
    if (w.unmarked) out.push(w.unmarked + ' sesi sudah lewat tetapi belum ditandai. Tandai sebagai selesai atau terlewat agar evaluasi akurat.');
    if (w.activeDays >= 4) out.push('Belajar di ' + w.activeDays + ' dari 7 hari — konsistensi yang baik.');
    return out;
  }
  sched.recommend = recommend;

  /* ---------- Formulir ---------- */
  const overlap = (a1, a2, b1, b2) => U.toMin(a1) < U.toMin(b2) && U.toMin(b1) < U.toMin(a2);
  const endAfterStart = o => (o.start && o.end && U.toMin(o.end) <= U.toMin(o.start) ? 'Jam selesai harus setelah jam mulai.' : null);

  sched.openClassForm = function (cls) {
    const edit = !!cls;
    const v = cls ? Object.assign({}, cls, { recurring: cls.recurring !== false }) : { recurring: true, day: U.weekday(U.today()), start: '08:00', end: '09:00' };
    U.formModal({
      title: edit ? 'Ubah jadwal sekolah' : 'Tambah jadwal sekolah', values: v,
      fields: [
        { name: 'title', label: 'Nama kegiatan atau mata pelajaran', required: true },
        { name: 'recurring', label: 'Berulang setiap minggu', type: 'checkbox' },
        { name: 'day', label: 'Hari', type: 'select', options: U.DAYS.map((d, i) => ({ value: i, label: d })) },
        { name: 'date', label: 'Tanggal (kegiatan sekali saja)', type: 'date' },
        { name: 'start', label: 'Jam mulai', type: 'time', required: true, half: true },
        { name: 'end', label: 'Jam selesai', type: 'time', required: true, half: true },
        { name: 'location', label: 'Lokasi atau catatan (opsional)' }
      ],
      setup(api) { const sync = () => { const r = api.get('recurring'); api.show('day', r); api.show('date', !r); }; api.on('recurring', sync); sync(); },
      validate: o => (!o.recurring && !o.date ? 'Isi tanggal untuk kegiatan sekali saja.' : endAfterStart(o)),
      async onSubmit(o) {
        const day = o.recurring ? Number(o.day) : U.weekday(o.date);
        const others = S().schedule.filter(c => c.id !== (cls && cls.id) && (o.recurring ? (c.recurring !== false && c.day === day) : (c.recurring === false ? c.date === o.date : c.day === day)));
        const hit = others.filter(c => overlap(o.start, o.end, c.start, c.end));
        if (hit.length && !(await U.confirm('Jam ini bentrok dengan ' + describe(hit) + '.', { okLabel: 'Tetap simpan' }))) return false;
        NX.storage.update(st => {
          const item = { id: cls ? cls.id : U.uid(), title: o.title, recurring: o.recurring, day, date: o.recurring ? '' : o.date, start: o.start, end: o.end, location: o.location };
          if (edit) st.schedule[st.schedule.findIndex(x => x.id === cls.id)] = item; else st.schedule.push(item);
        });
        U.toast(edit ? 'Jadwal sekolah diperbarui.' : 'Jadwal sekolah ditambahkan.', 'ok');
      },
      onDelete: edit ? async () => { if (await U.confirm('Hapus jadwal "' + cls.title + '"?', { danger: true, okLabel: 'Hapus' })) { NX.storage.update(st => { st.schedule = st.schedule.filter(x => x.id !== cls.id); }); U.closeModal(); U.toast('Jadwal dihapus.', 'ok'); } } : null
    });
  };

  sched.openExceptionForm = function () {
    const classes = S().schedule;
    U.formModal({
      title: 'Tandai hari libur atau pengecualian', values: { date: ui.date, type: 'libur' },
      fields: [
        { name: 'date', label: 'Tanggal', type: 'date', required: true },
        { name: 'type', label: 'Jenis', type: 'select', options: [{ value: 'libur', label: 'Hari libur (tidak ada kegiatan sekolah)' }, { value: 'pengecualian', label: 'Tiadakan satu jadwal pada tanggal ini' }, { value: 'sekolah', label: 'Hari sekolah khusus (kegiatan tambahan)' }] },
        { name: 'scheduleId', label: 'Jadwal yang ditiadakan', type: 'select', options: classes.length ? classes.map(c => ({ value: c.id, label: c.title + ' (' + c.start + '–' + c.end + ')' })) : [{ value: '', label: 'Belum ada jadwal sekolah' }] },
        { name: 'title', label: 'Nama kegiatan khusus' },
        { name: 'start', label: 'Jam mulai', type: 'time', half: true },
        { name: 'end', label: 'Jam selesai', type: 'time', half: true },
        { name: 'note', label: 'Catatan (opsional)' }
      ],
      setup(api) { const sync = () => { const t = api.get('type'); api.show('scheduleId', t === 'pengecualian'); ['title', 'start', 'end'].forEach(n => api.show(n, t === 'sekolah')); }; api.on('type', sync); sync(); },
      validate: o => (o.type === 'pengecualian' && !o.scheduleId ? 'Pilih jadwal yang ditiadakan.' : o.type === 'sekolah' ? (!o.title || !o.start || !o.end ? 'Isi nama kegiatan, jam mulai, dan jam selesai.' : endAfterStart(o)) : null),
      onSubmit(o) {
        NX.storage.update(st => { st.exceptions.push({ id: U.uid(), date: o.date, type: o.type, scheduleId: o.type === 'pengecualian' ? o.scheduleId : '', title: o.title, start: o.start, end: o.end, note: o.note }); });
        U.toast('Pengecualian disimpan.', 'ok');
      }
    });
  };

  function touchTopic(topicId) {
    if (!topicId) return;
    const p = S().progress[topicId];
    if (!p || p.status === 'belum') S().progress[topicId] = Object.assign({ understanding: 0, notes: '', checklist: {} }, p || {}, { status: 'berjalan', startedAt: new Date().toISOString() });
  }

  sched.openSessionForm = function (sess, prefill) {
    const edit = !!sess;
    const p = Object.assign({ date: ui.date, start: '19:00', end: '20:00', priority: 'Sedang', status: 'direncanakan', topicId: '' }, prefill || {}, sess || {});
    const topics = NX.curriculum.topics;
    U.formModal({
      title: edit ? 'Ubah sesi belajar' : 'Tambah sesi belajar', values: p, wide: true,
      fields: [
        { name: 'topicId', label: 'Materi Academy (opsional)', type: 'select', options: [{ value: '', label: 'Materi lain (tulis sendiri)' }].concat(topics.map(t => ({ value: t.id, label: t.title }))) },
        { name: 'title', label: 'Nama materi atau sesi', required: true },
        { name: 'date', label: 'Tanggal', type: 'date', required: true },
        { name: 'start', label: 'Jam mulai', type: 'time', required: true, half: true },
        { name: 'end', label: 'Jam selesai', type: 'time', required: true, half: true },
        { name: 'goal', label: 'Tujuan belajar', type: 'textarea', rows: 2 },
        { name: 'priority', label: 'Prioritas', type: 'select', options: ['Rendah', 'Sedang', 'Tinggi'], half: true },
        { name: 'status', label: 'Status', type: 'select', options: Object.keys(STATUS).map(k => ({ value: k, label: STATUS[k] })), half: true },
        { name: 'actualMin', label: 'Durasi aktual (menit, opsional)', type: 'number', min: 1, integer: true, hint: 'Kosongkan untuk memakai durasi rencana.' },
        { name: 'notes', label: 'Catatan hasil belajar', type: 'textarea' }
      ],
      setup(api) {
        let last = p.title || '';
        api.on('topicId', id => {
          const t = NX.curriculum.byId[id];
          if (!t) return;
          const cur = api.get('title');
          if (!cur || cur === last) { api.set('title', t.title); last = t.title; }
          if (!api.get('goal')) api.set('goal', t.objectives[0]);
        });
      },
      validate: endAfterStart,
      async onSubmit(o) {
        if (o.status === 'direncanakan' || o.status === 'selesai') {
          const c = conflicts(o.date, o.start, o.end, sess && sess.id);
          if (c.length && !(await U.confirm('Waktu ini bentrok dengan ' + describe(c) + '.', { okLabel: 'Tetap simpan', detail: 'Kamu bisa menyimpan tetap atau kembali dan mengubah jamnya.' }))) return false;
        }
        NX.storage.update(st => {
          const item = Object.assign({}, sess || {}, { id: sess ? sess.id : U.uid(), topicId: o.topicId, title: o.title, date: o.date, start: o.start, end: o.end, goal: o.goal, priority: o.priority, status: o.status, notes: o.notes, actualMin: o.actualMin });
          if (edit) st.sessions[st.sessions.findIndex(x => x.id === sess.id)] = item; else st.sessions.push(item);
          if (o.status === 'selesai') touchTopic(o.topicId);
        });
        ui.date = o.date;
        U.toast(edit ? 'Sesi belajar diperbarui.' : 'Sesi belajar dijadwalkan.', 'ok');
      },
      onDelete: edit ? () => deleteSession(sess) : null
    });
  };

  async function deleteSession(s) {
    if (!(await U.confirm('Hapus sesi "' + s.title + '"?', { danger: true, okLabel: 'Hapus' }))) return;
    NX.storage.update(st => { st.sessions = st.sessions.filter(x => x.id !== s.id); });
    U.closeModal(); U.toast('Sesi dihapus.', 'ok');
  }
  function completeSession(s, elapsedMin) {
    U.formModal({
      title: 'Selesaikan sesi: ' + s.title, values: { actualMin: elapsedMin || dur(s), notes: s.notes || '' },
      fields: [
        { name: 'actualMin', label: 'Durasi belajar sebenarnya (menit)', type: 'number', min: 1, integer: true, required: true },
        { name: 'notes', label: 'Catatan hasil belajar', type: 'textarea', hint: 'Apa yang sudah kamu pahami? Apa yang masih bingung?' }
      ],
      onSubmit(o) {
        NX.storage.update(st => { const x = st.sessions.find(i => i.id === s.id); x.status = 'selesai'; x.actualMin = o.actualMin; x.notes = o.notes; x.completedAt = new Date().toISOString(); touchTopic(x.topicId); });
        U.toast('Sesi selesai. Kerja bagus!', 'ok');
      }
    });
  }
  function setStatus(s, status) { NX.storage.update(st => { st.sessions.find(i => i.id === s.id).status = status; }); }
  function reschedule(s) {
    U.formModal({
      title: 'Jadwalkan ulang: ' + s.title, values: { date: U.addDays(s.date > U.today() ? s.date : U.today(), 1), start: s.start, end: s.end },
      fields: [{ name: 'date', label: 'Tanggal baru', type: 'date', required: true }, { name: 'start', label: 'Jam mulai', type: 'time', required: true, half: true }, { name: 'end', label: 'Jam selesai', type: 'time', required: true, half: true }],
      validate: endAfterStart,
      async onSubmit(o) {
        const c = conflicts(o.date, o.start, o.end, s.id);
        if (c.length && !(await U.confirm('Waktu baru bentrok dengan ' + describe(c) + '.', { okLabel: 'Tetap jadwalkan' }))) return false;
        NX.storage.update(st => {
          st.sessions.find(i => i.id === s.id).status = 'dijadwalkan_ulang';
          st.sessions.push(Object.assign({}, s, { id: U.uid(), date: o.date, start: o.start, end: o.end, status: 'direncanakan', actualMin: null, notes: '' }));
        });
        ui.date = o.date;
        U.toast('Sesi dijadwalkan ulang ke ' + U.fmtShort(o.date) + '.', 'ok');
      }
    });
  }

  /* ---------- Mulai sesi sekarang (dengan timer) ---------- */
  sched.startNow = function (topicId) {
    const topics = NX.curriculum.topics;
    const next = NX.learning && NX.learning.stats().next;
    U.formModal({
      title: 'Mulai sesi belajar', values: { topicId: topicId || (next ? next.id : ''), minutes: 45 },
      fields: [
        { name: 'topicId', label: 'Materi', type: 'select', options: [{ value: '', label: 'Belajar bebas' }].concat(topics.map(t => ({ value: t.id, label: t.title }))) },
        { name: 'minutes', label: 'Durasi rencana (menit)', type: 'number', min: 5, max: 240, integer: true, required: true }
      ],
      submitLabel: 'Mulai',
      onSubmit(o) {
        const now = U.nowMin(), end = Math.min(1439, now + o.minutes);
        if (end <= now) return 'Terlalu dekat dengan tengah malam. Jadwalkan sesi untuk besok.';
        const t = NX.curriculum.byId[o.topicId];
        const sess = { id: U.uid(), topicId: o.topicId, title: t ? t.title : 'Belajar bebas', date: U.today(), start: U.toTime(now), end: U.toTime(end), goal: t ? t.objectives[0] : '', priority: 'Sedang', status: 'direncanakan', notes: '', actualMin: null };
        NX.storage.update(st => { st.sessions.push(sess); touchTopic(o.topicId); });
        setTimeout(() => runTimer(sess), 0);
      }
    });
  };
  function runTimer(sess) {
    const t0 = Date.now();
    const clock = el('p', { class: 'timer', role: 'timer', text: '00:00' });
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); clock.textContent = U.pad(Math.floor(s / 60)) + ':' + U.pad(s % 60); }, 1000);
    const stop = () => clearInterval(tick);
    const body = el('div', { class: 'timer-box' }, [
      el('p', { class: 'muted', text: sess.title + ' — rencana ' + U.fmtDur(dur(sess)) }), clock,
      el('p', { class: 'muted small', text: 'Timer hanya berjalan selama tab ini terbuka. Menutup jendela tidak menghapus sesi; kamu bisa menandainya selesai nanti dari Jadwal Saya.' }),
      el('div', { class: 'form-actions' }, [
        el('button', { type: 'button', class: 'btn danger-ghost', text: 'Batalkan sesi', onclick: () => { stop(); NX.storage.update(st => { st.sessions = st.sessions.filter(x => x.id !== sess.id); }); U.closeModal(); } }),
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn primary', text: 'Selesai belajar', onclick: () => { stop(); const mins = Math.max(1, Math.round((Date.now() - t0) / 60000)); completeSession(S().sessions.find(x => x.id === sess.id) || sess, mins); } })
      ])
    ]);
    U.openModal('Sesi berjalan', body, { onClose: stop });
  }

  /* ---------- Tampilan ---------- */
  function shiftDate(dir) {
    if (ui.mode === 'hari') ui.date = U.addDays(ui.date, dir);
    else if (ui.mode === 'minggu') ui.date = U.addDays(ui.date, dir * 7);
    else ui.date = U.addMonths(U.monthKey(ui.date), dir) + '-01';
    refresh();
  }
  const goDay = d => { ui.date = d; ui.mode = 'hari'; ui.tab = 'kalender'; refresh(); };
  sched.goDay = d => { goDay(d); location.hash = '#/jadwal'; };

  NX.views.jadwal = {
    render(host) {
      host.append(el('div', { class: 'toolbar' }, U.tabs([['kalender', 'Kalender'], ['sekolah', 'Jadwal Sekolah'], ['evaluasi', 'Evaluasi']], ui.tab, v => { ui.tab = v; refresh(); }, 'Bagian jadwal')));
      const body = el('div', { class: 'stack' }); host.append(body);
      if (ui.tab === 'sekolah') renderSchool(body); else if (ui.tab === 'evaluasi') renderEval(body); else renderCalendar(body);
    }
  };

  function renderCalendar(host) {
    const ws = U.weekStart(ui.date);
    const title = ui.mode === 'bulan' ? U.fmtMonth(U.monthKey(ui.date)) : ui.mode === 'minggu' ? U.fmtShort(ws) + ' – ' + U.fmtShort(U.addDays(ws, 6)) : U.fmtDate(ui.date);
    host.append(el('div', { class: 'toolbar wrap' }, [
      U.tabs([['hari', 'Hari'], ['minggu', 'Minggu'], ['bulan', 'Bulan']], ui.mode, v => { ui.mode = v; refresh(); }, 'Rentang kalender'),
      el('div', { class: 'row gap' }, [
        el('button', { class: 'btn', type: 'button', 'aria-label': 'Sebelumnya', text: '‹', onclick: () => shiftDate(-1) }),
        el('button', { class: 'btn', type: 'button', text: 'Hari ini', onclick: () => { ui.date = U.today(); refresh(); } }),
        el('button', { class: 'btn', type: 'button', 'aria-label': 'Berikutnya', text: '›', onclick: () => shiftDate(1) })
      ]),
      el('button', { class: 'btn primary', type: 'button', text: 'Tambah sesi belajar', onclick: () => sched.openSessionForm(null) })
    ]));
    host.append(el('h2', { class: 'section-title', text: title }));
    if (ui.mode === 'hari') renderDay(host); else if (ui.mode === 'minggu') renderWeek(host); else renderMonth(host);
  }

  function sessionActions(s) {
    const b = (text, fn, cls) => el('button', { type: 'button', class: 'btn small ' + (cls || ''), text, onclick: fn });
    return el('div', { class: 'row gap wrap ev-actions' }, [
      s.status === 'direncanakan' ? b('Selesai', () => completeSession(s), 'primary') : null,
      s.status === 'direncanakan' ? b('Terlewat', () => { setStatus(s, 'terlewat'); U.toast('Ditandai terlewat. Tidak apa-apa, jadwalkan ulang kapan siap.', 'info'); }) : null,
      s.status === 'direncanakan' || s.status === 'terlewat' ? b('Jadwalkan ulang', () => reschedule(s)) : null,
      b('Ubah', () => sched.openSessionForm(s)),
      b('Hapus', () => deleteSession(s), 'danger-ghost')
    ]);
  }
  function eventRow(ev) {
    const s = ev.session;
    const kindLabel = { sekolah: 'Sekolah', belajar: 'Belajar', rutinitas: 'Rutinitas' }[ev.kind];
    return el('li', { class: 'event ' + ev.kind + (s && s.status === 'dijadwalkan_ulang' ? ' dim' : '') }, [
      el('div', { class: 'ev-time', text: ev.start + '–' + ev.end }),
      el('div', { class: 'ev-body' }, [
        el('div', { class: 'ev-title' }, [el('strong', { text: ev.title }), U.badge(kindLabel, ev.kind === 'belajar' ? 'accent' : 'muted'), s ? U.badge(STATUS[s.status], STATUS_KIND[s.status]) : null, s && overdue(s) ? U.badge('Perlu ditandai', 'warn') : null]),
        ev.note ? el('div', { class: 'muted small', text: ev.note }) : null,
        s && s.goal ? el('div', { class: 'muted small', text: 'Tujuan: ' + s.goal }) : null,
        s && s.notes ? el('div', { class: 'muted small', text: 'Catatan: ' + s.notes }) : null,
        s ? sessionActions(s) : null,
        ev.kind === 'sekolah' && ev.cls ? el('button', { type: 'button', class: 'btn small', text: 'Ubah jadwal', onclick: () => sched.openClassForm(ev.cls) }) : null
      ])
    ]);
  }

  function renderDay(host) {
    const date = ui.date, st = S();
    const hol = st.exceptions.find(e => e.date === date && e.type === 'libur');
    if (hol) host.append(el('div', { class: 'note info', text: 'Hari libur: tidak ada kegiatan sekolah.' + (hol.note ? ' ' + hol.note : '') }));
    const events = sched.eventsOn(date, { routines: true });
    const card = el('section', { class: 'card' });
    if (!events.length) card.append(U.empty('Belum ada kegiatan di hari ini', 'Tambahkan jadwal sekolah di tab Jadwal Sekolah, atau rencanakan sesi belajar.', el('button', { class: 'btn primary', type: 'button', text: 'Tambah sesi belajar', onclick: () => sched.openSessionForm(null) })));
    else card.append(el('ul', { class: 'events' }, events.map(eventRow)));
    host.append(card);
    const due = st.tasks.filter(t => t.due === date);
    if (due.length) host.append(el('section', { class: 'card' }, [el('h3', { text: 'Tenggat tugas' }), el('ul', { class: 'list' }, due.map(t => el('li', { class: 'row between' }, [el('span', { text: t.title }), U.badge(t.status === 'done' ? 'Selesai' : 'Belum selesai', t.status === 'done' ? 'ok' : 'warn')])))]));
    renderSuggest(host, date);
  }
  function renderSuggest(host, date) {
    if (date < U.today()) return;
    const goal = Number(S().settings.dailyGoalMin) || 120;
    const planned = U.sum(S().sessions.filter(s => s.date === date && (s.status === 'direncanakan' || s.status === 'selesai')), dur);
    const wins = sched.freeWindows(date, 45);
    const card = el('section', { class: 'card' }, [el('h3', { text: 'Saran waktu belajar' })]);
    if (planned >= goal) card.append(el('p', { class: 'muted', text: 'Rencana belajar hari ini sudah ' + U.fmtDur(planned) + ', memenuhi target harian ' + U.fmtDur(goal) + '. Sisa waktunya cukup untuk istirahat.' }));
    else if (!wins.length) card.append(el('p', { class: 'muted', text: 'Tidak ada celah 45 menit yang cukup longgar hari ini. Itu wajar. Pilih hari lain atau perpendek sesinya.' }));
    else {
      card.append(el('p', { class: 'muted', text: 'Celah berikut tidak bentrok dengan jadwal sekolah, perjalanan, rutinitas, dan jam tidurmu. Kamu tidak perlu memakai semuanya.' }));
      card.append(el('ul', { class: 'list' }, wins.slice(0, 4).map(w => {
        const len = Math.min(90, Math.floor(w.len / 15) * 15), en = Math.min(1439, w.start + len);
        return el('li', { class: 'row between' }, [el('span', { text: U.toTime(w.start) + '–' + U.toTime(Math.min(1439, w.end)) + ' longgar (' + U.fmtDur(w.len) + '). Saran sesi: ' + U.toTime(w.start) + '–' + U.toTime(en) }),
          el('button', { class: 'btn small', type: 'button', text: 'Jadwalkan', onclick: () => sched.openSessionForm(null, { date, start: U.toTime(w.start), end: U.toTime(en) }) })]);
      })));
    }
    host.append(card);
  }

  function renderWeek(host) {
    const ws = U.weekStart(ui.date), grid = el('div', { class: 'week-grid' });
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(ws, i), ev = sched.eventsOn(d).filter(e => !(e.session && e.session.status === 'dijadwalkan_ulang'));
      grid.append(el('section', { class: 'week-col' + (d === U.today() ? ' today' : '') }, [
        el('button', { type: 'button', class: 'week-head', onclick: () => goDay(d), 'aria-label': 'Buka ' + U.fmtDate(d) }, [el('strong', { text: U.DAYS[i] }), el('span', { class: 'muted', text: U.fmtShort(d) })]),
        ev.length ? el('ul', { class: 'chips' }, ev.map(e => el('li', {}, el('button', { type: 'button', class: 'chip ' + e.kind + (e.session ? ' st-' + e.session.status : ''), onclick: () => goDay(d) }, [el('span', { class: 'chip-time', text: e.start }), ' ' + e.title])))) : el('p', { class: 'muted small', text: 'Kosong' })
      ]));
    }
    host.append(grid);
  }
  function renderMonth(host) {
    const key = U.monthKey(ui.date), first = key + '-01', lead = U.weekday(first), last = Number(U.monthEnd(key).slice(8));
    const grid = el('div', { class: 'month-grid', role: 'grid' });
    U.DAYS.forEach(d => grid.append(el('div', { class: 'month-dow', text: d.slice(0, 3) })));
    for (let i = 0; i < lead; i++) grid.append(el('div', { class: 'month-cell blank' }));
    for (let n = 1; n <= last; n++) {
      const d = key + '-' + U.pad(n), ev = sched.eventsOn(d).filter(e => !(e.session && e.session.status === 'dijadwalkan_ulang'));
      const school = ev.filter(e => e.kind === 'sekolah').length, study = ev.filter(e => e.kind === 'belajar').length;
      grid.append(el('button', { type: 'button', class: 'month-cell' + (d === U.today() ? ' today' : '') + (d === ui.date ? ' sel' : ''), onclick: () => goDay(d), 'aria-label': U.fmtDate(d) + ': ' + school + ' kegiatan sekolah, ' + study + ' sesi belajar' }, [
        el('span', { class: 'mc-num', text: String(n) }),
        school ? el('span', { class: 'mc-tag sekolah', text: school + ' sekolah' }) : null,
        study ? el('span', { class: 'mc-tag belajar', text: study + ' belajar' }) : null
      ]));
    }
    host.append(grid);
  }

  function renderSchool(host) {
    const st = S();
    host.append(el('div', { class: 'toolbar wrap' }, [
      el('h2', { class: 'section-title', text: 'Jadwal sekolah mingguan' }),
      el('div', { class: 'row gap' }, [el('button', { class: 'btn primary', type: 'button', text: 'Tambah jadwal sekolah', onclick: () => sched.openClassForm(null) }), el('button', { class: 'btn', type: 'button', text: 'Tandai libur atau pengecualian', onclick: () => sched.openExceptionForm() })])
    ]));
    const trav = Number(st.settings.travelMinutes) || 0;
    host.append(el('p', { class: 'muted', text: 'Waktu perjalanan: ' + (trav ? trav + ' menit sebelum dan sesudah sekolah' : 'belum diatur') + '. Ubah di Pengaturan.' }));
    const card = el('section', { class: 'card' });
    if (!st.schedule.length) card.append(U.empty('Jadwal sekolah belum diisi', 'Masukkan jadwal tetapmu agar saran waktu belajar menghindari jam sekolah.'));
    else {
      for (let d = 0; d < 7; d++) {
        const list = st.schedule.filter(c => c.recurring !== false && c.day === d).sort((a, b) => a.start.localeCompare(b.start));
        if (!list.length) continue;
        card.append(el('h3', { text: U.DAYS[d] }), el('ul', { class: 'list' }, list.map(c => el('li', { class: 'row between' }, [el('span', {}, [el('strong', { text: c.start + '–' + c.end + ' ' }), c.title, c.location ? el('span', { class: 'muted', text: ' · ' + c.location }) : null]), el('button', { class: 'btn small', type: 'button', text: 'Ubah', onclick: () => sched.openClassForm(c) })]))));
      }
      const once = st.schedule.filter(c => c.recurring === false).sort((a, b) => a.date.localeCompare(b.date));
      if (once.length) card.append(el('h3', { text: 'Kegiatan sekali saja' }), el('ul', { class: 'list' }, once.map(c => el('li', { class: 'row between' }, [el('span', { text: U.fmtShort(c.date) + ' ' + c.start + '–' + c.end + ' ' + c.title }), el('button', { class: 'btn small', type: 'button', text: 'Ubah', onclick: () => sched.openClassForm(c) })]))));
    }
    host.append(card);
    const ex = st.exceptions.slice().sort((a, b) => b.date.localeCompare(a.date));
    const label = { libur: 'Hari libur', pengecualian: 'Jadwal ditiadakan', sekolah: 'Hari sekolah khusus' };
    host.append(el('section', { class: 'card' }, [el('h3', { text: 'Hari libur dan pengecualian' }),
      ex.length ? el('ul', { class: 'list' }, ex.map(e => { const c = st.schedule.find(x => x.id === e.scheduleId); return el('li', { class: 'row between' }, [el('span', { text: U.fmtDate(e.date, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + label[e.type] + (c ? ': ' + c.title : '') + (e.title ? ': ' + e.title : '') + (e.note ? ' (' + e.note + ')' : '') }), el('button', { class: 'btn small danger-ghost', type: 'button', text: 'Hapus', onclick: async () => { if (await U.confirm('Hapus catatan ini?', { danger: true, okLabel: 'Hapus' })) NX.storage.update(s => { s.exceptions = s.exceptions.filter(x => x.id !== e.id); }); } })]); })) : el('p', { class: 'muted', text: 'Belum ada hari libur atau pengecualian.' })]));
  }

  function renderEval(host) {
    const ws = ui.evalWeek, goal = Number(S().settings.weeklyGoalMin) || 0, w = sched.weekStats(ws);
    const shift = n => { ui.evalWeek = U.addDays(ws, n * 7); refresh(); };
    host.append(el('div', { class: 'toolbar wrap' }, [
      el('h2', { class: 'section-title', text: 'Evaluasi minggu ' + U.fmtShort(ws) + ' – ' + U.fmtShort(U.addDays(ws, 6)) }),
      el('div', { class: 'row gap' }, [el('button', { class: 'btn', type: 'button', 'aria-label': 'Minggu sebelumnya', text: '‹', onclick: () => shift(-1) }), el('button', { class: 'btn', type: 'button', text: 'Minggu ini', onclick: () => { ui.evalWeek = U.weekStart(U.today()); refresh(); } }), el('button', { class: 'btn', type: 'button', 'aria-label': 'Minggu berikutnya', text: '›', onclick: () => shift(1) })])
    ]));
    host.append(el('div', { class: 'grid stats' }, [
      U.stat('Direncanakan', U.fmtDur(w.planned), w.sessions.length + ' sesi tercatat'),
      U.stat('Selesai', U.fmtDur(w.done), w.doneCount + ' sesi', 'ok'),
      U.stat('Terlewat', String(w.missed), w.unmarked ? w.unmarked + ' lagi belum ditandai' : 'Sesi yang ditandai terlewat'),
      U.stat('Hari aktif belajar', w.activeDays + ' dari 7', 'Konsistensi minggu ini')
    ]));
    if (goal) host.append(el('div', { class: 'card' }, [el('div', { class: 'row between' }, [el('strong', { text: 'Target mingguan' }), el('span', { text: U.fmtDur(w.done) + ' / ' + U.fmtDur(goal) })]), U.progress(goal ? w.done / goal * 100 : 0, '', 'Progres target mingguan')]));
    host.append(el('section', { class: 'card' }, [el('h3', { text: 'Rekomendasi untuk minggu berikutnya' }), el('ul', { class: 'bullets' }, recommend(ws, goal).map(t => el('li', { text: t })))]));
    const note = el('textarea', { rows: 3, 'aria-label': 'Catatan evaluasi mingguan', placeholder: 'Apa yang berjalan baik? Apa yang ingin kamu ubah?', maxlength: 2000 });
    note.value = S().reviews[ws] || '';
    host.append(el('section', { class: 'card' }, [el('h3', { text: 'Catatan evaluasi' }), note, el('div', { class: 'form-actions' }, [el('span', { class: 'spacer' }), el('button', { class: 'btn', type: 'button', text: 'Simpan catatan', onclick: () => { NX.storage.update(s => { s.reviews[ws] = note.value.trim(); }, { silent: true }); U.toast('Catatan evaluasi disimpan.', 'ok'); } })])]));
  }
})();
