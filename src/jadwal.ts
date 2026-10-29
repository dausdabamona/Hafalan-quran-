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
//  K-27  hafalan lama (sudah hafal sebelum memakai aplikasi) langsung masuk murojaah;
//        jadwal awalnya dicicil paling banyak BATAS_ULANG_MALAM rukuk per malam
//  K-30  hafalan lama boleh ditandai per ayat; rukuk yang hafal sebagian dimurojaah
//        berjarak pada ayat yang hafal saja, sampai Hafalan baru mulai mengisinya
//  K-88  potongan hafalan baru mantap setelah lancar pada SYARAT_MANTAP hari berbeda;
//        potongan baru terbuka bila semua pemantapan hari itu sudah lancar

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
  lama?: boolean; // K-27: ditandai sebagai hafalan lama, bukan hasil hafalan baru
  // K-88: jumlah hari berbeda potongan ini lancar. Tidak ada = tercatat sebelum K-88, dianggap mantap.
  mantap?: number;
  hariLancar?: string; // hari lancar terakhir yang sudah dihitung
  goyah?: boolean; // pemantapan terakhir masih ada salah hafalan
}

// Jadwal murojaah satu rukuk.
export interface EntriJadwal {
  nomor: number; // nomor rukuk
  lengkap: boolean; // seluruh ayat rukuk sudah lancar dihafal
  sebagian?: boolean; // K-30: hafal sebagian karena ditandai hafalan lama; dijadwal berjarak
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
  | { status: 'mantapkan'; potongan: Potongan } // K-88: menunggu pemantapan hari ini lancar
  | { status: 'tamat' };

// Potongan berikutnya yang belum tercatat; potongan dalam target (K-50) didahulukan.
export function potonganBerikut(
  hafalan: Map<string, EntriHafalan>,
  utamakan?: (p: Potongan) => boolean,
): Potongan | undefined {
  const tercatat = ayatTercatat(hafalan);
  const belum = (p: Potongan) => {
    for (let a = p.ayatAwal; a <= p.ayatAkhir; a++) if (!tercatat.has(`${p.surah}:${a}`)) return true;
    return false;
  };
  return (utamakan && jalurHafalan().find((p) => utamakan(p) && belum(p))) || jalurHafalan().find(belum);
}

export function pilihHafalanBaru(
  hafalan: Map<string, EntriHafalan>,
  hari: string,
  utamakan?: (p: Potongan) => boolean,
  syarat = SYARAT_MANTAP,
): HafalanBaru {
  let terakhir: EntriHafalan | undefined;
  for (const e of hafalan.values()) {
    if (e.lama) continue;
    // Hari mulai yang sama: potongan yang belum lancar didahulukan agar tidak terlewat (K-88).
    const lebih =
      !terakhir ||
      e.mulai > terakhir.mulai ||
      (e.mulai === terakhir.mulai &&
        (e.sabaqLancar === terakhir.sabaqLancar ? e.terakhir > terakhir.terakhir : !e.sabaqLancar));
    if (lebih) terakhir = e;
  }
  if (terakhir && !terakhir.sabaqLancar) return { status: 'ulang', potongan: terakhir };
  if (terakhir && terakhir.mulai === hari) return { status: 'selesai', potongan: terakhir };
  const berikut = potonganBerikut(hafalan, utamakan);
  // K-88 (D1): potongan baru terbuka bila semua potongan yang sedang dimantapkan sudah lancar hari ini.
  const tertunda = pemantapanTertunda(hafalan, hari, syarat);
  if (tertunda.length) return { status: 'mantapkan', potongan: berikut ?? tertunda[0].entri };
  return berikut ? { status: 'baru', potongan: berikut } : { status: 'tamat' };
}

// ---------- Pemantapan hafalan baru (K-88) ----------

export const SYARAT_MANTAP = 3;
export const SYARAT_MANTAP_MIN = 1;
export const SYARAT_MANTAP_MAKS = 5;

export function sedangDimantapkan(e: EntriHafalan, syarat = SYARAT_MANTAP): boolean {
  return !e.lama && e.sabaqLancar && e.mantap !== undefined && e.mantap < syarat;
}

export interface Pemantapan {
  entri: EntriHafalan;
  ke: number; // pemantapan ke berapa (hari menghafal = ke-1)
  sudahHariIni: boolean; // sudah lancar hari ini
  goyah: boolean; // pemantapan terakhir masih ada salah hafalan
  tuntas: boolean; // mantap tepat hari ini
}

// Potongan yang sedang dimantapkan, ditambah yang baru mantap hari ini (untuk umpan balik).
// Potongan yang mulai dihafal hari ini tidak dimasukkan: pemantapannya mulai besok.
export function daftarPemantapan(
  hafalan: Map<string, EntriHafalan>,
  hari: string,
  syarat = SYARAT_MANTAP,
): Pemantapan[] {
  const hasil: Pemantapan[] = [];
  for (const e of hafalan.values()) {
    if (e.lama || !e.sabaqLancar || e.mantap === undefined || e.mulai === hari) continue;
    const sudahHariIni = e.hariLancar === hari;
    const berjalan = e.mantap < syarat;
    const tuntas = !berjalan && sudahHariIni;
    if (!berjalan && !tuntas) continue;
    hasil.push({
      entri: e,
      ke: sudahHariIni ? e.mantap : e.mantap + 1,
      sudahHariIni,
      goyah: !!e.goyah,
      tuntas,
    });
  }
  return hasil.sort(
    (a, b) =>
      (a.entri.mulai < b.entri.mulai ? -1 : a.entri.mulai > b.entri.mulai ? 1 : 0) ||
      a.entri.surah - b.entri.surah ||
      a.entri.ayatAwal - b.entri.ayatAwal,
  );
}

// Pemantapan yang belum lancar hari ini (menahan potongan baru).
export function pemantapanTertunda(
  hafalan: Map<string, EntriHafalan>,
  hari: string,
  syarat = SYARAT_MANTAP,
): Pemantapan[] {
  return daftarPemantapan(hafalan, hari, syarat).filter((x) => !x.sudahHariIni);
}

// Perubahan hitungan mantap sesudah potongan yang sudah hafal direkam ulang.
// Salah → hitungan tetap (tidak kembali ke nol); satu hari dihitung paling banyak sekali.
function catatMantap(e: EntriHafalan, lancar: boolean, hari: string): Partial<EntriHafalan> {
  if (e.lama || e.mantap === undefined) return {};
  if (!lancar) return { goyah: true };
  if (e.hariLancar === hari) return { goyah: false };
  return { mantap: e.mantap + 1, hariLancar: hari, goyah: false };
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
    // K-88: sekaligus menjadi pemantapan bila potongan ini belum mantap.
    hasil.hafalan = { ...lama, terakhir: hari, ...catatMantap(lama, lancar, hari) };
    if (!lancar && j) hasil.jadwal.push(turunkanJadwal(j, hari));
    return hasil;
  }

