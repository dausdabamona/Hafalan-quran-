import Dexie from 'dexie';
import {
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
  await d.transaction('rw', [d.hadits, d.haditsAyat, d.haditsBagian, d.haditsBab, d.haditsKait, d.meta], async () => {
    await Promise.all([
      d.hadits.clear(),
      d.haditsAyat.clear(),
      d.haditsBagian.clear(),
      d.haditsBab.clear(),
      d.haditsKait.clear(),
      d.meta.delete(KUNCI_META),
    ]);
  });
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
        batchHadits.push({
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

  const info: InfoDataHadits = {
    jenis: 'lengkap',
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
  const daftar = await d.haditsAyat.where('surah').equals(surah).toArray();
  return new Map(daftar.map((x) => [x.ayat, x.hadits]));
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
