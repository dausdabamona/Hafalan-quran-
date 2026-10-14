import { daftarSurah, potonganSurah, rukukAyat, cariRukuk, type Potongan, type Rukuk } from './data';

// Logika hafalan & jadwal murni (tanpa database) agar bisa diuji dengan simulasi hari.
//
//  K-04  hafalan baru per potongan 1–3 ayat (tidak melintasi batas rukuk)
//  K-23  murojaah per rukuk: rukuk masuk jadwal sejak ayat pertamanya lancar
//        - rukuk "berjalan" (belum lengkap dihafal): diulang setiap hari
//        - rukuk lengkap: jarak 1–3–7–14–30 hari (K-06)
//  K-24  jalur hafalan Al-Fatihah → An-Nas
//  P-01  lancar = tidak ada kesalahan baru pada sesi itu
//  P-02  setelah 30 hari tetap tiap 30 hari;  P-03 kesalahan baru → jarak 1 hari
//  P-04  satu potongan hafalan baru per hari;  P-05 tanggungan menumpuk, yang paling lama di atas
//  P-06  hafalan baru harus lancar dulu sebelum menambah yang baru

export const JARAK_HARI = [1, 3, 7, 14, 30];
export const BATAS_ULANG_MALAM = 10;

// Satu potongan yang pernah dihafal sebagai hafalan baru.
export interface EntriHafalan {
  kunci: string; // "surah:awal-akhir"
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  mulai: string; // hari pertama dihafal (YYYY-MM-DD)
  terakhir: string;
  sabaqLancar: boolean;
}

// Jadwal murojaah satu rukuk.
export interface EntriJadwal {
  nomor: number; // nomor rukuk
  lengkap: boolean; // seluruh ayat rukuk sudah lancar dihafal
  tingkat: number; // indeks JARAK_HARI (hanya berarti bila lengkap)
  jatuhTempo: string;
  mulai: string;
  terakhir: string;
}

// ---------- Tanggal lokal ----------

