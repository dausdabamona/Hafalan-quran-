import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { cariAyat, rukukAyat } from './data';
import { petaAyatFatihah, petaKataFatihah, petaRentangFatihah } from './fatihah';
import {
  ayatPerbaikan,
  hariIni,
  migrasiJadwalLama,
  mulaiPerbaikan,
  mutuMurojaah,
  setelahPerbaikan,
  turunSatuTingkat,
  setelahKoreksiPotongan,
  setelahMurojaahRukuk,
  turunkanJadwal,
  batalkanAyatLama,
  batalkanLama,
  tandaiAyatLama,
  tandaiLama,
  type EntriHafalan,
  type EntriJadwal,
  type EntriPerbaikan,
  type JadwalPotonganLama,
  type MutuMurojaah,
} from './jadwal';

// Keterangan pribadi (K-19). urutan = 0 berarti keterangan untuk satu ayat;
// urutan >= 1 berarti keterangan untuk kata ke-n pada ayat itu.
export interface Keterangan {
  kunci: string; // "surah:ayat:urutan"
  surah: number;
  ayat: number;
  urutan: number;
  isi: string;
  diubah: string; // ISO
}

// Makna potongan waqaf yang diedit sendiri (K-25).
export interface Makna {
  kunci: string; // "surah:ayat:segmen"
  surah: number;
  ayat: number;
  segmen: number;
  isi: string;
  diubah: string;
}

// Rekaman murojaah per ayat (K-12): satu baris per ayat, rekaman baru menimpa yang lama.
export interface Rekaman {
  kunci: string; // "surah:ayat"
  surah: number;
  ayat: number;
  audio: Blob;
  durasiMs: number;
  direkam: string; // ISO
}

// Tanda kata salah (K-13): permanen, hanya hilang bila dihapus manual.
export interface TandaSalah {
  kunci: string; // "surah:ayat:urutan"
  surah: number;
  ayat: number;
  urutan: number;
  pertama: string;
  terakhir: string;
  jumlah: number;
  benarBeruntun?: number; // koreksi berturut-turut yang benar sejak salah terakhir (K-57)
}

// Tanda urutan tertukar (K-15): dipasang pada sambungan sesudah ayatAsal.
export interface TandaTertukar {
  kunci: string; // "surah:ayatAsal"
  surah: number;
  ayatAsal: number;
  ayatKeliru: number; // 0 = tidak yakin ayat mana
  pertama: string;
  terakhir: string;
  jumlah: number;
}

// Tanda latihan tebak ayat dari arti (K-41): ayat yang pernah salah ditebak didahulukan
// sampai berhasil ditebak benar. Tidak memengaruhi jadwal murojaah.
export interface TandaArti {
  kunci: string; // "surah:ayat"
  surah: number;
  ayat: number;
  jumlah: number; // berapa kali salah ditebak
  pertama: string; // ISO salah pertama
  terakhir: string; // ISO salah terakhir
  benar?: string; // ISO tebakan benar terakhir
}

// Satu kali koreksi (potongan) atau murojaah (rukuk).
export interface Sesi {
  id?: number;
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  rukuk?: number;
  ayat?: number[]; // ayat yang benar-benar dikoreksi bila tidak berurutan (K-30)
  tanggal: string; // ISO
  kataSalah: number;
  sambunganTertukar: number;
  lancar: boolean; // P-01
  perbaikan?: boolean; // sesi "Perbaiki ayat" (K-62); tidak dihitung sebagai murojaah rukuk
}

// Setelan yang ikut sinkron (K-73): target hafalan dan catatan warna per hari.
export interface Setelan {
  kunci: string; // 'target' | 'catatanHari'
  nilai: unknown;
}

// Hadits terkait ayat (K-75). Dimuat dari berkas pribadi; tidak ikut sinkron maupun cadangan.
export interface Hadits {
  kunci: string; // "bukhari:740"
  kitab: string;
  nomor: number;
  bab: string; // judul bab (Indonesia)
  bagian?: number; // data lengkap (K-76)
  urut?: number; // nomor urut seluruh data, untuk indeks pencarian (K-78)
  babId?: number;
  arab: string;
  terjemah: string;
}

// K-76: bagian (kitab-kitab kecil) dan bab dalam satu kitab hadits.
export interface HaditsBagian {
  kunci: string; // "bukhari:2"
  kitab: string;
  id: number;
  judul: string;
  judulArab: string;
  jumlah: number;
}

export interface HaditsBab {
  kunci: string; // "bukhari:15"
  kitab: string;
  id: number;
  bagian: number;
  judul: string;
  judulArab: string;
}

// K-79: hadits yang disimpan, catatan hadits, dan kaitan manual ayat ↔ hadits. Ikut sinkron.
export interface HaditsSimpan {
  kunci: string; // kunci hadits "bukhari:1"
  kitab: string;
  nomor: number;
  disimpan: string;
}

