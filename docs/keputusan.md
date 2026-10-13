# Dokumen Keputusan — Aplikasi Hafalan Al-Qur'an Pribadi

14 Oktober 2026 · Firdaus Dabamona · Versi 0.1 (draf)

Sumber utama dokumen ini ada di Claude Docs; berkas ini salinannya di repositori agar kode dan keputusan tersimpan bersama. Bila keduanya berbeda, perbarui keduanya sekaligus.

## Ringkasan

Aplikasi Android pribadi (berkas APK yang dipasang langsung di HP) untuk menghafal Al-Qur'an, berjalan penuh tanpa internet, dimulai dari Juz 30. Satu pengguna, tanpa akun, tanpa server; semua data dan rekaman murojaah tersimpan di HP, sedangkan kode aplikasinya disimpan di GitHub.

Dokumen ini mengunci keputusan sebelum kode ditulis. Bagian "Keputusan terkunci" berisi yang sudah ditetapkan; bagian "Usulan arsitektur" masih usulan; bagian "Pertanyaan terbuka" perlu dijawab sebelum Fase 1 dimulai.

Di luar cakupan versi pertama: banyak pengguna, audio qari, pengenalan suara otomatis untuk mengoreksi bacaan, tafsir panjang, dan fitur sosial.

## Keputusan terkunci

| Kode | Bidang | Keputusan |
| --- | --- | --- |
| K-01 | Pengguna | Diri sendiri saja (usia 40+); tanpa login dan tanpa multi-akun |
| K-02 | Platform | Aplikasi Android berbentuk APK, dipasang langsung di HP, dipakai penuh tanpa internet (diubah 14 Okt 2026; sebelumnya PWA) |
| K-03 | Urutan belajar | Makna dulu, baru menghafal. Audio qari tidak disediakan di aplikasi (diubah 14 Okt 2026) |
| K-04 | Porsi | Potongan kecil, 1–3 ayat per potongan |
| K-05 | Pola ulang | Sabaq (hafalan baru) – Sabqi (hafalan dekat) – Manzil (hafalan lama) |
| K-06 | Jarak ulang | 1–3–7–14–30 hari |
| K-07 | Waktu | Hafalan baru setelah Subuh; murojaah sebelum tidur |
| K-08 | Target awal | Juz 30, dengan dua jalur: (a) berangsur sesuai tema, (b) urutan dari Juz 30 menuju Juz 1 |
| K-09 | Data | Sumber terbuka, lisensi dicek sebelum dipakai; cukup teks dan arti, tanpa audio |
| K-10 | Penyimpanan | Kode aplikasi di GitHub (repositori dausdabamona/hafalan-quran-); rekaman murojaah dan data hafalan di HP |
| K-11 | Pembuatan APK | APK dibangun otomatis oleh GitHub Actions |
| K-12 | Rekaman | Rekaman murojaah pribadi per ayat; hanya rekaman terbaru yang disimpan, menimpa rekaman lama ayat yang sama |
| K-13 | Tanda kata salah | Permanen: tetap ada walau ayat direkam ulang dan sudah lancar; hanya hilang bila dihapus manual. Menjadi penunjuk bagian rawan salah di masa depan |
| K-14 | Cara merekam | Rekam berurutan dalam satu potongan; tombol "Selesai ayat ini" menyimpan ayat tersebut dan pindah ke ayat berikutnya |
| K-15 | Tanda urutan tertukar | Jenis tanda kedua, dipasang pada sambungan antar-ayat (mis. "setelah ayat 5 lompat ke ayat 8"); permanen seperti K-13 dan ikut menurunkan jarak jadwal |
| K-16 | Teks tertutup saat murojaah | Teks ayat berikutnya tersembunyi sampai "Selesai ayat ini" ditekan |
| K-17 | Mode "Sambung ayat" | Aplikasi menampilkan satu ayat, pengguna membaca ayat sesudahnya, ketuk untuk membuka jawaban; sambungan yang pernah tertukar didahulukan. Panel ayat mirip (mutasyabihat) ditunda sampai setelah uji pakai dan cek lisensi |
| K-18 | Bentuk tulisan | Rasm Utsmani Mushaf Madinah (teks Tanzil) |
| K-19 | Makna | Arti per kata saja, tanpa terjemahan per ayat; ditambah keterangan pribadi yang bisa diisi sendiri |
| K-20 | Perangkat | HP yang dipakai Firdaus saat ini; versi Android persis dicek di Fase 1 |

