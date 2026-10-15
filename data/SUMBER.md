# Sumber data dan lisensi

Dicatat 14 Oktober 2026. Berkas `quran.json` dihasilkan oleh workflow **Siapkan data Al-Quran** (`scripts/siapkan-data.mjs`), dan `rukuk.json` oleh `npm run siapkan-rukuk` (`scripts/siapkan-rukuk.mjs`); keduanya bukan diketik tangan.

| Data | Sumber | Lisensi / ketentuan | Status |
| --- | --- | --- | --- |
| Teks Utsmani Mushaf Madinah, 114 surah, 6.236 ayat | [Tanzil](https://tanzil.net) | CC BY 3.0. Boleh dipakai di aplikasi asal sumber disebut dan ditautkan ke tanzil.net; teks tidak boleh diubah; catatan hak cipta Tanzil disertakan di `quran.json` (kolom `sumber.lisensiTanzil`) | Aman, dipakai apa adanya |
| Arti per kata bahasa Indonesia | [Quran.com](https://quran.com), API v4 lama (`api.quran.com/api/v4`) | Ketentuan lisensi tidak tercantum di dokumentasi API. Dipakai untuk keperluan pribadi non-komersial dengan atribusi | Belum jelas; repositori publik atas pilihan pemilik |
| Nama surah | Quran.com API v4 | Sama seperti di atas | Belum jelas |
| Pembagian rukuk (556) dan awal juz (30) | [quran-meta](https://www.npmjs.com/package/quran-meta), riwayat Hafs | MIT | Aman |
| Pemutar latar belakang (kode) | [@capgo/capacitor-media-session](https://github.com/Cap-go/capacitor-media-session) | MPL-2.0 (dipakai tanpa diubah) | Aman |
| Huruf Arab kartu pengingat (Android) | [Amiri Quran 1.003](https://github.com/aliftype/amiri) | SIL Open Font License 1.1 (berkas lisensi disertakan di android/app/src/main/assets/fonts/OFL-Amiri.txt) | Aman |
| Makna per potongan waqaf | Disusun aplikasi dari gabungan arti per kata; dapat disunting pemakai | — | Bukan terjemahan resmi |

## Pengolahan

- Teks Tanzil tidak diubah. Pada ayat pertama tiap surah (kecuali Al-Fatihah dan At-Taubah), Tanzil menyertakan basmalah di awal teks; aplikasi memisahkannya saat tampil dan memasangkan arti mulai kata sesudah basmalah.
- Al-Fatihah ditampilkan dengan hitungan Madinah (K-26): basmalah (ayat 1 Tanzil) menjadi pembuka tanpa nomor, ayat 7 Tanzil dibagi sesudah "أَنْعَمْتَ عَلَيْهِمْ". Huruf Tanzil tidak diubah; hanya batas dan nomor ayat.
- Tanda waqaf, rubu' (۞), dan sajdah (۩) yang berdiri sendiri tidak dihitung sebagai kata. Tanda waqaf (U+06D6–U+06DC) dipakai sebagai batas potongan makna.
- Pada 4 ayat (2:181, 8:6, 13:37, 37:130) Quran.com menggabungkan dua kata yang di Tanzil terpisah (mis. "بَعْدَ مَا"). Arti gabungan itu dipasang pada kedua kata. Rinciannya di `laporan-data.txt`.

## Atribusi di aplikasi

Halaman "Tentang" di aplikasi memuat: Tanzil Project (tautan ke tanzil.net), Quran.com, dan quran-meta.
