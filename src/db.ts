import Dexie, { type EntityTable } from 'dexie';

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
  pertama: string; // tanggal pertama ditandai (ISO)
  terakhir: string; // tanggal terakhir salah lagi (ISO)
  jumlah: number;
}

// Tanda urutan tertukar (K-15): dipasang pada sambungan sesudah ayatAsal.
export interface TandaTertukar {
  kunci: string; // "surah:ayatAsal"
  surah: number;
  ayatAsal: number; // sesudah ayat ini, seharusnya ayatAsal + 1
  ayatKeliru: number; // ayat yang terbaca keliru (terakhir)
  pertama: string;
  terakhir: string;
  jumlah: number;
}

// Satu kali koreksi satu potongan; bahan jadwal di Fase 3.
export interface Sesi {
  id?: number;
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  tanggal: string; // ISO
  kataSalah: number;
  sambunganTertukar: number;
  lancar: boolean; // P-01: tanpa kesalahan pada sesi ini
}

const db = new Dexie('rabth') as Dexie & {
  keterangan: EntityTable<Keterangan, 'kunci'>;
  rekaman: EntityTable<Rekaman, 'kunci'>;
  tandaSalah: EntityTable<TandaSalah, 'kunci'>;
  tandaTertukar: EntityTable<TandaTertukar, 'kunci'>;
  sesi: EntityTable<Sesi, 'id'>;
};

db.version(1).stores({
  keterangan: 'kunci, surah, [surah+ayat]',
});

db.version(2).stores({
  keterangan: 'kunci, surah, [surah+ayat]',
  rekaman: 'kunci, surah',
  tandaSalah: 'kunci, surah',
  tandaTertukar: 'kunci, surah',
  sesi: '++id, surah, tanggal',
});

export { db };

export function kunciKeterangan(surah: number, ayat: number, urutan: number): string {
  return `${surah}:${ayat}:${urutan}`;
}

export const kunciKata = kunciKeterangan;

export function kunciAyat(surah: number, ayat: number): string {
  return `${surah}:${ayat}`;
}

// ---------- Keterangan ----------

export async function ambilKeteranganSurah(surah: number): Promise<Map<string, Keterangan>> {
  const daftar = await db.keterangan.where('surah').equals(surah).toArray();
  return new Map(daftar.map((k) => [k.kunci, k]));
}

// Isi kosong menghapus keterangan.
export async function simpanKeterangan(surah: number, ayat: number, urutan: number, isi: string) {
  const kunci = kunciKeterangan(surah, ayat, urutan);
  const bersih = isi.trim();
  if (!bersih) {
    await db.keterangan.delete(kunci);
    return;
  }
  await db.keterangan.put({ kunci, surah, ayat, urutan, isi: bersih, diubah: new Date().toISOString() });
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

export interface HasilKoreksi {
  surah: number;
  ayatAwal: number;
  ayatAkhir: number;
  kataSalah: { ayat: number; urutan: number }[];
  tertukar: { ayatAsal: number; ayatKeliru: number }[];
}

// Menyimpan hasil satu sesi koreksi. Tanda lama yang salah lagi bertambah
// hitungannya; tanda baru dibuat. Tidak ada tanda yang dihapus di sini (K-13).
export async function simpanKoreksi(h: HasilKoreksi): Promise<Sesi> {
  const sekarang = new Date().toISOString();
  const sesi: Sesi = {
    surah: h.surah,
    ayatAwal: h.ayatAwal,
    ayatAkhir: h.ayatAkhir,
    tanggal: sekarang,
    kataSalah: h.kataSalah.length,
    sambunganTertukar: h.tertukar.length,
    lancar: h.kataSalah.length === 0 && h.tertukar.length === 0,
  };
  await db.transaction('rw', db.tandaSalah, db.tandaTertukar, db.sesi, async () => {
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
    sesi.id = await db.sesi.add(sesi);
  });
  return sesi;
}

// Penghapusan tanda hanya lewat tindakan manual pengguna (K-13, K-15).
export async function hapusTandaSalah(kunci: string) {
  await db.tandaSalah.delete(kunci);
}

export async function hapusTandaTertukar(kunci: string) {
  await db.tandaTertukar.delete(kunci);
}

// Minta browser tidak membersihkan data saat memori HP menipis.
export async function mintaPenyimpananTetap() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // diabaikan: penyimpanan tetap berjalan tanpa izin ini
  }
}
