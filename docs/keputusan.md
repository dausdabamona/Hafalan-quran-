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
| K-13 | Tanda kata salah | Permanen: tetap ada walau ayat direkam ulang dan sudah lancar; hanya hilang bila dihapus manual. Menjadi penunjuk bagian rawan salah di masa depan. **Diperbarui K-57 (24 Okt 2026): bisa dihapus dari layar Koreksi, dan terhapus otomatis setelah 3 koreksi berturut-turut benar** |
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
| K-31 | Perbaiki dari murotal | Tombol "⚠ Ada salah di ayat ini" di murotal menjeda pemutaran dan membuka lembar perbaikan: tandai kata salah atau urutan tertukar, simpan, rekam ulang ayat itu, lalu koreksi rekaman baru. Rekaman bersih langsung masuk murotal dan pemutaran berlanjut dari ayat sesudahnya. Kesalahan dihitung seperti murojaah: rukuknya diulang besok dan jaraknya mulai dari awal (dipilih Firdaus: Ya) (15 Okt 2026) |
| K-32 | Pengingat ayat | Cara A: kartu kecil berisi satu ayat yang sudah dihafal beserta maknanya tampil di atas aplikasi saat Facebook, YouTube, Instagram, Chrome, atau TikTok dibuka (bukan WhatsApp). Ayat dipilih acak; yang pernah salah berbobot 3. Jeda minimal 15 menit (bawaan, bisa 30 menit/1 jam), kartu tertutup sendiri setelah 45 detik, tombol Tutup dan Buka di Saku Hati. Butuh izin Tampil di atas aplikasi lain dan Akses penggunaan; berjalan sebagai layanan latar depan, pemantauan berhenti saat layar mati, menyala lagi setelah HP dinyalakan ulang. Huruf Arab kartu memakai Amiri Quran (OFL) (15 Okt 2026) |
| K-33 | Gulir otomatis | Layar mengikuti bagian yang aktif tanpa gulir manual: Rekam (ayat yang sedang direkam di tengah layar), Koreksi ("Putar semua" menyorot dan menggulir ke ayat yang diputar), Murotal (kartu pemutar tampil saat mulai, daftar putar mengikuti ayat), Sambung ayat (jawaban yang dibuka), dan layar surah (posisi dipulihkan saat kembali dari Rekam/Koreksi/Murotal) (16 Okt 2026) |
| K-34 | Satu suara & putar berlanjut | Hanya satu rekaman berbunyi dalam satu waktu: memutar rekaman mana pun menjeda murotal dan rekaman lain. Di layar surah, tombol "▶ Putar dari sini" memutar rekaman ayat yang diketuk lalu berlanjut ke ayat-ayat sesudahnya (yang siap menurut K-28), dengan sorotan dan gulir otomatis (16 Okt 2026) |
| K-35 | Tampilan saat murotal | Kartu pemutar punya pilihan tampilan: Ayat (teks Arab), Arti (makna per potongan waqaf, termasuk makna yang disunting), atau Tertutup (pilihan lama tetap dipertahankan). Pilihan diingat (16 Okt 2026) |
| K-36 | Tandai hafal per ayat dari daftar surah | Di Semua surah → Tandai hafal, mengetuk surah tidak lagi menandai seluruh surah; layar surah terbuka langsung dalam mode tandai per ayat (kotak per ayat atau rentang dari–sampai). Daftar menampilkan jumlah ayat hafal per surah. Centang per juz tetap ada untuk menandai satu juz penuh (16 Okt 2026) |
| K-37 | Versi Windows + sinkron Wi-Fi | Versi Windows dibungkus Electron dari kode yang sama, dibangun GitHub Actions sebagai **penginstal biasa** (NSIS, ikon Start Menu & desktop), diterbitkan di rilis terpisah `windows-terbaru`. Sinkron hanya di jaringan Wi-Fi yang sama, tanpa internet. **HP menjadi pusat sinkron** (pilihan Firdaus): aplikasi Windows menyambung ke HP. Pemasangan lewat **kode QR** yang tampil di HP dan dipindai kamera laptop, dengan alamat + kode 6 angka sebagai cadangan. Sinkron otomatis (saat aplikasi dibuka/ditinggalkan) ditambah tombol Sinkron sekarang. Aturan gabung: rekaman terbaru menang; catatan/makna terakhir diubah menang; tanda dan riwayat sesi digabung, penghapusan ikut tersinkron; jadwal dari murojaah terakhir, kesalahan selalu dipakai. Dikerjakan bertahap: 1) EXE berjalan sendiri, 2) mesin sinkron & pemasangan, 3) uji bersama (19 Okt 2026). Tahap 2: HP menjalankan server HTTP kecil (port 47310) yang meneruskan permintaan ke data aplikasi; laptop menyambung lewat proses utama Windows dan mencari ulang HP di jaringan bila alamatnya berubah. Struktur data versi 8 menambah penanda sinkron (waktu ubah, waktu terima, asal) dan catatan penghapusan; data lama dipindah otomatis |
| K-38 | Tampilan Broadsheet | Seluruh aplikasi mengikuti sistem desain Broadsheet dari prototipe kiriman Firdaus: kertas krem, huruf Source Serif 4, aksen teal, efek pelat cetak C/M/Y untuk angka dan judul besar (tidak untuk teks Arab), kartu diganti bagian bergaris seperti koran, emoji diganti ikon Phosphor duotone. Hari ini disusun seperti halaman depan koran (tanggal Masehi & Hijriah, angka hafalan besar, strip 30 juz, langkah bernomor, tangga jarak 1·3·7·14·30). Fungsi tidak berubah (19 Okt 2026) |
| K-39 | Teks ayat bisa dibuka selama merekam | Sakelar "Tampilkan teks ayat" dipindah ke bilah bawah layar rekam sehingga selalu terlihat dan tidak ikut tergulung; kotak "Teks tertutup" juga bisa diketuk ("Lupa? Ketuk untuk melihat ayat") tanpa menghentikan rekaman. Hitungan detik besar diganti titik merah kecil berkedip di samping nomor ayat (20 Okt 2026) |
| K-40 | Nuansa hijau | Warna aksen Broadsheet diganti dari teal-biru ke hijau (#1E8A4C, gelap #146B38), kertas latar diberi sedikit rona hijau (#F2F5F0), termasuk warna bilah atas HP dan kartu pengingat ayat. Efek pelat cetak dan titik rekam tetap (20 Okt 2026) |
| K-41 | Latihan tebak ayat dari arti | Metode latihan baru: arti satu ayat ditampilkan (makna per potongan waqaf, memakai makna yang sudah Anda sunting bila ada) bersama nama surah; Anda menebak ayatnya dan membacanya sambil direkam, lalu teks ayat dibuka dan rekaman bisa diputar untuk dinilai sendiri: **Benar** atau **Salah**. Soal diambil acak dari ayat yang **sudah dihafal**, 10 soal per latihan; ayat yang pernah salah ditebak didahulukan sampai berhasil ditebak benar. Tebakan salah hanya menjadi **tanda latihan**: jadwal murojaah tidak berubah. Rekaman tebakan **tidak disimpan** (hanya untuk didengar saat memeriksa); rekaman murojaah dan murotal tidak tersentuh. Tanda latihan ikut sinkron HP ↔ laptop (20 Okt 2026) |
| K-42 | Shortcut murotal di layar utama HP | Ikon **Murotal** tersendiri di layar utama HP yang sekali ketuk langsung memutar murotal **semua hafalan** (rekaman yang sudah dikoreksi bersih), tanpa melewati layar Hari ini. Tersedia dua cara: tekan lama ikon Saku Hati → "Putar murotal" (bisa diseret ke layar utama), dan tombol "Pasang ikon Murotal di layar utama" di layar Murotal. Bila tidak ada rekaman yang siap, layar Murotal terbuka dengan keterangannya (20 Okt 2026) |
| K-43 | Tampilan layar lebar (Windows) | Pada jendela selebar 960px ke atas (versi Windows, tablet) tampil **menu samping** tetap di kiri (Hari ini, Jelajah mushaf, Rukuk, Murotal, Sambung ayat, Tebak dari arti, Sinkron, Tentang) dengan area isi yang lebih lebar (880–960px). Hari ini menjadi halaman koran dua kolom (Hafalan baru di kiri, Ulang hafalan di kanan, menu tiga kolom). Bilah tombol bawah dan pemutar murotal mengikuti lebar area isi; lembar makna/keterangan menjadi dialog di tengah. **Spasi** menekan tombol utama bilah bawah. Di bawah 960px (HP) tampilan tidak berubah (20 Okt 2026) |
| K-44 | Pengingat ayat juga di atas Claude | Aplikasi Claude (com.anthropic.claude) ditambahkan ke daftar aplikasi pemicu kartu ayat (K-32), dengan jeda minimal yang sama. Pada pengaturan yang sudah tersimpan, Claude dicentang sekali secara otomatis; sesudahnya bisa dimatikan di layar Pengingat ayat (21 Okt 2026) |
| K-45 | Mundur ke ayat yang salah saat merekam | Selama merekam murojaah/hafalan, bila sadar ada ayat yang salah, bisa mundur lewat tombol **Mundur** (satu ayat sebelumnya) atau dengan **mengetuk ayat yang sudah tersimpan**. Rekaman ayat yang sedang berjalan dibuang, lalu perekaman **berlanjut berurutan** dari ayat yang salah sampai akhir; rekaman ayat sesudahnya ikut diganti saat dibaca ulang (21 Okt 2026) |
| K-46 | Bilah rekam berupa ikon | Tombol di bilah bawah layar rekam diganti ikon bulat seperti alat perekam, masing-masing dengan keterangan pendek: Teks (tampilkan/tutup teks ayat), Mundur, tombol utama besar di tengah (Rekam → Selesai ayat → Selesai & koreksi), dan Ulangi. Ikon yang belum bisa dipakai tampil pudar. Fungsi tidak berubah (21 Okt 2026) |
| K-47 | Menu Hari ini berupa ikon | Bagian "Juga di Saku Hati" di Hari ini diganti deretan ikon dengan label pendek (Sambung ayat, Tebak arti, Murotal, Pengingat, Sinkron, Mushaf, Rukuk hafal), empat per baris di HP dan satu baris di laptop; penjelasan panjang tampil saat ikon disorot. Tombol utama "Rekam & koreksi" tetap bertulisan agar jelas (21 Okt 2026) |
| K-48 | Tampilan Kartu Modern (pilihan A) | Mengganti gaya koran Broadsheet (K-38) di HP: latar terang hijau keabuan, kepala Hari ini hijau tua berisi salam, tanggal Masehi & Hijriah, cincin persentase hafalan, jumlah ayat hafal dan rentetan hari; isi berupa kartu putih bersudut bulat; huruf Plus Jakarta Sans (tersimpan di aplikasi, tanpa internet); efek pelat cetak dihapus. Menu tab di bawah layar utama HP: Hari ini, Mushaf, Kemajuan, Murotal, Lainnya. Tema terang (pilihan Firdaus). Di layar lebar tetap menu samping (K-43). Tahap 1 (21 Okt 2026) |
| K-49 | Kemajuan & peta kesalahan (pilihan E) | Layar Kemajuan: jumlah ayat hafal, persentase kata benar 30 hari terakhir (dari hasil koreksi), rentetan hari; peta surah per juz berwarna kuat/sedang/lemah/belum hafal menurut tanda kata salah dan sambungan tertukar; daftar kata yang paling sering salah dengan tombol latihan yang membuka ayatnya. Tahap 2 (21 Okt 2026) |
| K-50 | Target & batang hari (pilihan C) | Target hafalan = rentang (juz/surah) + lama hari, misal Juz 29 dalam 60 hari; Saku Hati menghitung ayat baru yang perlu per hari dan memberi tahu bila tertinggal (menawarkan potongan tambahan). **Satu batang = satu hari**: hijau bila hafalan baru dan ulang hari itu selesai, kuning bila sebagian, merah bila terlewat. Ditambah daftar sesi hari ini dan kartu "Perlu perhatian". Tahap 3 (21 Okt 2026) |
| K-51 | Mode kata demi kata (pilihan D) | Ikon baru "Kata" di bilah rekam, **mati bawaan**. Bila dinyalakan, kata ayat yang sedang direkam tampil sebagai kotak; ikon Intip membuka satu kata berikutnya; kata yang pernah salah ditandai garis merah. Tanpa pengenalan suara (aplikasi tetap tanpa internet). **Dilewati atas permintaan Firdaus (21 Okt 2026); belum dibuat.** |
| K-52 | Arti ayat saat murojaah | Saat murojaah rukuk dengan teks tertutup, kotak ayat yang sedang dibaca menampilkan **artinya** (makna per potongan waqaf, memakai makna yang sudah disunting bila ada). Bila ragu, ketuk kotak itu untuk membuka teks ayat tersebut saja; pindah ke ayat lain (maju atau mundur) kembali menampilkan arti. Ikon Teks tetap membuka semua teks. Hafalan baru tidak berubah (21 Okt 2026) |
| K-53 | Berhenti di tengah murojaah | Ikon **Berhenti** di bilah rekam murojaah rukuk: ayat yang sedang dibaca disimpan, lalu koreksi hanya untuk ayat yang sudah dibaca. Pengaruh ke jadwal (pilihan Firdaus): kesalahan tetap dicatat dan menurunkan jadwal rukuk; bila lancar, rukuk **tetap jatuh tempo** dan muncul di Ulang hafalan sampai dibaca utuh (21 Okt 2026) |
| K-54 | Tata letak laptop untuk Kartu Modern | Di layar ≥960px: area isi melebar sampai 1080–1240px; kepala hijau menaruh angka hafalan di kiri dan strip 30 juz (lebih tinggi) di kanan; Hari ini memakai area grid — kartu target/14 hari selebar penuh, Hafalan baru di kolom kiri yang lebar (ukuran Arab sedikit diperkecil), Ulang hafalan dan Perlu perhatian di kolom kanan; menu ikon Hari ini disembunyikan karena sudah ada menu samping. Tampilan HP tidak berubah (22 Okt 2026) |
| K-55 | Kata yang pernah salah saat murojaah (pilihan H) | Saat murojaah, kotak arti tetap tampilan utama. Bila ayat itu punya tanda kata salah, di atas arti tampil ayat sebagai deretan kotak kosong dan **hanya kata yang pernah salah yang terlihat** (merah, dengan jumlah salahnya); kata lain tetap tertutup. Bila teks ayat dibuka (Ragu? atau ikon Teks), kata yang pernah salah bergaris bawah merah. Tanda tetap sampai dihapus manual (K-13) (23 Okt 2026) |
| K-56 | Terbit di Google Play | Pilihan Firdaus: terbit **untuk umum**; **Pengingat ayat tidak ikut di versi Play** (izin overlay, akses penggunaan, dan layanan latar khusus berisiko ditolak) — APK GitHub tetap lengkap; nama paket diganti **id.dabamona.sakuhati** (permanen di Play) untuk APK GitHub dan Play; akun Play Console belum ada (akun pribadi baru → uji tertutup 12 penguji × 14 hari sebelum produksi). Rencana: Tahap 1 teknis (cadangan ekspor/impor untuk pindah data, nama paket baru, kunci unggah permanen sebagai secret GitHub = menutup P-21, varian Play tanpa Pengingat, pembangunan AAB); Tahap 2 lisensi & kebijakan (arti per kata dari sumber berlisensi jelas — kandidat QUL/QuranWBW, kebijakan privasi, jawaban Data Safety, atribusi di Tentang); Tahap 3 aset toko & panduan Play Console (23 Okt 2026) |
| K-57 | Menghapus tanda kata yang sudah benar | Pilihan Firdaus A + B. (A) Di layar Koreksi, di bawah ayat yang punya tanda kata lama, tampil tombol per kata "Sekarang sudah benar"; yang dipilih dihapus saat koreksi disimpan. (B) Setiap koreksi yang mencakup kata bertanda dan kata itu tidak ditandai salah menambah hitungan benar berturut-turut; setelah **3 koreksi berturut-turut benar** tandanya terhapus otomatis; salah lagi mengembalikan hitungan ke 0. Penghapusan ikut tersinkron (24 Okt 2026) |

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
- [x] P-19 Nama aplikasi — dijawab 14 Okt 2026: **Saku Hati** (SAKU = Sedikit Ayat, Kuat Ulangnya; HATI = Hafalkan Arti, Tekun Ingat — dilengkapi 19 Okt 2026). ID paket tetap `id.dabamona.rabth` agar pembaruan bisa menimpa APK lama.
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
