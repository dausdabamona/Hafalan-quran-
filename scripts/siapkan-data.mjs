// Penyiapan data Juz 30 untuk aplikasi hafalan.
//
// Menggabungkan dua sumber:
//   1. Teks Utsmani Mushaf Madinah dari Tanzil (tanzil.net, CC BY 3.0) — dipakai apa adanya, tidak diubah (K-18).
//   2. Arti per kata bahasa Indonesia dari Quran.com (api.quran.com/api/v4) (K-19).
//
// Hasil: data/juz30.json. Skrip berhenti dengan galat bila ada ayat yang
// jumlah katanya tidak cocok antara kedua sumber, agar data keliru tidak
// pernah masuk ke aplikasi.
//
// Dijalankan oleh GitHub Actions (.github/workflows/siapkan-data.yml) karena
// server GitHub punya akses internet ke kedua sumber. Butuh Node 20+, tanpa dependensi.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SURAH_AWAL = 78;
export const SURAH_AKHIR = 114;
export const JUMLAH_AYAT_JUZ_30 = 564;

const URL_TANZIL =
  'https://tanzil.net/pub/download/index.php?quranType=uthmani&marks=true&sajdah=true&rub=true&alef=true&outType=txt-2&agree=true';
const URL_QURAN_COM = 'https://api.quran.com/api/v4';

// Huruf Arab dasar dan alif wasla; token tanpa huruf ini adalah tanda waqaf,
// tanda rubu' (۞), atau tanda sajdah (۩) yang berdiri sendiri.
const POLA_HURUF = /[ء-يٱ-ۓ]/;

export function adalahKata(token) {
  return POLA_HURUF.test(token);
}

// Format txt-2 Tanzil: "surah|ayat|teks" per baris; baris berawalan # adalah catatan lisensi.
export function uraiTanzil(isi) {
  const ayat = new Map();
  const lisensi = [];
  for (const baris of isi.split(/\r?\n/)) {
    if (baris.startsWith('#')) {
      lisensi.push(baris);
      continue;
    }
    const cocok = /^(\d+)\|(\d+)\|(.+)$/.exec(baris.trim());
    if (!cocok) continue;
    ayat.set(`${Number(cocok[1])}:${Number(cocok[2])}`, cocok[3]);
  }
  return { ayat, lisensi: lisensi.join('\n') };
}

const AWAL_BASMALAH = 'بِسْمِ';
const KATA_BASMALAH = 4;

// Memasangkan kata Tanzil dengan arti Quran.com untuk satu ayat.
// Pada Tanzil, ayat pertama tiap surah (kecuali Al-Fatihah dan At-Taubah)
// diawali basmalah, sedangkan Quran.com tidak; basmalah dipisah ke kolom
// tersendiri tanpa mengubah teks ayat aslinya.
export function pasangkanKata({ surah, ayat, teksTanzil, kataQuranCom }) {
  const token = teksTanzil.split(/\s+/).filter(Boolean);
  const indeksKata = token
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => adalahKata(t));
  const kataSumber = kataQuranCom.filter((k) => k.char_type_name === 'word');

  let mulai = 0;
  let basmalah = false;
  const selisih = indeksKata.length - kataSumber.length;
  if (
    ayat === 1 &&
    surah !== 1 &&
    surah !== 9 &&
    selisih === KATA_BASMALAH &&
    indeksKata[0]?.t === AWAL_BASMALAH
  ) {
    basmalah = true;
    mulai = KATA_BASMALAH;
  } else if (selisih !== 0) {
    throw new Error(
      `Jumlah kata ${surah}:${ayat} tidak cocok — Tanzil ${indeksKata.length}, Quran.com ${kataSumber.length}`,
    );
  }

  const kata = indeksKata.slice(mulai).map(({ t }, i) => ({
    urutan: i + 1,
    teks: t,
    arti: (kataSumber[i].translation?.text ?? '').trim(),
  }));

  return { surah, ayat, teks: teksTanzil, basmalah, kata };
}

async function ambilJson(url) {
  for (let percobaan = 1; percobaan <= 3; percobaan++) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.ok) return res.json();
    if (percobaan === 3) throw new Error(`Gagal mengambil ${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * percobaan));
  }
}

async function ambilSurahQuranCom(surah) {
  const ayat = [];
  let halaman = 1;
  for (;;) {
    const url =
      `${URL_QURAN_COM}/verses/by_chapter/${surah}?language=id&words=true` +
      `&word_fields=text_uthmani&per_page=50&page=${halaman}`;
    const data = await ambilJson(url);
    ayat.push(...data.verses);
    if (!data.pagination?.next_page) break;
    halaman = data.pagination.next_page;
  }
  return ayat;
}

async function utama() {
  console.log('Mengunduh teks Utsmani dari Tanzil…');
  const resTanzil = await fetch(URL_TANZIL);
  if (!resTanzil.ok) throw new Error(`Gagal mengunduh Tanzil: HTTP ${resTanzil.status}`);
  const { ayat: teksTanzil, lisensi } = uraiTanzil(await resTanzil.text());
  if (teksTanzil.size !== 6236) {
    throw new Error(`Teks Tanzil tidak lengkap: ${teksTanzil.size} ayat (seharusnya 6236)`);
  }

  console.log('Mengunduh nama surah…');
  const { chapters } = await ambilJson(`${URL_QURAN_COM}/chapters?language=id`);

  const surahList = [];
  let totalAyat = 0;
  for (let s = SURAH_AWAL; s <= SURAH_AKHIR; s++) {
    const info = chapters.find((c) => c.id === s);
    console.log(`Surah ${s} ${info.name_simple}…`);
    const ayatQc = await ambilSurahQuranCom(s);
    if (ayatQc.length !== info.verses_count) {
      throw new Error(`Surah ${s}: ${ayatQc.length} ayat diterima, seharusnya ${info.verses_count}`);
    }
    const ayatSurah = ayatQc.map((v) => {
      const nomor = v.verse_number;
      const teks = teksTanzil.get(`${s}:${nomor}`);
      if (!teks) throw new Error(`Ayat ${s}:${nomor} tidak ada di Tanzil`);
      const { basmalah, kata } = pasangkanKata({
        surah: s,
        ayat: nomor,
        teksTanzil: teks,
        kataQuranCom: v.words,
      });
      return { ayat: nomor, teks, basmalah, kata };
    });
    totalAyat += ayatSurah.length;
    surahList.push({
      nomor: s,
      nama: info.name_simple,
      namaArab: info.name_arabic,
      arti: info.translated_name?.name ?? '',
      jumlahAyat: info.verses_count,
      ayat: ayatSurah,
    });
  }

  if (totalAyat !== JUMLAH_AYAT_JUZ_30) {
    throw new Error(`Total ayat ${totalAyat}, seharusnya ${JUMLAH_AYAT_JUZ_30}`);
  }

  const hasil = {
    versi: 1,
    dibuat: new Date().toISOString(),
    sumber: {
      teks: 'Tanzil Quran Text (Uthmani), tanzil.net — CC BY 3.0, dipakai tanpa perubahan',
      artiPerKata: 'Quran.com (api.quran.com/api/v4), terjemahan per kata bahasa Indonesia',
      lisensiTanzil: lisensi,
    },
    surah: surahList,
  };

  const folderData = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  await mkdir(folderData, { recursive: true });
  await writeFile(path.join(folderData, 'juz30.json'), JSON.stringify(hasil, null, 1) + '\n', 'utf8');
  console.log(`Selesai: ${surahList.length} surah, ${totalAyat} ayat → data/juz30.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  utama().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
