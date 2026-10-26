import Dexie from 'dexie';
import {
  catatHapus,
  db,
  type Hadits,
  type HaditsAyat,
  type HaditsBab,
  type HaditsBagian,
  type HaditsKait,
  type SakuDB,
} from './db';
import { bacaMeta, tulisMeta } from './sinkron/mesin';

// Hadits (K-75, K-76). Data dimuat sekali per perangkat dari berkas pribadi; aplikasi tidak
// membawa data hadits. Dua jenis berkas:
//   versi 1 — saku-hati-hadits.json.gz: satu objek JSON, hanya hadits yang punya rujukan ayat
//   versi 2 — saku-hati-hadits-lengkap.jsonl.gz: baris demi baris (kepala lalu data), 9 kitab
//             lengkap; dimuat bertahap agar tidak menghabiskan memori HP.

export const FORMAT_HADITS = 'saku-hati-hadits';
const VERSI_HADITS = 2;
const KUNCI_META = 'dataHadits';
const UKURAN_BATCH = 1000;

export const URUTAN_KITAB = [
  'bukhari',
  'muslim',
  'abudaud',
  'tirmidzi',
  'nasai',
  'ibnumajah',
  'ahmad',
  'malik',
  'darimi',
];

export interface KitabHadits {
  kode: string;
  nama: string;
  namaArab: string;
  jumlah?: number;
}

export interface InfoDataHadits {
  jenis: 'terkait' | 'lengkap';
  indeks?: { versi: number; kataUmum: string[]; rentang: Record<string, [number, number]> }; // K-78
  jumlahHadits: number;
  jumlahAyat: number;
  kitab: KitabHadits[];
  sumber: string;
  dimuat: string; // ISO
}

export interface Kemajuan {
  tahap: string;
  hadits: number;
  dari: number;
}

interface Kepala {
  format?: string;
  versi?: number;
  jenis?: string;
  penomoranAyat?: string;
  sumber?: string;
  kitab?: KitabHadits[];
  jumlah?: { hadits?: number };
  // versi 1
  hadits?: [string, number, string | null, string, string][];
  rujukan?: [number, number, string, number][];
}

// Penomoran sumber untuk Al-Fatihah memakai hitungan Kufah (basmalah = ayat 1).
// Saku Hati memakai hitungan Madinah (K-26): Alhamdulillah = ayat 1, ayat 6 berakhir
// pada "an'amta 'alaihim", ayat 7 = "ghairil maghdubi 'alaihim wa lad-dhallin".
export function ayatSakuHati(surah: number, ayat: number, penomoran = 'kufah'): number {
  if (surah !== 1 || penomoran !== 'kufah') return ayat;
  if (ayat <= 1) return 1; // basmalah → ayat 1 (basmalah tampil sebagai pembuka)
  if (ayat <= 6) return ayat - 1;
  return 7;
}

const urutKunci = (a: string, b: string) => {
  const [ka, na] = a.split(':');
  const [kb, nb] = b.split(':');
  const ia = URUTAN_KITAB.indexOf(ka);
  const ib = URUTAN_KITAB.indexOf(kb);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || Number(na) - Number(nb);
};

// Membaca berkas (biasa atau .gz) baris demi baris.
async function* bacaBaris(berkas: Blob): AsyncGenerator<string> {
  const awal = new Uint8Array(await berkas.slice(0, 2).arrayBuffer());
  // Tipe aliran disederhanakan: DOM lib TypeScript belum menyelaraskan BufferSource dan Uint8Array.
  let aliran = berkas.stream() as ReadableStream<BufferSource>;
  if (awal[0] === 0x1f && awal[1] === 0x8b)
    aliran = aliran.pipeThrough(new DecompressionStream('gzip')) as ReadableStream<BufferSource>;
  const pembaca = aliran.pipeThrough(new TextDecoderStream()).getReader();
  let sisa = '';
  for (;;) {
    const { value, done } = await pembaca.read();
    if (done) break;
    sisa += value;
    let i: number;
    while ((i = sisa.indexOf('\n')) >= 0) {
      const baris = sisa.slice(0, i);
      sisa = sisa.slice(i + 1);
      if (baris.trim()) yield baris;
    }
  }
  if (sisa.trim()) yield sisa;
}

