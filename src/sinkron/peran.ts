import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { db } from '../db';
import { bacaMeta, tulisMeta } from './mesin';
import {
  GalatSinkron,
  layani,
  pasang,
  PORT_BAWAAN,
  sinkronkan,
  type HasilSinkron,
  type Kirim,
  type Pusat,
} from './protokol';

// Peran perangkat dalam sinkron (K-37): HP Android = pusat, Windows = anggota.

export type Peran = 'pusat' | 'anggota' | null;

interface JembatanDesktop {
  minta(alamat: string, jalur: string, isi: unknown): Promise<{ status: number; teks: string }>;
  cariPusat(port: number, idPusat: string): Promise<string | null>;
  namaKomputer(): Promise<string>;
}

function desktop(): JembatanDesktop | undefined {
  return (window as unknown as { sakuHatiDesktop?: JembatanDesktop }).sakuHatiDesktop;
}

export function peranSinkron(): Peran {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return 'pusat';
  if (desktop()) return 'anggota';
  return null;
}

// ---------- Pusat (HP) ----------

interface PluginPusat {
  mulai(o: { port: number }): Promise<{ alamat: string; port: number }>;
  berhenti(): Promise<void>;
  alamat(): Promise<{ alamat: string; port: number }>;
  jawab(o: { id: string; status: number; isi: string }): Promise<void>;
  addListener(
    nama: 'permintaan',
    f: (p: { id: string; jalur: string; isi: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const PusatSinkron = registerPlugin<PluginPusat>('PusatSinkron');
let pendengar: PluginListenerHandle | null = null;
const pengamatPusat = new Set<() => void>();

export function amatiPusat(f: () => void): () => void {
  pengamatPusat.add(f);
  return () => pengamatPusat.delete(f);
}

export function pusatDiingat(): boolean {
  try {
    return localStorage.getItem('pusatSinkron') !== '0';
  } catch {
    return true;
  }
}

export async function nyalakanPusat(): Promise<{ alamat: string; port: number }> {
  try {
    localStorage.setItem('pusatSinkron', '1');
  } catch {
    // abaikan
  }
  if (!pendengar) {
    pendengar = await PusatSinkron.addListener('permintaan', async ({ id, jalur, isi }) => {
      try {
        const hasil = await layani(db, jalur, JSON.parse(isi || '{}'));
        await PusatSinkron.jawab({ id, status: 200, isi: JSON.stringify(hasil) });
      } catch (e) {
        const status = e instanceof GalatSinkron ? e.status : 500;
        await PusatSinkron.jawab({ id, status, isi: JSON.stringify({ pesan: (e as Error).message }) });
      }
      if (jalur === '/selesai') pengamatPusat.forEach((f) => f());
    });
  }
  return PusatSinkron.mulai({ port: PORT_BAWAAN });
}

export async function matikanPusat() {
  try {
    localStorage.setItem('pusatSinkron', '0');
  } catch {
    // abaikan
  }
  await pendengar?.remove();
  pendengar = null;
  await PusatSinkron.berhenti();
}

export function alamatPusat() {
  return PusatSinkron.alamat();
}

// Isi kode QR: sakuhati://192.168.1.5:47310/123456
export function teksQr(alamat: string, port: number, kode: string): string {
  return `sakuhati://${alamat}:${port}/${kode}`;
}

export function bacaQr(teks: string): { alamat: string; kode: string } | null {
  const m = /^sakuhati:\/\/([\d.]+:\d+)\/(\d{6})$/.exec(teks.trim());
  return m ? { alamat: m[1], kode: m[2] } : null;
}

// ---------- Anggota (Windows) ----------

export function kirimKe(alamat: string): Kirim {
  return async (jalur, isi) => {
    const j = desktop();
    if (!j) throw new Error('Sinkron hanya tersedia di aplikasi Windows.');
    const r = await j.minta(alamat, jalur, isi);
    let isiJawab: Record<string, unknown> = {};
    try {
      isiJawab = JSON.parse(r.teks || '{}');
    } catch {
      // jawaban bukan JSON
    }
    if (r.status === 0)
      throw new GalatSinkron(0, 'HP tidak terjangkau. Pastikan Saku Hati terbuka di HP dan satu Wi-Fi.');
    if (r.status !== 200) throw new GalatSinkron(r.status, String(isiJawab.pesan || `Galat ${r.status}`));
    return isiJawab;
  };
}

export async function pusatTersimpan(): Promise<Pusat | undefined> {
  return bacaMeta<Pusat>(db, 'pusat');
}

export async function pasangKePusat(alamat: string, kode: string): Promise<Pusat> {
  const nama = (await desktop()?.namaKomputer()) || 'Laptop';
  return pasang(db, kirimKe(alamat), alamat, kode, nama);
}

export async function lepasPusat() {
  await db.meta.bulkDelete(['pusat', 'dorongSejak', 'tarikSejak', 'sinkronTerakhir']);
}

let sedangSinkron: Promise<HasilSinkron> | null = null;
const pengamatSinkron = new Set<(s: string) => void>();

export function amatiSinkron(f: (s: string) => void): () => void {
  pengamatSinkron.add(f);
  return () => pengamatSinkron.delete(f);
}

function kabar(s: string) {
  pengamatSinkron.forEach((f) => f(s));
}

// Sinkron sekarang. Bila HP tidak ditemukan di alamat lama, alamat baru dicari di jaringan.
export function sinkronSekarang(): Promise<HasilSinkron> {
  if (sedangSinkron) return sedangSinkron;
  sedangSinkron = (async () => {
    const pusat = await pusatTersimpan();
    if (!pusat) throw new Error('Belum dipasangkan dengan HP.');
    kabar('Menghubungi HP…');
    try {
      return await sinkronkan(db, kirimKe(pusat.alamat), kabar);
    } catch (e) {
      if (!(e instanceof GalatSinkron) || e.status !== 0) throw e;
      kabar('Mencari HP di jaringan…');
      const port = Number(pusat.alamat.split(':')[1]) || PORT_BAWAAN;
      const baru = await desktop()?.cariPusat(port, pusat.id);
      if (!baru) throw e;
      await tulisMeta(db, 'pusat', { ...pusat, alamat: baru });
      return await sinkronkan(db, kirimKe(baru), kabar);
    }
  })();
  sedangSinkron
    .then((h) => kabar(`Selesai: ${h.dikirim} dikirim, ${h.diterima} diterima.`))
    .catch((e) => kabar((e as Error).message))
    .finally(() => {
      sedangSinkron = null;
    });
  return sedangSinkron;
}

// Sinkron otomatis (anggota): saat aplikasi dibuka, ditinggalkan, dan tiap 2 menit.
export function mulaiSinkronOtomatis(): () => void {
  if (peranSinkron() !== 'anggota') return () => undefined;
  const coba = () => {
    pusatTersimpan()
      .then((p) => p && sinkronSekarang())
      .catch(() => undefined);
  };
  coba();
  const ubah = () => coba();
  document.addEventListener('visibilitychange', ubah);
  const t = setInterval(coba, 120_000);
  return () => {
    document.removeEventListener('visibilitychange', ubah);
    clearInterval(t);
  };
}

// Pusat dinyalakan otomatis saat aplikasi HP dibuka, kecuali sengaja dimatikan.
export function mulaiPusatOtomatis() {
  if (peranSinkron() !== 'pusat' || !pusatDiingat()) return;
  nyalakanPusat().catch(() => undefined);
}
