import quran from '../data/quran.json';
import rukukJson from '../data/rukuk.json';

// ---------- Bentuk data ----------

export interface Kata {
  urutan: number; // urutan kata dalam ayat (sesudah basmalah), mulai 1
  teks: string;
  arti: string;
}

export interface Ayat {
  ayat: number;
  teks: string; // teks Tanzil apa adanya (K-18)
  basmalah: boolean;
  kata: Kata[];
}

export interface Surah {
  nomor: number;
  nama: string;
  namaArab: string;
  arti: string;
  jumlahAyat: number;
  readonly ayat: Ayat[]; // dibentuk saat pertama dibutuhkan
}

export interface Rukuk {
  nomor: number; // 1–556 se-Al-Qur'an
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
}

export interface AwalJuz {
  nomor: number;
  surah: number;
  ayat: number;
}

export interface AyatMentah {
  t: string;
  b?: 1;
  a: string[];
  w?: string[];
}

interface SurahMentah {
  n: number;
  nama: string;
  arab: string;
  arti: string;
  jml: number;
  ayat: AyatMentah[];
}

interface DataQuran {
  versi: number;
  sumber: { teks: string; artiPerKata: string; lisensiTanzil: string };
  surah: SurahMentah[];
}

const data = quran as DataQuran;
export const sumberData = data.sumber;
export const JUMLAH_AYAT = 6236;

// ---------- Token ----------

// Token berisi huruf Arab adalah kata; selain itu tanda waqaf, rubu' (۞), atau sajdah (۩).
const POLA_HURUF = /[ء-يٱ-ۓ]/;
// Tanda waqaf kecil di atas baris (ۖ ۗ ۘ ۙ ۚ ۛ ۜ): batas potongan makna.
const POLA_WAQAF = /[ۖ-ۜ]/;
const KATA_BASMALAH = 4;

export function adalahKata(token: string): boolean {
  return POLA_HURUF.test(token);
}

export function adalahWaqaf(token: string): boolean {
  return !adalahKata(token) && POLA_WAQAF.test(token);
}

// Pada beberapa ayat Quran.com menggabungkan dua kata Tanzil (mis. "بَعْدَ مَا")
// menjadi satu entri arti. Arti itu dipakai untuk setiap kata Tanzil di dalamnya.
function artiSejajar(m: AyatMentah): string[] {
  if (!m.w) return m.a;
  const hasil: string[] = [];
  m.w.forEach((w, i) => {
    const n = w.split(/\s+/).filter((t) => t && adalahKata(t)).length || 1;
    for (let k = 0; k < n; k++) hasil.push(m.a[i] ?? '');
  });
  return hasil;
}

function bentukAyat(m: AyatMentah, nomor: number): Ayat {
  const arti = artiSejajar(m);
  let lewati = m.b ? KATA_BASMALAH : 0;
  const kata: Kata[] = [];
  for (const t of m.t.split(/\s+/)) {
    if (!t || !adalahKata(t)) continue;
    if (lewati > 0) {
      lewati--;
      continue;
    }
    kata.push({ urutan: kata.length + 1, teks: t, arti: arti[kata.length] ?? '' });
  }
  return { ayat: nomor, teks: m.t, basmalah: !!m.b, kata };
}

// ---------- Hitungan ayat Al-Fatihah (K-26) ----------
// Tanzil memakai hitungan Kufah: basmalah = ayat 1. Aplikasi memakai hitungan
// Madinah/Basrah/Syam: basmalah menjadi pembuka tanpa nomor, Alhamdulillah = ayat 1,
// dan ayat terakhir dibagi sesudah "أَنْعَمْتَ عَلَيْهِمْ". Huruf Tanzil tidak diubah;
// yang berubah hanya batas dan nomor ayat.
export const KATA_AYAT_6_FATIHAH = 4;