async function kosongkan(d: SakuDB) {
  await d.transaction(
    'rw',
    [d.hadits, d.haditsAyat, d.haditsBagian, d.haditsBab, d.haditsKait, d.haditsIndeks, d.meta],
    async () => {
      await Promise.all([
        d.haditsIndeks.clear(),
        d.hadits.clear(),
        d.haditsAyat.clear(),
        d.haditsBagian.clear(),
        d.haditsBab.clear(),
        d.haditsKait.clear(),
        d.meta.delete(KUNCI_META),
      ]);
    },
  );
}

function susunAyat(perAyat: Map<string, Set<string>>): HaditsAyat[] {
  return [...perAyat.entries()].map(([kunci, x]) => {
    const [surah, ayat] = kunci.split(':').map(Number);
    return { kunci, surah, ayat, hadits: [...x].sort(urutKunci) };
  });
}

export async function muatDataHadits(
  berkas: Blob,
  d: SakuDB = db,
  kabar?: (k: Kemajuan) => void,
): Promise<InfoDataHadits> {
  const baris = bacaBaris(berkas);
  let kepala: Kepala;
  try {
    const pertama = await baris.next();
    kepala = JSON.parse(pertama.done ? '' : pertama.value);
  } catch {
    throw new Error('Berkas ini bukan data hadits Saku Hati (isinya tidak terbaca).');
  }
  if (!kepala || kepala.format !== FORMAT_HADITS) throw new Error('Berkas ini bukan data hadits Saku Hati.');
  if ((kepala.versi ?? 0) > VERSI_HADITS) throw new Error('Data hadits ini untuk Saku Hati versi yang lebih baru.');
  const penomoran = kepala.penomoranAyat;
  const sumber = kepala.sumber ?? '';

  // ---------- Versi 1: hadits terkait ayat dalam satu objek ----------
  if ((kepala.versi ?? 1) === 1) {
    if (!Array.isArray(kepala.hadits) || !Array.isArray(kepala.rujukan))
      throw new Error('Berkas ini bukan data hadits Saku Hati.');
    const hadits: Hadits[] = kepala.hadits.map(([kitab, nomor, bab, arab, terjemah]) => ({
      kunci: `${kitab}:${nomor}`,
      kitab,
      nomor,
      bab: (bab ?? '').trim(),
      arab,
      terjemah,
    }));
    const ada = new Set(hadits.map((h) => h.kunci));
    const perAyat = new Map<string, Set<string>>();
    for (const [surah, ayatSumber, kitab, nomor] of kepala.rujukan) {
      const k = `${kitab}:${nomor}`;
      if (!ada.has(k)) continue;
      const ka = `${surah}:${ayatSakuHati(surah, ayatSumber, penomoran)}`;
      if (!perAyat.has(ka)) perAyat.set(ka, new Set());
      perAyat.get(ka)!.add(k);
    }
    const ayat = susunAyat(perAyat);
    const info: InfoDataHadits = {
      jenis: 'terkait',
      jumlahHadits: hadits.length,
      jumlahAyat: ayat.length,
      kitab: kepala.kitab ?? [],
      sumber,
      dimuat: new Date().toISOString(),
    };
    await kosongkan(d);
    await d.transaction('rw', d.hadits, d.haditsAyat, d.meta, async () => {
      await d.hadits.bulkPut(hadits);
      await d.haditsAyat.bulkPut(ayat);
      await tulisMeta(d, KUNCI_META, info);
    });
    return info;
  }

  // ---------- Versi 2: lengkap, baris demi baris ----------
  const dari = kepala.jumlah?.hadits ?? 0;
  await kosongkan(d);
  const judulBab = new Map<string, string>();
  const jumlahBagian = new Map<string, number>();
  const jumlahKitab = new Map<string, number>();
  const bagianSemua: HaditsBagian[] = [];
  const perAyat = new Map<string, Set<string>>();
  const kait = new Map<string, HaditsKait>();
  const ambilKait = (k: string) => {
    let x = kait.get(k);
    if (!x) kait.set(k, (x = { kunci: k, padanan: [], ayat: [] }));
    return x;
  };
  const posting = new Map<string, number[]>();
  const rentang: Record<string, [number, number]> = {};
  let batchHadits: Hadits[] = [];
  let batchBab: HaditsBab[] = [];
  let jumlahHadits = 0;
  const simpanBatch = async () => {
    if (batchHadits.length) await d.hadits.bulkPut(batchHadits);
    if (batchBab.length) await d.haditsBab.bulkPut(batchBab);
    batchHadits = [];
    batchBab = [];
    kabar?.({ tahap: 'Memuat hadits', hadits: jumlahHadits, dari });
  };

  for await (const teks of baris) {
    const r = JSON.parse(teks) as [string, ...unknown[]];
    switch (r[0]) {
      case 'g': {
        const [, kitab, id, judulArab, judul] = r as [string, string, number, string, string];
        bagianSemua.push({
          kunci: `${kitab}:${id}`,
          kitab,
          id,
          judul: judul.trim(),
          judulArab: judulArab.trim(),
          jumlah: 0,
        });
        break;
      }
      case 'b': {
        const [, kitab, id, bagian, judulArab, judul] = r as [string, string, number, number, string, string];
        judulBab.set(`${kitab}:${id}`, judul.trim());
        batchBab.push({ kunci: `${kitab}:${id}`, kitab, id, bagian, judul: judul.trim(), judulArab: judulArab.trim() });
        break;
      }
      case 'h': {
        const [, kitab, nomor, bagian, babId, arab, terjemah] = r as [
          string,
          string,
          number,
          number,
          number,
          string,
          string,
        ];
        const urut = jumlahHadits;
        for (const k of new Set([...kataDari(terjemah), ...kataDari(arab)])) {
          let daftar = posting.get(k);
          if (!daftar) posting.set(k, (daftar = []));
          daftar.push(urut);
        }
        const rg = rentang[kitab];
        if (rg) rg[1] = urut;
        else rentang[kitab] = [urut, urut];
        batchHadits.push({
          urut,
          kunci: `${kitab}:${nomor}`,
          kitab,
          nomor,
          bagian,
          babId,
          bab: judulBab.get(`${kitab}:${babId}`) ?? '',
          arab,
          terjemah,
        });
        jumlahHadits++;
        jumlahBagian.set(`${kitab}:${bagian}`, (jumlahBagian.get(`${kitab}:${bagian}`) ?? 0) + 1);
        jumlahKitab.set(kitab, (jumlahKitab.get(kitab) ?? 0) + 1);
        break;
      }
      case 'r': {
        const [, surah, ayatSumber, kitab, nomor] = r as [string, number, number, string, number];
        const k = `${kitab}:${nomor}`;
        const ayat = ayatSakuHati(surah, ayatSumber, penomoran);
        const ka = `${surah}:${ayat}`;
        if (!perAyat.has(ka)) perAyat.set(ka, new Set());
        perAyat.get(ka)!.add(k);
        const x = ambilKait(k);
        if (!x.ayat.includes(ka)) x.ayat.push(ka);
        break;
      }
      case 'p': {
        const [, kitab, nomor, kitabP, nomorP] = r as [string, string, number, string, number];
        const kp = `${kitabP}:${nomorP}`;
        const k = `${kitab}:${nomor}`;
        if (kp !== k) ambilKait(k).padanan.push(kp);
        break;
      }
    }
    if (batchHadits.length + batchBab.length >= UKURAN_BATCH) await simpanBatch();
  }
  await simpanBatch();

  if (jumlahHadits === 0) {
    await kosongkan(d);
    throw new Error('Berkas data hadits tidak berisi hadits.');
  }
  kabar?.({ tahap: 'Menyusun padanan dan ayat terkait', hadits: jumlahHadits, dari });
  for (const b of bagianSemua) b.jumlah = jumlahBagian.get(b.kunci) ?? 0;
  const daftarKait = [...kait.values()].map((x) => ({
    ...x,
    padanan: [...new Set(x.padanan)].sort(urutKunci),
    ayat: x.ayat.sort((a, b) => {
      const [sa, aa] = a.split(':').map(Number);
      const [sb, ab] = b.split(':').map(Number);
      return sa - sb || aa - ab;
    }),
  }));
  await d.haditsBagian.bulkPut(bagianSemua);
  for (let i = 0; i < daftarKait.length; i += 5000) await d.haditsKait.bulkPut(daftarKait.slice(i, i + 5000));
  const ayat = susunAyat(perAyat);
  await d.haditsAyat.bulkPut(ayat);

  // K-78: indeks pencarian; kata yang ada di lebih dari separuh hadits tidak diindeks.
  kabar?.({ tahap: 'Menyusun indeks pencarian', hadits: jumlahHadits, dari });
  const kataUmum: string[] = [];
  let batchIndeks: { kata: string; urut: Uint32Array }[] = [];
  for (const [kata, daftar] of posting) {
    if (daftar.length > jumlahHadits / 2) kataUmum.push(kata);
    else batchIndeks.push({ kata, urut: Uint32Array.from(daftar) });
    if (batchIndeks.length >= 5000) {
      await d.haditsIndeks.bulkPut(batchIndeks);
      batchIndeks = [];
    }
  }
  if (batchIndeks.length) await d.haditsIndeks.bulkPut(batchIndeks);
  posting.clear();

  const info: InfoDataHadits = {
    jenis: 'lengkap',
    indeks: { versi: 1, kataUmum: kataUmum.sort(), rentang },
    jumlahHadits,
    jumlahAyat: ayat.length,
    kitab: (kepala.kitab ?? []).map((k) => ({ ...k, jumlah: jumlahKitab.get(k.kode) ?? 0 })),
    sumber,
    dimuat: new Date().toISOString(),
  };
  await tulisMeta(d, KUNCI_META, info);
  return info;
}