export function hariIni(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const h = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${h}`;
}

export function tambahHari(hari: string, n: number): string {
  const [y, m, d] = hari.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function selisihHari(dari: string, ke: string): number {
  return Math.round((Date.parse(ke + 'T00:00:00Z') - Date.parse(dari + 'T00:00:00Z')) / 86_400_000);
}

// ---------- Potongan, jalur, ayat hafal ----------

export function kunciPotongan(p: Potongan): string {
  return `${p.surah}:${p.ayatAwal}-${p.ayatAkhir}`;
}

let jalurCache: Potongan[] | null = null;
// K-24: urutan mushaf Al-Fatihah → An-Nas.
export function jalurHafalan(): Potongan[] {
  if (!jalurCache) jalurCache = daftarSurah.flatMap((s) => potonganSurah(s.nomor));
  return jalurCache;
}

// Ayat yang sudah lancar dihafal ("surah:ayat").
export function ayatHafal(hafalan: Map<string, EntriHafalan>): Set<string> {
  const hasil = new Set<string>();
  for (const e of hafalan.values()) {
    if (!e.sabaqLancar) continue;
    for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) hasil.add(`${e.surah}:${a}`);
  }
  return hasil;
}

function ayatTercatat(hafalan: Map<string, EntriHafalan>): Set<string> {
  const hasil = new Set<string>();
  for (const e of hafalan.values()) for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) hasil.add(`${e.surah}:${a}`);
  return hasil;
}

// Deretan ayat hafal berurutan pertama di dalam rukuk (bahan murojaah rukuk).
export function rentangHafal(r: Rukuk, hafal: Set<string>): Potongan | null {
  let awal = 0;
  let akhir = 0;
  for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) {
    if (hafal.has(`${r.surah}:${a}`)) {
      if (!awal) awal = a;
      akhir = a;
    } else if (awal) break;
  }
  return awal ? { surah: r.surah, ayatAwal: awal, ayatAkhir: akhir } : null;
}

function rukukLengkap(r: Rukuk, hafal: Set<string>): boolean {
  for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) if (!hafal.has(`${r.surah}:${a}`)) return false;
  return true;
}

// ---------- Hafalan baru ----------

export type HafalanBaru =
  | { status: 'baru'; potongan: Potongan }
  | { status: 'ulang'; potongan: Potongan } // kemarin belum lancar (P-06)
  | { status: 'selesai'; potongan: Potongan } // sudah dikerjakan hari ini (P-04)
  | { status: 'tamat' };

export function pilihHafalanBaru(hafalan: Map<string, EntriHafalan>, hari: string): HafalanBaru {
  let terakhir: EntriHafalan | undefined;
  for (const e of hafalan.values()) {
    if (!terakhir || e.mulai > terakhir.mulai || (e.mulai === terakhir.mulai && e.terakhir > terakhir.terakhir))
      terakhir = e;
  }
  if (terakhir && !terakhir.sabaqLancar) return { status: 'ulang', potongan: terakhir };
  if (terakhir && terakhir.mulai === hari) return { status: 'selesai', potongan: terakhir };
  const tercatat = ayatTercatat(hafalan);
  const berikut = jalurHafalan().find((p) => {
    for (let a = p.ayatAwal; a <= p.ayatAkhir; a++) if (!tercatat.has(`${p.surah}:${a}`)) return true;
    return false;
  });
  return berikut ? { status: 'baru', potongan: berikut } : { status: 'tamat' };
}

// ---------- Perubahan setelah sesi ----------

export function turunkanJadwal(j: EntriJadwal, hari: string): EntriJadwal {
  return { ...j, tingkat: 0, jatuhTempo: tambahHari(hari, JARAK_HARI[0]), terakhir: hari };
}

export interface Perubahan {
  hafalan?: EntriHafalan;
  jadwal: EntriJadwal[];
}

// Sesudah koreksi satu potongan (hafalan baru atau ulang potongan dari layar surah).
export function setelahKoreksiPotongan(
  hafalan: Map<string, EntriHafalan>,
  jadwal: Map<number, EntriJadwal>,
  p: Potongan,
  lancar: boolean,
  hari: string,
): Perubahan {
  const kunci = kunciPotongan(p);
  const lama = hafalan.get(kunci);
  const hasil: Perubahan = { jadwal: [] };
  const r = rukukAyat(p.surah, p.ayatAwal)!;
  const j = jadwal.get(r.nomor);

  if (lama?.sabaqLancar) {
    // Potongan yang sudah hafal diulang: kesalahan menurunkan jadwal rukuknya.
    hasil.hafalan = { ...lama, terakhir: hari };
    if (!lancar && j) hasil.jadwal.push(turunkanJadwal(j, hari));
    return hasil;
  }

  hasil.hafalan = lama
    ? { ...lama, terakhir: hari, sabaqLancar: lancar }
    : { kunci, ...p, mulai: hari, terakhir: hari, sabaqLancar: lancar };
  if (!lancar) return hasil;

  const peta = new Map(hafalan);
  peta.set(kunci, hasil.hafalan);
  const lengkap = rukukLengkap(r, ayatHafal(peta));
  if (!j) {
    hasil.jadwal.push({
      nomor: r.nomor,
      lengkap,
      tingkat: 0,
      jatuhTempo: tambahHari(hari, JARAK_HARI[0]),
      mulai: hari,
      terakhir: hari,
    });
  } else if (!j.lengkap && lengkap) {
    hasil.jadwal.push({ ...j, lengkap: true, tingkat: 0, jatuhTempo: tambahHari(hari, JARAK_HARI[0]) });
  }
  return hasil;
}

// Sesudah murojaah satu rukuk. Null bila jadwal tidak berubah.
export function setelahMurojaahRukuk(j: EntriJadwal, lancar: boolean, hari: string): EntriJadwal | null {
  if (!j.lengkap) return { ...j, terakhir: hari, jatuhTempo: tambahHari(hari, 1) };
  if (!lancar) return turunkanJadwal(j, hari);
  if (j.jatuhTempo > hari) return null;
  const tingkat = Math.min(j.tingkat + 1, JARAK_HARI.length - 1);
  return { ...j, tingkat, jatuhTempo: tambahHari(hari, JARAK_HARI[tingkat]), terakhir: hari };
}

// ---------- Daftar hari ini ----------

export type Kelompok = 'berjalan' | 'dekat' | 'lama';

// Berjalan: rukuk belum lengkap. Dekat (Sabqi): jarak 1, 3, 7. Lama (Manzil): 14, 30.
export function kelompok(j: EntriJadwal): Kelompok {
  if (!j.lengkap) return 'berjalan';
  return JARAK_HARI[j.tingkat] >= 14 ? 'lama' : 'dekat';
}

export function daftarUlangHafalan(jadwal: Map<number, EntriJadwal>, hari: string): EntriJadwal[] {
  return [...jadwal.values()]
    .filter((j) => j.jatuhTempo <= hari)
    .sort((a, b) => (a.jatuhTempo === b.jatuhTempo ? a.nomor - b.nomor : a.jatuhTempo < b.jatuhTempo ? -1 : 1));
}

export function selesaiHariIni(jadwal: Map<number, EntriJadwal>, hari: string): EntriJadwal[] {
  return [...jadwal.values()].filter((j) => j.terakhir === hari && j.mulai !== hari && j.jatuhTempo > hari);
}

// Rentang ayat yang diulang untuk satu entri jadwal.
export function rentangMurojaah(j: EntriJadwal, hafalan: Map<string, EntriHafalan>): Potongan | null {
  const r = cariRukuk(j.nomor);
  return r ? rentangHafal(r, ayatHafal(hafalan)) : null;
}

// ---------- Migrasi dari jadwal per potongan (versi ≤ 0.1.7) ----------

export interface JadwalPotonganLama {
  kunci: string;
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  tingkat: number;
  jatuhTempo: string;
  mulai: string;
  terakhir: string;
  sabaqLancar: boolean;
}

export function migrasiJadwalLama(lama: JadwalPotonganLama[]): { hafalan: EntriHafalan[]; jadwal: EntriJadwal[] } {
  const hafalan: EntriHafalan[] = lama.map((e) => ({
    kunci: e.kunci,
    surah: e.surah,
    ayatAwal: e.ayatAwal,
    ayatAkhir: e.ayatAkhir,
    mulai: e.mulai,
    terakhir: e.terakhir,
    sabaqLancar: e.sabaqLancar,
  }));
  const hafal = ayatHafal(new Map(hafalan.map((h) => [h.kunci, h])));
  const perRukuk = new Map<number, JadwalPotonganLama[]>();
  for (const e of lama) {
    if (!e.sabaqLancar) continue;
    const r = rukukAyat(e.surah, e.ayatAwal);
    if (!r) continue;
    perRukuk.set(r.nomor, [...(perRukuk.get(r.nomor) ?? []), e]);
  }
  const jadwal: EntriJadwal[] = [];
  for (const [nomor, daftar] of perRukuk) {
    const r = cariRukuk(nomor)!;
    const lengkap = rukukLengkap(r, hafal);
    jadwal.push({
      nomor,
      lengkap,
      tingkat: lengkap ? Math.min(...daftar.map((e) => e.tingkat)) : 0,
      jatuhTempo: daftar.map((e) => e.jatuhTempo).sort()[0],
      mulai: daftar.map((e) => e.mulai).sort()[0],
      terakhir: daftar.map((e) => e.terakhir).sort().at(-1)!,
    });
  }
  return { hafalan, jadwal };
}
