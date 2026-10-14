(function () {
  'use strict';
  const NX = window.NX, U = NX.util, el = U.el;

  NX.routes = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', bottom: true },
    { id: 'jadwal', label: 'Jadwal Saya', icon: 'calendar', bottom: true },
    { id: 'academy', label: 'Cyber Security Academy', short: 'Academy', icon: 'shield', bottom: true },
    { id: 'tugas', label: 'Tugas dan Proyek', icon: 'tasks' },
    { id: 'keuangan', label: 'Keuangan', icon: 'wallet', bottom: true },
    { id: 'anggaran', label: 'Anggaran', icon: 'pie' },
    { id: 'tabungan', label: 'Target Tabungan', icon: 'target' },
    { id: 'rutinitas', label: 'Rutinitas', icon: 'sun' },
    { id: 'laporan', label: 'Laporan', icon: 'bars' },
    { id: 'pengaturan', label: 'Pengaturan', icon: 'sliders' }
  ];
  const app = (NX.app = {});
  let currentId = null, pending = false;

  const routeId = () => { const id = (location.hash || '').replace(/^#\/?/, '').split('?')[0]; return NX.routes.some(r => r.id === id) ? id : 'dashboard'; };

  function renderView(navigated) {
    const id = routeId(), route = NX.routes.find(r => r.id === id), host = document.getElementById('view');
    const y = window.scrollY;
    host.replaceChildren();
    try { NX.views[id].render(host); }
    catch (e) {
      console.error(e);
      host.append(el('section', { class: 'card' }, [el('h2', { text: 'Halaman gagal ditampilkan' }), el('p', { class: 'muted', text: 'Terjadi kesalahan: ' + (e && e.message ? e.message : e) + '. Data kamu tidak berubah. Coba muat ulang halaman.' })]));
    }
    document.getElementById('pageTitle').textContent = route.label;
    document.title = route.label + ' — NEXUS';
    document.querySelectorAll('[data-route]').forEach(a => { if (a.dataset.route === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (navigated || id !== currentId) { window.scrollTo(0, 0); host.focus({ preventScroll: true }); } else window.scrollTo(0, y);
    currentId = id;
  }
  app.refresh = () => renderView(false);
  function scheduleRefresh() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; renderView(false); }); }

  function buildNav() {
    const nav = document.getElementById('nav'), bottom = document.getElementById('bottomNav');
    NX.routes.forEach(r => nav.append(el('a', { class: 'nav-link', href: '#/' + r.id, dataset: { route: r.id } }, [U.icon(r.icon), el('span', { text: r.label })])));
    NX.routes.filter(r => r.bottom).forEach(r => bottom.append(el('a', { class: 'bn-link', href: '#/' + r.id, dataset: { route: r.id } }, [U.icon(r.icon), el('span', { text: r.short || r.label })])));
    bottom.append(el('button', { type: 'button', class: 'bn-link', id: 'bnMenu', 'aria-label': 'Buka semua menu' }, [U.icon('menu'), el('span', { text: 'Menu' })]));
  }

  function setupDrawer() {
    const sb = document.getElementById('sidebar'), scrim = document.getElementById('scrim'), btn = document.getElementById('menuBtn');
    const set = open => { sb.classList.toggle('open', open); scrim.hidden = !open; btn.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('no-scroll', open); if (open) sb.querySelector('a').focus(); };
    btn.addEventListener('click', () => set(!sb.classList.contains('open')));
    document.getElementById('bnMenu').addEventListener('click', () => set(true));
    scrim.addEventListener('click', () => set(false));
    sb.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sb.classList.contains('open') && !document.querySelector('dialog[open]')) { set(false); btn.focus(); } });
  }

  function applyTheme() {
    const t = NX.storage.get().settings.theme;
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  function showBanner() {
    const b = document.getElementById('banner'), s = NX.storage.status, msgs = [];
    if (s.memoryOnly) msgs.push('Penyimpanan browser tidak tersedia (mungkin mode privat atau diblokir). Data hanya bertahan selama tab ini terbuka. Ekspor data lewat Pengaturan secara berkala.');
    if (s.quotaError) msgs.push('Penyimpanan browser penuh atau menolak penulisan. Perubahan terbaru mungkin tidak tersimpan. Ekspor data lewat Pengaturan, lalu kosongkan ruang.');
    if (s.recovered) msgs.push('Data tersimpan sebelumnya rusak dan tidak bisa dibaca. NEXUS memulai dari data kosong; salinan data lama disimpan di localStorage dengan kunci nexus.v1.rusak.');
    b.textContent = msgs.join(' ');
    b.hidden = !msgs.length;
    document.getElementById('storageNote').textContent = s.memoryOnly ? 'Penyimpanan tidak tersedia: data sementara.' : 'Data tersimpan di perangkat ini.';
  }

  function init() {
    NX.storage.init();
    U.initModal();
    document.getElementById('menuBtn').replaceChildren(U.icon('menu'));
    document.getElementById('themeBtn').replaceChildren(U.icon('half'));
    document.getElementById('modalClose').replaceChildren(U.icon('x'));
    buildNav();
    setupDrawer();
    applyTheme();
    showBanner();
    document.getElementById('themeBtn').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      NX.storage.update(st => { st.settings.theme = dark ? 'light' : 'dark'; });
    });
    NX.bus.on('change', () => { applyTheme(); showBanner(); scheduleRefresh(); });
    NX.bus.on('storage-error', () => { showBanner(); U.toast('Data gagal disimpan: penyimpanan browser penuh atau ditolak.', 'error'); });
    window.addEventListener('hashchange', () => renderView(true));
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    renderView(true);
    NX.reminders.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