export async function hapusDataHadits(d: SakuDB = db) {
  await kosongkan(d);
}

export const infoDataHadits = (d: SakuDB = db) => bacaMeta<InfoDataHadits>(d, KUNCI_META);

export function namaKitab(info: InfoDataHadits | undefined | null, kode: string): string {
  return info?.kitab.find((k) => k.kode === kode)?.nama ?? kode;
}

// ---------- Hadits terkait ayat ----------

export async function haditsSurah(surah: number, d: SakuDB = db): Promise<Map<number, string[]>> {
  const [daftar, manual] = await Promise.all([
    d.haditsAyat.where('surah').equals(surah).toArray(),
    d.kaitanAyatHadits.where('surah').equals(surah).toArray(),
  ]);
  const peta = new Map(daftar.map((x) => [x.ayat, [...x.hadits]]));
  // K-79: kaitan manual ikut tampil (didahulukan).
  for (const k of manual.sort((a, b) => urutKunci(a.hadits, b.hadits))) {
    const ada = peta.get(k.ayat) ?? [];
    if (!ada.includes(k.hadits)) peta.set(k.ayat, [k.hadits, ...ada]);
  }
  return peta;
}

export async function ambilHadits(kunci: string[], d: SakuDB = db): Promise<Hadits[]> {
  return (await d.hadits.bulkGet(kunci)).filter((h): h is Hadits => !!h);
}

