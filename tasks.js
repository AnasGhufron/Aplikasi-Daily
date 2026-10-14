(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const T = (NX.tasks = {});
  const CATS = ['Sekolah', 'Cyber Security', 'Pribadi', 'Proyek', 'Lainnya'];
  const PRIO = ['Rendah', 'Sedang', 'Tinggi'];
  const STATUS = { todo: 'Belum dikerjakan', doing: 'Sedang dikerjakan', done: 'Selesai' };
  const PRIO_KIND = { Rendah: 'muted', Sedang: 'info', Tinggi: 'warn' };
  const ui = { scope: 'hari', layout: 'daftar', q: '', cat: '', status: '', prio: '' };
  const refresh = () => NX.app.refresh();

  const isOver = t => t.status !== 'done' && t.due && t.due < U.today();
  T.counts = function () {
    const ts = S().tasks, today = U.today(), open = ts.filter(t => t.status !== 'done');
    return { hari: open.filter(t => t.due === today).length, mendatang: open.filter(t => t.due && t.due > today).length, terlambat: open.filter(isOver).length, semua: ts.length };
  };
  T.toggle = function (id) {
    NX.storage.update(st => { const t = st.tasks.find(x => x.id === id); if (t) { t.status = t.status === 'done' ? 'todo' : 'done'; t.completedAt = t.status === 'done' ? new Date().toISOString() : ''; } });
  };
  function move(t, status) { NX.storage.update(st => { const x = st.tasks.find(i => i.id === t.id); x.status = status; x.completedAt = status === 'done' ? new Date().toISOString() : ''; }); }

  T.openForm = function (task, prefill) {
    const edit = !!task, today = U.today();
    const sessions = S().sessions.filter(s => s.date >= U.addDays(today, -7) || (task && s.id === task.sessionId)).sort((a, b) => a.date.localeCompare(b.date));
    U.formModal({
      title: edit ? 'Ubah tugas' : 'Tambah tugas', wide: true,
      values: Object.assign({ category: 'Sekolah', priority: 'Sedang', status: 'todo', sessionId: '' }, prefill || {}, task || {}),
      fields: [
        { name: 'title', label: 'Judul', required: true },
        { name: 'description', label: 'Deskripsi', type: 'textarea', rows: 2 },
        { name: 'category', label: 'Kategori', type: 'select', options: CATS, half: true },
        { name: 'priority', label: 'Prioritas', type: 'select', options: PRIO, half: true },
        { name: 'due', label: 'Tenggat (opsional)', type: 'date', half: true },
        { name: 'estMin', label: 'Estimasi durasi (menit)', type: 'number', min: 5, max: 1440, integer: true, half: true },
        { name: 'status', label: 'Status', type: 'select', options: Object.keys(STATUS).map(k => ({ value: k, label: STATUS[k] })) },
        { name: 'sessionId', label: 'Hubungkan ke sesi belajar (opsional)', type: 'select', options: [{ value: '', label: 'Tidak dihubungkan' }].concat(sessions.map(s => ({ value: s.id, label: U.fmtShort(s.date) + ' ' + s.start + ' · ' + s.title }))) },
        { name: 'notes', label: 'Catatan', type: 'textarea', rows: 2 }
      ],
      onSubmit(o) {
        NX.storage.update(st => {
          const item = Object.assign({}, task || {}, { id: task ? task.id : U.uid(), title: o.title, description: o.description, category: o.category, priority: o.priority, due: o.due, estMin: o.estMin, status: o.status, sessionId: o.sessionId, notes: o.notes });
          if (o.status === 'done' && !item.completedAt) item.completedAt = new Date().toISOString();
          if (o.status !== 'done') item.completedAt = '';
          if (edit) st.tasks[st.tasks.findIndex(x => x.id === task.id)] = item; else st.tasks.push(item);
        });
        U.toast(edit ? 'Tugas diperbarui.' : 'Tugas ditambahkan.', 'ok');
      },
      onDelete: edit ? async () => { if (await U.confirm('Hapus tugas "' + task.title + '"?', { danger: true, okLabel: 'Hapus' })) { NX.storage.update(st => { st.tasks = st.tasks.filter(x => x.id !== task.id); }); U.closeModal(); U.toast('Tugas dihapus.', 'ok'); } } : null
    });
  };

  function filtered() {
    const today = U.today(), q = ui.q.toLowerCase();
    return S().tasks.filter(t => {
      if (ui.scope === 'hari' && !(t.status !== 'done' && t.due === today)) return false;
      if (ui.scope === 'mendatang' && !(t.status !== 'done' && t.due && t.due > today)) return false;
      if (ui.scope === 'terlambat' && !isOver(t)) return false;
      if (ui.cat && t.category !== ui.cat) return false;
      if (ui.status && t.status !== ui.status) return false;
      if (ui.prio && t.priority !== ui.prio) return false;
      if (q && !(t.title + ' ' + (t.description || '') + ' ' + (t.notes || '')).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || PRIO.indexOf(b.priority) - PRIO.indexOf(a.priority));
  }
  function meta(t) {
    return [U.badge(t.category, 'muted'), U.badge(t.priority, PRIO_KIND[t.priority]), t.due ? U.badge((isOver(t) ? 'Terlambat · ' : 'Tenggat ') + U.fmtShort(t.due), isOver(t) ? 'bad' : 'muted') : null, t.estMin ? U.badge(U.fmtDur(t.estMin), 'muted') : null];
  }
  function listRow(t) {
    const cb = el('input', { type: 'checkbox', id: 'tk' + t.id, 'aria-label': 'Tandai selesai: ' + t.title });
    cb.checked = t.status === 'done';
    cb.addEventListener('change', () => T.toggle(t.id));
    return el('li', { class: 'task' + (t.status === 'done' ? ' done' : '') }, [cb, el('div', { class: 'task-main' }, [
      el('strong', { text: t.title }), t.status === 'doing' ? U.badge('Sedang dikerjakan', 'info') : null,
      t.description ? el('div', { class: 'muted small', text: t.description }) : null,
      el('div', { class: 'row gap wrap' }, meta(t))]),
    el('button', { type: 'button', class: 'btn small', text: 'Ubah', onclick: () => T.openForm(t) })]);
  }
  function kanban(list) {
    const board = el('div', { class: 'kanban' });
    Object.keys(STATUS).forEach(k => {
      const items = list.filter(t => t.status === k);
      board.append(el('section', { class: 'kcol', 'aria-label': STATUS[k] }, [el('h3', {}, [STATUS[k], ' ', el('span', { class: 'tab-count', text: String(items.length) })]),
        items.length ? el('ul', { class: 'kcards' }, items.map(t => el('li', { class: 'kcard' }, [el('strong', { text: t.title }), el('div', { class: 'row gap wrap' }, meta(t)),
          el('div', { class: 'row gap wrap' }, [Object.keys(STATUS).filter(s => s !== k).map(s => el('button', { type: 'button', class: 'btn small', text: 'Pindah ke ' + STATUS[s], onclick: () => move(t, s) })), el('button', { type: 'button', class: 'btn small', text: 'Ubah', onclick: () => T.openForm(t) })])]))) : el('p', { class: 'muted small', text: 'Kosong' })]));
    });
    return board;
  }

  NX.views.tugas = {
    render(host) {
      const c = T.counts();
      host.append(el('div', { class: 'toolbar wrap' }, [
        U.tabs([['hari', 'Hari ini', c.hari], ['mendatang', 'Mendatang', c.mendatang], ['terlambat', 'Terlambat', c.terlambat], ['semua', 'Semua', c.semua]], ui.scope, v => { ui.scope = v; refresh(); }, 'Rentang tugas'),
        el('div', { class: 'row gap' }, [U.tabs([['daftar', 'Daftar'], ['kanban', 'Kanban']], ui.layout, v => { ui.layout = v; refresh(); }, 'Tampilan tugas'), el('button', { class: 'btn primary', type: 'button', text: 'Tambah tugas', onclick: () => T.openForm(null) })])
      ]));
      const sel = (label, key, opts) => { const s = el('select', { 'aria-label': label }, [el('option', { value: '', text: label })].concat(opts.map(o => el('option', { value: o[0], text: o[1] })))); s.value = ui[key]; s.addEventListener('change', () => { ui[key] = s.value; renderList(); }); return s; };
      const q = el('input', { type: 'search', placeholder: 'Cari tugas', 'aria-label': 'Cari tugas', value: ui.q });
      q.addEventListener('input', U.debounce(() => { ui.q = q.value.trim(); renderList(); }, 200));
      host.append(el('div', { class: 'filters' }, [q, sel('Semua kategori', 'cat', CATS.map(x => [x, x])), sel('Semua status', 'status', Object.keys(STATUS).map(k => [k, STATUS[k]])), sel('Semua prioritas', 'prio', PRIO.map(x => [x, x]))]));
      const box = el('section', { class: 'card' });
      host.append(box);
      function renderList() {
        const list = filtered();
        box.replaceChildren();
        if (!list.length) { box.append(U.empty(S().tasks.length ? 'Tidak ada tugas yang cocok' : 'Belum ada tugas', S().tasks.length ? 'Ubah filter atau pilih rentang lain.' : 'Tambahkan tugas sekolah, latihan Cyber Security, atau urusan pribadi.', el('button', { class: 'btn primary', type: 'button', text: 'Tambah tugas', onclick: () => T.openForm(null) }))); return; }
        box.append(ui.layout === 'kanban' ? kanban(list) : el('ul', { class: 'tasks' }, list.map(listRow)));
      }
      renderList();
    }
  };
})();
