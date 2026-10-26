import type { SakuDB, TabelSinkron } from '../db';
import {
  ambilPerubahan,
  bacaMeta,
  idPerangkat,
  SEMUA_TABEL,
  terapkan,
  tulisMeta,
  type Paket,
  type Rekaman,
} from './mesin';
import { idAcak } from '../db';

// Protokol sinkron Saku Hati (K-37). HP = pusat; laptop = anggota.
//   /halo   → identitas pusat dan jam pusat
//   /pasang → menukar kode 6 angka (dari kode QR) dengan token
//   /dorong → anggota mengirim perubahan buatannya
//   /tarik  → anggota mengambil perubahan dari pusat (kecuali yang berasal darinya)

export const VERSI_PROTOKOL = 1;

// Tabel yang ditambahkan sesudah pusat mulai mengirim daftar tabelnya di /halo.
const TABEL_BARU_K73: string[] = ['setelan', 'maknaHadits'];
export const PORT_BAWAAN = 47310;

export interface Anggota {
  id: string;
  nama: string;
  token: string;
  dipasang: string;
  terakhir?: string;
}

export interface KodePasang {
  kode: string;
  berlakuSampai: number;
}

// ---------- Sisi pusat (HP) ----------

let kodeAktif: KodePasang | null = null;

export function buatKodePasang(menit = 10): KodePasang {
  const kode = String(Math.floor(100000 + Math.random() * 900000));
  kodeAktif = { kode, berlakuSampai: Date.now() + menit * 60_000 };
  return kodeAktif;
}

export function aturKodePasang(k: KodePasang | null) {
  kodeAktif = k;
}

export async function daftarAnggota(d: SakuDB): Promise<Anggota[]> {
  return (await bacaMeta<Anggota[]>(d, 'anggota')) ?? [];
}

export async function lepasAnggota(d: SakuDB, id: string) {
  await tulisMeta(
    d,
    'anggota',
    (await daftarAnggota(d)).filter((a) => a.id !== id),
  );
}

export class GalatSinkron extends Error {
  constructor(
    public status: number,
    pesan: string,
  ) {
    super(pesan);
  }
}

async function periksaToken(d: SakuDB, isi: Rekaman): Promise<Anggota> {
  const a = (await daftarAnggota(d)).find((x) => x.id === isi.idPerangkat && x.token === isi.token);
  if (!a) throw new GalatSinkron(401, 'Perangkat belum dipasangkan dengan HP ini.');
  return a;
}

// Menangani satu permintaan dari anggota. Mengembalikan isi jawaban (JSON).
export async function layani(d: SakuDB, jalur: string, isi: Rekaman): Promise<Rekaman> {
  const idPusat = await idPerangkat(d);
  if (jalur === '/halo') {
    // K-73: daftar tabel yang dikenal pusat, agar anggota versi baru tidak meminta tabel yang belum ada.
    return {
      aplikasi: 'saku-hati',
      versi: VERSI_PROTOKOL,
      id: idPusat,
      nama: 'HP Saku Hati',
      jam: Date.now(),
      tabel: SEMUA_TABEL,
    };
  }
  if (jalur === '/pasang') {
    if (!kodeAktif || kodeAktif.kode !== String(isi.kode) || Date.now() > kodeAktif.berlakuSampai) {
      throw new GalatSinkron(403, 'Kode pemasangan salah atau sudah kedaluwarsa. Buka lagi layar Sinkron di HP.');
    }
    const anggota = (await daftarAnggota(d)).filter((a) => a.id !== isi.idPerangkat);
    const baru: Anggota = {
      id: String(isi.idPerangkat),
      nama: String(isi.nama || 'Laptop'),
      token: idAcak(),
      dipasang: new Date().toISOString(),
    };
    await tulisMeta(d, 'anggota', [...anggota, baru]);
    kodeAktif = null;
    return { id: idPusat, token: baru.token };
  }
  const anggota = await periksaToken(d, isi);
  if (jalur === '/dorong') {
    const h = await terapkan(d, anggota.id, { tabel: isi.tabel as Paket['tabel'], item: isi.item as Rekaman[] });
    return { ...h };
  }
  if (jalur === '/tarik') {
    if (!SEMUA_TABEL.includes(isi.tabel as TabelSinkron)) return { item: [], berikut: null };
    const r = await ambilPerubahan(d, isi.tabel as TabelSinkron | 'hapus', {
      sejak: Number(isi.sejak) || 0,
      sampai: Number(isi.sampai),
      mulai: Number(isi.mulai) || 0,
      kecualiAsal: anggota.id,
    });
    return r;
  }
  if (jalur === '/selesai') {
    const semua = await daftarAnggota(d);
    await tulisMeta(
      d,
      'anggota',
      semua.map((a) => (a.id === anggota.id ? { ...a, terakhir: new Date().toISOString() } : a)),
    );
    return { ok: true };
  }
  throw new GalatSinkron(404, 'Jalur tidak dikenal');
}