  hasil.hafalan = lama
    ? { ...lama, terakhir: hari, sabaqLancar: lancar }
    : { kunci, ...p, mulai: hari, terakhir: hari, sabaqLancar: lancar };
  // K-88: hari pertama lancar = pemantapan ke-1. Potongan yang seluruh ayatnya sudah hafal lewat
  // entri lain (mis. murojaah hafalan lama dari layar Surah) tidak ikut pemantapan.
  const hafalSebelum = ayatHafal(hafalan);
  let sudahHafalSemua = true;
  for (let a = p.ayatAwal; a <= p.ayatAkhir; a++) if (!hafalSebelum.has(`${p.surah}:${a}`)) sudahHafalSemua = false;
  if (!hasil.hafalan.lama && !sudahHafalSemua)
    Object.assign(hasil.hafalan, lancar ? { mantap: 1, hariLancar: hari, goyah: false } : { mantap: 0 });
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
    hasil.jadwal.push({
      ...j,
      lengkap: true,
      sebagian: false,
      tingkat: 0,
      jatuhTempo: tambahHari(hari, JARAK_HARI[0]),
    });
  } else if (j.sebagian) {
    // Hafalan baru mulai mengisi rukuk yang hafal sebagian: kini diulang harian.
    hasil.jadwal.push({ ...j, sebagian: false, tingkat: 0, jatuhTempo: tambahHari(hari, 1) });
  }
  return hasil;
}

