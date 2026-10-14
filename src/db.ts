import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { rukukAyat } from './data';
import { petaAyatFatihah, petaKataFatihah, petaRentangFatihah } from './fatihah';
import {
  hariIni,
  migrasiJadwalLama,
  setelahKoreksiPotongan,
  setelahMurojaahRukuk,
  turunkanJadwal,
  batalkanLama,
  tandaiLama,
  type EntriHafalan,
  type EntriJadwal,
  type JadwalPotonganLama,
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

// Satu kali koreksi (potongan) atau murojaah (rukuk).
export interface Sesi {
  id?: number;
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  rukuk?: number;
  tanggal: string; // ISO
  kataSalah: number;
  sambunganTertukar: number;
  lancar: boolean; // P-01
}

const db = new Dexie('rabth') as Dexie & {
  keterangan: EntityTable<Keterangan, 'kunci'>;
  makna: EntityTable<Makna, 'kunci'>;
  rekaman: EntityTable<Rekaman, 'kunci'>;
  tandaSalah: EntityTable<TandaSalah, 'kunci'>;
  tandaTertukar: EntityTable<TandaTertukar, 'kunci'>;
  sesi: EntityTable<Sesi, 'id'>;
  hafalan: EntityTable<EntriHafalan, 'kunci'>;
  jadwalRukuk: EntityTable<EntriJadwal, 'nomor'>;
};

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
  await tx.table('makna').bulkPut(
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
      return [{ ...x, kunci: `1:${asal}`, ayatAsal: asal, ayatKeliru: x.ayatKeliru ? (petaAyatFatihah(x.ayatKeliru) ?? 0) : 0 }];
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
  if (!bersih) return db.keterangan.delete(kunci);
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
  if (!bersih) return db.makna.delete(kunci);
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
  await db.tandaSalah.delete(kunci);
}
export async function hapusTandaTertukar(kunci: string) {
  await db.tandaTertukar.delete(kunci);
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
  return db.transaction('rw', db.hafalan, db.jadwalRukuk, async () => {
    const t = tandaiLama(nomor, await ambilHafalan(), await ambilJadwal(), hari);
    await db.hafalan.bulkPut(t.hafalan);
    await db.jadwalRukuk.bulkPut(t.jadwal);
    return t.jadwal.length;
  });
}

export async function batalkanHafalanLama(nomor: number[], hari = hariIni()): Promise<void> {
  await db.transaction('rw', db.hafalan, db.jadwalRukuk, async () => {
    for (const n of nomor) {
      const b = batalkanLama(n, await ambilHafalan(), await ambilJadwal(), hari);
      await db.hafalan.bulkDelete(b.hapusHafalan);
      if (b.hapusJadwal) await db.jadwalRukuk.delete(n);
      else if (b.jadwal) await db.jadwalRukuk.put(b.jadwal);
    }
  });
}

export interface HasilKoreksi {
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  rukuk?: number; // terisi bila murojaah per rukuk
  kataSalah: { ayat: number; urutan: number }[];
  tertukar: { ayatAsal: number; ayatKeliru: number }[];
  hari?: string; // untuk uji; bawaan hari ini
}

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

// Menyimpan hasil satu sesi koreksi (potongan) atau murojaah (rukuk).
// Tanda lama yang salah lagi bertambah hitungannya; tidak ada tanda yang dihapus (K-13).
export async function simpanKoreksi(h: HasilKoreksi): Promise<Sesi> {
  const sekarang = new Date().toISOString();
  const hari = h.hari ?? hariIni();
  const sesi: Sesi = {
    surah: h.surah,
    ayatAwal: h.ayatAwal,
    ayatAkhir: h.ayatAkhir,
    rukuk: h.rukuk,
    tanggal: sekarang,
    kataSalah: h.kataSalah.length,
    sambunganTertukar: h.tertukar.length,
    lancar: h.kataSalah.length === 0 && h.tertukar.length === 0,
  };
  await db.transaction('rw', [db.tandaSalah, db.tandaTertukar, db.sesi, db.hafalan, db.jadwalRukuk], async () => {
    await catatTanda(h, sekarang);
    sesi.id = await db.sesi.add(sesi);

    if (h.rukuk) {
      const j = await db.jadwalRukuk.get(h.rukuk);
      if (!j) return;
      const baru = setelahMurojaahRukuk(j, sesi.lancar, hari);
      await db.jadwalRukuk.put(baru ?? { ...j, terakhir: hari });
      return;
    }

    const [hafalan, jadwal] = await Promise.all([ambilHafalan(), ambilJadwal()]);
    const p = { surah: h.surah, ayatAwal: h.ayatAwal, ayatAkhir: h.ayatAkhir };
    const ubah = setelahKoreksiPotongan(hafalan, jadwal, p, sesi.lancar, hari);
    if (ubah.hafalan) await db.hafalan.put(ubah.hafalan);
    if (ubah.jadwal.length) await db.jadwalRukuk.bulkPut(ubah.jadwal);
  });
  return sesi;
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
