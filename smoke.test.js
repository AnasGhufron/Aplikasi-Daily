// Uji asap di browser nyata (Chromium via Playwright). Jalankan: node tests/smoke.test.js
// Membutuhkan paket "playwright" dan browser Chromium terpasang.
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ROUTES = ['dashboard', 'jadwal', 'academy', 'tugas', 'keuangan', 'anggaran', 'tabungan', 'rutinitas', 'laporan', 'pengaturan'];
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ✔ ' + msg); } else { failed++; console.log('  ✘ GAGAL: ' + msg); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  console.log('Render semua halaman');
  await page.goto(URL);
  for (const r of ROUTES) {
    await page.goto(URL + '#/' + r);
    await page.waitForTimeout(80);
    const txt = await page.locator('#view').innerText();
    ok(txt.length > 20 && !/gagal ditampilkan/.test(txt), 'halaman ' + r + ' tampil');
  }

  console.log('Alur jadwal sekolah dan sesi belajar');
  await page.goto(URL + '#/jadwal');
  await page.getByRole('button', { name: 'Jadwal Sekolah' }).click();
  await page.getByRole('button', { name: 'Tambah jadwal sekolah' }).first().click();
  await page.getByLabel('Nama kegiatan atau mata pelajaran').fill('Matematika');
  await page.getByLabel('Jam mulai').fill('07:00');
  await page.getByLabel('Jam selesai').fill('08:30');
  await page.locator('#modal select[name=day]').selectOption(String((new Date().getDay() + 6) % 7));
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(150);
  ok((await page.locator('#view').innerText()).includes('Matematika'), 'jadwal sekolah tersimpan dan tampil');

  await page.getByRole('button', { name: 'Kalender' }).click();
  await page.getByRole('button', { name: 'Tambah sesi belajar' }).first().click();
  await page.locator('#modal select[name=topicId]').selectOption('t1_1');
  await page.locator('#modal input[name=start]').fill('07:30');
  await page.locator('#modal input[name=end]').fill('08:00');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(150);
  ok(await page.locator('dialog.confirm[open]').count() === 1, 'bentrok jadwal memunculkan peringatan');
  await page.locator('dialog.confirm button', { hasText: 'Batal' }).click();
  await page.waitForTimeout(100);
  await page.locator('#modal input[name=start]').fill('19:00');
  await page.locator('#modal input[name=end]').fill('20:00');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(150);
  ok((await page.locator('#view').innerText()).includes('Cara kerja komputer'), 'sesi belajar tersimpan');

  console.log('Data bertahan setelah reload');
  await page.reload();
  await page.waitForTimeout(100);
  ok((await page.locator('#view').innerText()).includes('Cara kerja komputer'), 'sesi masih ada setelah reload');

  console.log('Academy');
  await page.goto(URL + '#/academy');
  await page.locator('summary', { hasText: 'Tahap 1' }).click().catch(() => {});
  await page.getByRole('button', { name: /Cara kerja komputer, hardware/ }).first().click();
  await page.getByRole('button', { name: 'Mulai Belajar' }).click();
  await page.waitForTimeout(150);
  await page.locator('#modal input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Tandai Selesai' }).click();
  await page.locator('dialog.confirm button', { hasText: 'Tandai selesai' }).click();
  await page.waitForTimeout(150);
  const st1 = await page.evaluate(() => NX.learning.stats());
  ok(st1.done === 1, 'materi ditandai selesai, progres roadmap diperbarui (' + st1.pct + '%)');
  await page.keyboard.press('Escape');

  console.log('Keuangan: perhitungan saldo');
  await page.goto(URL + '#/keuangan');
  await page.evaluate(() => NX.storage.update(s => { s.settings.startingBalance = 100000; s.settings.financeSetup = 'done'; }));
  const addTx = async (type, amount, cat, desc) => {
    await page.getByRole('button', { name: type === 'income' ? 'Catat pemasukan' : 'Catat pengeluaran' }).first().click();
    await page.locator('#modal input[name=amount]').fill(String(amount));
    await page.locator('#modal select[name=category]').selectOption(cat);
    await page.locator('#modal input[name=description]').fill(desc);
    await page.getByRole('button', { name: 'Simpan' }).click();
    await page.waitForTimeout(120);
  };
  await addTx('income', 500000, 'Uang saku', 'Uang saku mingguan');
  await addTx('expense', 25000, 'Makanan', 'Makan siang');
  const bal = await page.evaluate(() => NX.fin.balance());
  ok(bal === 575000, 'saldo = saldo awal + pemasukan - pengeluaran (' + bal + ')');
  const month = await page.evaluate(() => NX.fin.month(NX.util.monthKey(NX.util.today())));
  ok(month.income === 500000 && month.expense === 25000, 'saldo awal tidak dihitung sebagai pemasukan');

  await page.getByRole('button', { name: 'Catat pengeluaran' }).first().click();
  await page.locator('#modal input[name=amount]').fill('-500');
  await page.getByRole('button', { name: 'Simpan' }).click();
  ok(await page.locator('#modal .form-error').isVisible(), 'nominal negatif ditolak');
  await page.locator('#modal input[name=amount]').fill('1500.5');
  await page.getByRole('button', { name: 'Simpan' }).click();
  ok(await page.locator('#modal .form-error').isVisible(), 'nominal desimal ditolak');
  await page.getByRole('button', { name: 'Batal' }).click();

  console.log('Tabungan tidak dihitung ganda');
  await page.goto(URL + '#/tabungan');
  await page.evaluate(() => NX.storage.update(s => { s.savings.push({ id: 'g1', name: 'Laptop', target: 1000000, date: '', notes: '', contributions: [{ id: 'c1', date: NX.util.today(), amount: 200000, type: 'setoran', note: '' }], achieved: false }); }));
  const r = await page.evaluate(() => ({ balance: NX.fin.balance(), available: NX.fin.available(), exp: NX.fin.month(NX.util.monthKey(NX.util.today())).expense }));
  ok(r.balance === 575000 && r.available === 375000 && r.exp === 25000, 'tabungan memisahkan saldo tersedia tanpa menjadi pengeluaran');

  console.log('Anggaran dan peringatan');
  await page.evaluate(() => NX.storage.update(s => { s.budgets.total = 30000; }));
  const fresh = await page.evaluate(() => NX.budget.checkAlerts(NX.util.monthKey(NX.util.today())).length);
  ok(fresh === 1, 'peringatan ambang anggaran muncul sekali');
  const again = await page.evaluate(() => NX.budget.checkAlerts(NX.util.monthKey(NX.util.today())).length);
  ok(again === 0, 'peringatan tidak berulang untuk ambang yang sama');

  console.log('Ekspor dan impor');
  const json = await page.evaluate(() => NX.storage.exportJSON());
  const good = await page.evaluate(t => NX.storage.parseImport(t).ok, json);
  ok(good === true, 'hasil ekspor valid untuk diimpor');
  const bad1 = await page.evaluate(() => NX.storage.parseImport('{bukan json').ok);
  const bad2 = await page.evaluate(() => NX.storage.parseImport(JSON.stringify({ transactions: [{ type: 'income', amount: -5, date: '2026-01-01', category: 'x' }] })).ok);
  ok(bad1 === false && bad2 === false, 'berkas tidak valid ditolak');

  console.log('Tampilan HP (375px)');
  await page.setViewportSize({ width: 375, height: 800 });
  for (const rt of ROUTES) {
    await page.goto(URL + '#/' + rt);
    await page.waitForTimeout(60);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 0, 'tidak ada overflow horizontal di ' + rt + (over > 0 ? ' (' + over + 'px)' : ''));
  }

  ok(errors.length === 0, 'tidak ada error konsol' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('\nLulus: ' + passed + ', gagal: ' + failed);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