## Metode dan alur harian

**Sesi pagi (setelah Subuh) — Sabaq**

1. Baca makna potongan: arti per kata dan keterangan pribadi.
2. Baca sambil melihat, lalu coba tanpa melihat.
3. Rekam bacaan hafalan per ayat; rekaman baru menimpa rekaman lama ayat itu.
4. Koreksi mandiri: putar rekaman sambil melihat ayat, ketuk kata yang salah dan sambungan yang tertukar.
5. Potongan masuk jadwal ulang hari ke-1.

**Sesi malam (sebelum tidur) — Sabqi dan Manzil**

1. Aplikasi menampilkan daftar potongan yang jatuh tempo hari ini.
2. Untuk tiap potongan: rekam dengan teks tertutup, lalu koreksi mandiri.
3. Lancar → naik ke jarak berikutnya (1 → 3 → 7 → 14 → 30 hari). Ada kesalahan baru → kembali ke jarak 1 hari (menunggu P-03).

**Pembagian (usulan definisi)**

- Sabaq: potongan yang sedang dihafal hari ini.
- Sabqi: potongan dengan jarak 1, 3, atau 7 hari.
- Manzil: potongan dengan jarak 14 atau 30 hari.

## Fitur versi pertama

| Kode | Fitur | Perilaku | Batasan versi pertama |
| --- | --- | --- | --- |
| F-01 | Tampilan ayat | Teks Utsmani Madinah; ketuk kata → muncul arti bahasa Indonesia dan keterangan pribadi yang bisa diisi sendiri | Satu jenis huruf; arti per kata hanya bahasa Indonesia |
| F-02 | Rekam murojaah | Rekam per ayat; putar ulang sambil melihat ayat; ayat dalam satu potongan diputar berurutan | Hanya rekaman terbaru per ayat |
| F-03 | Koreksi mandiri | Ketuk kata yang salah pada ayat; tanda tersimpan permanen | Penilaian sendiri; tanpa pengenalan suara |
| F-04 | Jadwal murojaah | Daftar jatuh tempo hari ini dari jarak 1–3–7–14–30 | Notifikasi menyusul (P-18) |
| F-05 | Cadangan | Ekspor jadwal, tanda, dan rekaman ke satu berkas di folder HP; impor kembali | Manual dari layar pengaturan |
| F-06 | Tanda urutan tertukar | Ketuk sambungan antar-ayat lalu pilih ayat yang terbaca keliru | Dihapus hanya manual |
| F-07 | Teks tertutup | Ayat berikutnya tertutup sampai "Selesai ayat ini" ditekan | Sesi murojaah malam dan mode Sambung ayat |
| F-08 | Mode Sambung ayat | Tampil satu ayat → baca ayat sesudahnya → ketuk untuk membuka | Sambungan bertanda tertukar dulu, lalu acak dalam surah |

## Sumber data dan lisensi

