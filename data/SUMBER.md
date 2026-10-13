# Sumber data dan lisensi

Dicatat 14 Oktober 2026 (Fase 0). Berkas `juz30.json` dihasilkan oleh workflow **Siapkan data Juz 30** (`scripts/siapkan-data.mjs`), bukan diketik tangan.

| Data | Sumber | Lisensi / ketentuan | Status |
| --- | --- | --- | --- |
| Teks Utsmani Mushaf Madinah | [Tanzil](https://tanzil.net) | CC BY 3.0. Boleh dipakai di aplikasi asal sumber disebut dan ditautkan ke tanzil.net; teks tidak boleh diubah; catatan hak cipta Tanzil disertakan di `juz30.json` (kolom `sumber.lisensiTanzil`) | Aman, dipakai apa adanya |
| Arti per kata bahasa Indonesia | [Quran.com](https://quran.com), API v4 lama (`api.quran.com/api/v4`) | Ketentuan lisensi tidak tercantum di dokumentasi API; API baru Quran Foundation memakai kunci akses. Dipakai untuk keperluan pribadi non-komersial dengan atribusi | Belum jelas — repositori sebaiknya privat |
| Nama surah | Quran.com API v4 | Sama seperti di atas | Belum jelas |

## Pengolahan

- Teks Tanzil tidak diubah. Pada ayat pertama tiap surah, Tanzil menyertakan basmalah di awal teks; skrip hanya menandainya (`basmalah: true`) dan memasangkan arti mulai kata sesudah basmalah. Teks ayat tetap utuh.
- Tanda waqaf, rubu' (۞), dan sajdah (۩) yang berdiri sendiri tidak dihitung sebagai kata.
- Skrip berhenti dengan galat bila jumlah kata satu ayat berbeda antara Tanzil dan Quran.com, atau total ayat Juz 30 bukan 564.

## Atribusi di aplikasi

Halaman "Tentang" di aplikasi wajib memuat: Tanzil Project (tautan ke tanzil.net) dan Quran.com.