// ---------- Mutu murojaah (K-62) ----------

// Bobot salah (kata salah + sambungan tertukar) di bawah 5% kata yang dibaca = kesalahan kecil.
export const BATAS_KESALAHAN_KECIL = 0.05;
export type MutuMurojaah = 'lancar' | 'kecil' | 'besar';

export function mutuMurojaah(kataSalah: number, tertukar: number, jumlahKata: number): MutuMurojaah {
  const bobot = kataSalah + tertukar;
  if (bobot === 0) return 'lancar';
  if (jumlahKata > 0 && bobot / jumlahKata < BATAS_KESALAHAN_KECIL) return 'kecil';
  return 'besar';
}

// Kesalahan kecil: turun satu anak tangga (paling bawah tetap 1 hari), dihitung dari hari ini.
export function turunSatuTingkat(j: EntriJadwal, hari: string): EntriJadwal {
  const tingkat = Math.max(0, j.tingkat - 1);
  return { ...j, tingkat, jatuhTempo: tambahHari(hari, JARAK_HARI[tingkat]), terakhir: hari };
}

// Sesudah murojaah satu rukuk. Null bila jadwal tidak berubah.
// `hasil` boleh boolean (lancar / tidak) atau mutu K-62; false = kesalahan besar.
export function setelahMurojaahRukuk(j: EntriJadwal, hasil: boolean | MutuMurojaah, hari: string): EntriJadwal | null {
  const mutu: MutuMurojaah = typeof hasil === 'boolean' ? (hasil ? 'lancar' : 'besar') : hasil;
  if (!j.lengkap && !j.sebagian) return { ...j, terakhir: hari, jatuhTempo: tambahHari(hari, 1) };
  if (mutu === 'besar') return turunkanJadwal(j, hari);
  if (mutu === 'kecil') return turunSatuTingkat(j, hari);
  if (j.jatuhTempo > hari) return null;
  const tingkat = Math.min(j.tingkat + 1, JARAK_HARI.length - 1);
  return { ...j, tingkat, jatuhTempo: tambahHari(hari, JARAK_HARI[tingkat]), terakhir: hari };
}

// ---------- Daftar hari ini ----------

export type Kelompok = 'berjalan' | 'dekat' | 'lama';

// Berjalan: rukuk belum lengkap. Dekat (Sabqi): jarak 1, 3, 7. Lama (Manzil): 14, 30.
export function kelompok(j: EntriJadwal): Kelompok {
  if (!j.lengkap && !j.sebagian) return 'berjalan';
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
  if (!r) return null;
  const ayat = ayatHafalRukuk(r, ayatHafal(hafalan));
  return ayat.length ? { surah: r.surah, ayatAwal: ayat[0], ayatAkhir: ayat[ayat.length - 1] } : null;
}

// Ayat hafal di dalam rukuk (boleh tidak berurutan, K-30).
export function ayatHafalRukuk(r: Rukuk, hafal: Set<string>): number[] {
  const hasil: number[] = [];
  for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) if (hafal.has(`${r.surah}:${a}`)) hasil.push(a);
  return hasil;
}

// ---------- Hafalan lama (K-27) ----------

// Tingkat awal hafalan lama: jarak 14 hari (kelompok Lama). Murojaah pertama menjadi uji:
// lancar → naik ke 30 hari, ada salah → kembali ke 1 hari.
export const TINGKAT_AWAL_LAMA = 3;