| Data | Sumber kandidat | Temuan lisensi | Status |
| --- | --- | --- | --- |
| Teks Utsmani | [Tanzil](https://tanzil.net/pub/download/v1.0/) | CC BY 3.0; sumber disebut dan ditautkan ke tanzil.net; teks tidak boleh diubah | Aman |
| Arti per kata | [QUL (Tarteel)](https://qul.tarteel.ai/resources) | Lisensi per berkas belum terbaca | Perlu dicek |

## Usulan arsitektur (belum dikunci)

| Lapisan | Usulan | Alasan |
| --- | --- | --- |
| Antarmuka | React 19 + Vite + TypeScript, tema terang | Sama dengan proyek lain |
| Pembungkus APK | Capacitor | Kode web yang sama menjadi aplikasi Android |
| Data teks dan jadwal | Dexie (IndexedDB) | Ayat, arti per kata, potongan, jadwal, tanda |
| Rekaman | MediaRecorder + plugin Filesystem Capacitor | Berkas tetap di HP |
| Cadangan | Ekspor/impor satu berkas | Data ikut terhapus bila aplikasi di-uninstall |
| Build | GitHub Actions → APK siap unduh | Tanpa Android Studio di komputer |

**Model data inti (usulan)**

- `ayat`: surah, ayat, teks Utsmani.
- `kata`: surah, ayat, urutan kata, teks, arti.
- `keterangan`: surah, ayat, urutan kata (kosong bila untuk satu ayat), isi catatan, tanggal diubah.
- `potongan`: id, surah, ayat awal–akhir, jalur (tema/urutan), urutan dalam jalur.
- `jadwal`: id potongan, jarak saat ini, tanggal jatuh tempo, riwayat.
- `tanda_salah`: surah, ayat, urutan kata, tanggal ditandai, tanggal terakhir salah, jumlah kali salah.
- `tanda_tertukar`: surah, ayat asal, ayat seharusnya, ayat yang terbaca keliru, tanggal ditandai, jumlah kali tertukar.
- `rekaman`: surah, ayat (satu baris per ayat, ditimpa saat merekam ulang), tanggal rekam terakhir, lokasi berkas, durasi.

## Rencana fase

Setiap fase ditutup gerbang "LANJUT".

1. **Fase 0 — Data dan lisensi.** Pilih sumber arti per kata, catat lisensinya, susun data Juz 30 (564 ayat) ke JSON. *Gerbang:* lisensi tercatat, data lengkap.
2. **Fase 1 — Kerangka aplikasi dan APK pertama (F-01).** *Gerbang:* APK berjalan dalam mode pesawat.
3. **Fase 2 — Rekam dan koreksi (F-02, F-03, F-06, F-07).** *Gerbang:* rekaman dan tanda tetap ada setelah HP dinyalakan ulang.
4. **Fase 3 — Jadwal dan mode Sambung ayat (F-04, F-08).** *Gerbang:* simulasi 30 hari menghasilkan jadwal yang benar.
5. **Fase 4 — Cadangan (F-05).** *Gerbang:* uninstall, pasang ulang, semua data pulih dari berkas cadangan.
6. **Fase 5 — Uji pakai 14 hari.** *Gerbang:* daftar perbaikan disetujui.

## Pertanyaan terbuka

Terjawab: P-13 (arti per kata + keterangan pribadi), P-14 (Madinah), P-16 (HP saat ini), P-17, P-20, P-23, P-24. Masih terbuka:

- [ ] P-01 Definisi "lancar" — usulan: tidak ada kesalahan baru pada sesi itu; tanda lama tetap tersorot.
- [ ] P-02 Setelah jarak 30 hari — usulan: tetap tiap 30 hari.
- [ ] P-03 Ada kesalahan baru — usulan: kembali ke 1 hari; alternatif turun satu tingkat.
- [ ] P-04 Jumlah Sabaq per hari dan batas murojaah malam — usulan: satu potongan baru per pagi.
- [ ] P-05 Hari terlewat — usulan: tanggungan menumpuk, urut dari yang paling terlambat.
- [ ] P-06 Syarat menambah Sabaq — usulan: Sabaq kemarin harus lancar dulu.
- [ ] P-07 Sima'i tanpa audio di aplikasi — tetap dilakukan di luar aplikasi (centang "sudah mendengar") atau dihapus?
- [ ] P-08 Penyusun pengelompokan tema Juz 30.
- [ ] P-09 Arah jalur urutan di dalam Juz 30 (An-Nas → An-Naba' atau sebaliknya).
- [ ] P-10 Satu jalur aktif — usulan: ya, potongan hafal tetap terhitung bila pindah jalur.
- [ ] P-11 Pembagian potongan — usulan: otomatis, bisa diubah manual.
- [ ] P-12 Visibilitas repositori — usulan: privat.
- [ ] P-15 Ukuran huruf — usulan: besar dan bisa diperbesar.
- [ ] P-18 Notifikasi pengingat masuk versi pertama atau menyusul.
- [ ] P-19 Nama aplikasi — usulan: Rabth, Sabaq, Murojaah, Hifzhi.
- [ ] P-21 Kunci tanda tangan APK — usulan: secret di GitHub + salinan di Drive pribadi.
- [ ] P-22 Kebiasaan cadangan — usulan: pengingat ekspor tiap pekan.

## Risiko

| Risiko | Penanganan |
| --- | --- |
| Kesalahan makhraj/tajwid tak disadari | Setoran berkala ke guru; rekaman terbaru bisa diperdengarkan |
| Rekaman lama tertimpa | Kemajuan dilihat dari riwayat tanda dan jadwal |
| Data hanya di HP | Ekspor cadangan rutin + salinan ke Google Drive |
| Kunci tanda tangan APK hilang | Disimpan di dua tempat |
| Teks salah karena salah olah data | Teks Tanzil apa adanya; sampel dicocokkan dengan mushaf cetak |
| Fitur terus bertambah | Fitur baru menunggu setelah uji pakai 14 hari |
