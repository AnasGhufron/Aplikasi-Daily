# NEXUS — Personal Command Center

Dashboard pribadi untuk mengatur jadwal, belajar Cyber Security dari nol, tugas, dan keuangan. Berjalan sepenuhnya di browser: tanpa backend, tanpa akun, tanpa pustaka eksternal, tanpa CDN.

## Cara menjalankan

1. Ekstrak folder `nexus/`.
2. Buka `index.html` dengan dobel klik (Chrome, Edge, Firefox, atau Safari terbaru).
3. Opsional untuk HP: jalankan server lokal dari dalam folder, misalnya `python3 -m http.server 8080`, lalu buka `http://<IP-laptop>:8080` dari HP di jaringan Wi-Fi yang sama. Data HP dan laptop **tidak** tersinkron (lihat Keterbatasan).

## Struktur folder

```
nexus/
├── index.html
├── css/
│   ├── style.css          # token warna, tata letak, form, modal, tombol
│   ├── dashboard.css      # dashboard, jadwal, tugas, rutinitas
│   ├── learning.css       # Cyber Security Academy
│   ├── finance.css        # keuangan, anggaran, tabungan, grafik
│   └── responsive.css     # tablet dan HP
├── js/
│   ├── utils.js           # helper DOM aman, tanggal, form, modal, grafik SVG
│   ├── storage.js         # satu-satunya lapisan akses data (localStorage)
│   ├── curriculum.js      # 8 tahap, 24 materi Academy
│   ├── schedule.js        # jadwal sekolah, sesi belajar, bentrok, evaluasi
│   ├── learning.js        # roadmap, detail materi, progres
│   ├── tasks.js           # tugas (daftar dan Kanban)
│   ├── finance.js         # transaksi, saldo, pengaturan awal, CSV
│   ├── budget.js          # anggaran dan peringatan 75/90/100%
│   ├── savings.js         # target tabungan
│   ├── habits.js          # rutinitas dan kebiasaan
│   ├── reports.js         # laporan mingguan dan bulanan
│   ├── settings.js        # preferensi, kategori, ekspor/impor/cadangan/reset
│   ├── dashboard.js       # halaman utama
│   ├── reminders.js       # pengingat (hanya saat aplikasi terbuka)
│   └── app.js             # navigasi, tema, banner
└── tests/                 # uji otomatis (opsional, butuh Node + Playwright)
```

Skrip dimuat sebagai file biasa (bukan ES module) agar bisa dibuka langsung dari `file://`. Tidak ada `onclick` inline; semua event memakai `addEventListener`.

## Fitur

- **Dashboard:** sapaan, agenda hari ini, aktivitas belum selesai, statistik belajar dan keuangan, aktivitas mendatang, pengingat anggaran, aksi cepat. Semua angka dihitung dari datamu; tidak ada angka contoh.
- **Jadwal Saya:** jadwal sekolah mingguan (berulang atau sekali), hari libur, pengecualian satu jadwal, hari sekolah khusus. Sesi belajar dengan status Direncanakan / Selesai / Terlewat / Dijadwalkan Ulang. Tampilan hari, minggu, bulan. Peringatan bentrok. Saran waktu belajar yang menghindari sekolah, waktu perjalanan, rutinitas, jam tidur, dan memberi jeda. Evaluasi mingguan tanpa skor hukuman.
- **Cyber Security Academy:** 8 tahap / 24 materi dengan penjelasan, tujuan, estimasi, prasyarat, checklist, latihan, catatan, tingkat pemahaman, dan referensi. Tombol Mulai Belajar, Tandai Selesai, Ulangi Materi, Tambah Catatan, Jadwalkan Sesi, Buka Referensi. Timer "Mulai sesi belajar".
- **Tugas dan Proyek:** tambah/ubah/hapus/cari, filter, tampilan daftar dan Kanban, tab hari ini / mendatang / terlambat, tautan ke sesi belajar.
- **Keuangan:** transaksi lengkap, filter, urutan, ekspor CSV, pengaturan awal yang boleh dilewati.
- **Anggaran:** total dan per kategori, peringatan 75/90/100% (sekali per ambang), riwayat bulanan.
- **Target Tabungan:** banyak target, setoran, koreksi tercatat, estimasi kebutuhan per minggu/bulan, peringatan realistis berdasarkan data.
- **Rutinitas:** rutinitas harian dan pelacak kebiasaan tanpa streak.
- **Laporan:** mingguan dan bulanan dengan grafik dan wawasan yang hanya dibuat bila datanya cukup.
- **Pengaturan:** tema gelap/terang/sistem, preferensi, kategori sendiri, pengingat, ekspor/impor JSON, cadangan lokal, reset berlapis.

## Aturan perhitungan keuangan

- Saldo akhir = saldo awal + total pemasukan − total pengeluaran. Saldo awal tidak pernah dihitung sebagai pemasukan.
- Nominal transaksi harus bilangan bulat Rupiah > 0. Nominal negatif, desimal, atau tidak valid ditolak; kategori dan tanggal wajib.
- Mengubah atau menghapus transaksi langsung menghitung ulang saldo, anggaran, dan laporan.
- **Tabungan** adalah alokasi, bukan pengeluaran: Saldo tersedia = saldo − total dana di target tabungan. Setoran tidak bisa melebihi saldo tersedia, dan koreksi tidak bisa melebihi dana yang terkumpul.
- Kategori pengeluaran "Tabungan" untuk uang yang benar-benar keluar dari catatan ini (misalnya disetor ke rekening lain). Untuk memindahkan uang ke pos tabungan, pakai menu Target Tabungan agar tidak terhitung dua kali.
- Anggaran berlaku sama untuk setiap bulan. Riwayat membandingkan anggaran terkini dengan pengeluaran aktual tiap bulan.