export function kunciRukukLama(r: Rukuk): string {
  return `${r.surah}:${r.ayatAwal}-${r.ayatAkhir}`;
}

// Rukuk yang dihitung "sudah hafal": seluruh ayatnya lancar.
export function rukukSudahHafal(nomor: number, hafal: Set<string>): boolean {
  const r = cariRukuk(nomor);
  return !!r && rukukLengkap(r, hafal);
}

// Menandai rukuk sebagai hafalan lama. Jatuh tempo pertama dicicil mulai hari ini,
// paling banyak `batas` rukuk per hari (termasuk jadwal yang sudah ada).
export function tandaiLama(
  nomor: number[],
  hafalan: Map<string, EntriHafalan>,
  jadwal: Map<number, EntriJadwal>,
  hari: string,
  batas = BATAS_ULANG_MALAM,
): { hafalan: EntriHafalan[]; jadwal: EntriJadwal[] } {
  const daftar: { surah: number; ayat: number }[] = [];
  for (const n of nomor) {
    const r = cariRukuk(n);
    if (r) for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) daftar.push({ surah: r.surah, ayat: a });
  }
  return tandaiAyatLama(daftar, hafalan, jadwal, hari, batas);
}

// K-30: menandai ayat tertentu sebagai hafalan lama. Ayat berurutan digabung menjadi
// satu entri hafalan. Rukuk yang menjadi lengkap → jadwal Lama; yang hafal sebagian →
// jadwal berjarak "sebagian". Rukuk yang sedang dihafal (berjalan) tetap berjalan.
export function tandaiAyatLama(
  ayat: { surah: number; ayat: number }[],
  hafalan: Map<string, EntriHafalan>,
  jadwal: Map<number, EntriJadwal>,
  hari: string,
  batas = BATAS_ULANG_MALAM,
): { hafalan: EntriHafalan[]; jadwal: EntriJadwal[] } {
  const hafal = ayatHafal(hafalan);
  const baru = [
    ...new Map(ayat.filter((x) => !hafal.has(`${x.surah}:${x.ayat}`)).map((x) => [`${x.surah}:${x.ayat}`, x])).values(),
  ].sort((a, b) => a.surah - b.surah || a.ayat - b.ayat);
  const hasil = { hafalan: [] as EntriHafalan[], jadwal: [] as EntriJadwal[] };
  // Entri hafalan per deretan ayat berurutan di dalam satu rukuk.
  const rukukTersentuh = new Set<number>();
  let deret: { surah: number; awal: number; akhir: number; rukuk: number } | null = null;
  const tutup = () => {
    if (!deret) return;
    hasil.hafalan.push({
      kunci: `${deret.surah}:${deret.awal}-${deret.akhir}`,
      surah: deret.surah,
      ayatAwal: deret.awal,
      ayatAkhir: deret.akhir,
      mulai: hari,
      terakhir: hari,
      sabaqLancar: true,
      lama: true,
    });
  };
  for (const x of baru) {
    const r = rukukAyat(x.surah, x.ayat);
    if (!r) continue;
    rukukTersentuh.add(r.nomor);
    if (deret && deret.surah === x.surah && deret.rukuk === r.nomor && deret.akhir === x.ayat - 1) deret.akhir = x.ayat;
    else {
      tutup();
      deret = { surah: x.surah, awal: x.ayat, akhir: x.ayat, rukuk: r.nomor };
    }
  }
  tutup();

  for (const h of hasil.hafalan) for (let a = h.ayatAwal; a <= h.ayatAkhir; a++) hafal.add(`${h.surah}:${a}`);
  const beban = new Map<string, number>();
  for (const j of jadwal.values()) {
    const h = j.jatuhTempo < hari ? hari : j.jatuhTempo;
    beban.set(h, (beban.get(h) ?? 0) + 1);
  }
  let hariCicil = hari;
  for (const n of [...rukukTersentuh].sort((a, b) => a - b)) {
    const r = cariRukuk(n)!;
    const j = jadwal.get(n);
    const lengkap = rukukLengkap(r, hafal);
    if (j && !j.lengkap && !j.sebagian) {
      // Rukuk yang sedang dihafal tetap diulang harian; bila kini lengkap, masuk jadwal berjarak.
      if (lengkap)
        hasil.jadwal.push({ ...j, lengkap: true, sebagian: false, tingkat: 0, jatuhTempo: tambahHari(hari, 1) });
      continue;
    }
    if (j && j.lengkap) continue;
    let jatuhTempo = j?.jatuhTempo;
    if (!j) {
      while ((beban.get(hariCicil) ?? 0) >= batas) hariCicil = tambahHari(hariCicil, 1);
      beban.set(hariCicil, (beban.get(hariCicil) ?? 0) + 1);
      jatuhTempo = hariCicil;
    }
    hasil.jadwal.push({
      nomor: n,
      lengkap,
      sebagian: !lengkap,
      tingkat: j?.tingkat ?? TINGKAT_AWAL_LAMA,
      jatuhTempo: jatuhTempo!,
      mulai: j?.mulai ?? hari,
      terakhir: j?.terakhir ?? hari,
    });
  }
  return hasil;
}