export interface CatatanHadits {
  kunci: string; // kunci hadits
  kitab: string;
  nomor: number;
  isi: string;
  diubah: string;
}

export interface KaitanAyatHadits {
  kunci: string; // "surah:ayat|kitab:nomor"
  surah: number;
  ayat: number;
  hadits: string;
  dibuat: string;
}

// K-78: indeks pencarian — satu kata → urutan hadits yang memuatnya (urut naik).
export interface HaditsIndeks {
  kata: string;
  urut: Uint32Array;
}

// K-77: terjemah hadits yang disunting sendiri. Ikut sinkron dan cadangan.
export interface MaknaHadits {
  kunci: string; // "bukhari:740"
  kitab: string;
  nomor: number;
  isi: string;
  diubah: string;
}

// K-76: padanan antarkitab dan ayat terkait untuk satu hadits.
export interface HaditsKait {
  kunci: string; // kunci hadits
  padanan: string[];
  ayat: string[]; // "surah:ayat" (penomoran Saku Hati)
}

export interface HaditsAyat {
  kunci: string; // "surah:ayat" (penomoran Saku Hati)
  surah: number;
  ayat: number;
  hadits: string[]; // kunci hadits, urut kitab lalu nomor
}

export type SakuDB = Dexie & {
  keterangan: EntityTable<Keterangan, 'kunci'>;
  makna: EntityTable<Makna, 'kunci'>;
  rekaman: EntityTable<Rekaman, 'kunci'>;
  tandaSalah: EntityTable<TandaSalah, 'kunci'>;
  tandaTertukar: EntityTable<TandaTertukar, 'kunci'>;
  tandaArti: EntityTable<TandaArti, 'kunci'>;
  sesi: EntityTable<Sesi, 'id'>;
  hafalan: EntityTable<EntriHafalan, 'kunci'>;
  jadwalRukuk: EntityTable<EntriJadwal, 'nomor'>;
  perbaikan: EntityTable<EntriPerbaikan, 'kunci'>;
  hapus: EntityTable<Penghapusan, 'kunci'>;
  setelan: EntityTable<Setelan, 'kunci'>;
  hadits: EntityTable<Hadits, 'kunci'>;
  haditsAyat: EntityTable<HaditsAyat, 'kunci'>;
  haditsBagian: EntityTable<HaditsBagian, 'kunci'>;
  haditsBab: EntityTable<HaditsBab, 'kunci'>;
  haditsKait: EntityTable<HaditsKait, 'kunci'>;
  maknaHadits: EntityTable<MaknaHadits, 'kunci'>;
  haditsIndeks: EntityTable<HaditsIndeks, 'kata'>;
  haditsSimpan: EntityTable<HaditsSimpan, 'kunci'>;
  catatanHadits: EntityTable<CatatanHadits, 'kunci'>;
  kaitanAyatHadits: EntityTable<KaitanAyatHadits, 'kunci'>;
  meta: EntityTable<{ kunci: string; nilai: unknown }, 'kunci'>;
  /** true selama perubahan dari perangkat lain diterapkan (penanda waktu tidak diubah) */
  _terapkan?: boolean;
};

