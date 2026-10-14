import { cariSurah, daftarJuz, daftarSurah, potonganSurah, rukukAyat } from './data';
import type { Rekaman, Sesi, TandaSalah, TandaTertukar } from './db';
import type { EntriJadwal } from './jadwal';

// K-28 Murotal dari rekaman murojaah sendiri. Sebuah rekaman ayat hanya diputar bila
// sudah dikoreksi sesudah direkam dan koreksinya tidak menemukan kesalahan.

export type StatusRekaman = 'siap' | 'perbaiki' | 'belum-koreksi' | 'belum-rekam';

export interface LetakAyat {
  surah: number;
  ayat: number;
}

export interface BahanStatus {
  rekaman?: Rekaman;
  sesi: Sesi[]; // sesi koreksi/murojaah surah ini
  tandaSalah: TandaSalah[]; // tanda kata pada ayat ini
  tertukar?: TandaTertukar; // sambungan dari ayat sebelumnya ke ayat ini
}

export function statusRekaman(ayat: number, b: BahanStatus): StatusRekaman {
  const r = b.rekaman;
  if (!r) return 'belum-rekam';
  const sesiSesudah = b.sesi.filter(
    (s) => (s.ayat ? s.ayat.includes(ayat) : s.ayatAwal <= ayat && ayat <= s.ayatAkhir) && s.tanggal >= r.direkam,
  );
  if (sesiSesudah.length === 0) return 'belum-koreksi';
  // Kesalahan kata yang ditandai sesudah rekaman ini dibuat.
  if (b.tandaSalah.some((t) => t.terakhir >= r.direkam)) return 'perbaiki';
  // Sambungan tertukar yang ditandai dalam sesi koreksi (bukan latihan sambung ayat).
  const t = b.tertukar;
  if (t && t.terakhir >= r.direkam && b.sesi.some((s) => s.tanggal === t.terakhir)) return 'perbaiki';
  return 'siap';
}

// ---------- Rentang murotal ----------

export type Rentang =
  | { jenis: 'ayat'; surah: number; ayatAwal: number; ayatAkhir: number }
  | { jenis: 'juz'; nomor: number }
  | { jenis: 'hafalan' };

export function daftarAyatRentang(r: Rentang, hafal?: Set<string>): LetakAyat[] {
  if (r.jenis === 'ayat') {
    return Array.from({ length: r.ayatAkhir - r.ayatAwal + 1 }, (_, i) => ({ surah: r.surah, ayat: r.ayatAwal + i }));
  }
  const hasil: LetakAyat[] = [];
  if (r.jenis === 'juz') {
    const awal = daftarJuz[r.nomor - 1];
    const akhir = daftarJuz[r.nomor];
    for (const s of daftarSurah) {
      for (let a = 1; a <= s.jumlahAyat; a++) {
        const sesudahAwal = s.nomor > awal.surah || (s.nomor === awal.surah && a >= awal.ayat);
        const sebelumAkhir = !akhir || s.nomor < akhir.surah || (s.nomor === akhir.surah && a < akhir.ayat);
        if (sesudahAwal && sebelumAkhir) hasil.push({ surah: s.nomor, ayat: a });
      }
    }
    return hasil;
  }
  for (const s of daftarSurah)
    for (let a = 1; a <= s.jumlahAyat; a++) if (hafal?.has(`${s.nomor}:${a}`)) hasil.push({ surah: s.nomor, ayat: a });
  return hasil;
}

export function judulRentang(r: Rentang): string {
  if (r.jenis === 'juz') return `Juz ${r.nomor}`;
  if (r.jenis === 'hafalan') return 'Semua hafalan';
  const nama = cariSurah(r.surah)?.nama ?? String(r.surah);
  const s = cariSurah(r.surah);
  if (s && r.ayatAwal === 1 && r.ayatAkhir === s.jumlahAyat) return nama;
  return r.ayatAwal === r.ayatAkhir ? `${nama} · ayat ${r.ayatAwal}` : `${nama} · ayat ${r.ayatAwal}–${r.ayatAkhir}`;
}

export function hashMurotal(r: Rentang): string {
  if (r.jenis === 'juz') return `#/murotal/juz/${r.nomor}`;
  if (r.jenis === 'hafalan') return '#/murotal/hafalan';
  return `#/murotal/${r.surah}/${r.ayatAwal}-${r.ayatAkhir}`;
}

// Rentang perbaikan untuk satu ayat: lewat murojaah rukuk bila rukuknya sudah
// dijadwalkan (agar tidak tercatat sebagai hafalan baru), selain itu lewat potongannya.
export function tujuanPerbaikan(
  surah: number,
  ayat: number,
  jadwal: Map<number, EntriJadwal>,
): { potongan: { surah: number; ayatAwal: number; ayatAkhir: number }; rukuk?: number } {
  const r = rukukAyat(surah, ayat);
  if (r && jadwal.has(r.nomor)) return { potongan: { surah, ayatAwal: ayat, ayatAkhir: ayat }, rukuk: r.nomor };
  const p = potonganSurah(surah).find((x) => x.ayatAwal <= ayat && ayat <= x.ayatAkhir)!;
  return { potongan: p };
}
