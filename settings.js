(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;
  const S = () => NX.storage.get();
  const refresh = () => NX.app.refresh();
  const card = (title, kids) => el('section', { class: 'card' }, [el('h2', { text: title })].concat(kids));

  function prefsForm() {
    const s = S().settings;
    const f = U.form({
      values: s, submitLabel: 'Simpan pengaturan',
      fields: [
        { name: 'name', label: 'Nama panggilan (untuk sapaan)', maxlength: 40 },
        { name: 'theme', label: 'Tema tampilan', type: 'select', options: [{ value: 'dark', label: 'Gelap' }, { value: 'light', label: 'Terang' }, { value: 'system', label: 'Ikuti sistem' }] },
        { name: 'travelMinutes', label: 'Waktu perjalanan ke sekolah (menit, sekali jalan)', type: 'number', min: 0, max: 240, integer: true, hint: 'Dipakai agar saran waktu belajar tidak menabrak perjalanan. Kosongkan bila tidak perlu.' },
        { name: 'wake', label: 'Jam bangun', type: 'time', required: true, half: true },
        { name: 'sleep', label: 'Jam tidur', type: 'time', required: true, half: true },
        { name: 'dailyGoalMin', label: 'Target belajar harian (menit)', type: 'number', min: 0, max: 600, integer: true, half: true },
        { name: 'weeklyGoalMin', label: 'Target belajar mingguan (menit)', type: 'number', min: 0, max: 4200, integer: true, half: true, hint: 'Bawaan 840 menit (14 jam). Sesuaikan dengan jadwalmu; kamu tidak perlu mengisi semua waktu kosong.' }
      ],
      onSubmit(o) {
        NX.storage.update(st => { Object.assign(st.settings, { name: o.name, theme: o.theme, travelMinutes: o.travelMinutes || 0, wake: o.wake, sleep: o.sleep, dailyGoalMin: o.dailyGoalMin || 0, weeklyGoalMin: o.weeklyGoalMin || 0 }); });
        U.toast('Pengaturan disimpan.', 'ok');
        return false;
      }
    });
    return f;
  }

  function categoriesCard() {
    const st = S();
    const used = (type, c) => st.transactions.some(t => t.type === type && t.category === c);
    const block = (type, title) => {
      const input = el('input', { type: 'text', maxlength: 40, placeholder: 'Kategori baru', 'aria-label': 'Nama kategori ' + title.toLowerCase() });
      const add = () => {
        const v = input.value.trim();
        if (!v) return;
        if (st.categories[type].some(c => c.toLowerCase() === v.toLowerCase())) { U.toast('Kategori sudah ada.', 'warn'); return; }
        NX.storage.update(s => { s.categories[type].push(v); });
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      return el('div', { class: 'cat-block' }, [el('h3', { text: title }),
        el('ul', { class: 'chips-list' }, st.categories[type].map(c => el('li', { class: 'cat-chip' }, [c, el('button', { type: 'button', class: 'chip-x', 'aria-label': 'Hapus kategori ' + c, title: used(type, c) ? 'Masih dipakai transaksi' : 'Hapus', disabled: used(type, c), onclick: () => NX.storage.update(s => { s.categories[type] = s.categories[type].filter(x => x !== c); }), text: '✕' })]))),
        el('div', { class: 'row gap' }, [input, el('button', { type: 'button', class: 'btn', text: 'Tambah', onclick: add })])]);
    };
    return card('Kategori keuangan', [el('p', { class: 'muted small', text: 'Kategori yang masih dipakai transaksi tidak bisa dihapus. Catatan: kategori pengeluaran "Tabungan" untuk uang yang keluar dari catatan ini (misalnya disetor ke rekening lain). Untuk memindahkan uang ke pos tabungan, pakai menu Target Tabungan.' }), block('income', 'Kategori pemasukan'), block('expense', 'Kategori pengeluaran')]);
  }

  function remindersCard() {
    const s = S().settings, supported = 'Notification' in window;
    const chk = (id, label, on, fn) => { const c = el('input', { type: 'checkbox', id }); c.checked = on; c.addEventListener('change', () => fn(c.checked)); return el('div', { class: 'check-line' }, [c, el('label', { for: id, text: label })]); };
    return card('Pengingat', [
      chk('remOn', 'Aktifkan pengingat di dalam aplikasi', s.remindersOn, v => NX.storage.update(st => { st.settings.remindersOn = v; })),
      supported ? chk('remNotif', 'Tampilkan juga sebagai notifikasi browser', s.browserNotif, async v => {
        if (v && Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') { U.toast('Izin notifikasi tidak diberikan browser.', 'warn'); NX.storage.update(st => { st.settings.browserNotif = false; }); return; } }
        NX.storage.update(st => { st.settings.browserNotif = v; });
      }) : el('p', { class: 'muted small', text: 'Browser ini tidak mendukung notifikasi.' }),
      el('div', { class: 'note info' }, [el('strong', { text: 'Batasan penting' }), el('p', { text: 'Pengingat hanya berjalan selama NEXUS terbuka di tab browser. Data disimpan di localStorage, yang tidak menjalankan kode saat browser ditutup. NEXUS tidak memakai notifikasi latar belakang atau server, jadi tidak ada pengingat saat browser tertutup.' })]),
      el('p', { class: 'muted small', text: 'Pengingat mencakup: sesi belajar yang akan mulai, tenggat tugas hari ini, evaluasi mingguan (Minggu sore), batas anggaran saat mencatat pengeluaran, dan target tabungan yang mendekati tanggalnya.' })
    ]);
  }

  async function doImport(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { U.toast('Berkas terlalu besar (maksimal 10 MB).', 'error'); return; }
    let text;
    try { text = await file.text(); } catch (e) { U.toast('Berkas tidak bisa dibaca.', 'error'); return; }
    const r = NX.storage.parseImport(text);
    if (!r.ok) { U.toast('Impor ditolak: ' + r.error, 'error'); return; }
    const body = el('div', {}, [el('p', { text: 'Berkas valid. Isi yang akan diimpor:' }), el('ul', { class: 'list' }, r.summary.map(x => el('li', { class: 'row between' }, [el('span', { text: x[0] }), el('strong', { text: String(x[1]) })]))),
      el('p', { class: 'muted small', text: 'Gabungkan: menambahkan data baru dan mempertahankan data yang sudah ada. Ganti: menimpa seluruh data saat ini. Cadangan otomatis dibuat sebelum data diterapkan.' }),
      el('div', { class: 'form-actions wrap' }, [el('button', { type: 'button', class: 'btn', text: 'Batal', onclick: () => U.closeModal() }), el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn', text: 'Gabungkan', onclick: () => { NX.storage.applyImport(r.data, 'merge'); U.closeModal(); U.toast('Data digabungkan.', 'ok'); } }),
        el('button', { type: 'button', class: 'btn danger', text: 'Ganti semua data', onclick: async () => { if (await U.confirm('Ganti seluruh data saat ini dengan isi berkas?', { danger: true, okLabel: 'Ganti', detail: 'Cadangan otomatis dibuat sebelumnya dan bisa dipulihkan.' })) { NX.storage.applyImport(r.data, 'replace'); U.closeModal(); U.toast('Data diganti.', 'ok'); } } })])]);
    U.openModal('Konfirmasi impor', body);
  }

  function dataCard() {
    const file = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'importFile', tabindex: '-1' });
    file.addEventListener('change', () => { doImport(file.files[0]); file.value = ''; });
    const info = NX.storage.backupInfo();
    return card('Data dan privasi', [
      el('div', { class: 'note info' }, [el('strong', { text: 'Data hanya ada di perangkat ini' }), el('p', { text: 'Semua data tersimpan di localStorage browser ini. Tidak ada server, akun, atau analytics, dan tidak ada yang dikirim ke mana pun. Data tidak otomatis sinkron antarperangkat; gunakan ekspor dan impor untuk memindahkannya. Menghapus data situs browser akan menghapus data NEXUS, jadi ekspor cadangan secara berkala.' }), el('p', { class: 'muted small', text: 'Penyimpanan lokal bukan pengganti sistem keuangan dengan keamanan server khusus. Siapa pun yang memakai browser ini bisa melihat datanya.' })]),
      el('div', { class: 'row gap wrap' }, [
        el('button', { type: 'button', class: 'btn primary', text: 'Ekspor semua data (JSON)', onclick: () => { U.download('nexus-data-' + U.today() + '.json', NX.storage.exportJSON(), 'application/json'); U.toast('Data diekspor.', 'ok'); } }),
        el('button', { type: 'button', class: 'btn', text: 'Impor dari JSON', onclick: () => file.click() }), file,
        el('button', { type: 'button', class: 'btn', text: 'Buat cadangan lokal', onclick: () => { const ok = NX.storage.backup(); U.toast(ok ? 'Cadangan dibuat.' : 'Cadangan gagal: penyimpanan penuh atau tidak tersedia.', ok ? 'ok' : 'error'); refresh(); } }),
        el('button', { type: 'button', class: 'btn', text: 'Pulihkan cadangan', disabled: !info, onclick: async () => { if (await U.confirm('Pulihkan cadangan dari ' + new Date(info.createdAt).toLocaleString('id-ID') + '?', { okLabel: 'Pulihkan', danger: true, detail: 'Data saat ini akan diganti oleh isi cadangan.' })) { const ok = NX.storage.restoreBackup(); U.toast(ok ? 'Cadangan dipulihkan.' : 'Cadangan tidak valid.', ok ? 'ok' : 'error'); } } })]),
      el('p', { class: 'muted small', text: info ? 'Cadangan terakhir: ' + new Date(info.createdAt).toLocaleString('id-ID') + '.' : 'Belum ada cadangan lokal.' }),
      el('div', { class: 'danger-zone' }, [el('h3', { text: 'Reset data' }), el('p', { class: 'muted', text: 'Menghapus seluruh data NEXUS di browser ini. Cadangan otomatis dibuat lebih dulu.' }), el('button', { type: 'button', class: 'btn danger', text: 'Reset semua data…', onclick: resetFlow })])
    ]);
  }

  async function resetFlow() {
    if (!(await U.confirm('Hapus SEMUA data NEXUS di browser ini?', { danger: true, okLabel: 'Lanjut', detail: 'Jadwal, progres belajar, tugas, transaksi, dan tabungan akan dihapus.' }))) return;
    const input = el('input', { type: 'text', 'aria-label': 'Ketik RESET untuk mengonfirmasi', placeholder: 'Ketik RESET', autocomplete: 'off' });
    const go = el('button', { type: 'button', class: 'btn danger', text: 'Hapus semua data', disabled: true, onclick: () => { NX.storage.reset(); U.closeModal(); U.toast('Semua data dihapus. Cadangan terakhir masih bisa dipulihkan.', 'ok'); } });
    input.addEventListener('input', () => { go.disabled = input.value.trim() !== 'RESET'; });
    U.openModal('Konfirmasi akhir', el('div', {}, [el('p', { text: 'Ketik RESET untuk menghapus seluruh data.' }), input, el('div', { class: 'form-actions' }, [el('button', { type: 'button', class: 'btn', text: 'Batal', onclick: () => U.closeModal() }), el('span', { class: 'spacer' }), go])]));
    input.focus();
  }

  NX.views.pengaturan = {
    render(host) {
      host.append(card('Preferensi', [prefsForm()]));
      host.append(card('Keuangan awal', [el('p', { class: 'muted', text: 'Saldo awal, sumber pemasukan, dan periode laporan.' }), el('button', { class: 'btn', type: 'button', text: 'Atur keuangan awal', onclick: () => NX.fin.openSetup() })]));
      host.append(categoriesCard(), remindersCard(), dataCard());
    }
  };
})();