function siapkanSkema(db: SakuDB) {
  db.version(1).stores({ keterangan: 'kunci, surah, [surah+ayat]' });
  db.version(2).stores({
    rekaman: 'kunci, surah',
    tandaSalah: 'kunci, surah',
    tandaTertukar: 'kunci, surah',
    sesi: '++id, surah, tanggal',
  });
  db.version(3).stores({ jadwal: 'kunci, surah, jatuhTempo, mulai' });
  db.version(4).stores({ deres: 'nomor, terakhir' });
  // Versi 5 (30 juz, K-23): jadwal per potongan dipindah ke hafalan + jadwal per rukuk.
  db.version(5)
    .stores({
      makna: 'kunci, surah, [surah+ayat]',
      hafalan: 'kunci, surah, mulai',
      jadwalRukuk: 'nomor, jatuhTempo',
    })
    .upgrade(async (tx: Transaction) => {
      const lama = (await tx.table('jadwal').toArray()) as JadwalPotonganLama[];
      const { hafalan, jadwal } = migrasiJadwalLama(lama);
      await tx.table('hafalan').bulkPut(hafalan);
      await tx.table('jadwalRukuk').bulkPut(jadwal);
    });
  db.version(6).stores({ jadwal: null, deres: null });
  // Versi 7 (K-26): data Al-Fatihah dipindah ke hitungan Madinah (Alhamdulillah = ayat 1).
  db.version(7).upgrade(async (tx: Transaction) => {
    // Catatan & tanda per kata: kunci "1:ayat:urutan".
    for (const nama of ['keterangan', 'tandaSalah']) {
      const t = tx.table(nama);
      const lama = await t.where('surah').equals(1).toArray();
      await t.bulkDelete(lama.map((x) => x.kunci));
      const baru = new Map<string, Record<string, unknown>>();
      for (const x of lama) {
        const p = petaKataFatihah(x.ayat, x.urutan);
        if (!p) continue;
        const kunci = `1:${p.ayat}:${p.urutan}`;
        // Keterangan ayat lama 7 (urutan 0) hanya pindah ke ayat 6; tanda tidak bertabrakan.
        if (!baru.has(kunci)) baru.set(kunci, { ...x, kunci, ayat: p.ayat, urutan: p.urutan });
      }
      await t.bulkPut([...baru.values()]);
    }
    // Makna waqaf yang disunting: ayat lama 7 tidak lagi cocok dengan potongannya, jadi dilepas.
    const makna = await tx.table('makna').where('surah').equals(1).toArray();
    await tx.table('makna').bulkDelete(makna.map((x) => x.kunci));
    await tx
      .table('makna')
      .bulkPut(
        makna
          .filter((x) => x.ayat >= 2 && x.ayat <= 6)
          .map((x) => ({ ...x, kunci: `1:${x.ayat - 1}:${x.segmen}`, ayat: x.ayat - 1 })),
      );
    // Rekaman per ayat: basmalah dilepas; rekaman ayat lama 7 menjadi rekaman ayat 6.
    const rekaman = await tx.table('rekaman').where('surah').equals(1).toArray();
    await tx.table('rekaman').bulkDelete(rekaman.map((x) => x.kunci));
    await tx.table('rekaman').bulkPut(
      rekaman.flatMap((x) => {
        const a = petaAyatFatihah(x.ayat);
        return a ? [{ ...x, kunci: `1:${a}`, ayat: a }] : [];
      }),
    );
    // Sambungan tertukar: sambungan basmalah → Alhamdulillah dilepas.
    const tukar = await tx.table('tandaTertukar').where('surah').equals(1).toArray();
    await tx.table('tandaTertukar').bulkDelete(tukar.map((x) => x.kunci));
    await tx.table('tandaTertukar').bulkPut(
      tukar.flatMap((x) => {
        if (x.ayatAsal < 2 || x.ayatAsal > 6) return [];
        const asal = x.ayatAsal - 1;
        return [
          {
            ...x,
            kunci: `1:${asal}`,
            ayatAsal: asal,
            ayatKeliru: x.ayatKeliru ? (petaAyatFatihah(x.ayatKeliru) ?? 0) : 0,
          },
        ];
      }),
    );
    // Hafalan dan riwayat sesi: rentang ayat digeser.
    const hafalan = await tx.table('hafalan').where('surah').equals(1).toArray();
    await tx.table('hafalan').bulkDelete(hafalan.map((x) => x.kunci));
    const hafalanBaru = new Map<string, EntriHafalan>();
    for (const x of hafalan as EntriHafalan[]) {
      const r = petaRentangFatihah(x.ayatAwal, x.ayatAkhir);
      if (!r) continue;
      const kunci = `1:${r.awal}-${r.akhir}`;
      hafalanBaru.set(kunci, { ...x, kunci, ayatAwal: r.awal, ayatAkhir: r.akhir });
    }
    await tx.table('hafalan').bulkPut([...hafalanBaru.values()]);
    await tx
      .table('sesi')
      .where('surah')
      .equals(1)
      .modify((x: Sesi) => {
        const r = petaRentangFatihah(x.ayatAwal, x.ayatAkhir) ?? { awal: 1, akhir: 1 };
        x.ayatAwal = r.awal;
        x.ayatAkhir = r.akhir;
      });
  });

  // Versi 8 (K-37): penanda sinkron di setiap tabel. ubahMs = waktu perubahan oleh penulisnya
  // (dipakai untuk menentukan yang terbaru), terimaMs = waktu diterima di perangkat ini (dipakai
  // untuk mencari perubahan sejak sinkron terakhir), asal = '' bila dibuat di perangkat ini.
  db.version(8)
    .stores({
      keterangan: 'kunci, surah, [surah+ayat], terimaMs',
      makna: 'kunci, surah, [surah+ayat], terimaMs',
      rekaman: 'kunci, surah, terimaMs',
      tandaSalah: 'kunci, surah, terimaMs',
      tandaTertukar: 'kunci, surah, terimaMs',
      sesi: '++id, surah, tanggal, uid, terimaMs',
      hafalan: 'kunci, surah, mulai, terimaMs',
      jadwalRukuk: 'nomor, jatuhTempo, terimaMs',
      hapus: 'kunci, terimaMs',
      meta: 'kunci',
    })
    .upgrade(async (tx: Transaction) => {
      const sekarang = Date.now();
      const waktu = (...isi: unknown[]) => {
        for (const x of isi) {
          const t = typeof x === 'string' ? Date.parse(x) : NaN;
          if (!Number.isNaN(t)) return t;
        }
        return sekarang;
      };
      for (const nama of TABEL_SINKRON) {
        await tx
          .table(nama)
          .toCollection()
          .modify((x: Record<string, unknown>) => {
            x.ubahMs = waktu(x.diubah, x.direkam, x.terakhir, x.tanggal);
            x.terimaMs = sekarang;
            x.asal = '';
            if (nama === 'sesi' && !x.uid) x.uid = idAcak();
          });
      }
    });

  // Versi 9 (K-41): tanda latihan tebak ayat dari arti.
  db.version(9).stores({ tandaArti: 'kunci, surah, terimaMs' });

  // Versi 10 (K-62): ayat yang perlu diperbaiki sesudah kesalahan kecil saat murojaah.
  db.version(10).stores({ perbaikan: 'kunci, surah, jatuhTempo, terimaMs' });

  // Versi 11 (K-73): target dan catatan hari pindah dari meta (lokal) ke tabel setelan (ikut sinkron).
  db.version(11)
    .stores({ setelan: 'kunci, terimaMs' })
    .upgrade(async (tx: Transaction) => {
      const kini = Date.now();
      for (const kunci of ['target', 'catatanHari']) {
        const lama = (await tx.table('meta').get(kunci)) as { nilai: unknown } | undefined;
        if (lama && lama.nilai !== undefined && lama.nilai !== null)
          await tx.table('setelan').put({ kunci, nilai: lama.nilai, ubahMs: kini, terimaMs: kini, asal: '' });
      }
    });

  // Versi 12 (K-75): hadits terkait ayat, khusus perangkat ini.
  db.version(12).stores({ hadits: 'kunci, kitab', haditsAyat: 'kunci, surah' });

  // Versi 13 (K-76): hadits lengkap — bagian, bab, padanan, dan urutan per bagian.
  db.version(13).stores({
    hadits: 'kunci, kitab, [kitab+bagian+nomor]',
    haditsBagian: 'kunci, kitab',
    haditsBab: 'kunci, kitab',
    haditsKait: 'kunci',
  });

  // Versi 14 (K-77): suntingan terjemah hadits, ikut sinkron.
  db.version(14).stores({ maknaHadits: 'kunci, kitab, terimaMs' });

  // Versi 15 (K-78): indeks pencarian hadits.
  db.version(15).stores({ hadits: 'kunci, kitab, [kitab+bagian+nomor], urut', haditsIndeks: 'kata' });

  // Versi 16 (K-79): simpan, catatan, dan kaitan manual hadits — ikut sinkron.
  db.version(16).stores({
    haditsSimpan: 'kunci, terimaMs',
    catatanHadits: 'kunci, terimaMs',
    kaitanAyatHadits: 'kunci, surah, hadits, terimaMs',
  });
}