// Membatalkan tanda hafalan lama satu rukuk. Hafalan dari alur hafalan baru tetap.
export function batalkanLama(
  nomor: number,
  hafalan: Map<string, EntriHafalan>,
  jadwal: Map<number, EntriJadwal>,
  hari: string,
): { hapusHafalan: string[]; jadwal: EntriJadwal | null; hapusJadwal: boolean } {
  const r = cariRukuk(nomor)!;
  const hapusHafalan = [...hafalan.values()]
    .filter((e) => e.lama && e.surah === r.surah && e.ayatAwal >= r.ayatAwal && e.ayatAkhir <= r.ayatAkhir)
    .map((e) => e.kunci);
  const sisa = new Map(hafalan);
  for (const k of hapusHafalan) sisa.delete(k);
  const hafal = ayatHafal(sisa);
  const j = jadwal.get(nomor);
  if (!rentangHafal(r, hafal)) return { hapusHafalan, jadwal: null, hapusJadwal: !!j };
  const lengkap = rukukLengkap(r, hafal);
  if (!j) return { hapusHafalan, jadwal: null, hapusJadwal: false };
  if (lengkap) return { hapusHafalan, jadwal: j, hapusJadwal: false };
  const adaHafalanBaru = [...sisa.values()].some(
    (e) => !e.lama && e.surah === r.surah && e.ayatAwal >= r.ayatAwal && e.ayatAkhir <= r.ayatAkhir,
  );
  return {
    hapusHafalan,
    jadwal: adaHafalanBaru
      ? { ...j, lengkap: false, sebagian: false, tingkat: 0, jatuhTempo: tambahHari(hari, 1) }
      : { ...j, lengkap: false, sebagian: true },
    hapusJadwal: false,
  };
}