// ---------- Jelajah (K-76) ----------

export async function daftarBagian(kitab: string, d: SakuDB = db): Promise<HaditsBagian[]> {
  return (await d.haditsBagian.where('kitab').equals(kitab).toArray()).sort((a, b) => a.id - b.id);
}

export async function ambilBagian(kitab: string, id: number, d: SakuDB = db) {
  return d.haditsBagian.get(`${kitab}:${id}`);
}

// Hadits dalam satu bagian, urut nomor, per halaman.
export async function haditsBagian(
  kitab: string,
  bagian: number,
  mulai: number,
  jumlah: number,
  d: SakuDB = db,
): Promise<Hadits[]> {
  return d.hadits
    .where('[kitab+bagian+nomor]')
    .between([kitab, bagian, Dexie.minKey], [kitab, bagian, Dexie.maxKey])
    .offset(mulai)
    .limit(jumlah)
    .toArray();
}

export async function ambilSatuHadits(kitab: string, nomor: number, d: SakuDB = db) {
  return d.hadits.get(`${kitab}:${nomor}`);
}

export async function ambilKait(kunci: string, d: SakuDB = db) {
  return d.haditsKait.get(kunci);
}

export async function ambilBab(kitab: string, id: number | undefined, d: SakuDB = db) {
  return id === undefined ? undefined : d.haditsBab.get(`${kitab}:${id}`);
}

