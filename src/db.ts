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

const db = new Dexie('rabth') as Dexie & {
  keterangan: EntityTable<Keterangan, 'kunci'>;
};

db.version(1).stores({
  keterangan: 'kunci, surah, [surah+ayat]',
});

export function kunciKeterangan(surah: number, ayat: number, urutan: number): string {
  return `${surah}:${ayat}:${urutan}`;
}

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

// Minta browser tidak membersihkan data saat memori HP menipis.
export async function mintaPenyimpananTetap() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // diabaikan: penyimpanan tetap berjalan tanpa izin ini
  }
}