// K-30: membatalkan tanda hafalan lama untuk ayat tertentu (entri lama dipecah ulang).
export function batalkanAyatLama(
  surah: number,
  ayat: number[],
  hafalan: Map<string, EntriHafalan>,
  jadwal: Map<number, EntriJadwal>,
): { hapusHafalan: string[]; tambahHafalan: EntriHafalan[]; jadwal: EntriJadwal[]; hapusJadwal: number[] } {
  const buang = new Set(ayat);
  const hapusHafalan: string[] = [];
  const tambahHafalan: EntriHafalan[] = [];
  for (const e of hafalan.values()) {
    if (!e.lama || e.surah !== surah) continue;
    let kena = false;
    for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) if (buang.has(a)) kena = true;
    if (!kena) continue;
    hapusHafalan.push(e.kunci);
    let awal = 0;
    for (let a = e.ayatAwal; a <= e.ayatAkhir + 1; a++) {
      const tetap = a <= e.ayatAkhir && !buang.has(a);
      if (tetap && !awal) awal = a;
      if (!tetap && awal) {
        tambahHafalan.push({ ...e, kunci: `${surah}:${awal}-${a - 1}`, ayatAwal: awal, ayatAkhir: a - 1 });
        awal = 0;
      }
    }
  }
  const sisa = new Map(hafalan);
  for (const k of hapusHafalan) sisa.delete(k);
  for (const e of tambahHafalan) sisa.set(e.kunci, e);
  const hafal = ayatHafal(sisa);
  const hasilJadwal: EntriJadwal[] = [];
  const hapusJadwal: number[] = [];
  const rukuk = new Set(ayat.map((a) => rukukAyat(surah, a)?.nomor).filter((n): n is number => !!n));
  for (const n of rukuk) {
    const r = cariRukuk(n)!;
    const j = jadwal.get(n);
    if (!j) continue;
    if (ayatHafalRukuk(r, hafal).length === 0) hapusJadwal.push(n);
    else if (!rukukLengkap(r, hafal) && j.lengkap) hasilJadwal.push({ ...j, lengkap: false, sebagian: true });
  }
  return { hapusHafalan, tambahHafalan, jadwal: hasilJadwal, hapusJadwal };
}

// K-88 (A): mengembalikan satu potongan hafalan baru ke belum hafal. Null bila bukan hafalan baru.
// Jadwal rukuk disesuaikan: tanpa ayat hafal → dihapus; tidak lengkap lagi → diulang harian bila
// masih ada hafalan baru di rukuk itu, atau berjarak "sebagian" bila sisanya hafalan lama saja.
export function batalkanBaru(
  kunci: string,
  hafalan: Map<string, EntriHafalan>,
  jadwal: Map<number, EntriJadwal>,
  hari: string,
): { hapusHafalan: string[]; jadwal: EntriJadwal[]; hapusJadwal: number[]; ayatLepas: number[] } | null {
  const e = hafalan.get(kunci);
  if (!e || e.lama || !e.sabaqLancar) return null;
  const sisa = new Map(hafalan);
  sisa.delete(kunci);
  const hafal = ayatHafal(sisa);
  const ayatLepas: number[] = [];
  const rukuk = new Set<number>();
  for (let a = e.ayatAwal; a <= e.ayatAkhir; a++) {
    if (!hafal.has(`${e.surah}:${a}`)) ayatLepas.push(a);
    const r = rukukAyat(e.surah, a);
    if (r) rukuk.add(r.nomor);
  }
  const hasilJadwal: EntriJadwal[] = [];
  const hapusJadwal: number[] = [];
  for (const n of rukuk) {
    const r = cariRukuk(n)!;
    const j = jadwal.get(n);
    if (!j) continue;
    if (ayatHafalRukuk(r, hafal).length === 0) {
      hapusJadwal.push(n);
      continue;
    }
    if (rukukLengkap(r, hafal)) continue;
    const adaBaru = [...sisa.values()].some(
      (x) => !x.lama && x.sabaqLancar && x.surah === r.surah && x.ayatAwal <= r.ayatAkhir && x.ayatAkhir >= r.ayatAwal,
    );
    if (adaBaru) {
      if (j.lengkap || j.sebagian)
        hasilJadwal.push({ ...j, lengkap: false, sebagian: false, tingkat: 0, jatuhTempo: tambahHari(hari, 1) });
    } else if (j.lengkap || !j.sebagian) {
      hasilJadwal.push({ ...j, lengkap: false, sebagian: true });
    }
  }
  return { hapusHafalan: [kunci], jadwal: hasilJadwal, hapusJadwal, ayatLepas };
}

// Potongan hafalan baru terakhir yang sudah lancar (untuk tombol kembalikan di Hari ini).
export function hafalanBaruTerakhir(hafalan: Map<string, EntriHafalan>): EntriHafalan | undefined {
  let hasil: EntriHafalan | undefined;
  for (const e of hafalan.values()) {
    if (e.lama || !e.sabaqLancar) continue;
    if (!hasil || e.mulai > hasil.mulai || (e.mulai === hasil.mulai && e.terakhir > hasil.terakhir)) hasil = e;
  }
  return hasil;
}