// ---------- Suntingan terjemah (K-77) ----------

export async function ambilSuntingan(kunci: string[], d: SakuDB = db): Promise<Map<string, string>> {
  const ada = await d.maknaHadits.bulkGet(kunci);
  return new Map(ada.filter((x): x is NonNullable<typeof x> => !!x).map((x) => [x.kunci, x.isi]));
}

// Isi kosong atau sama dengan terjemah asli → suntingan dihapus (kembali ke asli).
export async function simpanSuntingan(kitab: string, nomor: number, isi: string, asli: string, d: SakuDB = db) {
  const kunci = `${kitab}:${nomor}`;
  const bersih = isi.trim();
  if (!bersih || bersih === asli.trim())
    return d.transaction('rw', d.maknaHadits, d.hapus, async () => {
      if (await d.maknaHadits.get(kunci)) {
        await d.maknaHadits.delete(kunci);
        await catatHapus(d, 'maknaHadits', [kunci]);
      }
    });
  await d.maknaHadits.put({ kunci, kitab, nomor, isi: bersih, diubah: new Date().toISOString() });
}

// ---------- Pencarian (K-78) ----------

const HARAKAT = /[ً-ٰٟۖ-ۭـ]/g;

// Arab tanpa harakat; alif disamakan, ى→ي, ة→ه.
export function arabPolos(teks: string): string {
  return teks
    .replace(HARAKAT, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function normal(teks: string): string {
  return arabPolos(teks.toLowerCase().replace(/['’`‘]/g, ''));
}

export function kataDari(teks: string): string[] {
  return normal(teks).match(/[a-z0-9]+|[ء-ي]+/g) ?? [];
}

export const adaArab = (teks: string) => /[؀-ۿ]/.test(teks);

export interface HasilCari {
  urut: number[]; // urutan hadits yang cocok, naik
  kataDipakai: string[];
  kataDiabaikan: string[];
}

function irisan(a: Uint32Array | number[], b: Uint32Array | number[]): number[] {
  const hasil: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      hasil.push(a[i]);
      i++;
      j++;
    } else if (a[i] < b[j]) i++;
    else j++;
  }
  return hasil;
}

async function postingKata(kata: string, d: SakuDB): Promise<number[]> {
  // Kata pendek dicocokkan utuh; 3 huruf atau lebih juga sebagai awalan.
  const baris =
    kata.length >= 3
      ? await d.haditsIndeks.where('kata').startsWith(kata).limit(200).toArray()
      : await d.haditsIndeks.where('kata').equals(kata).toArray();
  if (baris.length === 1) return Array.from(baris[0].urut);
  const gabung = new Set<number>();
  for (const b of baris) for (const u of b.urut) gabung.add(u);
  return [...gabung].sort((x, y) => x - y);
}

export async function cariHadits(
  teks: string,
  kitab: string | null,
  info: InfoDataHadits,
  d: SakuDB = db,
): Promise<HasilCari> {
  const umum = new Set(info.indeks?.kataUmum ?? []);
  const semua = [...new Set(kataDari(teks))];
  const kataDipakai = semua.filter((k) => !umum.has(k));
  const kataDiabaikan = semua.filter((k) => umum.has(k));
  if (!kataDipakai.length) return { urut: [], kataDipakai, kataDiabaikan };

  let hasil: number[] | null = null;
  for (const k of kataDipakai) {
    const p = await postingKata(k, d);
    hasil = hasil === null ? p : irisan(hasil, p);
    if (!hasil.length) break;
  }
  const cocok = new Set(hasil ?? []);

  // Suntingan terjemah sendiri ikut dicari (jumlahnya kecil, disaring langsung).
  const sunting = await d.maknaHadits.toArray();
  for (const s of sunting) {
    const isi = normal(s.isi);
    if (kataDipakai.every((k) => new RegExp(`(^|[^a-z0-9\\u0621-\\u064A])${k}`).test(isi))) {
      const h = await d.hadits.get(s.kunci);
      if (h?.urut !== undefined) cocok.add(h.urut);
    }
  }

  let urut = [...cocok].sort((a, b) => a - b);
  const rg = kitab ? info.indeks?.rentang[kitab] : null;
  if (rg) urut = urut.filter((u) => u >= rg[0] && u <= rg[1]);
  return { urut, kataDipakai, kataDiabaikan };
}

export async function haditsMenurutUrut(urut: number[], d: SakuDB = db): Promise<Hadits[]> {
  const daftar = await d.hadits.where('urut').anyOf(urut).toArray();
  return daftar.sort((a, b) => (a.urut ?? 0) - (b.urut ?? 0));
}

export interface Potongan {
  teks: string;
  tebal: boolean;
}

// Cuplikan di sekitar kata pertama yang cocok, dengan kata-kata yang cocok ditebalkan.
export function cuplikan(teks: string, kata: string[], panjang = 220): Potongan[] {
  const arab = kata.some(adaArab);
  // Arab: tampil tanpa harakat saja; huruf yang disamakan (alif, ى, ة) hanya dipakai untuk mencocokkan.
  // Penggantian itu satu huruf untuk satu huruf, sehingga posisi pada kedua teks sama.
  const tampil = arab ? teks.replace(HARAKAT, '') : teks;
  const banding = arab ? arabPolos(tampil) : tampil.toLowerCase();
  if (!kata.length) return [{ teks: tampil.slice(0, panjang), tebal: false }];
  const pola = new RegExp(
    `(${kata
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|')})[a-z0-9\\u0621-\\u064A]*`,
    'g',
  );
  const pertama = pola.exec(banding);
  const awal = Math.max(0, (pertama?.index ?? 0) - 60);
  const akhirPotong = Math.min(tampil.length, awal + panjang);
  const hasil: Potongan[] = [];
  if (awal > 0) hasil.push({ teks: '…', tebal: false });
  let posisi = awal;
  pola.lastIndex = awal;
  for (let m: RegExpExecArray | null; (m = pola.exec(banding)) && m.index < akhirPotong;) {
    if (m[0].length === 0) {
      pola.lastIndex++;
      continue;
    }
    const ujung = Math.min(m.index + m[0].length, akhirPotong);
    if (m.index > posisi) hasil.push({ teks: tampil.slice(posisi, m.index), tebal: false });
    hasil.push({ teks: tampil.slice(m.index, ujung), tebal: true });
    posisi = ujung;
  }
  if (posisi < akhirPotong) hasil.push({ teks: tampil.slice(posisi, akhirPotong), tebal: false });
  if (akhirPotong < tampil.length) hasil.push({ teks: '…', tebal: false });
  return hasil;
}

// ---------- Simpan, catatan, kaitan manual (K-79) ----------

const pecah = (kunci: string) => {
  const [kitab, n] = kunci.split(':');
  return { kitab, nomor: Number(n) };
};

export async function apakahDisimpan(kunci: string, d: SakuDB = db) {
  return !!(await d.haditsSimpan.get(kunci));
}

// Mengembalikan status baru (true = tersimpan).
export async function ubahSimpan(kunci: string, d: SakuDB = db): Promise<boolean> {
  return d.transaction('rw', d.haditsSimpan, d.hapus, async () => {
    if (await d.haditsSimpan.get(kunci)) {
      await d.haditsSimpan.delete(kunci);
      await catatHapus(d, 'haditsSimpan', [kunci]);
      return false;
    }
    await d.haditsSimpan.put({ kunci, ...pecah(kunci), disimpan: new Date().toISOString() });
    return true;
  });
}

export async function ambilCatatanHadits(kunci: string, d: SakuDB = db) {
  return (await d.catatanHadits.get(kunci))?.isi;
}

export async function simpanCatatanHadits(kunci: string, isi: string, d: SakuDB = db) {
  const bersih = isi.trim();
  if (!bersih)
    return d.transaction('rw', d.catatanHadits, d.hapus, async () => {
      if (await d.catatanHadits.get(kunci)) {
        await d.catatanHadits.delete(kunci);
        await catatHapus(d, 'catatanHadits', [kunci]);
      }
    });
  await d.catatanHadits.put({ kunci, ...pecah(kunci), isi: bersih, diubah: new Date().toISOString() });
}

export async function kaitanManual(hadits: string, d: SakuDB = db): Promise<string[]> {
  const daftar = await d.kaitanAyatHadits.where('hadits').equals(hadits).toArray();
  return daftar.sort((a, b) => a.surah - b.surah || a.ayat - b.ayat).map((k) => `${k.surah}:${k.ayat}`);
}

export async function tambahKaitan(surah: number, ayat: number, hadits: string, d: SakuDB = db) {
  await d.kaitanAyatHadits.put({
    kunci: `${surah}:${ayat}|${hadits}`,
    surah,
    ayat,
    hadits,
    dibuat: new Date().toISOString(),
  });
}

export async function hapusKaitan(surah: number, ayat: number, hadits: string, d: SakuDB = db) {
  const kunci = `${surah}:${ayat}|${hadits}`;
  await d.transaction('rw', d.kaitanAyatHadits, d.hapus, async () => {
    await d.kaitanAyatHadits.delete(kunci);
    await catatHapus(d, 'kaitanAyatHadits', [kunci]);
  });
}

export interface ButirTersimpan {
  kunci: string;
  disimpan: boolean;
  catatan?: string;
  waktu: string;
}

// Hadits yang disimpan dan/atau punya catatan, terbaru dulu.
export async function daftarTersimpan(d: SakuDB = db): Promise<ButirTersimpan[]> {
  const [simpan, catatan] = await Promise.all([d.haditsSimpan.toArray(), d.catatanHadits.toArray()]);
  const peta = new Map<string, ButirTersimpan>();
  for (const s of simpan) peta.set(s.kunci, { kunci: s.kunci, disimpan: true, waktu: s.disimpan });
  for (const c of catatan) {
    const ada = peta.get(c.kunci);
    if (ada) {
      ada.catatan = c.isi;
      if (c.diubah > ada.waktu) ada.waktu = c.diubah;
    } else peta.set(c.kunci, { kunci: c.kunci, disimpan: false, catatan: c.isi, waktu: c.diubah });
  }
  return [...peta.values()].sort((a, b) => b.waktu.localeCompare(a.waktu));
}

// Hadits hari ini: dipilih dari tanggal sehingga sama di semua perangkat.
export async function haditsHariIni(info: InfoDataHadits, tanggal = new Date(), d: SakuDB = db) {
  if (!info.indeks || !info.jumlahHadits) return undefined;
  const hari = Math.floor(Date.UTC(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate()) / 86400000);
  const urut = (hari * 7919) % info.jumlahHadits;
  return d.hadits.where('urut').equals(urut).first();
}
