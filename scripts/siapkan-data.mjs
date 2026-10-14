// Penyiapan data Al-Qur'an 30 juz untuk aplikasi Saku Hati.
//
// Menggabungkan dua sumber:
//   1. Teks Utsmani Mushaf Madinah dari Tanzil (tanzil.net, CC BY 3.0) — dipakai apa adanya, tidak diubah (K-18).
//   2. Arti per kata bahasa Indonesia dari Quran.com (api.quran.com/api/v4) (K-19).
//
// Hasil:
//   data/quran.json        — 114 surah, 6236 ayat, format ringkas (lihat FORMAT di bawah)
//   data/laporan-data.txt  — daftar ayat yang jumlah katanya berbeda antara kedua sumber
//
// FORMAT data/quran.json
//   surah[]: { n, nama, arab, arti, jml, ayat[] }
//   ayat[]:  { t: teks Tanzil apa adanya,
//              b: 1 bila t diawali basmalah (ayat 1 selain Al-Fatihah dan At-Taubah),
//              a: arti per kata, urut sesuai kata pada t (sesudah basmalah),
//              w: (hanya bila jumlah kata berbeda) teks kata versi Quran.com, sejajar dengan a }
//
// Kata pada t tidak disimpan terpisah: aplikasi memecah t dengan aturan yang
// sama (token berisi huruf Arab = kata; selain itu tanda waqaf/rubu'/sajdah).
//
// Dijalankan oleh GitHub Actions (.github/workflows/siapkan-data.yml) karena
// server GitHub punya akses internet ke kedua sumber. Butuh Node 20+, tanpa dependensi.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const JUMLAH_SURAH = 114;
export const JUMLAH_AYAT = 6236;

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

const KATA_BASMALAH = 4;
const KERANGKA_BASMALAH = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

// Kerangka huruf tanpa harakat dan tanda; alif wasla (ٱ) disamakan dengan alif.
// Dipakai hanya untuk mengenali basmalah, misalnya بِسْمِ dan بِّسْمِ sama-sama "بسم".
export function kerangkaHuruf(token) {
  return token.replace(/ٱ/g, 'ا').replace(/[^ء-ي]/g, '');
}

function diawaliBasmalah(tokenKata) {
  return KERANGKA_BASMALAH.every((k, i) => tokenKata[i] && kerangkaHuruf(tokenKata[i]) === k);
}

// Memasangkan kata Tanzil dengan arti Quran.com untuk satu ayat.
// Pada Tanzil, ayat pertama tiap surah (kecuali Al-Fatihah dan At-Taubah)
// diawali basmalah, sedangkan Quran.com tidak; basmalah ditandai tanpa
// mengubah teks ayat. Bila jumlah kata tetap berbeda, hasil memuat `cocok: false`
// beserta teks kata versi Quran.com agar arti tetap bisa ditampilkan.
export function pasangkanKata({ surah, ayat, teksTanzil, kataQuranCom }) {
  const kataTanzil = teksTanzil.split(/\s+/).filter((t) => t && adalahKata(t));
  const kataSumber = kataQuranCom.filter((k) => k.char_type_name === 'word');

  let basmalah = false;
  let jumlahTanzil = kataTanzil.length;
  if (ayat === 1 && surah !== 1 && surah !== 9 && diawaliBasmalah(kataTanzil)) {
    if (kataTanzil.length - kataSumber.length === KATA_BASMALAH) {
      basmalah = true;
      jumlahTanzil -= KATA_BASMALAH;
    }
  }

  const arti = kataSumber.map((k) => (k.translation?.text ?? '').trim());
  const cocok = jumlahTanzil === kataSumber.length;
  return {
    basmalah,
    arti,
    cocok,
    jumlahTanzil,
    kataSumber: kataSumber.map((k) => k.text_uthmani ?? ''),
  };
}

async function ambilJson(url) {
  for (let percobaan = 1; percobaan <= 4; percobaan++) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.ok) return res.json();
    if (percobaan === 4) throw new Error(`Gagal mengambil ${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000 * percobaan));
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
  if (teksTanzil.size !== JUMLAH_AYAT) {
    throw new Error(`Teks Tanzil tidak lengkap: ${teksTanzil.size} ayat (seharusnya ${JUMLAH_AYAT})`);
  }

  console.log('Mengunduh nama surah…');
  const { chapters } = await ambilJson(`${URL_QURAN_COM}/chapters?language=id`);

  const surahList = [];
  const laporan = [];
  let totalAyat = 0;
  for (let s = 1; s <= JUMLAH_SURAH; s++) {
    const info = chapters.find((c) => c.id === s);
    console.log(`Surah ${s} ${info.name_simple}…`);
    const ayatQc = await ambilSurahQuranCom(s);
    if (ayatQc.length !== info.verses_count) {
      throw new Error(`Surah ${s}: ${ayatQc.length} ayat diterima, seharusnya ${info.verses_count}`);
    }
    const ayatSurah = ayatQc.map((v) => {
      const nomor = v.verse_number;
      const t = teksTanzil.get(`${s}:${nomor}`);
      if (!t) throw new Error(`Ayat ${s}:${nomor} tidak ada di Tanzil`);
      const h = pasangkanKata({ surah: s, ayat: nomor, teksTanzil: t, kataQuranCom: v.words });
      const baris = { t, a: h.arti };
      if (h.basmalah) baris.b = 1;
      if (!h.cocok) {
        baris.w = h.kataSumber;
        laporan.push(
          `${s}:${nomor}\tTanzil ${h.jumlahTanzil} kata, Quran.com ${h.kataSumber.length} kata\n` +
            `  Tanzil   : ${t}\n  Quran.com: ${h.kataSumber.join(' ')}`,
        );
      }
      return baris;
    });
    totalAyat += ayatSurah.length;
    surahList.push({
      n: s,
      nama: info.name_simple,
      arab: info.name_arabic,
      arti: info.translated_name?.name ?? '',
      jml: info.verses_count,
      ayat: ayatSurah,
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  if (totalAyat !== JUMLAH_AYAT) throw new Error(`Total ayat ${totalAyat}, seharusnya ${JUMLAH_AYAT}`);

  const hasil = {
    versi: 2,
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
  await writeFile(path.join(folderData, 'quran.json'), JSON.stringify(hasil) + '\n', 'utf8');
  await writeFile(
    path.join(folderData, 'laporan-data.txt'),
    `Ayat dengan jumlah kata berbeda antara Tanzil dan Quran.com: ${laporan.length}\n\n${laporan.join('\n\n')}\n`,
    'utf8',
  );
  console.log(`Selesai: ${surahList.length} surah, ${totalAyat} ayat; ${laporan.length} ayat berbeda jumlah kata`);
  if (laporan.length) console.log(`::warning::${laporan.length} ayat berbeda jumlah kata; lihat data/laporan-data.txt`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  utama().catch((err) => {
    // Format ::error:: membuat pesan tampil sebagai anotasi di halaman Actions.
    const sebab = err.cause ? ` — ${err.cause.code ?? ''} ${err.cause.message ?? ''}` : '';
    console.log(`::error::${err.message}${sebab}`);
    process.exit(1);
  });
}
