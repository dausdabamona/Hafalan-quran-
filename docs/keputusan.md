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
| K-20 | Perangkat | OPPO A7 Pro (ColorOS). APK memakai batas minimum Capacitor, Android 7 (API 24); versi Android persis dicek saat APK pertama dipasang |
| K-21 | Istilah | Bahasa Indonesia sebagai istilah utama, istilah Arab kecil di bawahnya: Hafalan baru (Sabaq), Ulang hafalan — Dekat (Sabqi) dan Lama (Manzil); boleh ditinjau ulang kemudian |
| K-22 | ~~Deres per rukuk~~ (diganti K-23) | Tambahan satu rukuk per hari di layar Hari ini, bergilir dari rukuk yang paling lama tidak dideres; rukuk yang belum lengkap dihafal dideres pada bagian yang sudah hafal (minimal dua ayat berurutan). Kesalahan baru menurunkan potongan yang memuatnya ke jarak 1 hari; tanda permanen sama dengan koreksi biasa. Data rukuk dari quran-meta (MIT, Hafs): 39 rukuk Juz 30 (14 Okt 2026) |
| K-23 | Murojaah per rukuk | Satuan ulang hafalan dan rekam-koreksi adalah rukuk (556 rukuk, quran-meta, Hafs). Rukuk yang belum lengkap ("berjalan") diulang setiap hari pada bagian yang sudah hafal; rukuk lengkap berjarak 1–3–7–14–30 hari; kesalahan baru kembali ke 1 hari. Hafalan baru tetap 1–3 ayat sehari, tidak melewati batas rukuk. Rekaman tetap disimpan per ayat (K-04) (14 Okt 2026) |
| K-24 | Cakupan dan jalur | 30 juz lengkap; jalur hafalan Al-Fatihah → An-Nas. Jalur sesuai tema disembunyikan dulu (14 Okt 2026) |
| K-25 | Makna per waqaf | Di bawah tiap ayat tampil makna per potongan sesuai tanda waqaf; bawaannya gabungan arti per kata, bisa disunting dan dikembalikan. Arti per kata tetap seperti semula dan tampil hanya saat kata diketuk; lembar arti kata punya tombol Berikutnya/Sebelumnya (14 Okt 2026) |
| K-26 | Hitungan ayat Al-Fatihah | Alhamdulillah = ayat 1 (hitungan Madinah/Basrah/Syam). Basmalah tampil sebagai pembuka tanpa nomor seperti surah lain; ayat 6 berakhir di "an'amta 'alaihim", ayat 7 "ghairil-maghdubi ... wa lad-dallin". Pengecualian dari K-14 (Mushaf Madinah Hafs memakai hitungan Kufah, basmalah = ayat 1); huruf dan bacaan Hafs tidak berubah. Data lama Al-Fatihah dipindah otomatis: rekaman/tanda basmalah dilepas, ayat 2–6 menjadi 1–5, ayat 7 kata 1–4 → ayat 6, kata 5–9 → ayat 7 (14 Okt 2026) |
| K-27 | Hafalan lama | Bagian yang sudah dihafal sebelum memakai aplikasi ditandai per juz, per surah (layar Semua surah → Tandai hafal), atau per rukuk (layar surah), lalu langsung masuk Ulang hafalan dan dilompati Hafalan baru. Jadwal awal dicicil paling banyak 10 rukuk per malam (bawaan, karena tidak dijawab); mulai di kelompok Lama (jarak 14 hari): murojaah pertama lancar → 30 hari, ada salah → 1 hari. Setiap rukuk punya tombol Murojaah rukuk; rukuk yang belum tercatat ditanya dulu untuk ditandai hafalan lama. Tanda bisa dibatalkan; hafalan dari alur Hafalan baru tidak ikut terhapus (14 Okt 2026) |
| K-28 | Murotal | Menu Murotal memutar rekaman murojaah sendiri per rukuk, surah, juz, atau semua hafalan, ayat demi ayat tanpa pengulangan. Rekaman hanya diputar bila sudah dikoreksi sesudah direkam dan tidak ada kesalahan yang ditandai sesudahnya (kata salah, atau sambungan tertukar saat koreksi); selain itu ayat dicantumkan sebagai Perlu diperbaiki / Belum dikoreksi / Belum direkam dengan tombol perbaikan. Tetap berputar saat layar mati lewat layanan pemutar media Android (@capgo/capacitor-media-session, MPL-2.0) dengan notifikasi kendali. Kecepatan 0,75×/1×/1,25×; teks bisa ditutup (15 Okt 2026) |
| K-29 | Ikon | Ikon baru "Saku Hati": mushaf terbuka menyembul dari saku berjahit dengan hati di tengah; latar teal, saku gading, aksen emas. Sumber aset/ikon.svg dan aset/ikon-depan.svg, PNG dibuat scripts/buat-ikon.py (15 Okt 2026) |
| K-30 | Tandai hafal per ayat | Di layar surah ada mode "Tandai ayat yang sudah hafal": ketuk kotak di atas ayat, atau isi rentang dari–sampai. Rukuk yang hafal sebagian dijadwal berjarak seperti hafalan lama (mulai 14 hari); murojaah dan koreksinya hanya memuat ayat yang hafal walau tidak berurutan (pilihan 1 Firdaus). Begitu Hafalan baru mulai mengisi rukuk itu, rukuk menjadi Berjalan (harian) sampai lengkap. Tanda per ayat bisa dibatalkan; ayat dari Hafalan baru tidak (15 Okt 2026) |

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
| Arti per kata | [Quran.com](https://quran.com), API v4 lama | Ketentuan lisensi tidak tercantum; dipakai pribadi non-komersial dengan atribusi | Belum jelas — repositori sebaiknya privat |

Rincian pengolahan data ada di [data/SUMBER.md](../data/SUMBER.md).

## Status Fase 0 (14 Okt 2026)

- Selesai: `data/juz30.json` dibuat oleh GitHub Actions — 37 surah (78–114), 564 ayat, 2.308 kata, semua kata punya arti, basmalah 37 surah dikenali, catatan lisensi Tanzil disertakan.
- Repositori tetap publik (P-12).
- Sisa gerbang: pencocokan sampel dengan mushaf cetak, dipindah ke gerbang Fase 1 agar dicek langsung di HP.
- Pertanyaan yang belum dijawab memakai usulan bawaan (P-01 s.d. P-11, P-15, P-21, P-22); P-18 pengingat ditunda dan memakai alarm HP. P-19 nama aplikasi masih terbuka.

## Status Fase 1 (14 Okt 2026)

- Nama aplikasi **Saku Hati** (P-19); ID paket tetap `id.dabamona.rabth`.
- Selesai: daftar 37 surah, ayat per kata dari teks Tanzil, ketuk kata untuk arti dan keterangan pribadi, keterangan per ayat, ukuran huruf A−/A+, halaman Tentang berisi atribusi.
- APK dibangun otomatis oleh workflow **Bangun APK** dan diterbitkan di [Releases → terbaru](https://github.com/dausdabamona/Hafalan-quran-/releases/tag/terbaru).
- Kunci tanda tangan: sementara memakai `android/kunci-sementara.jks` yang ada di repositori publik (P-21). Kunci permanen disiapkan sebelum Fase 4; mengganti kunci mengharuskan aplikasi dicopot dan dipasang ulang, jadi dilakukan sebelum ada data hafalan penting.
- Gerbang Fase 1 (menunggu Firdaus): APK terpasang di OPPO A7 Pro, berjalan dalam mode pesawat, dan beberapa ayat dicocokkan dengan mushaf cetak.

## Status Fase 2 (14 Okt 2026)

- Layar surah dibagi per potongan otomatis 1–3 ayat (maksimal 24 kata per potongan berisi lebih dari satu ayat); tiap potongan punya tombol **Rekam** dan **Koreksi**.
- **Rekam** (K-12, K-14, K-16): rekam berurutan per ayat, teks tertutup secara bawaan (bisa dibuka untuk hafalan baru), tombol "Selesai ayat ini" dan "Ulangi ayat"; rekaman baru menimpa rekaman lama ayat yang sama.
- **Koreksi** (F-03, F-06): putar per ayat atau berurutan, ketuk kata yang salah, tandai sambungan tertukar beserta ayat yang terbaca keliru; disimpan sebagai satu sesi (lancar bila tanpa kesalahan baru, P-01).
- Tanda kata salah dan sambungan tertukar tampil permanen di layar surah dengan jumlah dan tanggal terakhir; dihapus hanya lewat tombol "Hapus tanda" (K-13, K-15).
- Perubahan dari usulan arsitektur: rekaman disimpan sebagai Blob di IndexedDB (Dexie), bukan lewat plugin Filesystem — lebih sederhana, tetap di dalam HP, dan ikut cadangan di Fase 4.
- Gerbang Fase 2 (menunggu Firdaus): rekam satu potongan di HP, koreksi, matikan dan nyalakan ulang HP, lalu pastikan rekaman dan tanda masih ada.

## Status Fase 3 (14 Okt 2026)

- Beranda kini layar **Hari ini**: *Hafalan baru* (Sabaq, setelah Subuh) dengan langkah baca makna → centang sima'i → baca → rekam & koreksi; *Ulang hafalan* (Sabqi & Manzil, sebelum tidur) dengan label Dekat/Lama dan keterangan terlambat; *Latihan sambung ayat*; pilihan jalur.
- Istilah tampil dalam bahasa Indonesia dengan istilah Arab kecil di bawahnya (dikunci sebagai K-21).
- Keputusan bawaan yang dipakai (bisa diubah kapan saja):
  - P-01 lancar = tidak ada kesalahan baru pada sesi itu.
  - P-02 setelah 30 hari tetap tiap 30 hari. P-03 kesalahan baru → kembali ke jarak 1 hari.
  - P-04 satu potongan baru per hari; ulang hafalan malam ditampilkan 10 dulu, sisanya lewat "Tampilkan semua".
  - P-05 tanggungan menumpuk, yang paling lama terlambat di atas.
  - P-06 hafalan baru yang belum lancar diulang sampai lancar sebelum menambah yang baru.
  - P-07 sima'i dilakukan di luar aplikasi; aplikasi menyediakan centang "sudah mendengar".
  - P-09 arah jalur urutan: mulai An-Nas (bisa diganti ke mulai An-Naba' di layar Hari ini).
  - P-10 satu jalur aktif.
- Sabqi (Dekat) = jarak 1, 3, 7 hari; Manzil (Lama) = jarak 14 dan 30 hari.
- Mode **Sambung ayat** (F-08): sambungan yang kedua ayatnya sudah lancar; yang pernah tertukar didahulukan, sisanya acak, 10 soal per latihan. Tertukar → tanda permanen bertambah dan potongan kembali ke jarak 1 hari (K-15).
- Catatan perilaku: koreksi potongan dari layar surah juga memasukkannya ke jadwal; mengulang sebelum jatuh tempo tidak mengubah jadwal.
- **Jalur sesuai tema** (P-08, dijawab 14 Okt 2026: Claude menyusun draf, Firdaus mengoreksi): pilihan ketiga di kartu Jalur hafalan. Draf delapan kelompok tema ada di `data/tema-juz30.json` (status "draf"); urutan kelompok dari surah pendek ke panjang. Koreksi cukup dilakukan di berkas itu.
- Uji: simulasi 120 hari otomatis (potongan pertama diulang hari ke-1, 4, 11, 25, 55) dan uji alur 4 hari di peramban.
- Gerbang Fase 3 (menunggu Firdaus): pakai beberapa hari di HP; pastikan daftar Hari ini sesuai harapan.

## Tambahan: deres per rukuk (14 Okt 2026)

- Kartu **Deres per rukuk** di Hari ini (satu rukuk sehari, bergilir) dan layar **daftar rukuk** untuk memilih rukuk lain secara manual.
- Alurnya memakai layar Rekam dan Koreksi yang sama, mencakup seluruh ayat hafal dalam rukuk, dengan teks tertutup.
- Hasil deres tidak membuat entri jadwal baru; hanya menambah tanda dan menurunkan potongan yang bermasalah (K-22).
- Data: `data/rukuk-juz30.json`, dibuat oleh `npm run siapkan-rukuk` dari paket quran-meta. Catatan: tanda rukuk lazim di mushaf Indonesia/IndoPak; mushaf Madinah sendiri tidak mencantumkannya.

## Perluasan 30 juz (14 Okt 2026)

- Data: `data/quran.json` (6.236 ayat, teks Tanzil + arti per kata Quran.com) dan `data/rukuk.json` (556 rukuk, 30 juz). Berkas Juz 30 lama dihapus.
- Hari ini: kartu Hafalan baru (Al-Fatihah → An-Nas, dengan nomor juz), Ulang hafalan per rukuk (label Berjalan/Dekat/Lama), Sambung ayat, Jelajah mushaf. Kartu jalur, tema, dan deres dihapus (K-23, K-24).
- Layar surah: dikelompokkan per rukuk dengan tombol Murojaah rukuk; makna per waqaf bisa disunting (tombol Makna untuk menampilkan/menyembunyikan); lembar arti kata dengan Berikutnya/Sebelumnya, catatan ikut tersimpan saat pindah kata (K-25).
- Jadwal lama per potongan dipindahkan otomatis ke jadwal per rukuk saat aplikasi diperbarui (Dexie versi 5); tabel deres dihapus (versi 6). Tanda salah, tanda tertukar, catatan, dan rekaman tidak berubah.
- `data/tema-juz30.json` dibiarkan untuk dikoreksi nanti; tidak dipakai aplikasi.
- Uji: 21 uji otomatis; uji peramban 3 hari (sabaq → murojaah berjalan → sabaq berikutnya), edit makna, navigasi kata, Al-Baqarah (40 rukuk) terbuka di ayat 255.

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

1. **Fase 0 — Data dan lisensi.** Teks Tanzil + arti per kata Quran.com digabung oleh GitHub Actions menjadi `data/juz30.json` (564 ayat). *Gerbang:* lisensi tercatat, data lengkap.
2. **Fase 1 — Kerangka aplikasi dan APK pertama (F-01).** *Gerbang:* APK berjalan dalam mode pesawat.
3. **Fase 2 — Rekam dan koreksi (F-02, F-03, F-06, F-07).** *Gerbang:* rekaman dan tanda tetap ada setelah HP dinyalakan ulang.
4. **Fase 3 — Jadwal dan mode Sambung ayat (F-04, F-08).** *Gerbang:* simulasi 30 hari menghasilkan jadwal yang benar.
5. **Fase 4 — Cadangan (F-05).** *Gerbang:* uninstall, pasang ulang, semua data pulih dari berkas cadangan.
6. **Fase 5 — Uji pakai 14 hari.** *Gerbang:* daftar perbaikan disetujui.

## Pertanyaan terbuka

Terjawab: P-13 (arti per kata + keterangan pribadi), P-14 (Madinah), P-16 (OPPO A7 Pro), P-17, P-20, P-23, P-24. Masih terbuka:

- [ ] P-01 Definisi "lancar" — usulan: tidak ada kesalahan baru pada sesi itu; tanda lama tetap tersorot.
- [ ] P-02 Setelah jarak 30 hari — usulan: tetap tiap 30 hari.
- [ ] P-03 Ada kesalahan baru — usulan: kembali ke 1 hari; alternatif turun satu tingkat.
- [ ] P-04 Jumlah Sabaq per hari dan batas murojaah malam — usulan: satu potongan baru per pagi.
- [ ] P-05 Hari terlewat — usulan: tanggungan menumpuk, urut dari yang paling terlambat.
- [ ] P-06 Syarat menambah Sabaq — usulan: Sabaq kemarin harus lancar dulu.
- [ ] P-07 Sima'i tanpa audio di aplikasi — tetap dilakukan di luar aplikasi (centang "sudah mendengar") atau dihapus?
- [x] P-08 Penyusun pengelompokan tema Juz 30 — draf disusun Claude, menunggu koreksi Firdaus (`data/tema-juz30.json`).
- [ ] P-09 Arah jalur urutan di dalam Juz 30 (An-Nas → An-Naba' atau sebaliknya).
- [ ] P-10 Satu jalur aktif — usulan: ya, potongan hafal tetap terhitung bila pindah jalur.
- [ ] P-11 Pembagian potongan — usulan: otomatis, bisa diubah manual.
- [x] P-12 Visibilitas repositori — dijawab 14 Okt 2026: tetap publik; data gabungan ikut dikomit (keputusan Firdaus, risiko lisensi Quran.com diterima).
- [ ] P-15 Ukuran huruf — usulan: besar dan bisa diperbesar.
- [x] P-18 Pengingat — ditunda; versi pertama memakai alarm HP (ColorOS agresif mematikan aplikasi latar belakang).
- [x] P-19 Nama aplikasi — dijawab 14 Okt 2026: **Saku Hati** (SAKU = Sedikit Ayat, Kuat Ulangnya). ID paket tetap `id.dabamona.rabth` agar pembaruan bisa menimpa APK lama.
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
