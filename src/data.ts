import juz30 from '../data/juz30.json';

export interface Kata {
  urutan: number;
  teks: string;
  arti: string;
}

export interface Ayat {
  ayat: number;
  teks: string;
  basmalah: boolean;
  kata: Kata[];
}

export interface Surah {
  nomor: number;
  nama: string;
  namaArab: string;
  arti: string;
  jumlahAyat: number;
  ayat: Ayat[];
}

interface DataJuz {
  versi: number;
  sumber: { teks: string; artiPerKata: string; lisensiTanzil: string };
  surah: Surah[];
}

export const dataJuz30 = juz30 as DataJuz;
export const daftarSurah: Surah[] = dataJuz30.surah;

export function cariSurah(nomor: number): Surah | undefined {
  return daftarSurah.find((s) => s.nomor === nomor);
}

// Harus sama dengan scripts/siapkan-data.mjs: token tanpa huruf Arab adalah
// tanda waqaf, rubu' (۞), atau sajdah (۩) yang berdiri sendiri.
const POLA_HURUF = /[ء-يٱ-ۓ]/;
const KATA_BASMALAH = 4;

export interface Token {
  teks: string;
  // null untuk tanda waqaf/rubu'/sajdah yang tidak bisa diketuk.
  kata: Kata | null;
}

// Memecah teks ayat (Tanzil, apa adanya) menjadi token tampilan. Basmalah di
// awal ayat pertama dibuang dari token karena ditampilkan sebagai judul surah.
export function susunToken(ayat: Ayat): Token[] {
  const token = ayat.teks.split(/\s+/).filter(Boolean);
  let lewati = ayat.basmalah ? KATA_BASMALAH : 0;
  let iKata = 0;
  const hasil: Token[] = [];
  for (const t of token) {
    const adalahKata = POLA_HURUF.test(t);
    if (lewati > 0) {
      if (adalahKata) lewati--;
      continue;
    }
    if (adalahKata) {
      hasil.push({ teks: t, kata: ayat.kata[iKata] ?? null });
      iKata++;
    } else {
      hasil.push({ teks: t, kata: null });
    }
  }
  return hasil;
}

// ---------- Potongan hafalan (K-04, P-11) ----------

export interface Potongan {
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
}

// Batas kata satu potongan. Ayat pendek dikumpulkan hingga 3 ayat selama
// jumlah katanya tidak melewati batas; ayat panjang berdiri sendiri.
export const MAKS_AYAT_POTONGAN = 3;
export const MAKS_KATA_POTONGAN = 24;

export function bagiPotongan(surah: Surah): Potongan[] {
  const hasil: Potongan[] = [];
  let awal = 0;
  let akhir = 0;
  let kata = 0;
  for (const a of surah.ayat) {
    const n = a.kata.length;
    const muat = awal > 0 && akhir - awal + 1 < MAKS_AYAT_POTONGAN && kata + n <= MAKS_KATA_POTONGAN;
    if (muat) {
      akhir = a.ayat;
      kata += n;
    } else {
      if (awal > 0) hasil.push({ surah: surah.nomor, ayatAwal: awal, ayatAkhir: akhir });
      awal = a.ayat;
      akhir = a.ayat;
      kata = n;
    }
  }
  if (awal > 0) hasil.push({ surah: surah.nomor, ayatAwal: awal, ayatAkhir: akhir });
  return hasil;
}

export function ayatPotongan(surah: Surah, p: Potongan): Ayat[] {
  return surah.ayat.filter((a) => a.ayat >= p.ayatAwal && a.ayat <= p.ayatAkhir);
}

export function labelPotongan(p: Potongan): string {
  return p.ayatAwal === p.ayatAkhir ? `ayat ${p.ayatAwal}` : `ayat ${p.ayatAwal}–${p.ayatAkhir}`;
}

// Basmalah diambil langsung dari teks Tanzil ayat pertama, bukan diketik ulang.
export function teksBasmalah(ayat: Ayat): string | null {
  if (!ayat.basmalah) return null;
  const hasil: string[] = [];
  let kata = 0;
  for (const t of ayat.teks.split(/\s+/).filter(Boolean)) {
    if (kata === KATA_BASMALAH) break;
    hasil.push(t);
    if (POLA_HURUF.test(t)) kata++;
  }
  return hasil.join(' ');
}

const ANGKA_ARAB = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export function angkaArab(n: number): string {
  return String(n)
    .split('')
    .map((d) => ANGKA_ARAB[Number(d)])
    .join('');
}