// Penanda sinkron otomatis untuk setiap penulisan lokal (K-37).
function pasangPenanda(db: SakuDB) {
  for (const nama of TABEL_SINKRON) {
    const t = db.table(nama);
    t.hook('creating', (_kunci, obj: Record<string, unknown>) => {
      if (nama === 'sesi' && !obj.uid) obj.uid = idAcak();
      if (db._terapkan) return;
      const kini = Date.now();
      obj.ubahMs = kini;
      obj.terimaMs = kini;
      obj.asal = '';
    });
    t.hook('updating', () => {
      if (db._terapkan) return undefined;
      const kini = Date.now();
      return { ubahMs: kini, terimaMs: kini, asal: '' };
    });
  }
}

export function idAcak(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export const TABEL_SINKRON = [
  'keterangan',
  'makna',
  'rekaman',
  'tandaSalah',
  'tandaTertukar',
  'tandaArti',
  'sesi',
  'hafalan',
  'jadwalRukuk',
  'perbaikan',
  'setelan',
  'maknaHadits',
  'haditsSimpan',
  'catatanHadits',
  'kaitanAyatHadits',
] as const;
export type TabelSinkron = (typeof TABEL_SINKRON)[number];

// Catatan penghapusan agar penghapusan ikut tersinkron (mis. hapus tanda salah manual).
export interface Penghapusan {
  kunci: string; // "tabel|kunci rekaman"
  tabel: TabelSinkron;
  kunciRekaman: string;
  ubahMs: number;
  terimaMs: number;
  asal: string;
}

export function buatDb(nama: string): SakuDB {
  const d = new Dexie(nama) as SakuDB;
  siapkanSkema(d);
  pasangPenanda(d);
  return d;
}

const db = buatDb('rabth');

// Mencatat penghapusan lokal; dipanggil di dalam transaksi yang menyertakan db.hapus.
export async function catatHapus(d: SakuDB, tabel: TabelSinkron, kunci: (string | number)[]) {
  const kini = Date.now();
  await d.hapus.bulkPut(
    kunci.map((k) => ({
      kunci: `${tabel}|${k}`,
      tabel,
      kunciRekaman: String(k),
      ubahMs: kini,
      terimaMs: kini,
      asal: '',
    })),
  );
}

export { db };

export function kunciKeterangan(surah: number, ayat: number, urutan: number): string {
  return `${surah}:${ayat}:${urutan}`;
}
export const kunciKata = kunciKeterangan;
export function kunciAyat(surah: number, ayat: number): string {
  return `${surah}:${ayat}`;
}

// ---------- Keterangan & makna ----------

export async function ambilKeteranganSurah(surah: number): Promise<Map<string, Keterangan>> {
  const daftar = await db.keterangan.where('surah').equals(surah).toArray();
  return new Map(daftar.map((k) => [k.kunci, k]));
}

// Isi kosong menghapus keterangan.
export async function simpanKeterangan(surah: number, ayat: number, urutan: number, isi: string) {
  const kunci = kunciKeterangan(surah, ayat, urutan);
  const bersih = isi.trim();
  if (!bersih)
    return db.transaction('rw', db.keterangan, db.hapus, async () => {
      await db.keterangan.delete(kunci);
      await catatHapus(db, 'keterangan', [kunci]);
    });
  await db.keterangan.put({ kunci, surah, ayat, urutan, isi: bersih, diubah: new Date().toISOString() });
}

export async function ambilMaknaSurah(surah: number): Promise<Map<string, Makna>> {
  const daftar = await db.makna.where('surah').equals(surah).toArray();
  return new Map(daftar.map((m) => [m.kunci, m]));
}

// Isi kosong mengembalikan makna ke gabungan arti per kata.
export async function simpanMakna(surah: number, ayat: number, segmen: number, isi: string) {
  const kunci = `${surah}:${ayat}:${segmen}`;
  const bersih = isi.trim();
  if (!bersih)
    return db.transaction('rw', db.makna, db.hapus, async () => {
      await db.makna.delete(kunci);
      await catatHapus(db, 'makna', [kunci]);
    });
  await db.makna.put({ kunci, surah, ayat, segmen, isi: bersih, diubah: new Date().toISOString() });
}

// ---------- Rekaman ----------

export async function simpanRekaman(surah: number, ayat: number, audio: Blob, durasiMs: number) {
  await db.rekaman.put({
    kunci: kunciAyat(surah, ayat),
    surah,
    ayat,
    audio,
    durasiMs,
    direkam: new Date().toISOString(),
  });
}

export async function ambilRekamanSurah(surah: number): Promise<Map<string, Rekaman>> {
  const daftar = await db.rekaman.where('surah').equals(surah).toArray();
  return new Map(daftar.map((r) => [r.kunci, r]));
}

// ---------- Tanda ----------

export interface TandaSurah {
  salah: Map<string, TandaSalah>;
  tertukar: Map<string, TandaTertukar>;
}

export async function ambilTandaSurah(surah: number): Promise<TandaSurah> {
  const [salah, tertukar] = await Promise.all([
    db.tandaSalah.where('surah').equals(surah).toArray(),
    db.tandaTertukar.where('surah').equals(surah).toArray(),
  ]);
  return {
    salah: new Map(salah.map((t) => [t.kunci, t])),
    tertukar: new Map(tertukar.map((t) => [t.kunci, t])),
  };
}

// Penghapusan tanda hanya lewat tindakan manual pengguna (K-13, K-15).
export async function hapusTandaSalah(kunci: string) {
  await db.transaction('rw', db.tandaSalah, db.hapus, async () => {
    await db.tandaSalah.delete(kunci);
    await catatHapus(db, 'tandaSalah', [kunci]);
  });
}
export async function hapusTandaTertukar(kunci: string) {
  await db.transaction('rw', db.tandaTertukar, db.hapus, async () => {
    await db.tandaTertukar.delete(kunci);
    await catatHapus(db, 'tandaTertukar', [kunci]);
  });
}

// ---------- Hafalan & jadwal ----------

export async function ambilHafalan(): Promise<Map<string, EntriHafalan>> {
  const daftar = await db.hafalan.toArray();
  return new Map(daftar.map((e) => [e.kunci, e]));
}

export async function ambilJadwal(): Promise<Map<number, EntriJadwal>> {
  const daftar = await db.jadwalRukuk.toArray();
  return new Map(daftar.map((e) => [e.nomor, e]));
}

// ---------- Hafalan lama (K-27) ----------

// Menandai rukuk sebagai hafalan lama; mengembalikan jumlah rukuk yang baru ditandai.
export async function tandaiHafalanLama(nomor: number[], hari = hariIni()): Promise<number> {
  return db.transaction('rw', db.hafalan, db.jadwalRukuk, db.hapus, async () => {
    const t = tandaiLama(nomor, await ambilHafalan(), await ambilJadwal(), hari);
    await db.hafalan.bulkPut(t.hafalan);
    await db.jadwalRukuk.bulkPut(t.jadwal);
    return t.jadwal.length;
  });
}

// K-30: tanda hafalan lama per ayat.
export async function tandaiAyatHafalanLama(surah: number, ayat: number[], hari = hariIni()): Promise<void> {
  await db.transaction('rw', db.hafalan, db.jadwalRukuk, db.hapus, async () => {
    const t = tandaiAyatLama(
      ayat.map((a) => ({ surah, ayat: a })),
      await ambilHafalan(),
      await ambilJadwal(),
      hari,
    );
    await db.hafalan.bulkPut(t.hafalan);
    await db.jadwalRukuk.bulkPut(t.jadwal);
  });
}

export async function batalkanAyatHafalanLama(surah: number, ayat: number[]): Promise<void> {
  await db.transaction('rw', db.hafalan, db.jadwalRukuk, db.hapus, async () => {
    const b = batalkanAyatLama(surah, ayat, await ambilHafalan(), await ambilJadwal());
    await db.hafalan.bulkDelete(b.hapusHafalan);
    await catatHapus(db, 'hafalan', b.hapusHafalan);
    await db.hafalan.bulkPut(b.tambahHafalan);
    await db.jadwalRukuk.bulkPut(b.jadwal);
    await db.jadwalRukuk.bulkDelete(b.hapusJadwal);
    await catatHapus(db, 'jadwalRukuk', b.hapusJadwal);
  });
}

export async function batalkanHafalanLama(nomor: number[], hari = hariIni()): Promise<void> {
  await db.transaction('rw', db.hafalan, db.jadwalRukuk, db.hapus, async () => {
    for (const n of nomor) {
      const b = batalkanLama(n, await ambilHafalan(), await ambilJadwal(), hari);
      await db.hafalan.bulkDelete(b.hapusHafalan);
      await catatHapus(db, 'hafalan', b.hapusHafalan);
      if (b.hapusJadwal) {
        await db.jadwalRukuk.delete(n);
        await catatHapus(db, 'jadwalRukuk', [n]);
      } else if (b.jadwal) await db.jadwalRukuk.put(b.jadwal);
    }
  });
}

export interface HasilKoreksi {
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  rukuk?: number; // terisi bila murojaah per rukuk
  ayat?: number[]; // daftar ayat yang dikoreksi bila tidak berurutan (K-30)
  sebagian?: boolean; // murojaah rukuk dihentikan di tengah (K-53)
  sudahBenar?: { ayat: number; urutan: number }[]; // tanda lama yang dinyatakan sudah benar (K-57)
  kataSalah: { ayat: number; urutan: number }[];
  tertukar: { ayatAsal: number; ayatKeliru: number }[];
  perbaikan?: boolean; // sesi "Perbaiki ayat" satu ayat (K-62)
  hari?: string; // untuk uji; bawaan hari ini
}

// Hasil simpan koreksi beserta penjelasan aturan yang berlaku (K-62).
export type HasilSimpan = Sesi & {
  tandaDihapus?: number;
  mutu?: MutuMurojaah;
  jumlahKata?: number;
  ayatDiperbaiki?: number[]; // ayat yang masuk "Perbaiki ayat"
  perbaikanSelesai?: number[]; // ayat perbaikan yang tuntas di sesi ini
};

async function catatTanda(h: HasilKoreksi, sekarang: string) {
  for (const k of h.kataSalah) {
    const kunci = kunciKata(h.surah, k.ayat, k.urutan);
    const lama = await db.tandaSalah.get(kunci);
    await db.tandaSalah.put({
      kunci,
      surah: h.surah,
      ayat: k.ayat,
      urutan: k.urutan,
      pertama: lama?.pertama ?? sekarang,
      terakhir: sekarang,
      jumlah: (lama?.jumlah ?? 0) + 1,
      benarBeruntun: 0,
    });
  }
  for (const t of h.tertukar) {
    const kunci = kunciAyat(h.surah, t.ayatAsal);
    const lama = await db.tandaTertukar.get(kunci);
    await db.tandaTertukar.put({
      kunci,
      surah: h.surah,
      ayatAsal: t.ayatAsal,
      ayatKeliru: t.ayatKeliru,
      pertama: lama?.pertama ?? sekarang,
      terakhir: sekarang,
      jumlah: (lama?.jumlah ?? 0) + 1,
    });
  }
}

export const BATAS_BENAR_OTOMATIS = 3;

// K-61: kata bantu murojaah nyala otomatis selama rukuk dimurojaah kurang dari ini.
export const BATAS_KATA_BANTU = 15;

// Jumlah sesi murojaah (termasuk yang dihentikan) untuk satu rukuk.
export function hitungMurojaahRukuk(surah: number, rukuk: number): Promise<number> {
  return db.sesi
    .where('surah')
    .equals(surah)
    .filter((s) => s.rukuk === rukuk && !s.perbaikan)
    .count();
}

// K-57: tanda kata lama di ayat yang dikoreksi. Yang dinyatakan sudah benar dihapus; yang
// tidak ditandai salah lagi menambah hitungan benar berturut-turut dan terhapus setelah
// BATAS_BENAR_OTOMATIS kali. Mengembalikan jumlah tanda yang dihapus.
async function perbaruiTandaBenar(h: HasilKoreksi): Promise<number> {
  const ayat = new Set(h.ayat ?? Array.from({ length: h.ayatAkhir - h.ayatAwal + 1 }, (_, i) => h.ayatAwal + i));
  const salah = new Set(h.kataSalah.map((k) => `${k.ayat}:${k.urutan}`));
  const benar = new Set((h.sudahBenar ?? []).map((k) => `${k.ayat}:${k.urutan}`));
  const tanda = (await db.tandaSalah.where('surah').equals(h.surah).toArray()).filter((t) => ayat.has(t.ayat));
  const hapus: string[] = [];
  for (const t of tanda) {
    const k = `${t.ayat}:${t.urutan}`;
    if (salah.has(k)) continue;
    const beruntun = (t.benarBeruntun ?? 0) + 1;
    if (benar.has(k) || beruntun >= BATAS_BENAR_OTOMATIS) hapus.push(t.kunci);
    else await db.tandaSalah.put({ ...t, benarBeruntun: beruntun });
  }
  if (hapus.length) {
    await db.tandaSalah.bulkDelete(hapus);
    await catatHapus(db, 'tandaSalah', hapus);
  }
  return hapus.length;
}

// Menyimpan hasil satu sesi koreksi (potongan) atau murojaah (rukuk).
// Tanda lama yang salah lagi bertambah hitungannya; yang benar dihitung/dihapus (K-57).
export async function simpanKoreksi(h: HasilKoreksi): Promise<HasilSimpan> {
  const sekarang = new Date().toISOString();
  const hari = h.hari ?? hariIni();
  const sesi: Sesi = {
    surah: h.surah,
    ayatAwal: h.ayatAwal,
    ayatAkhir: h.ayatAkhir,
    rukuk: h.rukuk,
    ...(h.ayat ? { ayat: h.ayat } : {}),
    tanggal: sekarang,
    kataSalah: h.kataSalah.length,
    sambunganTertukar: h.tertukar.length,
    lancar: h.kataSalah.length === 0 && h.tertukar.length === 0,
    ...(h.perbaikan ? { perbaikan: true } : {}),
  };
  const ayatDibaca = h.ayat ?? Array.from({ length: h.ayatAkhir - h.ayatAwal + 1 }, (_, i) => h.ayatAwal + i);
  const jumlahKata = ayatDibaca.reduce((n, a) => n + (cariAyat(h.surah, a)?.kata.length ?? 0), 0);
  const tambahan: Partial<HasilSimpan> = {};
  let tandaDihapus = 0;
  await db.transaction(
    'rw',
    [db.tandaSalah, db.tandaTertukar, db.sesi, db.hafalan, db.jadwalRukuk, db.perbaikan, db.hapus],
    async () => {
      tandaDihapus = await perbaruiTandaBenar(h);
      await catatTanda(h, sekarang);
      sesi.id = await db.sesi.add(sesi);

      // K-62: perbaikan satu ayat — hanya daftar perbaikan yang berubah, jadwal rukuk tetap.
      if (h.perbaikan) {
        const selesai: number[] = [];
        for (const a of ayatDibaca) {
          const kunci = kunciAyat(h.surah, a);
          const e = await db.perbaikan.get(kunci);
          if (!e) continue;
          const lancarAyat = !h.kataSalah.some((k) => k.ayat === a) && !h.tertukar.some((t) => t.ayatAsal === a);
          const b = setelahPerbaikan(e, lancarAyat, hari);
          if (b) await db.perbaikan.put(b);
          else {
            await db.perbaikan.delete(kunci);
            await catatHapus(db, 'perbaikan', [kunci]);
            selesai.push(a);
          }
        }
        tambahan.perbaikanSelesai = selesai;
        return;
      }

      if (h.rukuk) {
        const j = await db.jadwalRukuk.get(h.rukuk);
        if (!j) return;
        const mutu = mutuMurojaah(h.kataSalah.length, h.tertukar.length, jumlahKata);
        const berjarak = j.lengkap || !!j.sebagian;
        tambahan.mutu = mutu;
        tambahan.jumlahKata = jumlahKata;
        // K-53: murojaah sebagian — kesalahan tetap mengubah jadwal; bila lancar, rukuk
        // tetap jatuh tempo sampai dibaca utuh.
        if (h.sebagian) {
          if (mutu === 'kecil' && berjarak) await db.jadwalRukuk.put(turunSatuTingkat(j, hari));
          else if (mutu !== 'lancar') await db.jadwalRukuk.put(turunkanJadwal(j, hari));
        } else {
          const baru = setelahMurojaahRukuk(j, mutu, hari);
          await db.jadwalRukuk.put(baru ?? { ...j, terakhir: hari });
        }
        // K-62: kesalahan kecil di rukuk yang sudah berjarak → ayat yang salah diperbaiki besok dan lusa.
        if (mutu === 'kecil' && berjarak) {
          const ayat = ayatPerbaikan(h.kataSalah, h.tertukar);
          for (const a of ayat) {
            const lama = await db.perbaikan.get(kunciAyat(h.surah, a));
            await db.perbaikan.put(mulaiPerbaikan(h.surah, a, h.rukuk, hari, lama));
          }
          tambahan.ayatDiperbaiki = ayat;
        }
        return;
      }

      const [hafalan, jadwal] = await Promise.all([ambilHafalan(), ambilJadwal()]);
      const p = { surah: h.surah, ayatAwal: h.ayatAwal, ayatAkhir: h.ayatAkhir };
      const ubah = setelahKoreksiPotongan(hafalan, jadwal, p, sesi.lancar, hari);
      if (ubah.hafalan) await db.hafalan.put(ubah.hafalan);
      if (ubah.jadwal.length) await db.jadwalRukuk.bulkPut(ubah.jadwal);
    },
  );
  return { ...sesi, tandaDihapus, ...tambahan };
}

export { KALI_PERBAIKAN as KALI_PERBAIKAN_TAMPIL } from './jadwal';

// Daftar "Perbaiki ayat" (K-62).
export const ambilPerbaikan = () => db.perbaikan.toArray();

// Hasil satu soal latihan tebak ayat dari arti (K-41).
export async function catatTebakArti(surah: number, ayat: number, benar: boolean) {
  const kunci = kunciAyat(surah, ayat);
  const sekarang = new Date().toISOString();
  await db.transaction('rw', db.tandaArti, async () => {
    const lama = await db.tandaArti.get(kunci);
    if (benar) {
      if (lama) await db.tandaArti.put({ ...lama, benar: sekarang });
      return;
    }
    await db.tandaArti.put({
      kunci,
      surah,
      ayat,
      jumlah: (lama?.jumlah ?? 0) + 1,
      pertama: lama?.pertama ?? sekarang,
      terakhir: sekarang,
      ...(lama?.benar ? { benar: lama.benar } : {}),
    });
  });
}

// Sambungan tertukar dari latihan Sambung ayat (K-15, K-17): tanda bertambah dan
// rukuk yang memuat ayat asal kembali ke jarak 1 hari.
export async function tandaiTertukarLatihan(surah: number, ayatAsal: number, ayatKeliru: number, hari = hariIni()) {
  const sekarang = new Date().toISOString();
  await db.transaction('rw', [db.tandaTertukar, db.jadwalRukuk], async () => {
    const kunci = kunciAyat(surah, ayatAsal);
    const lama = await db.tandaTertukar.get(kunci);
    await db.tandaTertukar.put({
      kunci,
      surah,
      ayatAsal,
      ayatKeliru,
      pertama: lama?.pertama ?? sekarang,
      terakhir: sekarang,
      jumlah: (lama?.jumlah ?? 0) + 1,
    });
    const r = rukukAyat(surah, ayatAsal);
    const j = r ? await db.jadwalRukuk.get(r.nomor) : undefined;
    if (j?.lengkap) await db.jadwalRukuk.put(turunkanJadwal(j, hari));
  });
}

// Minta browser tidak membersihkan data saat memori HP menipis.
export async function mintaPenyimpananTetap() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // diabaikan: penyimpanan tetap berjalan tanpa izin ini
  }
}

// ---------- Murotal (K-28) ----------

export interface BahanSurah {
  rekaman: Map<string, Rekaman>;
  sesi: Sesi[];
  tandaSalah: TandaSalah[];
  tertukar: Map<string, TandaTertukar>;
}

export async function ambilBahanMurotal(surah: number[]): Promise<Map<number, BahanSurah>> {
  const hasil = new Map<number, BahanSurah>();
  for (const s of [...new Set(surah)]) {
    const [rekaman, sesi, tandaSalah, tertukar] = await Promise.all([
      ambilRekamanSurah(s),
      db.sesi.where('surah').equals(s).toArray(),
      db.tandaSalah.where('surah').equals(s).toArray(),
      db.tandaTertukar.where('surah').equals(s).toArray(),
    ]);
    hasil.set(s, { rekaman, sesi, tandaSalah, tertukar: new Map(tertukar.map((t) => [t.kunci, t])) });
  }
  return hasil;
}
