import dataRukuk from '../data/rukuk-juz30.json';
import type { Potongan } from './data';
import type { EntriJadwal } from './jadwal';

// Penderesan per rukuk (K-22): tambahan satu rukuk per hari, bergilir dari
// rukuk yang paling lama tidak dideres; rukuk yang belum lengkap dihafal
// dideres pada bagian yang sudah hafal.

export interface Rukuk {
  nomor: number; // nomor rukuk se-Al-Qur'an (518–556 untuk Juz 30)
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
}

export interface CatatanDeres {
  nomor: number; // nomor rukuk
  terakhir: string; // YYYY-MM-DD
  jumlah: number;
}

export const daftarRukuk: Rukuk[] = (dataRukuk as { rukuk: Rukuk[] }).rukuk;

export function cariRukuk(nomor: number): Rukuk | undefined {
  return daftarRukuk.find((r) => r.nomor === nomor);
}

// Urutan ke-n rukuk dalam surahnya (untuk label "rukuk 2").
export function urutanDalamSurah(r: Rukuk): number {
  return daftarRukuk.filter((x) => x.surah === r.surah && x.ayatAwal <= r.ayatAwal).length;
}

export function jumlahRukukSurah(surah: number): number {
  return daftarRukuk.filter((x) => x.surah === surah).length;
}

// Ayat yang sudah lancar dihafal (potongan dengan hafalan baru yang sudah lancar).
export function ayatHafal(jadwal: Map<string, EntriJadwal>): Set<string> {
  const hafal = new Set<string>();
  for (const e of jadwal.values()) {
    if (!e.sabaqLancar) continue;
    for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) hafal.add(`${e.surah}:${a}`);
  }
  return hafal;
}

// Rentang yang dideres: deretan ayat hafal berurutan pertama di dalam rukuk.
export function rentangDeres(r: Rukuk, hafal: Set<string>): Potongan | null {
  let awal = 0;
  let akhir = 0;
  for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) {
    if (hafal.has(`${r.surah}:${a}`)) {
      if (!awal) awal = a;
      akhir = a;
    } else if (awal) {
      break;
    }
  }
  return awal ? { surah: r.surah, ayatAwal: awal, ayatAkhir: akhir } : null;
}

export function lengkap(r: Rukuk, rentang: Potongan | null): boolean {
  return !!rentang && rentang.ayatAwal === r.ayatAwal && rentang.ayatAkhir === r.ayatAkhir;
}

export type DeresHariIni =
  | { status: 'deres'; rukuk: Rukuk; rentang: Potongan }
  | { status: 'selesai'; rukuk: Rukuk }
  | { status: 'belum-ada' };

// Satu rukuk per hari. Bila sudah dideres hari ini, tampil selesai.
// Bila belum: rukuk yang punya ayat hafal dan paling lama tidak dideres
// (yang belum pernah dideres lebih dulu, lalu urutan mushaf).
export function pilihDeresHariIni(
  jadwal: Map<string, EntriJadwal>,
  catatan: Map<number, CatatanDeres>,
  hari: string,
): DeresHariIni {
  const hariIniSelesai = [...catatan.values()].find((c) => c.terakhir === hari);
  if (hariIniSelesai) {
    const r = cariRukuk(hariIniSelesai.nomor);
    if (r) return { status: 'selesai', rukuk: r };
  }
  const hafal = ayatHafal(jadwal);
  const calon = daftarRukuk
    .map((r) => ({ r, rentang: rentangDeres(r, hafal), terakhir: catatan.get(r.nomor)?.terakhir ?? '' }))
    .filter((x) => x.rentang && x.rentang.ayatAkhir > x.rentang.ayatAwal) // minimal dua ayat
    .sort((x, y) => (x.terakhir === y.terakhir ? x.r.nomor - y.r.nomor : x.terakhir < y.terakhir ? -1 : 1));
  const pilih = calon[0];
  return pilih ? { status: 'deres', rukuk: pilih.r, rentang: pilih.rentang! } : { status: 'belum-ada' };
}
