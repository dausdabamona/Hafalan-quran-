import { daftarSurah, susunToken, type Surah } from './data';
import { arabPolos, kataDari, kunciEjaan } from './hadits';
import type { AlamatAyat, Keterangan, Makna } from './db';

// K-98 (B): pencarian umum Al-Qur'an. Hadits memakai pencarian K-78/K-80 yang sudah ada.
// Data Saku Hati tidak memuat terjemah utuh, jadi bahasa Indonesia dicari di arti per kata
// dan catatan milik Firdaus (makna, keterangan, judul alamat).

export type SumberCari = 'judul' | 'makna' | 'keterangan' | 'arti' | 'arab';

export const LABEL_SUMBER: Record<SumberCari, string> = {
  judul: 'Judul alamat',
  makna: 'Makna sendiri',
  keterangan: 'Keterangan',
  arti: 'Arti per kata',
  arab: 'Teks Arab',
};

export interface HasilQuran {
  surah: number;
  ayat: number;
  sumber: SumberCari;
  teks: string; // teks bidang yang cocok, untuk cuplikan
}

export interface CatatanSendiri {
  makna: Makna[];
  keterangan: Keterangan[];
  alamat: AlamatAyat[];
}

export const MAKS_HASIL_QURAN = 300;

// Indeks ringan per ayat, dibangun sekali saat pertama dipakai (6.236 ayat).
interface BarisAyat {
  surah: number;
  ayat: number;
  arab: string; // tanpa basmalah, polos
  arabTampil: string; // tanpa basmalah, dengan harakat
  arti: string; // arti per kata, huruf kecil
}
let indeks: BarisAyat[] | null = null;

function bangunIndeks(): BarisAyat[] {
  if (indeks) return indeks;
  indeks = [];
  for (const s of daftarSurah) {
    for (const a of s.ayat) {
      const teks = susunToken(a)
        .map((t) => t.teks)
        .join(' ');
      indeks.push({
        surah: s.nomor,
        ayat: a.ayat,
        arab: arabPolos(teks).replace(/\s+/g, ' '),
        arabTampil: teks,
        arti: a.kata
          .map((k) => k.arti)
          .join(' ')
          .toLowerCase(),
      });
    }
  }
  return indeks;
}

const lepas = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Kata Latin cocok bila ada kata di teks yang memuatnya (ejaan disamakan seperti hadits).
// Kata cari ≥ 4 huruf boleh berada di tengah kata (imbuhan: kesabaran, bersabar); yang lebih pendek harus di awal kata.
function cocokLatin(teks: string, kata: string[]): boolean {
  const kataTeks = kataDari(teks).map(kunciEjaan);
  return kata.every((k) => {
    const kunci = kunciEjaan(k);
    return kataTeks.some((t) => (kunci.length >= 4 ? t.includes(kunci) : t.startsWith(kunci)));
  });
}

function cocokArab(teks: string, kata: string[]): boolean {
  return kata.every((k) => teks.includes(k));
}

export function cariQuran(q: string, catatan: CatatanSendiri): { hasil: HasilQuran[]; kata: string[]; arab: boolean } {
  const kata = [...new Set(kataDari(q))].filter((k) => k.length >= 2);
  if (!kata.length) return { hasil: [], kata, arab: false };
  const arab = kata.every((k) => /[ء-ي]/.test(k));
  const hasil: HasilQuran[] = [];
  const sudah = new Set<string>();
  const tambah = (h: HasilQuran) => {
    const k = `${h.surah}:${h.ayat}`;
    if (sudah.has(k) || hasil.length >= MAKS_HASIL_QURAN) return;
    sudah.add(k);
    hasil.push(h);
  };

  if (arab) {
    // Frasa utuh didahulukan, lalu ayat yang memuat semua kata di mana saja.
    const frasa = kata.join(' ');
    if (kata.length > 1)
      for (const b of bangunIndeks())
        if (b.arab.includes(frasa)) tambah({ surah: b.surah, ayat: b.ayat, sumber: 'arab', teks: b.arabTampil });
    for (const b of bangunIndeks())
      if (cocokArab(b.arab, kata)) tambah({ surah: b.surah, ayat: b.ayat, sumber: 'arab', teks: b.arabTampil });
    return { hasil, kata, arab };
  }

  // Catatan sendiri didahulukan: judul alamat, makna, keterangan.
  for (const x of catatan.alamat)
    if (x.jenis === 'judul' && cocokLatin(x.isi, kata))
      tambah({ surah: x.surah, ayat: x.ayat, sumber: 'judul', teks: x.isi });
  for (const x of catatan.makna)
    if (cocokLatin(x.isi, kata)) tambah({ surah: x.surah, ayat: x.ayat, sumber: 'makna', teks: x.isi });
  for (const x of catatan.keterangan)
    if (cocokLatin(x.isi, kata)) tambah({ surah: x.surah, ayat: x.ayat, sumber: 'keterangan', teks: x.isi });
  for (const x of catatan.alamat)
    if (x.jenis === 'jembatan' && cocokLatin(x.isi, kata))
      tambah({ surah: x.surah, ayat: x.ayat, sumber: 'judul', teks: x.isi });
  // Arti per kata: urut mushaf.
  const sisa: HasilQuran[] = [];
  for (const b of bangunIndeks())
    if (cocokLatin(b.arti, kata)) sisa.push({ surah: b.surah, ayat: b.ayat, sumber: 'arti', teks: b.arti });
  sisa.forEach(tambah);
  // Catatan sendiri tetap diurutkan menurut mushaf di dalam kelompoknya.
  return { hasil, kata, arab };
}

// ---------- Lompat langsung: "67:1", "67 1", "al mulk", "mulk 3" ----------

const polosNama = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Nama surah tanpa awalan al-/an-/at- dsb., agar "mulk" menemukan Al-Mulk.
const intiNama = (s: string) => polosNama(s.replace(/^(al|an|at|ad|ar|as|asy|az|adz|ath|adh)[-\s]/i, ''));

export interface Lompatan {
  surah: Surah;
  ayat?: number;
}

export function cariLompatan(q: string): Lompatan[] {
  const t = q.trim();
  const nomor = /^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/.exec(t) ?? /^(\d{1,3})$/.exec(t);
  if (nomor) {
    const s = daftarSurah[Number(nomor[1]) - 1];
    if (!s) return [];
    const ayat = nomor[2] ? Number(nomor[2]) : undefined;
    return ayat && (ayat < 1 || ayat > s.jumlahAyat) ? [{ surah: s }] : [{ surah: s, ayat }];
  }
  const m = /^(.*?)(?:\s+(\d{1,3}))?$/.exec(t);
  const nama = polosNama(m?.[1] ?? '');
  if (nama.length < 3) return [];
  const ayat = m?.[2] ? Number(m[2]) : undefined;
  return daftarSurah
    .filter((s) => polosNama(s.nama).includes(nama) || intiNama(s.nama).startsWith(intiNama(m?.[1] ?? '')))
    .slice(0, 5)
    .map((s) => ({ surah: s, ayat: ayat && ayat <= s.jumlahAyat ? ayat : undefined }));
}

export function polaSorot(kata: string[]): RegExp | null {
  if (!kata.length) return null;
  return new RegExp(`(${kata.map(lepas).join('|')})`, 'gi');
}