export function adaTandaLama(nomor: number, hafalan: Map<string, EntriHafalan>): boolean {
  const r = cariRukuk(nomor);
  if (!r) return false;
  for (const e of hafalan.values())
    if (e.lama && e.surah === r.surah && e.ayatAwal >= r.ayatAwal && e.ayatAkhir <= r.ayatAkhir) return true;
  return false;
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
      terakhir: daftar
        .map((e) => e.terakhir)
        .sort()
        .at(-1)!,
    });
  }
  return { hafalan, jadwal };
}

// Label ayat hafal dalam satu rukuk, mis. "ayat 1–3, 7–9" (K-30).
export function labelAyatHafal(nomor: number, hafalan: Map<string, EntriHafalan>): string {
  const r = cariRukuk(nomor);
  if (!r) return '';
  const ayat = ayatHafalRukuk(r, ayatHafal(hafalan));
  const bagian: string[] = [];
  let awal = ayat[0];
  for (let i = 0; i < ayat.length; i++) {
    if (ayat[i + 1] !== ayat[i] + 1) {
      bagian.push(awal === ayat[i] ? `${awal}` : `${awal}–${ayat[i]}`);
      awal = ayat[i + 1];
    }
  }
  return `ayat ${bagian.join(', ')}`;
}

// ---------- Perbaiki ayat (K-62) ----------

// Ayat yang salah kecil saat murojaah rukuk diulang sendiri besok dan lusa.
export const KALI_PERBAIKAN = 2;

export interface EntriPerbaikan {
  kunci: string; // "surah:ayat"
  surah: number;
  ayat: number;
  rukuk: number;
  jatuhTempo: string;
  sisa: number; // perbaikan yang masih harus dilakukan
  mulai: string;
  terakhir: string;
}

// Ayat yang masuk perbaikan: ayat tempat kata salah dan ayat asal sambungan tertukar.
export function ayatPerbaikan(kataSalah: { ayat: number }[], tertukar: { ayatAsal: number }[]): number[] {
  return [...new Set([...kataSalah.map((k) => k.ayat), ...tertukar.map((t) => t.ayatAsal)])].sort((a, b) => a - b);
}

export function mulaiPerbaikan(
  surah: number,
  ayat: number,
  rukuk: number,
  hari: string,
  lama?: EntriPerbaikan,
): EntriPerbaikan {
  return {
    kunci: `${surah}:${ayat}`,
    surah,
    ayat,
    rukuk,
    jatuhTempo: tambahHari(hari, 1),
    sisa: KALI_PERBAIKAN,
    mulai: lama?.mulai ?? hari,
    terakhir: hari,
  };
}

// Sesudah merekam & mengoreksi satu ayat perbaikan. Null = perbaikan selesai (dihapus).
// Salah lagi → mulai lagi besok dan lusa. Dikerjakan sebelum jatuh tempo → tidak dihitung.
export function setelahPerbaikan(e: EntriPerbaikan, lancar: boolean, hari: string): EntriPerbaikan | null {
  if (!lancar) return mulaiPerbaikan(e.surah, e.ayat, e.rukuk, hari, e);
  if (e.jatuhTempo > hari) return { ...e, terakhir: hari };
  const sisa = e.sisa - 1;
  return sisa <= 0 ? null : { ...e, sisa, jatuhTempo: tambahHari(hari, 1), terakhir: hari };
}

export function daftarPerbaikanHariIni(semua: EntriPerbaikan[], hari: string): EntriPerbaikan[] {
  return semua
    .filter((e) => e.jatuhTempo <= hari)
    .sort((a, b) =>
      a.jatuhTempo !== b.jatuhTempo ? (a.jatuhTempo < b.jatuhTempo ? -1 : 1) : a.surah - b.surah || a.ayat - b.ayat,
    );
}