function pecahKata(m: AyatMentah, jumlah: number): [AyatMentah, AyatMentah] {
  const token = m.t.split(/\s+/).filter(Boolean);
  let kata = 0;
  let i = 0;
  for (; i < token.length && kata < jumlah; i++) if (adalahKata(token[i])) kata++;
  // Tanda (waqaf dsb.) yang menempel sesudah kata terakhir ikut ayat pertama.
  while (i < token.length && !adalahKata(token[i])) i++;
  return [
    { t: token.slice(0, i).join(' '), a: m.a.slice(0, jumlah) },
    { t: token.slice(i).join(' '), a: m.a.slice(jumlah) },
  ];
}

export function ayatFatihahHitunganMadinah(ayat: AyatMentah[]): AyatMentah[] {
  const [basmalah, hamd, ...tengah] = ayat;
  const akhir = tengah.pop()!;
  const [enam, tujuh] = pecahKata(akhir, KATA_AYAT_6_FATIHAH);
  return [{ t: `${basmalah.t} ${hamd.t}`, b: 1, a: hamd.a }, ...tengah, enam, tujuh];
}

function bentukSurah(m: SurahMentah): Surah {
  let cache: Ayat[] | null = null;
  const mentah = m.n === 1 ? ayatFatihahHitunganMadinah(m.ayat) : m.ayat;
  return {
    nomor: m.n,
    nama: m.nama,
    namaArab: m.arab,
    arti: m.arti,
    jumlahAyat: m.jml,
    get ayat() {
      if (!cache) cache = mentah.map((a, i) => bentukAyat(a, i + 1));
      return cache;
    },
  };
}

export const daftarSurah: Surah[] = data.surah.map(bentukSurah);

export function cariSurah(nomor: number): Surah | undefined {
  return daftarSurah[nomor - 1];
}

export function cariAyat(surah: number, ayat: number): Ayat | undefined {
  return cariSurah(surah)?.ayat[ayat - 1];
}

// ---------- Rukuk & juz ----------

export const daftarRukuk: Rukuk[] = (rukukJson as { rukuk: Rukuk[] }).rukuk;
export const daftarJuz: AwalJuz[] = (rukukJson as { juz: AwalJuz[] }).juz;

export function cariRukuk(nomor: number): Rukuk | undefined {
  return daftarRukuk[nomor - 1];
}

export function rukukSurah(surah: number): Rukuk[] {
  return daftarRukuk.filter((r) => r.surah === surah);
}

export function rukukAyat(surah: number, ayat: number): Rukuk | undefined {
  return daftarRukuk.find((r) => r.surah === surah && r.ayatAwal <= ayat && ayat <= r.ayatAkhir);
}

export function juzAyat(surah: number, ayat: number): number {
  let juz = 1;
  for (const j of daftarJuz) {
    if (j.surah < surah || (j.surah === surah && j.ayat <= ayat)) juz = j.nomor;
  }
  return juz;
}

// ---------- Token tampilan & potongan waqaf ----------

export interface Token {
  teks: string;
  kata: Kata | null; // null untuk tanda waqaf/rubu'/sajdah yang tidak bisa diketuk
  segmen: number; // indeks potongan makna (waqaf) dalam ayat, mulai 0
}

// Memecah teks ayat (Tanzil, apa adanya) menjadi token tampilan. Basmalah di
// awal ayat pertama dibuang dari token karena ditampilkan sebagai judul surah.
// Setiap tanda waqaf menutup satu potongan makna.
export function susunToken(ayat: Ayat): Token[] {
  let lewati = ayat.basmalah ? KATA_BASMALAH : 0;
  let iKata = 0;
  let segmen = 0;
  let segmenBerisi = false;
  const hasil: Token[] = [];
  for (const t of ayat.teks.split(/\s+/)) {
    if (!t) continue;
    const kata = adalahKata(t);
    if (lewati > 0) {
      if (kata) lewati--;
      continue;
    }
    if (kata) {
      hasil.push({ teks: t, kata: ayat.kata[iKata] ?? null, segmen });
      iKata++;
      segmenBerisi = true;
    } else {
      hasil.push({ teks: t, kata: null, segmen });
      // Waqaf menutup potongan yang sudah berisi kata; dua tanda berturutan tidak membuat potongan kosong.
      if (POLA_WAQAF.test(t) && segmenBerisi && iKata < ayat.kata.length) {
        segmen++;
        segmenBerisi = false;
      }
    }
  }
  return hasil;
}

