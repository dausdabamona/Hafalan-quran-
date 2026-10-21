// Target hafalan & batang hari (K-50). Target disimpan di perangkat ini (tabel meta),
// tidak ikut sinkron.
import { cariSurah, daftarSurah, juzAyat, type Potongan } from './data';
import { db, type Sesi } from './db';
import { hariLokal } from './kemajuan';
import { selisihHari, tambahHari } from './jadwal';
import { bacaMeta, tulisMeta } from './sinkron/mesin';

export interface Target {
  jenis: 'juz' | 'surah';
  nomor: number;
  mulai: string; // YYYY-MM-DD
  hari: number; // lama target
}

export function namaTarget(t: Target): string {
  return t.jenis === 'juz' ? `Juz ${t.nomor}` : (cariSurah(t.nomor)?.nama ?? `Surah ${t.nomor}`);
}

export function dalamTarget(t: Target, surah: number, ayat: number): boolean {
  return t.jenis === 'surah' ? surah === t.nomor : juzAyat(surah, ayat) === t.nomor;
}

export function potonganDalamTarget(t: Target): (p: Potongan) => boolean {
  return (p) => dalamTarget(t, p.surah, p.ayatAwal) || dalamTarget(t, p.surah, p.ayatAkhir);
}

export function ayatTarget(t: Target): string[] {
  const hasil: string[] = [];
  for (const s of daftarSurah) {
    if (t.jenis === 'surah' && s.nomor !== t.nomor) continue;
    for (let a = 1; a <= s.jumlahAyat; a++) if (dalamTarget(t, s.nomor, a)) hasil.push(`${s.nomor}:${a}`);
  }
  return hasil;
}

export interface HitungTarget {
  total: number;
  hafal: number;
  hariKe: number; // 1 = hari pertama
  sisaHari: number; // termasuk hari ini
  seharusnya: number; // ayat yang semestinya sudah hafal sampai akhir hari ini
  tertinggal: number; // 0 bila sesuai jadwal atau lebih cepat
  perHari: number; // ayat per hari yang dibutuhkan mulai hari ini
  selesai: boolean;
  lewat: boolean; // tanggal target sudah lewat dan belum selesai
}

export function hitungTarget(t: Target, hafal: Set<string>, hari: string): HitungTarget {
  const ayat = ayatTarget(t);
  const total = ayat.length;
  const sudah = ayat.filter((k) => hafal.has(k)).length;
  const hariKe = Math.max(1, selisihHari(t.mulai, hari) + 1);
  const sisaHari = Math.max(0, t.hari - hariKe + 1);
  const seharusnya = Math.min(total, Math.ceil((total * Math.min(hariKe, t.hari)) / t.hari));
  const selesai = sudah >= total;
  return {
    total,
    hafal: sudah,
    hariKe,
    sisaHari,
    seharusnya,
    tertinggal: Math.max(0, seharusnya - sudah),
    perHari: selesai ? 0 : Math.ceil((total - sudah) / Math.max(1, sisaHari)),
    selesai,
    lewat: !selesai && sisaHari === 0,
  };
}

// ---------- Batang hari ----------

export type WarnaHari = 'hijau' | 'kuning' | 'merah' | 'hari-ini' | 'nanti';

// Warna hari yang sudah lewat dari sesi tersimpan: hafalan baru (sesi potongan) dan
// murojaah (sesi rukuk). Catatan harian yang tersimpan saat itu didahulukan.
export function warnaDariSesi(sesi: Sesi[]): Map<string, 'hijau' | 'kuning'> {
  const baru = new Set<string>();
  const ulang = new Set<string>();
  for (const s of sesi) (s.rukuk ? ulang : baru).add(hariLokal(s.tanggal));
  const hasil = new Map<string, 'hijau' | 'kuning'>();
  for (const h of new Set([...baru, ...ulang])) hasil.set(h, baru.has(h) && ulang.has(h) ? 'hijau' : 'kuning');
  return hasil;
}

export interface BatangHari {
  hari: string;
  warna: WarnaHari;
}

export function susunBatang(
  awal: string,
  jumlah: number,
  hari: string,
  catatan: Record<string, 'hijau' | 'kuning'>,
  dariSesi: Map<string, 'hijau' | 'kuning'>,
  warnaHariIni: WarnaHari,
): BatangHari[] {
  return Array.from({ length: jumlah }, (_, i) => {
    const h = tambahHari(awal, i);
    if (h > hari) return { hari: h, warna: 'nanti' as WarnaHari };
    if (h === hari) return { hari: h, warna: warnaHariIni };
    return { hari: h, warna: catatan[h] ?? dariSesi.get(h) ?? 'merah' };
  });
}

// Warna hari ini: hijau bila hafalan baru selesai dan tidak ada ulang tersisa.
export function warnaHariIni(baruSelesai: boolean, ulangSisa: number, ulangSelesai: number): WarnaHari {
  if (baruSelesai && ulangSisa === 0) return 'hijau';
  if (baruSelesai || ulangSelesai > 0) return 'kuning';
  return 'hari-ini';
}

// ---------- Penyimpanan ----------

export const ambilTarget = () => bacaMeta<Target>(db, 'target');
export const simpanTarget = (t: Target | null) => tulisMeta(db, 'target', t);
export const ambilCatatanHari = async () =>
  (await bacaMeta<Record<string, 'hijau' | 'kuning'>>(db, 'catatanHari')) ?? {};
export async function catatHari(hari: string, warna: 'hijau' | 'kuning') {
  const c = await ambilCatatanHari();
  if (c[hari] === warna || c[hari] === 'hijau') return;
  c[hari] = warna;
  await tulisMeta(db, 'catatanHari', c);
}
