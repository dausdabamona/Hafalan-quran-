import { Capacitor, registerPlugin } from '@capacitor/core';
import { db, type SakuDB } from './db';
import { bacaMeta, SEMUA_TABEL, siapKirim, terapkan, tulisMeta, type Rekaman } from './sinkron/mesin';

// Cadangan ke satu berkas (F-05, K-67). Isinya semua data yang ikut sinkron — hafalan, jadwal,
// tanda, makna suntingan, riwayat sesi, rekaman suara — ditambah target dan setelan tampilan.
// Impor memakai aturan penggabungan sinkron: data yang sudah ada tidak ditimpa versi yang lebih lama.

export const FORMAT_CADANGAN = 'saku-hati-cadangan';
const VERSI_CADANGAN = 1;
const META_IKUT = ['target', 'catatanHari'] as const;
const SETELAN_IKUT = ['ukuranHuruf', 'tema', 'tampilMakna', 'tampilanMurotal'] as const;
const KUNCI_TERAKHIR = 'cadanganTerakhir';

export interface RingkasCadangan {
  ayatHafal: number;
  rekaman: number;
  sesi: number;
}

export interface HasilImpor {
  diterima: number;
  dihapus: number;
  dibuat: string;
}

function bacaSetelan(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function tulisSetelan(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // penyimpanan tidak tersedia: setelan dilewati
  }
}

// Isi berkas cadangan sebagai potongan teks JSON (agar rekaman besar tidak menjadi satu string raksasa).
export async function susunCadangan(d: SakuDB = db): Promise<string[]> {
  const meta: Record<string, unknown> = {};
  for (const k of META_IKUT) {
    const v = await bacaMeta(d, k);
    if (v !== undefined && v !== null) meta[k] = v;
  }
  const setelan: Record<string, string> = {};
  for (const k of SETELAN_IKUT) {
    const v = bacaSetelan(k);
    if (v !== null) setelan[k] = v;
  }
  const bagian: string[] = [
    `{"format":${JSON.stringify(FORMAT_CADANGAN)},"versi":${VERSI_CADANGAN},` +
      `"dibuat":${JSON.stringify(new Date().toISOString())},` +
      `"meta":${JSON.stringify(meta)},"setelan":${JSON.stringify(setelan)},"tabel":{`,
  ];
  let pertama = true;
  for (const tabel of SEMUA_TABEL) {
    bagian.push(`${pertama ? '' : ','}${JSON.stringify(tabel)}:[`);
    pertama = false;
    let ke = 0;
    // Satu per satu agar rekaman suara tidak dimuat sekaligus.
    const kunci = await d.table(tabel).toCollection().primaryKeys();
    for (const k of kunci) {
      const x = (await d.table(tabel).get(k)) as Rekaman | undefined;
      if (!x) continue;
      const salin = await siapKirim(tabel, x, '');
      delete salin.asal; // saat diimpor dianggap data perangkat itu sendiri
      bagian.push((ke++ ? ',' : '') + JSON.stringify(salin));
    }
    bagian.push(']');
  }
  bagian.push('}}');
  return bagian;
}

export async function ringkasData(d: SakuDB = db): Promise<RingkasCadangan> {
  const [hafalan, rekaman, sesi] = await Promise.all([d.hafalan.toArray(), d.rekaman.count(), d.sesi.count()]);
  return { ayatHafal: hafalan.length, rekaman, sesi };
}

export async function imporCadangan(teks: string, d: SakuDB = db): Promise<HasilImpor> {
  let isi: {
    format?: string;
    versi?: number;
    dibuat?: string;
    meta?: Record<string, unknown>;
    setelan?: Record<string, string>;
    tabel?: Record<string, Rekaman[]>;
  };
  try {
    isi = JSON.parse(teks);
  } catch {
    throw new Error('Berkas ini bukan cadangan Saku Hati (isinya tidak terbaca).');
  }
  if (!isi || isi.format !== FORMAT_CADANGAN || !isi.tabel) throw new Error('Berkas ini bukan cadangan Saku Hati.');
  if ((isi.versi ?? 0) > VERSI_CADANGAN)
    throw new Error('Cadangan dibuat oleh Saku Hati yang lebih baru. Perbarui aplikasi ini dulu.');

  const hasil: HasilImpor = { diterima: 0, dihapus: 0, dibuat: isi.dibuat ?? '' };
  for (const tabel of SEMUA_TABEL) {
    const item = isi.tabel[tabel];
    if (!Array.isArray(item)) continue;
    for (let i = 0; i < item.length; i += 200) {
      const h = await terapkan(d, '', { tabel, item: item.slice(i, i + 200) });
      hasil.diterima += h.diterima;
      hasil.dihapus += h.dihapus;
    }
  }
  // Target dan setelan hanya diisi bila di sini belum ada.
  for (const k of META_IKUT) {
    const v = isi.meta?.[k];
    if (v !== undefined && (await bacaMeta(d, k)) === undefined) await tulisMeta(d, k, v);
  }
  for (const k of SETELAN_IKUT) {
    const v = isi.setelan?.[k];
    if (typeof v === 'string' && bacaSetelan(k) === null) tulisSetelan(k, v);
  }
  return hasil;
}

// ---------- Menyimpan berkas ----------

interface PluginCadangan {
  mulai(): Promise<void>;
  tambah(o: { teks: string }): Promise<void>;
  selesai(o: { nama: string }): Promise<{ tersimpan: boolean }>;
}

const Cadangan = registerPlugin<PluginCadangan>('Cadangan');
const POTONGAN_KIRIM = 512 * 1024;

export function namaBerkasCadangan(t = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `saku-hati-cadangan-${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}.json`;
}

// Android: pemilih lokasi bawaan HP (folder Download, Drive, dll.). Windows/peramban: unduhan biasa.
export async function simpanCadangan(): Promise<boolean> {
  const bagian = await susunCadangan();
  const nama = namaBerkasCadangan();
  let tersimpan: boolean;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await Cadangan.mulai();
    let kumpul = '';
    for (const b of bagian) {
      kumpul += b;
      if (kumpul.length >= POTONGAN_KIRIM) {
        await Cadangan.tambah({ teks: kumpul });
        kumpul = '';
      }
    }
    if (kumpul) await Cadangan.tambah({ teks: kumpul });
    tersimpan = (await Cadangan.selesai({ nama })).tersimpan;
  } else {
    const url = URL.createObjectURL(new Blob(bagian, { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    tersimpan = true;
  }
  if (tersimpan) tulisSetelan(KUNCI_TERAKHIR, new Date().toISOString());
  return tersimpan;
}

export function cadanganTerakhir(): string | null {
  return bacaSetelan(KUNCI_TERAKHIR);
}
