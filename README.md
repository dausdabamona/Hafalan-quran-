# Saku Hati

*Sedikit Ayat, Kuat Ulangnya*

Aplikasi Android pribadi untuk menghafal Al-Qur'an, 30 juz, dari Al-Fatihah sampai An-Nas. Berjalan penuh tanpa internet; rekaman murojaah dan data hafalan tersimpan di HP.

## Unduh

APK terbaru: [Releases → terbaru](https://github.com/dausdabamona/Hafalan-quran-/releases/tag/terbaru), berkas `saku-hati.apk`. Dibangun otomatis oleh GitHub Actions setiap kali kode berubah.

## Status

Fase 1 — tampilan ayat per kata, arti bahasa Indonesia, dan keterangan pribadi. Keputusan, rencana fase, dan pertanyaan terbuka ada di [docs/keputusan.md](docs/keputusan.md).

## Teknis

- React + Vite + TypeScript, dibungkus Capacitor menjadi APK (minimum Android 7)
- Data hafalan dan keterangan di IndexedDB (Dexie), di dalam HP
- `npm test` — menguji pemetaan 564 ayat; `npm run build` — membangun versi web

## Atribusi data

Teks Al-Qur'an dari [Tanzil Project](https://tanzil.net) (CC BY 3.0), dipakai apa adanya tanpa perubahan. Arti per kata dari [Quran.com](https://quran.com). Rincian di [data/SUMBER.md](data/SUMBER.md).
