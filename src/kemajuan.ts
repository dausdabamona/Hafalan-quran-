// Perhitungan untuk layar Hari ini dan Kemajuan (K-48, K-49).

import { cariAyat, daftarRukuk, juzAyat, type Rukuk } from './data';
import type { Sesi, TandaSalah, TandaTertukar } from './db';

// Tanggal lokal "YYYY-MM-DD" dari stempel ISO.
export function hariLokal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function geser(hari: string, selisih: number): string {
  const [y, m, d] = hari.split('-').map(Number);
  const t = new Date(y, m - 1, d + selisih);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

// Rentetan hari berturut-turut yang ada latihannya (koreksi/murojaah tersimpan).
// Bila hari ini belum ada latihan, rentetan dihitung sampai kemarin (belum putus).
export function rentetanHari(hariLatihan: Iterable<string>, hari: string): number {
  const ada = new Set(hariLatihan);
  let mulai = ada.has(hari) ? hari : geser(hari, -1);
  let n = 0;
  while (ada.has(mulai)) {
    n++;
    mulai = geser(mulai, -1);
  }
  return n;
}

// ---------- K-49: Kemajuan & peta kesalahan ----------

function ayatSesi(s: Sesi): number[] {
  if (s.ayat?.length) return s.ayat;
  return Array.from({ length: s.ayatAkhir - s.ayatAwal + 1 }, (_, i) => s.ayatAwal + i);
}

// Persentase kata benar dari koreksi/murojaah sejak tanggal tertentu (ISO). null bila belum ada.
export function akurasiKata(sesi: Sesi[], sejak: string): number | null {
  let total = 0;
  let salah = 0;
  for (const s of sesi) {
    if (s.tanggal < sejak) continue;
    for (const a of ayatSesi(s)) total += cariAyat(s.surah, a)?.kata.length ?? 0;
    salah += s.kataSalah;
  }
  if (total === 0) return null;
  return Math.max(0, Math.round(((total - salah) / total) * 100));
}

export type Kekuatan = 'kuat' | 'sedang' | 'lemah' | 'belum';

export interface PetaRukuk {
  rukuk: Rukuk;
  kekuatan: Kekuatan;
  ayatHafal: number;
  salah: number; // tanda kata salah + sambungan tertukar
}

// Rukuk dalam satu juz, menurut ayat awalnya.
export function rukukJuz(juz: number): Rukuk[] {
  return daftarRukuk.filter((r) => juzAyat(r.surah, r.ayatAwal) === juz);
}

// Kekuatan hafalan per rukuk: banyaknya kesalahan dibanding ayat yang sudah hafal.
export function petaJuz(
  juz: number,
  hafal: Set<string>,
  tandaSalah: TandaSalah[],
  tertukar: TandaTertukar[],
): PetaRukuk[] {
  return rukukJuz(juz).map((r) => {
    const di = (s: number, a: number) => s === r.surah && a >= r.ayatAwal && a <= r.ayatAkhir;
    let ayatHafal = 0;
    for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) if (hafal.has(`${r.surah}:${a}`)) ayatHafal++;
    const salah =
      tandaSalah.filter((t) => di(t.surah, t.ayat)).reduce((n, t) => n + t.jumlah, 0) +
      tertukar.filter((t) => di(t.surah, t.ayatAsal)).reduce((n, t) => n + t.jumlah, 0);
    let kekuatan: Kekuatan = 'belum';
    if (ayatHafal > 0) {
      const rasio = salah / ayatHafal;
      kekuatan = rasio < 0.1 ? 'kuat' : rasio < 0.4 ? 'sedang' : 'lemah';
    }
    return { rukuk: r, kekuatan, ayatHafal, salah };
  });
}

export interface KataSalah {
  surah: number;
  ayat: number;
  urutan: number;
  teks: string;
  jumlah: number;
}

// Kata yang paling sering ditandai salah.
export function kataSeringSalah(tanda: TandaSalah[], batas = 5): KataSalah[] {
  return [...tanda]
    .sort((a, b) => b.jumlah - a.jumlah || b.terakhir.localeCompare(a.terakhir))
    .slice(0, batas)
    .map((t) => ({
      surah: t.surah,
      ayat: t.ayat,
      urutan: t.urutan,
      teks: cariAyat(t.surah, t.ayat)?.kata.find((k) => k.urutan === t.urutan)?.teks ?? '',
      jumlah: t.jumlah,
    }));
}
