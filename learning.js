(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const L = (NX.learning = {});
  const STATUS = { belum: 'Belum dimulai', berjalan: 'Sedang dipelajari', selesai: 'Selesai' };
  const STATUS_KIND = { belum: 'muted', berjalan: 'info', selesai: 'ok' };
  const UNDERSTAND = ['Belum dinilai', '1 — Masih bingung', '2 — Paham sedikit', '3 — Cukup paham', '4 — Paham', '5 — Sangat paham'];
  const openStages = new Set(['s1']);
  const refresh = () => NX.app.refresh();

  const prog = id => Object.assign({ status: 'belum', understanding: 0, notes: '', checklist: {}, repeats: 0 }, S().progress[id] || {});
  L.prog = prog;
  function save(id, patch) {
    NX.storage.update(st => { st.progress[id] = Object.assign({ status: 'belum', understanding: 0, notes: '', checklist: {}, repeats: 0 }, st.progress[id] || {}, patch); });
  }
  L.stats = function () {
    const T = NX.curriculum.topics, p = T.map(t => prog(t.id));
    const done = p.filter(x => x.status === 'selesai').length;
    const mastered = p.filter(x => x.status === 'selesai' && x.understanding >= 4).length;
    const doing = p.filter(x => x.status === 'berjalan').length;
    const next = T.find(t => prog(t.id).status !== 'selesai' && t.prereq.every(q => prog(q).status === 'selesai')) || T.find(t => prog(t.id).status !== 'selesai') || null;
    return { total: T.length, done, mastered, doing, pct: Math.round(done / T.length * 100), next, minutesLeft: U.sum(T.filter(t => prog(t.id).status !== 'selesai'), t => t.minutes) };
  };

  async function start(t) {
    const missing = t.prereq.filter(q => prog(q).status !== 'selesai').map(q => NX.curriculum.byId[q].title);
    if (missing.length && !(await U.confirm('Prasyarat belum selesai: ' + missing.join(', ') + '.', { okLabel: 'Tetap mulai', detail: 'Boleh lanjut, tetapi materi ini akan lebih mudah kalau prasyaratnya sudah dipahami.' }))) return;
    save(t.id, { status: 'berjalan', startedAt: prog(t.id).startedAt || new Date().toISOString() });
    openTopic(t.id);
    U.toast('Selamat belajar!', 'ok');
  }
  async function finish(t) {
    const p = prog(t.id), n = Object.keys(p.checklist).filter(k => p.checklist[k]).length;
    if (n < t.checklist.length && !(await U.confirm('Checklist baru ' + n + ' dari ' + t.checklist.length + ' item.', { okLabel: 'Tandai selesai' }))) return;
    save(t.id, { status: 'selesai', completedAt: new Date().toISOString() });
    openTopic(t.id);
    U.toast('Materi selesai. Jangan lupa nilai tingkat pemahamanmu.', 'ok');
  }
  async function repeat(t) {
    if (!(await U.confirm('Ulangi materi "' + t.title + '"?', { detail: 'Checklist akan direset. Catatan dan tingkat pemahaman tetap tersimpan.', okLabel: 'Ulangi' }))) return;
    save(t.id, { status: 'berjalan', checklist: {}, repeats: (prog(t.id).repeats || 0) + 1 });
    openTopic(t.id);
  }

  function openTopic(id) {
    const t = NX.curriculum.byId[id], p = prog(id);
    const checkedCount = () => Object.keys(prog(id).checklist).filter(k => prog(id).checklist[k]).length;
    const countEl = el('span', { class: 'muted', text: checkedCount() + ' dari ' + t.checklist.length });
    const refs = el('details', { class: 'refs' }, [el('summary', { text: 'Referensi belajar (' + t.refs.length + ')' }), el('ul', { class: 'list' }, t.refs.map(r => el('li', {}, el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: r.label }))))]);
    const notes = el('textarea', { rows: 4, 'aria-label': 'Catatan pribadi', placeholder: 'Tulis ringkasan, pertanyaan, atau hal yang masih membingungkan.', maxlength: 5000 });
    notes.value = p.notes;
    const sel = el('select', { 'aria-label': 'Tingkat pemahaman' }, UNDERSTAND.map((l, i) => el('option', { value: i, text: l })));
    sel.value = p.understanding;
    sel.addEventListener('change', () => { save(id, { understanding: Number(sel.value) }); });
    const prereqs = t.prereq.length ? t.prereq.map(q => NX.curriculum.byId[q]).map(q => el('li', {}, [prog(q.id).status === 'selesai' ? U.badge('Selesai', 'ok') : U.badge('Belum', 'warn'), ' ' + q.title])) : [el('li', { class: 'muted', text: 'Tidak ada prasyarat.' })];
    const b = (text, fn, cls) => el('button', { type: 'button', class: 'btn ' + (cls || ''), text, onclick: fn });
    const body = el('div', { class: 'topic' }, [
      el('div', { class: 'row gap wrap' }, [U.badge(STATUS[p.status], STATUS_KIND[p.status]), U.badge('≈ ' + U.fmtDur(t.minutes), 'muted'), p.repeats ? U.badge('Diulang ' + p.repeats + '×', 'muted') : null]),
      el('p', { text: t.summary }),
      el('h3', { text: 'Tujuan pembelajaran' }), el('ul', { class: 'bullets' }, t.objectives.map(o => el('li', { text: o }))),
      el('h3', { text: 'Prasyarat' }), el('ul', { class: 'list' }, prereqs),
      el('h3', {}, ['Checklist ', countEl]),
      el('ul', { class: 'checks' }, t.checklist.map((c, i) => {
        const cb = el('input', { type: 'checkbox', id: 'ck' + id + i });
        cb.checked = !!p.checklist[i];
        cb.addEventListener('change', () => { const cl = Object.assign({}, prog(id).checklist); cl[i] = cb.checked; save(id, { checklist: cl }); countEl.textContent = checkedCount() + ' dari ' + t.checklist.length; });
        return el('li', {}, [cb, el('label', { for: 'ck' + id + i, text: c })]);
      })),
      el('h3', { text: 'Latihan atau tugas praktik' }), el('p', { text: t.exercise }),
      el('p', { class: 'muted small', text: 'Berlatihlah hanya di sistem milikmu sendiri, lab lokal, atau platform yang memberi izin.' }),
      el('h3', { text: 'Tingkat pemahaman' }), sel,
      el('h3', { text: 'Catatan pribadi' }), notes,
      el('div', { class: 'row gap wrap' }, [b('Simpan catatan', () => { save(id, { notes: notes.value.trim() }); U.toast('Catatan disimpan.', 'ok'); })]),
      refs,
      el('div', { class: 'form-actions wrap' }, [
        p.status === 'belum' ? b('Mulai Belajar', () => start(t), 'primary') : null,
        p.status === 'berjalan' ? b('Tandai Selesai', () => finish(t), 'primary') : null,
        p.status === 'selesai' ? b('Ulangi Materi', () => repeat(t)) : null,
        b('Tambah Catatan', () => { notes.scrollIntoView({ block: 'center' }); notes.focus(); }),
        b('Jadwalkan Sesi', () => NX.schedule.openSessionForm(null, { topicId: t.id, title: t.title, goal: t.objectives[0] })),
        b('Buka Referensi', () => { refs.open = true; refs.scrollIntoView({ block: 'center' }); })
      ])
    ]);
    U.openModal(t.title, body, { wide: true });
  }
  L.openTopic = openTopic;

  NX.views.academy = {
    render(host) {
      const s = L.stats();
      host.append(el('section', { class: 'card hero-card' }, [
        el('div', { class: 'row between wrap' }, [el('div', {}, [el('h2', { text: 'Roadmap Cyber Security untuk pemula' }), el('p', { class: 'muted', text: 'Belajar bertahap dari dasar. Urutannya disarankan, bukan wajib.' })]),
          el('button', { class: 'btn primary', type: 'button', text: 'Mulai sesi belajar', onclick: () => NX.schedule.startNow() })]),
        el('div', { class: 'row between' }, [el('strong', { text: s.pct + '% selesai' }), el('span', { class: 'muted', text: s.done + ' dari ' + s.total + ' materi · ' + s.mastered + ' dikuasai' })]),
        U.progress(s.pct, '', 'Progres roadmap'),
        s.next ? el('p', { class: 'next-up' }, ['Materi berikutnya yang disarankan: ', el('button', { type: 'button', class: 'link-btn', text: s.next.title, onclick: () => openTopic(s.next.id) })]) : el('p', { text: 'Seluruh materi selesai. Lanjutkan dengan proyek dan lab pilihanmu.' }),
        el('p', { class: 'muted small', text: 'Dikuasai = materi selesai dengan tingkat pemahaman 4 atau 5. Sisa estimasi belajar: ' + U.fmtDur(s.minutesLeft) + '.' })
      ]));
      NX.curriculum.stages.forEach(stage => {
        const ts = NX.curriculum.topics.filter(t => t.stage === stage.id), d = ts.filter(t => prog(t.id).status === 'selesai').length;
        const det = el('details', { class: 'stage' }, [
          el('summary', {}, [el('span', { class: 'stage-title', text: stage.title }), el('span', { class: 'muted small', text: d + '/' + ts.length + ' selesai' })]),
          el('p', { class: 'muted', text: stage.summary }),
          el('ul', { class: 'topics' }, ts.map(t => { const p = prog(t.id); return el('li', {}, el('button', { type: 'button', class: 'topic-row', onclick: () => openTopic(t.id) }, [el('span', { class: 'topic-name', text: t.title }), el('span', { class: 'topic-meta' }, [U.badge(STATUS[p.status], STATUS_KIND[p.status]), el('span', { class: 'muted small', text: U.fmtDur(t.minutes) }), p.understanding ? el('span', { class: 'muted small', text: 'Pemahaman ' + p.understanding + '/5' }) : null])])); }))
        ]);
        det.open = openStages.has(stage.id);
        det.addEventListener('toggle', () => { if (det.open) openStages.add(stage.id); else openStages.delete(stage.id); });
        host.append(det);
      });
    }
  };
})();
