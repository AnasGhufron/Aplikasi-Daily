(function () {
  'use strict';
  const NX = window.NX, U = NX.util;
  const KEY = 'nexus.fired.v1';
  let mem = null;

  // Mencatat pengingat yang sudah muncul hari ini agar tidak berulang-ulang.
  function fired() {
    const today = U.today();
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.date === today) return o; } catch (e) { if (mem && mem.date === today) return mem; }
    return { date: today, keys: {} };
  }
  function fire(key, title, body) {
    const f = fired();
    if (f.keys[key]) return;
    f.keys[key] = 1;
    mem = f;
    try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) { /* abaikan */ }
    U.toast(title + (body ? ': ' + body : ''), 'warn');
    const s = NX.storage.get().settings;
    if (s.browserNotif && window.Notification && Notification.permission === 'granted') { try { new Notification(title, { body }); } catch (e) { /* abaikan */ } }
  }

  function check() {
    const st = NX.storage.get();
    if (!st.settings.remindersOn) return;
    const today = U.today(), now = U.nowMin(), lead = Number(st.settings.reminderLead) || 10;
    st.sessions.filter(s => s.date === today && s.status === 'direncanakan').forEach(s => {
      const d = U.toMin(s.start) - now;
      if (d <= lead && d >= -5) fire('sess:' + s.id, 'Sesi belajar segera dimulai', s.title + ' pukul ' + s.start);
    });
    st.tasks.filter(t => t.status !== 'done' && t.due === today).forEach(t => fire('task:' + t.id, 'Tenggat tugas hari ini', t.title));
    st.savings.forEach(g => { if (!g.achieved && g.date && g.date >= today && g.date <= U.addDays(today, 7) && NX.savings.collected(g) < g.target) fire('sav:' + g.id, 'Target tabungan mendekati tanggalnya', g.name); });
    if (U.weekday(today) === 6 && now >= 18 * 60) fire('weekly', 'Waktunya evaluasi mingguan', 'Buka Jadwal Saya, tab Evaluasi, atau menu Laporan.');
  }

  NX.reminders = {
    check,
    start() { check(); setInterval(check, 30000); }
  };
})();