// ---------- Sisi anggota (laptop) ----------

export type Kirim = (jalur: string, isi: Rekaman) => Promise<Rekaman>;

export interface Pusat {
  id: string;
  alamat: string; // "192.168.1.5:47310"
  token: string;
}

export interface HasilSinkron {
  dikirim: number;
  diterima: number;
  dihapus: number;
  waktu: string;
}

export async function pasang(d: SakuDB, kirim: Kirim, alamat: string, kode: string, nama: string): Promise<Pusat> {
  const halo = await kirim('/halo', {});
  if (halo.aplikasi !== 'saku-hati') throw new Error('Alamat itu bukan HP Saku Hati.');
  const j = await kirim('/pasang', { kode, idPerangkat: await idPerangkat(d), nama });
  const pusat: Pusat = { id: String(j.id), alamat, token: String(j.token) };
  await tulisMeta(d, 'pusat', pusat);
  await tulisMeta(d, 'dorongSejak', 0);
  await tulisMeta(d, 'tarikSejak', 0);
  return pusat;
}

export async function sinkronkan(d: SakuDB, kirim: Kirim, kabar?: (pesan: string) => void): Promise<HasilSinkron> {
  const pusat = await bacaMeta<Pusat>(d, 'pusat');
  if (!pusat) throw new Error('Belum dipasangkan dengan HP.');
  const idSaya = await idPerangkat(d);
  const kredensial = { idPerangkat: idSaya, token: pusat.token };
  const halo = await kirim('/halo', {});
  if (halo.id !== pusat.id) throw new Error('HP yang ditemukan bukan HP pasangan.');
  const hasil: HasilSinkron = { dikirim: 0, diterima: 0, dihapus: 0, waktu: new Date().toISOString() };

  // 1. Dorong perubahan buatan perangkat ini.
  const dorongSejak = (await bacaMeta<number>(d, 'dorongSejak')) ?? 0;
  const dorongSampai = Date.now();
  for (const tabel of SEMUA_TABEL) {
    let mulai: number | null = 0;
    while (mulai !== null) {
      const r = await ambilPerubahan(d, tabel, { sejak: dorongSejak, sampai: dorongSampai, mulai, hanyaLokal: true });
      if (r.item.length) {
        kabar?.(`Mengirim ${tabel}…`);
        await kirim('/dorong', { ...kredensial, tabel, item: r.item });
        hasil.dikirim += r.item.length;
      }
      mulai = r.berikut;
    }
  }
  await tulisMeta(d, 'dorongSejak', dorongSampai);

  // 2. Tarik perubahan dari pusat sampai jam pusat saat /halo.
  // Pusat versi lama tidak mengirim daftar tabel dan belum punya tabel setelan (K-73).
  const tabelPusat = Array.isArray(halo.tabel)
    ? SEMUA_TABEL.filter((t) => (halo.tabel as string[]).includes(t))
    : SEMUA_TABEL.filter((t) => !TABEL_BARU_K73.includes(t));
  const tarikSejak = (await bacaMeta<number>(d, 'tarikSejak')) ?? 0;
  const tarikSampai = Number(halo.jam);
  for (const tabel of tabelPusat) {
    let mulai: number | null = 0;
    while (mulai !== null) {
      const r = await kirim('/tarik', { ...kredensial, tabel, sejak: tarikSejak, sampai: tarikSampai, mulai });
      const item = r.item as Rekaman[];
      if (item.length) {
        kabar?.(`Menerima ${tabel}…`);
        const h = await terapkan(d, pusat.id, { tabel, item });
        hasil.diterima += h.diterima;
        hasil.dihapus += h.dihapus;
      }
      mulai = (r.berikut as number | null) ?? null;
    }
  }
  await tulisMeta(d, 'tarikSejak', tarikSampai);
  await kirim('/selesai', kredensial);
  await tulisMeta(d, 'sinkronTerakhir', hasil);
  return hasil;
}
