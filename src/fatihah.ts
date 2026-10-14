import { KATA_AYAT_6_FATIHAH } from './data';

// Pemindahan data Al-Fatihah dari hitungan Kufah (basmalah = ayat 1) ke hitungan
// Madinah (Alhamdulillah = ayat 1), K-26. Ayat lama 1 (basmalah) tidak punya
// pasangan; ayat lama 7 terbagi menjadi ayat 6 (kata 1–4) dan ayat 7 (kata 5–9).

export interface LetakKata {
  ayat: number;
  urutan: number; // 0 = seluruh ayat
}

export function petaKataFatihah(ayatLama: number, urutan: number): LetakKata | null {
  if (ayatLama <= 1) return null;
  if (ayatLama < 7) return { ayat: ayatLama - 1, urutan };
  if (urutan === 0) return { ayat: 6, urutan: 0 };
  return urutan <= KATA_AYAT_6_FATIHAH
    ? { ayat: 6, urutan }
    : { ayat: 7, urutan: urutan - KATA_AYAT_6_FATIHAH };
}

// Satu ayat lama → satu ayat baru (untuk rekaman dan sambungan). Ayat lama 7 → ayat 6.
export function petaAyatFatihah(ayatLama: number): number | null {
  return petaKataFatihah(ayatLama, 0)?.ayat ?? null;
}

// Rentang ayat lama → rentang baru. Rentang yang hanya berisi basmalah hilang.
export function petaRentangFatihah(awal: number, akhir: number): { awal: number; akhir: number } | null {
  const akhirBaru = akhir >= 7 ? 7 : akhir - 1;
  if (akhirBaru < 1) return null;
  return { awal: Math.max(1, awal - 1), akhir: akhirBaru };
}