## Penyimpanan lokal dan privasi

- Semua data disimpan di `localStorage` browser ini dengan kunci `nexus.v1` (skema berversi). Tidak ada yang dikirim ke server, tidak ada analytics.
- Data **tidak** tersinkron antarperangkat. Pindahkan lewat Ekspor JSON lalu Impor.
- Impor memvalidasi struktur lebih dulu, menampilkan ringkasan, meminta pilihan Gabungkan atau Ganti, dan membuat cadangan otomatis sebelum menerapkan.
- Data rusak tidak dihapus: salinannya disimpan dengan kunci `nexus.v1.rusak.<waktu>` dan aplikasi mulai dari data kosong.
- Bila penyimpanan browser tidak tersedia atau penuh, muncul banner peringatan dan aplikasi tetap berjalan di memori.
- Penyimpanan lokal **bukan** pengganti sistem keuangan dengan keamanan server. Siapa pun yang memakai browser ini bisa melihat datanya. Aplikasi ini belum diaudit secara profesional.

## Keamanan implementasi

Teks dari pengguna selalu ditampilkan lewat `textContent`/node teks (tidak ada `innerHTML`), tidak ada `eval`, tidak ada permintaan jaringan, tidak ada pustaka eksternal. Ekspor CSV menetralkan sel yang diawali `=`, `+`, `-`, `@` agar tidak dieksekusi sebagai rumus. Tautan referensi memakai `rel="noopener noreferrer"`.

## Keterbatasan (jujur)

- **Pengingat hanya berjalan saat NEXUS terbuka di tab browser.** `localStorage` tidak menjalankan kode saat browser ditutup, dan tidak ada notifikasi latar belakang atau sinkronisasi. Notifikasi browser (opsional) juga hanya muncul saat tab terbuka. Tab latar belakang di HP bisa ditunda browser.
- Tidak ada sinkronisasi atau backup otomatis ke cloud; ekspor manual secara berkala.
- Satu cadangan lokal (yang terakhir) disimpan di browser yang sama; bila data situs dihapus, cadangan itu ikut hilang. Simpan juga berkas ekspor di tempat lain.
- Anggaran bersifat tunggal (tidak per bulan). Tidak ada multi-akun atau transfer antarakun.
- Drag-and-drop Kanban tidak ada; perpindahan kartu memakai tombol (lebih ramah layar sentuh dan keyboard).
- Tautan referensi Academy hanya mengarah ke situs resmi/edukasi yang dikenal; bila ada yang berubah di internet, tautannya mungkin perlu diperbarui.
- Estimasi durasi materi adalah perkiraan umum, bukan janji.
- Belum diuji pada Safari/iOS dan perangkat Android sungguhan; pengujian dilakukan di Chromium (lihat di bawah).

## Etika dan hukum

Materi praktik hanya untuk sistem milikmu sendiri, lab lokal, atau platform yang memberi izin eksplisit (mis. TryHackMe, PortSwigger Web Security Academy, picoCTF). Jangan menguji sistem milik orang lain tanpa izin tertulis.

## Pengujian

Uji otomatis (opsional): butuh Node.js dan paket `playwright` dengan Chromium.

```
node tests/smoke.test.js   # 35 pemeriksaan: semua halaman, jadwal, bentrok, reload, Academy, saldo, tabungan, anggaran, impor, overflow HP
node tests/flows.test.js   # 25 pemeriksaan: tugas, tabungan, kebiasaan, tema, data rusak, impor UI, menu HP, reset berlapis
```

Hasil terakhir saat dibuat: 35/35 dan 25/25 lulus di Chromium (desktop 1280px dan HP 375–390px), tanpa error konsol.

### Checklist pengujian manual (yang sebaiknya kamu coba sendiri)

- [ ] Tambah jadwal sekolah berulang, lalu tambah sesi belajar yang bentrok dan periksa peringatan.
- [ ] Tandai satu tanggal sebagai libur dan pastikan jadwal sekolah hari itu hilang.
- [ ] Mulai sesi dengan timer, selesaikan, lalu periksa Evaluasi mingguan.
- [ ] Mulai dan selesaikan satu materi Academy; progres roadmap di Dashboard berubah.
- [ ] Atur saldo awal, catat pemasukan dan pengeluaran, edit dan hapus; saldo mengikuti.
- [ ] Atur anggaran dan lewati 75%, 90%, 100%; peringatan muncul sekali per ambang.
- [ ] Buat target tabungan, setor, koreksi; Saldo tersedia berubah, pengeluaran tidak.
- [ ] Ekspor JSON, reset, lalu impor kembali.
- [ ] Buka di HP: menu bawah, formulir, grafik, dan tidak ada geser horizontal.
- [ ] Coba navigasi hanya dengan keyboard (Tab, Enter, Esc) dan mode terang/gelap.

## Rencana tahap berikutnya (belum dibuat)

Ekspor laporan ke PDF/cetak yang lebih rapi, anggaran per bulan, drag-and-drop Kanban, PWA agar bisa dipasang di HP (service worker; tetap tanpa sinkronisasi), dan IndexedDB bila data membesar.
