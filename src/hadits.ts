import { db, type Hadits, type SakuDB } from './db';
import { bacaMeta, tulisMeta } from './sinkron/mesin';

// Hadits terkait ayat (K-75). Data dimuat sekali per perangkat dari berkas pribadi
// saku-hati-hadits.json(.gz); aplikasi tidak membawa data hadits.

export const FORMAT_HADITS = 'saku-hati-hadits';
const VERSI_HADITS = 1;
const KUNCI_META = 'dataHadits';

export interface KitabHadits {
  kode: string;
  nama: string;
  namaArab: string;
}

export interface InfoDataHadits {
  jumlahHadits: number;
  jumlahAyat: number;
  kitab: KitabHadits[];
  sumber: string;
  dimuat: string; // ISO
}

interface IsiBerkas {
  format?: string;
  versi?: number;
  penomoranAyat?: string;
  sumber?: string;
  kitab?: KitabHadits[];
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

async function bacaTeks(berkas: Blob): Promise<string> {
  const awal = new Uint8Array(await berkas.slice(0, 2).arrayBuffer());
  if (awal[0] === 0x1f && awal[1] === 0x8b) {
    // Berkas .gz dibuka langsung di perangkat.
    const aliran = berkas.stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(aliran).text();
  }
  return berkas.text();
}

export async function muatDataHadits(berkas: Blob, d: SakuDB = db): Promise<InfoDataHadits> {
  let isi: IsiBerkas;
  try {
    isi = JSON.parse(await bacaTeks(berkas));
  } catch {
    throw new Error('Berkas ini bukan data hadits Saku Hati (isinya tidak terbaca).');
  }
  if (!isi || isi.format !== FORMAT_HADITS || !Array.isArray(isi.hadits) || !Array.isArray(isi.rujukan))
    throw new Error('Berkas ini bukan data hadits Saku Hati.');
  if ((isi.versi ?? 0) > VERSI_HADITS) throw new Error('Data hadits ini untuk Saku Hati versi yang lebih baru.');

  const hadits: Hadits[] = isi.hadits.map(([kitab, nomor, bab, arab, terjemah]) => ({
    kunci: `${kitab}:${nomor}`,
    kitab,
    nomor,
    bab: (bab ?? '').trim(),
    arab,
    terjemah,
  }));
  const ada = new Set(hadits.map((h) => h.kunci));
  const urutKitab = new Map((isi.kitab ?? []).map((k, i) => [k.kode, i]));
  const perAyat = new Map<string, { surah: number; ayat: number; hadits: Set<string> }>();
  for (const [surah, ayatSumber, kitab, nomor] of isi.rujukan) {
    const kunciHadits = `${kitab}:${nomor}`;
    if (!ada.has(kunciHadits)) continue;
    const ayat = ayatSakuHati(surah, ayatSumber, isi.penomoranAyat);
    const k = `${surah}:${ayat}`;
    if (!perAyat.has(k)) perAyat.set(k, { surah, ayat, hadits: new Set() });
    perAyat.get(k)!.hadits.add(kunciHadits);
  }
  const urut = (a: string, b: string) => {
    const [ka, na] = a.split(':');
    const [kb, nb] = b.split(':');
    return (urutKitab.get(ka) ?? 99) - (urutKitab.get(kb) ?? 99) || Number(na) - Number(nb);
  };
  const ayat = [...perAyat.entries()].map(([kunci, x]) => ({
    kunci,
    surah: x.surah,
    ayat: x.ayat,
    hadits: [...x.hadits].sort(urut),
  }));

  const info: InfoDataHadits = {
    jumlahHadits: hadits.length,
    jumlahAyat: ayat.length,
    kitab: isi.kitab ?? [],
    sumber: isi.sumber ?? '',
    dimuat: new Date().toISOString(),
  };
  await d.transaction('rw', d.hadits, d.haditsAyat, d.meta, async () => {
    await d.hadits.clear();
    await d.haditsAyat.clear();
    await d.hadits.bulkPut(hadits);
    await d.haditsAyat.bulkPut(ayat);
    await tulisMeta(d, KUNCI_META, info);
  });
  return info;
}

export async function hapusDataHadits(d: SakuDB = db) {
  await d.transaction('rw', d.hadits, d.haditsAyat, d.meta, async () => {
    await d.hadits.clear();
    await d.haditsAyat.clear();
    await d.meta.delete(KUNCI_META);
  });
}

export const infoDataHadits = (d: SakuDB = db) => bacaMeta<InfoDataHadits>(d, KUNCI_META);

// Jumlah/daftar hadits per ayat untuk satu surah.
export async function haditsSurah(surah: number, d: SakuDB = db): Promise<Map<number, string[]>> {
  const daftar = await d.haditsAyat.where('surah').equals(surah).toArray();
  return new Map(daftar.map((x) => [x.ayat, x.hadits]));
}

export async function ambilHadits(kunci: string[], d: SakuDB = db): Promise<Hadits[]> {
  return (await d.hadits.bulkGet(kunci)).filter((h): h is Hadits => !!h);
}