export interface Segmen {
  indeks: number;
  kata: Kata[];
  maknaBawaan: string; // gabungan arti per kata
}

// Potongan makna per tanda waqaf; makna bawaan = gabungan arti per kata.
export function segmenAyat(ayat: Ayat): Segmen[] {
  const hasil: Segmen[] = [];
  for (const t of susunToken(ayat)) {
    if (!t.kata) continue;
    if (!hasil[t.segmen]) hasil[t.segmen] = { indeks: t.segmen, kata: [], maknaBawaan: '' };
    hasil[t.segmen].kata.push(t.kata);
  }
  for (const s of hasil) s.maknaBawaan = s.kata.map((k) => k.arti).filter(Boolean).join(' ');
  return hasil;
}

// K-61: kata bantu murojaah — kata pertama ayat, kata pertama sesudah tiap tanda waqaf,
// dan kata terakhir ayat. Mengembalikan nomor urutan kata.
// K-65: ayat yang hanya dua kata (atau kurang) cukup kata pertamanya.
export function kataBantu(ayat: Ayat): Set<number> {
  const hasil = new Set<number>();
  const segmen = segmenAyat(ayat).filter(Boolean);
  const semua = segmen.flatMap((g) => g.kata);
  if (semua.length <= 2) return new Set(semua.length ? [semua[0].urutan] : []);
  for (const g of segmen) if (g.kata.length) hasil.add(g.kata[0].urutan);
  const akhir = segmen.at(-1)?.kata.at(-1);
  if (akhir) hasil.add(akhir.urutan);
  return hasil;
}

// ---------- Potongan hafalan (K-04, P-11) ----------

export interface Potongan {
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
}

// Ayat pendek dikumpulkan hingga 3 ayat selama jumlah katanya tidak melewati
// batas; ayat panjang berdiri sendiri. Potongan tidak melintasi batas rukuk.
export const MAKS_AYAT_POTONGAN = 3;
export const MAKS_KATA_POTONGAN = 24;

export function bagiPotongan(surah: Surah): Potongan[] {
  const hasil: Potongan[] = [];
  for (const r of rukukSurah(surah.nomor)) {
    let awal = 0;
    let akhir = 0;
    let kata = 0;
    for (let n = r.ayatAwal; n <= r.ayatAkhir; n++) {
      const jumlah = surah.ayat[n - 1].kata.length;
      const muat = awal > 0 && akhir - awal + 1 < MAKS_AYAT_POTONGAN && kata + jumlah <= MAKS_KATA_POTONGAN;
      if (muat) {
        akhir = n;
        kata += jumlah;
      } else {
        if (awal > 0) hasil.push({ surah: surah.nomor, ayatAwal: awal, ayatAkhir: akhir });
        awal = n;
        akhir = n;
        kata = jumlah;
      }
    }
    if (awal > 0) hasil.push({ surah: surah.nomor, ayatAwal: awal, ayatAkhir: akhir });
  }
  return hasil;
}

const cachePotongan = new Map<number, Potongan[]>();
export function potonganSurah(nomor: number): Potongan[] {
  if (!cachePotongan.has(nomor)) cachePotongan.set(nomor, bagiPotongan(cariSurah(nomor)!));
  return cachePotongan.get(nomor)!;
}

export function ayatPotongan(surah: Surah, p: Potongan): Ayat[] {
  return surah.ayat.slice(p.ayatAwal - 1, p.ayatAkhir);
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
    if (adalahKata(t)) kata++;
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
