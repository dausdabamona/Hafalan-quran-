import { bagiPotongan, daftarSurah, type Potongan } from './data';

// Logika jadwal murni (tanpa database) agar bisa diuji dengan simulasi hari.
//
// Keputusan yang dipakai:
//  K-06 jarak ulang 1–3–7–14–30 hari
//  P-01 "lancar" = tidak ada kesalahan baru pada sesi itu
//  P-02 setelah 30 hari tetap diulang tiap 30 hari
//  P-03 ada kesalahan baru → kembali ke jarak 1 hari
//  P-04 satu potongan hafalan baru per hari
//  P-05 hari terlewat: tanggungan menumpuk, yang paling lama terlambat didahulukan
//  P-06 hafalan baru kemarin harus lancar dulu sebelum menambah yang baru

export const JARAK_HARI = [1, 3, 7, 14, 30];
export const BATAS_ULANG_MALAM = 10;

export interface EntriJadwal {
  kunci: string; // "surah:awal-akhir"
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  tingkat: number; // indeks ke JARAK_HARI untuk jarak berikutnya setelah lancar
  jatuhTempo: string; // YYYY-MM-DD
  mulai: string; // hari pertama dihafal (YYYY-MM-DD)
  terakhir: string; // hari terakhir dikoreksi (YYYY-MM-DD)
  sabaqLancar: boolean; // hafalan baru ini sudah pernah lancar (P-06)
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
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function selisihHari(dari: string, ke: string): number {
  const a = Date.parse(dari + 'T00:00:00Z');
  const b = Date.parse(ke + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}

// ---------- Potongan & jalur ----------

export function kunciPotongan(p: Potongan): string {
  return `${p.surah}:${p.ayatAwal}-${p.ayatAkhir}`;
}

export type ArahJalur = 'dari-an-nas' | 'dari-an-naba';

// Jalur (b) K-08: urutan surah Juz 30. Di dalam surah ayat selalu maju.
export function jalurUrutan(arah: ArahJalur): Potongan[] {
  const surah = arah === 'dari-an-nas' ? [...daftarSurah].reverse() : daftarSurah;
  return surah.flatMap((s) => bagiPotongan(s));
}

// ---------- Perubahan jadwal setelah satu sesi koreksi ----------

// Mengembalikan entri baru, atau null bila jadwal tidak berubah
// (mis. potongan diulang sebelum jatuh tempo).
export function perbaruiJadwal(
  lama: EntriJadwal | undefined,
  p: Potongan,
  lancar: boolean,
  hari: string,
): EntriJadwal | null {
  if (!lama) {
    // Hafalan baru: masuk jadwal ulang hari ke-1.
    return {
      kunci: kunciPotongan(p),
      surah: p.surah,
      ayatAwal: p.ayatAwal,
      ayatAkhir: p.ayatAkhir,
      tingkat: 0,
      jatuhTempo: tambahHari(hari, JARAK_HARI[0]),
      mulai: hari,
      terakhir: hari,
      sabaqLancar: lancar,
    };
  }
  if (!lama.sabaqLancar) {
    // Hafalan baru yang belum lancar diulang lagi (P-06); siklus mulai setelah lancar.
    return { ...lama, tingkat: 0, jatuhTempo: tambahHari(hari, JARAK_HARI[0]), terakhir: hari, sabaqLancar: lancar };
  }
  if (lama.jatuhTempo > hari) return null;
  if (lancar) {
    const tingkat = Math.min(lama.tingkat + 1, JARAK_HARI.length - 1);
    return { ...lama, tingkat, jatuhTempo: tambahHari(hari, JARAK_HARI[tingkat]), terakhir: hari };
  }
  return { ...lama, tingkat: 0, jatuhTempo: tambahHari(hari, JARAK_HARI[0]), terakhir: hari };
}

// Sambungan tertukar di luar sesi koreksi (mode Sambung ayat) ikut menurunkan jadwal (K-15).
export function turunkanJadwal(lama: EntriJadwal, hari: string): EntriJadwal {
  if (!lama.sabaqLancar) return lama;
  return { ...lama, tingkat: 0, jatuhTempo: tambahHari(hari, JARAK_HARI[0]) };
}

// ---------- Rencana hari ini ----------

export type HafalanBaru =
  | { status: 'baru'; potongan: Potongan }
  | { status: 'ulang'; potongan: Potongan } // kemarin belum lancar (P-06)
  | { status: 'selesai'; potongan: Potongan } // sudah dikerjakan hari ini (P-04)
  | { status: 'tamat' };

export function pilihHafalanBaru(jalur: Potongan[], jadwal: Map<string, EntriJadwal>, hari: string): HafalanBaru {
  let terakhir: EntriJadwal | undefined;
  for (const e of jadwal.values()) {
    if (!terakhir || e.mulai > terakhir.mulai || (e.mulai === terakhir.mulai && e.kunci > terakhir.kunci)) terakhir = e;
  }
  if (terakhir && !terakhir.sabaqLancar) return { status: 'ulang', potongan: terakhir };
  if (terakhir && terakhir.mulai === hari) return { status: 'selesai', potongan: terakhir };
  const berikut = jalur.find((p) => !jadwal.has(kunciPotongan(p)));
  return berikut ? { status: 'baru', potongan: berikut } : { status: 'tamat' };
}

export type Kelompok = 'dekat' | 'lama';

// Sabqi (dekat): jarak 1, 3, 7 hari. Manzil (lama): jarak 14 dan 30 hari.
export function kelompok(e: EntriJadwal): Kelompok {
  return JARAK_HARI[e.tingkat] >= 14 ? 'lama' : 'dekat';
}

export function daftarUlangHafalan(jadwal: Map<string, EntriJadwal>, hari: string): EntriJadwal[] {
  return [...jadwal.values()]
    .filter((e) => e.sabaqLancar && e.jatuhTempo <= hari)
    .sort((a, b) => (a.jatuhTempo === b.jatuhTempo ? a.kunci.localeCompare(b.kunci) : a.jatuhTempo < b.jatuhTempo ? -1 : 1));
}

export function selesaiHariIni(jadwal: Map<string, EntriJadwal>, hari: string): EntriJadwal[] {
  return [...jadwal.values()].filter((e) => e.terakhir === hari && e.mulai !== hari && e.jatuhTempo > hari);
}
